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
//   • LBLiveAnnounce    — announcement banner (bottom-left, yellow).
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
//       pinnedProducts,        //    (by value, from PlayerShellModel.livePinnedProducts)
//       hostCaption,           //    host-supplied static copy (GAP NOTE)
//       showGestureHints,      //    static presentation toggle
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
// randomness.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactElement } from 'react';
import { useRef, useState } from 'react';
import { View, Pressable, PanResponder } from 'react-native';
import { Text } from '../TightText';

import { PageDots, clampIndex } from './NowIntroducingCarouselView';
import { RemoteImage } from '../productsheets/RemoteImage';
import type { ReferenceUITheme } from '../theme';
import type { LBProduct } from 'livebuy-react-native';
import { LBTestIDs } from '../testing/LBTestIDs';

const NO_OP = (): void => {};
/** No-op for the id-carrying dismiss callback (default → the close chip is inert;
 *  `_id` underscore-prefixed = intentionally unused, matching the PanResponder `_e` / `_g`). */
const NO_OP_ID = (_id: string): void => {};

// ── Fixed decorative design hexes lifted from `live-chrome.jsx` (parity with
//    iOS / Android / Flutter). These are DECORATIVE (yellow announce banner) —
//    NOT the resolved theme accent — so they stay constant across themes. ──────

/** Announce banner background (`#FFE08A`). */
const ANNOUNCE_BG_COLOR = '#FFE08A';
/** Announce icon badge (`#F03246` — brand red used decoratively here). */
const ANNOUNCE_BADGE_COLOR = '#F03246';
/** Announce text color (`#15131A` — fixed design dark text on yellow). */
const ANNOUNCE_TEXT_COLOR = '#15131A';
/** Pinned-card image placeholder fill (`#EFEFF2`). */
const PINNED_IMAGE_PLACEHOLDER = '#EFEFF2';
/** Pinned-card image glyph color (`#C7C7CC`). */
const PINNED_IMAGE_GLYPH = '#C7C7CC';
/** Horizontal swipe distance (px) that commits a pinned-card page flip (parity iOS 40). */
const PINNED_SWIPE_DX = 40;

// Static localized copy (matching iOS `LiveOverlayChromeView` + `LBPGestureHint`).
/** Host caption label ("主持人"). */
const HOST_CAPTION_LABEL = '主持人';
/** Narrate-tag copy shown on the pinned card ("介紹中"). */
const NARRATE_TAG_TEXT = '介紹中';
/** Gesture-hint copy (static localized presentation strings). */
// rb-rn-gesture-clean-mode-v2 (design R29): a short tap now unconditionally toggles「乾淨模式」
// (replacing the R23 mute-toggle semantics this copy used to describe) — fixed to a single
// constant since the new behaviour no longer differs by LIVE/VOD (this component only ever
// renders while genuinely live, see the file header's HOLD-HINT note below, but the copy itself
// is written mode-agnostic to match the Requirement's wording).
const HINT_TAP = '點擊畫面 = 切換乾淨模式';
// HOLD-HINT REMOVED (rb-rn-gesture-clean-mode-v2): the R23 long-press-toggles-cleanMode copy this
// constant used to hold is retired — R29's long-press instead starts a 2x-speed seek ONLY while
// `isSeekable` (VOD / finished-live replay). This component is composed ONLY on the
// `model.isLive === true` branch of `PlayerShellView` (see that file's render body — a finished-
// live replay renders the VOD-side `NowIntroducingCarousel` chrome instead, an existing RN/iOS
// architecture divergence, see this change's design.md Context), so `isSeekable` is UNCONDITIONALLY
// `false` in every context this component ever renders in. Showing ANY long-press hint here would
// therefore always describe a gesture that structurally cannot fire — so the hint pill (and its
// backing string constant) is removed entirely rather than gated on a prop that would always
// evaluate to "don't show" (see design.md Decision D7).
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
    live = false,
    onTapPinnedProduct = NO_OP,
    onDismissPinnedProduct = NO_OP_ID,
    onTapAnnounce = NO_OP,
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
          {gestureHints(theme)}
        </View>
      ) : null}

      {/*
        Bottom row: announce banner (left) + pinned card (right).
        `live-chrome.jsx`: announce `left:8 right:152 bottom:70`,
        pinned card `right:8 bottom:64 width:132`.
        right:10 (was 8) aligns the pinned card's right edge with LiveBottomBarView's
        heart-icon right edge (BAR_H_PADDING=10) — rb-rn-live-chat-card-edge-align
        (parity iOS `right: 8` -> `.padding(.trailing, 10)`). left:8 unchanged — the
        announce banner's `maxWidth: 233` clamp derives from left:8/right:152, not this value.
      */}
      <View
        style={{
          position: 'absolute',
          left: 8,
          right: 10,
          bottom: 64,
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
  onTap: () => void;
  onDismiss: (id: string) => void;
}): ReactElement | null {
  const { theme, products, live, onTap, onDismiss } = props;
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
    return pinnedCard(theme, product, live, onTap, onDismiss);
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
      {pinnedCard(theme, product, live, onTap, onDismiss)}
    </View>
  );
}

