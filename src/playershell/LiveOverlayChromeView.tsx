// LiveOverlayChromeView — family-1 surface 4 (LIVE overlay chrome, RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-1 player-shell, surface 4).
// Phase-4 RN sibling of the DONE iOS `LiveOverlayChromeView.swift`
// (rb-ios-player-shell D-2 #4), Android `LiveOverlayChrome.kt`
// (rb-android-player-shell), and Flutter `live_overlay_chrome_view.dart`
// (rb-flutter-player-shell — the primary blueprint, carrying the RECONCILED
// state). This RN family is built FROM SCRATCH translating the Flutter blueprint
// 1:1 to RN `.tsx`.
//
// Design: `design/templates/minimal/live-chrome.jsx` (LBLiveAnnounce /
// LBLivePinnedCard / LBLiveHostCaption) + `sdk-components.jsx` (LBPGestureHint /
// LBPMarqueeText).
//
// The full-bleed LIVE overlay chrome, layered ABOVE the video and BELOW the
// pinned chrome (top bar / side rail / info sheet — those are surfaces 1/2/3,
// owned by their own components). This surface renders ONLY the overlay
// affordances the design's `live-chrome.jsx` paints over the stream:
//
//   • LBLiveAnnounce    — announcement banner (bottom-left, dark-glass).
//   • LBLivePinnedCard  — pinned narrating-product card (bottom-right, white).
//   • LBLiveHostCaption — centered host caption overlay (~46% height).
//   • LBPGestureHint    — centered static gesture-hint pills (tap / hold / swipe).
//
// SCOPE FENCE (do NOT cross): this surface renders overlay affordances only. It
// MUST NOT render the product LIST / sheet (that is rb-rn-product-sheets) nor
// the chat feed / win toasts (that is rb-rn-feed-win). The `LBLiveChatOverlay`
// from `live-chrome.jsx` is therefore intentionally NOT rendered here.
//
// ─────────────────────────────────────────────────────────────────────────────
// SUB-VIEW INPUT PATTERN (matches PlayerShellView.tsx's documented contract)
// ─────────────────────────────────────────────────────────────────────────────
//
//   LiveOverlayChrome({
//       theme,                 // 1. resolved theme (first)
//       announceText,          // 2. bound snapshot value(s)
//       pinnedProducts,        //    (by value, from PlayerShellModel.livePinnedProducts —
//                               //    真直播 — or .vodActiveProducts — 回放, see `isLive` below)
//       hostCaption,           //    host-supplied static copy (GAP NOTE)
//       showGestureHints,      //    static presentation toggle
//       isLive,                //    真直播 vs 已結束直播回放 (default true, rb-rn-replay-live-
//                               //    chrome-parity)
//       autoFadeGestureHints,  //    3.5s-delay 0.6s-ease-out auto-fade toggle (default false,
//                               //    rb-rn-live-overlay-gesture-hint-autofade — parity iOS/
//                               //    Android/Flutter)
//       onTapPinnedProduct })  // 3. action callback (last, default no-op)
//
// The announce / caption / gesture hints carry no tap intent. The ONLY action is
// the pinned card's tap, which is a host-wired core exit (`simulateProductTap`,
// NOT owned by the shell — the host wires it to core). The surface forwards it
// via `onTapPinnedProduct` and renders correctly with every callback omitted.
//
// One-way data flow: this component reads ONLY its passed-in values and NEVER
// reaches back into PlayerShellModel or DefaultPlayerTemplate (D-1 / D-4).
//
// SNAPSHOT DETERMINISM (parity to the iOS "no ScrollView/Lazy" rule + the
// Roborazzi gotchas): plain `View` / `Text` / `Pressable` only — NO
// `ScrollView` / `FlatList`, NO network-uri `Image`. The announce copy renders
// as a single-line truncated `Text` (the iOS `MarqueeText` first frame is offset
// 0, so the static truncated line IS the deterministic baseline — no animation
// state here). Icons are simple Text glyphs / shaped Views (deterministic). No
// randomness. `autoFadeGestureHints` (rb-rn-live-overlay-gesture-hint-autofade) is the ONE
// opt-in exception — it defaults `false` (render tree byte-identical to the rest of this
// determinism contract) and is never enabled by the structural snapshot test.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Pressable, PanResponder } from 'react-native';
import { Text } from '../TightText';

import { PageDots, clampIndex } from './NowIntroducingCarouselView';
import { MegaphoneGlyph } from './MegaphoneGlyph';
import { RemoteImage } from '../productsheets/RemoteImage';
import { EqualizerGlyph } from '../productsheets/EqualizerGlyph';
import { ProductStatusBadge } from '../productsheets/ProductStatusBadge';
import type { ReferenceUITheme } from '../theme';
import type { LBProduct } from 'livebuy-react-native';
import { LBTestIDs } from '../testing/LBTestIDs';
import { LIVE_BOTTOM_BAR_HEIGHT } from './LiveBottomBarView';

