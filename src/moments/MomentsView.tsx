// MomentsView — family-4 player moment container (RN SKELETON).
//
// Spec: `reference-ui-rendering/spec.md` (family-4 moments, 3 full-screen surfaces).
// Phase-4 RN sibling of the DONE iOS `MomentsOverlayView.swift` (rb-ios-moments),
// Android `MomentsOverlayView.kt` (rb-android-moments), and Flutter
// `moments_view.dart` (rb-flutter-moments).
//
// The top-level family-4 container. It conditionally shows the single ACTIVE
// player-lifecycle moment over the video area — at most ONE moment on screen:
//
//   1. ErrorScreen  — terminal error screen          (`LBPErrorScreen`)
//   2. EndScreen    — auto-next countdown ring + watch-next + 熱門推薦
//                      (`LBPEndScreen` + `LBPHotCard`)
//   3. StartScreen  — splash lifecycle (loading / buffering / splash)
//                      (`LBPStartScreen`)
//
// ─────────────────────────────────────────────────────────────────────────────
// MOMENT PRIORITY (mutually exclusive — at most ONE moment is shown)
// ─────────────────────────────────────────────────────────────────────────────
//   1. error    != null                       → ErrorScreen   (HIGHEST)
//   2. else countdown != null                 → EndScreen     (倒數變體)
//   3. else startPhase != Done                → StartScreen
//   4. else                                   → nothing (stable playback)
//
// NOTE — the END moment's TWO variants: the container shows EndScreen when
// `countdown != null` (the 倒數 variant). The 熱門 variant (`countdown == null` or
// `next` empty) is governed BY the sub-view itself once shown; this skeleton gates
// EndScreen on `countdown != null` (the sub-view always accepts `hot` so it can
// render either variant). The start moment never coexists with the end moment (end
// implies the video ended → `startPhase == Done`), and error always wins. The
// `buffering` start phase is the one NON-full-bleed case (a lightweight over-content
// indicator that leaves the video visible behind) — that behaviour lives INSIDE
// `StartScreen` per `phase`, not here.
//
// ─────────────────────────────────────────────────────────────────────────────
// HOST-WIRED ACTION CALLBACKS (Model is PURE read-only — NO template forwarders)
// ─────────────────────────────────────────────────────────────────────────────
// UNLIKE family-2/3, there is NO public template / player moment INTENT to forward
// to (no `skip` / `retry` / `watchNext` / `pickHot` / `cancel` / `dismiss` on
// `DefaultPlayerTemplate`). So the moment actions are HOST-WIRED CONTAINER callbacks
// — EXACTLY like family-2's `onJoin` / family-3's `onOpenProduct` (the exit is the
// host's / core's job, not this layer's). The host wires them to the core player
// exits it owns, e.g.:
//   • onSkip       → host → core `Player.skipStart()`
//   • onWatchNext  → host → core load(next videoId) / watch-next exit
//   • onPickHot    → host → core load(hot.id) (switch to the tapped hot video)
//   • onCancel     → host → dismiss the end screen / stay
//   • onRetry      → host → core re-load (retry is core's job — SDK auto-retries
//                    3×/3s; this layer ONLY forwards the CTA tap, never retries)
//   • onDismiss    → host → dismiss the error / end screen / player
//
// Every callback is optional, so the container renders correctly action-free
// (demo / golden / structural-snapshot tests construct it without host wiring); an
// omitted callback means the corresponding CTA is inert. This layer NEVER calls core
// skip / retry / load itself, and the {@link MomentsModel} carries NO mutating
// forwarder (mirrors iOS / Android / Flutter `MomentsModel`, all pure read-only
// snapshots). Do NOT invent template forwarders — none exist for moments.
//
// ─────────────────────────────────────────────────────────────────────────────
// SUB-VIEW INPUT PATTERN — the contract the 3 Surfaces agents MUST follow
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
// network-uri Image; NO Canvas / react-native-svg / Animated). The auto-next
// countdown ring is a DETERMINISTIC View-based representation (a circular bordered
// View + centred remain number / View-based progress track) — NOT Canvas/SVG. The
// 熱門 list is a PLAIN Row/Column FIXED SMALL set — NOT a list view.
//
// The three Surfaces agents implement EXACTLY these prop signatures (see the call
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
//       hot: readonly HotRow[];                           // 熱門變體 set (FIXED SMALL — plain Row/Column)
//       onWatchNext?: () => void;                         // → host-wired
//       onPickHot?: (item: HotRow) => void;               // → host-wired
//       onCancel?: () => void;                            // → host-wired
//   }): ReactElement
//
//     倒數變體 (`countdown != null` && next non-empty): View-based ring (progress =
//     `countdown.remain / countdown.total`, centre `remain`) + `next[0]` preview card
//     (`cover` placeholder / `title`) + onWatchNext (立即觀看) / onCancel (取消). 熱門
//     變體 (`countdown == null` || next empty): `hot` as `LBPHotCard`s in a PLAIN
//     Row/Column FIXED SMALL set (first N) + onPickHot. `hot[].duration` is a number
//     in SECONDS — the surface formats it to `mm:ss` (e.g. `28` → `"00:28"`),
//     defaulting to `"00:00"` when absent (the RN template row may carry no duration).
//
//   ErrorScreen(props: {
//       theme: ReferenceUITheme;
//       error: PlayerErrorState;                          // non-null (container gates on non-null)
//       onRetry?: () => void;                             // → host-wired (shown only for stream)
//       onDismiss?: () => void;                           // → host-wired
//   }): ReactElement
//
//     依 `error.kind` 切換人話文案 (NO raw code): `stream`「播放發生問題」(重試 onRetry
//     + 返回 onDismiss) / `notFound`「找不到影片」(僅 onDismiss, no retry) /
//     `outdated`「請更新版本」(前往更新 / onDismiss, no retry). `phase` is always
//     `Failed`. retry is core's job — the CTA only FORWARDS onRetry, never retries.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import type { ReferenceUITheme } from '../theme';
import { MomentsModel } from './MomentsModel';
import type { HotRow } from './MomentsModel';

