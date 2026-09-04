// LivebuyLiveEntry — turnkey drop-in「現正直播」floating-entry container (Tier B,
// RN parity of iOS / Android introduce-dropin-live-entry-container).
//
// 「全店現正有直播時，畫面角落浮一張入口卡，點了開播放器」是直播導流的主入口。SDK 從未把它
// 做成 drop-in：a host had to own a 30s `LivebuySDK.fetchLatestLive` poll, gate
// `liveStatus === 1`, assemble the bare `FloatingWidget`, and wire dismiss / `live_end`
// immediate-hide / drag clamp itself. That logic was re-authored in `react-native/sample`
// (`useFloatingLive` + `PanResponder` + a `POLL_RECEIVED` listener).
//
// `LivebuyLiveEntry` PROMOTES it into the package, mirroring the existing `LivebuyWidget` /
// `LivebuyPlayer` containers ("PROMOTE the Example controller → one-line drop-in"):
//
//     <View style={{ flex: 1 }}>
//       <YourHomeContent />
//       <LivebuyLiveEntry shopId="Pw8PJ99J" />                {/* all defaults */}
//       {/* or with config: */}
//       <LivebuyLiveEntry shopId="Pw8PJ99J" config={cfg} />
//     </View>
//
// Difference vs `LivebuyWidget` (avoid confusion): `LivebuyWidget` = a shop's live LIST
// (carousel / grid); `LivebuyLiveEntry` = a SINGLE auto-detected「現正直播」entry card —
// the host names no video; the container polls `fetchLatestLive` for the current
// `liveStatus === 1` session.
//
// Platform divergence (vs iOS / Android): live-end immediate-hide rides a host-provided
// `config.liveEndedSignal` subscribe-function rather than an ambient bus — RN core
// `registerListener` is a SINGLE slot (a later registration REPLACES the prior handler), so a
// host that subscribes to core events directly and any reference-ui subscription would kick each
// other; this container therefore does NOT subscribe and the host invokes the injected
// `onLiveEnded` from its own `POLL_RECEIVED` + `live_end === 1` handling. Absent the signal, the
// 30s poll + `liveStatus === 1` gate still absorbs an ended live within one interval.
// (rn-fold-host-listener-into-single-slot made the OTHER containers share one core slot via an
// internal multiplexer; that only covers reference-ui's own subscribers, so a host's DIRECT
// `registerListener` still contends — the injected-signal design here stays as is.)
//
// floating_setting (rb-rn-floating-entry-position-timing): the resting corner and the appearance
// timing are driven by three host-injected RAW wire values — `config.position` (`left_bottom` /
// `right_bottom`), `config.timing` (`immediate` / `delay`) and `config.delaySeconds`. The host
// reads them out of `sdkConfig.extensions.floating_setting`; this container NEVER touches
// `extensions` and never interprets backend semantics (`extensions` is an opaque raw bag). Both
// settings apply in BOTH `draggable` modes: the two render branches share ONE absolute resting
// style, so switching corners costs no node and no layout container. Anything outside the
// whitelists falls back to the pre-setting behaviour (right corner, no wait) through the two pure
// entry points `normalizeFloatingPosition` / `normalizeFloatingTiming`.
//
// close-grace (rb-rn-live-entry-close-grace-period): a fixed, SDK-internal, non-merchant-
// configurable 2s buffer (`LIVE_ENTRY_CLOSE_GRACE_MS`) additionally withholds the entry's
// appearance right after the user closes the sibling `CollapsibleLivebuyPlayer` container — even on
// the merchant-default `'immediate'` timing — so this card does not pop into the same corner the
// player was just dismissed from. This is a DIFFERENT trigger than `floating_setting.delay` above
// ("app cold open" vs "just closed the player") and the two are combined via `Math.max` (longer of
// the two wins), never added, never one replacing the other. See `liveEntryCloseGate.ts` for the
// cross-container memory this reads.
//
// dismiss-survives-remount (rb-rn-live-entry-dismiss-survives-remount): the host mounts this
// container only while no player is in the foreground, so opening then closing a player unmounts and
// remounts this container as a brand-new instance — the `dismissed` state in `useLiveEntry`'s
// `useState` is instance-scoped React state and would otherwise reset to `false` on that remount,
// even for the SAME live the user just explicitly closed. `liveEntryDismissMemory.ts` (a same-
// container, cross-instance memory — NOT the cross-container `liveEntryCloseGate.ts` above) records
// which live id was last explicitly closed so a reset (`applyLiveEntry`'s new-live-id branch) can
// start `dismissed` at `true` for that same id, making `LivebuyLiveEntryConfig.onClose`'s existing
// "hide until the next live" promise actually survive the remount. Only the close button (`dismiss`)
// writes it — tapping the card to watch is a different signal and never does.
//
// PURE ASSEMBLY (governance): pixels reuse the existing `FloatingWidget` surface; the drag
// clamp reuses the existing pure `clampFloatingOffset`; the state machine lives in the pure
// `liveEntryLogic.ts`. This container adds NO new pixel surface, NO view-model, and touches
// NO template / core / sample. One-way dependency `reference-ui → template → core` intact.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Animated, Dimensions, Easing, Modal, PanResponder, StyleSheet } from 'react-native';