/** Safety clearance (px) kept above `LiveBottomBarView`'s real height when positioning the bottom
 *  row (announce banner + pinned-card carousel) — and, since `PlayerShellView.tsx` imports this
 *  SAME constant for its VOD/replay caption overlay, the second consumer of this exact clearance
 *  semantic (rb-rn-caption-overlay-bottom-bar-clearance-fix). Parity value to iOS
 *  `bottomBarClearanceGap` / Flutter `captionOverlayBottomBarClearanceGap`. `export`ed so
 *  `PlayerShellView.tsx` reuses this ONE constant rather than declaring a second, potentially
 *  drifting copy. */
export const LIVE_BOTTOM_BAR_CLEARANCE_GAP = 12;

const NO_OP = (): void => {};
/** No-op for the id-carrying dismiss callback (default → the close chip is inert;
 *  `_id` underscore-prefixed = intentionally unused, matching the PanResponder `_e` / `_g`). */
const NO_OP_ID = (_id: string): void => {};

// ── Fixed decorative design colors lifted from `live-chrome.jsx` (parity with
//    iOS / Android / Flutter). These are DECORATIVE (dark-glass announce banner) —
//    NOT the resolved theme accent — so they stay constant across themes. ──────

/** Announce banner background (`rgba(0,0,0,0.42)` — flat translucent black, standing in
 *  for the design's `backdropFilter: blur(6px)` glass — rb-rn-live-announce-banner-recolor,
 *  design re-sync R30: repo had never synced this component's colors since it was first
 *  authored 2026-05-29; was `#FFE08A` solid yellow). */
const ANNOUNCE_BG_COLOR = 'rgba(0,0,0,0.42)';
/** Announce icon badge (`#F03246` — brand red used decoratively here). */
const ANNOUNCE_BADGE_COLOR = '#F03246';
/** Announce text color (`#fff` — fixed design white text on the dark-glass background,
 *  rb-rn-live-announce-banner-recolor; was `#15131A` dark text on the old yellow bg). */
const ANNOUNCE_TEXT_COLOR = '#fff';
/** Pinned-card image placeholder fill (`#EFEFF2`). */
const PINNED_IMAGE_PLACEHOLDER = '#EFEFF2';
/** Pinned-card image glyph color (`#C7C7CC`). */
const PINNED_IMAGE_GLYPH = '#C7C7CC';
/** Pinned-card width (rb-rn-vod-live-product-card-restyle, design re-sync R31:
 *  132 → 100 — the RN existing value already equalled the design's PRIOR value, so
 *  the design's new value is used directly, no separate ratio math needed). */
const PINNED_CARD_WIDTH = 100;
/** Pinned-card image-area height (design re-sync R31: 92 → 88; design re-sync R34,
 *  rb-rn-product-detail-image-gallery: 88 → 100 — a SECOND adjustment fixing the aspect ratio
 *  to a square matching `PINNED_CARD_WIDTH`, not a reversal of R31's own size reduction). */
const PINNED_IMAGE_HEIGHT = 100;
/** 「介紹中」底部橫幅底色— fixed coral `rgba(240,50,70,0.7)`, same value as
 *  `ProductListView.tsx`'s narrating-badge background (rb-rn-vod-live-product-card-restyle,
 *  unifying the two「介紹中」visual vocabularies; NOT `ANNOUNCE_BADGE_COLOR`, a distinct
 *  fully-opaque red used by the announce banner icon). */
const NARRATE_BANNER_COLOR = 'rgba(240,50,70,0.7)';
/** Horizontal swipe distance (px) that commits a pinned-card page flip (parity iOS 40). */
const PINNED_SWIPE_DX = 40;
/** Pinned-card sold-out price-line text color (rb-rn-live-pinned-card-soldout-label, color
 *  corrected by rb-rn-live-pinned-card-soldout-label-color-fix): the sold-out-specific
 *  `#9A96A3` used elsewhere in this package (`ProductListView.SOLD_OUT_COLOR` /
 *  `MiniCartPeekView.SOLD_OUT_COLOR` / `ProductDetailSheetView.SOLD_OUT_COLOR`) — matching
 *  iOS's own now-corrected `soldOutColor`. The original landing mistakenly used `#6B6775`
 *  (this package's general dim-text token, e.g. `TEXT_DIM` in `ProductListView.tsx` — used for
 *  struck-through original price etc, not sold-out labels). */
const SOLD_OUT_TEXT_COLOR = '#9A96A3';

// Static localized copy (matching iOS `LiveOverlayChromeView` + `LBPGestureHint`).
/** Host caption label ("主持人"). */
const HOST_CAPTION_LABEL = '主持人';
/** Narrate-tag copy shown on the pinned card. Fixed literal — always「介紹中」，不受任何搶購場
 *  旗標影響（撤回 rb-rn-flash-sale-live-signal-wiring 的「開標中」二選一變體，
 *  rb-rn-narrating-banner-revert-flash-sale-text，2026-09-09 使用者拍板）。 */
