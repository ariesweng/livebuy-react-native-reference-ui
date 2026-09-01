// PlayerShellView — family-1 player-shell container (RN SKELETON).
//
// Spec: `reference-ui-rendering/spec.md` (family-1 player-shell, 4 surfaces).
// Phase-4 RN sibling of the DONE iOS `PlayerShellView.swift`
// (rb-ios-player-shell D-1 / D-2), Android `PlayerShellView.kt`
// (rb-android-player-shell), and Flutter `player_shell_view.dart`
// (rb-flutter-player-shell). This RN family is built FROM SCRATCH and bakes in
// the iOS-reconciled FINAL state.
//
// The top-level family-1 container. It lays out the FOUR family-1 surface
// components over a video area:
//
//   1. PlayerHeaderBar    — pinned TOP        (`LBPTopBar` / `LBPHostBadge`)
//   2. OperationRail      — pinned TRAILING   (`LBPSideRail`)
//   3. VideoInfoPanel     — bottom sheet      (`LBPBottomSheet` / `VideoInfoSheet`)
//   4. LiveOverlayChrome  — full-bleed overlay (`live-chrome.jsx`)
//
// This SKELETON owns the layout, a read-only {@link PlayerShellModel}, the
// resolved {@link ReferenceUITheme}, and composes the four surface components by
// import name. The four parallel Surfaces agents land those files after this
// skeleton — until they exist this file will not type-check on its own; that is
// the EXPECTED skeleton state. The container FIXES the call-site shapes so the
// agents converge on the SUB-VIEW INPUT PATTERN documented below.
//
// ─────────────────────────────────────────────────────────────────────────────
// SUB-VIEW INPUT PATTERN — the contract the 4 Surfaces agents MUST follow
// ─────────────────────────────────────────────────────────────────────────────
//
// Every family-1 surface is a function component
// `(props: { theme: ReferenceUITheme; ...byValueSnapshot; ...trailingCallbacks })`
// returning `ReactElement`, with props IN THIS ORDER:
//
//   1. `theme` (ReferenceUITheme)   — FIRST, always.
//   2. its bound SNAPSHOT VALUE(S)  — read-only state, passed BY VALUE from the
//                                      PlayerShellModel (never the model, never
//                                      the template).
//   3. optional action callbacks    — trailing, EACH defaulting to a no-op. The
//                                      shell does NOT own actions; the host wires
//                                      taps to core `simulate*`.
//
// A surface reads ONLY its passed-in values — it MUST NOT reach back into the
// PlayerShellModel or DefaultPlayerTemplate (one-way data flow, D-1/D-4), MUST
// NOT hold a second copy of state, MUST render correctly with all callbacks
// omitted (so structural snapshot tests construct it action-free), MUST use
// plain View/Text/Pressable/Image only (NO ScrollView/FlatList/SectionList/
// VirtualizedList, NO network-uri Image).
//
// The four Surfaces agents implement EXACTLY these prop signatures (see the call
// sites in the render body below):
//
//   PlayerHeaderBar(props: {
//       theme: ReferenceUITheme;
//       title: string; hostName: string; shopLogo: string;
//       viewerCount: number; isSubscribed: boolean;
//       onMinimize?: () => void; onToggleSubscribe?: () => void;
//   }): ReactElement
//   (top-right = a single minimize button → onMinimize; mute / share / info / close
//    are NOT header controls — mute is the tap-to-mute gesture, share / info the rail.)
//
//   OperationRail(props: {
//       theme: ReferenceUITheme;
//       items: readonly LBSideRailItem[]; bagCount: number;
//       heartBurstTick: number; muted: boolean;
//       onTapItem?: (kind: LBSideRailKind) => void;
//   }): ReactElement
//
//   VideoInfoPanel(props: {
//       theme: ReferenceUITheme;
//       fields: LBInfoTabState; isSubscribed: boolean;
//       activeTab: LBInfoPanelTab; noticeCanOpen: boolean;
//       systemNotice: string; notice: string;
//       onSelectTab?: (tab: LBInfoPanelTab) => void;
//   }): ReactElement
//
//   LiveOverlayChrome(props: {
//       theme: ReferenceUITheme;
//       announceText: string; pinnedProducts: readonly LBProduct[];
//       hostCaption?: string; showGestureHints?: boolean;
//       onTapPinnedProduct?: () => void;
//   }): ReactElement
//
// NOTE: on RN `LBInfoTabState` BUNDLES `isSubscribed` (the template mirrors it
// from the single PlayerHeader truth via `currentWith`). The container still
// passes `isSubscribed` to VideoInfoPanel as a SEPARATE prop for parity with the
// Flutter sub-view input shape (same value the bundled field carries).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { View, Pressable, PanResponder } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { PlayerShellModel } from './PlayerShellModel';

import { PlayerHeaderBar } from './PlayerHeaderBarView';
import { OperationRail, FloatingBagButton } from './OperationRailView';
import { VideoInfoPanel } from './VideoInfoPanelView';
import { ContactMerchantModal } from './ContactMerchantModalView';
import { BottomSheetPresenter } from '../productsheets/BottomSheetPresenter';
import { LiveOverlayChrome, visiblePinnedProducts } from './LiveOverlayChromeView';
import { NowIntroducingCarousel } from './NowIntroducingCarouselView';
import { HeartBurst } from './HeartBurst';
import { LiveBottomBarView } from './LiveBottomBarView';
import { UpcomingCountdownView } from './UpcomingCountdownView';
import { PlaybackProgressBarView } from './PlaybackProgressBarView';
import { CaptionOverlayView } from './CaptionOverlayView';
import { VTTSubtitleParser } from './VTTSubtitleParser';
import type { VTTCue } from './VTTSubtitleParser';

import { LBTestIDs } from '../testing/LBTestIDs';

import type { LBProduct } from 'livebuy-react-native';
import type { DefaultPlayerTemplate, LBMiniCartPeek } from 'livebuy-react-native-ui';
// LBInfoPanelTab is an enum used as a VALUE (onTapAnnounce → LBInfoPanelTab.Notice) — value import.
import { LBInfoPanelTab, LBSideRailKind, StartScreenPhase } from 'livebuy-react-native-ui';

// Re-export the four family-1 surfaces so hosts (and the family barrel) can pull
// them from the container module (parity with the iOS/Flutter family barrels).
export { PlayerHeaderBar } from './PlayerHeaderBarView';
export { OperationRail } from './OperationRailView';
export { VideoInfoPanel } from './VideoInfoPanelView';
export { LiveOverlayChrome } from './LiveOverlayChromeView';
export { CaptionOverlayView } from './CaptionOverlayView';

/** Props for the family-1 player-shell container. */
export interface PlayerShellViewProps {
  /** Live template (host-supplied). `null`/omitted → deterministic demo seeds. */
  readonly template?: DefaultPlayerTemplate | null;

  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;

  // Host-wired interaction callbacks. The shell owns NO action — each is surfaced as an intent for
  // its CONSUMER to route (the turnkey container's `config.onX ?? default` seams, or a real host
  // closure). The destination is NOT always a core `simulate*` — some seams land on a system share
  // / in-app browser / a local modal. All optional; `undefined` (standalone / demo / snapshot) →
  // the intent is DROPPED, not auto-forwarded to core.

