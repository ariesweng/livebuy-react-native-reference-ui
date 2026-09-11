// ProductDetailSheetView — family-3 product sheet-stack surface 2 (RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-3 product + sheets, surface 2).
// Blueprint (primary): flutter-reference-ui/lib/src/productsheets/product_detail_sheet.dart
//   (carries the RECONCILED 收藏鈕). iOS parity:
//   ios/Sources/LivebuyReferenceUI/ProductSheets/ProductDetailSheetView.swift
//   (rb-ios-product-sheets D-3 + rb-ios-gap-surfaces-design-reconcile 收藏鈕).
//   Android parity:
//   android/livebuy-reference-ui/.../productsheets/ProductDetailSheet.kt.
// Design: `design/templates/minimal/screens.jsx` `ProductDetailSheet` /
//          `AddToCartSheet` + `sdk-components.jsx` `LBPBottomSheet` /
//          `LBPSheetHeader` / `LBPVariantPicker` / `LBPQtyStepper` /
//          `LBPCartCTA` / `LBPButton` (primary) / `LBPAlertModal` / `LBPFavButton`.
// Phase-4 RN sibling of the DONE iOS / Android / Flutter family-3 surface 2.
// Golden parity names: `product-detail-sheet-variant-instock` (faved=false) +
// `product-detail-sheet-favorited` (faved=true).
//
// The product-DETAIL sheet for ONE `LBProductDetailState`. It is the second of the
// four family-3 surface components composed by `ProductSheetsView`, and it
// implements the agreed RN SUB-VIEW INPUT PATTERN documented in
// `ProductSheetsView.tsx`:
//
//   1. `theme` (ReferenceUITheme)              — FIRST, always.
//   2. bound SNAPSHOT VALUES (read-only, BY VALUE):
//        `detail: LBProductDetailState`, `variant: LBVariantState`,
//        `qty: LBQtyState`, `needsVariantSelection: boolean`,
//        `addToCartFailed: boolean`, `faved?: boolean` — passed BY VALUE from
//        `ProductSheetsModel` (never the model, never the template).
//   3. action callbacks (LAST, each defaulting to a no-op):
//        `onSelectVariant(gi, oi)` (chip tap → `template.selectVariant`),
//        `onSetQty` / `onInc` / `onDec` (qty stepper → `template.{setQty,incQty,
//        decQty}`), `onAddToCart` (加入購物車 → `template.addToCart()`),
//        `onToggleFavorite` (收藏 → `template.toggleAwait(goodsGpn)`).
//
// This sub-view reads ONLY its passed-in values; it never reaches back into
// `ProductSheetsModel` / `DefaultPlayerTemplate` (one-way data flow, D-1). It also
// renders correctly with all callbacks omitted (so demo / structural-snapshot
// tests construct it action-free).
//
// PRESENTATION MODE (rb-rn-add-to-cart-route — parity iOS):
//   • `presentation='detail'` (DEFAULT) — the FULL browse sheet: header 商品明細, 4:3
//     photo, a centered inline 收藏 button in the body (rb-rn-product-sheet-resize-fav-inline)
//     + a 2-slot [分享][CTA] footer. Opened by the list 明細鈕 / 商品名.
//   • `presentation='addToCart'` — the COMPACT add sheet: header 加入購物車, a 96×96
//     horizontal product card (aligned with NotifyRestock), CTA-only footer (NO 收藏 /
//     分享). Opened by the list 加購鈕. Variant chips + qty stepper are still shown.
//   Sold-out routes to the restock sheet (NotifyRestock) at the container, regardless
//   of mode — this sheet never presents for a sold-out product directly.
//
// REAL PRODUCT IMAGE (rb-rn-product-real-images — parity iOS `live`): the image is a
// deterministic placeholder by default (`live === false`, snapshot / demo); at runtime
// (`live === true`) the resolved product photo loads over it via {@link RemoteImage}
// (falls back to the placeholder on error). The default-false path keeps the structural
// snapshot unchanged (no `<Image>` in the tree).
//
// SPEC-AWARE PRODUCT PHOTO (rn-product-sheet-spec-photo-reference-ui — parity iOS
// `ios-product-sheet-spec-photo-reference-ui`): WHICH photo is loaded follows the SELECTED
// SPEC (`variant.selectedSpec`), not the product level, so the image on screen matches the
// variant actually being added to cart. The sibling of the spec-aware price line below —
// same "the spec data was parsed but never wired to the pixels" gap, one surface later.
// The source is resolved by `resolveProductPhoto` (see `resolvedProductPhoto.ts` for the
// degradation ladder and why `primaryPhoto` is the first NON-BLANK entry rather than
// `photos[0]`). Resolved ONCE in the component body and consumed by BOTH the compact
// `.addToCart` card and the `.detail` 4:3 photo; the zoom lightbox
// (`ProductImageZoomOverlay`) re-uses the SAME pure function fed the SAME `selectedSpec`,
// so it magnifies the very image the user tapped rather than re-deriving the ladder.
//
// MULTI-IMAGE GALLERY (rb-rn-product-detail-image-gallery, design R34): `.detail`'s 4:3 photo
// is now a SWIPEABLE gallery over `resolveProductPhoto(...).photos` (the SAME resolved array,
// never re-derived) — swipe left/right via `PanResponder` (parity `NowIntroducingCarouselView`'s
// established "no ScrollView, draw only the current frame" convention; this file's own render
// discipline below explicitly forbids `ScrollView`/`FlatList`, so a native scroll-view pager was
// never an option) + a below thumbnail strip that appears ONLY when there is more than one photo
// (tap a thumbnail to jump; every NON-current thumbnail carries a `rgba(0,0,0,0.5)` overlay).
// `.addToCart`'s 96×96 compact card is UNCHANGED — it still draws a single static photo
// (`photo.primaryPhoto`), no gallery. The zoom badge now forwards the CURRENTLY selected
// gallery photo (not always `primaryPhoto`) so the lightbox (`ProductImageZoomOverlay`'s new
// `overridePhotoURL` prop) magnifies the exact photo the user was viewing. A product with 0/1
// resolved photos gets NEITHER the swipe responder NOR a testID on the photo container (the
// gallery machinery is entirely absent, not merely inert), so the existing single-photo
// structural snapshot baselines stay byte-identical.
//
// reference-ui NEVER builds HTTP nor calls core `addToCart` / `toggleAwait` — the
// 加入購物車 CTA funnels to `onAddToCart` (the container wires it to
// `model.addToCart()` → `template.addToCart()`, which assembles the route-B request
// internally), and the 收藏鈕 funnels to `onToggleFavorite` (container →
// `model.toggleFavorite()` → `template.toggleAwait`). reference-ui never flips
// either flag itself; `faved` is read from `template.awaitEnabled(goodsGpn)`.
//
// Variant / qty / add-to-cart guards (D-3):
//   • Variant chips are drawn once per `variant.groups`; the selected chip is
//     `variant.selection[groupIndex] === optionIndex`. Chip tap →
//     `onSelectVariant(group, option)`. The chip group is a FLEX-WRAP container
//     (RN Yoga native `flexWrap: 'wrap'` — chips wrap at their natural width and
//     show every option's full text, aligned to the design `LBPVariantPicker`
//     `flexWrap:'wrap'` + iOS `ChipFlowLayout` / Android `FlowRow` parity. RN's
//     Yoga is a native flex-wrap primitive (peer of Flutter `Wrap`) in a
//     width-determined sheet body, so — unlike iOS SwiftUI's bare HStack — no
//     mis-measure; still NOT a grid / FlatList / any scrollable, so the structural
//     snapshot stays deterministic).
//   • Qty stepper is bound to `qty.qty` within `[qty.min, qty.max]`; it is DISABLED
//     when `qty.max === 0` (sold out). `-`/value/`+` → `onDec`/(`onSetQty`)/`onInc`.
//   • The primary 加入購物車 CTA is DISABLED when sold out (`qty.max === 0`).
//   • `needsVariantSelection` (`selectSpecRequired`) → the centered「請選規格」prompt is NO LONGER
//     drawn here; it is hoisted to the container's overlay root (`SelectVariantPromptModal`). The
//     prop is retained for signature stability but unused by this component.
//   • `addToCartFailed` → retryable error banner.
//
// INLINE 收藏鈕 (rb-rn-product-sheet-resize-fav-inline, design R19 — supersedes the prior
// "footer 3-slot [收藏][分享][CTA]" RECONCILED placement of 2026-06-06): the `.detail`
// (full browse) presentation now draws the 收藏鈕 as a HORIZONTAL icon+text row, centered,
// standing ALONE at the bottom of the scrollable BODY (after the 數量 row, before the
// add-to-cart failure banner) — NOT in the footer action row anymore.
//   • `faved === false` → 空心 heart + theme.text + label「收藏」.
//   • `faved === true`  → 實心 heart + accent + label「已收藏」.
//   • tap → `onToggleFavorite`. The fav state reads the SAME source as the restock
//     await flag (`template.awaitEnabled(goodsGpn)`) — this layer holds NO second
//     copy of it.
//   • `.addToCart` (compact) presentation still drops it entirely (unchanged — it never
//     had a 收藏鈕).
//
// 分享 button (rb-align-rn-product-sheets — four-platform parity with iOS #8 /
// Android #9 / Flutter #12): the footer keeps a width-56 vertical 分享 button (↗ =
// square.and.arrow.up) immediately before the CTA — now a 2-slot [分享][CTA] footer in
// `.detail` (CTA-only when `isLive` hides 分享, see below). Share is a HOST CONCERN — the
// headless SDK exposes no share route, so reference-ui only forwards the tap to
// `onShare`; it builds no share logic and never calls core / template.
//
// DELIBERATE DEVIATION (data gap — iOS/Android/Flutter lockstep): the design's detail
// header is a LEFT-aligned host-badge row (host avatar + host name + close), but
// `LBProductDetailState` carries NO host data, so the centered「商品明細」title is kept
// and the host-badge header is recorded as a cross-layer follow-up. The design's
// product sub-line is likewise not drawn (no `sub` field).
//
// SPEC-AWARE PRICE LINE (rn-product-sheet-spec-price-reference-ui — parity iOS
// `ios-product-sheet-spec-price-reference-ui`): the price row follows the SELECTED SPEC
// (`variant.selectedSpec`), not the product level, so the displayed price matches the
// price actually added to cart. The sale price and its struck-through original are
// resolved as an ATOMIC SAME-SOURCE PAIR by `resolvePriceDisplay` (see
// `resolvedPriceDisplay.ts` for the degradation ladder and why a mixed pair would be a
// fake discount). Resolved ONCE in the component body and consumed by BOTH price rows —
// RN has no shared `priceRow` builder like iOS, so the single resolution is itself part
// of the same-source guarantee across the `.detail` / `.addToCart` branches. Sold-out
// (`qty.max === 0`) is orthogonal and unchanged: it still wins over any price.
//
// SHOW-STOCK GATE (rb-rn-show-stock-caption-toggle — design R15; iOS
// `rb-ios-show-stock-caption-toggle` / Android `rb-android-show-stock-caption-toggle` are the
// same feature on their platforms): the merchant can turn off the「只剩庫存 N 組」line in the
// 數量 row from `/admin/additional` (setting `stock`), shipped as `POST /sdk/config`'s
// `data.extensions.show_stock` (Int 0/1).
//   • `extensions` is an OPAQUE RAW BAG — the SDK does not interpret it, so the HOST injects
//     the value, and it travels RAW the whole way: `LivebuyPlayerConfig.showStock` →
//     `LivebuyPlayerOverlays` → `ProductSheetsView` → this component's `showStock` prop.
//     reference-ui never reads `sdkConfig.extensions` itself.
//   • The prop is the RAW value (`unknown`), not a boolean: this layer owns the ONE fallback
//     (`normalizeShowStock`), matching how `product_card` and `floating_setting` are already
//     handled here. iOS / Android instead type their config field as `Bool`/`Boolean` — that
//     difference is deliberate, see the change's design D1.
//   • Visibility is decided by the ONE predicate `showsStockCaption(showStock, isSoldOut)` —
//     an AND. The pre-existing "sold out ⇒ no stock caption" rule is UNCHANGED; the merchant
//     flag is an extra gate stacked on top, never a replacement, so on a sold-out product the
//     flag is a no-op.
//   • Off ⇒ the caption `Text` is simply not built (no placeholder, no substitute copy). The
//     rest of the row is untouched, so the stepper stays pinned to the trailing edge via the
//     existing `<View style={{ flex: 1 }} />`.
//   • Unrelated to `NotifyRestockSheetView`'s「尚無庫存」(a SOLD-OUT status line) and to any
//    「已售完」treatment (driven by `soldOut` / `isSoldOut`).
//
// RENDER DISCIPLINE (inherited from iOS / Android / Flutter + family-1/2 lessons):
// plain View / Text / Pressable only — NO ScrollView / FlatList / SectionList and
// NO network-uri Image. The photo is a deterministic gradient-stop placeholder with
// a monogram. Glyphs are deterministic Text glyphs. No animation / no randomness so
// the structural tree is byte-stable. `theme` FIRST; jsx automatic runtime (no
// React import). Prices are STRINGS.