import { LivebuySDK } from 'livebuy-react-native';
import type { LBVideoItem, SDKConfig } from 'livebuy-react-native';
import { LivebuyUI } from 'livebuy-react-native-ui';

import type { ReferenceUITheme } from '../theme';
import { ReferenceUIThemeResolver } from '../theme';
import { FloatingWidget } from '../widget/WidgetOverlayView';
import { externalLiveAwareTap } from '../widget/ExternalLive';

import { clampFloatingOffset } from './collapsibleLogic';
import { LivebuyPlayer } from './LivebuyPlayer';
import type { LivebuyPlayerConfig } from './LivebuyPlayerConfig';
import { lbWidgetEffectiveTap } from './widgetData';
import type { LivebuyLiveEntryConfig } from './LivebuyLiveEntryConfig';
import { getLastPlayerClosedAtMs } from './liveEntryCloseGate';
import { getLastDismissedLiveId, markLiveEntryDismissed } from './liveEntryDismissMemory';
import {
  applyLiveEntry,
  initialLiveEntryState,
  lbLiveEntryAppearDelayMs,
  lbLiveEntryInitialAppeared,
  lbLiveEntryRestingInset,
  lbLiveEntryTransformOrigin,
  liveEntryCloseGraceRemainingMs,
  liveEntryDismiss,
  liveEntryGate,
  liveEntryHandleEnded,
  msSinceLastPlayerClose,
  normalizeFloatingPosition,
  normalizeFloatingTiming,
  LIVE_ENTRY_DEFAULT_DELAY_SECONDS,
  LIVE_ENTRY_DEFAULT_DRAGGABLE,
  LIVE_ENTRY_DEFAULT_INSET,
  LIVE_ENTRY_DEFAULT_POLL_INTERVAL,
  LIVE_ENTRY_ENTRANCE_BEZIER,
  LIVE_ENTRY_ENTRANCE_DURATION_MS,
  LIVE_ENTRY_ENTRANCE_INITIAL_SCALE,
  LIVE_ENTRY_ENTRANCE_OPACITY_STOP,
  LIVE_ENTRY_ENTRANCE_TRANSLATE_Y,
  type LiveEntryState,
} from './liveEntryLogic';

export type { LivebuyLiveEntryConfig } from './LivebuyLiveEntryConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-hooks — file-local parity copies of the `LivebuyWidget` container hooks
// (NOT exported there), kept here so this change stays self-contained and touches
// NO sibling-container code.
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve the SDKConfig once: prefer `config.sdkConfig`, else `LivebuySDK.getSdkConfig()`. */
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

