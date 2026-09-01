// LivebuyPlayer — turnkey drop-in player container
// (introduce-dropin-player-container-rn, reference-ui layer).
//
// Parity source: iOS `LivebuyPlayer.swift` (the parent change). The SDK
// `LivebuyPlayerCore` is HEADLESS (native video surface only); to SEE player
// chrome (header / rail / info panel / moments / product+feed overlays / chat
// composer) a host must overlay the reference-ui pixel layer on top and wire ~30
// `on*` callbacks back to the bound template. That assembly — which on RN never
// existed — is what `LivebuyPlayer` PROMOTES into the package so a host gets it in
// ONE line:
//
//     <LivebuyPlayer videoId="123" />                 // turnkey: all seams defaulted
//     <LivebuyPlayer videoId="123" config={cfg} />    // override only what differs
//
// It is a PURE ASSEMBLY layer (governance: reference-ui MUST NOT add/modify
// view-models or pixels beyond composing existing surfaces): it only composes the
// existing player-overlay family containers (player-shell / feed-win /
// product-sheets / moments / gap-surfaces — widget is the embedded-widget family,
// not a player overlay) + the on-demand composer + the existing
// `attachPlayerTemplate` forwarders + the core `LivebuyPlayerCore`. Dependency
// direction stays one-way
// `reference-ui → template (livebuy-react-native-ui) → core (livebuy-react-native)`.
//
// `LivebuyPlayer` is the GOLDEN NAME (D-0): most hosts want the assembled drop-in,
// so it gets the most intuitive name; the bare headless bridge is `LivebuyPlayerCore`
// (renamed by the prerequisite change `rename-bare-player-livebuyplayercore-rn`).
//
// OVERLAY TOPOLOGY (D-1 / R1; NOT the iOS single-hosting-controller ZStack): RN's
// bare player is a native view and the overlays are pure `.tsx`, so the container
// is a plain RN function component — an outer `View` (`pointerEvents="box-none"`)
// layers `<LivebuyPlayerCore>` (absolute-fill) UNDER absolutely-positioned overlays.
// Passthrough is `box-none` + content-aware overlays (each claims touch only where
// it draws). There is NO iOS-style sibling-hosting-controller hit-test problem.
//
// OS PiP (D-5): the container ensures `<LivebuyPlayerCore enablePiP />` (native
// handles PiP). OS PiP additionally requires the HOST APP's NATIVE capability —
// iOS Background Modes (Audio / Picture in Picture) in the host iOS app target /
// Info.plist; Android `android:supportsPictureInPicture="true"` + configChanges in
// the host `AndroidManifest.xml` — which the SDK / container CANNOT set. When that
// capability is absent the native player falls back (pause / no PiP); the container
// does not crash and does not fake success.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import { AppState, Platform, View } from 'react-native';

import { LivebuyPlayerCore, LivebuySDK, registerListener } from 'livebuy-react-native';
import type {
  LivebuyPlayerCoreRef,
  LBVideoItem,
  LBActiveEvent,
  LBEventHandler,
} from 'livebuy-react-native';
import { autoAdvanceSwitchedItem, switchedVideoItem } from './collapsibleLogic';
import { useContainerEventListener, subscribeSdkEvents } from './containerEventListener';
import type { SdkEventHandler } from './containerEventListener';
import { createForegroundResumeController } from './foregroundResumeController';
import type { ForegroundResumeController } from './foregroundResumeController';
import { attachPlayerTemplate, LivebuyUI } from 'livebuy-react-native-ui';
import type { PlayerTemplateAttachment } from 'livebuy-react-native-ui';
import type { SDKConfig } from 'livebuy-react-native';

import type { ReferenceUITheme } from '../theme';
import { ReferenceUIThemeResolver } from '../theme';

import { useChatComposer, useNicknamePrompt, useLoginPrompt } from './ChatComposerBar';
import type { LivebuyPlayerConfig } from './LivebuyPlayerConfig';
import { resolveDesign } from './ReferenceUIDesign';
import { buildAwardClaimInjection } from './seams';
import { shouldSyncAutoAdvance, videoSwitchToId } from './swipeTarget';
import { ProvideTightText } from '../TightText';
import { refreshSubtitleCuesIfUrlChanged, subtitleToggleEnabled } from './subtitlePipeline';
import type { VTTCue } from '../playershell/VTTSubtitleParser';

