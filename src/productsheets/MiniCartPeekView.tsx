// MiniCartPeekView — family-3 product sheet-stack surface 3 (mini-cart peek, RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-3 product + sheets, surface 3).
// Blueprint (primary): flutter-reference-ui/lib/src/productsheets/mini_cart_peek.dart
//   (the RECONCILED final family-3 — carries the 收藏鈕 in the DETAIL sheet, not
//   here). iOS parity: ios/Sources/LivebuyReferenceUI/ProductSheets/MiniCartView.swift.
//   Android parity: android/livebuy-reference-ui/.../productsheets/MiniCartPeek.kt
//   (golden `mini-cart-peek-in-stock`).
// Design: `design/templates/minimal/sdk-components.jsx` `LBPMiniCart` (lines 675-713)
//   + `design/templates/minimal/screens.jsx` `LBPMiniCart` call-site.
// Phase-4 RN sibling of the DONE iOS / Android / Flutter family-3 surface 3.
//
// The floating mini-cart peek for the most-recent successful add. It is the third
// of the four family-3 surface components composed by `ProductSheetsView`, and it
// implements the agreed RN SUB-VIEW INPUT PATTERN documented in `ProductSheetsView`:
//
//   1. `theme` (ReferenceUITheme)            — FIRST, always.
//   2. bound SNAPSHOT VALUE                  — `peek: LBMiniCartPeek` — passed BY
//      VALUE from `ProductSheetsModel.miniCart` (never the model, never the
//      template). The container renders this sub-view ONLY when its `miniCart`
//      snapshot is non-null (an absent peek → no floating card), so the sub-view
//      itself binds a NON-OPTIONAL peek and additionally self-guards (renders
//      nothing) on the rare null pass so it is always safe to compose.
//   3. action callbacks (LAST, each defaulting to a no-op):
//        • `onDismiss`    → `model.dismissMiniCart()` (the close button).
//        • `onOpenDetail` → the host-wired「開明細」re-open (the template exposes no
//          public `openDetail()` exit — the host re-feeds the full `LBProduct`).
//
// One-way data flow (D-1 / D-4): this surface reads ONLY its passed-in `peek`; it
// never reaches back into `ProductSheetsModel` / `DefaultPlayerTemplate`, and it
// NEVER calls core `addToCart` (the detail sheet forwards that). It NEVER records /
// clears the peek itself — that is the template's `DefaultMiniCart`; this layer only
// forwards the close / open intents. It renders correctly with all callbacks omitted
// (so demo / structural-snapshot / preview construct it action-free).
//
// PHOTO-LED (rb-align-rn-product-sheets — four-platform parity with iOS #8 /
// Android #9 / Flutter #12): aligned to the design's `LBPMiniCart`, the peek LEADS
// with a product thumbnail. `photos` are remote URLs and reference-ui keeps
// snapshots deterministic (NO network image), so — like `ProductDetail`'s media — it
// draws a solid placeholder with a monogram (host can swap in a real image). The
// rest mirrors `LBPMiniCart`: the white card surface, the single-line name, the
// price line (`已售完` when `soldOut === 1`, else `priceShow`), and the trailing
// close button. NO「已加入購物車」confirmation line (the design's `LBPMiniCart` has
// none — the peek's mere appearance is the "added" signal).
//
// WHITE-CARD RESTYLE (rb-rn-vod-live-product-card-restyle, design re-sync R31):
// the card surface flipped from a dark glass pill to a white card — thumbnail is
// now 60-wide, flush to the card's left/top/bottom edges (only its left two
// corners are rounded — achieved by the outer Pressable's own `overflow: 'hidden'`
// + `borderRadius` clipping the whole card, the same technique as
// `LiveOverlayChromeView.pinnedCard`), the close button moved from a trailing
// glass circle to a transparent top-right absolute chip, and text colors flipped
// from on-glass white to `theme.text` / the price line to `theme.accent`.
//
// RENDER DISCIPLINE (iOS / Android / Flutter lessons baked in): plain
// View / Text / Pressable only — NO ScrollView / FlatList / SectionList, NO
// network-uri Image, NO platform Switch, NO animation / randomness. Glyphs are
// deterministic Text glyphs (parity to iOS SF Symbols / Flutter Icons). Tapping the
// card body opens the detail; tapping the close button dismisses WITHOUT opening (the
// design's `onClose` calls `e.stopPropagation()` — here a nested Pressable intercepts
// the tap so the outer open-detail action does not also fire). `theme` FIRST; jsx
// automatic runtime (no React import). Prices are STRINGS (no numeric formatting).

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import { RemoteImage } from './RemoteImage';
import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';
import type { LBMiniCartPeek } from 'livebuy-react-native-ui';