import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { View, Pressable, PanResponder, type LayoutChangeEvent } from 'react-native';
import { Text } from '../TightText';

import { ZoomBadge } from './ZoomBadge';
import { CartGlyph } from './CartGlyph';
import { CartSpinnerView } from './CartSpinnerView';
import { RemoteImage } from './RemoteImage';
import { ShareGlyph } from '../playershell/ShareGlyph';
import { HeartFillGlyph } from '../playershell/HeartFillGlyph';
import { HeartGlyph } from '../playershell/HeartGlyph';
import { SheetHeaderCloseButton } from './SheetHeaderCloseButton';
import { WarningGlyph } from './WarningGlyph';
import { SheetScaffold } from './SheetScaffold';
import { resolvePriceDisplay } from './resolvedPriceDisplay';
import { resolveProductPhoto } from './resolvedProductPhoto';
import { ProductRowView } from './ProductListView';
import { recommendationAsDisplayProduct } from './recommendationBreadcrumb';
import { clampIndex } from '../playershell/NowIntroducingCarouselView';
import { LBTestIDs, variantChip, productDetailPhotoThumb } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';
import type {
  LBProductDetailState,
  LBVariantState,
  LBQtyState,
  LBProductRecommendation,
} from 'livebuy-react-native-ui';

// MARK: - Decorative design tokens (literal minimal hex)
//
// accent / text / background come from the resolved [ReferenceUITheme]. These are
// FIXED decorative colors lifted verbatim from the design `theme.surface.*` /
// `theme.soldOut` (light mode, `design/brands/livebuy/tokens.jsx`). They mirror the
// iOS / Android / Flutter `ProductDetailSheet` static colors byte-for-byte so the
// four platforms read as one family.

/** `theme.surface.textDim` (secondary / caption text). */
const TEXT_DIM = '#6B6775';
/** `theme.surface.textFaint` (disabled stepper digit / off control). */
const TEXT_FAINT = '#B6B2BE';
/** `theme.surface.stroke` (hairline divider / footer top border). */
const STROKE = '#ECEAF0';
/** `theme.surface.strokeStrong` (chip outline / stepper border / grab handle /
 *  disabled CTA fill). */
const STROKE_STRONG = '#D8D5DE';
/** `theme.surface.bgSunken` (sunken control fill — close circle / stepper button). */
const BG_SUNKEN = '#F4F4F6';
/** `theme.soldOut` (sold-out copy color — design `#9A96A3`). */
const SOLD_OUT_COLOR = '#9A96A3';
/** Product-photo placeholder fill — neutral gray (rb-rn-product-image-loading-polish; was the
 *  design's warm media-chip color `'#E27D5A'`). Distinct from the scale-down-letterbox
 *  whitespace fill (`'#FFFFFF'`, below) — that is "image loaded, native size narrower than the
 *  container", this is "no image to draw yet"; MUST NOT be conflated. */
const PHOTO_FILL = '#8E8E93';
/** Gallery non-current thumbnail overlay (rb-rn-product-detail-image-gallery, design R34
 *  `rgba(0,0,0,0.5)` — marks every thumbnail OTHER than the currently-selected one). */
const GALLERY_THUMB_OVERLAY = 'rgba(0,0,0,0.5)';
/** Gallery thumbnail square size + spacing — no exact px value ships in the upstream design
 *  contract text for this new strip (`design/contract/claude-design-sync.md` R34 only specifies
 *  behaviour, not pixels), so this is a RN-local sizing decision chosen to match the family's
 *  just-updated `MiniCartPeek` thumbnail width (`THUMB_WIDTH = 56`, same change) for visual
 *  consistency across the sheet. */
const GALLERY_THUMB_SIZE = 56;
const GALLERY_THUMB_RADIUS = 8;
const GALLERY_THUMB_GAP = 8;
/** Horizontal swipe distance (px) that commits a gallery page flip (parity
 *  `NowIntroducingCarouselView.SWIPE_DX`). */
const GALLERY_SWIPE_DX = 40;

/** Result of {@link resolveScaleDownLetterbox}. */
export interface ScaleDownLetterboxResult {
  readonly scale: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
}

/**
 * Scale-down-letterbox layout math (rb-rn-product-detail-main-image-scale-down-letterbox,
 * CSS `object-fit: scale-down` semantics — used ONLY by the `.detail` main photo, see D1 of
 * this change's design.md). Pure, zero-render, deterministic — extracted so it is unit-
 * testable without mounting a component (`docs/unit-test-discipline.md` 純函式抽出原則).
 *
 * `scale = min(1, containerWidth / imageNativeWidth, maxHeight / imageNativeHeight)`, where
 * `maxHeight = containerWidth * 2`. Equal-ratio scaling — both axes share the SAME `scale` —
 * NEVER upscales (`scale` is capped at `1`: a native size already smaller than the bounding
 * box is drawn at its own size, never stretched to fill it), and NEVER crops (the whole image
 * always fits inside the `containerWidth × maxHeight` box). `displayWidth` / `displayHeight`
 * are the size the caller SHOULD draw the image at; the caller centers it within the
 * container and sizes the container's own height to `displayHeight`.
 *
 * A non-positive `containerWidth`, `imageNativeWidth`, or `imageNativeHeight` (layout / the
 * image's natural size not measured yet) is a degenerate input — returns an all-zero result
 * rather than dividing by zero / producing `NaN` or `Infinity`. Callers MUST treat that as
 * "not resolvable yet" and keep their existing fixed-size placeholder layout instead of
 * using it (see `mainPhotoLetterbox` below, which only calls this once both measurements are
 * known — this guard is defensive, not the primary gate).
 */
export function resolveScaleDownLetterbox(
  containerWidth: number,
  imageNativeWidth: number,
  imageNativeHeight: number,
): ScaleDownLetterboxResult {
  if (containerWidth <= 0 || imageNativeWidth <= 0 || imageNativeHeight <= 0) {
    return { scale: 0, displayWidth: 0, displayHeight: 0 };
  }
  const maxHeight = containerWidth * 2;
  const scale = Math.min(1, containerWidth / imageNativeWidth, maxHeight / imageNativeHeight);
  return {
    scale,
    displayWidth: imageNativeWidth * scale,
    displayHeight: imageNativeHeight * scale,
  };
}

// MARK: - Fixed localized copy (static presentation strings — parity to iOS/Android)

const HEADER_TITLE = '商品明細';
const SOLD_OUT_LABEL = '已售完';
const QTY_LABEL = '數量';
const STOCK_CAPTION_PREFIX = '只剩庫存 ';
const STOCK_CAPTION_SUFFIX = ' 組';
const ADD_TO_CART_LABEL = '加入購物車';
/** 加購請求中 CTA 文字（rb-rn-cart-add-loading-state，對齊設計 `LBPButton.loadingLabel`）。 */
const ADDING_LABEL = '加入中…';
const FAV_LABEL = '收藏';
const FAVED_LABEL = '已收藏';
const SHARE_LABEL = '分享';
const RETRY_LABEL = '重試';
/** 「Sale」促銷徽章固定文案（rb-rn-product-sale-badge，design `screens.jsx`
 *  `ProductDetailSheet` / `AddToCartSheet` 的 `saleLabel`）。RN 商品模型無 `badge`
 *  自訂文案欄位，故固定為字面 `'Sale'`，不支援商品自訂。 */
const SALE_BADGE_LABEL = 'Sale';
const FAILURE_TITLE = '加入購物車失敗,請稍後再試';
// 「請選規格」prompt 的 copy 已搬到 `SelectVariantPromptModalView.tsx`（hoist 到容器 overlay root）。

/** 「商品介紹」文字區標題 (rb-rn-product-detail-recommendations, design R21).
 *  資料來源為 `LBProduct.description`（`add-product-description-core-rn` 已補齊此欄位，容錯
 *  fallback）——由容器 / `ProductSheetsModel.descriptionForProduct` 解析後經 {@link
 *  ProductDetailProps.description} 傳入本元件。**顯示規則自 `rb-rn-product-intro-bgcolor-and-
 *  hide-empty` 起與「商品說明」(`brief`) 的「空字串整塊不畫」規則完全一致**（反轉
 *  `rb-rn-product-intro-real-data` 同一天訂下的「恆顯示 + fallback 文案」規則，僅限 RN，使用者
 *  明確要求，非疏漏——iOS/Android/Flutter 維持各自既有的恆顯示 + fallback 規則不變）：
 *  `description` 非空 → 顯示整個區塊（含標題）與真實文案；空字串（無對應商品、或該商品
 *  `description` 本身就是空字串）→ 整個區塊（含標題）都不畫，不存在任何 fallback 文案。 */
const PRODUCT_INTRO_TITLE = '商品介紹';
/** 「更多商品」推薦格標題 (design R21). */
const RECOMMENDATIONS_TITLE = '更多商品';
/** 「更多商品」推薦格最多顯示筆數 (design.md D1, `expose-other-goods-recommendations-template`;
 *  4 → 12, `rb-rn-recommendations-cap-raise-to-twelve`). */
const RECOMMENDATIONS_MAX = 12;

// MARK: - Deterministic glyphs (Text glyphs — parity to iOS SF Symbols / Flutter Icons)
/** Stepper minus / plus glyphs. */
const GLYPH_MINUS = '−';
const GLYPH_PLUS = '+';

/** Up-to-2-char monogram from the product name (deterministic, pure). Mirrors iOS
 *  `monogram` / Android `monogram` / Flutter `_monogram`. */