  /** Host-wired minimize → host collapses the player into the bottom-right floating
   *  widget. */
  readonly onMinimize?: () => void;
  /** Host-wired mute toggle, fired by the tap-to-mute gesture on the video area
   *  (NOT a header button). host → core `simulate*`. */
  readonly onToggleMute?: () => void;
  /** Host-wired subscribe toggle (host → core `simulate*`). */
  readonly onToggleSubscribe?: () => void;
  /**
   * Whether the header avatar's subscribe badge (+/✓) renders at all
   * (rb-rn-subscribe-favorite-visibility-toggle). The container forwards
   * `config.showSubscribe`. Default `false` (leaf `PlayerHeaderBar` owns the fallback) — a
   * deliberate reversal of the previous always-visible behaviour; a host opts in with `true`.
   * Forwarded verbatim (no fallback applied at this layer) to BOTH `<PlayerHeaderBar>` call
   * sites below (the LIVE/VOD main branch and the upcoming-countdown branch). Orthogonal to
   * `onToggleSubscribe` — this only gates whether the badge mounts, never that callback's
   * behaviour once mounted.
   */
  readonly showSubscribe?: boolean;
  /**
   * Merchant capability gate for the header title marquee (rb-rn-marquee-title-scroll), RAW.
   * The container forwards `config.titleScroll` (itself the raw
   * `sdkConfig.extensions['video_title_scroll']` the host read out) VERBATIM — no fallback is
   * applied at this layer; the leaf title slot (`MarqueeTitleView.normalizeTitleScroll`) owns
   * the ONE fallback, which lands on「may scroll」for omitted / malformed values.
   *
   * Forwarded to BOTH `<PlayerHeaderBar>` call sites below — the LIVE/VOD main branch AND the
   * `model.isUpcoming` early-return branch. ⚠️ The upcoming branch is NOT optional here the way
   * it happens to be for `showSubscribe`: an upcoming header still draws, measures and scrolls
   * its title, so skipping it would silently ignore the merchant's setting on scheduled-live
   * videos (the same trap Android's requirement calls out). Any NEW shell branch must be
   * enumerated and wired too.
   */
  readonly titleScroll?: unknown;
  /**
   * Side-rail / LIVE-bottom-bar item tap, by kind. **This view only forwards** — it owns no core
   * action and never calls a `simulate*` itself. Where the intent actually lands is owned by the
   * consumer: the turnkey container injects its `onTapRailItem` seam (whose default routes `Like`
   * to core `operationPanel.simulateLikeTap()` — rb-rn-like-tap-wire — and leaves the other kinds
   * as no-ops), while the standalone / demo / snapshot paths leave this prop `undefined` so the tap
   * is an optional no-op (pixels unchanged). Do NOT read this JSDoc as「host-wired → core」: without
   * a consumer wiring it, the intent is DROPPED — core cannot see a rail tap that reference-ui drew.
   */
  readonly onTapRailItem?: (kind: LBSideRailKind) => void;
  /**
   * 頻道分享預設 fallback（rb-rn-player-share-default-sheet，parity iOS `rb-ios-live-share-default-sheet`
   * / `rb-ios-vod-rail-share-default-sheet`）。容器（`LivebuyPlayerOverlays`）注入 `sheet.onShare`
   * （= `config.onShare ?? (shareUrl 非空時 shareSystem(shareUrl))`）；直播/回放底部 bar 與純 VOD 側欄的分享鈕
   * 皆 funnel 進 {@link handleRailTap}`(Share)`，於 `onShare != null` 時走它（未攔截 host 得系統分享）。
   * `undefined`（非容器 / snapshot）→ 退回既有 rail 路由（`onTapRailItem`），像素不變。
   */
  readonly onShare?: () => void;
  /**
   * 聯絡商家 confirm「確定」預設 fallback（dropin-service-link-default-browser-rn，parity iOS/Android
   * `performServiceLink()`）。容器（`LivebuyPlayerOverlays`）注入 `shell.onServiceLink`
   * （= `config.onServiceLink ?? (serviceLink 非空時開站內瀏覽器)`）；`confirmContactMerchant`
   * 於 `onServiceLink != null` 時走它（未攔截 host 得站內瀏覽器）。`undefined`（非容器 / snapshot）→
   * 退回既有 rail 路由（`onTapRailItem?.(ServiceLink)`），像素不變。
   */
  readonly onServiceLink?: () => void;
  /**
   * LIVE 釘選卡卡體 tap. NO-ARG — it cannot carry the tapped product, so the turnkey
   * container wires it to `setProductListPresented(true)` (opens the product LIST
   * overlay), NOT to a per-product detail. Do NOT confuse this with the same-named but
   * different-layer `LivebuyPlayerConfig.onOpenProduct` (carries an `LBProduct`, opens
   * THAT product's DETAIL sheet — rb-rn-product-tap-wire). The per-product LIVE-pinned
   * route is a known four-platform gap (Android passes the product through); closing it
   * needs a signature change here and is deliberately out of scope (see that change's
   * design.md D6).
   */
  readonly onOpenProduct?: () => void;
  /** LIVE bottom bar 留言 tap → host opens its comment composer (the bar's other
   *  buttons route through {@link onTapRailItem} by kind). */
  readonly onComment?: () => void;
  /**
   * LIVE bottom bar 暱稱 tap → the container presents the 設定暱稱 modal locally (parity
   * iOS / Android `rb-*-live-nickname-modal-and-comment-gate`). Unlike the other bar buttons
   * (routed through {@link onTapRailItem} by kind, where reference-ui has no core exit so the
   * 暱稱 rail tap was a silent host no-op), the container wires this to
   * `nickname.present(false)`. Default falls back to the rail route (demo / standalone).
   */
  readonly onNickname?: () => void;
  /**
   * VOD now-introducing 卡片 body tap → host opens THAT product's detail
   * (rb-rn-now-introducing-real-image-carousel，問題 9/10). Unlike {@link onOpenProduct}
   * (the single LIVE pinned card, no arg), the carousel carries the tapped `LBProduct`.
   * Host wires it to core `simulateProductTap(product)`. Default no-op (demo / snapshot).
   */
  readonly onTapNowIntroducingProduct?: (product: LBProduct) => void;
  /**
   * Real product images over the VOD now-introducing carousel (`true` → host runtime
   * loads photos; `false` / default → placeholders, snapshot byte-stable). Mirrors iOS
   * `live` / Android / Flutter. Read-only.
   */
  readonly live?: boolean;
  /**
   * Reports the info panel (VideoInfoPanel bottom sheet) open/closed state to the container so
   * it can hide the higher-layer chat feed while the panel is up (parity iOS rb-ios-info-panel-
   * not-covered-by-chat). Default no-op. Read-only report — the panel's own state is unchanged.
   */
  readonly onInfoPanelOpenChange?: (open: boolean) => void;
  /**
   * Whether to draw the once-per-open LIVE gesture hints (parity iOS `showGestureHints`). The
   * container forwards `config.showGestureHints`. Default false → only when the host opts in.
   */
  readonly showGestureHints?: boolean;
  /**
   * Whether the on-demand 留言 composer is up. `true` → hide the LIVE bottom bar so it does not
   * peek behind the opaque composer (parity iOS `composerPresented`). Default false.
   */
  readonly composerPresented?: boolean;
  /**
   * Swipe toward an EMPTY direction (no next / prev video) → close the player
   * (swipe-nav-close-on-empty). The internal vertical-swipe navigates when an adjacent
   * video exists, else raises this instead of the prior silent no-op (the list is at its
   * head / tail). `undefined` / default → swipe-to-empty is a no-op (demo / snapshot). The
   * container wires this from `config.onDismiss ?? player.unload()`. Parity iOS / Android
   * `PlayerShellView.onCloseRequest`.
   */
  readonly onCloseRequest?: () => void;
  /**
   * Reports the NEW video id after a vertical-swipe in-place switch resolves a non-null adjacent
   * target (swipe-video-switched-notify, parity iOS / Android). The container wires this to its
   * `switchVideo` (records the shown id + raises `config.onVideoSwitched(id)`) so a host-bound
   * video mirror (the minimized floating preview) tracks the shown video after a swipe — parity
   * with the watch-next / hot-pick paths. Empty-direction swipe (close-on-empty) does NOT report.
   * `undefined` (demo / snapshot) → no report.
   */
  readonly onDidSwitchVideo?: (videoId: string) => void;
  /**
   * Reports the「乾淨模式」(`cleanMode`) open/closed state to a container so a family that lives
   * OUTSIDE `PlayerShellView`'s render tree (e.g. the `feedwin` family's `ChatFeedView`) can also
   * hide itself while clean mode is on (rb-rn-gesture-clean-mode-rewrite, design `screens.jsx`
   * R23) — mirrors the established {@link onInfoPanelOpenChange} precedent (same reason:
   * `PlayerShellView` cannot reach outside its own tree to hide a sibling family, only report
   * state for a wrapping container to act on). Fired on every `cleanMode` change, INCLUDING the
   * initial mount (parity `onInfoPanelOpenChange`). Default `undefined` (demo / unwired) → inert
   * no-op; `cleanMode`'s own internal effects (chrome visibility, `PlaybackProgressBarView`
   * `isExpanded`) are unaffected either way.
   */
  readonly onCleanModeChange?: (cleanMode: boolean) => void;
  /**
   * VOD CC 字幕 cue 清單（rb-react-native-subtitle-vtt-caption-display）. **NOT** template-derived
   * — there is no `DefaultPlayerTemplate` public read surface for the active-caption TEXT (only
   * the `enabled` toggle, exposed as `PlayerShellModel.subtitleEnabled` — see design.md D1/D2 for
   * why the two live in different places). The turnkey container `LivebuyPlayer` fetches + parses
   * `channel.subtitle_url` (a WebVTT file) after `onChannelChange` and threads the result down
   * through `PlayerOverlayContext.subtitleCues` → `LivebuyPlayerOverlays` → this prop. Default
   * `[]` (demo / standalone / snapshot) → no caption text is ever shown, existing baselines
   * byte-identical. `PlayerShellView` looks up the cue active at `model.position` via
   * `VTTSubtitleParser.activeCue` — no host-supplied caption-text override exists on RN (Non-Goal,
   * see design.md).
   */
  readonly subtitleCues?: readonly VTTCue[];
}

/**
 * Vertical-swipe commit threshold (pt). A drag whose vertical translation reaches
 * this distance claims the gesture + fires adjacent-video navigation; smaller
 * moves stay with the tap-to-mute Pressable (parity to iOS `swipeThreshold = 60`).
 */
const SWIPE_THRESHOLD = 60;

/**
 * Long-press hold duration (ms) that toggles `cleanMode` (rb-rn-gesture-clean-mode-rewrite,
 * design `screens.jsx` R23) — implemented via RN `Pressable`'s native `onLongPress` +
 * `delayLongPress`, NOT a hand-rolled timer (see this change's design.md Decision 1). Applies
 * uniformly regardless of `allowsTapToggleMute`'s LIVE/VOD tap-mute-vs-play-pause split.
 */
const LONG_PRESS_CLEAN_MODE_DELAY_MS = 450;

/** The template-nav FALLBACK swipe action for a committed swipe toward one direction
 *  (swipe-nav-close-on-empty). */
export type SwipeNavFallbackAction = 'navigate' | 'close';

/**
 * PURE: classify the template-nav fallback swipe toward a direction by its adjacency flag —
 * `hasAdjacentVideo` true → `'navigate'` (go to that adjacent video), false → `'close'`
 * (close the player; the list is at its head / tail). Unit-testable without rendering a
 * gesture (per unit-test discipline). The swipe DIRECTION (which branch — up=next / down=prev)
 * is resolved in the gesture, so this keys only on the relevant direction's adjacency flag —
 * the navigate-vs-close half of iOS `PlayerShellView.resolveSwipeNav`. Parity Android
 * `resolveSwipeNavFallback`.
 */
export function resolveSwipeNavFallback(hasAdjacentVideo: boolean): SwipeNavFallbackAction {
  return hasAdjacentVideo ? 'navigate' : 'close';
}