const NARRATE_TAG_TEXT = '介紹中';
/** Sold-out price-line label ("已售完", rb-rn-live-pinned-card-soldout-label). */
const SOLD_OUT_LABEL = '已售完';
/** Gesture-hint copy (static localized presentation strings). */
// rb-rn-gesture-clean-mode-v2 (design R29): a short tap now unconditionally toggles「乾淨模式」
// (replacing the R23 mute-toggle semantics this copy used to describe) — fixed to a single
// constant since the new behaviour no longer differs by LIVE/VOD (this component only ever
// renders while genuinely live, see the file header's HOLD-HINT note below, but the copy itself
// is written mode-agnostic to match the Requirement's wording).
const HINT_TAP = '點擊畫面 = 切換乾淨模式';
// HOLD-HINT (rb-rn-gesture-clean-mode-v2 introduced the R29 long-press semantics; RESTORED by
// rb-rn-replay-live-chrome-parity): the R23 long-press-toggles-cleanMode copy this line used to
// hold under R23 is retired — R29's long-press instead starts a 2x-speed seek ONLY while
// `isSeekable` (VOD / finished-live replay). Until `rb-rn-replay-live-chrome-parity`, this
// component was composed ONLY on the `model.isLive === true` branch of `PlayerShellView` (a
// finished-live replay rendered the VOD-side `NowIntroducingCarousel` chrome instead), so
// `isSeekable` was UNCONDITIONALLY `false` in every context this component ever rendered in and
// the hint pill was removed entirely (see that change's design.md Decision D7) rather than gated
// on a prop that would always evaluate to "don't show". `rb-rn-replay-live-chrome-parity` unified
// `PlayerShellView`'s Surface 4 branch to `usesLiveChrome` (真直播 OR 已結束直播回放), so this
// component now ALSO renders for a finished-live replay — where `isSeekable` genuinely is `true`
// and long-press really does start a 2x-speed seek (`handleVideoLongPress`, gated on
// `isSeekable(...)` in `PlayerShellView.tsx`). `HINT_HOLD` restores this line, gated on the new
// `isLive` prop below (`isLive === false` — see `gestureHints`).
const HINT_HOLD = '長按畫面 = 2倍速快轉';
const HINT_SWIPE = '上下滑動 = 切換影片';

/** Props for the family-1 LIVE overlay chrome surface (SUB-VIEW INPUT PATTERN). */
export interface LiveOverlayChromeProps {
  /** The resolved reference-ui theme (first, always). */
  readonly theme: ReferenceUITheme;
  /**
   * Announcement banner copy (`LBLiveAnnounce`). Source:
   * `PlayerShellModel.announceText` (← `noticeTab.notice`). Empty → omitted.
   */
  readonly announceText: string;
  /**
   * The LIVE pinned narrating product(s) (`LBLivePinnedCard`). Source:
   * `PlayerShellModel.livePinnedProducts` (← template `liveActiveProducts`, ALL
   * `narrate_status == 2`; ELSE the single `pinnedProduct` = `activeProduct` ?? first
   * `isHot == 1`, as a 1-element list). Empty → no card; exactly 1 → single card (現狀,
   * host tree byte-identical); > 1 → 目前卡 + 分頁點 carousel (問題 7,
   * rb-rn-live-now-introducing-carousel).
   */
  readonly pinnedProducts: readonly LBProduct[];
  /**
   * Host caption copy (`LBLiveHostCaption`). There is NO public host-caption
   * view-model on the template (see `PlayerShellModel` GAP NOTE) — host-supplied
   * STATIC string. Empty / omitted → the caption overlay is omitted.
   */
  readonly hostCaption?: string;
  /**
   * Whether to draw the static gesture-hint pills (`LBPGestureHint`). Pure
   * presentation copy — no view-model binding. Defaults to `true`.
   */
  readonly showGestureHints?: boolean;
  /**
   * LIVE vs 已結束直播回放 flag (`rb-rn-replay-live-chrome-parity`, parity iOS
   * `LiveOverlayChromeView.isLive`). This component renders on `PlayerShellView`'s
   * `usesLiveChrome` branch (`model.isLive || model.isFinishedLiveReplay`) — `isLive` narrows
   * WHICH of those two sub-states is active, driving two behaviors: (1) the long-press
   * 2倍速快轉 gesture hint (`HINT_HOLD`) shows ONLY when `isLive === false` (已結束直播回放, where
   * long-press genuinely starts a 2x-speed seek — see `HINT_HOLD`'s own doc comment); (2)
   * {@link isNarrating} treats every pinned product as narrating when `isLive === false` (its
   * source, `PlayerShellModel.vodActiveProducts`, is already time-window-filtered — see that
   * function's doc). Default **`true`** — every existing call site (which predates this prop,
   * and only ever rendered while genuinely live) keeps its exact prior behavior:
   * structural-snapshot byte-identical, no hold-hint line, `narrateStatus === 2` still gates
   * the 介紹中 ribbon.
   */
  readonly isLive?: boolean;
  /**
   * Auto-fade the gesture-hint pills to fully transparent 3.5s after they appear (0.6s ease-out),
   * parity iOS `LiveOverlayChromeView.swift:124,189,216-224` / Android `LiveOverlayChrome.kt`
   * (`rb-android-live-overlay-gesture-hint-autofade`) / Flutter `live_overlay_chrome_view.dart`
   * (`rb-flutter-live-overlay-gesture-hint-autofade`). Defaults to `false` (existing behaviour:
   * the hints stay fully opaque forever, no timer/animation side effect — reference-ui baseline
   * byte-identical). `true` mirrors `live` (demo/snapshot placeholder vs real content) — NOT
   * {@link isLive} (a different, orthogonal flag that answers "genuinely live vs a finished
   * replay", not "demo data vs real runtime data" — a real, running finished-live replay has
   * `isLive === false` yet is by no means a snapshot/demo instance, so feeding `isLive` here
   * would wrongly suppress the auto-fade for that real-runtime case — rb-rn-live-overlay-
   * gesture-hint-autofade design.md D2, reaffirmed by `rb-rn-replay-live-chrome-parity`).
   */
  readonly autoFadeGestureHints?: boolean;
  /**
   * Live-runtime image gate (parity iOS/Android `live` — `!paintsBackgroundPlaceholder`).
   * `true` → the pinned card loads the real product photo via `RemoteImage`; `false`
   * (demo / snapshot — DEFAULT) → the deterministic placeholder shows (no `<Image>`,
   * baseline byte-stable). live-pinned-card-image-radius.
   */
  readonly live?: boolean;
  /**
   * Pinned-card body tap. NO-ARG (cannot carry the tapped product) — the turnkey
   * container routes it, via `PlayerShellView.onOpenProduct`, to opening the product
   * LIST overlay, NOT a per-product detail sheet. Omitted → no-op (snapshot-safe).
   */
  readonly onTapPinnedProduct?: () => void;
  /**
   * Host-wired pinned-card CLOSE (右上角 X). Carries the dismissed product id →
   * `PlayerShellView` hides it locally, per-product-id (mirroring the VOD now-introducing
   * `onDismiss` / `dismissedVodIds`). Omitted → the close chip is inert (snapshot-safe). The
   * close chip is a NESTED Pressable that INTERCEPTS the tap so the outer card Pressable
   * (`onTapPinnedProduct` / open-detail) does NOT also fire — RN nested-Pressable event
   * consumption, parity VOD `MiniCartPeek` close `e.stopPropagation()` + iOS/Android
   * rb-*-live-pinned-card-dismiss. rb-rn-live-pinned-card-dismiss.
   */
  readonly onDismissPinnedProduct?: (id: string) => void;
  /**
   * Host-wired announce-banner tap → opens the VideoInfoPanel notice tab (PlayerShellView wires
   * `selectInfoTab(Notice)` + `setInfoPanelOpen(true)`). Omitted → the banner is inert
   * (snapshot-safe). live-announce-tap-open-info-panel.
   */
  readonly onTapAnnounce?: () => void;
  /**
   * Extra bottom lift (px) applied to the bottom row (announce banner + pinned-card carousel)
   * during the playback-progress bar's post-release hold window, so it clears the still-expanded
   * transport bar (rb-rn-scrub-expanded-chrome-lift, parity iOS `LiveOverlayChromeView.bottomInset`
   * / Android `LiveOverlayChrome.bottomInset`). `PlayerShellView` feeds its own `scrubChromeLift`
   * here. Default `0` (existing behaviour: the bottom row stays anchored at `bottom:
   * LIVE_BOTTOM_BAR_HEIGHT + LIVE_BOTTOM_BAR_CLEARANCE_GAP` — `72` — baseline byte-identical).
   * That base `bottom` value is itself derived from `LiveBottomBarView.LIVE_BOTTOM_BAR_HEIGHT`
   * (the bar's real rendered height, single source of truth) plus `LIVE_BOTTOM_BAR_CLEARANCE_GAP`
   * (this file's own safety gap constant) — it is NO LONGER the hard-coded literal `64` that was
   * zero-coupled to `LiveBottomBarView`'s actual layout (rb-rn-caption-overlay-bottom-bar-clearance-fix).
   */
  readonly bottomInset?: number;
}