function monogram(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'LB';
  return trimmed.slice(0, trimmed.length < 2 ? trimmed.length : 2).toUpperCase();
}

/**
 * Chunk `items` into fixed-size rows of `size` (the final row may be shorter — the caller pads
 * it with an invisible spacer, NOT a placeholder card). Deterministic, pure — mirrors the「更多
 * 商品」推薦格's `.chunked(2)` / manual-chunked-rows convention already used for variant chips
 * elsewhere in this family (rb-rn-product-detail-recommendations, design R21).
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

// MARK: - show_stock — the single fallback entry point + the caption gate
//
// (rb-rn-show-stock-caption-toggle, design R15 — `design/templates/minimal/sdk-components.jsx`
// `normalizeShowStock` / `screens.jsx` `AddToCartSheet`.)

/**
 * THE ONLY place a raw `extensions.show_stock` value becomes a boolean.
 *
 * The merchant decides in `/admin/additional` (setting `stock`) whether the「只剩庫存 N 組」
 * caption is exposed at all; the value ships on `POST /sdk/config` as
 * `data.extensions.show_stock` (Int `0`/`1`). `extensions` is an OPAQUE RAW BAG — the SDK
 * does not interpret it (`sdk-config` capability), so the HOST reads the value out and
 * injects it into `LivebuyPlayerConfig.showStock`; reference-ui NEVER reads
 * `LivebuySDK.getSdkConfig().extensions` itself.
 *
 * The parameter is `unknown` ON PURPOSE — RN core types `SDKConfig.extensions` as
 * `Record<string, unknown>`, so a host assigns the value in ONE line with no cast and no
 * default branch of its own. Forcing hosts to narrow to `boolean` first would push the
 * fallback decision back onto every host, which is exactly how the four platforms' boundaries
 * drift apart. Same shape as this layer's existing `normalizeProductCardMode` (raw string,
 * card owns the fallback) and `normalizeFloatingPosition` / `normalizeFloatingTiming`
 * (raw string in `LivebuyLiveEntryConfig`, `liveEntryLogic` owns the fallback).
 *
 * Mirrors the design's `normalizeShowStock(raw)` VERBATIM (`!(raw === 0 || raw === '0' ||
 * raw === false)`): the comparison is STRICT — NO trimming and NO case folding — so `' 0 '`
 * / `'0 '` / `'00'` / `'0.0'` / `'false'` / `'FALSE'` all fall back to "show", exactly like
 * any other unrecognized value. Being deliberately as strict as the design keeps the four
 * platforms' fallback boundary identical precisely when the backend emits something
 * malformed, which is when a divergence would be hardest to spot.
 *
 * FALLBACK LANDS ON "SHOW" (`true`) for `undefined` / a missing key / `null` / anything
 * unrecognized. The two reasons — neither of which assumes anything about the backend:
 *   1. It matches the design as it stands (before R15 the design drew this line
 *      unconditionally), so a missing key never makes an existing screen lose a line of text.
 *   2. It matches this layer's own prior behaviour (before this gate the caption was drawn
 *      whenever the product was not sold out), so existing hosts need zero changes and the
 *      existing structural snapshot baselines stay byte-identical.
 * The backend contract for `show_stock` (`openspec/specs/backend/sdk-config.md`) explicitly
 * declares NO default for this field — unlike its siblings `show_pv_num` /
 * `video_title_scroll`, whose rows do say "未設定時為 1". So this fallback MUST NOT be
 * justified as "matching the backend default", and no comment / doc here may claim one exists.
 *
 * ⚠️ NOT THE SAME SIGNAL as core `LBVideoItem.showStock: boolean`, which carries
 * `POST /sdk/widget`'s per-video `show_stock`. Different endpoint, different channel; this
 * layer neither reads nor reuses that one, and nothing here claims the two are the same
 * setting (the backend contract only documents where `extensions.show_stock` comes from).
 *
 * The normalized value MUST NOT be written back into any view-model.
 */
export function normalizeShowStock(raw: unknown): boolean {
  return !(raw === 0 || raw === '0' || raw === false);
}

/**
 * Whether the「只剩庫存 N 組」caption is drawn — the SINGLE predicate for that question.
 *
 * An AND of two INDEPENDENT gates that MUST NOT be collapsed into one another:
 *   • `isSoldOut` (= `qty.max === 0`) — "is there a stock number worth mentioning" (DATA
 *     state). When sold out the price row already reads「已售完」, so「只剩庫存 0 組」next
 *     to it would contradict itself. This pre-existing rule has nothing to do with merchant
 *     settings and MUST NOT be relaxed by `showStock`.
 *   • `showStock` — "is the merchant willing to expose the stock number at all"
 *     (backend / merchant capability gate; see {@link normalizeShowStock}).
 *
 * Consequence, and it is deliberate: on a SOLD-OUT product `showStock` is a no-op.
 *
 * The component body MUST NOT restate this condition, and MUST NOT test `isSoldOut`
 * directly to decide the CAPTION (its other uses in the same component — stepper enablement,
 * CTA fill, the「已售完」price treatment — are untouched by this rule).
 *
 * Signature deliberately identical in shape to iOS `showsStockCaption(showStock:isSoldOut:)`
 * and Android `showsStockCaption(showStock, isSoldOut)` so the three AND gates read the same;
 * only what feeds them differs (RN normalizes at this leaf, see {@link normalizeShowStock}).
 */
export function showsStockCaption(showStock: boolean, isSoldOut: boolean): boolean {
  return showStock && !isSoldOut;
}

/**
 * The detail-sheet presentation mode (rb-rn-add-to-cart-route, parity iOS):
 *   • `detail`    — the FULL browse sheet (header 商品明細, 4:3 photo, a centered inline
 *                   收藏 button in the body + a 2-slot [分享][CTA] footer,
 *                   rb-rn-product-sheet-resize-fav-inline). Opened by the list 明細鈕 / 商品名.
 *   • `addToCart` — the COMPACT add-to-cart sheet (header 加入購物車, 96×96 horizontal
 *                   product card aligned with NotifyRestock, CTA-only footer — NO 收藏 /
 *                   分享). Opened by the list 加購鈕.
 */
export type ProductDetailPresentation = 'detail' | 'addToCart';