export type { LivebuyPlayerConfig } from './LivebuyPlayerConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-hooks (D-7). The default-seam handler builders live in `./seams` (PURE; no
// core value import) so the fake-based wiring tests never load the native bridge.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the SDKConfig once: prefer `config.sdkConfig`, else fetch via
 * `LivebuySDK.getSdkConfig()` (the host has already `configure()`d). Returns
 * `null` until the async fetch resolves.
 */
function useSdkConfig(explicit: SDKConfig | null | undefined): SDKConfig | null {
  const [resolved, setResolved] = useState<SDKConfig | null>(explicit ?? null);
  useEffect(() => {
    if (explicit != null) {
      setResolved(explicit);
      return;
    }
    let cancelled = false;
    LivebuySDK.getSdkConfig()
      .then((c) => {
        if (!cancelled) setResolved(c);
      })
      .catch(() => {
        /* not configured yet — stay null; the host re-renders after configure() */
      });
    return () => {
      cancelled = true;
    };
  }, [explicit]);
  return resolved;
}

/**
 * Adapts this package's SDK-event multiplexer ({@link subscribeSdkEvents}) into the plain
 * `(handler) => unsubscribe` shape `attachPlayerTemplate`'s `registerListener` option expects.
 *
 * rb-rn-live-activity-sheet — WHY THIS EXISTS (fixing a confirmed steady-state dead-code defect):
 * without this, `attachPlayerTemplate` (called below) falls through to its own internal
 * `defaultRegisterListener`, which calls the RAW core `registerListener` directly — a SEPARATE
 * registration from `useContainerEventListener` below (which ALSO calls the raw core
 * `registerListener`, via this SAME multiplexer). Core's `registerListener`
 * (`react-native/src/LivebuyEvents.ts`) is single-slot — its own JSDoc: "Calling registerListener
 * twice replaces the prior handler." Because `useTemplateAttachment`'s effect (below) is gated on
 * `sdkConfig != null`, which only becomes true ASYNCHRONOUSLY (after `LivebuySDK.getSdkConfig()`
 * resolves, in the standard/documented usage where the host does not pass `config.sdkConfig`
 * synchronously — see `LivebuyPlayerConfig.ts`), `attachPlayerTemplate`'s OWN raw registration
 * happens STRICTLY AFTER `useContainerEventListener`'s (which registers unconditionally on first
 * mount, `handleSdkEvent` is always non-null). Under "later wins", that would silently REPLACE
 * this container's own registration in steady state — killing `handleSdkEvent` below (its
 * `ACTIVE_EVENT_STARTED` → `template.handleActiveEventStarted` forward, the VIDEO_STATE_CHANGE /
 * PIP_STATE_CHANGE tracking, the swipe-sync-after-autoadvance derivation, and any host
 * `config.eventListener`) — a real defect this change's own verifier reproduced empirically before
 * this fix landed (see `__tests__/LivebuyPlayerTemplateRegistrationSharing.test.tsx`'s
 * registration-race coverage).
 *
 * Routing `attachPlayerTemplate`'s registration through the SAME `subscribeSdkEvents` ref-counted
 * multiplexer `useContainerEventListener` uses collapses BOTH callers onto the ONE core
 * registration the multiplexer owns — it fans the single event stream out to every subscriber, so
 * the template's own internal event routing (`WIN_RECEIVED` / `POLL_RECEIVED` / … inside
 * `TemplateAttachment.ts`'s `routeEvent`) and this container's `handleSdkEvent` now coexist
 * correctly regardless of registration order. Pure `react-native-reference-ui`-side wiring — no
 * `react-native-ui` / `react-native` (core) behavior change: `attachPlayerTemplate`'s
 * `options.registerListener` seam already existed for exactly this kind of injection (it only
 * falls back to its own raw-core default when the option is omitted).
 */
function templateRegisterListener(handler: LBEventHandler): () => void {
  return subscribeSdkEvents(registerListener, handler);
}