/** Resolve the reference-ui theme from the core theme + host options (existing resolver). */
function useResolvedTheme(
  sdkConfig: SDKConfig | null,
  hostOptions: LivebuyLiveEntryConfig['hostOptions'],
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

/**
 * Owns the「現正直播」entry lifecycle: poll `LivebuySDK.fetchLatestLive(shopId)` → gate
 * `liveStatus === 1` (`liveEntryGate`) → reduce via the pure `applyLiveEntry`; subscribe the
 * host live-end signal → `liveEntryHandleEnded`; expose `dismiss`. All side effects (poll
 * loop, signal subscription) are cancelled on unmount. Thin React wrapper over the pure
 * `liveEntryLogic` state machine (parity iOS / Android controller + the sample
 * `useFloatingLive`).
 */
function useLiveEntry(
  shopId: string,
  pollIntervalSeconds: number,
  liveEndedSignal: LivebuyLiveEntryConfig['liveEndedSignal'],
): { state: LiveEntryState; dismiss: (liveId: string) => void } {
  const [state, setState] = useState<LiveEntryState>(initialLiveEntryState);

  // Poll loop. `try/catch` (not a swallowed catch→null) distinguishes "no live" (gated →
  // null clears the entry) from "request failed / not yet configured" (throw → keep state,
  // 3s fast retry). Success → steady `pollIntervalSeconds` cadence.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });
    void (async () => {
      while (!cancelled) {
        try {
          const video = await LivebuySDK.fetchLatestLive(shopId);
          if (cancelled) return;
          // rb-rn-live-entry-dismiss-survives-remount: `lastDismissedId` makes a reset (new-live-id
          // apply) start `dismissed` at `true` when this is the SAME live the user explicitly closed
          // in a prior mount of this same container — the impure `getLastDismissedLiveId()` read
          // happens HERE (the call site), keeping `applyLiveEntry` itself a pure function of its
          // explicit inputs (same convention as the close-grace `getLastPlayerClosedAtMs()` read below).
          setState((s) => applyLiveEntry(s, liveEntryGate(video), getLastDismissedLiveId()));
          await wait(pollIntervalSeconds * 1000);
        } catch {
          await wait(3000); // NOT_CONFIGURED / network → keep state, retry soon
        }
      }
    })();
    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [shopId, pollIntervalSeconds]);

  // live-end immediate hide: subscribe the host signal (parity iOS .lbLiveEnded /
  // Android Flow). Absent the signal the poll + gate fallback still absorbs an ended live.
  useEffect(() => {
    if (liveEndedSignal == null) return;
    const unsubscribe = liveEndedSignal(() => setState((s) => liveEntryHandleEnded(s)));
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [liveEndedSignal]);

  // rb-rn-live-entry-dismiss-survives-remount: `dismiss` now takes the CURRENT live's id (the call
  // site already has it in scope — see `LivebuyLiveEntry`'s `card.onClose` below) and records it via
  // `markLiveEntryDismissed` so this same session stays hidden across this container's own
  // unmount/remount, in addition to the existing `dismissed = true` transition. This is the ONLY
  // call site that writes the memory — "tap the card to watch" (`onTapVideo` / default-open-player)
  // never calls `dismiss` and MUST NOT record anything.
  const dismiss = useCallback((liveId: string) => {
    markLiveEntryDismissed(liveId);
    setState((s) => liveEntryDismiss(s));
  }, []);
  return { state, dismiss };
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

/** Props for the turnkey drop-in {@link LivebuyLiveEntry}. */
export interface LivebuyLiveEntryProps {
  /** Shop ID whose ongoing live is polled (`fetchLatestLive(id = shopId)`). */
  readonly shopId: string;
  /** Per-instance wiring (all optional, each defaulted). */
  readonly config?: LivebuyLiveEntryConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turnkey drop-in「現正直播」floating entry. Owns the poll / gate / dismissed / live-end
 * lifecycle (via {@link useLiveEntry}); renders NOTHING (`null`) when there is no live, it
 * was user-dismissed, none was detected yet, or the `'delay'` countdown has not elapsed.
 * Pixels reuse {@link FloatingWidget}.
 */
export function LivebuyLiveEntry({ shopId, config = {} }: LivebuyLiveEntryProps): ReactElement | null {
  const pollInterval = config.pollInterval ?? LIVE_ENTRY_DEFAULT_POLL_INTERVAL;
  const draggable = config.draggable ?? LIVE_ENTRY_DEFAULT_DRAGGABLE;

  // Resting-corner inset — SINGLE source for both the absolute resting style (via
  // `lbLiveEntryRestingInset` below) and the drag-clamp bound. Default `{ x: 12, y: 24 }`;
  // a host with bottom chrome overrides it.
  const insetX = config.inset?.x ?? LIVE_ENTRY_DEFAULT_INSET.x;
  const insetY = config.inset?.y ?? LIVE_ENTRY_DEFAULT_INSET.y;

  // floating_setting (rb-rn-floating-entry-position-timing) — the ONLY place the host's raw wire
  // values become a corner / a timing. Everything downstream reads these two resolved values; no
  // raw string comparison may appear anywhere else in this component.
  const position = normalizeFloatingPosition(config.position);
  const timing = normalizeFloatingTiming(config.timing);
  const delaySeconds = config.delaySeconds ?? LIVE_ENTRY_DEFAULT_DELAY_SECONDS;

  const sdkConfig = useSdkConfig(config.sdkConfig);
  const theme = useResolvedTheme(sdkConfig, config.hostOptions);
  const { state, dismiss } = useLiveEntry(shopId, pollInterval, config.liveEndedSignal);

  // Default-open player presentation (dropin-live-entry-default-open-player-rn): a tap sets this ONLY
  // when the host did NOT wire `config.onTapVideo`; the `<Modal>` then presents a full-screen
  // `<LivebuyPlayer>` (design D1, mirrors widget). Independent of the entry's live state so the player
  // survives the live ending while open.
  const [presented, setPresented] = useState<LBVideoItem | null>(null);

  // Drag state (parity sample floating-live-draggable): anchored at the resting corner `position`
  // resolves to (resting offset {0,0}), clamped on-screen via the reference-ui pure
  // `clampFloatingOffset`. The bare `FloatingWidget` surface does NOT own drag — the container
  // does. The clamp inset is memoized by x/y so the PanResponder is only rebuilt when the resolved
  // inset actually changes; `position` joins the deps for the same reason.
  const liveFloatInset = useMemo(() => ({ x: insetX, y: insetY }), [insetX, insetY]);
  const liveFloatPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const liveFloatCommitted = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const liveFloatCardSize = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const liveFloatResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim only on MOVE (>3px) so a clean TAP / CLOSE still reaches FloatingWidget.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
        onPanResponderGrant: () => {
          liveFloatPan.setOffset({ x: liveFloatCommitted.current.x, y: liveFloatCommitted.current.y });
          liveFloatPan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: liveFloatPan.x, dy: liveFloatPan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_e, g) => {
          const { width, height } = Dimensions.get('window');
          const clamped = clampFloatingOffset({
            committed: liveFloatCommitted.current,
            translation: { x: g.dx, y: g.dy },
            cardSize: liveFloatCardSize.current,
            containerSize: { width, height },
            inset: liveFloatInset,
            position, // source-pinned by liveEntryPositionTiming.test.ts — clamp must follow the corner
          });
          liveFloatCommitted.current = clamped;
          liveFloatPan.setOffset({ x: 0, y: 0 });
          liveFloatPan.setValue(clamped);
        },
      }),
    [liveFloatPan, liveFloatCommitted, liveFloatCardSize, liveFloatInset, position],
  );

  // Appearance gate (`timing` + close-grace, rb-rn-live-entry-close-grace-period). Its INITIAL
  // value comes from the pure `lbLiveEntryInitialAppeared` and MUST NOT be a hardcoded boolean. On
  // a COLD-OPEN `'immediate'` path (the player has never been closed this process) the effect below
  // computes a wait of exactly `0` and its `setAppeared(true)` call is a same-value no-op against
  // this initial `true` — so this initial value is still effectively the thing that shows the entry
  // the moment it becomes eligible in that case. It is no longer the ONLY thing deciding
  // `'immediate'`'s visibility in general, though: right after a real player close, the effect below
  // withholds the entry even on the `'immediate'` path, via the close-grace mechanism
  // (source-pinned by liveEntryPositionTiming.test.ts / liveEntryCloseGracePeriod.test.ts).
  const [appeared, setAppeared] = useState<boolean>(lbLiveEntryInitialAppeared(timing));

  // The entry is showable once a live is detected and the user has not closed it. This — NOT
  // container mount — is the countdown's origin: the host keeps this container mounted permanently,
  // so counting from mount would let a live that starts later silently degrade `'delay'` into
  // `'immediate'` (design D3).
  const eligible = !state.dismissed && state.live != null;

  useEffect(() => {
    if (!eligible) {
      setAppeared(false);
      return;
    }
    // rb-rn-live-entry-close-grace-period: the actual wait before the entry may appear is the
    // LONGER (Math.max — never added, never substituted) of the merchant-configured
    // `timing`/`delaySeconds` wait and a fixed SDK-internal buffer since the user last closed
    // `CollapsibleLivebuyPlayer` (read via the module-level `liveEntryCloseGate`, since that
    // sibling container shares no React tree with this one). A cold open (the player has never
    // been closed this process) makes the grace term exactly `0`
    // (`liveEntryCloseGraceRemainingMs(null) === 0`), so `waitMs` collapses to exactly the
    // pre-existing `lbLiveEntryAppearDelayMs` value below and this effect's OBSERVABLE behaviour is
    // unchanged — including the `'immediate'` default, where `existingConfiguredDelayMs` is always
    // `0`: `waitMs <= 0` is now the ONLY "skip setTimeout, no-op the gate" boundary (replacing the
    // former `timing !== 'delay'` early return), and the `setAppeared(true)` it takes is a
    // same-value no-op against the `'immediate'` initial value below (`lbLiveEntryInitialAppeared`).
    const existingConfiguredDelayMs = lbLiveEntryAppearDelayMs(timing, delaySeconds);
    const closeGraceRemainingMs = liveEntryCloseGraceRemainingMs(
      msSinceLastPlayerClose(getLastPlayerClosedAtMs(), Date.now()),
    );
    const waitMs = Math.max(existingConfiguredDelayMs, closeGraceRemainingMs);
    if (waitMs <= 0) {
      setAppeared(true);
      return;
    }
    setAppeared(false);
    const timer = setTimeout(() => setAppeared(true), waitMs);
    return () => clearTimeout(timer); // countdown voided when the live ends / is closed / unmounts
  }, [timing, eligible, delaySeconds]);

  // Entrance animation progress (0 → 1), driven only on the `'delay'` path.
  const entranceProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (timing !== 'delay') return;
    if (!appeared) {
      entranceProgress.setValue(0);
      return;
    }
    Animated.timing(entranceProgress, {
      toValue: 1,
      duration: LIVE_ENTRY_ENTRANCE_DURATION_MS,
      easing: Easing.bezier(...LIVE_ENTRY_ENTRANCE_BEZIER),
      useNativeDriver: true,
    }).start();
  }, [timing, appeared, entranceProgress]);

  // Config for the default-open player: entry has no design field → player uses its default
  // MinimalDesign (parity iOS ③); dismiss / minimize close the Modal.
  const defaultPlayerConfig: LivebuyPlayerConfig = {
    onDismiss: () => setPresented(null),
    onMinimize: () => setPresented(null),
  };

  // Default-open player Modal (dropin-live-entry-default-open-player-rn). `<Modal>` is a top-level
  // window → full-screen regardless of the entry's small size (design D1). Kept independent of the
  // entry's live state so a live ending while the player is open does not unmount it.
  const playerModal = (
    <Modal
      visible={presented != null}
      presentationStyle="fullScreen"
      animationType="slide"
      onRequestClose={() => setPresented(null)}
    >
      {presented != null ? (
        <LivebuyPlayer videoId={presented.id} config={defaultPlayerConfig} />
      ) : null}
    </Modal>
  );

  // dismissed / no live / still inside the `'delay'` countdown → render only the player Modal if one
  // is open (parity iOS EmptyView / Android early-return, but keep an open default player alive).
  // `appeared` is permanently `true` on the `'immediate'` path, so that path is unchanged.
  if (state.dismissed || state.live == null || !appeared) {
    return presented != null ? playerModal : null;
  }
  const live = state.live;

  // Reuse the FloatingWidget surface. onTap routing (dropin-live-entry-default-open-player-rn):
  // external-platform live → open platform URL (externalLiveAwareTap, highest precedence); non-external
  // → host `onTapVideo` if wired, else the DEFAULT full-screen in-app player (Modal). onClose forwards
  // then marks dismissed.
  const card = (
    <FloatingWidget
      theme={theme}
      liveVideo={live}
      live
      onTap={externalLiveAwareTap(lbWidgetEffectiveTap(config.onTapVideo, (item) => setPresented(item)))}
      onClose={() => {
        config.onClose?.();
        dismiss(live.id);
      }}
    />
  );

  // `'delay'` only: wrap the CARD (not the positioning view) so the scale anchors on the card's own
  // corner, matching the design's `transformOrigin`, and so the drag transform on the outer view is
  // left alone. `'immediate'` adds NO node at all — that path must stay byte-identical.
  const shownCard =
    timing === 'delay' ? (
      <Animated.View
        style={{
          transformOrigin: lbLiveEntryTransformOrigin(position),
          opacity: entranceProgress.interpolate({
            inputRange: [0, LIVE_ENTRY_ENTRANCE_OPACITY_STOP, 1],
            outputRange: [0, 1, 1],
          }),
          transform: [
            {
              translateY: entranceProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [LIVE_ENTRY_ENTRANCE_TRANSLATE_Y, 0],
              }),
            },
            {
              scale: entranceProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [LIVE_ENTRY_ENTRANCE_INITIAL_SCALE, 1],
              }),
            },
          ],
        }}
      >
        {card}
      </Animated.View>
    ) : (
      card
    );

  // Apply the resting inset inline so it tracks `config.inset` AND the resolved corner (`inset.x`
  // hugs `right` at `'right_bottom'`, `left` at `'left_bottom'`); `config.style` comes AFTER so a
  // host can still override (preserves the original override semantics). Both render branches share
  // this ONE object — source-pinned by liveEntryPositionTiming.test.ts.
  const restingInset = lbLiveEntryRestingInset(position, { x: insetX, y: insetY });

  const entry = !draggable ? (
    <Animated.View style={[styles.floatingLive, restingInset, config.style]}>{shownCard}</Animated.View>
  ) : (
    <Animated.View
      style={[styles.floatingLive, restingInset, config.style, { transform: liveFloatPan.getTranslateTransform() }]}
      onLayout={(e) => {
        liveFloatCardSize.current = {
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        };
      }}
      {...liveFloatResponder.panHandlers}
    >
      {shownCard}
    </Animated.View>
  );

  return (
    <>
      {entry}
      {playerModal}
    </>
  );
}

const styles = StyleSheet.create({
  // Absolutely positioned in both `draggable` modes; WHICH bottom corner (and how far from it) is
  // applied inline from `config.position` + `config.inset` via `lbLiveEntryRestingInset`
  // (defaults: right_bottom + `LIVE_ENTRY_DEFAULT_INSET` = 12 / bottom 24) so both stay configurable.
  floatingLive: { position: 'absolute' },
});