/**
 * PURE: whether the vertical-swipe gesture is allowed to drive adjacent-video navigation (or
 * close-on-empty) in the current mode (rb-rn-live-swipe-gesture-gating). `isLive` is
 * `model.isLive` (`channel.liveStatus === 1`, host-fed) — it is mutually exclusive with both
 * upcoming (`isUpcoming`, `liveStatus === 0`) and finished-live replay (`isFinishedLiveReplay`,
 * `liveStatus === 3` / `type === 3`), so `isLive === true` already means "actively live, not
 * upcoming, not replay" (parity design `screens.jsx`'s `liveInProgress = effectiveState ===
 * 'live_main' && !isUpcoming && !isReplay`). Live in progress → `false` (the gesture is still
 * CLAIMED by the PanResponder threshold check so it does not fall through to tap-to-mute; this
 * function only gates whether `onPanResponderRelease` executes the navigate / close-on-empty
 * action). Upcoming / finished-live replay / VOD → `true` (unchanged existing behaviour). Unit-
 * testable without rendering a gesture (per unit-test discipline), parity iOS reference-ui's
 * `PlayerShellView.allowsHoldToPause(isLive:)` (same `isLive` signal, gates hold-to-pause instead
 * of swipe-to-navigate).
 */
export function allowsSwipeNav(isLive: boolean): boolean {
  return !isLive;
}

/**
 * PURE: whether a single tap on the video-area `Pressable` toggles MUTE (vs. play/pause)
 * (rb-rn-gesture-clean-mode-rewrite, design `screens.jsx` R23). `isLive === true` (actively live,
 * not upcoming, not a finished-live replay — same signal as {@link allowsSwipeNav}'s `isLive`)
 * → `true`, `onPress` calls the existing host-wired `onToggleMute`. `isLive === false` (VOD /
 * finished-live replay / any non-live-in-progress state) → `false`, `onPress` calls the existing
 * view-model forwarder `model.togglePlayPause()` (from `rn-vod-playback-progress-template`) instead
 * — no new mute / play-pause API either way. This is the EXACT logical complement of
 * {@link allowsSwipeNav} over the same single `isLive` signal
 * (`allowsTapToggleMute(x) === !allowsSwipeNav(x)`): while a stream is actively live, tap stays on
 * mute and swipe is suppressed; once it is not (upcoming / replay / VOD), tap flips to play/pause
 * and swipe drives navigation. A dedicated named function (rather than inlining
 * `!allowsSwipeNav(...)`) keeps the call site self-documenting, per this file's existing
 * convention of one named pure function per gesture decision point. Unit-testable without
 * rendering a gesture (per unit-test discipline).
 */
export function allowsTapToggleMute(isLive: boolean): boolean {
  return isLive;
}

/**
 * The double-tap-to-like time window (ms, rb-rn-live-double-tap-like), aligned with
 * `design/templates/minimal/screens.jsx`'s `sinceLast < 320`. Parity iOS `0.32` (TimeInterval,
 * seconds) / Android `windowMs: Long = 320L`.
 *
 * HISTORICAL NAME (rb-rn-live-double-tap-like-replay-extend): the name still reads "LIVE" but the
 * window's applicability was widened by that change to also cover a finished-live replay (see
 * {@link usesLiveHeartGesture}) — the constant itself, and its value, are unchanged, only which
 * modes call into it. Kept unrenamed deliberately (design.md Decision 3): it is the cross-platform
 * comparison string shared with Android's `internal val DOUBLE_TAP_LIKE_WINDOW_MS` /
 * iOS's `liveDoubleTapWindow`.
 */
export const DOUBLE_TAP_LIKE_WINDOW_MS = 320;

/**
 * PURE: whether `nowMs` falls within {@link DOUBLE_TAP_LIKE_WINDOW_MS} of `lastTapAtMs` — the
 * video-area double-tap-to-like time-window decision (rb-rn-live-double-tap-like).
 * `lastTapAtMs == null` (no prior qualifying tap recorded yet — first tap ever, or first
 * LIVE/replay tap after a stretch that did not qualify) → `false` (a lone tap can never be a
 * double-tap). The comparison is strict `<` (a gap of EXACTLY `windowMs` does NOT count as a
 * double-tap). Unit-testable without rendering a gesture (per unit-test discipline). Parity iOS
 * `PlayerShellView`'s inline `sinceLast < 0.32` / Android top-level `internal fun isLiveDoubleTap`.
 *
 * Deliberately NOT merged with {@link allowsTapToggleMute} (see design.md Decision 3 of
 * `rb-rn-live-double-tap-like`) — this function expresses ONLY the time-window half of the
 * decision; WHICH modes it applies to at all is the separate, orthogonal
 * {@link usesLiveHeartGesture} decision (rb-rn-live-double-tap-like-replay-extend design.md
 * Decision 2). The video-area `Pressable`'s `onPress` still dispatches unmodified via
 * `allowsTapToggleMute(model.isLive)` for what a SINGLE tap does, and separately calls this
 * function inside whichever branch `usesLiveHeartGesture` allows.
 *
 * HISTORICAL NAME (rb-rn-live-double-tap-like-replay-extend): the name still reads "Live" but the
 * function itself never referenced liveness — it always was, and remains, a pure time-window
 * comparison over two timestamps. Kept unrenamed for the same cross-platform-string-match reason
 * as {@link DOUBLE_TAP_LIKE_WINDOW_MS}.
 */
export function isLiveDoubleTap(
  lastTapAtMs: number | null,
  nowMs: number,
  windowMs: number = DOUBLE_TAP_LIKE_WINDOW_MS,
): boolean {
  return lastTapAtMs != null && nowMs - lastTapAtMs < windowMs;
}

/**
 * PURE: whether the current playback mode uses the double-tap-to-like gesture at all
 * (rb-rn-live-double-tap-like-replay-extend). `true` for a stream actively live (`isLive`) OR a
 * finished-live replay (`isFinishedLiveReplay`) — the two are mutually exclusive, so this reduces
 * to a plain OR. `false` for pure VOD (`isLive === false && isFinishedLiveReplay === false`) —
 * double-tap there stays a no-op (unchanged from `rb-rn-live-double-tap-like`'s original,
 * LIVE-only scope); this Requirement deliberately does NOT reference — and is not conditioned on —
 * `openspec/specs/sdk/player.md`'s (separately owned) "快退 / 快進 10 秒" Requirement.
 *
 * Deliberately a SEPARATE, orthogonal decision from {@link allowsTapToggleMute} (which decides
 * what a SINGLE tap does — mute-toggle vs. play/pause — and is UNCHANGED by this function's
 * introduction): a finished-live replay's single tap keeps calling `model.togglePlayPause()`
 * (never `onToggleMute`) while ALSO now qualifying for the double-tap-to-like check via this
 * function. See design.md Decision 2 for the full rationale (parity concept to iOS's existing
 * `usesLiveChrome = isLive || isFinishedLiveReplay`, though RN has no pre-existing chrome-visibility
 * flag of that shape to reuse, hence the dedicated name here).
 */
export function usesLiveHeartGesture(isLive: boolean, isFinishedLiveReplay: boolean): boolean {
  return isLive || isFinishedLiveReplay;
}

/**
 * Run a vertical-swipe in-place NAVIGATE then report the switched video id (swipe-video-switched-
 * notify, parity iOS / Android). Forwards `navigate` (→ template → core `load`) FIRST, then — when
 * the resolved `adjacentId` is non-null — reports it via `onDidSwitchVideo` so the container can
 * record the shown id + raise `config.onVideoSwitched(id)` (parity with the watch-next / hot-pick
 * paths). The NAVIGATE branch only runs when `hasNextVideo` / `hasPrevVideo` is true, so
 * `adjacentId` is non-null there; the null-guard is defensive. PURE (no PanResponder / React) →
 * unit-testable without a gesture, parity iOS `PlayerShellModel.navigateToNext` fire.
 */
export function navigateAndNotifySwitch(
  adjacentId: string | null,
  navigate: () => void,
  onDidSwitchVideo?: (videoId: string) => void,
): void {
  navigate();
  if (adjacentId != null) onDidSwitchVideo?.(adjacentId);
}

/**
 * The post-release hold window (rb-rn-vod-playback-progress-bar): once the finger lifts,
 * `PaybackProgressBarView` stays in its expanded transport-bar visual for this long before
 * collapsing back to the thin idle line. Design: 2.8s. Parity iOS `PlayerShellView
 * .scrubHoldDuration`.
 */
const SCRUB_HOLD_DURATION_MS = 2800;

/**
 * The bottom lift (px) applied to VOD/LIVE chrome that has reappeared during the post-release
 * hold window (`scrubBarExpanded && !isScrubbing`) so it clears the still-expanded transport
 * bar. Design: ~36pt. Parity iOS `PlayerShellView.scrubChromeLift`.
 */
const SCRUB_CHROME_LIFT = 36;

/**
 * PURE: whether {@link PlaybackProgressBarView} should be composed (design `screens.jsx`
 * `LBPPlayerScreen` "Playback progress bar — VOD and replay only":
 * `isMain && !isUpcoming && (!isLive || isReplay)`). The `isReplay` disjunct MUST be fed
 * `model.isFinishedLiveReplay` (已結束直播回放，`type == 3 || (type == 2 && liveStatus == 3)`) —
 * NOT `model.isReplay` (core's narrower DVR concept: a stream still actively live,
 * `liveStatus == 1`, scrubbed behind the shared live edge; `vodScrubAllowed` rejects any seek
 * while `liveStatus == 1` regardless, so a bar shown for that flag could visually drag but every
 * seek would silently no-op — iOS `rb-ios-restore-vod-playback-progress-bar` shipped exactly
 * this bug in an early draft and corrected it in review; see that change's design.md). Since
 * `isFinishedLiveReplay` is mutually exclusive with `isLive`, this reduces in practice to
 * `isMain && !isUpcoming && !isLive` — the bar shows for pure VOD and a finished-live replay,
 * never while genuinely live (regardless of whether it has been scrubbed behind the live edge).
 * Kept as a literal `isReplay` PARAMETER (not simplified to a 3-arg function) for 1:1 fidelity
 * with the documented design formula — it is the CALL SITE's job to pick the right flag. Pure,
 * unit-testable without rendering (docs/unit-test-discipline.md). Parity iOS
 * `PlayerShellView.showsPlaybackProgressBar(isMain:isUpcoming:isLive:isReplay:)`.
 */
