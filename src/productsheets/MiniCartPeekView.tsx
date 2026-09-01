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
// with a 52×52 product thumbnail. `photos` are remote URLs and reference-ui keeps
// snapshots deterministic (NO network image), so — like `ProductDetail`'s media — it
// draws a 52×52 rounded solid placeholder with a monogram (host can swap in a real
// image). The rest mirrors `LBPMiniCart`: the dark glass card surface, the single-
// line name, the price line (`已售完` when `soldOut === 1`, else `priceShow`), and the
// trailing circular close button. NO「已加入購物車」confirmation line (the design's
// `LBPMiniCart` has none — the peek's mere appearance is the "added" signal).
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

import { EqualizerGlyph } from './EqualizerGlyph';
import { RemoteImage } from './RemoteImage';
import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';
import type { LBMiniCartPeek } from 'livebuy-react-native-ui';

// MARK: - Layout tokens (lifted from sdk-components.jsx · LBPMiniCart)

/** Bounded card width — keeps the single-line name truncating rather than
 *  stretching (parity with iOS 260pt / Android 260dp / Flutter 260). */
const CARD_WIDTH = 260;
/** Card padding (`padding: 8`) + corner radius (`borderRadius: 16`). */
const CARD_PADDING = 8;
const CARD_RADIUS = 16;
/** Gap between the chip / info / close (`gap: 10`). */
const H_GAP = 10;
/** Added chip box (replaces the design's 52×52 product photo). */
const CHIP_SIZE = 52;
const CHIP_RADIUS = 10;
/** Trailing close-circle diameter (`width/height: 22`). */
const CLOSE_SIZE = 22;

// MARK: - Decorative design tokens (literal minimal hex from LBPMiniCart)
//
// accent / fontScale come from the resolved [ReferenceUITheme]. These are FIXED
// decorative colors lifted verbatim from the design's `LBPMiniCart` (the dark-glass
// overlay) — design-literal, NOT theme-resolved. They mirror the iOS `MiniCartView`
// statics + Android `MiniCartPeek` private vals + Flutter `_glassFill`/etc.
// byte-for-byte so the four platforms read as one family.