/**
 * The family-1 LIVE overlay chrome surface. Paints the announcement banner,
 * pinned narrating-product card, host caption, and static gesture hints over the
 * (host-supplied) video area, themed by the resolved {@link ReferenceUITheme}.
 *
 * Renders correctly with all callbacks omitted (structural snapshot tests
 * construct it action-free).
 */
export function LiveOverlayChrome(props: LiveOverlayChromeProps): ReactElement {
  const {
    theme,
    announceText,
    pinnedProducts,
    hostCaption = '',
    showGestureHints = true,
    isLive = true,
    autoFadeGestureHints = false,
    live = false,
    onTapPinnedProduct = NO_OP,
    onDismissPinnedProduct = NO_OP_ID,
    onTapAnnounce = NO_OP,
    bottomInset = 0,
  } = props;

  // Full-bleed overlay. Affordances are positioned with absolute placement so the
  // layout matches `live-chrome.jsx`'s absolute positioning (parity to the iOS
  // ZStack / Android Box / Flutter Stack). The caption + gesture hints carry no
  // tap intent (design: pointerEvents: none) so they are non-interactive Views.
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Centered host caption (~46% from the top — `LBLiveHostCaption`). */}
      {hostCaption.length > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 12,
            right: 12,
            justifyContent: 'center',
          }}
        >
          {hostCaptionOverlay(theme, hostCaption)}
        </View>
      ) : null}

      {/* Centered static gesture hints (`LBPGestureHint`). */}
      {showGestureHints ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FadingGestureHints autoFade={autoFadeGestureHints}>{gestureHints(theme, isLive)}</FadingGestureHints>
        </View>
      ) : null}

      {/*
        Bottom row: announce banner (left) + pinned card (right).
        `live-chrome.jsx`: announce `left:8 right:120 bottom:70`,
        pinned card `right:8 bottom:64 width:132`.
        right:10 (was 8) aligns the pinned card's right edge with LiveBottomBarView's
        heart-icon right edge (BAR_H_PADDING=10) — rb-rn-live-chat-card-edge-align
        (parity iOS `right: 8` -> `.padding(.trailing, 10)`). left:8 unchanged — the
        announce banner's `maxWidth: 265` clamp derives from left:8/right:120, not this value.
      */}
      <View
        style={{
          position: 'absolute',
          left: 8,
          right: 10,
          // Base clearance is `LIVE_BOTTOM_BAR_HEIGHT + LIVE_BOTTOM_BAR_CLEARANCE_GAP` (= 72) —
          // the bar's real rendered height (single source of truth) plus an explicit safety gap,
          // NOT a hard-coded literal `64` zero-coupled to LiveBottomBarView's actual layout
          // (rb-rn-caption-overlay-bottom-bar-clearance-fix). `bottomInset` (default 0, additive)
          // lifts this row further clear of the still-expanded playback-progress transport bar
          // during its post-release hold window (rb-rn-scrub-expanded-chrome-lift, parity
          // iOS/Android `bottomInset`).
          bottom: LIVE_BOTTOM_BAR_HEIGHT + LIVE_BOTTOM_BAR_CLEARANCE_GAP + bottomInset,
          flexDirection: 'row',
          alignItems: 'flex-end',
        }}
      >
        {announceText.length > 0 ? announceBanner(theme, announceText, onTapAnnounce) : null}
        <View style={{ flex: 1 }} />
        <PinnedCardCarousel
          theme={theme}
          products={pinnedProducts}
          live={live}
          isLive={isLive}
          onTap={onTapPinnedProduct}
          onDismiss={onDismissPinnedProduct}
        />
      </View>
    </View>
  );
}