export function showsPlaybackProgressBar(
  isMain: boolean,
  isUpcoming: boolean,
  isLive: boolean,
  isReplay: boolean,
): boolean {
  return isMain && !isUpcoming && (!isLive || isReplay);
}

/**
 * PURE: whether {@link CaptionOverlayView} should be composed (rb-react-native-subtitle-vtt-
 * caption-display). Five conditions, ALL must hold: `!cleanMode` (乾淨模式 hides it, same as the
 * other floating VOD chrome — design R23), `!usesLiveChrome` (LIVE or a finished-live replay never
 * shows the VOD caption — `usesLiveChrome` is the caller-computed `model.isLive ||
 * model.isFinishedLiveReplay`, parity iOS/Android's identically-named "purely VOD" gate),
 * `!introPlaying` (直播預告開場片頭 is not yet the main VOD playback phase), `!isScrubbing`
 * (dragging the playback-progress bar hides it, matching the sibling `NowIntroducingCarousel`'s
 * own `!isScrubbing` gate in this same VOD branch), `subtitleEnabled` (CC is on) AND `captionText`
 * is non-empty (nothing to show). Parity Android `shouldShowCaptionOverlay` (same 5-condition AND,
 * mirrored parameter order) / iOS's inline VOD-branch check. Pure, unit-testable without
 * rendering, per unit-test discipline.
 */
export function shouldShowCaptionOverlay(
  usesLiveChrome: boolean,
  introPlaying: boolean,
  isScrubbing: boolean,
  cleanMode: boolean,
  subtitleEnabled: boolean,
  captionText: string,
): boolean {
  return (
    !cleanMode &&
    !usesLiveChrome &&
    !introPlaying &&
    !isScrubbing &&
    subtitleEnabled &&
    captionText.length > 0
  );
}

/**
 * The family-1 player-shell container. Subscribes to the bound template's
 * coalesced `subscribe()` notification, re-reads the read-only
 * {@link PlayerShellModel} on each notify (via a `useState` tick), and passes
 * snapshot values BY VALUE to the four surface components. Paints with the
 * resolved {@link ReferenceUITheme}.
 *
 * `template == null` → the container reads the deterministic demo seeds (nothing
 * to subscribe to); the host normally supplies a live {@link DefaultPlayerTemplate}.
 */
