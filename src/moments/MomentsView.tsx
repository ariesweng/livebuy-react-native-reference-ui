// MomentsView — family-4 player moment container (RN).
//
// Spec: `component-contracts/spec.md` § EndScreen 元件契約 (rb-rn-endscreen-live-empty-state).
// Phase-4 RN sibling of iOS `MomentsOverlayView.swift` (rb-ios-endscreen-live-empty-state, design
// R41), with the Android / Flutter siblings tracked as separate, independent follow-up changes.
//
// The top-level family-4 container. It conditionally shows the single ACTIVE
// player-lifecycle moment over the video area — at most ONE moment on screen:
//
//   1. ErrorScreen  — terminal error screen          (`LBPErrorScreen`)
//   2. EndScreen    — auto-next countdown ring + watch-next, OR (design R41) the
//                      LIVE-ended 空狀態 (「直播已結束」+ 直播時長 + 查看購物車)
//                      (`LBPEndScreen`)
//   3. StartScreen  — splash lifecycle (loading / buffering / splash)
//                      (`LBPStartScreen`)
//
// ─────────────────────────────────────────────────────────────────────────────
// MOMENT PRIORITY (mutually exclusive — at most ONE moment is shown)
// ─────────────────────────────────────────────────────────────────────────────
//   1. error    != null                       → ErrorScreen   (HIGHEST)
//   2. else a VOD channel ended with no `next` → CLOSE THE PLAYER instead of showing
//      a moment at all (`shouldCloseInsteadOfEndScreen`, design R41 — EndScreen is now
//      LIVE-only; see below)
//   3. else countdown != null || endScreenVisible → EndScreen (倒數變體 or 空狀態)
//   4. else startPhase != Done                → StartScreen
//   5. else                                   → nothing (stable playback)
//
// R41 REDESIGN (rb-rn-endscreen-live-empty-state): EndScreen is now LIVE-ONLY. The prior 熱門
// variant (「為你推薦」card wall — `hot` / `onPickHot`) is RETIRED from THIS surface's rendering
// (design R41 removed it entirely); `next` empty now shows a NEW 空狀態 instead
// (「直播已結束」+「直播時長：…」+「查看購物車」— see `EndScreenView.tsx`). A VOD (非直播) channel
// that ends with NO `next` has nothing to show at all — the 空狀態 fallback is LIVE-only too — so
// this container closes the player directly instead of entering the end moment
// (`shouldCloseInsteadOfEndScreen`, exported below, pure / unit-tested). `MomentsModel.hot` /
// `MomentsViewProps.onPickHot` are intentionally left untouched (upstream `react-native-ui` /
// `LivebuyPlayerConfig` wire — this is a reference-ui-layer change, not a cross-layer one); they
// simply have no remaining renderer.
//
// GATE-LATCH FIX (rb-rn-endscreen-live-gate-latch): the `isLive` signal step 2's
// `shouldCloseInsteadOfEndScreen` reads is now LATCHED once, at the instant the end moment
// becomes eligible (`endable` = `countdown != null || endScreenVisible` rising false -> true), and
// stays pinned to that snapshot for as long as the end moment remains eligible - reset only when
// `endable` falls back to false (video switch / new session). This exists because `onChannelChange`
// (host `LivebuyPlayer.tsx`) re-fires `isLive` on EVERY native moment-state poll tick (since
// `rn-moment-products-bridge-core`, not just on channel load), so the exact tick a live stream
// ends can also flip `isLive -> false` with no ordering guarantee against `endScreenVisible`
// turning true on that SAME tick. Without the latch, that race could misjudge a real live-ended
// stream as VOD-with-nothing-to-show and auto-close the player before EndScreen ever renders.
//
// ─────────────────────────────────────────────────────────────────────────────
// HOST-WIRED ACTION CALLBACKS (Model is PURE read-only — NO template forwarders)
// ─────────────────────────────────────────────────────────────────────────────
// There is NO public template / player moment INTENT to forward to (no `skip` /
// `retry` / `watchNext` / `cancel` / `dismiss` on `DefaultPlayerTemplate`). So the moment actions
// are HOST-WIRED CONTAINER callbacks — EXACTLY like family-2's `onJoin` / family-3's
// `onOpenProduct` (the exit is the host's / core's job, not this layer's). The host wires them to
// the core player exits it owns, e.g.:
//   • onSkip        → host → core `Player.skipStart()`
//   • onWatchNext   → host → core load(next videoId) / watch-next exit
//   • onCancel      → host → cancel the auto-next timer AND close the EndScreen overlay (design
//                     R41 — the retired 熱門變體 no longer exists to retreat to instead)
//   • onViewCart    → host → open the product list / cart (空狀態 CTA, rb-rn-endscreen-live-empty-state)
//   • onRetry       → host → core re-load (retry is core's job — SDK auto-retries
//                     3×/3s; this layer ONLY forwards the CTA tap, never retries)
//   • onDismiss     → host → dismiss the error moment
//   • onClosePlayer → host → close the player outright (the VOD-結束無-next auto-close gate;
//                     rb-rn-endscreen-live-empty-state — DISTINCT from `onDismiss`, which stays
//                     the ErrorScreen-only「返回」/「前往更新」exit)
//
// Every callback is optional, so the container renders correctly action-free
// (demo / golden / structural-snapshot tests construct it without host wiring); an
// omitted callback means the corresponding CTA is inert (or, for `onClosePlayer`, that the
// auto-close gate becomes a silent no-op — it still renders nothing, it just cannot ask the host
// to actually close). This layer NEVER calls core skip / retry / load itself, and the
// {@link MomentsModel} carries NO mutating forwarder (mirrors iOS / Android / Flutter
// `MomentsModel`, all pure read-only snapshots). Do NOT invent template forwarders — none exist
// for moments.
//
// ─────────────────────────────────────────────────────────────────────────────
// SUB-VIEW INPUT PATTERN — the contract the family-4 surfaces follow
// ─────────────────────────────────────────────────────────────────────────────
//
// Every family-4 moment surface is a function component
// `(props: { theme: ReferenceUITheme; ...byValueSnapshot; ...trailingCallbacks })`
// returning `ReactElement`, with props IN THIS ORDER:
//
//   1. `theme` (ReferenceUITheme)   — FIRST, always.
//   2. its bound SNAPSHOT VALUE(S)  — read-only state, passed BY VALUE from the
//                                      MomentsModel (never the model, never the
//                                      template).
//   3. optional action callbacks    — trailing, EACH defaulting to a no-op. The
//                                      container owns NO core action; the host wires
//                                      the exits.
//
// A surface reads ONLY its passed-in values — it MUST NOT reach back into the
// MomentsModel or DefaultPlayerTemplate (one-way data flow), MUST NOT hold a second
// copy of phase / countdown / error, MUST NOT re-classify the error kind (it is
// pre-classified by `errorKindFromType`), MUST NOT drive the countdown / skip /
// retry itself (core owns those), MUST render correctly with all callbacks omitted
// (so structural-snapshot tests construct it action-free), and MUST use plain
// View/Text/Pressable only (NO ScrollView/FlatList/SectionList/VirtualizedList; NO
// network-uri Image; NO Canvas / react-native-svg / Animated FOR DYNAMIC geometry — a single
// static, non-animated icon glyph, e.g. EndScreen's 空狀態「查看購物車」`CartFillGlyph`, is the
// one deliberate exception, see `EndScreenView.tsx`'s header comment). The auto-next
// countdown ring is a DETERMINISTIC View-based representation (a circular bordered
// View + centred remain number / View-based progress track) — NOT Canvas/SVG.
//
// The family-4 surfaces implement EXACTLY these prop signatures (see the call
// sites in the render body below):
//
//   StartScreen(props: {
//       theme: ReferenceUITheme;
//       phase: StartScreenPhase;
//       onSkip?: () => void;                              // → host-wired (core skipStart)
//   }): ReactElement
//
//     Dispatches by `phase`: `loading` → full-screen brand spinner (STATIC first
//     frame, no animation/randomness); `buffering` → lightweight OVER-CONTENT
//     indicator (does NOT cover full-screen; video visible behind); `splash` → brand
//     splash + skip pill (「略過片頭」→ onSkip); `done` → renders NOTHING (`null`).
//     A `skipSec` countdown (if drawn) is PURELY presentational — it MUST NOT
//     auto-fire skip.
//
//   EndScreen(props: {
//       theme: ReferenceUITheme;
//       countdown: EndScreenCountdown | null;             // non-null → 倒數變體
//       next: readonly EndScreenNavRow[];                 // watch-next targets (next[0] = preview)
//       onWatchNext?: () => void;                         // → host-wired
//       onCancel?: () => void;                            // → host-wired (cancels + closes)
//       onViewCart?: () => void;                          // → host-wired (空狀態 CTA)
//   }): ReactElement
//
//     倒數變體 (`countdown != null` && next non-empty): View-based ring (progress =
//     `countdown.remain / countdown.total`, centre `remain`) + `next[0]` preview card
//     (`cover` placeholder / `title`) + onWatchNext (立即觀看) / onCancel (取消). 空狀態
//     (`countdown == null` || next empty):「直播已結束」+「直播時長：…」+「查看購物車」
//     (onViewCart).
//
//   ErrorScreen(props: {
//       theme: ReferenceUITheme;
//       error: PlayerErrorState;                          // non-null (container gates on non-null)
//       onRetry?: () => void;                             // → host-wired (shown only for stream)
//       onDismiss?: () => void;                            // → host-wired
//   }): ReactElement
//
//     依 `error.kind` 切換人話文案 (NO raw code): `stream`「播放發生問題」(重試 onRetry
//     + 返回 onDismiss) / `notFound`「找不到影片」(僅 onDismiss, no retry) /
//     `outdated`「請更新版本」(前往更新 / onDismiss, no retry). `phase` is always
//     `Failed`. retry is core's job — the CTA only FORWARDS onRetry, never retries.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import type { ReferenceUITheme } from '../theme';
import { MomentsModel } from './MomentsModel';