/** Props for the family-3 product-detail sheet (surface 2). */
export interface ProductDetailProps {
  /** The resolved reference-ui theme (FIRST, always). */
  readonly theme: ReferenceUITheme;
  /** The product-detail this sheet renders (`productDetailState`). Read-only. */
  readonly detail: LBProductDetailState;
  /**
   * Presentation mode (`detail` = full browse / `addToCart` = compact add). Defaults
   * to `detail` so existing call-sites / snapshots are unchanged. Drives the header
   * title, the product-image treatment (4:3 photo vs 96×96 compact card), and the
   * footer (2-slot [分享][CTA] vs CTA-only). Read-only.
   */
  readonly presentation?: ProductDetailPresentation;
  /**
   * rb-rn-product-real-images (parity iOS `live`): when `false` (snapshot / demo —
   * the DEFAULT) the product image draws the deterministic placeholder only (baselines
   * unchanged). When `true` (host runtime) the image loads the RESOLVED product photo
   * over the placeholder via a network-uri `<Image>` (falls back to the placeholder on
   * error). WHICH photo is resolved follows the selected spec — see
   * `resolvedProductPhoto.ts` (rn-product-sheet-spec-photo-reference-ui); it is NOT
   * unconditionally `detail.photos[0]`.
   */
  readonly live?: boolean;
  /**
   * Variant-picker snapshot (`variantState` — `groups` / `selection`). A chip is
   * selected when `selection[groupIndex] === optionIndex`. Read-only.
   */
  readonly variant: LBVariantState;
  /**
   * Qty-stepper snapshot (`qtyState` — `{ qty, min, max }`). Sold-out → `max === 0`
   * (stepper + CTA disabled). Read-only.
   */
  readonly qty: LBQtyState;
  /**
   * 商品說明（`LBProduct.brief`）— `detail` 呈現在價格下方畫一段說明（對齊設計 ProductDetailSheet
   * 的說明文字）。`LBProductDetailState` 不帶 `brief`，故由容器 / `ProductSheetsModel` 從 products
   * 快照以 `detail.productId` 解析後傳入（`briefFor`）。空字串 → 不畫（既有無 brief 的 demo /
   * snapshot byte-identical）。`addToCart` 呈現不畫。Read-only. Defaults to `''`.
   */
  readonly brief?: string;
  /**
   * 商品介紹（`LBProduct.description`，`add-product-description-core-rn`）— `detail` 呈現在
   * 「商品介紹」文字區（`productIntroSection`，design R21）顯示的文案來源。與上方 `brief` 同一
   * D-1 sub-view 輸入模式：`LBProductDetailState` 不帶 `description`，故由容器 /
   * `ProductSheetsModel` 從 products 快照以 `detail.productId` 解析後傳入
   * （`descriptionForProduct`）。**顯示規則自 `rb-rn-product-intro-bgcolor-and-hide-empty` 起與
   * `brief` 完全一致**（反轉 `rb-rn-product-intro-real-data` 同一天訂下的「恆顯示 + fallback」
   * 規則，僅限 RN，使用者明確要求；iOS/Android/Flutter 維持恆顯示 + fallback 不變）——空字串時
   * 本區塊（含標題）整塊不畫，MUST NOT 顯示任何 fallback 文案。`addToCart` 呈現不畫此區塊，不受
   * 此 prop 影響。Read-only. Defaults to `''`.
   */
  readonly description?: string;
  /**
   * 「請選規格」guard flag (`selectSpecRequired`). Read-only. RETAINED for call-site / test
   * signature stability — this component NO LONGER renders the prompt (it is hoisted to the
   * container's overlay root, `SelectVariantPromptModal`). The container (`ProductSheetsView`)
   * reads `model.needsVariantSelection` directly to drive that modal.
   */
  readonly needsVariantSelection: boolean;
  /** Add-to-cart failure flag (`addToCartFailed`). Read-only. */
  readonly addToCartFailed: boolean;
  /**
   * 加購「請求中」loading flag (rb-rn-cart-add-loading-state) — 由容器以 `ProductSheetsModel`
   * .addToCartInFlight 經 320ms 防閃爍 floor derive 後傳入。`true` → CTA 切 spinner +「加入中…」
   * （保 accent 底、點擊 no-op），qty stepper / 規格 chips 鎖定。Defaults to `false`（既有 snapshot
   * baseline byte-identical）。Read-only.
   */
  readonly addToCartInFlight?: boolean;
  /**
   * 收藏（到貨追蹤 type=1）flag (`awaitEnabled(goodsGpn)`, resolved by the container
   * from `detail.productId`). Drives the 收藏鈕 fill / label. Read-only — this layer
   * holds NO second copy. Defaults to `false`.
   */
  readonly faved?: boolean;
  /**
   * Whether the inline 收藏鈕 (favorite button, below) mounts at all
   * (rb-rn-subscribe-favorite-visibility-toggle). `false` (DEFAULT) — a deliberate reversal of
   * the previous always-visible behaviour (this layer used to draw it unconditionally in
   * `.detail`; a host now opts in with `true`). Orthogonal to `faved` (which state it shows) and
   * to `onToggleFavorite` (its tap behaviour once mounted) — this flag only decides whether it
   * is drawn. Only affects `.detail`; `.addToCart` never had a 收藏鈕 and stays unaffected
   * regardless of this flag (see the existing `!isAddToCart` gate on `favButtonBlock` below).
   * The container (`ProductSheetsView`) forwards `config.showFavorite` verbatim — this is the
   * ONE place the fallback is decided.
   */
  readonly showFavorite?: boolean;
  /**
   * rb-rn-live-hide-product-share (design R12, parity iOS `rb-ios-live-hide-product-share`):
   * `false` (DEFAULT) — the 分享鈕 (share button) in the `.detail` footer renders as
   * usual. `true` (進行中直播, `ProductSheetsModel.isLive`, `liveStatus === 1`) — the 分享鈕
   * MUST NOT render (a genuinely-live product has no committed 「開始銷售時間」, so a share
   * link can't carry correct `?t=beginTime` timing the way a VOD / finished-live-replay link
   * can). The 收藏鈕 (favorite button) is UNAFFECTED BY `isLive` — its own visibility is an
   * INDEPENDENT concern governed by {@link showFavorite} (rb-rn-subscribe-favorite-visibility-
   * toggle; default off, a host opts in). Distinct semantics from the existing `live` prop
   * (real-image loading flag) — do NOT conflate the two.
   */
  readonly isLive?: boolean;
  /**
   * rb-rn-show-stock-caption-toggle (design R15) — the merchant's `extensions.show_stock`
   * setting, handed over AS THE RAW WIRE VALUE (`unknown`; the container passes it straight
   * through from `LivebuyPlayerConfig.showStock`, which in turn takes it straight from the
   * host's `sdkConfig.extensions['show_stock']`). This component owns the ONE fallback:
   * {@link normalizeShowStock}. Omitted → `undefined` → "the backend sent nothing" → the
   * caption is drawn, so existing call-sites and structural snapshot baselines are unchanged.
   *
   * Only `false` / the number `0` / the LITERAL string `'0'` turn it off; everything else
   * (including `null`, `''`, `' 0 '`, `'false'`) draws it. See {@link normalizeShowStock} for
   * why the comparison is strict and why the fallback lands on "show" (it is NOT because the
   * backend defaults to `1` — that contract declares no default for this field).
   *
   * Gated together with the pre-existing sold-out rule as an AND ({@link showsStockCaption}):
   * a sold-out product never shows the caption regardless of this flag. Distinct from the two
   * other flags in this block — `live` (load real photos) and `isLive` (hide the share button
   * during an ongoing live) — do NOT conflate the three. Also distinct from core
   * `LBVideoItem.showStock`, a same-named field fed by `POST /sdk/widget`; this prop is
   * neither wired to nor derived from it.
   */
  readonly showStock?: unknown;
  /**
   * The sheet's cap height, a fraction of screen height, forwarded VERBATIM to
   * `SheetScaffold`'s `capPct` (rb-rn-sheetkit-resize-dismiss-unify — the shared
   * `BottomSheetPresenter` drag gesture feeds this for BOTH `.detail` and `.addToCart`, no
   * more `.addToCart`-only exclusion). `undefined` (demo / snapshot call-sites, or ANY
   * presentation the user has not yet dragged the handle on — the floor measurement alone
   * never reports) → `SheetScaffold` falls back to its own default: content-sized 0.5 for
   * `.detail`, fixed 0.4 (`fillToCap`) for `.addToCart` — unchanged from before this prop
   * existed, and `.detail` keeps tracking actual content changes (variant chips, failure
   * banner, …) until a drag happens.
   */
  readonly heightPct?: number;
  /** Host-wired variant chip tap → `template.selectVariant(gi, oi)`. Default no-op. */
  readonly onSelectVariant?: (groupIndex: number, optionIndex: number) => void;
  /** Host-wired direct qty set → `template.setQty(n)`. Default no-op. */
  readonly onSetQty?: (qty: number) => void;
  /** Host-wired qty `+` → `template.incQty()`. Default no-op. */
  readonly onInc?: () => void;
  /** Host-wired qty `-` → `template.decQty()`. Default no-op. */
  readonly onDec?: () => void;
  /** Host-wired 加入購物車 → `template.addToCart()`. Default no-op. */
  readonly onAddToCart?: () => void;
  /** Host-wired 收藏 toggle → `template.toggleAwait(goodsGpn)`. Default no-op. */
  readonly onToggleFavorite?: () => void;
  /**
   * Host-wired 分享 tap (the `.detail` footer's leading slot). Share is a HOST
   * CONCERN — the headless SDK exposes no share route, so reference-ui only FORWARDS
   * the intent to this callback; it NEVER builds share logic / calls core / template.
   * Default no-op (demo / snapshot instances render correctly action-free).
   */
  readonly onShare?: () => void;
  /**
   * Host-wired close / dismiss (the top-right close circle). The container wires it to
   * `model.closeProductDetail()` (clears the open detail so a re-tap of the SAME product
   * re-opens — diff-then-notify, parity iOS). Default no-op (demo / snapshot render
   * correctly action-free; the close circle is then inert chrome).
   */
  readonly onDismiss?: () => void;
  /**
   * Host-wired zoom badge tap → container opens the full-frame `ProductImageZoomOverlay`
   * (rb-rn-product-image-zoom-lightbox). Omitted (demo / snapshot) → the badge renders
   * byte-identical to the prior decorative badge (no `Pressable`; tap inert).
   *
   * rb-rn-product-detail-image-gallery (design R34): the callback now receives the photo URL
   * CURRENTLY shown at the tapped badge — the `.detail` gallery's selected photo, or
   * `.addToCart`'s single `photo.primaryPhoto` (unaffected by the gallery). The container
   * forwards this straight into `ProductImageZoomOverlay`'s `overridePhotoURL` prop so the
   * lightbox magnifies exactly what the user was looking at. The argument MAY be `undefined`
   * (no resolvable photo — the placeholder was showing); existing call sites that ignore the
   * argument are source-compatible.
   */
  readonly onZoomImage?: (photoURL?: string) => void;

  // -- rb-rn-product-detail-recommendations (design R21) ----------------------------------
  //
  // 「商品介紹」文字區 + 「更多商品」推薦格。Both `.detail`-only (never drawn in `.addToCart`,
  // regardless of these flags — hard-coded below alongside the existing `isAddToCart` branch).

  /**
   * Shows the「商品介紹」text section (below the 商品說明/`brief` block). Default `false` — a
   * DELIBERATE RN-specific baseline-protection polarity (unlike iOS/Android's `default true` +
   * "existing tests opt out"): RN's ~30 existing `ProductDetail.test.tsx` cases (8 of them
   * `toMatchSnapshot()`-guarded __snapshots__ goldens, CLAUDE.local.md「不要動的地方」) construct
   * this component WITHOUT any new prop, so defaulting to `false` keeps every one of them
   * byte-identical with ZERO edits, while the real production call site
   * (`ProductSheetsView.tsx`) passes `true` unconditionally for `.detail` — functionally
   * equivalent production behaviour to iOS/Android's "恆顯示" contract, achieved the other way
   * round. MUST NOT be affected by nested drill-in (`isBack`) — the intro section always shows
   * for ANY `.detail` open when the container passes `true`.
   */
  readonly showsProductIntro?: boolean;
  /**
   * Shows the「更多商品」2-column grid section (up to `RECOMMENDATIONS_MAX` rows), reading
   * `detail.recommendations` (`expose-other-goods-recommendations-template`). Default `false`
   * (same RN-specific baseline-protection rationale as {@link showsProductIntro}). The container
   * passes `true` for a
   * TOP-LEVEL detail and `false` for a NESTED (breadcrumb non-empty) one — a nested detail MUST
   * NOT render its own recommendations (design.md, 不做無限遞迴 UI).
   */
  readonly showsRecommendations?: boolean;
  /**
   * The sheet header's close circle renders「返回」(‹) instead of「✕」when `true` — the container
   * sets this from `detailBreadcrumb.length > 0` (a nested drill-in). Forwarded VERBATIM to
   * `SheetHeaderCloseButton`; this component has no opinion on what `onDismiss` DOES when
   * `isBack` is true (that's `ProductSheetsView.backOrDismiss`'s job). Default `false`.
   */
  readonly isBack?: boolean;
  /**
   * Host-wired 推薦卡**卡片本體**tap → 巢狀明細 SWAP + BREADCRUMB (design.md D1). Default no-op
   * (demo / snapshot render correctly action-free).
   */
  readonly onOpenRecommendation?: (recommendation: LBProductRecommendation) => void;
  /**
   * Host-wired 推薦卡**加購鈕**tap → 巢狀明細 SWAP + BREADCRUMB, `actionMode='addToCart'`
   * (design.md D1). Default no-op.
   */
  readonly onQuickAddRecommendation?: (recommendation: LBProductRecommendation) => void;
  /**
   * Host-wired 推薦卡**播放圖示**tap → 换片 (design.md D3): the container forwards the
   * recommendation's OWN `videoId` (never `undefined` — the grid card only shows the play
   * button when `videoId != null`, see `ProductRowView`'s `onPlayClick != null` visibility gate).
   * MUST NOT dismiss the sheet / push the breadcrumb — a SEPARATE trigger path from
   * {@link onOpenRecommendation} / {@link onQuickAddRecommendation}. Default no-op.
   */
  readonly onPlayRecommendation?: (videoId: string) => void;
}

/**
 * The family-3 product-detail sheet for one {@link LBProductDetailState}. Renders
 * the product photo placeholder / name / price (with strike-through original), the
 * variant chip picker (one chip group per `variant.groups` entry, FLEX-WRAP via RN
 * Yoga `flexWrap: 'wrap'`), the qty stepper, the centered inline 收藏鈕 (body, standing
 * alone), and the footer's primary 加入購物車 CTA — plus the「請選規格」prompt and the
 * retryable add-to-cart failure banner when their guard flags are set.
 */