/**
 * Attach the Default template exactly ONCE (D-2) for the resolved `sdkConfig`,
 * wiring the player-bound seams to `playerRef` so every default works without host
 * wiring. `detach()` on unmount / sdkConfig change. Returns `null` until ready.
 */
function useTemplateAttachment(
  sdkConfig: SDKConfig | null,
  hostOptions: LivebuyPlayerConfig['hostOptions'],
  playerRef: RefObject<LivebuyPlayerCoreRef | null>,
): PlayerTemplateAttachment | null {
  const [attachment, setAttachment] = useState<PlayerTemplateAttachment | null>(null);
  useEffect(() => {
    if (sdkConfig == null) return;
    const att = attachPlayerTemplate({
      sdkConfig,
      hostOptions: hostOptions ?? LivebuyUI.hostOptions,
      // rb-rn-live-activity-sheet — share the SAME core registration `useContainerEventListener`
      // uses (see `templateRegisterListener`'s doc comment above) instead of falling through to
      // `attachPlayerTemplate`'s own raw-core default, which would collide with it.
      registerListener: templateRegisterListener,
      // Player-bound seams backed by the core ref → defaults work without host wiring.
      loadVideo: (videoId: string) => playerRef.current?.load(videoId),
      requestEventJoin: (eid: number, keyword: string) =>
        playerRef.current?.requestEventJoin(eid, keyword),
      // 🔴 FULL 2-arity — the user-entered email MUST reach core (see
      // `buildAwardClaimInjection`; EMAIL-LESS retired by rb-rn-win-claim-email-flow).
      requestAwardClaim: buildAwardClaimInjection(playerRef),
    });
    setAttachment(att);
    return () => {
      att.detach();
      setAttachment(null);
    };
  }, [sdkConfig, hostOptions, playerRef]);
  return attachment;
}