// ── LBLivePinnedCard carousel — single card OR multi-product carousel + 分頁點 ──

/**
 * The bottom-right pinned narrating-product carousel. `products`:
 *   • 0      → renders nothing (`null`).
 *   • 1      → the single card (NO PanResponder / 分頁點 wrapper — the host tree is
 *              byte-identical to the prior single-`pinnedProduct` render so existing
 *              snapshot baselines stay byte-stable).
 *   • > 1    → 分頁點 (above the card) + the current card + horizontal swipe to change page.
 *
 * Swipe direction gate: only a horizontal drag (`|dx| > |dy|`) flips the page; a vertical
 * drag falls through to the outer prev/next video swipe. Tapping a page dot jumps to it.
 * The card tap forwards via `onTap` (host-wired core exit — the shell never opens product
 * detail itself). Mirrors iOS `LiveOverlayChromeView.pinnedCardCarousel` / Android
 * `PinnedProductCarousel`. (問題 7, rb-rn-live-now-introducing-carousel).
 */
function PinnedCardCarousel(props: {
  theme: ReferenceUITheme;
  products: readonly LBProduct[];
  live: boolean;
  isLive: boolean;
  onTap: () => void;
  onDismiss: (id: string) => void;
}): ReactElement | null {
  const { theme, products, live, isLive, onTap, onDismiss } = props;
  const [index, setIndex] = useState(0);

  // Refs so the once-created PanResponder reads the current index / length without stale
  // closures (parity with NowIntroducingCarouselView's pan refs).
  const indexRef = useRef(index);
  indexRef.current = index;
  const lenRef = useRef(products.length);
  lenRef.current = products.length;

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 6,
      onPanResponderRelease: (_e, g) => {
        const cur = clampIndex(indexRef.current, lenRef.current);
        if (g.dx < -PINNED_SWIPE_DX) setIndex(clampIndex(cur + 1, lenRef.current));
        else if (g.dx > PINNED_SWIPE_DX) setIndex(clampIndex(cur - 1, lenRef.current));
      },
    }),
  ).current;

  // Empty → nothing (the bottom row's spacer keeps the announce banner left-anchored).
  if (products.length === 0) return null;

  const i = clampIndex(index, products.length);
  const product = products[i]!;

  // Exactly one product → the single card, NO carousel wrapper (host tree byte-identical to the
  // prior single-`pinnedProduct` render). Index state / PanResponder above are created
  // unconditionally (rules of hooks) but unused here.
  if (products.length === 1) {
    return pinnedCard(theme, product, live, isLive, onTap, onDismiss);
  }

  // > 1 → 分頁點 (above, trailing-aligned over the 132-wide card) + current card + horizontal swipe.
  return (
    <View testID={LBTestIDs.pinnedCarousel} {...responder.panHandlers} style={{ alignItems: 'flex-end' }}>
      <PageDots
        theme={theme}
        count={products.length}
        current={i}
        onSelect={setIndex}
        testIDPrefix="live-pinned-dot"
      />
      <View style={{ height: 6 }} />
      {pinnedCard(theme, product, live, isLive, onTap, onDismiss)}
    </View>
  );
}

// ── LBLiveAnnounce — announcement banner ────────────────────────────────────