// MARK: - Layout tokens (lifted from sdk-components.jsx · LBPMiniCart)

/** Bounded card width — keeps the single-line name truncating rather than
 *  stretching (parity with iOS 260pt / Android 260dp / Flutter 260). */
const CARD_WIDTH = 260;
/** Right-side card padding (design `padding: '0 8px 0 0'` — right edge only; the
 *  thumbnail and the card's top/bottom are flush, no padding there). */
const CARD_PADDING = 8;
/** Corner radius (design `borderRadius: '0.25rem'`; 1rem = 16px → 4px). */
const CARD_RADIUS = 4;
/** Gap between the thumbnail / info / close (`gap: 10`). */
const H_GAP = 10;
/** Thumbnail width — flush to the card's left/top/bottom edges, height is
 *  content-driven (`alignItems: 'stretch'`), design `width: 3.5rem` = 56px
 *  (rb-rn-product-detail-image-gallery, design R34: 60 → 56; RN's `alignItems: 'stretch'`
 *  already stretches this thumbnail natively, so — unlike the web design source, which needed
 *  an explicit `height` to compensate for a CSS-only quirk — no companion height fix is
 *  needed here). */
const THUMB_WIDTH = 56;
/** Trailing close-circle diameter (`width/height: 22`). */
const CLOSE_SIZE = 22;

// MARK: - Decorative design tokens (literal minimal hex from LBPMiniCart)
//
// accent / fontScale come from the resolved [ReferenceUITheme]. `theme.background` /
// `theme.text` drive the white-card surface + primary text (design `#fff` /
// `theme.surface.text`); the remaining values below are FIXED decorative colors
// lifted verbatim from the design's `LBPMiniCart` — design-literal, NOT
// theme-resolved.

/** Sold-out copy color `#9A96A3` (the design's muted sold-out tint). Unchanged by
 *  the white-card restyle (rb-rn-vod-live-product-card-restyle) — already used
 *  against a white background elsewhere in this package
 *  (`ProductListView.tsx`'s `SOLD_OUT_COLOR`), confirmed adequate contrast on
 *  `theme.background` (white) without adjustment. */
const SOLD_OUT_COLOR = '#9A96A3';
/** Product-photo placeholder fill (mirrors `ProductDetail`'s warm media chip —
 *  deterministic, NO network image). */
const PHOTO_FILL = '#E27D5A';

// MARK: - Fixed localized copy (static presentation strings — parity to iOS/Android)

/** Sold-out price-line label (design `已售完`). */
const SOLD_OUT_LABEL = '已售完';

// MARK: - Deterministic glyphs (Text glyphs — parity to iOS SF Symbols / Flutter Icons)

/** Close affordance (`xmark` / `Icons.close`). */
const GLYPH_CLOSE = '×'; // × multiplication sign

/** Up-to-2-char monogram from the product name (deterministic, pure). Mirrors the
 *  detail sheet's `monogram` (iOS / Android / Flutter parity). */
function monogram(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'LB';
  return trimmed.slice(0, trimmed.length < 2 ? trimmed.length : 2).toUpperCase();
}