// ── LBLiveAnnounce — announcement banner ────────────────────────────────────

/**
 * Bottom-left yellow announcement banner with a red icon badge and single-line
 * truncated copy. Mirrors `LBLiveAnnounce` (`#FFE08A` bg, `#F03246` icon badge,
 * `#15131A` dark text). The iOS `MarqueeText` first frame is offset 0 — the
 * static truncated line is the deterministic baseline (no animation here).
 */
function announceBanner(theme: ReferenceUITheme, text: string, onTap: () => void = NO_OP): ReactElement {
  return (
    // Tappable → host-wired navigation that opens the VideoInfoPanel notice tab
    // (live-announce-tap-open-info-panel); inert when onTap is the default no-op.
    <Pressable
      testID={LBTestIDs.announceBanner}
      onPress={() => onTap()}
      style={{
        // design LBLiveAnnounce left:8 right:152 on the 393 frame = 393 − 8 − 152 = 233
        // (iOS / Android parity). The left:8 inset is supplied by the overlay padding.
        maxWidth: 233,
        backgroundColor: ANNOUNCE_BG_COLOR,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Red icon badge (`#F03246`, 22×22, radius 5) — megaphone glyph. */}
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
        <Text style={{ fontSize: 12, color: '#FFFFFF' }}>{'\u{1F4E2}'}</Text>
      </View>
      {/* Announce copy (single-line truncated — `LBPMarqueeText` static frame). */}
      <Text
        numberOfLines={1}
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
  onTap: () => void,
  onDismiss: (id: string) => void,
): ReactElement {
  return (
    <Pressable
      testID={LBTestIDs.pinnedCard}
      onPress={onTap}
      style={{
        width: 132,
        backgroundColor: '#FFFFFF',
        // 4a: borderRadius 10 + overflow hidden clips the whole card (incl. the top image
        // area's corners) to the rounded shape — the image corners follow the card radius.
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {/* Image area (design height 92). Themed placeholder so the baseline is
          deterministic without a network image; the REAL product image loads OVER it at
          runtime (`live` + a non-empty URL) via `RemoteImage` (live-pinned-card-image-radius). */}
      <View style={{ height: 92, backgroundColor: PINNED_IMAGE_PLACEHOLDER }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, color: PINNED_IMAGE_GLYPH }}>{'\u{1F5BC}'}</Text>
        </View>
        {/* Real product photo over the placeholder at runtime. `live === false` (snapshot)
            → RemoteImage renders null → placeholder baseline byte-identical. */}
        <RemoteImage live={live} uri={imageURL(product)} resizeMode="cover" />
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
        {/* Narrate tag (accent) — shown for the narrating product. */}
        {isNarrating(product) ? (
          <View
            style={{
              marginBottom: 3,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 11, color: theme.accent }}>{'\u{1F4CA}'}</Text>
            <Text
              style={{
                marginLeft: 3,
                color: theme.accent,
                fontSize: 11 * theme.fontScale,
                fontWeight: '700',
              }}
            >
              {NARRATE_TAG_TEXT}
            </Text>
          </View>
        ) : null}
        {/* Product name (1-line clamp, design dark text). */}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            color: theme.text,
            fontSize: 11 * theme.fontScale,
            fontWeight: '600',
          }}
        >
          {product.name}
        </Text>
        {/* Live price (accent). `priceShow` is the pre-formatted string. */}
        <Text
          style={{
            marginTop: 3,
            color: theme.accent,
            fontSize: 13 * theme.fontScale,
            fontWeight: '800',
          }}
        >
          {livePriceText(product)}
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

/**
 * Two centered dark hint pills (`LBPGestureHint`): tap-to-toggle-clean-mode, swipe-to-switch
 * (rb-rn-gesture-clean-mode-v2 — the long-press hint pill is removed entirely, see `HINT_TAP`'s
 * doc comment). Pure static localized copy.
 */
function gestureHints(theme: ReferenceUITheme): ReactElement {
  return (
    <View style={{ alignItems: 'center' }}>
      {gestureHintPill(theme, '\u{1F446}', HINT_TAP)}
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
 * The pinned product is "narrating" when `narrateStatus === 2` (core
 * convention). Pure.
 */
function isNarrating(product: LBProduct): boolean {
  return product.narrateStatus === 2;
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
