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
import { View, Pressable, PanResponder, Image } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { PlayerShellModel } from './PlayerShellModel';
import { productImagePrefetchUrls } from './productImagePrefetch';

import { PlayerHeaderBar } from './PlayerHeaderBarView';
import { OperationRail, FloatingBagButton, subtitleAvailableFrom } from './OperationRailView';
import { VideoInfoPanel } from './VideoInfoPanelView';
import { ContactMerchantModal } from './ContactMerchantModalView';
import { BottomSheetPresenter } from '../productsheets/BottomSheetPresenter';
// rb-rn-chat-reveal-sheet-dismiss-timing — reuse SlideUpSheet's existing slide-animation
// duration (not a new magic number) to time the deferred dismiss-bubble below.
import { DURATION as SHEET_DISMISS_BUBBLE_DELAY_MS } from '../SlideUpSheet';
import {
  LiveOverlayChrome,
  visiblePinnedProducts,
  LIVE_BOTTOM_BAR_CLEARANCE_GAP,
} from './LiveOverlayChromeView';
import { NowIntroducingCarousel } from './NowIntroducingCarouselView';
import { HeartBurst } from './HeartBurst';
import {
  likeBurstSpawnDelayMs,
  likedHoldDurationMs,
  resolveLikeBurstCount,
} from './likeBurstAnimation';
import { LiveBottomBarView, LIVE_BOTTOM_BAR_HEIGHT } from './LiveBottomBarView';
import { LiveMoreMenuView } from './LiveMoreMenuView';
import { UpcomingCountdownView } from './UpcomingCountdownView';
import { PlaybackProgressBarView } from './PlaybackProgressBarView';
import { LiveNowPillView } from './LiveNowPillView';
import { CaptionOverlayView } from './CaptionOverlayView';
import { VTTSubtitleParser } from './VTTSubtitleParser';
import type { VTTCue } from './VTTSubtitleParser';
import { DetailGlyph } from './DetailGlyph';
import { GestureSeekToastView } from './GestureSeekToastView';

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
   * Whether the header's viewer-count badge renders at all (rb-rn-viewer-count-visibility-toggle).
   * The container forwards `config.showViewerCount`. Default `true` (leaf `PlayerHeaderBar` owns
   * the fallback) — the OPPOSITE polarity from `showSubscribe` above: this flag lets a host
   * OPT OUT of the existing always-shown-while-live behaviour, not opt in to a hidden-by-default
   * one. Forwarded verbatim (no fallback applied at this layer) to BOTH `<PlayerHeaderBar>` call
   * sites below (the LIVE/VOD main branch and the upcoming-countdown branch), same reasoning as
   * `showSubscribe`. Only gates the viewer-count badge — the LIVE pill (`isLive && !isReplay`) is
   * unaffected. Does NOT touch the underlying `viewerCount` data pipeline (core keeps updating it
   * regardless) — a pure reference-ui presentation flag.
   */
  readonly showViewerCount?: boolean;
  /**
   * Whether the header's trailing top-right button shows a close (✕) icon instead of the minimize
   * (`PipGlyph`) icon (rb-rn-player-direct-close-button). The container (`LivebuyPlayerOverlays`) resolves
   * `LivebuyPlayerConfig.enableDirectCloseButton` against the global `LivebuySDK
   * .isDirectCloseButtonEnabled()` preference (via the shared pure function
   * `resolveDirectCloseButtonEnabled`) and forwards the ALREADY-RESOLVED boolean here — this view
   * applies no further fallback of its own (leaf `PlayerHeaderBar` owns the `false` default, same
   * convention as `showSubscribe` above). Forwarded verbatim to BOTH `<PlayerHeaderBar>` call sites
   * below (the LIVE/VOD main branch and the upcoming-countdown branch), same reasoning as
   * `showSubscribe`. Orthogonal to `onMinimize` — this only decides which icon draws; which
   * behaviour `onMinimize` actually performs on tap is decided entirely by the caller
   * (`CollapsibleLivebuyPlayer`), not by this view.
   */
  readonly showCloseIcon?: boolean;
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
   * Whether the container's poll detected「另一場正在進行的直播」(rb-rn-live-now-pill). Drives
   * {@link showsLiveNowPill} together with the model's own snapshot fields — this view NEVER
   * polls itself. Default `false` (demo / standalone / no `config.shopId` wired) → the pill never
   * mounts. Parity iOS `hasLiveNow` init param / Android `hasLiveNow: Boolean = false`.
   */
  readonly hasLiveNow?: boolean;
  /**
   * Tap on the「現正直播」`LiveNowPillView`. NO-ARG — this view does not hold the detected live
   * item; the turnkey container resolves it (parity iOS `onGoLive: (() -> Void)?` / Android
   * `onGoLive: (() -> Unit)? `). `undefined` (demo / standalone) → inert no-op tap.
   */
  readonly onGoLive?: () => void;
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
   * Reports the「更多」(⋯) collapsed menu (`LiveMoreMenuView`, design R32) open/closed state to a
   * container so a family that lives OUTSIDE `PlayerShellView`'s render tree (e.g. the `feedwin`
   * family's `ChatFeedView`) can hide itself while the menu is up (rb-rn-live-more-sheet-above-
   * chat) — mirrors the established {@link onInfoPanelOpenChange} / {@link onCleanModeChange}
   * precedent (same reason: `PlayerShellView` cannot reach outside its own tree to hide a
   * sibling family, only report state for a wrapping container to act on). Fired on every
   * `moreMenuOpen` change, INCLUDING the initial mount (parity `onInfoPanelOpenChange` /
   * `onCleanModeChange`). Default `undefined` (demo / unwired) → inert no-op; the menu's own
   * internal open/close behaviour, `LiveMoreMenuView` content, and its 分享／客服 actions are
   * unaffected either way.
   */
  readonly onMoreMenuOpenChange?: (open: boolean) => void;
  /**
   * Reports the scrub-bar post-release hold window (`isScrubChromeLifted(scrubBarExpanded,
   * isScrubbing)`, i.e. `scrubBarExpanded && !isScrubbing`) to a container so a family living
   * OUTSIDE this component's render tree (`feedwin`'s `FeedWinView`) can mirror the SAME lift
   * over its own chat-feed bottom inset (rb-rn-scrub-expanded-chrome-lift) — mirrors the
   * established {@link onInfoPanelOpenChange} / {@link onCleanModeChange} /
   * {@link onMoreMenuOpenChange} precedent (same reason: `PlayerShellView` cannot reach outside
   * its own tree to lift a sibling family, only report state for a wrapping container to act on).
   * Fired on every `scrubBarExpanded` / `isScrubbing` change, INCLUDING the initial mount (parity
   * `onInfoPanelOpenChange`). **Reports the GATED value, NOT the raw wide `scrubBarExpanded`** —
   * while actively dragging (`isScrubbing === true`) this reports `false`, matching this
   * component's own `scrubChromeLift` (the LIVE-overlay / VOD-chrome lift this same file already
   * applies) so a container never lifts the chat feed during an active drag. Default `undefined`
   * (demo / unwired) → inert no-op; `scrubBarExpanded` / `isScrubbing` / `scrubChromeLift`'s own
   * internal effects are unaffected either way.
   */
  readonly onScrubBarExpandedChange?: (expanded: boolean) => void;
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
 * Stable empty array for the `live === false` (snapshot / demo, DEFAULT) branch of the product-
 * image prefetch effect (rb-rn-product-image-loading-polish) — a single shared reference rather
 * than a fresh `[]` literal every render (harmless either way for correctness, since the
 * dependent `prefetchKey` is always `''`, but avoids an unnecessary allocation on the hot path).
 */
const EMPTY_PREFETCH_URLS: readonly string[] = [];

/**
 * Long-press hold duration (ms) that starts the 2x-speed-approximation seek tick, ONLY while
 * `isSeekable` (rb-rn-gesture-clean-mode-v2, design R29) — implemented via RN `Pressable`'s
 * native `onLongPress` + `delayLongPress`, NOT a hand-rolled timer (see this change's design.md
 * Decision 1). Value unchanged from the R23 predecessor (`LONG_PRESS_CLEAN_MODE_DELAY_MS`), only
 * the ACTION it starts has changed (2x-speed seek instead of a `cleanMode` toggle). Non-seekable
 * (live in progress / upcoming) passes `onLongPress={undefined}` at the call site — a
 * STRUCTURAL no-op (RN never schedules an internal long-press timer at all), not a scheduled
 * timer whose handler early-returns.
 */