/** `rgba(20,20,24,0.78)` — the dark glass card fill (`LBPMiniCart`). */
const GLASS_FILL = 'rgba(20,20,24,0.78)';
/** `rgba(255,255,255,0.10)` — the 0.5px hairline border on the glass. */
const GLASS_STROKE = 'rgba(255,255,255,0.10)';
/** On-glass primary text — white (`#fff` in the design). */
const ON_GLASS_TEXT = '#FFFFFF';
/** In-stock price accent `#FF7B8A` (the design's price-pink on the glass). */
const PRICE_COLOR = '#FF7B8A';
/** Sold-out copy color `#9A96A3` (the design's muted sold-out tint). */
const SOLD_OUT_COLOR = '#9A96A3';
/** The trailing close-circle fill `rgba(255,255,255,0.18)`. */
const CLOSE_FILL = 'rgba(255,255,255,0.18)';
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
   * byte-identical）。鏡像 iOS / Android / Flutter `MiniCartPeek` 的 live/fullWidth/tag：
   *  • `live`     — `live === true` 且 `peek.pic` 非空時於 placeholder 上疊真實商品圖（RemoteImage）。
   *  • `fullWidth`— body 由固定 260 改為填滿（輪播卡用滿寬）。
   *  • `tag`      — 非空字串時於 info 欄名稱上方畫小 accent 標籤（「介紹中」）。
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
 * compact PHOTO-LED dark-glass card — a 52×52 product thumbnail + the product name +
 * a price / sold-out line — with a tap-to-open-detail body and a trailing close
 * button (aligned to the design's `LBPMiniCart`). The container draws it only when a
 * peek exists; a `null` peek self-guards to render nothing.
 */
export function MiniCartPeek(props: MiniCartPeekProps): ReactElement {
  const { theme, peek, onDismiss, onOpenDetail, live = false, fullWidth = false, tag, testID = LBTestIDs.minicartPeek } = props;

  // Self-guard (D-4): an absent peek → no floating card (the container also gates,
  // mirroring iOS / Android / Flutter, so this is safe to compose unconditionally).
  // Return an empty View so the function always yields a ReactElement.
  if (peek == null) {
    return <View />;
  }

  // Whether the peeked product is sold out (`soldOut === 1`). Drives the price line:
  // sold-out shows `已售完`, in-stock shows `priceShow`.
  const isSoldOut = peek.soldOut === 1;

  // The whole card body is the open-detail affordance (design `onTap`); the trailing
  // close button is a separate Pressable that dismisses WITHOUT opening (design
  // `onClose` calls `e.stopPropagation()`). A bounded width keeps the single-line
  // name truncating rather than stretching (parity to iOS / Android / Flutter 260).
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onOpenDetail}
      style={{
        // 輪播卡滿寬（fullWidth）；浮動 mini-cart peek 維持固定 260。
        width: fullWidth ? '100%' : CARD_WIDTH,
        padding: CARD_PADDING,
        borderRadius: CARD_RADIUS,
        backgroundColor: GLASS_FILL,
        borderWidth: 0.5,
        borderColor: GLASS_STROKE,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Product thumbnail (LBPMiniCart 52×52 photo — deterministic placeholder): a
          rounded solid chip with a monogram (NO network image), mirroring
          `ProductDetail`'s photo placeholder. */}
      <View
        style={{
          width: CHIP_SIZE,
          height: CHIP_SIZE,
          borderRadius: CHIP_RADIUS,
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
        <RemoteImage live={live} uri={peek.pic} borderRadius={CHIP_RADIUS} />
      </View>

      <View style={{ width: H_GAP }} />

      {/* Info column (name + price line). */}
      <View style={{ flex: 1 }}>
        {/* Optional accent tag above the name (carousel「介紹中」). The tag carries the
            accent equalizer glyph + accent text (對齊設計 `LBLivePinnedCard` 等化器 + accent 文字,
            與商品列底部橫幅共用 `EqualizerGlyph`). Empty / omitted → not drawn (peek byte-identical).
            rb-rn-now-introducing-real-image-carousel，問題 10. */}
        {tag != null && tag.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <EqualizerGlyph size={11} color={theme.accent} />
            <View style={{ width: 3 }} />
            <Text
              style={{
                color: theme.accent,
                fontSize: 11 * theme.fontScale,
                fontWeight: '600',
              }}
            >
              {tag}
            </Text>
          </View>
        ) : null}
        {/* Product name — single-line, ellipsis-truncated (design 13/600). */}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            color: ON_GLASS_TEXT,
            fontSize: 13 * theme.fontScale,
            fontWeight: '600',
          }}
        >
          {peek.name}
        </Text>

        {/* Price line — sold-out → 已售完; else the priceShow (string). */}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            marginTop: 2,
            color: isSoldOut ? SOLD_OUT_COLOR : PRICE_COLOR,
            fontSize: 12 * theme.fontScale,
            fontWeight: isSoldOut ? '600' : '700',
          }}
        >
          {isSoldOut ? SOLD_OUT_LABEL : peek.priceShow}
        </Text>
      </View>

      <View style={{ width: H_GAP }} />

      {/* Close button (LBPMiniCart trailing close — 22×22 glass circle). Tapping it
          dismisses WITHOUT opening the detail: its own Pressable intercepts the tap so
          the outer open-detail action does not also fire (design `e.stopPropagation()`
          on `onClose`). A no-op when `onDismiss` is omitted. */}
      <Pressable
        testID={LBTestIDs.minicartPeekClose}
        accessibilityRole="button"
        onPress={onDismiss}
        style={{
          width: CLOSE_SIZE,
          height: CLOSE_SIZE,
          borderRadius: CLOSE_SIZE / 2,
          backgroundColor: CLOSE_FILL,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: ON_GLASS_TEXT,
            fontSize: 12 * theme.fontScale,
            fontWeight: 'bold',
          }}
        >
          {GLYPH_CLOSE}
        </Text>
      </Pressable>
    </Pressable>
  );
}