import { StartScreen } from './StartScreenView';
import { EndScreen } from './EndScreenView';
import { ErrorScreen } from './ErrorScreenView';

import type { DefaultPlayerTemplate, EndScreenNavRow } from 'livebuy-react-native-ui';
import { StartScreenPhase } from 'livebuy-react-native-ui';

// Re-export the three family-4 moment surfaces so hosts (and the family barrel) can
// pull them from the container module (parity with the iOS/Android/Flutter family
// barrels).
export { StartScreen } from './StartScreenView';
export { EndScreen } from './EndScreenView';
export { ErrorScreen } from './ErrorScreenView';

/**
 * Whether the end-of-video moment should CLOSE THE PLAYER instead of showing EndScreen
 * (rb-rn-endscreen-live-empty-state, design R41). EndScreen is now LIVE-ONLY: a VOD (非直播)
 * channel that ends with no `next` recommendation has nothing to show — the retired 熱門變體
 * fallback no longer exists — so the player closes directly rather than entering the moment at
 * all. `true` ⟺ `!isLive && next.length === 0`. A LIVE channel ALWAYS shows the moment (the
 * 空狀態 covers `next` empty); a VOD with a non-empty `next` is unaffected — it still drives the
 * 倒數變體 unchanged. Pure / deterministic. Mirrors iOS
 * `MomentsOverlayView.shouldCloseInsteadOfEndScreen(isLiveChannel:next:)`.
 */