/** Resolve the reference-ui theme from the core theme + host options (existing resolver). */
function useResolvedTheme(
  sdkConfig: SDKConfig | null,
  hostOptions: LivebuyPlayerConfig['hostOptions'],
): ReferenceUITheme {
  return useMemo(
    () =>
      ReferenceUIThemeResolver.resolve({
        coreTheme: sdkConfig?.theme ?? null,
        hostOptions: hostOptions ?? LivebuyUI.hostOptions,
      }),
    [sdkConfig, hostOptions],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

/** Props for the turnkey drop-in {@link LivebuyPlayer}. */
export interface LivebuyPlayerProps {
  /** The video to play. The container `load`s it and reloads on prop change. */
  readonly videoId: string;
  /** Optional per-instance wiring. Omitting it gives a fully-defaulted player. */
  readonly config?: LivebuyPlayerConfig;
}

/**
 * Turnkey drop-in player. Attaches the Default template ONCE, resolves the theme,
 * renders the headless `<LivebuyPlayerCore>` (absolute-fill, `enablePiP`) under the
 * five player-overlay families + the on-demand chat composer (all bound to the SAME
 * `attachment.template`), wires every seam to `config.onX ?? default`, and `load`s
 * the `videoId`.
 */
export function LivebuyPlayer(props: LivebuyPlayerProps): ReactElement {
  const { videoId } = props;
  const config = props.config ?? {};

  const playerRef = useRef<LivebuyPlayerCoreRef | null>(null);
  const composer = useChatComposer();
  // On-demand 設定暱稱 modal controller (LIVE 暱稱 button + 留言 gating). Held in the container so
  // its state persists across re-renders; threaded to the design seam via PlayerOverlayContext
  // (same flow as `composer`). parity iOS / Android `NicknamePromptController`.
  const nickname = useNicknamePrompt();
  // On-demand「請先登入」modal controller for the LIVE 留言 login gate (guest + guest_comment==0).
  // Held in the container (state persists); threaded via PlayerOverlayContext. parity iOS / Android
  // `LoginPromptController` (rb-rn-live-comment-login-gate).
  const login = useLoginPrompt();

  // Cover-vs-shown video identity: the cover prop drives reloads, while in-place
  // switches (swipe / hot-pick / watch-next) move `currentVideoId` without a prop
  // change. Refs (not state) so the seam closures read the latest without re-binding.
  const currentVideoIdRef = useRef(videoId);

  // Latest `config` for the once-registered (`[]` deps) internal VIDEO_SWITCH listener below
  // (rb-rn-collapsible-autoadvance-switch-sync). `config` (and the `composedConfig` the collapsible
  // presenter passes) is rebuilt every render, so the `[]`-deps listener would otherwise capture a
  // STALE `onVideoSwitchedItem`. A ref updated every render lets the listener body read the LATEST
  // `config` without re-registering (which would churn `registerListener`/`unregisterListener`).
  // Parity Android `rememberUpdatedState(config)` inside `DisposableEffect(player)`.
  const configRef = useRef(config);
  configRef.current = config;

  // Latest channel serviceLink (dropin-service-link-default-browser-rn): the container
  // subscribes `<LivebuyPlayerCore onChannelChange>` SOLELY to capture
  // `LBPlayerChannelInfo.serviceLink` for the 聯絡商家 confirm default (the `onServiceLink` seam,
  // built in `seams.ts` / consumed via `LivebuyPlayerOverlays`). A ref (not state) — it is only
  // read inside the confirm tap handler, so no re-render is needed on every channel-change tick.
  // `''` before the first `onChannelChange` fires, or when the shop has no service link.
  const serviceLinkRef = useRef('');

  // VOD CC 字幕（rb-react-native-subtitle-vtt-caption-display）：`subtitleCues` is REAL React
  // state (not a ref like `serviceLinkRef` above) — it must trigger a re-render so a completed
  // VTT fetch actually shows up on screen, not wait for some unrelated re-render to pick it up
  // (design.md D1). `lastFetchedSubtitleUrlRef` is the换片防呆 dedupe/staleness key (the
  // `subtitleUrl` VALUE, not a channel id — `LBPlayerChannelInfo` carries no id field; design.md
  // D3), consumed by `refreshSubtitleCuesIfUrlChanged`.
  const [subtitleCues, setSubtitleCues] = useState<readonly VTTCue[]>([]);
  const lastFetchedSubtitleUrlRef = useRef('');

  // iOS-gated PiP-pause foreground-resume (rn-refui-pip-pause-foreground-resume, parity iOS
  // `ForegroundResumeController`). The wrapped headless `<LivebuyPlayerCore enablePiP>` inherits the
  // core iOS player's「background → auto OS PiP」(canStartPictureInPictureAutomaticallyFromInline); if
  // the user pauses INSIDE the PiP window and returns, AVKit only re-parents the video — it does NOT
  // un-pause — so the frame stays frozen. These refs feed the pure resume state machine below (created
  // ONLY on iOS). On Android they stay unused: N/A — ExoPlayer resumes honestly, no AVKit re-parent
  // defect (see the iOS-gated effect / internal listener below).
  const isPlayingRef = useRef(false);
  const isInPiPRef = useRef(false);
  const resumeControllerRef = useRef<ForegroundResumeController | null>(null);

  const sdkConfig = useSdkConfig(config.sdkConfig);
  const theme = useResolvedTheme(sdkConfig, config.hostOptions);
  const attachment = useTemplateAttachment(sdkConfig, config.hostOptions, playerRef);

  // rb-rn-live-activity-sheet — latest `attachment` for the once-registered (`[]` deps)
  // `activeEvents()` backfill effect below. `attachment` only becomes non-null asynchronously
  // (after `sdkConfig` resolves + `attachPlayerTemplate` runs), and the native `activeEvents()`
  // round trip is ALSO async, so which resolves first is not guaranteed — a ref read at the
  // Promise's `.then()` (rather than a value captured at effect-registration time) is what makes
  // this backfill work regardless of that race (parity `configRef`'s same ref-mirror rationale
  // above).
  const attachmentRef = useRef(attachment);
  attachmentRef.current = attachment;

  // Load the cover video (and reload on `videoId` prop change) once a ref exists.
  useEffect(() => {
    currentVideoIdRef.current = videoId;
    playerRef.current?.load(videoId);
  }, [videoId]);

  // rb-rn-live-activity-sheet (design.md D3) — ONE-SHOT mount-time backfill so a host that
  // installed its listener AFTER an activity started (and therefore missed the fire-once
  // `ACTIVE_EVENT_STARTED` push handled in `handleSdkEvent` below) still sees it. `[]` deps: this
  // MUST NOT become a polling timer (see design.md D3's rationale — the 5s goods poll + the
  // fire-once push already cover the steady-state case; this call only closes the
  // 中途進場 blind spot). `activeEvents()` resolves `[]` (never rejects) even when the native view
  // is not yet mounted, but `playerRef.current` may itself still be `null` at this exact instant on
  // some timing — `?.` no-ops in that case, matching every other `playerRef.current?.…` call in
  // this file.
  useEffect(() => {
    playerRef.current
      ?.activeEvents()
      .then((events) => {
        attachmentRef.current?.template.syncActiveEvents(events);
      })
      .catch(() => {
        /* native module Promise contract says this never rejects; swallow defensively anyway —
           a backfill failure MUST NOT throw into the host's render tree. */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Internal handler: keep the swipe baseline (`currentVideoIdRef`) fresh after a CORE
  // auto-advance (回放/VOD 播完接續下一隻 經 native load(next)，不經此容器 → ref 否則過時 →
  // swipe 上一支落到前前一支). It is registered — TOGETHER WITH the host's
  // `config.eventListener` — through the SINGLE `useContainerEventListener` subscription below
  // (rb-rn-swipe-prev-after-autoadvance, parity iOS/Android/Flutter).
  //
  // rb-rn-collapsible-autoadvance-switch-sync (4th switch-sync path): the SAME listener also drives
  // the collapsible floating card after a CORE auto-advance. `shouldSyncAutoAdvance(to, current)`
  // fires ONLY for a genuine core auto-advance — a user-interaction switch (swipe / hot-pick /
  // watch-next) synchronously advanced `currentVideoIdRef` to `to` via `switchVideo` BEFORE this
  // async VIDEO_SWITCH arrives (`to === current` → skip), so its REAL cover is not overwritten and
  // the host `onVideoSwitchedItem` is not double-called. For a core auto-advance the baseline is
  // still the previous id (`to !== current` → sync): route `to` through the EXISTING
  // `onVideoSwitchedItem` outlet with an id-only fallback item (cover empty — the VIDEO_SWITCH event
  // carries id only), so `CollapsibleLivebuyPlayer.shownVideo` updates. Its existing same-id guard is
  // the defense-in-depth. This ONLY updates `shownVideo` — it never touches the keep-alive `videoId`
  // prop, so no redundant reload and no `shouldReopenOnVideoChange` misfire.
  const handleSdkEvent: SdkEventHandler = (event) => {
    const params = event.params as Record<string, unknown>;

    // rn-refui-pip-pause-foreground-resume (iOS-gated): track live playing / real-PiP state off the
    // SAME onSdkEvent stream, and drive the deferred resume when PiP truly ends (parity iOS
    // `ForegroundResumeController` + `PiPStateAuxListener`). This is FOLDED into the existing internal
    // handler — NOT a separate `registerListener` — because the RN helper keeps a single active
    // handler (a later `registerListener` would REPLACE and kill this one, breaking the VIDEO_SWITCH
    // swipe-sync below). Android is N/A (ExoPlayer resumes honestly; the defect is AVKit re-parenting a
    // PiP-paused stream without un-pausing), so it is gated off AND the controller is only created on
    // iOS → `resumeControllerRef` is null on Android → fully inert.
    if (Platform.OS === 'ios') {
      if (event.eventName === 'VIDEO_STATE_CHANGE') {
        isPlayingRef.current = params.state === 'playing';
      } else if (event.eventName === 'PIP_STATE_CHANGE') {
        const active = params.active === true;
        isInPiPRef.current = active;
        if (!active) resumeControllerRef.current?.pipDidExit();
      }
    }

    // rb-rn-live-activity-sheet (design.md D3) — push-side intake for the template's
    // `handleActiveEventStarted`. Added to THIS handler (rather than a separate
    // `registerListener` call) because this container already owns a slot in the shared
    // `subscribeSdkEvents` multiplexer — see `useContainerEventListener` below AND
    // `templateRegisterListener`'s doc comment (the fix that makes THIS handler actually fire in
    // steady state, not just at first mount). Wire params (`LBActiveEventStartedParams`) are
    // ALREADY flat-shaped identically to the public `LBActiveEvent` (`{ id, title, keyword?,
    // duration, surplus, award }`) — no field remapping needed here (unlike `WIN_RECEIVED`, whose
    // nested `LBWinner` needs a decode step).
    if (event.eventName === 'ACTIVE_EVENT_STARTED') {
      attachment?.template.handleActiveEventStarted(params as unknown as LBActiveEvent);
    }

    // VOD CC 字幕開關即時狀態（rb-react-native-subtitle-vtt-caption-display）：`SUBTITLE_TOGGLE`
    // 走既有通用 onSdkEvent 轉發路徑（不需新橋接——見 design.md），此處把它寫回
    // `template.subtitleState`（既有 template 層公開方法，本 change 第一個真正呼叫它的消費端），
    // `PlayerShellModel.subtitleEnabled` 之後即時讀到新值（觸發既有 `template.subscribe()` 重繪）。
    if (event.eventName === 'SUBTITLE_TOGGLE') {
      attachment?.template.handleMomentSnapshot({
        subtitleEnabled: subtitleToggleEnabled(params),
      });
    }

    const to = videoSwitchToId(event.eventName, params);
    if (!shouldSyncAutoAdvance(to, currentVideoIdRef.current)) return;
    currentVideoIdRef.current = to as string;
    configRef.current.onVideoSwitchedItem?.(autoAdvanceSwitchedItem(to as string));
  };

  // ONE core subscription for BOTH the internal handler above and the host's optional extra
  // `config.eventListener` (rn-fold-host-listener-into-single-slot). core `registerListener` keeps a
  // SINGLE active handler, so the container MUST NOT open two registrations: the previous code did
  // (host effect keyed `[config.eventListener]` + internal effect keyed `[]`) and they killed each
  // other — on mount the internal one replaced the host's (`config.eventListener` silently never
  // fired), and a host that swapped its listener identity re-ran ITS effect and replaced the internal
  // one for good (the `[]` deps never re-register) → swipe baseline / collapsible sync / PiP tracking
  // permanently dead. The hook folds both into one registration: BOTH handlers are held in refs and
  // refreshed every render, so a host swapping `config.eventListener` identity changes only a ref
  // value — no re-registration, nothing gets kicked. Dispatch order is fixed internal → host (the
  // internal handler maintains container invariants; the host listener is an EXTRA observer that does
  // NOT replace the template routing), and the host forward is wrapped in try/catch so a throwing host
  // listener cannot break the internal handling. The hook also multiplexes across containers, so a
  // `LivebuyWidget` mounted at the same time (its default-open player mounts THIS container) keeps its
  // own listener alive.
  //
  // rb-rn-live-activity-sheet — a SEPARATE instance of the exact same single-slot collision existed
  // between THIS registration and `useTemplateAttachment`'s `attachPlayerTemplate` call above (which
  // used to fall through to ITS OWN raw-core registration): see `templateRegisterListener`'s doc
  // comment for the fix (both callers now share this SAME `subscribeSdkEvents` slot).
  useContainerEventListener(registerListener, {
    internal: handleSdkEvent,
    host: config.eventListener,
  });

  // iOS-gated foreground-resume after a PiP-window pause (rn-refui-pip-pause-foreground-resume, parity
  // iOS `ForegroundResumeController`). The pure state machine (was-playing `armed` latch + deferred
  // `resumeOnPiPExit` intent) decides whether / when to call the core ref's `play()`:
  //   • fallback pause (no PiP) → resume IMMEDIATELY on foreground;
  //   • real PiP + paused-in-PiP → DEFER to PiP-exit (the internal listener above calls pipDidExit()),
  //     because AVKit's PiP restore only re-parents the video, it does NOT un-pause it.
  // `AppState` 'background' ↔ iOS didEnterBackgroundNotification (real background only); 'active' ↔
  // willEnterForeground. The transient 'inactive' (control center / incoming call / app-switcher
  // preview) is IGNORED — it is not a true background per iOS semantics, matching the native observer
  // that only fires on real background. Android does NOT reach here (early return): no controller, no
  // AppState observer — it stays on the existing behaviour.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const controller = createForegroundResumeController({
      isPlaying: () => isPlayingRef.current,
      isInPiP: () => isInPiPRef.current,
      resume: () => {
        playerRef.current?.play();
      },
    });
    resumeControllerRef.current = controller;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') controller.appDidEnterBackground();
      else if (state === 'active') controller.appWillEnterForeground();
    });
    return () => {
      sub.remove();
      resumeControllerRef.current = null;
    };
  }, []);

  // The single source for in-place switches: records the new id + notifies the host. `item` (when
  // the caller resolved the switched video's REAL cover / title — hot-pick / watch-next) is
  // reported via `onVideoSwitchedItem` so a minimized floating preview shows the switched video;
  // swipe omits it (id-only, no adjacency rows in JS) → a cover-empty fallback with the correct id
  // (rb-rn-collapsible-player-track-switch). `onVideoSwitched(id)` fires unchanged either way.
  const switchVideo = (newId: string, item?: LBVideoItem): void => {
    currentVideoIdRef.current = newId;
    config.onVideoSwitched?.(newId);
    config.onVideoSwitchedItem?.(
      item ??
        switchedVideoItem({ id: newId, cover: '', title: '', duration: 0, liveStatus: 1 }),
    );
  };

  return (
    // rb-rn-refui-text-tighten-line-spacing: tighten line spacing (Android includeFontPadding=false)
    // for every Text in the player overlay (parity Android `ProvideTightText`). The native
    // `LivebuyPlayerCore` is unaffected (provider only flips a Text-style context).
    <ProvideTightText>
      <View style={[{ flex: 1 }, config.style]} pointerEvents="box-none">
      {/* Headless native player — absolute-fill BOTTOM layer; OS PiP armed (D-5). */}
      <LivebuyPlayerCore
        ref={playerRef}
        videoId={videoId}
        enablePiP
        // Capture serviceLink ONLY (dropin-service-link-default-browser-rn) — see serviceLinkRef above.
        // NOTE: no explicit `LBPlayerChannelInfo` type import — that type is not part of
        // `livebuy-react-native`'s public index.ts export surface (an existing, unrelated gap the
        // prerequisite core-rn change deliberately left alone); TS infers `info`'s shape
        // contextually from `LivebuyPlayerCoreProps.onChannelChange`'s declared signature.
        onChannelChange={(info): void => {
          serviceLinkRef.current = info.serviceLink;
          // VOD CC 字幕（rb-react-native-subtitle-vtt-caption-display）：抓取 + 解析
          // `channel.subtitle_url`（換片防呆 + staleness 邏輯見 `subtitlePipeline.ts`），同時餵
          // `handleRailEnablement({ subtitleAvailable })` 讓側欄 CC 鈕的可見性正確反映這支影片是否
          // 有字幕（design.md D4 —— 否則「修好死按鈕」名不符實：按鈕根本不會出現）。fire-and-forget
          // （onChannelChange 是同步 callback，抓取 VTT 是非同步）。
          void refreshSubtitleCuesIfUrlChanged({
            isSubtitle: info.isSubtitle,
            subtitleUrl: info.subtitleUrl,
            lastFetchedUrlRef: lastFetchedSubtitleUrlRef,
            setCues: setSubtitleCues,
            setAvailable: (available): void =>
              attachmentRef.current?.template.handleRailEnablement({
                subtitleAvailable: available,
              }),
          });
        }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* The whole player overlay, composed by the resolved design
          (`config.design ?? MinimalDesign`). The default `MinimalDesign` returns the
          existing `LivebuyPlayerOverlays` tree — the five player-overlay families +
          on-demand composer, all bound to the SAME template and absolutely positioned
          over the video (box-none passthrough). Rendered only once the template is
          attached. */}
      {attachment != null
        ? resolveDesign(config.design).playerOverlay({
            attachment,
            theme,
            config,
            composer,
            nickname,
            login,
            playerRef,
            currentVideoId: (): string => currentVideoIdRef.current,
            switchVideo,
            serviceLink: (): string => serviceLinkRef.current,
            subtitleCues,
          })
        : null}
      </View>
    </ProvideTightText>
  );
}