const HOLD_SPEED_MODE_DELAY_MS = 450;

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
 * The horizontal half of the video area a tap/press landed in (rb-rn-gesture-clean-mode-v2,
 * design R29). `'rewind'` = left half (double-tap seek -10s); `'forward'` = right half
 * (double-tap seek +10s; ALSO the unconditional direction the long-press 2x-speed tick uses,
 * regardless of zone — see {@link HOLD_SPEED_MODE_DELAY_MS}'s doc comment / design.md D4).
 */
export type TapZone = 'rewind' | 'forward';

/**
 * PURE: whether the video-area gesture set (double-tap seek ±10s, long-press 2x-speed) is active
 * for the current playback mode (rb-rn-gesture-clean-mode-v2, design R29's `seekable = isReplay
 * || !isLive`). `isFinishedLiveReplay` (已結束直播回放) OR neither `isLive` nor `isUpcoming` (純
 * VOD) → `true`. A stream actively live (`isLive`) OR a live preview countdown (`isUpcoming`) →
 * `false` — those two flags are jointly the "live family" this predicate excludes, mirroring the
 * design's `stateInLiveFamily` union. `isUpcoming` MUST be threaded through explicitly (not
 * inferred from `!isLive`): `model.isLive` is the narrower "`liveStatus === 1`" signal, mutually
 * exclusive with `isUpcoming` — using only `!isLive` would wrongly mark an upcoming countdown as
 * seekable. `PlayerShellView`'s render body DOES now reach this predicate while upcoming
 * (rb-rn-clean-mode-upcoming-intro-coverage mounted a video-area `Pressable` in that branch too,
 * calling the SAME `handleVideoTap` — see the `model.isUpcoming` early-return below); this
 * predicate's `isUpcoming` disjunct is exactly what makes that tap toggle `cleanMode`
 * IMMEDIATELY instead of deferring for a double-tap-seek that upcoming can never support. Unit-
 * testable without rendering a gesture (per unit-test discipline). Parity iOS
 * `PlayerShellView.isSeekable(isLive:isUpcoming:isFinishedLiveReplay:)` 1:1.
 */
export function isSeekable(
  isLive: boolean,
  isUpcoming: boolean,
  isFinishedLiveReplay: boolean,
): boolean {
  return isFinishedLiveReplay || !(isLive || isUpcoming);
}

/**
 * PURE: classify a touch's horizontal offset within the video area into a {@link TapZone}
 * (rb-rn-gesture-clean-mode-v2, design R29). `startX < containerWidth / 2` → `'rewind'` (left
 * half), else `'forward'` (right half) — including the `containerWidth <= 0` edge case (before
 * the container's `onLayout` has fired even once), which resolves to `'forward'` for any
 * non-negative `startX` (RN never reports a negative `locationX`). Unit-testable without
 * rendering a gesture (per unit-test discipline). Parity iOS `PlayerShellView.tapZone(startX:
 * containerWidth:)`.
 */
export function tapZone(startX: number, containerWidth: number): TapZone {
  return startX < containerWidth / 2 ? 'rewind' : 'forward';
}

/**
 * The double-tap seek time window (ms, rb-rn-gesture-clean-mode-v2, design R29), aligned with
 * `design/templates/minimal/screens.jsx`'s `sinceLast < 320`. Value carried over unchanged from
 * the retired `DOUBLE_TAP_LIKE_WINDOW_MS` (rb-rn-live-double-tap-like) — same visual timing
 * budget, new purpose (seek instead of like). Parity iOS `doubleTapSeekWindow` (0.32s).
 */
export const DOUBLE_TAP_SEEK_WINDOW_MS = 320;

/**
 * PURE: whether this tap is a double-tap-seek hit — `lastSeekTapAtMs` non-null, `sameZone` true
 * (the CALLER compares the current {@link TapZone} against the previous one — this function does
 * not know about zones itself, keeping it a plain two-timestamp-plus-flag comparison, mirroring
 * the retired `isLiveDoubleTap`'s shape), and `nowMs - lastSeekTapAtMs` strictly less than
 * `windowMs` (a gap of EXACTLY `windowMs` does NOT count). `lastSeekTapAtMs == null` (no prior
 * qualifying tap) → `false` (a lone tap can never be a double-tap). Unit-testable without
 * rendering a gesture (per unit-test discipline). Parity iOS `PlayerShellView.isDoubleTapSeekHit
 * (elapsedSinceLastSeekTap:sameZone:window:)`.
 */
export function isDoubleTapSeekHit(
  lastSeekTapAtMs: number | null,
  nowMs: number,
  sameZone: boolean,
  windowMs: number = DOUBLE_TAP_SEEK_WINDOW_MS,
): boolean {
  return lastSeekTapAtMs != null && sameZone && nowMs - lastSeekTapAtMs < windowMs;
}

/** Seconds a double-tap-seek hit moves the playhead (design R29, `model.seekBy(±10)`). */
export const SEEK_STEP_SECONDS = 10;

/**
 * Display duration (ms) of the double-tap-seek half-screen gesture toast
 * (`GestureSeekToastView`, rb-rn-double-tap-seek-feedback) — matches the ~0.7s convention already
 * documented on the retired `GestureMuteToastView` ("0.7s tap feedback", see that file's header
 * comment). A re-trigger while the toast is still showing cancels and reschedules this duration
 * (see `handleVideoTap`'s `isDoubleTapSeekHit` branch below), so it never stacks or disappears
 * early.
 */
export const GESTURE_SEEK_TOAST_DURATION_MS = 700;

/**
 * Long-press 2x-speed-approximation tick interval (ms, rb-rn-gesture-clean-mode-v2, design R29).
 * Every tick calls `model.seekBy(SPEED_MODE_EXTRA_SEEK_PER_TICK_SECONDS)` ON TOP of the engine's
 * own normal 1x playback — 0.5s of real time thus advances the playhead ~1.0s, approximating 2x.
 * reference-ui has no playback-engine rate API to call instead (see design.md D4). Parity iOS
 * `speedModeTickInterval`.
 */
export const SPEED_MODE_TICK_INTERVAL_MS = 500;

/** Extra seconds seeked forward per {@link SPEED_MODE_TICK_INTERVAL_MS} tick while the long-press
 *  2x-speed gesture is held. Parity iOS `speedModeExtraSeekPerTick`. */
export const SPEED_MODE_EXTRA_SEEK_PER_TICK_SECONDS = 0.5;

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
 * PURE: whether the scrub-bar's post-release hold window is currently active —
 * `scrubBarExpanded` (touch-down through the 2.8s post-release hold) AND NOT actively scrubbing
 * (`!isScrubbing`, during an active drag the transport bar is already expanded via a different
 * path so no extra lift is needed). This is the SAME gate the local `scrubChromeLift` value below
 * uses to decide whether to apply {@link SCRUB_CHROME_LIFT} — it is also what
 * {@link PlayerShellViewProps.onScrubBarExpandedChange} reports to a container
 * (rb-rn-scrub-expanded-chrome-lift) so a sibling family living OUTSIDE this component's render
 * tree (`feedwin`'s `FeedWinView`) can mirror the SAME lift over its own chat-feed bottom inset.
 * Routing both consumers through one function keeps them from ever silently diverging. Parity iOS
 * `PlayerShellView.scrubChromeLiftIfExpanded` / Android `PlayerShellView.scrubChromeLift`'s shared
 * gate expression.
 */
export function isScrubChromeLifted(scrubBarExpanded: boolean, isScrubbing: boolean): boolean {
  return scrubBarExpanded && !isScrubbing;
}

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
 * PURE: whether the interactive intro-progress row should render (Requirement B,
 * rb-rn-intro-progress-bar-interactive — 「開場影片時，乾淨模式也要...顯示展開進度條」，可暫停/
 * 播放、可拖拉 seek，取代 rb-rn-clean-mode-upcoming-intro-coverage 原本的唯讀 3px 細線版本).
 * `introPlaying && cleanMode` — the row appears ONLY once the viewer has explicitly entered clean
 * mode DURING the intro MP4 preroll; `cleanMode === false` (the default) shows nothing extra, so
 * the pre-existing intro chrome (bag-only bottom bar, header) is byte-identical to before this
 * change. Deliberately NOT folded into {@link showsPlaybackProgressBar}'s `isMain` (which
 * explicitly EXCLUDES `introPlaying` — that gate is for the MAIN-playback transport bar) — this
 * is a narrowly-scoped SEPARATE surface for the intro's own playhead. Unit-testable without
 * rendering (per unit-test discipline).
 */
export function showsIntroProgressBar(introPlaying: boolean, cleanMode: boolean): boolean {
  return introPlaying && cleanMode;
}

/**
 * PURE: whether {@link LiveNowPillView} should be composed (design `screens.jsx` `LBPPlayerScreen`
 * mount block, `LBLiveNowPill`; rb-rn-live-now-pill): `hasLiveNow && (isMain ||
 * isFinishedLiveReplay) && !isUpcoming && !cleanMode && !isScrubbing && (!isLive ||
 * isFinishedLiveReplay)`.
 *
 * `hasLiveNow` is the container's poll result (`LivebuyPlayer.tsx`'s file-local
 * `useLiveNowPoll`) — this is the real-data equivalent of the design's `tweaks.showLiveNowPill`
 * canvas demo switch (the canvas has no real data layer); this function MUST NOT accept a
 * SEPARATE static override for that switch.
 *
 * `isFinishedLiveReplay` MUST be fed `model.isFinishedLiveReplay` (已結束直播回放) — NOT
 * `model.isReplay` (core's narrower behind-live-edge-while-still-live DVR concept, where
 * `model.isLive` stays `true`) — same call-site discipline {@link showsPlaybackProgressBar}
 * documents for its own `isReplay` disjunct. Named with the specific field name here (rather
 * than a generic `isReplay` alias) — parity Android's `showsLiveNowPill` Decision 2, matching
 * this file's OWN `shouldShowCaptionOverlay`'s specific-name convention rather than
 * `showsPlaybackProgressBar`'s older generic-alias one.
 *
 * ⚠️ The trailing `(!isLive || isFinishedLiveReplay)` term is NOT decorative, and is NOT optional
 * — it is the exact term whose ABSENCE is a confirmed, shipped defect on BOTH sibling platforms.
 * `isMain` (`isMainPlaybackPhase` at the call site — see the render body below) excludes ONLY the
 * intro-MP4 / cold-start loading / splash sequence; it says NOTHING about whether the stream is
 * genuinely live right now, and a genuinely-live broadcast is neither of those excluded phases —
 * so `isMainPlaybackPhase` is STILL `true` while actively live. A formula built ONLY from
 * `hasLiveNow && (isMain || isFinishedLiveReplay) && !isUpcoming && !cleanMode && !isScrubbing`
 * (i.e. this function WITHOUT the trailing term) would therefore wrongly show the pill ON TOP OF
 * a real live broadcast the instant the poll detects "another" live in progress.
 *
 * **This already happened, independently, on both siblings.** iOS's `rb-ios-live-now-pill`
 * shipped exactly that formula and needed a follow-up fix,
 * `fix-ios-live-now-pill-active-live-leak` — its own regression test only hand-fed
 * `isMain: false` to the PURE function, which proves nothing about what the CALL SITE actually
 * computes for a genuinely-live template (it computes `true`). Android's
 * `rb-android-live-now-pill` shipped the SAME missing-term formula in round 1 and had to correct
 * it in round 2 after an independent verifier visually confirmed the pill rendering on top of a
 * `-live-absent` baseline PNG whose entire point was to show it absent. RN bakes the fix in from
 * this function's FIRST version instead of repeating that two-round history — see
 * `PlayerShellLiveNowPill.test.tsx`'s wiring-level regression test, which renders a REAL
 * `PlayerShellView` against a genuinely-live template (not a hand-fed `isMain: false`) and asserts
 * the pill is absent — the exact class of test neither sibling had until AFTER shipping the bug.
 *
 * Since `isFinishedLiveReplay` is mutually exclusive with `isLive` (a video is never both), the
 * trailing term is a complete no-op on every OTHER branch (VOD / finished-replay / upcoming /
 * cleanMode / scrubbing / no-other-live) and only ever suppresses the "genuinely live" branch —
 * parity iOS (post-fix) `PlayerShellView.showsLiveNowPill(hasLiveNow:isMain:isUpcoming:isReplay:
 * isLive:cleanMode:isScrubbing:)` / Android (post round-2 correction)
 * `showsLiveNowPill(hasLiveNow:isMain:isUpcoming:isLive:isFinishedLiveReplay:cleanMode:
 * isScrubbing:)`.
 */
export function showsLiveNowPill(
  hasLiveNow: boolean,
  isMain: boolean,
  isUpcoming: boolean,
  isLive: boolean,
  isFinishedLiveReplay: boolean,
  cleanMode: boolean,
  isScrubbing: boolean,
): boolean {
  return (
    hasLiveNow &&
    (isMain || isFinishedLiveReplay) &&
    !isUpcoming &&
    !cleanMode &&
    !isScrubbing &&
    (!isLive || isFinishedLiveReplay)
  );
}

/**
 * PURE: whether {@link CaptionOverlayView} should be composed (rb-react-native-subtitle-vtt-
 * caption-display). Five conditions, ALL must hold: `!cleanMode` (乾淨模式 hides it, same as the
 * other floating VOD chrome — design R23), `!isLive` (a genuinely in-progress broadcast never
 * shows the VOD caption; a **finished-live replay does** — `isLive` and `isFinishedLiveReplay` are
 * mutually exclusive, and a replay is functionally VOD (seekable progress bar, no live chat
 * requirement to play), so it belongs on the "shows the caption" side of this gate, not the
 * "never shows it" side), `!introPlaying` (直播預告開場片頭 is not yet the main VOD playback
 * phase), `!isScrubbing` (dragging the playback-progress bar hides it, matching the sibling
 * `NowIntroducingCarousel`'s own `!isScrubbing` gate in this same VOD branch), `subtitleEnabled`
 * (CC is on) AND `captionText` is non-empty (nothing to show). Parity Android
 * `shouldShowCaptionOverlay` (same 5-condition AND, mirrored parameter order) / iOS's inline
 * VOD-branch check. Pure, unit-testable without rendering, per unit-test discipline.
 *
 * `rb-rn-replay-caption-overlay-fix`: this parameter was previously fed the caller's broader
 * `usesLiveChrome = model.isLive || model.isFinishedLiveReplay` (and named the same), which wrongly
 * excluded finished-live replays from the VOD caption too — they'd fall into the LIVE-chrome
 * branch and only ever see `LiveOverlayChromeView`'s unrelated host caption (`LBLiveHostCaption`,
 * a static/host-fed string with no VTT wiring), so toggling CC on a replay flipped the switch with
 * nothing ever appearing. Renamed + narrowed to strict `isLive` to fix this; every OTHER
 * `usesLiveChrome` consumer in this file (Surface 4 routing, side rail, floating bag,
 * `LiveBottomBarView`, `HeartBurst`) is UNCHANGED by this fix — this is the one caption call site.
 */
export function shouldShowCaptionOverlay(
  isLive: boolean,
  introPlaying: boolean,
  isScrubbing: boolean,
  cleanMode: boolean,
  subtitleEnabled: boolean,
  captionText: string,
): boolean {
  return (
    !cleanMode &&
    !isLive &&
    !introPlaying &&
    !isScrubbing &&
    subtitleEnabled &&
    captionText.length > 0
  );
}

/**
 * PURE: the caption overlay's right-edge inset (rb-rn-caption-overlay-align-hide-chat), narrowing
 * the overlay's horizontal centering box away from full-width (`left:0, right:0`) to align with
 * design `LBPCaptionOverlay` (`design/templates/minimal/sdk-components.jsx`) — `left` stays a fixed
 * `8` (the design's own hardcoded value, same in both scenarios). Pure VOD leaves room for the
 * `OperationRailView` VOD side rail (`right: 68`, the design component's own default prop value);
 * an already-finished live replay leaves room for the wider LIVE-chrome bottom bar / pinned-card
 * rail (`right: 120`, design `screens.jsx`'s `isReplay && ccOn` branch's `right={120}`).
 * `isFinishedLiveReplay` is the ONLY input — a genuinely live broadcast never reaches this function
 * (`shouldShowCaptionOverlay`'s `!isLive` excludes it upstream, so only the two mutually exclusive
 * "shows the VOD caption" branches — pure VOD and finished-live-replay — ever call this).
 */
export function captionOverlayRightInset(isFinishedLiveReplay: boolean): number {
  return isFinishedLiveReplay ? 120 : 68;
}

/**
 * PURE: the caption overlay's bottom inset. Originally `rb-rn-caption-overlay-bottom-bar-
 * clearance-fix` (fixing the "dead-reckoned literal, zero-coupled to `LiveBottomBarView`"
 * structural bug already fixed on iOS/Flutter for the already-finished-live-replay branch);
 * `rb-rn-vod-caption-reserve-card-space` MODIFIED the pure-VOD branch's base constant.
 *
 * Pure VOD (`isFinishedLiveReplay === false`) has no `LiveBottomBarView` to avoid, but it DOES
 * share the screen with `NowIntroducingCarousel` (the「介紹中」product card) — a separate,
 * independently-positioned `position: 'absolute'` View that neither knows about the other. The
 * design authority (`design/templates/minimal/screens.jsx:533`, `LBPCaptionOverlay`'s
 * `safeBottom = safeArea.bottom + (scrubVisible ? 36 : 0) + 92`) reserves a fixed `92`
 * unconditionally — regardless of whether the product card (`LBPMiniCart`,
 * `design/templates/minimal/sdk-components.jsx:908`, `bottom: 12 + safeBottom`) is actually
 * rendered at that instant — so the caption never collides with it when it does appear. This
 * function's pure-VOD branch mirrors that: `92 + lift` (was `8 + lift` before this fix, which had
 * zero awareness of the card and could sit directly underneath/behind it).
 *
 * An already-finished live replay DOES render `LiveBottomBarView` (the `usesLiveChrome` branch),
 * so it clears that bar's real height plus an explicit safety gap (`LIVE_BOTTOM_BAR_HEIGHT +
 * LIVE_BOTTOM_BAR_CLEARANCE_GAP`, the SAME single-source-of-truth constants
 * `LiveOverlayChromeView`'s bottom row uses — `= 72`) — unchanged by this fix, out of its scope.
 *
 * `lift` is the caller's existing `scrubChromeLift` value (additive, not recomputed here) — both
 * branches keep adding it unchanged; the pure-VOD branch's `isScrubbing` display gate
 * (`shouldShowCaptionOverlay`) is also unaffected by this fix. This file has no `safeAreaBottom`
 * concept (unlike Flutter's same-named function) — verified there is no safe-area API consumed
 * anywhere in this file, so this signature deliberately omits that parameter rather than carrying
 * a dead one.
 */
export function captionOverlayBottomInset(isFinishedLiveReplay: boolean, lift: number): number {
  return isFinishedLiveReplay ? LIVE_BOTTOM_BAR_HEIGHT + LIVE_BOTTOM_BAR_CLEARANCE_GAP + lift : 92 + lift;
}

/** The effective `showCloseIcon` / `onMinimize` pair {@link resolveEndScreenHeaderOverride}
 *  hands to BOTH `<PlayerHeaderBar>` call sites below. */
export interface EndScreenHeaderOverride {
  readonly showCloseIcon: boolean | undefined;
  readonly onMinimize: (() => void) | undefined;
}

/**
 * rb-rn-endscreen-close-button-blocked — while the family-4 EndScreen moment (倒數變體 or 空狀態)
 * is active, the header's top-right button MUST always show the close (✕) icon and MUST close
 * the whole player directly on tap, REGARDLESS of the resolved `showCloseIcon` /
 * `enableDirectCloseButton` preference the container otherwise passes in — there is no meaningful
 * "collapse to floating" destination once the video has ended. `endScreenActive` mirrors
 * `MomentsView.tsx`'s own `endable` gate (`countdown != null || endScreenVisible`) literally, not
 * its full mutually-exclusive priority chain (error / VOD-no-next-close take priority THERE, but
 * this view has no visibility into those — out of scope for this fix, see design.md Risks).
 *
 * `endScreenActive === false` → passes `showCloseIcon` / `onMinimize` through UNCHANGED (byte-
 * identical to before this override existed). `endScreenActive === true` → forces
 * `showCloseIcon = true` and reroutes `onMinimize` to `onCloseRequest` (the SAME "close the whole
 * player" exit `swipe-nav-close-on-empty` already uses — no new close semantics are introduced).
 * Pure — parity iOS `resolveHeaderCloseOverride` / Flutter `resolveHeaderCloseButton`, and follows
 * this file's own existing pure-helper convention (`resolveSwipeNavFallback` / `allowsSwipeNav` /
 * `isScrubChromeLifted`).
 */
export function resolveEndScreenHeaderOverride(args: {
  endScreenActive: boolean;
  showCloseIcon: boolean | undefined;
  onMinimize: (() => void) | undefined;
  onCloseRequest: (() => void) | undefined;
}): EndScreenHeaderOverride {
  const { endScreenActive, showCloseIcon, onMinimize, onCloseRequest } = args;
  if (!endScreenActive) return { showCloseIcon, onMinimize };
  return { showCloseIcon: true, onMinimize: onCloseRequest };
}

/**
 * rb-rn-chat-reveal-sheet-dismiss-timing — bubble a sheet's `open` boolean up to `onChange`, but
 * DEFER the CLOSE-direction bubble by `delayMs` (the shared `BottomSheetPresenter`/`SlideUpSheet`
 * slide-out duration) so a sibling driven purely by the raw boolean (`FeedWinView`'s
 * `computeChatVisible`, a hard `if` with no transition of its own) does not reappear until the
 * sheet has visually finished sliding away. Shared by both `infoPanelOpen` and `moreMenuOpen`
 * below — same shape, same delay — to avoid duplicating the timer bookkeeping.
 *
 * - OPEN (`open === true`) is always synchronous — no affordance should ever feel unresponsive.
 * - The FIRST call after mount is also synchronous, regardless of `open`'s value — this mirrors
 *   the established RN precedent (`onInfoPanelOpenChange` / `onMoreMenuOpenChange` report on
 *   initial mount too, see the call sites below) and there is no prior sheet content sliding away
 *   to time a mount-time report against.
 * - CLOSE (`open === false`, after the first call) schedules `onChange(false)` via `setTimeout`;
 *   re-opening before it fires cancels the pending stale `false` (cancel-and-reschedule, same
 *   shape as this file's existing `scrubCollapseTimerRef` / `pendingCleanModeToggleTimerRef`).
 * - Unmounting cancels any pending timer so it never fires against an unmounted component.
 */
function useDeferredDismissBubble(
  open: boolean,
  onChange: ((open: boolean) => void) | undefined,
  delayMs: number,
): void {
  const isFirstCallRef = useRef(true);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dismissTimerRef.current != null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (isFirstCallRef.current) {
      isFirstCallRef.current = false;
      onChange?.(open);
      return;
    }
    if (open) {
      onChange?.(true);
      return;
    }
    dismissTimerRef.current = setTimeout(() => {
      dismissTimerRef.current = null;
      onChange?.(false);
    }, delayMs);
  }, [open, onChange, delayMs]);

  useEffect(
    () => () => {
      if (dismissTimerRef.current != null) clearTimeout(dismissTimerRef.current);
    },
    [],
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
    showViewerCount,
    showCloseIcon,
    titleScroll,
    onTapRailItem,
    onShare,
    onServiceLink,
    hasLiveNow = false,
    onGoLive,
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
    onMoreMenuOpenChange,
    onScrubBarExpandedChange,
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
  //
  // rb-rn-chat-reveal-sheet-dismiss-timing: the CLOSE-direction bubble is now deferred by
  // `SHEET_DISMISS_BUBBLE_DELAY_MS` (see `useDeferredDismissBubble` above) so the sibling chat
  // feed's hard `chatVisible` boolean does not reappear until the `BottomSheetPresenter`/
  // `SlideUpSheet` slide-out animation has visually finished — OPEN and the initial-mount report
  // stay synchronous, unchanged.
  useDeferredDismissBubble(infoPanelOpen, onInfoPanelOpenChange, SHEET_DISMISS_BUBBLE_DELAY_MS);

  // 乾淨模式（cleanMode，rb-rn-gesture-clean-mode-v2，design R29）: toggled by a SHORT tap on the
  // video-area Pressable — non-seekable (live in progress / upcoming) toggles immediately;
  // seekable (VOD / finished-live replay) defers by DOUBLE_TAP_SEEK_WINDOW_MS so a following
  // same-zone double-tap can cancel it and seek instead (see `handleVideoTap` below). `true`
  // hides most floating chrome (see the render-site wiring below) while keeping the minimize
  // button + (LIVE-only) the narrating pinned-product card. Default CLOSED — existing snapshots
  // byte-identical.
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
  // 讚鈕 `liked`（亮色）態（design R37，rb-rn-live-like-burst-restyle）：由 `triggerLikeBurst`
  // 立即設 true、依顆數計時後恢復 false，驅動 `LiveBottomBarView` 的 `liked` prop（見下方兩個呼叫點）。
  const [liveLiked, setLiveLiked] = useState(false);
  const likeHeldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeBurstSpawnTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Cleanup the like-burst timers on unmount (mirrors the established `scrubCollapseTimerRef` /
  // `pendingCleanModeToggleTimerRef` pattern elsewhere in this file).
  useEffect(
    () => () => {
      if (likeHeldTimerRef.current != null) clearTimeout(likeHeldTimerRef.current);
      likeBurstSpawnTimersRef.current.forEach((timer) => clearTimeout(timer));
      likeBurstSpawnTimersRef.current.clear();
    },
    [],
  );

  /**
   * LIVE 讚鈕點擊 → 隨機 1–4 顆愛心，間隔 300ms 依序觸發 `liveHeartTick`（design R37
   * `likeAnimation()`，見 `likeBurstAnimation.ts`）；同時立即點亮 `liveLiked`，依顆數計時後恢復。
   * Pure count/delay/duration math lives in `likeBurstAnimation.ts`; this function only owns the
   * side-effecting timer scheduling.
   */
  const triggerLikeBurst = (): void => {
    const count = resolveLikeBurstCount();
    for (let i = 0; i < count; i++) {
      const spawnTimer = setTimeout(() => {
        likeBurstSpawnTimersRef.current.delete(spawnTimer);
        setLiveHeartTick((t) => t + 1);
      }, likeBurstSpawnDelayMs(i));
      likeBurstSpawnTimersRef.current.add(spawnTimer);
    }
    setLiveLiked(true);
    if (likeHeldTimerRef.current != null) clearTimeout(likeHeldTimerRef.current);
    likeHeldTimerRef.current = setTimeout(() => {
      likeHeldTimerRef.current = null;
      setLiveLiked(false);
    }, likedHoldDurationMs(count));
  };

  // 影片區寬度（rb-rn-gesture-clean-mode-v2）：RN 沒有 SwiftUI 同步 GeometryReader，改用既有
  // `onLayout` 慣例（`PlaybackProgressBarView.trackWidth` 已示範同一手法）量測，供 `tapZone` 純函式
  // 判斷觸點落在左右哪一半。`0` 直到第一次 layout（測試環境下 `onLayout` 不會自動觸發，需手動呼叫）。
  const [videoAreaWidth, setVideoAreaWidth] = useState(0);

  // 本次按壓的 TapZone（rb-rn-gesture-clean-mode-v2）：`onPressIn` 讀觸點 `locationX` 寫入，供
  // `onPress`（雙擊 seek 判定）讀取。`useRef`（非 `useState`）——只在事件回呼間傳遞，不影響渲染輸出。
  const pressZoneRef = useRef<TapZone>('forward');

  // 雙擊 seek 時間窗狀態（rb-rn-gesture-clean-mode-v2，取代退役的 `lastLiveTapAtRef`）：記錄「上一次
  // seekable 單擊的時間戳記 + 落點 zone」，供 `isDoubleTapSeekHit` 純函式比對。沿用既有
  // `runLikeGestureCheck` 的「每次都更新，不因命中而重置為 null」語意——連續快速多次點擊，每相鄰一對
  // 都可能各自判定為一次雙擊。不掛任何影片切換時的 reset hook，比照既有 `cleanMode` /
  // `dismissedVodIds` 等 local 呈現層狀態的先例。
  const lastSeekTapAtRef = useRef<number | null>(null);
  const lastSeekTapZoneRef = useRef<TapZone | null>(null);

  // 雙擊 seek 的半螢幕手勢回饋 toast 狀態（rb-rn-double-tap-seek-feedback）：`null` = 不顯示，
  // 非 null = 顯示中且值為觸發方向。純呈現層狀態，不影響雙擊 seek 本身的判定/呼叫（見
  // `handleVideoTap` 的 `isDoubleTapSeekHit` 分支）。`seekToastTimerRef` 是驅動這個 state 自動歸零
  // 的 timer handle，比照同檔案既有 `pendingCleanModeToggleTimerRef` 的
  // `useRef<ReturnType<typeof setTimeout> | null>` pattern；命中一次雙擊 seek 就會取消前一個 pending
  // timer 重新排程（不疊加、不提早消失）。
  const [seekToastZone, setSeekToastZone] = useState<TapZone | null>(null);
  const seekToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 延遲乾淨模式切換的 pending timer（rb-rn-gesture-clean-mode-v2，取代退役的
  // `pendingMuteCommitTimerRef` / `pendingPlayPauseCommitTimerRef`——新模型下單擊只有一種結果（切換
  // cleanMode），不再需要依 LIVE/回放分流成兩個獨立 timer slot）。非 null = 目前有一個尚未到期的
  // pending 切換。比照同檔案既有 `scrubCollapseTimerRef` 的
  // `useRef<ReturnType<typeof setTimeout> | null>` pattern。
  const pendingCleanModeToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 長按 2 倍速快轉狀態（rb-rn-gesture-clean-mode-v2）：`speedModeActiveRef` 是「目前是否按著」的
  // 唯一真相，`speedModeTickTimerRef` 是遞迴排程的下一顆 tick handle。兩者皆 `useRef`——不需要觸發
  // 重新渲染（長按期間 MUST NOT 顯示任何視覺提示）。
  const speedModeActiveRef = useRef(false);
  const speedModeTickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup the two new timers on unmount (mirrors the established `scrubCollapseTimerRef`
  // cleanup precedent below) so neither fires a `setState` after unmount.
  useEffect(() => {
    return () => {
      if (pendingCleanModeToggleTimerRef.current != null) {
        clearTimeout(pendingCleanModeToggleTimerRef.current);
      }
      if (speedModeTickTimerRef.current != null) clearTimeout(speedModeTickTimerRef.current);
      // rb-rn-double-tap-seek-feedback: same unmount-safety rationale as the two timers above.
      if (seekToastTimerRef.current != null) clearTimeout(seekToastTimerRef.current);
    };
  }, []);

  // Whether the「聯絡商家」confirm modal is presented (parity rb-*-contact-merchant-modal).
  // The rail serviceLink tap and the info-panel「與商家一對一對話」(both funnel through
  // handleRailTap(serviceLink)) now present this confirm FIRST; only its「確定」proceeds to the
  // existing serviceLink host exit. Default false → modal not drawn → existing snapshots unchanged.
  const [contactMerchantPresented, setContactMerchantPresented] = useState(false);

  // Whether the「更多」collapsed menu (`LiveMoreMenuView`, design R32) is presented (element
  // itself by rb-rn-live-replay-more-menu-and-video-info-live-copy). rb-rn-replay-live-chrome-
  // parity: the real trigger is now `LiveBottomBarView`'s `onMore` (the `chatClosed` variant's
  // "更多" button, fed `chatClosed={model.isFinishedLiveReplay}` — see that `<LiveBottomBarView>`
  // call site below), which calls `setMoreMenuOpen(true)` DIRECTLY — NOT through
  // `handleRailTap`. The side rail's OWN `LBSideRailKind.More` pill (`OperationRail`'s
  // `isFinishedLiveReplay` prop + `handleRailTap`'s `More` branch below) is the PRIOR trigger
  // path — kept for component-level source compat, but this call site no longer feeds
  // `OperationRail.isFinishedLiveReplay`, so that pill can no longer appear in a real render
  // tree (see the `<OperationRail>` call site's own comment). Default false → sheet not drawn
  // → existing snapshots unchanged.
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Report「更多」menu open/closed (initial + every change) so a family living OUTSIDE this
  // component's render tree (e.g. `feedwin`'s ChatFeedView) can also hide itself while the menu
  // is up — mirrors `onInfoPanelOpenChange` / `onCleanModeChange` above (rb-rn-live-more-sheet-
  // above-chat). `PlayerShellView` itself never reaches out to control such a sibling family
  // directly; the menu's own content / actions are unaffected.
  //
  // rb-rn-chat-reveal-sheet-dismiss-timing: same deferred-CLOSE-bubble shape as `infoPanelOpen`
  // above — see `useDeferredDismissBubble`'s doc comment.
  useDeferredDismissBubble(moreMenuOpen, onMoreMenuOpenChange, SHEET_DISMISS_BUBBLE_DELAY_MS);

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

  // Drag-to-scrub precision hint forwarders (rn-vod-scrub-seek-tolerance-reference-ui) — the
  // EXISTING `model.beginScrub()`/`endScrub()` (Android-only, safe no-op on iOS / demo
  // instances). Deliberately independent of `handleScrubStarted`/`handleScrubEnded` above (those
  // own only the pre-existing chrome-hide / hold-timer concern) rather than folded into them, so
  // the two call sites stay independently readable — mirrors Android
  // `PlayerShellView.kt`'s `onScrubBegin = { model.beginScrub() }` / `onScrubEnd = {
  // model.endScrub() }`. `onScrubEnd` is guaranteed by `PlaybackProgressBarView`'s
  // `emitScrubEnd` to run BEFORE the gesture's final forced `onScrub` call.
  const handleScrubBegin = (): void => {
    model.beginScrub();
  };
  const handleScrubEnd = (): void => {
    model.endScrub();
  };

  // Drag moved → forward the new absolute position to the EXISTING `model.seek()` forwarder (no
  // new core / view-model API). This forwarder itself is called at most as often as
  // `PlaybackProgressBarView` actually EMITS `onScrub` — that component throttles the frequency of
  // its own `onScrub` calls internally (`rb-rn-progress-bar-drag-seek-throttle`, since each call
  // here ultimately dispatches a real cross JS/native bridge command via `model.seek()`); this
  // forwarder's own logic is unchanged and has no throttle of its own. Parity iOS
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

  // Report the scrub-bar post-release hold window (initial + every change) so a family living
  // OUTSIDE this component's render tree (`feedwin`'s FeedWinView) can mirror the SAME lift over
  // its own chat-feed bottom inset — mirrors `onInfoPanelOpenChange` / `onCleanModeChange` /
  // `onMoreMenuOpenChange` above (rb-rn-scrub-expanded-chrome-lift). Reports the GATED value
  // (`isScrubChromeLifted`, i.e. `scrubBarExpanded && !isScrubbing`) — NOT the raw wide
  // `scrubBarExpanded` — so a container never lifts the chat feed during an active drag, matching
  // this component's own `scrubChromeLift` gate for `LiveOverlayChrome`'s `bottomInset` below.
  useEffect(() => {
    onScrubBarExpandedChange?.(isScrubChromeLifted(scrubBarExpanded, isScrubbing));
  }, [scrubBarExpanded, isScrubbing, onScrubBarExpandedChange]);

  const model = new PlayerShellModel(template);

  // rb-rn-endscreen-close-button-blocked — mirror `MomentsView.tsx`'s `endable` gate directly off
  // `template.endScreenState` (already typed on this view's own `template` prop — no need to
  // import family-4's `MomentsModel` for a two-field read, see design.md Decision 2). Computed
  // BEFORE the `model.isUpcoming` early-return branch below so BOTH `<PlayerHeaderBar>` call
  // sites can read the SAME override.
  const endScreenActive =
    template?.endScreenState.countdown != null || template?.endScreenState.endScreenVisible === true;
  const headerCloseOverride = resolveEndScreenHeaderOverride({
    endScreenActive,
    showCloseIcon,
    onMinimize,
    onCloseRequest,
  });

  // PREFETCH (rb-rn-product-image-loading-polish): warm RN's own <Image> cache for every
  // product's primary photo as soon as the FULL (unfiltered) product list arrives
  // (`model.products`) — well before any one product's [beginTime,endTime) window
  // (`model.vodActiveProducts`) or narrate-status window (`model.liveActiveProducts`) makes it
  // "currently introducing". Reading the FULL list instead of either filtered view means BOTH
  // the VOD now-introducing carousel and the LIVE narrating carousel are covered by this ONE
  // effect — no second parallel path is needed for `liveActiveProducts` (a subset of the same
  // list). Runtime-only (`live`): a `false` (snapshot / demo, DEFAULT) instance never calls the
  // real prefetch API, so structural snapshot tests make zero prefetch calls. The dependency
  // key is the resolved URL list's own join — `model.products` is a fresh array reference every
  // render (the model itself is re-`new`'d each render), so comparing by content (not identity)
  // avoids re-issuing the same batch of `Image.prefetch` calls on every unrelated re-render.
  const prefetchUrls = live ? productImagePrefetchUrls(model.products) : EMPTY_PREFETCH_URLS;
  const prefetchKey = prefetchUrls.join('|');
  useEffect(() => {
    if (prefetchUrls.length === 0) return;
    for (const url of prefetchUrls) {
      // Best-effort warm-up only — a failed prefetch is not a regression: `RemoteImage`'s own
      // `onError` still falls back to the placeholder when it later renders that product.
      Image.prefetch(url).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetchKey, live]);

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
  // The function has exactly THREE local branches before that fall-through: `more` → open the
  // 「更多」collapsed menu (then still fall through as an observation hook), `share` when the
  // container injected `onShare` → that seam, and `serviceLink` → 聯絡商家 confirm modal
  // (parity with iOS/Flutter's `handleRailTap`).
  //
  // rb-rn-live-replay-more-menu-and-video-info-live-copy (design R32): the `more` branch's
  // action CHANGED from "toggle the info panel" to "open `moreMenuOpen`". This is safe — the
  // OLD action was DEAD CODE: `OperationRail` never drew a `More` pill before this change (it
  // was absent from `RAIL_PRESENTATION_ORDER`, the ONLY thing that ever called this function
  // with a `More`-valued `kind`), and no other call site in this file (or any test) ever invoked
  // `handleRailTap` with `More` / the literal `'more'` — grep-verified. So this branch had NEVER
  // fired in real usage; repurposing it carries zero behavior-change risk for existing hosts.
  // The header host-pill's own info-panel toggle (`onTapHostBadge`) is a SEPARATE, direct
  // `setInfoPanelOpen` wire (see that call site below) and is UNAFFECTED by this change.
  //
  // rb-rn-replay-live-chrome-parity: this `More` branch is RETAINED (source compat, and
  // `OperationRail.isFinishedLiveReplay` — the ONLY thing that could ever feed this function a
  // `More`-valued `kind` — stays a component-level capability), but the `<OperationRail>` call
  // site below no longer feeds `isFinishedLiveReplay`, so in the CURRENT real render tree this
  // branch is once again unreachable from any actual tap — the real "更多" trigger moved to
  // `LiveBottomBarView.onMore`, which calls `setMoreMenuOpen(true)` directly (see that state's
  // own doc comment above) and does NOT come through here.
  const handleRailTap = (kind: LBSideRailKind): void => {
    if (kind === LBSideRailKind.More) {
      setMoreMenuOpen(true);
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

  // Record this press's TapZone (rb-rn-gesture-clean-mode-v2) — read at `onPressIn` (touch-down
  // location), consumed by `handleVideoTap` (short-tap / double-tap-seek decision). The long-press
  // 2x-speed gesture deliberately does NOT read this (see `scheduleSpeedModeTick` below — the
  // upstream demo's own direction bug, kept verbatim per design.md D4).
  const handleVideoPressIn = (e: GestureResponderEvent): void => {
    pressZoneRef.current = tapZone(e.nativeEvent.locationX, videoAreaWidth);
  };

  // Video-area SHORT-TAP dispatch (rb-rn-gesture-clean-mode-v2, design R29) — the sole `onPress`
  // handler, replacing the retired `allowsTapToggleMute` LIVE/VOD mute-vs-play-pause split.
  // Non-seekable (live in progress / upcoming) → toggles `cleanMode` immediately, no defer (no
  // double-tap semantics apply there). Seekable (VOD / finished-live replay) → checks
  // `isDoubleTapSeekHit` against the last seekable tap's timestamp + zone: a hit cancels the
  // pending `cleanMode` toggle and seeks instead (±`SEEK_STEP_SECONDS`); a miss (or no prior tap)
  // schedules a NEW deferred `cleanMode` toggle after `DOUBLE_TAP_SEEK_WINDOW_MS`. Mirrors the
  // retired `runLikeGestureCheck`'s "always update the last-tap ref, hit or miss" convention —
  // consecutive rapid taps can each pair with their immediate predecessor.
  const handleVideoTap = (): void => {
    if (!isSeekable(model.isLive, model.isUpcoming, model.isFinishedLiveReplay)) {
      setCleanMode((c) => !c);
      return;
    }
    const zone = pressZoneRef.current;
    const now = Date.now();
    const sameZone = lastSeekTapZoneRef.current === zone;
    if (isDoubleTapSeekHit(lastSeekTapAtRef.current, now, sameZone)) {
      if (pendingCleanModeToggleTimerRef.current != null) {
        clearTimeout(pendingCleanModeToggleTimerRef.current);
        pendingCleanModeToggleTimerRef.current = null;
      }
      model.seekBy(zone === 'forward' ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS);
      // rb-rn-double-tap-seek-feedback: show the half-screen gesture toast for this direction,
      // resetting (not stacking) the auto-dismiss timer on a re-trigger while already showing.
      if (seekToastTimerRef.current != null) clearTimeout(seekToastTimerRef.current);
      setSeekToastZone(zone);
      seekToastTimerRef.current = setTimeout(() => {
        seekToastTimerRef.current = null;
        setSeekToastZone(null);
      }, GESTURE_SEEK_TOAST_DURATION_MS);
    } else {
      pendingCleanModeToggleTimerRef.current = setTimeout(() => {
        pendingCleanModeToggleTimerRef.current = null;
        setCleanMode((c) => !c);
      }, DOUBLE_TAP_SEEK_WINDOW_MS);
    }
    lastSeekTapAtRef.current = now;
    lastSeekTapZoneRef.current = zone;
  };

  // Long-press 2x-speed-approximation tick (rb-rn-gesture-clean-mode-v2, design R29). Recursive
  // self-reschedule: while `speedModeActiveRef.current` stays `true`, each tick calls
  // `model.seekBy(SPEED_MODE_EXTRA_SEEK_PER_TICK_SECONDS)` (always a POSITIVE / forward value —
  // deliberately NOT reading `pressZoneRef`, per the upstream demo's own direction bug kept
  // verbatim, design.md D4) then reschedules itself; once `stopSpeedMode` flips the ref to
  // `false`, the in-flight tick fires once more, sees the ref is `false`, and stops WITHOUT
  // calling `seekBy` or rescheduling again.
  const scheduleSpeedModeTick = (): void => {
    speedModeTickTimerRef.current = setTimeout(() => {
      speedModeTickTimerRef.current = null;
      if (!speedModeActiveRef.current) return;
      model.seekBy(SPEED_MODE_EXTRA_SEEK_PER_TICK_SECONDS);
      scheduleSpeedModeTick();
    }, SPEED_MODE_TICK_INTERVAL_MS);
  };

  // Long-press START (rb-rn-gesture-clean-mode-v2) — the video-area `Pressable`'s `onLongPress`,
  // mounted ONLY while `isSeekable` (see the render body below: `onLongPress={isSeekable(...) ?
  // handleVideoLongPress : undefined}` — a STRUCTURAL no-op for live-in-progress / upcoming, not a
  // scheduled timer whose handler early-returns).
  const handleVideoLongPress = (): void => {
    speedModeActiveRef.current = true;
    scheduleSpeedModeTick();
  };

  // Long-press STOP (rb-rn-gesture-clean-mode-v2) — the video-area `Pressable`'s `onPressOut`,
  // mounted UNCONDITIONALLY (RN fires `onPressOut` for every touch that ends, whether it was a
  // short tap, a completed long-press, or a swipe-cancelled press — this is the single reliable
  // place to guarantee 2x-speed never outlives the finger lifting).
  const stopSpeedMode = (): void => {
    speedModeActiveRef.current = false;
    if (speedModeTickTimerRef.current != null) {
      clearTimeout(speedModeTickTimerRef.current);
      speedModeTickTimerRef.current = null;
    }
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
        {/* Background: the upcoming countdown surface (date + big time). Forwards the
            scope's runtime `live` signal (rb-rn-upcoming-live-wiring-fix — the prior
            hardcoded `live={false}` never let the `live === true` branch run at host
            runtime, matching the same wiring bug already fixed on Android in
            rb-android-upcoming-cover-real-image). `live === true` + non-empty
            `coverUrl` → UpcomingCountdownView overlays the real channel cover via its
            own RemoteImage gate; `live === false` (demo / snapshot) → deterministic
            solid theme.background, unchanged. */}
        <UpcomingCountdownView
          theme={theme}
          scheduledStartAt={model.upcomingStartAt}
          live={live}
          coverUrl={model.upcomingCover}
        />

        {/* rb-rn-clean-mode-upcoming-not-triggered: 直播預告倒數 MUST NOT 支援乾淨模式（訂正
            rb-rn-clean-mode-upcoming-intro-coverage 的誤判——使用者原始回報描述的其實是期望行為，
            不是 bug）。先前在這裡掛的 video-area tap `Pressable` 已移除，這個分支重新回到完全沒有
            手勢偵測的狀態，`cleanMode` 對 upcoming 而言永遠是 `false`。*/}

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
            // rb-rn-endscreen-close-button-blocked — effective (possibly overridden) value; see
            // `headerCloseOverride` above. Byte-identical to the raw `onMinimize` prop while
            // EndScreen is not active.
            onMinimize={headerCloseOverride.onMinimize}
            onToggleSubscribe={onToggleSubscribe}
            showSubscribe={showSubscribe}
            // rb-rn-viewer-count-visibility-toggle — raw forward, same reasoning as showSubscribe
            // above: even though this upcoming branch always passes isLive={false} below (so the
            // viewer-count gate `isLive && showViewerCount` never fires here regardless), this
            // call site MUST still forward the flag — omitting it would leave a silent dead spot
            // if this branch's `isLive` semantics ever change (the same discipline `titleScroll` /
            // `showCloseIcon` already document for this file's two call sites).
            showViewerCount={showViewerCount}
            // rb-rn-player-direct-close-button — raw forward, same reasoning as showSubscribe
            // above: the upcoming header's trailing button is the SAME single button as the main
            // branch, so it must reflect the same resolved icon.
            // rb-rn-endscreen-close-button-blocked — effective (possibly overridden) value; see
            // `headerCloseOverride` above. Byte-identical to the raw `showCloseIcon` prop while
            // EndScreen is not active.
            showCloseIcon={headerCloseOverride.showCloseIcon}
            // rb-rn-marquee-title-scroll — the upcoming header draws / measures / scrolls its
            // title exactly like the main branch, so this forward is LOAD-BEARING, not
            // defensive: omitting it would let the header fall back to「may scroll」and ignore
            // the merchant's setting on scheduled-live videos.
            titleScroll={titleScroll}
            // rb-rn-clean-mode-upcoming-not-triggered — upcoming MUST NOT 支援乾淨模式，
            // `hidesHostBadge` / `onToggleMute` 不轉發，維持其預設值（`false` / `undefined`）。
          />
        </View>

        {/* SLIM LIVE bottom bar pinned bottom (bag + spacer + share + like; no 留言 /
            nickname / CC). bag / share / like route through the existing rail wiring by
            kind. NO VOD side rail / floating bag / mini-cart / overlay chrome. 永遠顯示，與乾淨
            模式無關（rb-rn-clean-mode-upcoming-not-triggered）——upcoming 不支援乾淨模式。 */}
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
            // rb-rn-like-tap-wire）+ 隨機 1–4 顆飄心 burst + liked 亮色（design R37，
            // rb-rn-live-like-burst-restyle，見 `triggerLikeBurst`）。兩者是**獨立**的兩條線：burst
            // 由本地 liveHeartTick 驅動。
            onLike={() => {
              handleRailTap(LBSideRailKind.Like);
              triggerLikeBurst();
            }}
            liked={liveLiked}
          />
        </View>

        {/* 愛心 burst 錨於 slim 底部 bar 愛心上方（靜止態 render null → snapshot 中立）。永遠顯示，
            與乾淨模式無關（rb-rn-clean-mode-upcoming-not-triggered）——upcoming 不支援乾淨模式。 */}
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

  // Whether the interactive intro-progress row should be composed (Requirement B,
  // rb-rn-intro-progress-bar-interactive). See {@link showsIntroProgressBar}'s doc comment.
  const showsIntroProgress = showsIntroProgressBar(model.introPlaying, cleanMode);

  // Whether `LiveNowPillView` should be composed (rb-rn-live-now-pill). `isMainPlaybackPhase` is
  // the SAME value `showsProgressBar` above feeds as `isMain` — it does NOT exclude a genuinely
  // live broadcast (only the intro/loading/splash sequence), so `model.isLive` MUST be forwarded
  // as its own, independent argument here — see `showsLiveNowPill`'s doc comment for the shipped
  // defect this call site avoids by doing so from day one.
  const showsLiveNow = showsLiveNowPill(
    hasLiveNow,
    isMainPlaybackPhase,
    model.isUpcoming,
    model.isLive,
    model.isFinishedLiveReplay,
    cleanMode,
    isScrubbing,
  );

  // VOD CC 字幕（rb-react-native-subtitle-vtt-caption-display）：以目前 model.position 現算命中的
  // cue 文字（`subtitleCues` prop 是唯一來源 — RN 沒有 host-override caption-text 入口，design.md
  // Non-Goals）。`usesLiveChrome`（下方定義，鏡射 iOS/Android/Flutter 的「purely VOD」定義：isLive
  // **或** isFinishedLiveReplay 皆不算純 VOD）服務 Surface 4 分流 / 側欄 / 浮動購物袋 /
  // LiveBottomBarView 組裝 / HeartBurst 組裝這些判斷點（`rb-rn-replay-live-chrome-parity`），但**不**
  // 服務這個字幕呼叫點——`rb-rn-replay-caption-overlay-fix` 訂正：VOD 字幕改吃嚴格 `model.isLive`，
  // 已結束直播回放（`isFinishedLiveReplay`）視為可顯示 VOD 字幕（回放本質是 VOD：可拖曳進度條、播放
  // 不需即時聊天室），不再落入排除範圍（先前誤用 `usesLiveChrome` 會把回放誤判為「LIVE chrome」，
  // 改顯示 `LiveOverlayChromeView` 的主持人字幕，那個機制無 VTT 資料來源，畫面上永遠看不到字幕）。
  const effectiveCaption = VTTSubtitleParser.activeCue(subtitleCues, model.position)?.text ?? '';
  const usesLiveChrome = model.isLive || model.isFinishedLiveReplay;
  const showsCaption = shouldShowCaptionOverlay(
    model.isLive,
    model.introPlaying,
    isScrubbing,
    cleanMode,
    model.subtitleEnabled,
    effectiveCaption,
  );

  // The extra bottom lift applied to VOD chrome that has reappeared during the post-release hold
  // window (`scrubBarExpanded && !isScrubbing`) so it clears the still-expanded transport bar;
  // `0` at every other time. Parity iOS `PlayerShellView.scrubChromeLiftIfExpanded`. Routed
  // through `isScrubChromeLifted` (rb-rn-scrub-expanded-chrome-lift) so this value and the
  // `onScrubBarExpandedChange` report below share the exact same gate.
  const scrubChromeLift = isScrubChromeLifted(scrubBarExpanded, isScrubbing) ? SCRUB_CHROME_LIFT : 0;

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
    // 原價劃線資料透傳（vod-now-introducing-original-price-reference-ui-rn）：直接轉發來源
    // LBProduct 既有欄位，無需任何額外映射邏輯——是否畫出劃線像素是 MiniCartPeekView 的版面判斷。
    originalPriceShow: p.originalPriceShow,
  }));
  // Trailing clearance follows the side rail's visibility (shown from Buffering
  // onward, suppressed only in Loading/Splash) — rb-rn-vod-rail-show-on-buffering.
  // Also drives the now-introducing card's own MOUNT decision below, not just its
  // trailing padding (rb-rn-now-introducing-carousel-buffering-gate) — the card
  // MUST NOT appear before the side rail even if `nowIntroducingPeeks` is already
  // non-empty during the VOD opening sequence.
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
      {/* Video-area gesture surface (rb-rn-gesture-clean-mode-v2, design R29 —整個對調 R23 的觸發
          手勢). A transparent, full-bleed tap target placed BELOW the chrome so header / rail /
          info-panel / pinned-card taps win.
          `onPress` → `handleVideoTap()`: non-seekable (live in progress / upcoming) toggles
          `cleanMode` immediately; seekable (VOD / finished-live replay) defers the toggle by
          `DOUBLE_TAP_SEEK_WINDOW_MS`, cancelled by a same-zone double-tap which seeks ±10s
          instead (see `handleVideoTap`'s doc comment).
          `onPressIn` → `handleVideoPressIn`: records this press's {@link TapZone} for `onPress`
          to read.
          `onLongPress` → conditionally `handleVideoLongPress` ONLY while `isSeekable` —
          `undefined` otherwise, a STRUCTURAL no-op for live-in-progress / upcoming (RN never
          starts an internal long-press timer without a handler; see design.md Decision 1).
          `onPressOut` → `stopSpeedMode` UNCONDITIONALLY, so 2x-speed never outlives the touch.
          No pixels of its own → omitted callbacks make it inert; the surface structural baselines
          are unaffected by the Pressable itself (only by `cleanMode`'s downstream chrome wiring
          below). */}
      {/* The PanResponder wrapper claims only committed vertical drags (|dy| ≥
          threshold) → swipe navigation; the inner Pressable keeps tap / long-press. The two
          coexist (RN analogue of iOS .simultaneousGesture) — a real swipe cancels the Pressable's
          in-flight press (and any pending long-press timer) via RN's responder-termination
          callback, so a genuine swipe never also fires tap or long-press. `onLayout` measures the
          video area's width (rb-rn-gesture-clean-mode-v2) so `tapZone` can classify a touch's
          horizontal offset into a left/right half. */}
      <View
        {...swipeResponder.panHandlers}
        onLayout={(e: LayoutChangeEvent): void => setVideoAreaWidth(e.nativeEvent.layout.width)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <Pressable
          testID={LBTestIDs.playerVideoSurface}
          onPressIn={handleVideoPressIn}
          onPress={handleVideoTap}
          onLongPress={
            isSeekable(model.isLive, model.isUpcoming, model.isFinishedLiveReplay)
              ? handleVideoLongPress
              : undefined
          }
          delayLongPress={HOLD_SPEED_MODE_DELAY_MS}
          onPressOut={stopSpeedMode}
          style={{ flex: 1 }}
        />
      </View>

      {/* Surface 4 — now-introducing surface. usesLiveChrome (真直播 OR 已結束直播回放,
          rb-rn-replay-live-chrome-parity) → the full-bleed LiveOverlayChrome (announce
          marquee / pinned card / host caption / gesture hints; `isLive` narrows which of
          the two sub-states within this branch — see the call site below). 純 VOD → the
          now-introducing CAROUSEL (real image + full width + page dots over ALL products
          whose [beginTime,endTime) covers the playhead, minus dismissed) anchored
          bottom-leading. intro 片頭 (introPlaying) → NEITHER (the opening MP4 is not yet
          live). Parity iOS/Android/Flutter: usesLiveChrome → LiveOverlayChrome, 純 VOD →
          NowIntroducingCarousel (mutually exclusive branches). */}
      {usesLiveChrome ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <LiveOverlayChrome
            theme={theme}
            // 乾淨模式（cleanMode）時公告 banner 不顯示——LiveOverlayChromeView 既有的
            // `announceText.length > 0` 判斷本已把空字串視為「不畫」，故傳空字串即可，元件內部零
            // 改動（rb-rn-gesture-clean-mode-rewrite，design R23）。
            announceText={cleanMode ? '' : model.announceText}
            // 釘選卡資料源依窄義 model.isLive 分流（rb-rn-replay-live-chrome-parity，parity iOS/
            // Flutter）：真直播 → LIVE 全部介紹中商品（多件 narrate_status==2）→ 釘選卡多商品輪播 +
            // 分頁點；空時 fallback 單一 pinnedProduct（activeProduct ?? first isHot）一元陣列
            // （問題 7, rb-rn-live-now-introducing-carousel）。已結束直播回放 → vodActiveProducts
            // （時間窗 [beginTime,endTime) 涵蓋 playhead 的商品，與 VOD now-introducing 輪播同一資料
            // 源）。兩分支皆再依同一份本地 dismissedLivePinnedIds 過濾（釘選卡 close 逐商品本地
            // 隱藏，rb-rn-live-pinned-card-dismiss；換不同商品帶入新 id 時自動重新顯示）。
            // 唯一在乾淨模式下仍保留的 LIVE chrome（design R23）——`cleanMode` 不影響此 prop。
            pinnedProducts={visiblePinnedProducts(
              model.isLive ? model.livePinnedProducts : model.vodActiveProducts,
              dismissedLivePinnedIds,
            )}
            // 分辨「真直播」與「已結束直播回放」兩個同屬 usesLiveChrome 大分支的子狀態
            // （rb-rn-replay-live-chrome-parity，parity iOS LiveOverlayChromeView.isLive）：驅動長按
            // 2倍速快轉手勢提示（僅回放顯示）與釘選卡「介紹中」ribbon 判斷（isNarrating）。
            isLive={model.isLive}
            showGestureHints={showGestureHints && !cleanMode}
            // rb-rn-live-overlay-gesture-hint-autofade: gesture hints auto-fade 3.5s after they
            // appear (0.6s ease-out) only over real playback content — `live` (NOT `model.isLive`,
            // a different orthogonal flag; this whole `<LiveOverlayChrome>` call already only
            // renders on the `model.isLive === true` branch, see design.md D2), parity Android
            // `PlayerShellView.kt`'s `autoFadeGestureHints = live` / Flutter `player_shell_view
            // .dart`'s `autoFadeGestureHints: widget.live`.
            autoFadeGestureHints={live}
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
            // 放開播放進度條到 2.8 秒收回這段暫留期間，公告 banner / 釘選商品卡跟著既有 VOD 側欄 / 浮動
            // 購物袋 / now-introducing 輪播同步上移（rb-rn-scrub-expanded-chrome-lift）——沿用同一個既有
            // `scrubChromeLift` 變數，非另算一份。
            bottomInset={scrubChromeLift}
          />
        </View>
      ) : !model.introPlaying && !isScrubbing && nowIntroducingPeeks.length > 0 && railShown ? (
        // Hidden while actively dragging the playback-progress bar (rb-rn-vod-playback-progress-
        // bar) — reappears (lifted `scrubChromeLift`, see padding below) once the finger lifts,
        // for the remainder of the post-release hold window. The card's MOUNT itself (not just
        // its trailing padding below) now follows `railShown` (rb-rn-now-introducing-carousel-
        // buffering-gate): during the VOD opening sequence (`startPhase ∈ {Loading, Splash}`)
        // this card is suppressed together with the side rail, even if `nowIntroducingPeeks`
        // (derived from `model.vodActiveProducts`) is already non-empty.
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
          // LIVE pill ⟺ isLive && !isReplay; viewer count ⟺ isLive. `isLive` here is fed
          // `usesLiveChrome`（真直播 OR 已結束直播回放，rb-rn-playerheaderbar-viewer-count-replay-
          // parity）——NOT the narrower `model.isLive`：a finished-live replay wears LIVE chrome
          // (`LiveOverlayChrome` / `LiveBottomBarView`, see `rb-rn-replay-live-chrome-parity`) and
          // MUST still show the viewer count (parity iOS `PlayerShellView.swift:1499` `isLive:
          // usesLiveChrome` / Flutter `player_shell_view.dart:1344` same). `isReplay` is
          // correspondingly widened to `model.isReplay || model.isFinishedLiveReplay` (parity iOS
          // `:1504` / Flutter `:1345`) so the LIVE pill is STILL hidden for a finished replay
          // (`isLive && !isReplay` → `true && !true` → hidden) while the viewer count stays shown
          // (`isLive` alone → `true`) — `model.isReplay` (DVR-behind-live-edge WHILE still live)
          // and `model.isFinishedLiveReplay` (`liveStatus == 3`, no longer live) are mutually
          // exclusive by construction, so this OR never double-counts either state; a real,
          // actively-live broadcast (not behind the edge) still shows both pill and count
          // unchanged (`isLive === true`, `isReplay === false`).
          isLive={usesLiveChrome}
          isReplay={model.isReplay || model.isFinishedLiveReplay}
          live={live}
          // rb-rn-endscreen-close-button-blocked — effective (possibly overridden) value; see
          // `headerCloseOverride` above. Byte-identical to the raw `onMinimize` prop while
          // EndScreen is not active.
          onMinimize={headerCloseOverride.onMinimize}
          onToggleSubscribe={onToggleSubscribe}
          showSubscribe={showSubscribe}
          // rb-rn-viewer-count-visibility-toggle — raw forward (leaf owns the `true` default,
          // OPPOSITE polarity from showSubscribe's `false`). The sibling `isUpcoming` branch above
          // forwards the same value; both call sites must stay wired.
          showViewerCount={showViewerCount}
          // rb-rn-player-direct-close-button — raw forward (leaf owns the `false` default);
          // resolved by the container from `LivebuyPlayerConfig.enableDirectCloseButton`.
          // rb-rn-endscreen-close-button-blocked — effective (possibly overridden) value; see
          // `headerCloseOverride` above. Byte-identical to the raw `showCloseIcon` prop while
          // EndScreen is not active.
          showCloseIcon={headerCloseOverride.showCloseIcon}
          // rb-rn-marquee-title-scroll — raw merchant gate for the title marquee (the leaf
          // slot owns the fallback). The sibling `isUpcoming` branch above forwards the same
          // value; both call sites must stay wired.
          titleScroll={titleScroll}
          // host pill tap → toggle the info panel (parity iOS onTapHostBadge — the only opener
          // now that the rail no longer carries a `more` pill).
          onTapHostBadge={() => setInfoPanelOpen((o) => !o)}
          // 乾淨模式（cleanMode）時隱藏 host pill（標題／主持人／訂閱／觀看數），保留最小化鈕
          // （rb-rn-gesture-clean-mode-v2，design R29）。
          hidesHostBadge={cleanMode}
          // 乾淨模式限定靜音鈕（rb-rn-gesture-clean-mode-v2）：補回單擊切靜音手勢退役後的操作管道。
          // `onToggleMute` 為 `undefined`（非乾淨模式）時該鈕不渲染、不佔位。
          muted={model.muted}
          onToggleMute={cleanMode ? onToggleMute : undefined}
        />
        {/* Spacer pushes the side rail to the bottom-trailing corner. Side rail is
            PURE-VOD-ONLY chrome (rb-rn-replay-live-chrome-parity: gated on `!usesLiveChrome`,
            NOT the narrower `!isLive` — a finished-live replay now also counts as
            usesLiveChrome and routes to the LIVE bottom bar below instead, see that call
            site's `chatClosed` variant); in usesLiveChrome the bottom bar (below) replaces
            it — mutually exclusive by mode. Suppressed only during the intro 片頭
            (introPlaying) and the VOD OPENING sequence (`startPhase` Loading/Splash) — design
            `showMainChrome` hides VOD chrome there; from Buffering onward the rail shows
            (no-intro VOD: channel loaded, rail enablement set, header filled), so it appears
            alongside the header instead of waiting for the first frame (Done). Header is kept
            throughout (rb-rn-vod-rail-show-on-buffering, parity to iOS
            rb-ios-vod-rail-show-on-buffering). */}
        {!usesLiveChrome &&
        !model.introPlaying &&
        !isScrubbing &&
        !cleanMode &&
        model.startPhase !== StartScreenPhase.Loading &&
        model.startPhase !== StartScreenPhase.Splash ? (
          // Additionally hidden while actively dragging the playback-progress bar
          // (rb-rn-vod-playback-progress-bar) or in clean mode (rb-rn-gesture-clean-mode-v2,
          // design R29) — reappears (lifted, see marginBottom below) once the finger lifts /
          // clean mode toggles off.
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
            {/* Rail anchored bottom 68 (design LBPSideRail, rb-rn-gesture-clean-mode-v2 縮小商品袋
                48→40 同步由 80 下移至 68 維持間距一致) so the SEPARATE floating bag (bottom
                16) sits below it next to the mini-cart strip. */}
            <View style={{ alignSelf: 'flex-end', marginRight: 12, marginBottom: 68 + scrubChromeLift }}>
              <OperationRail
                theme={theme}
                items={model.railItems}
                bagCount={model.bagCount}
                heartBurstTick={model.heartBurstTick}
                muted={model.muted}
                onTapItem={handleRailTap}
                // rb-rn-cc-icon-active-fill-state: drives the Subtitle (CC) pill's active fill
                // state (white bg + accent glyph) — the only kind this affects.
                subtitleEnabled={model.subtitleEnabled}
                // rb-rn-replay-live-chrome-parity: this rail is now PURE-VOD-ONLY (gated
                // `!usesLiveChrome` above) — a finished-live replay no longer reaches this
                // branch at all, so `isFinishedLiveReplay` is deliberately NOT fed here
                // any more (the "更多" pill this prop used to append is unreachable from this
                // call site; `OperationRailProps.isFinishedLiveReplay` stays a
                // component-level-only capability, see that prop's own doc comment). "更多"
                // is now reachable via `LiveBottomBarView`'s `chatClosed` variant instead
                // (see that call site's `onMore`).
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* Floating shopping bag (design LBPBagButton, iOS FloatingBagButtonView): a SEPARATE
          affordance from the side rail, anchored low (bottom 16) — distinct from the rail (bottom
          80). Pure-VOD chrome only (rb-rn-replay-live-chrome-parity: `!usesLiveChrome`, parity
          the side rail above — a finished-live replay no longer reaches this branch). Tap →
          open the product list (handleRailTap(Goods)). */}
      {!usesLiveChrome && !model.introPlaying && !isScrubbing && !cleanMode && railShown ? (
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
          usesLiveChrome (真直播 OR 已結束直播回放, rb-rn-replay-live-chrome-parity) OR the intro
          片頭 (introPlaying) (純 VOD uses the side rail above instead). `!isScrubbing` is a
          NEW gate added by that same change: unifying `usesLiveChrome` means a finished-live
          replay can now simultaneously satisfy this bar's assembly condition AND
          `showsPlaybackProgressBar` (the VOD-style transport bar below) — before the
          unification, a genuinely-live broadcast never has `showsPlaybackProgressBar === true`
          (mutually exclusive by construction), so no such overlap could occur; `!isScrubbing`
          prevents the two overlapping while the viewer is actively dragging the transport bar
          (parity iOS's pre-existing `!isScrubbing` term on this same gate). `cleanMode` is now
          folded INTO the `usesLiveChrome` operand (was a separate `&&` term on the whole
          expression) precisely so it does NOT also suppress the `introPlaying` bag-only
          variant, which was never gated by `cleanMode` to begin with. introPlaying → the
          BAG-ONLY variant (just the bag). bag / like / CC route through the existing
          `onTapRailItem` wiring by kind (the container seam's default sends `Like` to core —
          rb-rn-like-tap-wire — while `Goods` is intercepted upstream and `Subtitle` is still
          un-wired); share / nickname raise their dedicated `onShare` / `onNickname` intents
          when injected, falling back to the rail route otherwise; 留言 raises the dedicated
          `onComment` intent (真直播) or is disabled — see `chatClosed` below (已結束直播回放).
          Below the info-panel modal (which renders later in this parent → on top). Hidden
          while the on-demand composer is up (`!composerPresented`) so the opaque composer has
          no bottom bar peeking behind it (parity iOS PlayerShellView composerPresented gate). */}
      {((usesLiveChrome && !cleanMode) || model.introPlaying) && !composerPresented && !isScrubbing ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <LiveBottomBarView
            theme={theme}
            bagCount={model.bagCount}
            isReplay={model.isReplay}
            bagOnly={model.introPlaying}
            // 已結束直播回放（design R32，rb-rn-live-replay-more-menu-and-video-info-live-copy
            // 新增的元件本身，rb-rn-replay-live-chrome-parity 起本呼叫處才真的餵值）：留言區換成
            // disabled「聊天室已關閉」、暱稱鈕換成「更多」、分享鈕位置換成 CC 切換；愛心鈕不變。
            chatClosed={model.isFinishedLiveReplay}
            // CC 開關視覺狀態——與 VOD 字幕疊層（shouldShowCaptionOverlay 呼叫處）/ 側欄 Subtitle
            // pill 共用同一顆單一真相來源，非新增狀態。
            ccOn={model.subtitleEnabled}
            // 字幕來源是否存在（design R42，rb-rn-cc-icon-availability-redesign）：與側欄
            // OperationRail 讀同一份 model.railItems（透過 subtitleAvailableFrom），確保兩個 CC
            // 入口（VOD 側欄 pill / 已結束直播回放底部 bar CC 鈕，兩者互斥、不會同時掛載）對「是否有
            // 字幕來源」的判斷一致。
            subtitleAvailable={subtitleAvailableFrom(model.railItems)}
            onBag={() => handleRailTap(LBSideRailKind.Goods)}
            onComment={onComment}
            // 暱稱鈕 → 容器本地呈現 設定暱稱 modal（onNickname；parity iOS / Android）；未接時
            // 退回 rail 路徑（demo / standalone）。
            onNickname={onNickname ?? (() => handleRailTap(LBSideRailKind.GuestNameEdit))}
            // 頻道分享（rb-rn-player-share-default-sheet）：容器注入 onShare → 走它（系統分享 fallback）；
            // 未注入（非容器 / snapshot）→ 退回既有 handleRailTap(Share) rail 路由。
            onShare={onShare ?? (() => handleRailTap(LBSideRailKind.Share))}
            // 真 like（rail 意圖 → 容器 seam 預設 defaultRailTap → core simulateLikeTap，
            // rb-rn-like-tap-wire）+ 隨機 1–4 顆飄心 burst + liked 亮色（design R37，
            // rb-rn-live-like-burst-restyle，見 `triggerLikeBurst`）。兩者是**獨立**的兩條線：burst
            // 由本地 liveHeartTick 驅動。
            onLike={() => {
              handleRailTap(LBSideRailKind.Like);
              triggerLikeBurst();
            }}
            liked={liveLiked}
            onToggleCC={() => handleRailTap(LBSideRailKind.Subtitle)}
            // 「更多」選單（design R32 `LiveMoreMenuView`）：rb-rn-replay-live-chrome-parity 起
            // 觸發來源從側欄 `OperationRail` 的 `LBSideRailKind.More` pill 改到這裡——直接呼叫既有
            // `moreMenuOpen` state setter，MUST NOT 經 `handleRailTap`（那是側欄既有、獨立的派送
            // 鏈，這裡是全新、獨立的 intent，見側欄呼叫處的對應註解）。
            onMore={() => setMoreMenuOpen(true)}
          />
        </View>
      ) : null}

      {/* LIVE 底部 bar 愛心 burst（rb-rn-live-bottom-heart-burst，問題 5）：錨於底部 bar 愛心
          （trailing-most 鈕）上方。introPlaying（bag-only，無愛心）不畫。靜止態 HeartBurst render null
          → snapshot 中立（含定位的 root 只在飄心 in-flight 時出現）。也在乾淨模式下隱藏
          （rb-rn-gesture-clean-mode-v2，design R29）。
          rb-rn-replay-live-chrome-parity：已結束直播回放現在也真的組出 LiveBottomBarView（見上方），
          `onLike` 因此可達——這個子句從先前的恆為 no-op（`model.isFinishedLiveReplay` 分支從不觸發
          `liveHeartTick`，回放沒有 LIVE 底部 bar、側欄/浮動購物袋取代）變成真實生效，條件擴大為
          `usesLiveChrome`（取代先前的窄義 `model.isLive`），並比照上方底部 bar 本身的組裝條件新增
          `!isScrubbing`（拖曳進度條時底部 bar 本身已隱藏，愛心 burst 一併隱藏維持語意一致）。 */}
      {usesLiveChrome && !cleanMode && !isScrubbing ? (
        <HeartBurst theme={theme} tick={liveHeartTick} style={{ position: 'absolute', right: 18, bottom: 64 }} />
      ) : null}

      {/* VOD / replay playback-progress transport bar (rb-rn-vod-playback-progress-bar). Composed
          as an independent top-level sibling — NOT nested in either the pure-VOD or
          usesLiveChrome branch above — because it must render over BOTH (pure VOD via the VOD
          branch; a finished-live replay via the usesLiveChrome branch, which now ALSO renders
          `LiveOverlayChrome` — see `showsPlaybackProgressBar`'s doc comment for why the bar
          itself still never shows for a genuinely-live broadcast). rb-rn-replay-live-chrome-
          parity: unlike before that change, this transport bar and `LiveOverlayChrome` (pinned
          card / announce banner) CAN now be simultaneously mounted for a finished-live replay
          — they don't visually collide (the bar is pinned to `bottom: 0`, the pinned card sits
          at `bottom: 64`). What this bar IS mutually exclusive with is `LiveBottomBarView`
          while actively scrubbing — see that component's own `!isScrubbing` gate above,
          the mechanism that actually prevents the two from visually overlapping. Pinned to the
          very bottom edge. All interactions forward to `PlayerShellModel`'s EXISTING
          `togglePlayPause()` / `seek()` forwarders — no new core / view-model API. */}
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
            onScrubBegin={handleScrubBegin}
            onScrub={handleScrub}
            onScrubEnded={handleScrubEnded}
            onScrubEnd={handleScrubEnd}
          />
        </View>
      ) : null}

      {/* Intro clean-mode INTERACTIVE expanded progress row (rb-rn-intro-progress-bar-interactive,
          MODIFIED — supersedes the read-only 3px static line `rb-rn-clean-mode-upcoming-intro-
          coverage` originally shipped: 「不是細線進度條，是展開進度條，要可以暫停開始以及拖拉」).
          Directly composes the SAME `PlaybackProgressBarView` instance the VOD/replay transport
          bar above uses — no parallel hand-rolled implementation — with `isExpanded` forced
          `true` (this branch only ever renders while `cleanMode === true`, see
          `showsIntroProgressBar`, so `isExpanded` is trivially always true here; see design.md D2
          for why this is a literal rather than reusing `scrubBarExpanded || cleanMode`). All six
          callbacks forward to the EXISTING VOD scrub handlers (`handleScrubStarted` /
          `handleScrubBegin` / `handleScrub` / `handleScrubEnded` / `handleScrubEnd`, ultimately
          `model.togglePlayPause()` / `model.seek(...)`) — no new core/view-model API, no second
          `isScrubbing`/`scrubBarExpanded` state: `showsProgressBar` (VOD/replay bar) and
          `showsIntroProgress` (this row) are mutually exclusive (`isMainPlaybackPhase` explicitly
          excludes `model.introPlaying`), so at most one `PlaybackProgressBarView` instance is
          ever mounted at a time — sharing state is safe (design.md D3). A side effect of sharing
          `isScrubbing`: dragging this bar also hides the intro's bag-only bottom bar via its own
          existing `!isScrubbing` gate below, matching the VOD bar's established "hide chrome
          while dragging" behaviour.

          Progress-reporting routing: iOS (`5af921d48`) / Android (`8245bb849`) core fixed
          `togglePlayPause()`/`seek()`/`seekBy()`/progress-echo to route to the intro MP4 player
          today — this RN reference-ui layer needed no core/bridge change (the native bridge is a
          pure forwarder that inherits the fix automatically), which is why interactivity can now
          be wired here safely. Whether `model.position`/`model.duration` reflect intro-MP4
          progress with full precision at every instant is still not independently re-verified by
          THIS (reference-ui-only) change — any residual gap is a core-layer follow-up, not a
          reference-ui concern.

          Positioned ABOVE the bag-only bottom bar
          (`LIVE_BOTTOM_BAR_HEIGHT + LIVE_BOTTOM_BAR_CLEARANCE_GAP` — the SAME clearance constants
          `captionOverlayBottomInset` already uses) so the two never visually collide; that bag-
          only bar is itself NOT gated by `cleanMode` (pre-existing behaviour, unchanged, out of
          this fix's scope). The pre-existing 「退出乾淨模式」round exit button below is
          unconditional on `cleanMode` alone (not gated on `!introPlaying`), so it already covers
          this phase too — no separate exit affordance needed here. */}
      {showsIntroProgress ? (
        <View
          testID={LBTestIDs.introProgressBar}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: LIVE_BOTTOM_BAR_HEIGHT + LIVE_BOTTOM_BAR_CLEARANCE_GAP,
            paddingHorizontal: 12,
          }}
        >
          <PlaybackProgressBarView
            theme={theme}
            position={model.position}
            duration={model.duration}
            isPlaying={model.isPlaying}
            isScrubbing={isScrubbing}
            isExpanded
            onTogglePlayPause={() => model.togglePlayPause()}
            onScrubStarted={handleScrubStarted}
            onScrubBegin={handleScrubBegin}
            onScrub={handleScrub}
            onScrubEnded={handleScrubEnded}
            onScrubEnd={handleScrubEnd}
          />
        </View>
      ) : null}

      {/* 「現正直播」right-edge half-pill (rb-rn-live-now-pill). Composed as an independent
          top-level sibling (parity iOS `HStack { Spacer(); LiveNowPillView }` / Android
          `Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterEnd)`) so it draws over
          BOTH the VOD chrome and a finished-live-replay's LIVE-branch chrome, vertically centered
          against the right edge — `top:0, bottom:0` stretches this wrapper to full height,
          `right:0` with no `left` keeps its own width intrinsic (content-hugging), and
          `justifyContent: 'center'` + `alignItems: 'flex-end'` centers the pill inside it without
          claiming touches over the empty space around it (parity the sibling progress-bar/caption
          wrappers above, which are likewise plain absolutely-positioned Views with no touch claim
          of their own). */}
      {showsLiveNow ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'flex-end',
          }}
        >
          <LiveNowPillView theme={theme} onTap={onGoLive} />
        </View>
      ) : null}

      {/* VOD CC 字幕 overlay（rb-react-native-subtitle-vtt-caption-display，gate 訂正見
          rb-rn-replay-caption-overlay-fix）：非進行中直播（純 VOD 或已結束直播回放皆可）、非開場
          片頭、非拖曳進度條中、非乾淨模式,且 CC 已開 + 目前 position 命中某筆 cue 時才顯示,gate 見
          shouldShowCaptionOverlay。定位比照設計稿 LBPCaptionOverlay(design/templates/minimal/
          sdk-components.jsx)：置中於一個 left:8、right 依情境（純 VOD / 已結束直播回放）預留右側
          空間的窄框內(rb-rn-caption-overlay-align-hide-chat,見 captionOverlayRightInset)。貼底
          間隙依 isFinishedLiveReplay 分流（captionOverlayBottomInset）：純 VOD 固定 92pt
          （rb-rn-vod-caption-reserve-card-space,對齊設計稿 LBPCaptionOverlay 的
          safeBottom+92,無條件預留 NowIntroducingCarousel「介紹中」商品卡空間,不論該卡片當下是否
          實際渲染）；已結束直播回放（rb-rn-caption-overlay-bottom-bar-clearance-fix）清
          LiveBottomBarView 真實高度 + 安全間隙（該情境下這個底部列會被渲染)。兩分支皆疊加
          scrubChromeLift,拖曳進度條中則整層由 shouldShowCaptionOverlay 的 isScrubbing 隱藏,兩者
          皆不受本次修正影響。pointerEvents="none" 比照設計稿,字幕不吃掉底下影片區的點擊。 */}
      {showsCaption ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 8,
            right: captionOverlayRightInset(model.isFinishedLiveReplay),
            bottom: captionOverlayBottomInset(model.isFinishedLiveReplay, scrubChromeLift),
            alignItems: 'center',
          }}
        >
          <CaptionOverlayView theme={theme} text={effectiveCaption} />
        </View>
      ) : null}

      {/* 退出乾淨模式鈕（rb-rn-gesture-clean-mode-v2，design R29；icon/座標由
          rb-rn-clean-mode-exit-icon-fix 對齊設計稿）：`cleanMode === true` 時顯示一顆小圓鈕，點擊即
          退出。VOD/回放與 LIVE 共用同一顆按鈕元件，但座標依 `model.isLive` 分流對齊設計稿
          `design/templates/minimal/screens.jsx`：LIVE `left:14, bottom:16`；VOD/回放
          `left:14, bottom:52`（= 設計稿的 `16 + 36` 恆定墊高，避開乾淨模式下恆定展開的完整
          transport 列——與 `scrubChromeLift`（拖曳進度條暫態墊高）是不同概念，故不共用該變數）。
          icon 為 `DetailGlyph`（對齊設計稿 `Icons.detail`，逐字比照 iOS/Android 既有 `DetailGlyph`
          座標常數），取代先前的 `✕` 字元占位。左下角錨點，與右側的側欄/浮動購物袋/進度條互不重疊。
          取代已移除的中央暫停覆蓋層（`PlaybackPausedOverlayView`）與靜音提示 toast
          （`GestureMuteToastView`）——兩者不再被本元件組合（VOD/回放播放暫停改由既有
          `PlaybackProgressBarView` 展開態按鈕承載；頂列新增的靜音鈕直接切換，不需要提示動畫）。 */}
      {cleanMode ? (
        <View style={{ position: 'absolute', left: 14, bottom: model.isLive ? 16 : 52 }}>
          <Pressable
            testID={LBTestIDs.cleanModeExitButton}
            onPress={() => setCleanMode(false)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(20,20,24,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DetailGlyph color="#FFFFFF" size={18} />
          </Pressable>
        </View>
      ) : null}

      {/* 雙擊 seek 視覺回饋（rb-rn-double-tap-seek-feedback，design R46 `LBPGestureToast`
          seekFwd/seekBack 分支）：命中雙擊 seek 那一刻（`handleVideoTap` 的 `isDoubleTapSeekHit`
          分支）由 `seekToastZone` 驅動顯示，`GESTURE_SEEK_TOAST_DURATION_MS`（700ms）後自動消失。
          純視覺——雙擊 seek 的判定/呼叫（`model.seekBy`）本身完全不受影響，早於本 change 就已上線
          （rb-rn-gesture-clean-mode-v2）。本檔案無 `zIndex`，疊層順序純由 JSX 手足順序決定：放在
          一般 chrome（caption / live-now pill / 退出乾淨模式鈕）之後，讓它蓋在上方；放在 restriction
          mask / modal / sheet 之前，避免蓋過那些更高優先的互動層。`pointerEvents="none"`，不吃下層
          觸控，這個順序選擇對觸控行為無影響。 */}
      {seekToastZone != null ? (
        <GestureSeekToastView theme={theme} zone={seekToastZone} />
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
          // design R32 (rb-rn-live-replay-more-menu-and-video-info-live-copy): narrow
          // `model.isLive` (`liveStatus == 1`), NOT the broader `usesLiveChrome` (`isLive ||
          // isFinishedLiveReplay`) — a finished replay is no longer "直播中", so the panel's
          // 「直播中」badge correctly stays off for it. See `VideoInfoPanelProps
          // .isLiveBroadcast`'s doc comment for why this is NOT named `live`/`isLive` (this
          // call site already has an unrelated `live` prop above — the image-loading gate).
          isLiveBroadcast={model.isLive}
          // design R44 (rb-rn-video-info-panel-replay-copy): `model.isFinishedLiveReplay` is a
          // documented mutual-exclusion invariant with `model.isLive` above (see this file's own
          // `isSeekable` / `captionOverlayRightInset` / `showsLiveNowPill` doc comments) — the
          // panel's publishAt-row only ever consults it when `isLiveBroadcast` is `false`.
          isFinishedLiveReplay={model.isFinishedLiveReplay}
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
          // 前往商城首頁 PRIMARY CTA + its `onOpenStorefront` prop have been REMOVED
          // (rb-rn-live-replay-more-menu-and-video-info-live-copy, design R32 — user-decided
          // removal; see `VideoInfoPanelView.tsx`'s Footer doc comment).
        />
      </BottomSheetPresenter>

      {/* 「更多」collapsed menu (design R32, rb-rn-live-replay-more-menu-and-video-info-live-copy)
          — opened by the VOD side rail's `LBSideRailKind.More` pill (`handleRailTap`'s `more`
          branch above). Both actions CLOSE this sheet first, then forward to the SAME existing
          exits the LIVE bottom bar / info-panel footer already use — no new host seam:
            • 分享 → `onShare` if the container injected one (system share), else falls back to
              the existing `handleRailTap(Share)` rail route (mirrors the LIVE bottom bar's own
              `onShare` fallback above).
            • 客服 → `handleRailTap(ServiceLink)` → the SAME「聯絡商家」confirm modal below (mirrors
              `VideoInfoPanel`'s `onContactMerchant`). */}
      <BottomSheetPresenter
        visible={moreMenuOpen}
        onDismiss={() => setMoreMenuOpen(false)}
        sheetStyle={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      >
        <LiveMoreMenuView
          theme={theme}
          onShare={() => {
            setMoreMenuOpen(false);
            if (onShare != null) onShare();
            else handleRailTap(LBSideRailKind.Share);
          }}
          onContactMerchant={() => {
            setMoreMenuOpen(false);
            handleRailTap(LBSideRailKind.ServiceLink);
          }}
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