export function shouldCloseInsteadOfEndScreen(
  isLive: boolean,
  next: readonly EndScreenNavRow[],
): boolean {
  return !isLive && next.length === 0;
}

/** Props for the family-4 moments container. */
export interface MomentsViewProps {
  /** Live template (host-supplied). `null`/omitted → deterministic demo seeds. */
  readonly template?: DefaultPlayerTemplate | null;

  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;

  /**
   * Live-flag gate threaded to the end-screen video card (rb-rn-endscreen-recommended-video-cover).
   * `false` (snapshot / demo — the DEFAULT) → the EndScreen 倒數變體大預覽卡 draws ONLY the
   * black cover placeholder (no network `<Image>` → structural snapshot unchanged). `true` (turnkey
   * container over a real video surface) + a non-empty card `cover` → the real cover photo loads OVER
   * the placeholder via `RemoteImage`. Wired by the container (parity `PlayerShellView.live`).
   */
  readonly live?: boolean;

  /**
   * Whether the host player is currently in 乾淨模式 (clean mode — rb-rn-clean-mode-upcoming-
   * intro-coverage). Mirrored down from `PlayerShellView`'s own `cleanMode` local state (via its
   * `onCleanModeChange` callback, the SAME way the turnkey container already mirrors it for the
   * sibling chat feed — see `LivebuyPlayerOverlays.tsx`), then forwarded BY VALUE to `StartScreen`
   * on the `splash` phase ONLY (`StartScreenView.tsx`'s `cleanMode` prop hides the「略過介紹」skip
   * pill while `true`). `false` / omitted (the DEFAULT) is byte-identical to before this change —
   * every OTHER moment (`EndScreen` / `ErrorScreen`) does not read it at all.
   */
  readonly cleanMode?: boolean;