import { StartScreen } from './StartScreenView';
import { EndScreen } from './EndScreenView';
import { ErrorScreen } from './ErrorScreenView';

import type { DefaultPlayerTemplate } from 'livebuy-react-native-ui';
import { StartScreenPhase } from 'livebuy-react-native-ui';

// Re-export the three family-4 moment surfaces so hosts (and the family barrel) can
// pull them from the container module (parity with the iOS/Android/Flutter family
// barrels).
export { StartScreen } from './StartScreenView';
export { EndScreen } from './EndScreenView';
export { ErrorScreen } from './ErrorScreenView';

/** Props for the family-4 moments container. */
export interface MomentsViewProps {
  /** Live template (host-supplied). `null`/omitted → deterministic demo seeds. */
  readonly template?: DefaultPlayerTemplate | null;

  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;

  /**
   * Live-flag gate threaded to the end-screen video cards (rb-rn-endscreen-recommended-video-cover).
   * `false` (snapshot / demo — the DEFAULT) → the EndScreen 熱門卡 / 倒數變體大預覽卡 draw ONLY the
   * black cover placeholder (no network `<Image>` → structural snapshot unchanged). `true` (turnkey
   * container over a real video surface) + a non-empty card `cover` → the real cover photo loads OVER
   * the placeholder via `RemoteImage`. Wired by the container (parity `PlayerShellView.live`).
   */
  readonly live?: boolean;

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
  /** End-screen 熱門卡片 tap → host → core load(item.id) (switch to that video). */
  readonly onPickHot?: (item: HotRow) => void;
  /** End-screen「取消」/「換一批」exit → host. */
  readonly onCancel?: () => void;
  /**
   * Error-screen「重試」→ host → core re-load. retry is core's job (auto 3×/3s); this
   * layer ONLY forwards the CTA tap, NEVER retries / loads itself.
   */
  readonly onRetry?: () => void;
  /** Error / end-screen「返回」/「關閉」/「前往更新」→ host → dismiss the moment / player. */
  readonly onDismiss?: () => void;
}

