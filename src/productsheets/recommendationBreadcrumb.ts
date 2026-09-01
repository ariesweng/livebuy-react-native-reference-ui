// recommendationBreadcrumb — 商品明細「更多商品」推薦格巢狀 drill-in 的純函式（RN）。
//
// Spec: `reference-ui-rendering/spec.md` §"react-native-reference-ui 商品明細新增『商品介紹』
//        文字區與『更多商品』推薦格". rb-rn-product-detail-recommendations, design.md D1/D2
//        (technical decisions per `rb-ios-product-detail-recommendations` — SWAP + BREADCRUMB,
//        NOT true sheet-stacking — not re-decided here).
//
// RN-SPECIFIC NOTE (⚠️ documented deviation from the iOS/Android resolver contract): iOS
// resolves a tapped recommendation's / the currently-open detail's REAL `LBProduct` from the
// native `LivebuyPlayerViewController.channel?.otherGoods` (Android: an injected
// `onResolveProduct` the turnkey container wires to `player.channel?.goods ∪ .otherGoods`).
// RN's native bridge has NO equivalent — `onChannelChange`'s `LBPlayerChannelInfo` (see
// `react-native/src/LivebuySDK.ts`) is a DELIBERATELY lightweight projection that never carries
// `goods` / `otherGoods` (verified: zero references in the RN bridge or reference-ui container).
// So RN CANNOT resolve either endpoint from a live channel at all — not just in a demo/snapshot
// fallback branch (iOS/Android's degradation case), but structurally, in EVERY real host session,
// until a future `-core` change adds bridge support (out of this `## Layer: reference-ui` change's
// scope, `docs/contract-governance.md` I7).
//
// The RN-specific resolution: synthesize BOTH ends from data ALREADY on hand instead of
// depending on unavailable channel data —
//   • the TAPPED recommendation → {@link recommendationAsDisplayProduct} (mirrors iOS
//     `LBProductRecommendation.asDisplayProduct` / Android's own — genuinely degraded, the
//     recommendation shape carries no specifications/stock).
//   • the CURRENTLY-OPEN detail (the "product to return to") → {@link detailAsDisplayProduct}.
//     Unlike the recommendation, `LBProductDetailState` ALREADY carries `specifications` /
//     `specOptions` / `stock` / `price` / `originalPriceShow` / `photos` — a near-lossless
//     reconstruction (nothing genuinely degraded here), so 返回 shows a detail sheet
//     structurally equivalent to the one the user left, not a thin stand-in.
// This makes the nested breadcrumb ALWAYS functional on RN (no dependency on a resolver that
// realistically never fires), at the cost of the reopened "current" product carrying synthesized
// placeholder identity fields (`goodsNo` / `goodsGpn` / `brief` / … — none of which the reopen
// path reads; see `handleProductTap` → `detailFromProduct` in `react-native-ui/src/ProductSheet.ts`).
//
// Pure functions (no react / react-native import) → independently unit-testable
// (docs/unit-test-discipline.md).

import type { LBProduct } from 'livebuy-react-native';
import type { LBProductDetailState, LBProductRecommendation } from 'livebuy-react-native-ui';

/**
 * Presentation-only {@link LBProduct} built from a「更多商品」推薦卡 (mirrors iOS
 * `LBProductRecommendation.asDisplayProduct` / Android's own). Feeds BOTH `ProductRowView`'s
 * `layout="grid"` rendering AND the `onOpenProduct` forward when the card / its 加購鈕 is
 * tapped (RN has no resolver to fetch a fuller `LBProduct`, see the file header) — the reopened
 * detail sheet is therefore genuinely thin (no specifications / stock), which is a KNOWN,
 * documented consequence of the missing bridge support, not an oversight.
 */