export function ProductDetail(props: ProductDetailProps): ReactElement {
  const {
    theme,
    detail,
    presentation = 'detail',
    live = false,
    brief = '',
    description = '',
    variant,
    qty,
    // needsVariantSelection 仍在 ProductDetailProps（簽章不變、容器照常傳入），但本元件不再消費它
    // ——prompt 已 hoist 到容器 overlay root（SelectVariantPromptModal）。故不 destructure 以免 unused。
    addToCartFailed,
    addToCartInFlight = false,
    faved = false,
    showFavorite = false,
    isLive = false,
    // RAW hand-off from the container — normalized ONCE below via `normalizeShowStock`.
    showStock,
    heightPct,
    onSelectVariant,
    onSetQty,
    onInc,
    onDec,
    onAddToCart,
    onToggleFavorite,
    onShare,
    onDismiss,
    onZoomImage,
    showsProductIntro = false,
    showsRecommendations = false,
    isBack = false,
    onOpenRecommendation,
    onQuickAddRecommendation,
    onPlayRecommendation,
  } = props;

  // `.addToCart` (the list 加購鈕) is the COMPACT sheet — 96×96 horizontal product
  // card + CTA-only footer (no 收藏 / 分享). `.detail` keeps the FULL browse sheet.
  const isAddToCart = presentation === 'addToCart';

  // 「更多商品」推薦格 (rb-rn-product-detail-recommendations, design.md D1) — `.slice(0,
  // RECOMMENDATIONS_MAX)`, the裁切 decision belongs to reference-ui (`expose-other-goods-
  // recommendations-template` design.md D1). Cap raised 4 → 12 (`rb-rn-recommendations-cap-
  // raise-to-twelve`) — same slice, higher limit; layout below is an unbounded-rows `chunk(…, 2)`
  // grid, no fixed-row assumption to adjust. `.addToCart` never shows this section regardless of
  // `showsRecommendations`.
  const recommendations = detail.recommendations.slice(0, RECOMMENDATIONS_MAX);

  // Product photo — SPEC-AWARE (rn-product-sheet-spec-photo-reference-ui, parity iOS
  // `ios-product-sheet-spec-photo-reference-ui`). The main image follows the SELECTED SPEC
  // (`variant.selectedSpec`), falling back to the product level via the ladder in
  // resolvedProductPhoto.ts. Resolved ONCE here and consumed by BOTH the `.addToCart`
  // 96×96 compact card and the `.detail` 4:3 photo below, so the two presentations
  // structurally cannot show different images.
  //
  // `primaryPhoto` is the first NON-BLANK entry of the winning source — NOT `photos[0]`
  // (see resolvedProductPhoto.ts; a `photos[0]` reading draws a placeholder for a spec
  // that demonstrably has a photo). Handed to RemoteImage verbatim; RemoteImage does its
  // own trimming when building the uri.
  const photo = resolveProductPhoto(detail, variant.selectedSpec);
  const photoUri = photo.primaryPhoto ?? undefined;

  // -- GALLERY (rb-rn-product-detail-image-gallery, design R34): `.detail` ONLY. `.addToCart`
  // keeps reading `photoUri` above, unaffected. --------------------------------------------
  //
  // The gallery's index is a LOCAL presentation-only state (parity `NowIntroducingCarouselView`'s
  // `index`) — it is NOT part of `photo` and MUST NOT be re-derived by any other consumer.
  //
  // INITIAL SELECTION follows `photo.primaryPhoto`'s POSITION in `photo.photos`, not literal
  // index 0. `resolvedProductPhoto.ts`'s file header is explicit that a leading BLANK entry
  // (e.g. `['', 'https://cdn/spec-rose.jpg']`) is a source that IS drawable — `primaryPhoto` is
  // already the first NON-BLANK entry precisely so callers never show a placeholder for a photo
  // that demonstrably exists. Seeding the gallery at literal index 0 would silently reintroduce
  // that exact regression for a product whose winning source happens to lead with a blank. Using
  // `photos.indexOf(primaryPhoto)` REUSES the resolver's own already-computed answer (the SAME
  // predicate, not a second one) rather than re-scanning for blanks here.
  const initialPhotoIndex = photo.primaryPhoto === null ? 0 : Math.max(0, photo.photos.indexOf(photo.primaryPhoto));
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(initialPhotoIndex);

  // A ref so the reset effect below always reads the LATEST resolved photo set without being
  // declared a dependency (see the effect's own comment for why depending on `photo` directly
  // would be wrong here).
  const photoRef = useRef(photo);
  photoRef.current = photo;

  // Reset to the (new) initial selection whenever the OPEN PRODUCT changes (the「更多商品」
  // recommendation drill-in SWAPS `detail` on the SAME mounted `<ProductDetail>` instance — no
  // `key` change, so local state like `selectedPhotoIndex` would otherwise carry over a stale
  // index from the PREVIOUS product's gallery). Deliberately NOT keyed on `variant.selectedSpec`
  // — a spec switch within the SAME product re-resolves `photo.photos` (rn-product-sheet-spec-
  // photo-reference-ui) but is NOT treated as "a new gallery"; the defensive clamp below (not an
  // effect) keeps that case safe even though it does not reset to 0.
  useEffect(() => {
    const p = photoRef.current;
    const idx = p.primaryPhoto === null ? 0 : Math.max(0, p.photos.indexOf(p.primaryPhoto));
    setSelectedPhotoIndex(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.productId]);

  // Defensive clamp (covers the spec-switch case above, and any future caller that shrinks
  // `photo.photos` without a productId change): NEVER index out of range.
  const clampedPhotoIndex = photo.photos.length === 0 ? 0 : Math.min(selectedPhotoIndex, photo.photos.length - 1);
  const currentGalleryPhotoUri = photo.photos.length === 0 ? undefined : photo.photos[clampedPhotoIndex];

  // The gallery is INTERACTIVE (swipe responder + testID + thumbnail strip) only when there is
  // more than one photo to browse. `false` for the existing 0/1-photo fixtures — the swipe
  // responder's handlers and the container testID are then NOT attached at all (not merely
  // inert), so the existing single-photo structural snapshot baselines stay byte-identical.
  const gallerySwipeable = photo.photos.length > 1;

  // Refs so the (once-created) PanResponder reads the current index / length without stale
  // closures (parity `ProductImageZoomOverlay`'s / `NowIntroducingCarouselView`'s pan refs).
  const galleryIndexRef = useRef(clampedPhotoIndex);
  galleryIndexRef.current = clampedPhotoIndex;
  const galleryLenRef = useRef(photo.photos.length);
  galleryLenRef.current = photo.photos.length;

  const galleryResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 6,
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -GALLERY_SWIPE_DX) {
          setSelectedPhotoIndex(clampIndex(galleryIndexRef.current + 1, galleryLenRef.current));
        } else if (g.dx > GALLERY_SWIPE_DX) {
          setSelectedPhotoIndex(clampIndex(galleryIndexRef.current - 1, galleryLenRef.current));
        }
      },
    }),
  ).current;

  // -- SCALE-DOWN-LETTERBOX main-image layout (rb-rn-product-detail-main-image-scale-down-
  // letterbox) — `.detail` main photo ONLY, and ONLY once `live` AND the photo has actually
  // measured: the CONTAINER's own width (via `onLayout`) and the loaded image's NATIVE pixel
  // size (via `RemoteImage`'s opt-in `onLoad`). Until BOTH are known — or whenever `live` is
  // false (snapshot / demo) — `mainPhotoLetterbox` stays `null` and the container below keeps
  // its EXISTING fixed 168-height / `cover` layout byte-identical (Non-Goal: the `live ===
  // false` path MUST NOT be touched by any of this).
  const [mainPhotoContainerWidth, setMainPhotoContainerWidth] = useState<number | null>(null);
  const [mainPhotoNaturalSize, setMainPhotoNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // A gallery photo swap (swipe / thumbnail tap, or a different product's initial selection —
  // `currentGalleryPhotoUri` already reflects both) invalidates the PREVIOUS photo's measured
  // natural size; it must never be reused to size the NEWLY selected photo (design.md D2's
  // 「per-URL 生命週期」requirement, same discipline as `RemoteImage`'s own `failed`-latch reset
  // on `trimmed` above). `mainPhotoContainerWidth` is intentionally NOT reset here — the
  // CONTAINER itself does not remount / resize across a gallery page flip.
  useEffect(() => {
    setMainPhotoNaturalSize(null);
  }, [currentGalleryPhotoUri]);

  const handleMainPhotoLayout = (e: LayoutChangeEvent): void => {
    setMainPhotoContainerWidth(e.nativeEvent.layout.width);
  };
  const handleMainPhotoLoad = (size: { width: number; height: number }): void => {
    setMainPhotoNaturalSize(size);
  };

  // `null` until BOTH measurements are in (see comment above) — the ONLY gate the render below
  // consults to pick between the old fixed-168/`cover` layout and the new dynamic one.
  const mainPhotoLetterbox =
    live && mainPhotoContainerWidth != null && mainPhotoNaturalSize != null
      ? resolveScaleDownLetterbox(mainPhotoContainerWidth, mainPhotoNaturalSize.width, mainPhotoNaturalSize.height)
      : null;

  // -- Derived presentation (pure) --------------------------------------------

  // Sold-out / out-of-stock (`qty.max === 0`, set by `DefaultQtyStepper`'s bounds
  // rule when `soldOut === 1 || stock <= 0`). Drives the disabled qty stepper +
  // disabled CTA + the「已售完」price treatment.
  const isSoldOut = qty.max === 0;

  // Price line — SPEC-AWARE, SAME-SOURCE (rn-product-sheet-spec-price-reference-ui,
  // parity iOS `ios-product-sheet-spec-price-reference-ui`). The sale price and its
  // struck-through original follow the SELECTED SPEC (`variant.selectedSpec`), falling
  // back to the product level as an ATOMIC PAIR — never one field from each source (that
  // mix is the fake-discount bug; see resolvedPriceDisplay.ts).
  //
  // Resolved ONCE here and consumed by BOTH price rows below. Unlike iOS (which has a
  // shared `priceRow` builder) RN draws the compact `.addToCart` card and the full
  // `.detail` block as two SEPARATE JSX branches, so this single resolution is itself
  // part of the same-source guarantee: the two presentations structurally cannot show
  // different prices. `hasOriginalPrice` rides along on the same result, so WHETHER the
  // strike-through is drawn always agrees with WHICH string is drawn.
  const price = resolvePriceDisplay(detail, variant.selectedSpec);

  // 「Sale」促銷徽章 (rb-rn-product-sale-badge, design `screens.jsx` `ProductDetailSheet`
  // ~L812-819 / `AddToCartSheet` ~L971-975): drawn in BOTH `.detail` and `.addToCart`
  // when there is a struck-through original price AND the product is not sold out.
  // MUST reuse the SAME `hasOriginalPrice` / `isSoldOut` the price row already computed
  // above — re-deriving "has original" from a raw field here would risk disagreeing with
  // the price row's same-source guarantee (see resolvedPriceDisplay.ts file header).
  const showSaleBadge = price.hasOriginalPrice && !isSoldOut;

  const stockCaption = `${STOCK_CAPTION_PREFIX}${qty.max}${STOCK_CAPTION_SUFFIX}`;

  // Whether that caption is drawn at all (rb-rn-show-stock-caption-toggle). The RAW
  // `showStock` hand-off is normalized HERE — exactly once, `normalizeShowStock` is not
  // called anywhere else in this file — and the visibility question is answered by the ONE
  // predicate `showsStockCaption` (merchant gate AND not-sold-out). The qty row below MUST
  // NOT re-derive either half; in particular it MUST NOT test `isSoldOut` for the caption.
  const stockCaptionVisible = showsStockCaption(normalizeShowStock(showStock), isSoldOut);

  // 加購請求中 → 鎖定 stepper / 規格 / CTA（rb-rn-cart-add-loading-state，不可改 payload）。
  const canDec = !isSoldOut && !addToCartInFlight && qty.qty > qty.min;
  const canInc = !isSoldOut && !addToCartInFlight && qty.qty < qty.max;

  // The add-to-cart intent — re-used by the CTA and the failure banner's 重試
  // (both disabled when sold out OR a request is already in flight). reference-ui
  // NEVER calls core directly.
  const handleAddToCart = (): void => {
    if (isSoldOut || addToCartInFlight) return;
    onAddToCart?.();
  };

  // -- Variant chips (FLEX-WRAP via RN Yoga `flexWrap: 'wrap'`, one group per `variant.groups`) --

  const renderVariantChip = (
    groupIndex: number,
    optionIndex: number,
    label: string,
  ): ReactElement => {
    const selected = variant.selection[groupIndex] === optionIndex;
    return (
      <Pressable
        key={`g${groupIndex}-o${optionIndex}`}
        testID={variantChip(groupIndex, optionIndex)}
        accessibilityRole="button"
        // 加購請求中鎖定規格（onPress no-op；外層容器 opacity dim）。
        onPress={
          addToCartInFlight
            ? undefined
            : () => onSelectVariant?.(groupIndex, optionIndex)
        }
        style={{
          paddingHorizontal: 14,
          paddingVertical: 7,
          // marginRight + marginBottom 提供 flex-wrap 換列後的水平與垂直行距（對齊設計稿
          // LBPVariantPicker gap:8、Android FlowRow verticalArrangement spacedBy(8.dp)、
          // iOS ChipFlowLayout vSpacing 8）。
          marginRight: 8,
          marginBottom: 8,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: selected ? theme.accent : STROKE_STRONG,
          // Accent-tinted fill when selected (the design's 8%-accent chip,
          // LBPVariantPicker — background accent+'14', text accent). The structural
          // snapshot guards the prop; pixel tint matches the iOS / Android / Flutter
          // baselines.
          backgroundColor: selected ? theme.accent + '14' : 'transparent',
        }}
      >
        {/* label 無 `numberOfLines`（RN Text 預設行數不限、softWrap）→ 正常長度單列自然寬度；
            單一超長選項在 flex-wrap 容器內折行成多行、pill 增高、全文完整可見、永不截斷（對齊
            設計稿 `white-space: normal` + Android 折行 + iOS chip 無 `lineLimit`）。MUST NOT 加
            `numberOfLines={1}` + ellipsis（會截成「…」看不到全文）。 */}
        <Text
          style={{
            color: selected ? theme.accent : theme.text,
            fontSize: 13 * theme.fontScale,
            fontWeight: selected ? 'bold' : '500',
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderVariantGroup = (groupIndex: number): ReactElement => {
    const group = variant.groups[groupIndex]!;
    return (
      <View key={`group-${groupIndex}`} style={{ marginTop: groupIndex > 0 ? 16 : 0 }}>
        <Text
          style={{
            color: theme.text,
            fontSize: 13 * theme.fontScale,
            fontWeight: '600',
          }}
        >
          {group.label}
        </Text>
        {/* flex-wrap 容器（RN Yoga 原生 `flexWrap: 'wrap'`）：chip 依自然寬度排列、滿列自動換到
            下一列、完整顯示每個選項全文，對齊設計稿 `LBPVariantPicker` 的 `flexWrap:'wrap'` 與
            iOS（ChipFlowLayout）/ Android（FlowRow）parity。chip 的 marginRight/marginBottom
            提供間距（取代舊的逐列 Row + marginTop）。NOT 固定每列 N 個 chunked Row（會把超出寬度
            的 chip 裁切到框外）；仍 NO ScrollView / FlatList（flex-wrap 的 View 非 scrollable）。 */}
        <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
          {group.options.map((label, optionIndex) =>
            renderVariantChip(groupIndex, optionIndex, label),
          )}
        </View>
      </View>
    );
  };

  // -- Qty stepper button (28×28 rounded square, dimmed + non-tappable when off) -

  const renderStepButton = (
    glyph: string,
    enabled: boolean,
    onPress: (() => void) | undefined,
    testID: string,
  ): ReactElement => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={enabled ? onPress : undefined}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: STROKE_STRONG,
        backgroundColor: enabled ? BG_SUNKEN : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: enabled ? theme.text : TEXT_FAINT,
          fontSize: 16,
          fontWeight: 'bold',
        }}
      >
        {glyph}
      </Text>
    </Pressable>
  );

  // Pinned header (grab handle + centered title + trailing close circle). The close
  // circle forwards `onDismiss` (container → `closeProductDetail()`, parity iOS); inert
  // chrome when omitted (demo / snapshot).
  const header = (
    <View>
      {/* Grab handle (LBPBottomSheet handle — shared styling with the family). */}
      <View style={{ paddingTop: 8, paddingBottom: 4, alignItems: 'center' }}>
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 99,
            backgroundColor: STROKE_STRONG,
          }}
        />
      </View>

      {/* Sheet header (LBPSheetHeader — centered title + trailing close circle). */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          alignItems: 'center',
          justifyContent: 'center',
          // addToCart 無標題時，給 header 一個穩定高度（避免只剩絕對定位的關閉鈕而塌縮）；
          // 44 與 detail 的標題版 header + iOS/Android/Flutter close-only header 等高。
          ...(isAddToCart ? { minHeight: 44 } : null),
        }}
      >
        {/* 標題只在 detail 呈現畫「商品明細」；addToCart 無標題——只右上角關閉鈕（對齊設計
            AddToCartSheet header 的 flex-end close-only，rb-rn-product-sheet-detail-polish 問題 3）。 */}
        {!isAddToCart && (
          <Text
            style={{
              color: theme.text,
              fontSize: 15 * theme.fontScale,
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            {HEADER_TITLE}
          </Text>
        )}
        {/* Shared transparent close (rb-rn-sheet-header-close-unify): replaces the prior deep
            `bgSunken` circle so detail / add-to-cart match the list & VideoInfoPanel. Behavior
            unchanged (onDismiss → closeProductDetail). */}
        <View style={{ position: 'absolute', right: 12 }}>
          <SheetHeaderCloseButton theme={theme} onPress={onDismiss} isBack={isBack} />
        </View>
      </View>
    </View>
  );

  // -- Shared blocks reused across `.detail` (grouped inside the grey/white background
  // treatment below, rb-rn-product-intro-bgcolor-and-hide-empty) and `.addToCart` (rendered
  // plain, structurally unchanged) — extracted so BOTH presentations render the SAME JSX
  // rather than duplicating it, which would risk the two presentations drifting out of sync.

  /** Variant chip groups (one per `variant.groups` entry), preceded by their OWN hairline
   *  divider. `null` when the product has no variant groups. */
  const variantChipsBlock: ReactElement | null =
    variant.groups.length > 0 ? (
      <View>
        <View style={{ height: 1, marginVertical: 18, backgroundColor: STROKE }} />
        {/* 加購請求中 → dim 規格區（onPress 於 chip 已 gate no-op）。非 in-flight 時不帶
            style prop → 既有 snapshot baseline byte-identical（條件式 spread）。 */}
        <View {...(addToCartInFlight ? { style: { opacity: 0.5 } } : {})}>
          {variant.groups.map((_g, gi) => renderVariantGroup(gi))}
        </View>
      </View>
    ) : null;

  /** 數量 row (label + stock caption + LBPQtyStepper), preceded by an UNCONDITIONAL hairline
   *  divider (rendered whether or not variant chips drew one above).
   *  The stock caption is gated by `stockCaptionVisible` = `showsStockCaption(
   *  normalizeShowStock(showStock), isSoldOut)` — an AND of the merchant's
   *  `extensions.show_stock` setting and the pre-existing sold-out rule
   *  (rb-rn-show-stock-caption-toggle). When it is off the caption `Text` is simply NOT
   *  built: no placeholder, no substitute copy. Nothing else in this row moves, and that is
   *  a STRUCTURAL guarantee rather than a numeric one —
   *    • the stepper is pushed to the trailing edge by the `<View style={{ flex: 1 }} />`
   *      right after the 數量 label (that spacer is LOAD-BEARING; it must not be removed or
   *      given a fixed width), and
   *    • the 12 gap between caption and stepper is the CAPTION'S OWN `marginRight`, not a
   *      row-level gap, so it disappears with the caption instead of leaving a hole (this
   *      row has no `gap` / auto-spacing of any kind). */
  const qtyRowBlock: ReactElement = (
    <>
      <View style={{ height: 1, marginVertical: 18, backgroundColor: STROKE }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={{
            color: theme.text,
            fontSize: 14 * theme.fontScale,
            fontWeight: '600',
          }}
        >
          {QTY_LABEL}
        </Text>
        <View style={{ flex: 1 }} />
        {stockCaptionVisible ? (
          <Text
            style={{
              marginRight: 12,
              color: TEXT_DIM,
              fontSize: 12 * theme.fontScale,
            }}
          >
            {stockCaption}
          </Text>
        ) : null}
        {/* LBPQtyStepper: `-`  value  `+`. Disabled entirely when sold out. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {renderStepButton(GLYPH_MINUS, canDec, onDec, LBTestIDs.qtyMinus)}
          <View style={{ width: 24, marginHorizontal: 10 }}>
            <Text
              style={{
                textAlign: 'center',
                color: qty.qty > 0 ? theme.accent : TEXT_FAINT,
                fontSize: 16 * theme.fontScale,
                fontWeight: 'bold',
              }}
            >
              {`${qty.qty}`}
            </Text>
          </View>
          {renderStepButton(GLYPH_PLUS, canInc, onInc, LBTestIDs.qtyPlus)}
        </View>
      </View>
    </>
  );

  /** INLINE 收藏鈕 (rb-rn-product-sheet-resize-fav-inline, design R19): a HORIZONTAL
   *  icon+text row, centered, standing ALONE at the bottom of white block #1 — `.detail`
   *  only (`.addToCart` never had it). faved === false → 空心 heart + theme.text +「收藏」;
   *  faved === true → 實心 heart + accent +「已收藏」. Tap → onToggleFavorite. reference-ui
   *  never flips the flag itself — `faved` reads awaitEnabled(goodsGpn).
   *
   *  rb-rn-subscribe-favorite-visibility-toggle: gated by `showFavorite` (DEFAULT false, AND'd
   *  with the pre-existing `!isAddToCart` presentation gate) — when off, this node is simply
   *  not built (no placeholder, no substitute copy), same "整行移除" discipline as the sibling
   *  `showsStockCaption` gate elsewhere in this file. */
  const favButtonBlock: ReactElement | null = !isAddToCart && showFavorite ? (
    <>
      {/* hairline 分隔線（rb-rn-product-sheet-qty-fav-divider，對齊
          design/templates/minimal/screens.jsx:ProductDetailSheet 872 行 + Android
          ProductDetailSheet.kt 的 Hairline 版位）：數量列與收藏鈕之間。 */}
      <View style={{ height: 1, marginVertical: 18, backgroundColor: STROKE }} />
      <Pressable
        testID={LBTestIDs.favButton}
        accessibilityRole="button"
        onPress={onToggleFavorite}
        style={{
          marginTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {faved ? (
          <HeartFillGlyph color={theme.accent} size={18} />
        ) : (
          <HeartGlyph color={theme.text} size={18} />
        )}
        <Text
          style={{
            marginLeft: 6,
            fontSize: 13 * theme.fontScale,
            color: faved ? theme.accent : TEXT_DIM,
            fontWeight: faved ? 'bold' : '500',
          }}
        >
          {faved ? FAVED_LABEL : FAV_LABEL}
        </Text>
      </Pressable>
    </>
  ) : null;

  /** Add-to-cart failure banner (retryable), shown in BOTH presentations when the route-B
   *  add threw (D-3). */
  const failureBannerBlock: ReactElement | null = addToCartFailed ? (
    <View
      style={{
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        // 8%-accent tint so the ⚠ glyph (full accent) reads on a light
        // surface (parity to the Flutter blueprint's tinted failure banner).
        backgroundColor: theme.accent + '14',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <WarningGlyph color={theme.accent} size={15} />
      <Text
        style={{
          flex: 1,
          marginLeft: 10,
          color: theme.text,
          fontSize: 13 * theme.fontScale,
          fontWeight: '600',
        }}
      >
        {FAILURE_TITLE}
      </Text>
      {/* 重試 re-invokes onAddToCart (disabled when sold out). */}
      <Pressable
        testID={LBTestIDs.addToCartRetry}
        accessibilityRole="button"
        onPress={handleAddToCart}
        style={{
          marginLeft: 10,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.accent,
        }}
      >
        <Text
          style={{
            color: theme.accent,
            fontSize: 13 * theme.fontScale,
            fontWeight: 'bold',
          }}
        >
          {RETRY_LABEL}
        </Text>
      </Pressable>
    </View>
  ) : null;

  // Scrollable body (photo / compact card + name + price + variant chips + qty + failure
  // banner). The SheetScaffold caps it to ½ screen and scrolls the overflow between the
  // pinned header + footer (rb-rn-sheet-pinned-header-footer).
  //
  // BACKGROUND LAYERING (rb-rn-product-intro-bgcolor-and-hide-empty, design
  // `screens.jsx:ProductDetailSheet` L805-895): `.detail` draws a SUNKEN GREY scroll
  // container (`BG_SUNKEN`) as the sole child of `SheetScaffold`'s `<ScrollView>` — it is
  // layered ON TOP of `SheetScaffold`'s own shell background (`theme.background`, white;
  // that component is SHARED chrome serving every sheet, out of this change's scope) and,
  // being the ScrollView's entire content, covers the whole scrollable area. Inside it,
  // each visual group — 縮圖～收藏鈕 (white block #1) / 商品介紹 (white block #2) / 更多商品
  // (white block #3) — is its OWN `theme.background` block, separated by `marginTop: 20` so
  // the grey shows through the gap (matching the design's `bgSunken` outer + per-section
  // `theme.surface.bg` inner). `.addToCart` (the COMPACT sheet) keeps a single plain
  // background — structurally BYTE-IDENTICAL to before this change — matching the design's
  // `AddToCartSheet` (screens.jsx L942-1029), which has no grey/white treatment at all.
  const body = isAddToCart ? (
    <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 }}>
      {/* `.addToCart` — COMPACT 96×96 horizontal product card (aligned with the
          NotifyRestock card): square photo placeholder + name + price inline. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 12,
            backgroundColor: PHOTO_FILL,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 22 * theme.fontScale, fontWeight: '900' }}>
            {monogram(detail.name)}
          </Text>
          {/* Real product image over the placeholder when live (snapshot-safe off). */}
          <RemoteImage live={live} uri={photoUri} borderRadius={12} />
          <ZoomBadge
            diameter={24}
            discColor="rgba(255,255,255,0.85)"
            glyphColor="#15131A"
            style={{ position: 'absolute', right: 6, bottom: 6 }}
            // `.addToCart` has no gallery — always forwards the single resolved photo
            // (rb-rn-product-detail-image-gallery: `onZoomImage` now carries the photo URL).
            // `onZoomImage` omitted (demo / snapshot) → `undefined` here too, so `ZoomBadge`
            // stays inert (no `Pressable`) — byte-identical to before this prop grew an
            // argument. MUST NOT wrap in an always-defined arrow (that would make `ZoomBadge`
            // wrap in a `Pressable` unconditionally, breaking the existing structural baselines).
            onPress={onZoomImage == null ? undefined : () => onZoomImage(photoUri)}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          {/* 「Sale」促銷徽章（rb-rn-product-sale-badge，design `AddToCartSheet`
              ~L971-975）— 比 `.detail` 版小一號，插在商品名稱之上。 */}
          {showSaleBadge ? (
            <View
              style={{
                marginBottom: 4,
                alignSelf: 'flex-start',
                paddingHorizontal: 7,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: theme.accent,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 0.3,
                }}
              >
                {SALE_BADGE_LABEL}
              </Text>
            </View>
          ) : null}
          <Text
            style={{
              color: theme.text,
              fontSize: 15 * theme.fontScale,
              fontWeight: 'bold',
            }}
          >
            {detail.name}
          </Text>
          {isSoldOut ? (
            <Text
              style={{
                marginTop: 8,
                color: SOLD_OUT_COLOR,
                fontSize: 14 * theme.fontScale,
                fontWeight: 'bold',
              }}
            >
              {SOLD_OUT_LABEL}
            </Text>
          ) : (
            <View
              style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-end' }}
            >
              <Text
                style={{
                  color: theme.accent,
                  fontSize: 18 * theme.fontScale,
                  fontWeight: '900',
                }}
              >
                {price.priceShow}
              </Text>
              {price.hasOriginalPrice ? (
                <Text
                  style={{
                    marginLeft: 8,
                    color: TEXT_DIM,
                    fontSize: 12 * theme.fontScale,
                    textDecorationLine: 'line-through',
                  }}
                >
                  {price.originalPriceShow}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </View>
      {variantChipsBlock}
      {qtyRowBlock}
      {failureBannerBlock}
    </View>
  ) : (
    <View style={{ backgroundColor: BG_SUNKEN }}>
      {/* White block #1 — 縮圖～收藏鈕（既有 paddingHorizontal:16 / paddingTop:6 /
          paddingBottom:12 沿用不變，只加 backgroundColor，比照設計稿
          `padding:'0 16px 16px'` 的灰底白卡結構）。 */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: 12,
          backgroundColor: theme.background,
        }}
      >
        {/* Product photo — GALLERY (rb-rn-product-detail-image-gallery, design R34): 4:3
            deterministic placeholder + monogram (real image loads over it when live), now
            swipeable via `PanResponder` when there is more than one resolved photo (NO
            ScrollView — this file's render discipline forbids it, and `NowIntroducingCarouselView`
            already established the "draw only the current frame" convention this mirrors). A
            0/1-photo product gets NEITHER the swipe handlers NOR a testID here — the gallery
            machinery is entirely absent, keeping the existing single-photo structural snapshot
            baselines byte-identical.

            SCALE-DOWN-LETTERBOX (rb-rn-product-detail-main-image-scale-down-letterbox): once
            `mainPhotoLetterbox` resolves (live + both measurements known), the container's own
            height becomes the scaled `displayHeight` (never the old fixed 168) and its
            background turns pure white — replacing the `PHOTO_FILL` placeholder tint, which is
            for "no image yet" only, never for "image loaded, letterboxed" (design.md D1). Until
            then (live===false, OR live===true but not yet measured) the layout is UNCHANGED. */}
        <View
          testID={gallerySwipeable ? LBTestIDs.productDetailPhoto : undefined}
          {...(gallerySwipeable ? galleryResponder.panHandlers : {})}
          onLayout={live ? handleMainPhotoLayout : undefined}
          style={{
            height: mainPhotoLetterbox == null ? 168 : mainPhotoLetterbox.displayHeight,
            borderRadius: 12,
            backgroundColor: mainPhotoLetterbox == null ? PHOTO_FILL : '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* The monogram placeholder glyph is a normal (non-absolute) flow child — it is only
              drawn while there is no loaded-and-measured real photo to show instead (mirrors the
              old always-covered-by-absoluteFill behavior; once the real image is measured it
              becomes the SOLE flow child below, so it alone drives the container's centering —
              see resolveScaleDownLetterbox's doc comment). */}
          {mainPhotoLetterbox == null ? (
            <Text style={{ color: '#FFFFFF', fontSize: 26 * theme.fontScale, fontWeight: '900' }}>
              {monogram(detail.name)}
            </Text>
          ) : null}
          {/* Real product image over the placeholder when live (snapshot-safe off). The
              CURRENTLY selected gallery photo — `photoUri` (always `primaryPhoto`) is
              intentionally NOT used here once there is more than one photo to browse.
              `onLoad` always wired (harmless no-op when `live` is false — `RemoteImage`
              itself renders nothing then). `intrinsicSize` is set only once
              `mainPhotoLetterbox` is known, switching `RemoteImage` from its default
              absolute-fill `cover` overlay to an explicit `displayWidth`×`displayHeight`
              flow child that the container above centers. */}
          <RemoteImage
            live={live}
            uri={currentGalleryPhotoUri}
            borderRadius={12}
            intrinsicSize={
              mainPhotoLetterbox == null
                ? undefined
                : { width: mainPhotoLetterbox.displayWidth, height: mainPhotoLetterbox.displayHeight }
            }
            onLoad={handleMainPhotoLoad}
          />
          {/* Tappable zoom badge (design screens.jsx ZoomBadge): 32 white@0.85 disc +
              magnifier glyph, bottom-trailing inset 10. Tap → onZoomImage opens the lightbox,
              forwarding the CURRENTLY selected gallery photo (not always `primaryPhoto`). */}
          <ZoomBadge
            diameter={32}
            discColor="rgba(255,255,255,0.85)"
            glyphColor="#15131A"
            style={{ position: 'absolute', right: 10, bottom: 10 }}
            // Same "stay inert when omitted" discipline as the `.addToCart` badge above.
            onPress={onZoomImage == null ? undefined : () => onZoomImage(currentGalleryPhotoUri)}
          />
        </View>

        {/* Gallery thumbnail strip (design R34) — ONLY when there is more than one photo to
            browse (`gallerySwipeable`). Tap a thumbnail to jump straight to that photo; every
            NON-current thumbnail carries a translucent `rgba(0,0,0,0.5)` overlay so the
            currently-selected one reads clearly. Plain `Pressable`s in a `flexDirection: 'row'`
            — NOT a `ScrollView` / `FlatList` (this file's render discipline forbids both); the
            strip is not expected to overflow the sheet's own width for realistic photo counts,
            mirroring how the variant-chip row is laid out elsewhere in this file. */}
        {gallerySwipeable ? (
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {photo.photos.map((uri, i) => (
              <Pressable
                key={i}
                testID={productDetailPhotoThumb(i)}
                accessibilityRole="button"
                onPress={() => setSelectedPhotoIndex(i)}
                style={{
                  width: GALLERY_THUMB_SIZE,
                  height: GALLERY_THUMB_SIZE,
                  borderRadius: GALLERY_THUMB_RADIUS,
                  marginRight: i < photo.photos.length - 1 ? GALLERY_THUMB_GAP : 0,
                  overflow: 'hidden',
                  backgroundColor: PHOTO_FILL,
                }}
              >
                <RemoteImage live={live} uri={uri} borderRadius={GALLERY_THUMB_RADIUS} />
                {i !== clampedPhotoIndex ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: GALLERY_THUMB_OVERLAY,
                    }}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* 「Sale」促銷徽章（rb-rn-product-sale-badge，design `ProductDetailSheet`
            ~L812-819）— 插在 4:3 主圖之下、商品名稱之上。 */}
        {showSaleBadge ? (
          <View
            style={{
              marginTop: 12,
              alignSelf: 'flex-start',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: theme.accent,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.3,
              }}
            >
              {SALE_BADGE_LABEL}
            </Text>
          </View>
        ) : null}

        {/* Product name. */}
        <Text
          style={{
            marginTop: showSaleBadge ? 6 : 12,
            color: theme.text,
            fontSize: 16 * theme.fontScale,
            fontWeight: 'bold',
          }}
        >
          {detail.name}
        </Text>

        {/* Price row — sold out → 已售完; in stock → accent priceShow + dim
            strike-through originalPriceShow. */}
        {isSoldOut ? (
          <Text
            style={{
              marginTop: 10,
              color: SOLD_OUT_COLOR,
              fontSize: 15 * theme.fontScale,
              fontWeight: 'bold',
            }}
          >
            {SOLD_OUT_LABEL}
          </Text>
        ) : (
          <View
            style={{
              marginTop: 10,
              flexDirection: 'row',
              alignItems: 'flex-end',
            }}
          >
            <Text
              style={{
                color: theme.accent,
                fontSize: 20 * theme.fontScale,
                fontWeight: '900',
              }}
            >
              {price.priceShow}
            </Text>
            {price.hasOriginalPrice ? (
              <Text
                style={{
                  marginLeft: 8,
                  color: TEXT_DIM,
                  fontSize: 13 * theme.fontScale,
                  textDecorationLine: 'line-through',
                }}
              >
                {price.originalPriceShow}
              </Text>
            ) : null}
          </View>
        )}

        {/* 商品說明（brief）— 只在 detail、且 brief 非空時畫（對齊設計 ProductDetailSheet 的
            說明文字：12 / textDim / 多行；rb-rn-product-sheet-detail-polish 問題 4）。 */}
        {brief.length > 0 ? (
          <Text
            style={{
              marginTop: 10,
              color: TEXT_DIM,
              fontSize: 12 * theme.fontScale,
              lineHeight: 19 * theme.fontScale,
            }}
          >
            {brief}
          </Text>
        ) : null}

        {variantChipsBlock}
        {qtyRowBlock}
        {favButtonBlock}
        {failureBannerBlock}
      </View>

      {/* White block #2 — 商品介紹 (design R21 / rb-rn-product-intro-bgcolor-and-hide-empty
          — REVERSES rb-rn-product-intro-real-data's same-day "恆顯示 + fallback" decision,
          RN-ONLY, per explicit user direction; iOS/Android/Flutter keep their own "恆顯示 +
          fallback" behavior unchanged): now matches「商品說明」(`brief`) EXACTLY — an empty
          `description` hides the WHOLE section (incl. title), no fallback copy exists any
          more (`PRODUCT_INTRO_FALLBACK` removed). `description`（`LBProduct.description`,
          `add-product-description-core-rn`）由容器 / `ProductSheetsModel.
          descriptionForProduct` 解析後傳入。`showsProductIntro` 預設 `false`——見該 prop 的
          doc comment（與此處的內容顯示規則是兩個獨立閘門）。 */}
      {showsProductIntro && description.length > 0 ? (
        <View
          testID={LBTestIDs.productIntroSection}
          style={{ marginTop: 20, padding: 16, backgroundColor: theme.background }}
        >
          <Text
            style={{
              color: theme.text,
              fontSize: 14 * theme.fontScale,
              fontWeight: '600',
            }}
          >
            {PRODUCT_INTRO_TITLE}
          </Text>
          <Text
            style={{
              marginTop: 8,
              color: TEXT_DIM,
              fontSize: 12 * theme.fontScale,
              lineHeight: 19 * theme.fontScale,
            }}
          >
            {description}
          </Text>
        </View>
      ) : null}

      {/* White block #3 — 「更多商品」推薦格，2 欄彈性多列 grid (design R21, design.md D1) — 0
          筆時整塊（含標題）不顯示；1–11 筆顯示實際筆數（奇數尾列以不可見 spacer 對齊，非佔位
          卡）；≥12 筆只顯示前 12 筆 (`recommendations` 已在元件上方
          `.slice(0, RECOMMENDATIONS_MAX)`，4 → 12 見 `rb-rn-recommendations-cap-raise-to-twelve`)。
          巢狀明細（`showsRecommendations === false`）不渲染此區塊，不做無限遞迴 UI。 */}
      {showsRecommendations && recommendations.length > 0 ? (
        <View
          testID={LBTestIDs.productRecommendationsSection}
          style={{ marginTop: 20, padding: 16, backgroundColor: theme.background }}
        >
          <Text
            style={{
              color: theme.text,
              fontSize: 14 * theme.fontScale,
              fontWeight: '600',
            }}
          >
            {RECOMMENDATIONS_TITLE}
          </Text>
          <View style={{ marginTop: 10 }}>
            {chunk(recommendations, 2).map((row, rowIndex) => (
              <View
                key={`recommendation-row-${rowIndex}`}
                style={{
                  flexDirection: 'row',
                  marginTop: rowIndex > 0 ? 10 : 0,
                }}
              >
                {row.map((rec, columnIndex) => {
                  const index = rowIndex * 2 + columnIndex;
                  // 播放圖示可見性單純吃 `onPlayClick != null`（`ProductRowView` `layout="grid"`
                  // 的既有契約），videoId 為 undefined 時整段傳 `undefined`，不給按了沒反應的
                  // 死按鈕（design.md D3 task 4.1）。
                  const videoId = rec.videoId;
                  // hideSub 依 `originalPriceShow` 是否非空決定（add-recommendation-original-
                  // price-reference-ui-rn）：無原價（''）時維持隱藏（與本 change 之前的恆傳
                  // `true` 行為一致），有原價時不再隱藏，讓 `GridLayoutBody.showStrike` 有機會
                  // 成立並畫出劃線原價。
                  const hideSub = !rec.originalPriceShow;
                  return (
                    <View
                      key={rec.productId}
                      style={{ flex: 1, marginLeft: columnIndex > 0 ? 10 : 0 }}
                    >
                      <ProductRowView
                        layout="grid"
                        hideSub={hideSub}
                        index={index}
                        theme={theme}
                        live={live}
                        product={recommendationAsDisplayProduct(rec)}
                        onOpenProduct={() => onOpenRecommendation?.(rec)}
                        onQuickAdd={() => onQuickAddRecommendation?.(rec)}
                        onPlayClick={
                          videoId != null ? () => onPlayRecommendation?.(videoId) : undefined
                        }
                      />
                    </View>
                  );
                })}
                {/* 奇數尾列的不可見 spacer（非佔位卡）— 對齊版面，不畫任何內容。 */}
                {row.length === 1 ? <View style={{ flex: 1, marginLeft: 10 }} /> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  // Pinned footer (rb-rn-product-sheet-resize-fav-inline, design R19 — 2-slot [分享][CTA]
  // in `.detail`; CTA-only in `.addToCart`). 收藏鈕 MOVED OUT to the body (see above) — the
  // footer no longer carries it. 分享鈕 (width-56 vertical) sits immediately before the
  // primary CTA. The CTA is DISABLED when sold out. 分享 is a HOST CONCERN — forwarded to
  // onShare (iOS / Android / Flutter parity, which still carry the FOOTER 收藏鈕 placement —
  // this is a DELIBERATE RN-only deviation per this change's design decision). PINNED below
  // the scrollable body (rb-rn-sheet-pinned-header-footer).
  const footer = (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: STROKE,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 18,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* `.detail` only — the 分享鈕 slot. The `.addToCart` compact sheet drops it
                entirely (CTA-only, parity iOS). 進行中直播（isLive === true）時 MUST NOT 顯示
                （rb-rn-live-hide-product-share，design R12）——沒有已定案的「開始銷售時間」，分享
                連結無法帶出正確時間點資訊；VOD / 回放（isLive === false）維持顯示。收藏鈕不受此旗標
                影響（已搬到 body，見上）——其自身的可見性由獨立的 `showFavorite` 旗標控制
                （rb-rn-subscribe-favorite-visibility-toggle，預設隱藏）。 */}
            {!isAddToCart && !isLive ? (
              <>
                <Pressable
                  testID={LBTestIDs.shareButton}
                  accessibilityRole="button"
                  onPress={onShare}
                  style={{ width: 56, alignItems: 'center' }}
                >
                  {/* 分享 改設計稿自繪三節點 ShareGlyph（rb-rn-share-icon-design-align，問題 8）。 */}
                  <ShareGlyph color={theme.text} size={20} />
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 11 * theme.fontScale,
                      color: TEXT_DIM,
                      fontWeight: '500',
                    }}
                  >
                    {SHARE_LABEL}
                  </Text>
                </Pressable>
                <View style={{ width: 12 }} />
              </>
            ) : null}
            {/* Primary 加入購物車 CTA (LBPButton primary — accent fill, white label).
                DISABLED when sold out (qty.max === 0) — disabled fill = strokeStrong.
                加購請求中（addToCartInFlight）→ spinner +「加入中…」、保 accent 底、點擊 no-op
                （handleAddToCart guard），對齊設計 `LBPButton.loading`（rb-rn-cart-add-loading-state）。 */}
            <Pressable
              testID={LBTestIDs.addToCartCta}
              accessibilityRole="button"
              onPress={handleAddToCart}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                // 統一按鈕圓角 → theme.cornerRadius（rb-rn-button-corner-radius-unify）。
                borderRadius: theme.cornerRadius,
                paddingVertical: 14,
                // in-flight 維持 accent（不退灰）；只有售完退 strokeStrong。
                backgroundColor: isSoldOut ? STROKE_STRONG : theme.accent,
              }}
            >
              {addToCartInFlight ? (
                <CartSpinnerView size={18} lineWidth={2} />
              ) : (
                <CartGlyph color="#FFFFFF" size={16} />
              )}
              <Text
                style={{
                  marginLeft: 8,
                  color: '#FFFFFF',
                  fontSize: 15 * theme.fontScale,
                  fontWeight: 'bold',
                }}
              >
                {addToCartInFlight ? ADDING_LABEL : ADD_TO_CART_LABEL}
              </Text>
            </Pressable>
          </View>
    </View>
  );

  return (
    <View testID={LBTestIDs.productDetail} style={{ flex: 1 }}>
      {/* Pinned to the bottom by the container; a top spacer pushes the sheet down. */}
      <View style={{ flex: 1 }} />
      {/* Top-rounded sheet shell via the shared SheetScaffold (pinned header + scrollable
          body + pinned footer, rb-rn-sheet-pinned-header-footer). `heightPct` is forwarded
          VERBATIM as `capPct` for BOTH `.detail` and `.addToCart` (rb-rn-sheetkit-resize-
          dismiss-unify — the shared BottomSheetPresenter drag gesture now covers all 5 sheets,
          no more `.addToCart`-only exclusion). `undefined` → `SheetScaffold`'s own default:
          content-sized 0.5 for `.detail` (rolled back from the prior static 0.9), fixed 0.4
          (`fillToCap`) for `.addToCart`. */}
      <SheetScaffold
        theme={theme}
        header={header}
        body={body}
        footer={footer}
        fillToCap={isAddToCart}
        capPct={heightPct}
        // Reset the scrollable body to the top whenever the OPEN PRODUCT changes — a「更多商品」
        // recommendation-card tap swaps `detail` in place on this SAME mounted instance (see the
        // photo-gallery reset `useEffect` above, keyed on the same `detail.productId` for the
        // same reason), so without this the previous product's scroll offset would otherwise
        // survive the swap (rb-rn-recommendation-switch-scroll-reset).
        scrollResetKey={detail.productId}
      />

      {/* 「請選規格」prompt 已 hoist 到容器 `ProductSheetsView` 的 player overlay root（TOPMOST）
          （`SelectVariantPromptModal`，與 cart-needs-login gate `AuthGateModal` 同層）。不再掛在這個
          sheet 元件內——元件內掛 `position:'absolute'` 全幅 scrim 會破壞 sheet 版面量測造成跑版
          （rn-variant-prompt-overlay-fix, iOS/Android parity）。`needsVariantSelection` prop 仍保留
          （簽章不變）但本元件不再消費它。 */}
    </View>
  );
}