export function PlayerShellView(props: PlayerShellViewProps): ReactElement {
  const {
    template = null,
    theme,
    onMinimize,
    onToggleMute,
    onToggleSubscribe,
    showSubscribe,
    titleScroll,
    onTapRailItem,
    onShare,
    onServiceLink,
    onOpenProduct,
    onComment,
    onNickname,
    onTapNowIntroducingProduct,
    live = false,
    onInfoPanelOpenChange,
    showGestureHints = false,
    composerPresented = false,
    onCloseRequest,
    onDidSwitchVideo,
    onCleanModeChange,
    subtitleCues = [],
  } = props;

  // Coalesced re-read tick. The template's `subscribe()` carries NO diff — on
  // each notify we bump the tick so React re-renders and we re-read every getter
  // off a freshly-constructed read-only model (the model holds no state of its
  // own; parity with the Flutter ListenableBuilder re-read). The demo path
  // (template == null) has nothing to subscribe to and renders the seeds.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (template == null) return;
    const unsubscribe = template.subscribe(() => setTick((t) => t + 1));
    return unsubscribe;
  }, [template]);

  // Local presentation-only state for the bottom info panel (open/closed). The
  // panel CONTENT (tabs / fields / notices) is driven by the model; this only
  // governs the sheet affordance. Default CLOSED (parity iOS/Android — the panel
  // opens only on a host-badge / `more` rail tap; the VideoInfoPanel surface
  // snapshot renders the panel directly, not via this default).
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  // rb-rn-sheetkit-resize-dismiss-unify — the shared `BottomSheetPresenter`'s LIVE
  // drag-resize/dismiss height fraction for the info panel, threaded down to
  // `VideoInfoPanel`'s own `SheetScaffold` `capPct`. `undefined` until the user actually
  // drags the handle (the presenter's own floor measurement never reports on its own —
  // falls back to `VideoInfoPanel`'s own content-sized default, which keeps tracking real
  // content changes like tab switches until a drag happens).
  const [infoPanelHeightPct, setInfoPanelHeightPct] = useState<number | undefined>(undefined);

  // Report info-panel open/closed (initial + every change) so the container can hide the
  // higher-layer chat feed while the panel is up (parity iOS rb-ios-info-panel-not-covered-
  // by-chat). The panel's own state / dismiss paths are unchanged.
  useEffect(() => {
    onInfoPanelOpenChange?.(infoPanelOpen);
  }, [infoPanelOpen, onInfoPanelOpenChange]);

  // 乾淨模式（cleanMode，rb-rn-gesture-clean-mode-rewrite，design R23）: toggled by a long-press
  // (>450ms) on the video-area Pressable, regardless of LIVE/VOD. `true` hides most floating
  // chrome (see the render-site wiring below) while keeping the minimize button + (LIVE-only) the
  // narrating pinned-product card. Default CLOSED — existing snapshots byte-identical.
  const [cleanMode, setCleanMode] = useState(false);

  // Report cleanMode open/closed (initial + every change) so a family living OUTSIDE this
  // component's render tree (e.g. `feedwin`'s ChatFeedView) can also hide itself — mirrors
  // `onInfoPanelOpenChange` above. `PlayerShellView` itself never reaches out to control such a
  // sibling family directly.
  useEffect(() => {
    onCleanModeChange?.(cleanMode);
  }, [cleanMode, onCleanModeChange]);

  // LIVE 底部 bar 愛心 burst tick（rb-rn-live-bottom-heart-burst，問題 5）：愛心點擊遞增 → 即時飄心。
  // 靜止態（tick 不變）→ HeartBurst render null → snapshot 中立。
  const [liveHeartTick, setLiveHeartTick] = useState(0);

  // 影片區雙擊送愛心時間窗狀態（rb-rn-live-double-tap-like）：記錄「上一次可能觸發送愛心的 tap 時間戳記」，
  // 供 `isLiveDoubleTap` 純函式比對。`useRef`（非 `useState`）——這個值只在 `onPress` 內被讀寫，從不影響任何
  // 渲染輸出，且同一個元件實例的多次事件回呼之間共享同一個底層物件，讀寫可靠（design.md Decision 2）。
  // 不掛任何影片切換時的 reset hook，比照既有 `cleanMode` / `dismissedVodIds` 等 local 呈現層狀態的先例
  // （design.md Decision 4）。
  // HISTORICAL NAME（rb-rn-live-double-tap-like-replay-extend）：名稱仍帶「Live」字樣，但現在同一個 ref
  // 同時被 LIVE 分支與已結束直播回放分支共用（見 `usesLiveHeartGesture`）——維持原名不改動，理由同
  // `isLiveDoubleTap` / `DOUBLE_TAP_LIKE_WINDOW_MS`（design.md Decision 3，跨平台字串對照）。
  const lastLiveTapAtRef = useRef<number | null>(null);

  // Whether the「聯絡商家」confirm modal is presented (parity rb-*-contact-merchant-modal).
  // The rail serviceLink tap and the info-panel「與商家一對一對話」(both funnel through
  // handleRailTap(serviceLink)) now present this confirm FIRST; only its「確定」proceeds to the
  // existing serviceLink host exit. Default false → modal not drawn → existing snapshots unchanged.
  const [contactMerchantPresented, setContactMerchantPresented] = useState(false);

  // Locally-dismissed VOD now-introducing productIds (rb-rn-now-introducing-real-image-
  // carousel，問題 9/10): a card's ✕ removes it from the carousel until the playhead moves
  // on (the template owns no per-card dismissal — this is presentation-only). Default empty
  // → existing structure unchanged.
  const [dismissedVodIds, setDismissedVodIds] = useState<readonly string[]>([]);

  // Locally-dismissed LIVE pinned productIds (rb-rn-live-pinned-card-dismiss): a pinned card's
  // ✕ hides it until a DIFFERENT narrating product (new id) enters the source list. Mirrors the
  // VOD `dismissedVodIds` above (presentation-only — the template owns no per-card dismissal).
  // Default empty → `visiblePinnedProducts` returns the list as-is (existing structure unchanged).
  const [dismissedLivePinnedIds, setDismissedLivePinnedIds] = useState<readonly string[]>([]);

  // Playback-progress scrub state (rb-rn-vod-playback-progress-bar). `isScrubbing` — the finger
  // is actually down on `PlaybackProgressBarView` (touch-down…touch-up): drives hiding the
  // VOD/LIVE chrome that would otherwise sit under the expanded transport bar, and (inside the
  // bar itself) the drag-time timestamp readout. `scrubBarExpanded` — touch-down through
  // `SCRUB_HOLD_DURATION_MS` after touch-up: drives the transport-bar-vs-thin-line visual AND the
  // chrome-lift padding. MUST be a SEPARATE state from `isScrubbing` — the transport bar (and the
  // lifted chrome) keep showing after release while the drag-time readout disappears immediately.
  // Parity iOS `PlayerShellView`'s `isScrubbing` / `scrubBarExpanded` `@State`.
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubBarExpanded, setScrubBarExpanded] = useState(false);
  // Cancellable timer that collapses `scrubBarExpanded` back to `false` `SCRUB_HOLD_DURATION_MS`
  // after the finger lifts. Re-scheduled (cancelling any pending collapse) on every new scrub
  // start, mirroring the established `useRef<ReturnType<typeof setTimeout> | null>` pattern in
  // this package (`ActivityToastView` / `ProductSheetsView`'s cart toast / loading timers).
  const scrubCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Touch-down on the progress bar → begin a scrub: cancel any pending collapse, mark both
  // `isScrubbing` and `scrubBarExpanded` true. Parity iOS `PlayerShellView.handleScrubStarted()`.
  const handleScrubStarted = (): void => {
    if (scrubCollapseTimerRef.current != null) {
      clearTimeout(scrubCollapseTimerRef.current);
      scrubCollapseTimerRef.current = null;
    }
    setIsScrubbing(true);
    setScrubBarExpanded(true);
  };

  // Drag moved → forward the new absolute position to the EXISTING `model.seek()` forwarder (no
  // new core / view-model API; no debounce, per design). Parity iOS
  // `PlayerShellView.handleScrub(_:)`.
  const handleScrub = (ratio: number): void => {
    model.seek(ratio * model.duration);
  };

  // Finger lifted → `isScrubbing` ends immediately (the readout disappears); schedule the
  // transport bar's collapse back to the thin line after `SCRUB_HOLD_DURATION_MS`. Parity iOS
  // `PlayerShellView.handleScrubEnded()`.
  const handleScrubEnded = (): void => {
    setIsScrubbing(false);
    scrubCollapseTimerRef.current = setTimeout(() => {
      setScrubBarExpanded(false);
      scrubCollapseTimerRef.current = null;
    }, SCRUB_HOLD_DURATION_MS);
  };

  // Cleanup the pending collapse timer on unmount so it never fires a `setState` after unmount.
  useEffect(() => {
    return () => {
      if (scrubCollapseTimerRef.current != null) clearTimeout(scrubCollapseTimerRef.current);
    };
  }, []);

  const model = new PlayerShellModel(template);

  // Vertical-swipe → adjacent-video navigation (rb-player-shell-swipe) + close-on-empty
  // (swipe-nav-close-on-empty). A PanResponder on the full-bleed tap-to-mute layer: it only
  // CLAIMS the gesture when |dy| crosses the threshold (so a tap stays with the Pressable
  // below — RN analogue of iOS .simultaneousGesture). On release, the template-nav fallback
  // navigates when the swiped direction has an adjacent video, else raises `onCloseRequest`
  // (closes the player — the list is at its head / tail) instead of the prior silent no-op.
  // The navigate-vs-close decision is the pure [resolveSwipeNavFallback]. Rebuilt only when
  // the template identity / onCloseRequest changes; the model is a stateless reader so the
  // captured instance always reflects the live template. Parity iOS / Android `resolveSwipeNav`.
  // Live in progress (rb-rn-live-swipe-gesture-gating): the gesture is still CLAIMED by the
  // threshold check below (so it never falls through to tap-to-mute), but the release does NOT
  // navigate / close-on-empty while `model.isLive` — gated by the pure [allowsSwipeNav]. Upcoming
  // / finished-live replay / VOD are unaffected (unchanged existing behaviour).
  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dy) >= SWIPE_THRESHOLD,
        onPanResponderRelease: (_evt, gesture) => {
          const nav = new PlayerShellModel(template);
          // Live in progress (rb-rn-live-swipe-gesture-gating): the drag is already CLAIMED by
          // onMoveShouldSetPanResponder's threshold check (so it never falls through to
          // tap-to-mute), but the release MUST NOT navigate / close-on-empty. Upcoming / finished-
          // live replay / VOD (nav.isLive === false) fall through to the existing behaviour below.
          if (!allowsSwipeNav(nav.isLive)) return;
          if (gesture.dy <= -SWIPE_THRESHOLD) {
            // swipe-UP → next (or close at the tail). On navigate, report the new id (swipe-video-
            // switched-notify) so the host's video mirror (minimized floating preview) follows.
            if (resolveSwipeNavFallback(nav.hasNextVideo) === 'navigate')
              navigateAndNotifySwitch(nav.nextVideoId, () => nav.navigateToNext(), onDidSwitchVideo);
            else onCloseRequest?.();
          } else if (gesture.dy >= SWIPE_THRESHOLD) {
            // swipe-DOWN → prev (or close at the head).
            if (resolveSwipeNavFallback(nav.hasPrevVideo) === 'navigate')
              navigateAndNotifySwitch(nav.prevVideoId, () => nav.navigateToPrev(), onDidSwitchVideo);
            else onCloseRequest?.();
          }
        },
      }),
    [template, onCloseRequest, onDidSwitchVideo],
  );

  // Forward a side-rail tap. The shell owns NO core action — it never calls a `simulate*` itself;
  // every kind it does not branch on below is surfaced as an `onTapRailItem` intent, and WHERE that
  // intent lands is the consumer's business (turnkey container seam → core `simulateLikeTap` for
  // `Like`, rb-rn-like-tap-wire; `undefined` in the standalone / snapshot paths → dropped).
  // The function has exactly THREE local branches before that fall-through: `more` → toggle the
  // info panel (then still fall through as an observation hook), `share` when the container
  // injected `onShare` → that seam, and `serviceLink` → 聯絡商家 confirm modal
  // (parity with iOS/Flutter's `handleRailTap`).
  const handleRailTap = (kind: LBSideRailKind): void => {
    if (kind === ('more' as LBSideRailKind)) {
      setInfoPanelOpen((open) => !open);
      onTapRailItem?.(kind);
      return;
    }
    // 頻道分享（rb-rn-player-share-default-sheet，parity iOS `handleRailTap(.share)`）：直播/回放底部 bar
    // 分享鈕 + 純 VOD 側欄 rail 分享鈕都 funnel 進此處。容器注入 onShare（= config.onShare ?? shareSystem
    // (shareUrl)）→ 走它（未攔截 host 得系統分享）；onShare == undefined（非容器 / snapshot）→ 略過此分支、
    // fall-through 到既有 onTapRailItem?.(Share)（僅派 rail 意圖、不開系統分享）。
    if (kind === LBSideRailKind.Share && onShare != null) {
      onShare();
      return;
    }
    // serviceLink (rail tap OR info-panel「與商家一對一對話」, both funnel here) → present the
    // 「聯絡商家」confirm modal FIRST (parity rb-*-contact-merchant-modal); only its「確定」
    // proceeds to the host exit (see confirmContactMerchant). Do NOT open the link directly.
    if (kind === LBSideRailKind.ServiceLink) {
      setContactMerchantPresented(true);
      return;
    }
    onTapRailItem?.(kind);
  };

  // The shared double-tap-to-like time-window check (rb-rn-live-double-tap-like, widened by
  // rb-rn-live-double-tap-like-replay-extend). NOT exported — it is pure call-site plumbing (read
  // the clock, compare against the last qualifying tap, fire the existing like route + heart-burst
  // tick on a hit, then record `now`), not an independent decision point in its own right; the two
  // decision points that ARE independently unit-tested are the exported {@link isLiveDoubleTap}
  // (the time-window comparison) and {@link usesLiveHeartGesture} (which modes this applies to at
  // all). Called from the video-area `Pressable`'s `onPress` from BOTH the LIVE branch and the
  // finished-live-replay branch — identical body either way, so this exists to avoid duplicating it.
  const runLikeGestureCheck = (): void => {
    const now = Date.now();
    if (isLiveDoubleTap(lastLiveTapAtRef.current, now)) {
      handleRailTap(LBSideRailKind.Like);
      setLiveHeartTick((t) => t + 1);
    }
    lastLiveTapAtRef.current = now;
  };

  // 「確定」on the confirm modal → close it + proceed to the service-link exit. Container
  // injects `onServiceLink` (= `config.onServiceLink ?? (開站內瀏覽器 default)`,
  // dropin-service-link-default-browser-rn) → walk it; `undefined` (non-container / standalone /
  // snapshot) → fall back to the pre-existing `onTapRailItem(ServiceLink)` route (pixels unchanged).
  const confirmContactMerchant = (): void => {
    setContactMerchantPresented(false);
    if (onServiceLink != null) {
      onServiceLink();
    } else {
      onTapRailItem?.(LBSideRailKind.ServiceLink);
    }
  };

  // Template-owned navigation intent (NOT a core simulate*): only flips
  // presentation state. `notice` is honoured by the template only when
  // `noticeCanOpen`.
  const handleSelectTab = (tab: LBInfoPanelTab): void => {
    model.selectInfoTab(tab);
  };

  // UPCOMING (直播預告 awaitingLive) wears the design's LIVE chrome instead of the
  // LIVE / VOD chrome. Priority upcoming > live > vod — early-return so the live /
  // vod composition below is never reached for upcoming. Background is the
  // UpcomingCountdownView (cover + dark mask + date + big time, promoted from a
  // top-most moment to the shell background); chrome = header (LIVE pill / viewer
  // already hidden since isLive == false) + the SLIM LIVE bottom bar. NO VOD side
  // rail / floating bag / mini-cart / LiveOverlayChrome / info panel. RN parity of
  // iOS PlayerShellView's upcoming branch / Android UpcomingScaffold / Flutter
  // _buildUpcoming.
  if (model.isUpcoming) {
    return (
      <View testID={LBTestIDs.playerShell} style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Background: the upcoming countdown surface (date + big time). `live={false}`
            → solid theme.background (deterministic snapshot, no remote cover load). The
            host supplies the real cover behind this chrome at runtime. */}
        <UpcomingCountdownView
          theme={theme}
          scheduledStartAt={model.upcomingStartAt}
          live={false}
          coverUrl={model.upcomingCover}
        />

        {/* Header pinned top (LIVE pill / viewer count hidden since isLive == false
            for upcoming). The minimize / subscribe handlers forward as usual. */}
        <View style={{ flex: 1 }}>
          <PlayerHeaderBar
            theme={theme}
            title={model.title}
            hostName={model.hostName}
            shopLogo={model.shopLogo}
            viewerCount={model.viewerCount}
            isSubscribed={model.isSubscribed}
            isLive={false}
            isReplay={false}
            live={live}
            onMinimize={onMinimize}
            onToggleSubscribe={onToggleSubscribe}
            showSubscribe={showSubscribe}
            // rb-rn-marquee-title-scroll — the upcoming header draws / measures / scrolls its
            // title exactly like the main branch, so this forward is LOAD-BEARING, not
            // defensive: omitting it would let the header fall back to「may scroll」and ignore
            // the merchant's setting on scheduled-live videos.
            titleScroll={titleScroll}
            // rb-rn-gesture-clean-mode-rewrite — `cleanMode` can only be toggled by the video-area
            // long-press, which this upcoming branch does not mount (no tap-to-mute/play-pause
            // Pressable here), so `cleanMode` is always `false` while upcoming. Forwarded anyway
            // for interface consistency across both `PlayerHeaderBar` call sites.
            hidesHostBadge={cleanMode}
          />
        </View>

        {/* SLIM LIVE bottom bar pinned bottom (bag + spacer + share + like; no 留言 /
            nickname / CC). bag / share / like route through the existing rail wiring by
            kind. NO VOD side rail / floating bag / mini-cart / overlay chrome. */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <LiveBottomBarView
            theme={theme}
            bagCount={model.bagCount}
            isReplay={false}
            isUpcoming
            onBag={() => handleRailTap(LBSideRailKind.Goods)}
            // 頻道分享（rb-rn-player-share-default-sheet）：容器注入 onShare → 走它（系統分享 fallback）；
            // 未注入（非容器 / snapshot）→ 退回既有 handleRailTap(Share) rail 路由。
            onShare={onShare ?? (() => handleRailTap(LBSideRailKind.Share))}
            // 真 like（rail 意圖 → 容器 seam 預設 defaultRailTap → core simulateLikeTap，
            // rb-rn-like-tap-wire）+ 即時飄心 burst（rb-rn-live-bottom-heart-burst）。兩者是**獨立**
            // 的兩條線：burst 由本地 liveHeartTick 驅動，修法前只有它是活的。
            onLike={() => {
              handleRailTap(LBSideRailKind.Like);
              setLiveHeartTick((t) => t + 1);
            }}
          />
        </View>

        {/* 愛心 burst 錨於 slim 底部 bar 愛心上方（靜止態 render null → snapshot 中立）。 */}
        <HeartBurst theme={theme} tick={liveHeartTick} style={{ position: 'absolute', right: 18, bottom: 64 }} />
      </View>
    );
  }

  // The MAIN playback phase feeding `showsPlaybackProgressBar`'s `isMain` — not the intro MP4
  // and out of the cold-start loading/splash sequence (mirrors design `screens.jsx`'s `isMain`,
  // parity iOS `PlayerShellView.isMainPlaybackPhase`).
  const isMainPlaybackPhase =
    !model.introPlaying &&
    model.startPhase !== StartScreenPhase.Loading &&
    model.startPhase !== StartScreenPhase.Splash;

  // Whether `PlaybackProgressBarView` should be composed for the current model snapshot. Feeds
  // `model.isFinishedLiveReplay` (已結束直播回放) as the `isReplay` disjunct — NOT `model.isReplay`
  // (the narrower behind-live-edge-while-still-live DVR concept). See `showsPlaybackProgressBar`'s
  // doc comment. Parity iOS `PlayerShellView.showsPlaybackProgressBar` (computed property).
  const showsProgressBar = showsPlaybackProgressBar(
    isMainPlaybackPhase,
    model.isUpcoming,
    model.isLive,
    model.isFinishedLiveReplay,
  );

  // VOD CC 字幕（rb-react-native-subtitle-vtt-caption-display）：以目前 model.position 現算命中的
  // cue 文字（`subtitleCues` prop 是唯一來源 — RN 沒有 host-override caption-text 入口，design.md
  // Non-Goals）。`usesLiveChromeForCaption` 鏡射 iOS/Android 的「purely VOD」定義（isLive **或**
  // isFinishedLiveReplay 皆不算純 VOD），與這個 shell 既有的 `!model.isLive`-only chrome 分流變數
  // 刻意不同——後者是既有、獨立的四端小分歧（design.md D7），不在本次修正範圍。
  const effectiveCaption = VTTSubtitleParser.activeCue(subtitleCues, model.position)?.text ?? '';
  const usesLiveChromeForCaption = model.isLive || model.isFinishedLiveReplay;
  const showsCaption = shouldShowCaptionOverlay(
    usesLiveChromeForCaption,
    model.introPlaying,
    isScrubbing,
    cleanMode,
    model.subtitleEnabled,
    effectiveCaption,
  );

  // The extra bottom lift applied to VOD chrome that has reappeared during the post-release hold
  // window (`scrubBarExpanded && !isScrubbing`) so it clears the still-expanded transport bar;
  // `0` at every other time. Parity iOS `PlayerShellView.scrubChromeLiftIfExpanded`.
  const scrubChromeLift = scrubBarExpanded && !isScrubbing ? SCRUB_CHROME_LIFT : 0;

  // Surface 4 (VOD branch) — the now-introducing carousel peeks (rb-rn-now-introducing-
  // real-image-carousel，問題 9/10): ALL products whose [beginTime,endTime) window covers the
  // playhead (`model.vodActiveProducts`), minus locally dismissed, mapped to LBMiniCartPeek
  // (pic = photos[0] ?? pic). The trailing inset clears the bottom-anchored side rail when
  // shown (VOD-main, startPhase done): 60 = right 12 + pill 40 + gap 8; the VOD start
  // sequence (no rail) keeps 8 (併入問題 1 避讓浮動側欄).
  const nowIntroducing = model.vodActiveProducts.filter((p) => !dismissedVodIds.includes(p.id));
  const nowIntroducingPeeks: readonly LBMiniCartPeek[] = nowIntroducing.map((p) => ({
    productId: p.id,
    name: p.name,
    priceShow: p.priceShow,
    soldOut: p.soldOut,
    pic: p.photos.length > 0 ? p.photos[0]! : p.pic,
  }));
  // Trailing clearance follows the side rail's visibility (shown from Buffering
  // onward, suppressed only in Loading/Splash) — rb-rn-vod-rail-show-on-buffering.
  const railShown =
    model.startPhase !== StartScreenPhase.Loading &&
    model.startPhase !== StartScreenPhase.Splash;

  return (
    // rb-rn-player-shell-live-video-passthrough: the video-area background placeholder
    // is painted ONLY in demo/snapshot (`live === false`). In host runtime (`live === true`)
    // the real `LivebuyPlayerCore` surface sits BEHIND this overlay, so painting an opaque
    // `theme.background` here would cover the playing video — gate it off so the video shows
    // through (parity iOS `paintsBackgroundPlaceholder` / Android `!live`).
    <View testID={LBTestIDs.playerShell} style={{ flex: 1, ...(live ? {} : { backgroundColor: theme.background }) }}>
      {/*
        Themed background placeholder (host supplies the real video surface) so
        structural baselines are deterministic without a live stream. The
        absolute-fill layers stack: video bg → LIVE overlay chrome / VOD now-introducing
        carousel (surface 4) → pinned chrome (surfaces 1/2) → bottom info panel (surface 3).
      */}
      {/* Video-area gesture surface (rb-rn-gesture-clean-mode-rewrite, design R23). A
          transparent, full-bleed tap target placed BELOW the chrome so header /
          rail / info-panel / pinned-card taps win. `onPress` is dispatched by
          {@link allowsTapToggleMute}: while a stream is actively live it stays
          tap-to-mute (design「點擊靜音」/ first-tap-unmutes, host → core simulate*);
          otherwise (VOD / finished-live replay / upcoming's absence of this surface aside) it
          calls the EXISTING view-model forwarder `model.togglePlayPause()` — no new mute /
          play-pause API. `onLongPress` (RN-native, no hand-rolled timer — see design.md
          Decision 1) toggles `cleanMode` unconditionally. No pixels of its own → omitted
          callbacks make it inert; the surface structural baselines are unaffected by the
          Pressable itself (only by `cleanMode`'s downstream chrome wiring below). */}
      {/* The PanResponder wrapper claims only committed vertical drags (|dy| ≥
          threshold) → swipe navigation; the inner Pressable keeps tap-to-mute /
          play-pause / long-press. The two coexist (RN analogue of iOS
          .simultaneousGesture) — a real swipe cancels the Pressable's in-flight
          press (and any pending long-press timer) via RN's responder-termination
          callback, so a genuine swipe never also fires tap or long-press. */}
      <View
        {...swipeResponder.panHandlers}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <Pressable
          testID={LBTestIDs.playerVideoSurface}
          onPress={() => {
            // Single-tap dispatch (allowsTapToggleMute) is COMPLETELY UNCHANGED by
            // rb-rn-live-double-tap-like-replay-extend — LIVE stays tap-to-mute, replay/VOD stay
            // tap-to-play-pause, both synchronous and unconditional on EVERY tap regardless of
            // whether it turns out to be part of a double-tap.
            if (allowsTapToggleMute(model.isLive)) {
              onToggleMute?.();
            } else {
              model.togglePlayPause();
            }
            // Double-tap-to-like detection is an ADDITIONAL, non-blocking check layered on top of
            // the single-tap dispatch above — it neither replaces nor delays it. Its APPLICABILITY
            // (usesLiveHeartGesture) is a SEPARATE, orthogonal decision from allowsTapToggleMute:
            // LIVE (isLive) and a finished-live replay (isFinishedLiveReplay) both qualify
            // (rb-rn-live-double-tap-like-replay-extend widened this from LIVE-only); pure VOD does
            // not (unchanged from rb-rn-live-double-tap-like's original scope).
            if (usesLiveHeartGesture(model.isLive, model.isFinishedLiveReplay)) {
              runLikeGestureCheck();
            }
          }}
          onLongPress={() => setCleanMode((c) => !c)}
          delayLongPress={LONG_PRESS_CLEAN_MODE_DELAY_MS}
          style={{ flex: 1 }}
        />
      </View>

      {/* Surface 4 — now-introducing surface. LIVE → the full-bleed LiveOverlayChrome
          (announce marquee / pinned card / host caption / gesture hints). VOD → the
          now-introducing CAROUSEL (real image + full width + page dots over ALL products
          whose [beginTime,endTime) covers the playhead, minus dismissed) anchored
          bottom-leading. intro 片頭 (introPlaying) → NEITHER (the opening MP4 is not yet
          live). Parity iOS/Android/Flutter: LIVE → LiveOverlayChrome, VOD →
          NowIntroducingCarousel (mutually exclusive branches). */}
      {model.isLive ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <LiveOverlayChrome
            theme={theme}
            // 乾淨模式（cleanMode）時公告 banner 不顯示——LiveOverlayChromeView 既有的
            // `announceText.length > 0` 判斷本已把空字串視為「不畫」，故傳空字串即可，元件內部零
            // 改動（rb-rn-gesture-clean-mode-rewrite，design R23）。
            announceText={cleanMode ? '' : model.announceText}
            // LIVE 全部介紹中商品（多件 narrate_status==2）→ 釘選卡多商品輪播 + 分頁點；空時 fallback
            // 單一 pinnedProduct（activeProduct ?? first isHot）一元陣列（問題 7, rb-rn-live-now-
            // introducing-carousel）。再依本地 dismissedLivePinnedIds 過濾（釘選卡 close 逐商品本地
            // 隱藏，rb-rn-live-pinned-card-dismiss；換不同 narrate 商品帶入新 id 時自動重新顯示）。
            // 唯一在乾淨模式下仍保留的 LIVE chrome（design R23）——`cleanMode` 不影響此 prop。
            pinnedProducts={visiblePinnedProducts(model.livePinnedProducts, dismissedLivePinnedIds)}
            showGestureHints={showGestureHints && !cleanMode}
            // live-pinned-card-image-radius: load the real product photo only over a live
            // video surface (false / demo → placeholder, snapshot byte-stable).
            live={live}
            onTapPinnedProduct={onOpenProduct}
            // 釘選卡右上角 X → 逐商品本地隱藏（鏡像 VOD 的 onDismiss/dismissedVodIds；
            // 內層 Pressable 攔截點擊、不冒泡開明細）。rb-rn-live-pinned-card-dismiss。
            onDismissPinnedProduct={(id) =>
              setDismissedLivePinnedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
            }
            // 公告橫幅 tap → 切到 VideoInfoPanel 公告分頁並開啟資訊面板（重用 host pill tap 的同一
            // infoPanelOpen 狀態）。公告顯示中 ⇒ noticeCanOpen ⇒ selectInfoTab(Notice) 生效
            // (live-announce-tap-open-info-panel，parity iOS)。
            onTapAnnounce={() => {
              handleSelectTab(LBInfoPanelTab.Notice);
              setInfoPanelOpen(true);
            }}
          />
        </View>
      ) : !model.introPlaying && !isScrubbing && nowIntroducingPeeks.length > 0 ? (
        // Hidden while actively dragging the playback-progress bar (rb-rn-vod-playback-progress-
        // bar) — reappears (lifted `scrubChromeLift`, see padding below) once the finger lifts,
        // for the remainder of the post-release hold window.
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingLeft: 8,
            paddingRight: railShown ? 60 : 8,
            paddingBottom: 12 + scrubChromeLift,
          }}
        >
          <NowIntroducingCarousel
            theme={theme}
            peeks={nowIntroducingPeeks}
            live={live}
            onDismiss={(id) => setDismissedVodIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
            onOpenDetail={(id) => {
              const p = nowIntroducing.find((q) => q.id === id);
              if (p != null) onTapNowIntroducingProduct?.(p);
            }}
          />
        </View>
      ) : null}

      {/* Surfaces 1 + 2 — top bar pinned top, side rail pinned trailing. */}
      <View style={{ flex: 1 }}>
        <PlayerHeaderBar
          theme={theme}
          title={model.title}
          hostName={model.hostName}
          shopLogo={model.shopLogo}
          viewerCount={model.viewerCount}
          isSubscribed={model.isSubscribed}
          // LIVE pill ⟺ isLive && !isReplay; viewer count ⟺ isLive. Replay (scrubbed
          // behind live edge) keeps the count but drops the pill (design
          // `hideLivePill = isReplay`). Both flags already on the model.
          isLive={model.isLive}
          isReplay={model.isReplay}
          live={live}
          onMinimize={onMinimize}
          onToggleSubscribe={onToggleSubscribe}
          showSubscribe={showSubscribe}
          // rb-rn-marquee-title-scroll — raw merchant gate for the title marquee (the leaf
          // slot owns the fallback). The sibling `isUpcoming` branch above forwards the same
          // value; both call sites must stay wired.
          titleScroll={titleScroll}
          // host pill tap → toggle the info panel (parity iOS onTapHostBadge — the only opener
          // now that the rail no longer carries a `more` pill).
          onTapHostBadge={() => setInfoPanelOpen((o) => !o)}
          // 乾淨模式（cleanMode）時隱藏 host pill（標題／主持人／訂閱／觀看數），保留最小化鈕
          // （rb-rn-gesture-clean-mode-rewrite，design R23）。
          hidesHostBadge={cleanMode}
        />
        {/* Spacer pushes the side rail to the bottom-trailing corner. Side rail is
            VOD-ONLY chrome (design screens.jsx gates `LBPSideRail` on `!isLive`); in
            LIVE the bottom bar (below) replaces it — mutually exclusive by mode. Suppressed
            only during the intro 片頭 (introPlaying) and the VOD OPENING sequence
            (`startPhase` Loading/Splash) — design `showMainChrome` hides VOD chrome there;
            from Buffering onward the rail shows (no-intro VOD: channel loaded, rail
            enablement set, header filled), so it appears alongside the header instead of
            waiting for the first frame (Done). Header is kept throughout
            (rb-rn-vod-rail-show-on-buffering, parity to iOS rb-ios-vod-rail-show-on-buffering). */}
        {!model.isLive &&
        !model.introPlaying &&
        !isScrubbing &&
        !cleanMode &&
        model.startPhase !== StartScreenPhase.Loading &&
        model.startPhase !== StartScreenPhase.Splash ? (
          // Additionally hidden while actively dragging the playback-progress bar
          // (rb-rn-vod-playback-progress-bar) or in clean mode (rb-rn-gesture-clean-mode-rewrite,
          // design R23) — reappears (lifted, see marginBottom below) once the finger lifts /
          // clean mode toggles off.
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
            {/* Rail anchored bottom 80 (design LBPSideRail) so the SEPARATE floating bag (bottom
                16) sits below it next to the mini-cart strip. */}
            <View style={{ alignSelf: 'flex-end', marginRight: 12, marginBottom: 80 + scrubChromeLift }}>
              <OperationRail
                theme={theme}
                items={model.railItems}
                bagCount={model.bagCount}
                heartBurstTick={model.heartBurstTick}
                muted={model.muted}
                onTapItem={handleRailTap}
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* Floating shopping bag (design LBPBagButton, iOS FloatingBagButtonView): a SEPARATE
          affordance from the side rail, anchored low (bottom 16) — distinct from the rail (bottom
          80). VOD-main chrome only. Tap → open the product list (handleRailTap(Goods)). */}
      {!model.isLive && !model.introPlaying && !isScrubbing && !cleanMode && railShown ? (
        // Additionally hidden while actively dragging the playback-progress bar
        // (rb-rn-vod-playback-progress-bar) or in clean mode (rb-rn-gesture-clean-mode-rewrite,
        // design R23).
        <View style={{ position: 'absolute', right: 12, bottom: 16 + scrubChromeLift }}>
          <FloatingBagButton
            theme={theme}
            bagCount={model.bagCount}
            onTap={() => handleRailTap(LBSideRailKind.Goods)}
          />
        </View>
      ) : null}

      {/* LIVE bottom bar — surfaces the design's `LBLiveBottomBar` at the bottom in
          LIVE mode OR the intro 片頭 (introPlaying) (VOD-main uses the side rail above
          instead). introPlaying → the BAG-ONLY variant (just the bag). bag / like / CC route
          through the existing `onTapRailItem` wiring by kind (the container seam's default sends
          `Like` to core — rb-rn-like-tap-wire — while `Goods` is intercepted upstream and `Subtitle`
          is still un-wired); share / nickname raise their dedicated `onShare` / `onNickname` intents
          when injected, falling back to the rail route otherwise; 留言 raises the dedicated
          `onComment` intent. Below the info-panel
          modal (which renders later in this parent → on top). Hidden while the on-demand composer
          is up (`!composerPresented`) so the opaque composer has no bottom bar peeking behind it
          (parity iOS PlayerShellView composerPresented gate). Also hidden in clean mode
          (rb-rn-gesture-clean-mode-rewrite, design R23). */}
      {(model.isLive || model.introPlaying) && !composerPresented && !cleanMode ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <LiveBottomBarView
            theme={theme}
            bagCount={model.bagCount}
            isReplay={model.isReplay}
            bagOnly={model.introPlaying}
            onBag={() => handleRailTap(LBSideRailKind.Goods)}
            onComment={onComment}
            // 暱稱鈕 → 容器本地呈現 設定暱稱 modal（onNickname；parity iOS / Android）；未接時
            // 退回 rail 路徑（demo / standalone）。
            onNickname={onNickname ?? (() => handleRailTap(LBSideRailKind.GuestNameEdit))}
            // 頻道分享（rb-rn-player-share-default-sheet）：容器注入 onShare → 走它（系統分享 fallback）；
            // 未注入（非容器 / snapshot）→ 退回既有 handleRailTap(Share) rail 路由。
            onShare={onShare ?? (() => handleRailTap(LBSideRailKind.Share))}
            // 真 like（rail 意圖 → 容器 seam 預設 defaultRailTap → core simulateLikeTap，
            // rb-rn-like-tap-wire）+ 即時飄心 burst（rb-rn-live-bottom-heart-burst，問題 5）。兩者是
            // **獨立**的兩條線：burst 由本地 liveHeartTick 驅動，修法前只有它是活的。
            onLike={() => {
              handleRailTap(LBSideRailKind.Like);
              setLiveHeartTick((t) => t + 1);
            }}
            onToggleCC={() => handleRailTap(LBSideRailKind.Subtitle)}
          />
        </View>
      ) : null}

      {/* LIVE 底部 bar 愛心 burst（rb-rn-live-bottom-heart-burst，問題 5）：錨於底部 bar 愛心
          （trailing-most 鈕）上方。introPlaying（bag-only，無愛心）不畫。靜止態 HeartBurst render null
          → snapshot 中立（含定位的 root 只在飄心 in-flight 時出現）。也在乾淨模式下隱藏
          （rb-rn-gesture-clean-mode-rewrite，design R23）。
          擴大於 rb-rn-live-double-tap-like-replay-extend：已結束直播回放（isFinishedLiveReplay）現在
          也用同一個掛載點顯示雙擊送愛心的心動特效（usesLiveHeartGesture）——回放模式沒有 LIVE 底部 bar
          （側欄/浮動購物袋取代），沿用同一個錨點座標是刻意的（與 LIVE 分支共用同一組視覺，design.md）。
          靜止態（tick 未變）在兩種模式下都一樣 render null，不影響既有 snapshot baseline。 */}
      {usesLiveHeartGesture(model.isLive, model.isFinishedLiveReplay) && !cleanMode ? (
        <HeartBurst theme={theme} tick={liveHeartTick} style={{ position: 'absolute', right: 18, bottom: 64 }} />
      ) : null}

      {/* VOD / replay playback-progress transport bar (rb-rn-vod-playback-progress-bar). Composed
          as an independent top-level sibling — NOT nested in either the VOD or LIVE branch above
          — because it must render over BOTH (pure VOD via the VOD branch; a finished-live replay
          via the LIVE branch — see `showsPlaybackProgressBar`'s doc comment for why RN's current
          `model.isLive`-only branching already keeps it mutually exclusive with the LIVE overlay
          chrome). Pinned to the very bottom edge. All interactions forward to
          `PlayerShellModel`'s EXISTING `togglePlayPause()` / `seek()` forwarders — no new core /
          view-model API. */}
      {showsProgressBar ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <PlaybackProgressBarView
            theme={theme}
            position={model.position}
            duration={model.duration}
            isPlaying={model.isPlaying}
            isScrubbing={isScrubbing}
            // 乾淨模式（cleanMode）下強制展開為完整 transport 列，即使使用者未在拖曳
            // （rb-rn-gesture-clean-mode-rewrite，design R23）；元件本身零改動。
            isExpanded={scrubBarExpanded || cleanMode}
            onTogglePlayPause={() => model.togglePlayPause()}
            onScrubStarted={handleScrubStarted}
            onScrub={handleScrub}
            onScrubEnded={handleScrubEnded}
          />
        </View>
      ) : null}

      {/* VOD CC 字幕 overlay（rb-react-native-subtitle-vtt-caption-display）：純 VOD（非 LIVE、非
          已結束直播回放）、非開場片頭、非拖曳進度條中、非乾淨模式,且 CC 已開 + 目前 position 命中
          某筆 cue 時才顯示,gate 見 shouldShowCaptionOverlay。定位比照 iOS/Android 貼底留 8pt 空隙,
          scrubChromeLift 期間同步上移避開展開的 transport bar。pointerEvents="none" 比照設計稿
          LBPCaptionOverlay,字幕不吃掉底下影片區的點擊。 */}
      {showsCaption ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 8 + scrubChromeLift,
            alignItems: 'center',
          }}
        >
          <CaptionOverlayView theme={theme} text={effectiveCaption} />
        </View>
      ) : null}

      {/* 會員等級限定升級遮罩（restriction-mask ②）。`is_restriction` 為**軟性顯示閘門**：
          core 不擋播放（後端仍回完整內容），reference-ui 在播放畫面上疊全幅暗罩 + 升級提示並
          阻擋下層互動。疊在播放 chrome 之上、info panel / 聯絡商家 modal 之下（對齊 iOS：遮罩在
          主 ZStack、sheet/modal present 於其上）。預設隱藏（`model.isRestricted === false`）→
          snapshot baseline byte-identical。最終視覺 / 退出 affordance DECISION-PENDING 待設計稿。 */}
      {model.isRestricted ? <RestrictionMask theme={theme} /> : null}

      {/* Surface 3 — info panel, bottom sheet. Presented through the shared
          BottomSheetPresenter (rb-rn-sheetkit-parity, iOS BottomSheetPresenter): a
          full-bleed dim scrim (tap-to-dismiss + background-interaction block + fade) BELOW a
          translate-only sliding card. Tapping the scrim closes the panel (setInfoPanelOpen
          false); the presenter stays mounted through the dismiss so the slide-down has
          content. The shared drag-resize/dismiss gesture (rb-rn-sheetkit-resize-dismiss-unify)
          is now always on — `onHeightPctChange` threads the live fraction into
          `VideoInfoPanel`'s own `SheetScaffold` `capPct`. */}
      <BottomSheetPresenter
        visible={infoPanelOpen}
        onDismiss={() => setInfoPanelOpen(false)}
        sheetStyle={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        onHeightPctChange={setInfoPanelHeightPct}
      >
        <VideoInfoPanel
          theme={theme}
          fields={model.infoTab}
          isSubscribed={model.isSubscribed}
          activeTab={model.activeTab}
          noticeCanOpen={model.noticeCanOpen}
          systemNotice={model.systemNotice}
          notice={model.notice}
          heightPct={infoPanelHeightPct}
          // Real shop logo over the shop-row monogram chip — the SAME expression the header
          // call site uses above, so both surfaces decide identically for the same logo
          // (rn-videoinfo-shop-logo-real-image-refui; live RUNTIME image gate, not isLive).
          live={live}
          // rb-rn-subscribe-favorite-visibility-toggle — SECOND render point of the subscribe
          // feature (the shop row's subscribe pill; the FIRST is the header badge above, which
          // gets `showSubscribe={showSubscribe}` raw). This is a DELIBERATE `?? false`, NOT a
          // raw passthrough: `VideoInfoPanel`'s OWN leaf default is `true` (protects its
          // pre-existing standalone test suite — see that prop's doc comment), so THIS
          // container call site is the ONE place that resolves the actual production default.
          // Without the `?? false`, an omitted `LivebuyPlayerConfig.showSubscribe` would leave
          // the header badge hidden but the info-panel pill shown — inconsistent with the
          // user's request that the whole subscribe feature defaults to hidden.
          showSubscribe={showSubscribe ?? false}
          onSelectTab={handleSelectTab}
          // 與商家一對一對話 → reuse the existing side-rail serviceLink host exit (RN
          // routes rail taps through onTapRailItem; same destination as the rail tap).
          onContactMerchant={() => handleRailTap(LBSideRailKind.ServiceLink)}
          // header 右上角關閉 icon → 收合 info panel（rb-rn-sheet-header-close-unify）：第四個合法
          // 關閉入口（與 scrim / 下拉 / host-badge re-tap 同路）。
          onClose={() => setInfoPanelOpen(false)}
          // 前往商城首頁 deliberately left unwired: no core storefront open-intent exit
          // yet, so the primary CTA renders for design fidelity but stays inert
          // (cross-layer follow-up, mirrors iOS / Android PlayerShellView).
        />
      </BottomSheetPresenter>

      {/* 「聯絡商家」confirm modal — composed LAST (absolute-fill overlay) so it overlays the
          info-panel + chrome. 「確定」proceeds to the existing serviceLink host exit; 「取消」/
          scrim just closes. */}
      {contactMerchantPresented ? (
        <ContactMerchantModal
          theme={theme}
          onConfirm={confirmContactMerchant}
          onCancel={() => setContactMerchantPresented(false)}
        />
      ) : null}
    </View>
  );
}