/**
 * Bottom-left dark-glass announcement banner with a red icon badge and single-line
 * truncated copy. Mirrors `LBLiveAnnounce` (`rgba(0,0,0,0.42)` flat translucent bg —
 * standing in for the design's `backdropFilter: blur(6px)`, `#F03246` icon badge,
 * `#fff` white text — rb-rn-live-announce-banner-recolor). The iOS `MarqueeText`
 * first frame is offset 0 — the static truncated line is the deterministic baseline
 * (no animation here).
 */
function announceBanner(theme: ReferenceUITheme, text: string, onTap: () => void = NO_OP): ReactElement {
  return (
    // Tappable → host-wired navigation that opens the VideoInfoPanel notice tab
    // (live-announce-tap-open-info-panel); inert when onTap is the default no-op.
    <Pressable
      testID={LBTestIDs.announceBanner}
      onPress={() => onTap()}
      style={{
        // design LBLiveAnnounce left:8 right:120 on the 393 frame = 393 − 8 − 120 = 265
        // (iOS / Android parity). The left:8 inset is supplied by the overlay padding.
        maxWidth: 265,
        backgroundColor: ANNOUNCE_BG_COLOR,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Red icon badge (`#F03246`, 22×22, radius 5) — self-drawn bullhorn vector glyph
          (`MegaphoneGlyph`, `design/shared/icons.jsx` `Icons.megaphone`, rb-rn-live-announce-
          bullhorn-icon), replacing the prior emoji placeholder (`'\u{1F4E2}'` 📢). */}
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          backgroundColor: ANNOUNCE_BADGE_COLOR,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MegaphoneGlyph color="#FFFFFF" size={13} />
      </View>
      {/* Announce copy (up to 2 lines, ellipsis-truncated beyond — `LBPMarqueeText` static
          frame; rb-rn-live-announce-two-line-clearance-fix, parity design/iOS/Android/Flutter). */}
      <Text
        numberOfLines={2}
        ellipsizeMode="tail"
        style={{
          marginLeft: 8,
          flexShrink: 1,
          color: ANNOUNCE_TEXT_COLOR,
          fontSize: 10.5 * theme.fontScale,
          fontWeight: '600',
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}

// ── LBLivePinnedCard — pinned narrating-product card ────────────────────────

/**
 * Bottom-right white product card for the single narrating product. Mirrors
 * `LBLivePinnedCard`: image area + a dismissible close chip, accent narrate
 * tag (when narrating), 1-line name, accent live price. Card-body tap forwards to
 * `onTapPinnedProduct` (no-arg; the turnkey container opens the product LIST); the close chip is a
 * nested Pressable that consumes its tap and forwards `onDismiss(product.id)` WITHOUT
 * bubbling to the card body (rb-rn-live-pinned-card-dismiss).
 */
function pinnedCard(
  theme: ReferenceUITheme,
  product: LBProduct,
  live: boolean,
  isLive: boolean,
  onTap: () => void,
  onDismiss: (id: string) => void,
): ReactElement {
  // 售完商品的價格欄顯示「已售完」，取代價格（rb-rn-live-pinned-card-soldout-label，parity iOS
  // rb-ios-live-pinned-card-soldout-label）。沿用單一真相來源 ProductStatusBadge（同一判斷已用於
  // ProductListView.tsx），不新建繞過它的 raw `product.soldOut === 1` 判斷。與卡片是否出現 / 「介紹中」
  // ribbon 是否顯示正交——皆不受此影響。
  const soldOut = ProductStatusBadge.resolve(product) === ProductStatusBadge.SoldOut;
  return (
    <Pressable
      testID={LBTestIDs.pinnedCard}
      onPress={onTap}
      style={{
        width: PINNED_CARD_WIDTH,
        backgroundColor: '#FFFFFF',
        // 4a: borderRadius 10 + overflow hidden clips the whole card (incl. the top image
        // area's corners) to the rounded shape — the image corners follow the card radius.
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {/* Image area (design height 88, rb-rn-vod-live-product-card-restyle — was 92).
          Themed placeholder so the baseline is deterministic without a network image; the
          REAL product image loads OVER it at runtime (`live` + a non-empty URL) via
          `RemoteImage` (live-pinned-card-image-radius). */}
      <View style={{ height: PINNED_IMAGE_HEIGHT, backgroundColor: PINNED_IMAGE_PLACEHOLDER }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, color: PINNED_IMAGE_GLYPH }}>{'\u{1F5BC}'}</Text>
        </View>
        {/* Real product photo over the placeholder at runtime. `live === false` (snapshot)
            → RemoteImage renders null → placeholder baseline byte-identical. */}
        <RemoteImage live={live} uri={imageURL(product)} resizeMode="cover" />
        {/* 「介紹中」標籤（rb-rn-vod-live-product-card-restyle，design re-sync R31）：由縮圖下方
            的小字列改為疊在縮圖底部的滿版色塊——固定珊瑚紅底、白字，對齊 `LBPProductRow` 的
            「介紹中」橫幅視覺語彙（同一色值 `NARRATE_BANNER_COLOR`）。取代原本畫在下方 padding
            區塊內、`theme.accent` 圖示+文字的小字列。 */}
        {isNarrating(product, isLive) ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: NARRATE_BANNER_COLOR,
              paddingVertical: 3,
              paddingHorizontal: 4,
            }}
          >
            <EqualizerGlyph size={9} color="#FFFFFF" />
            <Text
              style={{
                marginLeft: 3,
                color: '#FFFFFF',
                fontSize: 12 * theme.fontScale,
                fontWeight: '700',
              }}
            >
              {NARRATE_TAG_TEXT}
            </Text>
          </View>
        ) : null}
        {/* Close affordance chip — a NESTED Pressable that dismisses THIS product WITHOUT
            opening the detail: its own onPress consumes the tap so the outer card Pressable
            (`onTap` / open-detail) does not also fire (RN nested-Pressable event consumption,
            parity VOD `MiniCartPeek` close `e.stopPropagation()`). rb-rn-live-pinned-card-dismiss.
            style 原樣照搬（只把承載元素 View → Pressable，像素中立）。 */}
        <Pressable
          testID={LBTestIDs.pinnedCardClose}
          onPress={() => onDismiss(product.id)}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: 4,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 11, color: '#FFFFFF', fontWeight: '700' }}>{'×'}</Text>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8 }}>
        {/* Product name (rb-rn-vod-live-product-card-restyle: 2-line clamp, 10pt — was
            1-line/11pt; the narrate tag that used to render here moved onto the thumbnail
            as a bottom banner, see above). */}
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          style={{
            color: theme.text,
            fontSize: 10 * theme.fontScale,
            fontWeight: '600',
          }}
        >
          {product.name}
        </Text>
        {/* Live price (accent) — or 「已售完」(dim) when sold out
            (rb-rn-live-pinned-card-soldout-label, parity iOS textDim semibold/dim). `priceShow`
            is the pre-formatted string. */}
        <Text
          style={{
            marginTop: 3,
            color: soldOut ? SOLD_OUT_TEXT_COLOR : theme.accent,
            fontSize: 13 * theme.fontScale,
            fontWeight: soldOut ? '700' : '800',
          }}
        >
          {soldOut ? SOLD_OUT_LABEL : livePriceText(product)}
        </Text>
      </View>
    </Pressable>
  );
}