/** Props for the family-3 floating mini-cart peek (surface 3). */
export interface MiniCartPeekProps {
  /** The resolved reference-ui theme (FIRST, always). */
  readonly theme: ReferenceUITheme;
  /**
   * The mini-cart peek SNAPSHOT VALUE (`DefaultMiniCart.peek`) — the most-recent
   * successful add. Read-only, BY VALUE. The container passes it only when non-null;
   * a `null` here self-guards (renders nothing — no floating card).
   */
  readonly peek: LBMiniCartPeek | null;
  /**
   * Host-wired close (the ✕). The container forwards `model.dismissMiniCart()` →
   * `DefaultMiniCart.dismissMiniCart()`. Default no-op (demo / snapshot / preview).
   */
  readonly onDismiss?: () => void;
  /**
   * Host-wired body tap. The container forwards the host's「開明細」re-open (the
   * template exposes no public `openDetail()` exit — the host re-feeds the full
   * `LBProduct`). Default no-op (demo / snapshot / preview).
   */
  readonly onOpenDetail?: () => void;
  /**
   * VOD 介紹輪播三參數（rb-rn-now-introducing-real-image-carousel，問題 9/10；皆預設保 peek
   * byte-identical）。`live` / `fullWidth` 鏡像 iOS / Android / Flutter `MiniCartPeek`；`tag` 已於
   * rb-rn-minicart-remove-introducing-tag 收斂為 permanently inert：
   *  • `live`     — `live === true` 且 `peek.pic` 非空時於 placeholder 上疊真實商品圖（RemoteImage）。
   *  • `fullWidth`— body 由固定 260 改為填滿（輪播卡用滿寬）。
   *  • `tag`      — @deprecated 已對齊設計稿 `LBPMiniCart`（無介紹文案欄位），本欄位不論傳入何值
   *    （含既有呼叫端的 `"介紹中"`）皆不再渲染任何文字或圖示。型別簽章保留是為了維持既有呼叫端
   *    （`playershell/NowIntroducingCarouselView.tsx`）的編譯相容，讀取此值已無任何視覺效果。
   */
  readonly live?: boolean;
  readonly fullWidth?: boolean;
  readonly tag?: string;
  /** E2E root testID (rb-rn-e2e-test-ids). Defaults to `minicartPeek` (the standalone peek
   *  surface); the VOD now-introducing carousel passes `nowIntroducingCard` so the same card,
   *  in its two contexts, is addressed by its context-correct id. Inert. */
  readonly testID?: string;
}

/**
 * The family-3 floating mini-cart peek for one {@link LBMiniCartPeek}. Paints a
 * compact PHOTO-LED white card — a thumbnail flush to the card's left/top/bottom
 * edges + the product name + a price / sold-out line — with a tap-to-open-detail
 * body and a top-right close button (aligned to the design's `LBPMiniCart`). The
 * container draws it only when a peek exists; a `null` peek self-guards to render
 * nothing.
 */