// MARK: - Restriction mask (restriction-mask ②)
//
// 會員等級限定升級遮罩：全幅暗罩 + 升級提示。`is_restriction` 為**軟性顯示閘門**（core 不擋播放、
// 後端仍回完整內容），此遮罩疊在播放畫面上擋住受限內容並阻擋下層互動（不設 `pointerEvents="none"`
// → 預設攔截觸控）。只在 `PlayerShellView` 偵測 `model.isRestricted === true` 時建出，故未受限時
// 不出像素（snapshot baseline byte-identical）。鏡像 iOS canonical `RestrictionMaskView` 文案；
// lock glyph / 最終視覺 / 退出 affordance DECISION-PENDING 待設計稿（RN refui de-emoji，純文字呈現）。
const RESTRICTION_TITLE = '此內容限定會員等級觀看';
const RESTRICTION_SUBTITLE = '提升會員等級後即可觀看';

function RestrictionMask(props: { theme: ReferenceUITheme }): ReactElement {
  const { theme } = props;
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.78)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 15 * theme.fontScale,
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {RESTRICTION_TITLE}
      </Text>
      <View style={{ height: 8 }} />
      <Text
        style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: 12 * theme.fontScale,
          textAlign: 'center',
        }}
      >
        {RESTRICTION_SUBTITLE}
      </Text>
    </View>
  );
}