/**
 * The family-4 full-screen player moment container. Subscribes to the bound
 * template's coalesced `subscribe()` notification, re-reads the read-only
 * {@link MomentsModel} on each notify (via a `useState` tick), and shows the single
 * ACTIVE moment (error > end-countdown > start, mutually exclusive) by passing
 * snapshot values BY VALUE to the surface components. Paints with the resolved
 * {@link ReferenceUITheme}. All moment actions are host-wired container callbacks
 * (no template moment intents exist).
 *
 * `template == null` → the container reads the deterministic {@link MomentsSeeds}
 * (nothing to subscribe to); the host normally supplies a live
 * {@link DefaultPlayerTemplate}.
 */
export function MomentsView(props: MomentsViewProps): ReactElement | null {
  const {
    template = null,
    theme,
    live = false,
    onSkip,
    onWatchNext,
    onPickHot,
    onCancel,
    onRetry,
    onDismiss,
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

  // -- Host-wired action funnels (container owns NO core action) --------------
  //
  // Each forwards to the host callback. The host wires it to the core player exit it
  // owns (skipStart / load(next) / load(hot.id) / re-load / dismiss). reference-ui
  // NEVER calls core skip / retry / load itself; the Model carries NO forwarder.

  // Forward「略過片頭」→ host (→ core `Player.skipStart()`). This layer NEVER skips.
  const handleSkip = (): void => {
    onSkip?.();
  };

  // Forward「立即觀看」→ host (→ core load(next videoId)).
  const handleWatchNext = (): void => {
    onWatchNext?.();
  };

  // Forward a 熱門卡片 tap → host (→ core load(item.id)).
  const handlePickHot = (item: HotRow): void => {
    onPickHot?.(item);
  };

  // Forward「取消」/「換一批」→ host.
  const handleCancel = (): void => {
    onCancel?.();
  };

  // Forward「重試」→ host (→ core re-load). retry is core's job (auto 3×/3s); this
  // layer ONLY forwards the CTA, NEVER retries / loads itself.
  const handleRetry = (): void => {
    onRetry?.();
  };

  // Forward「返回」/「關閉」/「前往更新」→ host (→ dismiss the moment / player).
  const handleDismiss = (): void => {
    onDismiss?.();
  };

  // The single active moment by priority, or `null` for stable playback. Mutually
  // exclusive — error wins, then the auto-next countdown end screen, then the start
  // splash while not `Done`.
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

  const countdown = model.countdown;
  const endScreenVisible = model.endScreenVisible;
  if (countdown != null || endScreenVisible) {
    // 2. End moment: countdown != null → 倒數變體 (auto-next → 播下一支 next[0]);
    //    countdown == null && endScreenVisible → 無倒數「直播已結束」變體（直播結束且無 next：
    //    有 hot 顯示熱門、否則只有標題，end-screen-no-countdown）。`liveEnded` gate 標題。
    //    An upcoming (awaitingLive) channel has countdown == null AND endScreenVisible == false
    //    AND startPhase Done → falls through to the PlayerShell upcoming chrome (no extra gate).
    return (
      <EndScreen
        theme={theme}
        countdown={countdown}
        next={model.next}
        hot={model.hot}
        liveEnded={endScreenVisible && countdown == null}
        live={live}
        onWatchNext={handleWatchNext}
        onPickHot={handlePickHot}
        onCancel={handleCancel}
      />
    );
  }

  if (model.startPhase !== StartScreenPhase.Done) {
    // 3. Start splash lifecycle (loading / buffering / splash). `Done` falls through
    //    to nothing (the sub-view itself also renders nothing on done).
    return (
      <StartScreen
        theme={theme}
        phase={model.startPhase}
        onSkip={handleSkip}
      />
    );
  }

  // 4. Stable playback — no moment overlay.
  return null;
}