// ── LBLiveHostCaption — centered host caption overlay ───────────────────────

/**
 * Centered white-on-dark host caption (`LBLiveHostCaption`). Translucent dark
 * card with a "主持人" label + the host caption copy (2-line clamp).
 */
function hostCaptionOverlay(theme: ReferenceUITheme, caption: string): ReactElement {
  return (
    <View
      style={{
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          color: 'rgba(255,255,255,0.78)',
          fontSize: 11 * theme.fontScale,
          fontWeight: '600',
        }}
      >
        {HOST_CAPTION_LABEL}
      </Text>
      <Text
        numberOfLines={2}
        ellipsizeMode="tail"
        style={{
          marginTop: 2,
          color: '#FFFFFF',
          fontSize: 12 * theme.fontScale,
          fontWeight: '600',
        }}
      >
        {caption}
      </Text>
    </View>
  );
}

// ── LBPGestureHint — centered static gesture hints ──────────────────────────

/** Delay (ms) before the gesture-hint pills start fading out, when `autoFade` (rb-rn-live-overlay-
 *  gesture-hint-autofade). Parity iOS `.delay(3.5)` / Android `delay(3500)` / Flutter
 *  `Timer(const Duration(milliseconds: 3500))`. */
const GESTURE_HINT_FADE_DELAY_MS = 3500;
/** Fade-out animation duration (ms), when `autoFade`. Parity iOS `.easeOut(duration: 0.6)` /
 *  Android `tween(durationMillis = 600, easing = LinearOutSlowInEasing)` / Flutter
 *  `AnimatedOpacity(duration: const Duration(milliseconds: 600), curve: Curves.easeOut)`. */
const GESTURE_HINT_FADE_DURATION_MS = 600;

/**
 * Locally-scoped fade-out timer / animation wrapper for the gesture-hint pill group
 * (`autoFadeGestureHints`, parity iOS `LiveOverlayChromeView.swift:124,189,216-224` / Android
 * `LiveOverlayChrome.kt:179,247,626-639` / Flutter `_FadingGestureHints`). `LiveOverlayChrome`
 * itself stays a plain function-driven render — this is the ONE component in this file that needs
 * a hook, mirroring `HeartBurst.tsx`'s precedent of localizing short-lived animation state to the
 * smallest necessary scope instead of upgrading the whole surface.
 *
 * `autoFade === false` (default) returns `children` UNCHANGED — no `Animated.View` / `setTimeout`
 * / `Animated.Value` is ever constructed — so the render tree SHAPE (and therefore the existing
 * byte-identical `toMatchSnapshot()` baseline) is unaffected. `autoFade === true` starts a one-shot
 * `setTimeout` (`GESTURE_HINT_FADE_DELAY_MS`); once it fires, `Animated.timing` fades the wrapping
 * `Animated.View`'s opacity to 0 over `GESTURE_HINT_FADE_DURATION_MS` with an ease-out curve,
 * matching iOS / Android / Flutter 1:1. The delay is a plain `setTimeout` (not `Animated.timing`'s
 * own `delay` config) so the two phases ("still opaque" vs "fading") are independently observable
 * under `jest.useFakeTimers()` — this package's jest `Animated.timing` mock stubs `.start()` to
 * complete SYNCHRONOUSLY regardless of its config, so a single delayed `Animated.timing` call would
 * be indistinguishable from an immediate one under test. Mirrors `HeartBurst.tsx`'s existing
 * "`setTimeout` owns the timeline, `Animated.timing` owns the visual interpolation" split.
 */