export function MiniCartPeek(props: MiniCartPeekProps): ReactElement {
  // `tag` is intentionally NOT destructured — it is permanently inert (see the
  // `MiniCartPeekProps.tag` doc comment); reading it further would have no effect.
  const { theme, peek, onDismiss, onOpenDetail, live = false, fullWidth = false, testID = LBTestIDs.minicartPeek } = props;

  // Self-guard (D-4): an absent peek → no floating card (the container also gates,
  // mirroring iOS / Android / Flutter, so this is safe to compose unconditionally).
  // Return an empty View so the function always yields a ReactElement.
  if (peek == null) {
    return <View />;
  }

  // Whether the peeked product is sold out (`soldOut === 1`). Drives the price line:
  // sold-out shows `已售完`, in-stock shows `priceShow`.
  const isSoldOut = peek.soldOut === 1;

  // The whole card body is the open-detail affordance (design `onTap`); the close
  // button is a separate Pressable, absolutely positioned top-right, that dismisses
  // WITHOUT opening (design `onClose` calls `e.stopPropagation()`). A bounded width
  // keeps the single-line name truncating rather than stretching (parity to iOS /
  // Android / Flutter 260). `overflow: 'hidden'` + `borderRadius` on this outer
  // Pressable clips the WHOLE card to the rounded shape, including the thumbnail's
  // corners where they meet the card's left edge — mirroring the same technique
  // `LiveOverlayChromeView.pinnedCard` uses, so only the thumbnail's left two
  // corners end up visually rounded (its right corners sit mid-card, untouched by
  // the clip). Only the right side carries padding (design `padding: '0 8px 0 0'`);
  // the thumbnail and the card's top/bottom stay flush (no left/vertical padding).
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onOpenDetail}
      style={{
        // 輪播卡滿寬（fullWidth）；浮動 mini-cart peek 維持固定 260。
        width: fullWidth ? '100%' : CARD_WIDTH,
        paddingRight: CARD_PADDING,
        borderRadius: CARD_RADIUS,
        backgroundColor: theme.background,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'stretch',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 18,
        elevation: 6,
      }}
    >
      {/* Product thumbnail (LBPMiniCart photo — deterministic placeholder): a solid
          fill with a monogram (NO network image), mirroring `ProductDetail`'s photo
          placeholder. Flush to the card's left/top/bottom edges — no own
          borderRadius; the outer Pressable's overflow clip rounds its left corners. */}
      <View
        style={{
          width: THUMB_WIDTH,
          backgroundColor: PHOTO_FILL,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: 'rgba(255,255,255,0.92)',
            fontSize: 16 * theme.fontScale,
            fontWeight: '800',
          }}
        >
          {monogram(peek.name)}
        </Text>
        {/* 真實商品圖（host runtime live + 非空 pic）疊於 monogram placeholder 上；
            live === false / 空 pic → 不畫（snapshot byte-stable）。rb-rn-now-introducing 真實圖。 */}
        <RemoteImage live={live} uri={peek.pic} />
      </View>

      <View style={{ width: H_GAP }} />

      {/* Info column (name + price line), vertically centered against the
          content-driven card height (design `padding: '8px 0'`). */}
      <View style={{ flex: 1, minWidth: 0, paddingVertical: CARD_PADDING, justifyContent: 'center' }}>
        {/* No accent「介紹中」tag here (rb-rn-minicart-remove-introducing-tag): the design's
            `LBPMiniCart` (design/templates/minimal/sdk-components.jsx, ~884-919) has no
            introduction/description copy field at all — thumbnail + name + price/sold-out line
            + close button only. The `tag` prop is kept on `MiniCartPeekProps` (permanently
            inert, see its doc comment) purely for call-site compile compatibility; it is never
            rendered here regardless of its value. */}
        {/* Product name — single-line, ellipsis-truncated (design 13/600). Reserves
            `paddingRight: 26` so the text never runs under the absolutely-positioned
            top-right close button (design's own `.name` div `paddingRight: 26`). */}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            color: theme.text,
            fontSize: 13 * theme.fontScale,
            fontWeight: '600',
            paddingRight: 26,
          }}
        >
          {peek.name}
        </Text>

        {/* Price line — sold-out → 已售完 (muted); else the priceShow (accent, string). */}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            marginTop: 2,
            color: isSoldOut ? SOLD_OUT_COLOR : theme.accent,
            fontSize: 12 * theme.fontScale,
            fontWeight: isSoldOut ? '600' : '700',
          }}
        >
          {isSoldOut ? SOLD_OUT_LABEL : peek.priceShow}
        </Text>
      </View>

      {/* Close button (LBPMiniCart top-right close — design `top: 3, right: 3`,
          transparent, `theme.surface.text`-colored icon; no longer a trailing glass
          circle). Tapping it dismisses WITHOUT opening the detail: its own Pressable
          intercepts the tap so the outer open-detail action does not also fire
          (design `e.stopPropagation()` on `onClose`). A no-op when `onDismiss` is
          omitted. */}
      <Pressable
        testID={LBTestIDs.minicartPeekClose}
        accessibilityRole="button"
        onPress={onDismiss}
        style={{
          position: 'absolute',
          top: 3,
          right: 3,
          width: CLOSE_SIZE,
          height: CLOSE_SIZE,
          borderRadius: CLOSE_SIZE / 2,
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 14 * theme.fontScale,
            fontWeight: 'bold',
          }}
        >
          {GLYPH_CLOSE}
        </Text>
      </Pressable>
    </Pressable>
  );
}