  /**
   * The EndScreen 空狀態's「直播時長：…」line, ALREADY FORMATTED (`HH:MM:SS` or `''`;
   * rb-rn-endscreen-live-duration). Mirrored down from `LivebuyPlayer.tsx`'s container-held
   * React state (via `LivebuyPlayerOverlays`), derived from `LBPlayerChannelInfo.
   * liveDurationSeconds` (moment-state-sourced raw seconds) through the pure `deriveLiveDuration`
   * fold (`channelChrome.ts`) — the SAME threading pattern as `live`/`cleanMode` above (bypasses
   * the `react-native-ui` template package entirely). `''` / omitted (the DEFAULT) forwards
   * straight through to `EndScreen.liveDuration`'s own default, which renders the existing
   * `"--:--:--"` fallback — byte-identical to before this change.
   */
  readonly liveDuration?: string;

  // Host-wired interaction callbacks. The container owns NO core action — each is
  // forwarded to the host (which wires it to the core player exit). All optional; an
  // omitted callback means an inert CTA. The Model carries NO forwarder for these
  // (moment actions are NOT template methods — mirrors iOS / Android / Flutter
  // `MomentsModel`).

  /**
   * Start-screen「略過片頭」→ host → core `Player.skipStart()`. This layer NEVER
   * skips, and `skipSec` (if drawn) MUST NOT auto-fire it.
   */
  readonly onSkip?: () => void;
  /** End-screen「立即觀看」→ host → core load(next videoId). */
  readonly onWatchNext?: () => void;
  /**
   * End-screen「取消」exit → host. Now cancels the auto-next timer AND closes the whole
   * EndScreen overlay (design R41 — no more 熱門變體 to retreat to).
   */
  readonly onCancel?: () => void;
  /**
   * 空狀態「查看購物車」CTA → host (open the product list / cart). rb-rn-endscreen-live-empty-state.
   */
  readonly onViewCart?: () => void;
  /**
   * Error-screen「重試」→ host → core re-load. retry is core's job (auto 3×/3s); this
   * layer ONLY forwards the CTA tap, NEVER retries / loads itself.
   */
  readonly onRetry?: () => void;
  /** Error-screen「返回」/「前往更新」→ host → dismiss the error moment. */
  readonly onDismiss?: () => void;
  /**
   * The VOD-結束無-next auto-close gate (`shouldCloseInsteadOfEndScreen`) → host → close the
   * player outright. rb-rn-endscreen-live-empty-state. DISTINCT from `onDismiss` above (which
   * stays the ErrorScreen-only exit, no-op by default) — a host that wires ONLY `onDismiss`
   * does NOT get this gate for free; it must wire `onClosePlayer` too (the turnkey container
   * wires both to the SAME default-close resolution — see `seams.ts` `buildMomentHandlers`).
   */
  readonly onClosePlayer?: () => void;
}