export function recommendationAsDisplayProduct(rec: LBProductRecommendation): LBProduct {
  return {
    id: rec.productId,
    goodsNo: '',
    goodsGpn: '',
    name: rec.name,
    price: '',
    priceShow: rec.priceShow,
    // add-recommendation-original-price-template-rn: 帶上真實原價（先前寫死 '' 讓
    // ProductListView 的 showStrike 判斷式永遠不成立）。`originalPrice`（數值字串）沿用
    // 同檔 `detailAsDisplayProduct` 既有寫法 — 推薦卡沒有真正的數值來源，用格式化字串當
    // fallback，維持檔案內部一致。
    originalPrice: rec.originalPriceShow.length > 0 ? rec.originalPriceShow : null,
    originalPriceShow: rec.originalPriceShow,
    stock: rec.soldOut === 1 ? 0 : 1,
    pic: rec.pic,
    photos: rec.pic.length > 0 ? [rec.pic] : [],
    // rb-rn-recommendation-product-intro-carry-through: 透傳真實 brief/description（先前
    // 寫死 '' / 省略，讓商品明細的商品說明／商品介紹區塊在推薦卡進來時必定隱藏）。兩欄位在
    // `LBProductRecommendation` 上宣告為 optional（純跨套件 TS 相容，映射時恆賦值明確字串），
    // 故仍需 `?? ''` 收斂成 `LBProduct.brief`（必填 string）/ `.description`（optional，但此檔
    // 一律明確給值，比照 originalPrice/originalPriceShow 既有寫法，不留空隙）。
    brief: rec.brief ?? '',
    description: rec.description ?? '',
    soldOut: rec.soldOut,
    isHot: 0,
    isOutSoon: 0,
    narrateStatus: 0,
    isAwait: 0,
    isAwaitNotice: 0,
    beginTime: null,
    endTime: null,
    diversionUrl: '',
    specifications: [],
    specOptions: [],
    videoId: rec.videoId,
  };
}

/**
 * Near-lossless {@link LBProduct} reconstruction of the CURRENTLY-OPEN detail, for pushing onto
 * `detailBreadcrumb` as "the product to return to" (see the file header — unlike
 * {@link recommendationAsDisplayProduct}, `LBProductDetailState` already carries specifications /
 * stock / price / photos, so re-opening this via `onOpenProduct` produces a detail sheet
 * structurally equivalent to the one the user left).
 */
export function detailAsDisplayProduct(detail: LBProductDetailState): LBProduct {
  return {
    id: detail.productId,
    goodsNo: '',
    goodsGpn: '',
    name: detail.name,
    price: detail.price,
    priceShow: detail.priceShow,
    originalPrice: detail.originalPriceShow.length > 0 ? detail.originalPriceShow : null,
    originalPriceShow: detail.originalPriceShow,
    stock: detail.stock,
    pic: detail.photos[0] ?? '',
    photos: detail.photos.slice(),
    brief: '',
    soldOut: detail.soldOut,
    isHot: 0,
    isOutSoon: 0,
    narrateStatus: 0,
    isAwait: 0,
    isAwaitNotice: 0,
    beginTime: null,
    endTime: null,
    diversionUrl: '',
    specifications: detail.specifications.slice(),
    specOptions: detail.specOptions.slice(),
  };
}

/** Push `currentProduct` onto `breadcrumb` (append — the innermost drill-in is the LAST entry). */
export function pushedBreadcrumb(
  breadcrumb: readonly LBProduct[],
  currentProduct: LBProduct,
): LBProduct[] {
  return [...breadcrumb, currentProduct];
}

/** {@link poppedBreadcrumb}'s result: the breadcrumb with its last entry removed, and that entry
 *  (the product to reopen), or `null` when `breadcrumb` was already empty. */
export interface PoppedBreadcrumb {
  readonly breadcrumb: LBProduct[];
  readonly previous: LBProduct | null;
}

/** Pop the last entry off `breadcrumb` ("返回" one level). Empty input → `{ [], null }`. */
export function poppedBreadcrumb(breadcrumb: readonly LBProduct[]): PoppedBreadcrumb {
  if (breadcrumb.length === 0) return { breadcrumb: [], previous: null };
  const previous = breadcrumb[breadcrumb.length - 1]!;
  return { breadcrumb: breadcrumb.slice(0, -1), previous };
}