function FadingGestureHints(props: {
  autoFade: boolean;
  children: ReactElement;
}): ReactElement {
  const { autoFade, children } = props;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!autoFade) return;
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: GESTURE_HINT_FADE_DURATION_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, GESTURE_HINT_FADE_DELAY_MS);
    return (): void => clearTimeout(timer);
  }, [autoFade, opacity]);

  if (!autoFade) return children;
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

/**
 * Centered dark hint pills (`LBPGestureHint`): tap-to-toggle-clean-mode, (已結束直播回放限定)
 * long-press-2x-speed-seek, swipe-to-switch. The hold-hint pill (`HINT_HOLD`) is included ONLY
 * when `isLive === false` — restored by `rb-rn-replay-live-chrome-parity` (see `HINT_HOLD`'s own
 * doc comment for why it was previously removed entirely and why that's no longer correct now
 * that this component also renders for a finished-live replay). `isLive === true` (真直播,
 * default) keeps the prior two-line, byte-identical shape. Pure static localized copy. Wrapped by
 * {@link FadingGestureHints} at the call site for the optional `autoFadeGestureHints` auto-fade
 * (rb-rn-live-overlay-gesture-hint-autofade).
 */
function gestureHints(theme: ReferenceUITheme, isLive: boolean): ReactElement {
  return (
    <View style={{ alignItems: 'center' }}>
      {gestureHintPill(theme, '\u{1F446}', HINT_TAP)}
      {!isLive ? (
        <>
          <View style={{ height: 8 }} />
          {gestureHintPill(theme, '✋', HINT_HOLD)}
        </>
      ) : null}
      <View style={{ height: 8 }} />
      {gestureHintPill(theme, '↕', HINT_SWIPE)}
    </View>
  );
}

function gestureHintPill(
  theme: ReferenceUITheme,
  glyph: string,
  text: string,
): ReactElement {
  return (
    <View
      style={{
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 14, color: '#FFFFFF' }}>{glyph}</Text>
      <Text
        style={{
          marginLeft: 8,
          color: '#FFFFFF',
          fontSize: 11 * theme.fontScale,
          fontWeight: '500',
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// ── Design tokens / derived copy (pure) ─────────────────────────────────────

/**
 * Filter the pinned products by the locally-dismissed id array — the decision behind the
 * LIVE pinned-card close (rb-rn-live-pinned-card-dismiss). `dismissedIds` empty → returns
 * `products` as-is (guarantees the default path is byte-identical / structural-snapshot safe).
 * Mirrors iOS `LiveOverlayChromeView.visiblePinnedProducts` / Android `visiblePinnedProducts`
 * + the VOD now-introducing dismiss filter. Type is `readonly string[]` (NOT a Set) to mirror
 * the existing RN `dismissedVodIds` idiom. Pure.
 */
export function visiblePinnedProducts(
  products: readonly LBProduct[],
  dismissedIds: readonly string[],
): readonly LBProduct[] {
  return dismissedIds.length === 0 ? products : products.filter((p) => !dismissedIds.includes(p.id));
}

/**
 * The pinned product is "narrating" when `narrateStatus === 2` (core convention) — but ONLY
 * when the pinned card comes from a genuinely-live source (`isLive === true`, `pinnedProducts`
 * fed from `PlayerShellModel.livePinnedProducts`). `rb-rn-replay-live-chrome-parity`:
 * `isLive === false`（已結束直播回放，`pinnedProducts` 改餵 `PlayerShellModel.vodActiveProducts`）
 * 一律回傳 `true` — `narrate_status` 是主播直播中手動驅動的狀態機，直播結束後即凍結在最後一個值，
 * 對這個來源沒有可用語意；`vodActiveProducts` 本身已經是時間窗 `[beginTime, endTime)` 篩選過的清單，
 * 篩進來的每一件本來就該視為「介紹中」。Parity iOS/Android/Flutter 同名函式。Pure.
 */
function isNarrating(product: LBProduct, isLive: boolean): boolean {
  return isLive ? product.narrateStatus === 2 : true;
}

/**
 * The pinned card's product image URL (`photos[0] ?? pic`). `RemoteImage` trims it and gates
 * on emptiness, so this only needs to pick the first photo or fall back to `pic`. Parity iOS
 * `LiveOverlayChromeView.imageURL`. Pure.
 */
function imageURL(product: LBProduct): string {
  return product.photos.length > 0 ? product.photos[0]! : product.pic;
}

/**
 * The live-price label. Prefers the pre-formatted `priceShow`; falls back to
 * `NT$ <price>` when the show string is empty. RN `LBProduct.price` is a STRING
 * (JS Number-precision rule — no `.toInt()`), so the fallback uses it as-is.
 * Pure.
 */
function livePriceText(product: LBProduct): string {
  const show = product.priceShow.trim();
  if (show.length > 0) return show;
  const price = product.price.trim();
  return `NT$ ${price.length > 0 ? price : '0'}`;
}

export default LiveOverlayChrome;