/**
 * The family-4 full-screen player moment container. Subscribes to the bound
 * template's coalesced `subscribe()` notification, re-reads the read-only
 * {@link MomentsModel} on each notify (via a `useState` tick), and shows the single
 * ACTIVE moment (error > VOD-no-next auto-close > end-countdown/空狀態 > start, mutually
 * exclusive) by passing snapshot values BY VALUE to the surface components. Paints with the
 * resolved {@link ReferenceUITheme}. All moment actions are host-wired container callbacks (no
 * template moment intents exist).
 *
 * `template == null` → the container reads the deterministic {@link MomentsSeeds} (nothing to
 * subscribe to); the host normally supplies a live {@link DefaultPlayerTemplate}.
 */
export function MomentsView(props: MomentsViewProps): ReactElement | null {
  const {
    template = null,
    theme,
    live = false,
    cleanMode = false,
    liveDuration = '',
    onSkip,
    onWatchNext,
    onCancel,
    onViewCart,
    onRetry,
    onDismiss,
    onClosePlayer,
  } = props;

  // Coalesced re-read tick (parity with the family-1/2/3 containers + the Flutter
  // ListenableBuilder re-read). On each template notify we bump the tick so React
  // re-renders and re-reads every getter off a freshly-constructed read-only model
  // (the model holds no state of its own). The demo path (template == null) has
  // nothing to subscribe to and renders the seeds.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (template == null) return;
    const unsubscribe = template.subscribe(() => setTick((t) => t + 1));
    return unsubscribe;
  }, [template]);

  const model = new MomentsModel(template);

  // rb-rn-endscreen-live-gate-latch — LATCH `isLive` once, at the instant the end moment becomes
  // eligible (`endable` false → true, the rising edge), and keep using that snapshot for as long
  // as the end moment stays eligible. `onChannelChange` (host `LivebuyPlayer.tsx`) re-fires
  // `handleHeaderChrome` on EVERY native moment-state poll tick (since
  // `rn-moment-products-bridge-core` folded live product data into the same event — not just on
  // channel load), so the exact tick a live stream ends can ALSO flip `model.isLive → false` with
  // NO ordering guarantee against `endScreenVisible` turning true on that SAME tick. Without
  // latching, that race could misjudge a real live-ended stream as VOD-with-nothing-to-show and
  // wrongly close the player before EndScreen ever renders. Reset to `null` when `endable` falls
  // back to false (video switch / new session) so the NEXT end moment re-latches fresh off the
  // then-current `isLive`. Mutating the ref during render here is deterministic (same inputs
  // always produce the same write) and intentional — it makes the latched value available to
  // `closeForVodNoNext` within the SAME render as the rising edge (design.md), avoiding an
  // extra render's worth of stale/incorrect decision that an effect-based latch would introduce.
  const endable = model.countdown != null || model.endScreenVisible;
  const latchedIsLiveRef = useRef<boolean | null>(null);
  if (endable && latchedIsLiveRef.current === null) {
    latchedIsLiveRef.current = model.isLive; // rising edge — snapshot once
  } else if (!endable) {
    latchedIsLiveRef.current = null; // reset for the next end moment
  }

  // rb-rn-endscreen-live-empty-state — the VOD-結束無-next auto-close gate. `error == null` gives
  // the terminal error branch below priority (an error and `endScreenShown` should not normally
  // coexist, but if they somehow did, the error must still win — this MUST NOT force-close a
  // player that has something more important to show). Reads the LATCHED `isLive`
  // (`rb-rn-endscreen-live-gate-latch`, above) rather than `model.isLive` directly — the
  // `?? model.isLive` fallback only matters on the very rising-edge render itself (the ref is
  // already written above by the time this line runs, so it is defensive belt-and-braces, not
  // load-bearing). MUST be a `useEffect` (not a render-time side effect) — this is a state
  // TRANSITION reaction, mirroring iOS `.onChange(of: shouldCloseForVodNoNext)`. Registered
  // UNCONDITIONALLY (Rules of Hooks) before any early return below.
  const closeForVodNoNext =
    model.error == null &&
    endable &&
    shouldCloseInsteadOfEndScreen(latchedIsLiveRef.current ?? model.isLive, model.next);
  useEffect(() => {
    if (closeForVodNoNext) onClosePlayer?.();
  }, [closeForVodNoNext, onClosePlayer]);

  // -- Host-wired action funnels (container owns NO core action) --------------
  //
  // Each forwards to the host callback. The host wires it to the core player exit it
  // owns (skipStart / load(next) / cancel+close / open-cart / re-load / dismiss). reference-ui
  // NEVER calls core skip / retry / load itself; the Model carries NO forwarder.

  // Forward「略過片頭」→ host (→ core `Player.skipStart()`). This layer NEVER skips.
  const handleSkip = (): void => {
    onSkip?.();
  };

  // Forward「立即觀看」→ host (→ core load(next videoId)).
  const handleWatchNext = (): void => {
    onWatchNext?.();
  };

  // Forward「取消」→ host (cancels the auto-next timer AND closes the EndScreen overlay).
  const handleCancel = (): void => {
    onCancel?.();
  };

  // Forward 空狀態「查看購物車」→ host (open the product list / cart).
  const handleViewCart = (): void => {
    onViewCart?.();
  };

  // Forward「重試」→ host (→ core re-load). retry is core's job (auto 3×/3s); this
  // layer ONLY forwards the CTA, NEVER retries / loads itself.
  const handleRetry = (): void => {
    onRetry?.();
  };

  // Forward「返回」/「前往更新」→ host (→ dismiss the error moment).
  const handleDismiss = (): void => {
    onDismiss?.();
  };

  // The single active moment by priority, or `null` for stable playback. Mutually
  // exclusive — error wins, then the VOD-no-next auto-close gate, then the end moment, then the
  // start splash while not `Done`.
  const error = model.error;
  if (error != null) {
    // 1. Terminal error — HIGHEST priority. The surface takes a non-null error (the
    //    container gates on non-null here).
    return (
      <ErrorScreen
        theme={theme}
        error={error}
        onRetry={handleRetry}
        onDismiss={handleDismiss}
      />
    );
  }

  if (closeForVodNoNext) {
    // 2. VOD (非直播) ended with no `next` — EndScreen is LIVE-only (design R41), so there is
    //    nothing to show. The `useEffect` above asks the host to close the player; this frame
    //    renders nothing.
    return null;
  }

  const countdown = model.countdown;
  const endScreenVisible = model.endScreenVisible;
  if (countdown != null || endScreenVisible) {
    // 3. End moment: countdown != null → 倒數變體 (auto-next → 播下一支 next[0]);
    //    countdown == null && endScreenVisible → 空狀態（直播已結束，無 next 推薦；
    //    end-screen-no-countdown / rb-rn-endscreen-live-empty-state）。An upcoming (awaitingLive)
    //    channel has countdown == null AND endScreenVisible == false AND startPhase Done → falls
    //    through to the PlayerShell upcoming chrome (no extra gate).
    return (
      <EndScreen
        theme={theme}
        countdown={countdown}
        next={model.next}
        live={live}
        liveDuration={liveDuration}
        onWatchNext={handleWatchNext}
        onCancel={handleCancel}
        onViewCart={handleViewCart}
      />
    );
  }

  if (model.startPhase !== StartScreenPhase.Done) {
    // 4. Start splash lifecycle (loading / buffering / splash). `Done` falls through
    //    to nothing (the sub-view itself also renders nothing on done).
    return (
      <StartScreen
        theme={theme}
        phase={model.startPhase}
        coverUrl={model.loadingCover}
        live={live}
        cleanMode={cleanMode}
        onSkip={handleSkip}
      />
    );
  }

  // 5. Stable playback — no moment overlay.
  return null;
}
