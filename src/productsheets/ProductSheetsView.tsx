// ProductSheetsView — family-3 product sheet-stack container (RN SKELETON).
//
// Spec: `reference-ui-rendering/spec.md` (family-3 product + sheets, 4 surfaces).
// Phase-4 RN sibling of the DONE iOS `ProductSheetsOverlayView.swift`
// (rb-ios-product-sheets + rb-ios-gap-surfaces-design-reconcile 收藏鈕), Android
// `ProductSheetsOverlayView.kt` (rb-android-product-sheets), and Flutter
// `product_sheets_view.dart` (rb-flutter-product-sheets). This RN family builds in
// the iOS-reconciled FINAL state — the product DETAIL sheet INCLUDES the 收藏鈕.
//
// The top-level family-3 container. It lays out the FOUR family-3 surface
// components as a sheet stack:
//
//   1. ProductList        — bottom-sheet product list drawer + cart CTA
//                            (`LBPBottomSheet` / `LBPSheetHeader` / `LBPProductRow`
//                            / `LBPCartCTA`)
//   2. ProductDetail      — product detail sheet (variant chips / qty stepper /
//                            加入購物車 / RECONCILED 收藏鈕), presented when the
//                            selected `detail` is NOT sold-out
//                            (`LBPVariantPicker` / `LBPQtyStepper` / `LBPFavButton`)
//   3. MiniCartPeek       — floating mini-cart peek (`LBPMiniCart`), drawn only when
//                            `miniCart != null`
//   4. NotifyRestockSheet — restock-notify sheet, presented WHEN the selected
//                            `detail` IS sold-out (`detail.soldOut === 1`)
//
// This SKELETON owns the layout, a read-only {@link ProductSheetsModel}, the
// resolved {@link ReferenceUITheme}, and composes the four surface components by
// import name. The four parallel Surfaces agents land those files after this
// skeleton — until they exist this file will not type-check on its own; that is the
// EXPECTED skeleton state. The container FIXES the call-site shapes so the agents
// converge on the SUB-VIEW INPUT PATTERN documented below.
//
// ─────────────────────────────────────────────────────────────────────────────
// SUB-VIEW INPUT PATTERN — the contract the 4 Surfaces agents MUST follow
// ─────────────────────────────────────────────────────────────────────────────
//
// Every family-3 surface is a function component
// `(props: { theme: ReferenceUITheme; ...byValueSnapshot; ...trailingCallbacks })`
// returning `ReactElement`, with props IN THIS ORDER:
//
//   1. `theme` (ReferenceUITheme)   — FIRST, always.
//   2. its bound SNAPSHOT VALUE(S)  — read-only state, passed BY VALUE from the
//                                      ProductSheetsModel (never the model, never the
//                                      template).
//   3. optional action callbacks    — trailing, EACH defaulting to a no-op. The
//                                      container owns NO core action; the host wires
//                                      the exits (product tap / cart / add / fav /
//                                      restock notice / mini-cart).
//
// A surface reads ONLY its passed-in values — it MUST NOT reach back into the
// ProductSheetsModel or DefaultPlayerTemplate (one-way data flow, D-1), MUST NOT hold
// a second copy of state, MUST render correctly with all callbacks omitted (so
// structural snapshot tests construct it action-free), MUST use plain
// View/Text/Pressable only (NO ScrollView/FlatList/SectionList/VirtualizedList — the
// product list is a FIXED SMALL set drawn as a plain column, NOT a list view; NO
// network-uri Image). The variant chips are MANUAL CHUNKED ROWS (chunk options into
// fixed-per-row Rows of Pressables; NOT a grid/list). The restock「通知我補貨」toggle
// is a custom pill switch (View capsule + circle knob) — NOT a platform Switch.
//
// The four Surfaces agents implement EXACTLY these prop signatures (see the call
// sites in the render body below).
//
// ⚠️ HISTORICAL SNAPSHOT: the signatures below record the shape AGREED AT FAMILY-3
// SKELETON TIME. They are NOT an exhaustive listing of what each surface accepts today —
// later changes added props (e.g. `ProductDetail`'s `presentation` / `live` / `brief` /
// `isLive` / `addToCartInFlight` / `showStock` and its `onShare` / `onDismiss` /
// `onZoomImage` exits) without rewriting this block. Read the components' own prop
// interfaces for the current contract; this block still governs the ORDERING RULE above.
//
//   ProductList(props: {
//       theme: ReferenceUITheme;
//       products: readonly LBProduct[]; cartCount: number;
//       onOpenProduct?: (product: LBProduct) => void;   // → container seam / host override
//       onOpenCart?: () => void;                        // → model.openCart()
//   }): ReactElement
//
//     Bottom-sheet shell; plain non-scrolling column of product rows (縮圖 placeholder
//     / 名 / priceShow / 原價劃線 / 售完態); bottom cart CTA shows `cartCount` (badge
//     when > 0). A row tap forwards `onOpenProduct(product)` (THIS view never opens the
//     detail itself; the turnkey container's seam default does — rb-rn-product-tap-wire).
//     The 收藏鈕 MUST NOT appear in the list (it lives only in the detail sheet). The CTA
//     forwards `onOpenCart`.
//
//   ProductDetail(props: {
//       theme: ReferenceUITheme;
//       detail: LBProductDetailState;
//       variant: LBVariantState;            // selection is a number[]; chip selected
//                                           //   when variant.selection[gi] === oi
//       qty: LBQtyState;
//       needsVariantSelection: boolean; addToCartFailed: boolean;
//       faved?: boolean;                    // = model.favedForProduct(productId)
//       onSelectVariant?: (groupIndex: number, optionIndex: number) => void;
//       onSetQty?: (qty: number) => void;
//       onInc?: () => void; onDec?: () => void;
//       onAddToCart?: () => void;
//       onToggleFavorite?: () => void;
//   }): ReactElement
//
//     Bottom-sheet shell; 縮圖 placeholder `photos` / `name` / `priceShow` /
//     `originalPriceShow` 劃線. Variant chips MANUAL CHUNKED ROWS (selected when
//     `variant.selection[gi] === oi`) → `onSelectVariant(gi, oi)`. Qty stepper (reads
//     `qty.{qty,min,max}`; DISABLED when `qty.max === 0`) → `onSetQty` / `onInc` /
//     `onDec`. Bottom action row: a 收藏鈕 (`LBPFavButton`) to the LEFT of the 加入
//     購物車 CTA — `faved === false` → 空心 heart「收藏」; `faved === true` → 實心
//     heart + accent「已收藏」; tap → `onToggleFavorite`. 加入購物車 CTA → `onAddToCart`.
//     `needsVariantSelection` → centered「請選規格」prompt; `addToCartFailed` → error
//     banner.
//
//   MiniCartPeek(props: {
//       theme: ReferenceUITheme;
//       peek: LBMiniCartPeek;
//       onDismiss?: () => void;             // → model.dismissMiniCart()
//       onOpenDetail?: () => void;          // host-wired re-open (host re-feeds product)
//   }): ReactElement
//
//     Floating peek (`LBPMiniCart`) — reads `name` / `priceShow` / `soldOut`. The
//     container draws it ONLY when `miniCart != null` (a non-null peek is passed).
//
//   NotifyRestockSheet(props: {
//       theme: ReferenceUITheme;
//       detail: LBProductDetailState; restockSubscribed: boolean;
//       onToggleNotice?: () => void;        // → model.toggleRestock(goodsGpn)
//       onDismiss?: () => void;
//   }): ReactElement
//
//     Bottom-sheet shell; 縮圖 placeholder + 名 +「已售完」+ DISABLED qty stepper +
//     bottom「通知我補貨」custom pill switch (reads `restockSubscribed`; NOT a platform
//     Switch). FAMILY BOUNDARY: touches goods-tracking ONLY for the NOTICE
//     subscription — MUST NOT render the AWAIT switch (that is the product-detail
//     收藏鈕) or the notice-tab open-state (family-6 gap-surfaces).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheetPresenter } from './BottomSheetPresenter';
import { DRAG_HIT_HEIGHT, DRAG_HIT_SIDE_INSET, useSheetDragGesture } from './sheetDragGesture';

import type { ReferenceUITheme } from '../theme';
import { ProductSheetsModel } from './ProductSheetsModel';
import { LBTestIDs } from '../testing/LBTestIDs';

import { ProductList } from './ProductListView';
import { ProductDetail } from './ProductDetailSheetView';
import { SelectVariantPromptModal } from './SelectVariantPromptModalView';
// MiniCartPeek is no longer rendered as a floating surface here (rb-rn-remove-minicart-peek-
// surface); it is still re-exported below (public API) + used by the now-introducing carousel.
import { NotifyRestockSheet } from './NotifyRestockSheetView';
import { ProductImageZoomOverlay } from './ProductImageZoomOverlay';
import { CartToastView } from './CartToastView';
import { cartLoadingFloorRemainingMs } from './cartLoadingFloor';
import { variantPromptShouldPresent } from './variantPromptTrigger';
import { AuthGateModal } from '../gapsurfaces/AuthGateModalView';
import { lbForwardLogin } from '../container/seams';
import { recommendationAsDisplayProduct } from './recommendationBreadcrumb';

import type {
  DefaultPlayerTemplate,
  LBProductDetailState,
  LBAuthGateState,
  LBProductRecommendation,
} from 'livebuy-react-native-ui';
import { LBAuthTriggerAction } from 'livebuy-react-native-ui';
import type { LBProduct } from 'livebuy-react-native';

// Re-export the four family-3 surfaces so hosts (and the family barrel) can pull
// them from the container module (parity with the iOS/Android/Flutter family
// barrels).
export { ProductList } from './ProductListView';
export { ProductDetail } from './ProductDetailSheetView';
export { MiniCartPeek } from './MiniCartPeekView';
export { NotifyRestockSheet } from './NotifyRestockSheetView';

/** Props for the family-3 product-sheets container. */
export interface ProductSheetsViewProps {
  /** Live template (host-supplied). `null`/omitted → deterministic demo seeds. */
  readonly template?: DefaultPlayerTemplate | null;

  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;

  /**
   * rb-rn-product-real-images (parity iOS `live`): `false` (snapshot / demo — the
   * DEFAULT) → all sheet thumbnails draw the deterministic placeholders (baselines
   * unchanged); `true` (host runtime, real video surface) → product photos load over
   * the placeholders. Threaded to the four surfaces.
   */
  readonly live?: boolean;

  /**
   * Whether the product LIST drawer is open. Container-owned single source (default `false`);
   * the GOODS rail/bag tap opens it, the scrim / close button dismisses it (re-openable).
   * Parity with iOS `ProductSheetsModel.listPresented` (default false) — the drawer no longer
   * auto-presents over the video.
   */
  readonly presented?: boolean;
  /** Dismiss the product LIST drawer (scrim tap / close button). */
  readonly onDismissList?: () => void;

  /**
   * rb-rn-show-stock-caption-toggle (design R15) — the merchant's `extensions.show_stock`
   * setting, as the RAW wire value (`unknown`). Forwarded VERBATIM to `ProductDetail`, which
   * owns the single fallback entry point (`normalizeShowStock`); this container neither
   * normalizes it nor stores it. Omitted → "the backend sent nothing" → the「只剩庫存 N 組」
   * caption is drawn, so existing call-sites and baselines are unchanged.
   *
   * NOT forwarded to `NotifyRestockSheet`: its「尚無庫存」is a SOLD-OUT status line, a
   * different thing from the stock-quantity caption this flag gates.
   */
  readonly showStock?: unknown;

  /**
   * Whether the product-detail sheet's inline 收藏鈕 (favorite button) mounts at all
   * (rb-rn-subscribe-favorite-visibility-toggle). Forwarded VERBATIM to `ProductDetail`, which
   * owns the single fallback (`showFavorite = false`, DEFAULT — a deliberate reversal of the
   * previous always-visible behaviour; a host opts in with `true`). This container neither
   * normalizes it nor stores it. Only affects the `.detail` presentation — `.addToCart` never
   * had a 收藏鈕 and stays unaffected regardless of this flag (existing `!isAddToCart` gate,
   * unchanged).
   */
  readonly showFavorite?: boolean;

  // Host-wired interaction callbacks. The container owns NO core action — each is
  // forwarded to the host (which wires it to the template exit). All optional;
  // default no-op.

  /**
   * Host-wired product-row tap (host → core product-tap exit). reference-ui NEVER
   * opens the detail itself — the open is the host's / core's job.
   */
  readonly onOpenProduct?: (product: LBProduct) => void;
  /** Host-wired cart-CTA tap (also forwarded to `template.openCart()` via the model). */
  readonly onOpenCart?: () => void;
  /** Host-wired variant chip tap (also forwarded to `template.selectVariant`). */
  readonly onSelectVariant?: (groupIndex: number, optionIndex: number) => void;
  /** Host-wired direct qty set (also forwarded to `template.setQty`). */
  readonly onSetQty?: (qty: number) => void;
  /** Host-wired qty `+` (also forwarded to `template.incQty`). */
  readonly onInc?: () => void;
  /** Host-wired qty `-` (also forwarded to `template.decQty`). */
  readonly onDec?: () => void;
  /** Host-wired 加入購物車 (also forwarded to `template.addToCart`). */
  readonly onAddToCart?: () => void;
  /**
   * Host-wired 收藏（到貨追蹤 type=1）toggle for a product detail (also forwarded to
   * `template.toggleAwait(goodsGpn)` via the model). The goodsGpn is resolved by the
   * container from the detail's `productId`.
   */
  readonly onToggleFavorite?: (goodsGpn: string) => void;
  /**
   * Host-wired 分享 tap from the product-detail footer's 3-slot [收藏][分享][CTA].
   * Share is a HOST CONCERN — the headless SDK has no share route, so the container
   * forwards the intent to this host-provided callback (passthrough). Default no-op.
   */
  readonly onShare?: () => void;
  /**
   * Host-wired 商品列表列**縮圖**點擊 → 影片跳轉到該商品介紹時間（`LBProduct.beginTime`）。
   * 轉發給 `ProductList.onSeekToIntro`；host 接到 core `seek(beginTime)`（issue 5）。Default no-op.
   */
  readonly onSeekToProductIntro?: (product: LBProduct) => void;
  /**
   * Host-wired 商品列表列**分享鈕**點擊 → 系統分享，連結帶該商品介紹時間 `?t=beginTime`。
   * 轉發給 `ProductList.onShareProduct`；與明細 footer 的 `onShare` 為不同入口（issue 6）。Default no-op.
   */
  readonly onShareProduct?: (product: LBProduct) => void;
  /**
   * Host-wired restock-notify（type=2）toggle for a sold-out product (also forwarded
   * to `template.toggleNotice(goodsGpn)` via the model).
   */
  readonly onNotifyRestock?: (goodsGpn: string) => void;
  /** Host-wired sheet dismiss (close affordance — presentation only). */
  readonly onDismiss?: () => void;

  /**
   * Host-wired「前往登入」for the add-to-cart needs-login gate (cart-needs-login-gate). When the
   * template's `addToCartNeedsLogin` flips true (route-B add hit the empty-`buy_no` 401), the
   * container presents `AuthGateModal(cartAdd)`; its 前往登入 CTA routes HERE — the HOST's own login
   * flow (`config.onLogin`). reference-ui NEVER logs in itself (same invariant as the comment
   * login-gate). Default no-op (the gate defaults not-presented → baselines unchanged).
   */
  readonly onRequestLogin?: () => void;

  /**
   * Host-wired 推薦卡播放圖示 → 换片 (parity `onSwitchProductVideo` seam,
   * `LivebuyPlayerConfig.ts`). Turnkey default: `playerRef.load(videoId)` then
   * `onVideoSwitched` — 比照容器層既有的 `onPickHot` 模式 (`seams.ts` `buildMomentHandlers`).
   * The container forwards this call and THEN closes the product-detail sheet
   * (rb-rn-recommendation-nav-simplify — reverses `rb-rn-product-detail-recommendations`
   * design.md D3's「換片不關閉 sheet」decision; a deliberate user-requested reversal, not an
   * oversight), and ALSO closes the outer product-list drawer via `onDismissList` if it was open
   * (rb-rn-recommendation-close-bag-sheet-on-switch — the drawer is a separate `presented` state
   * that stays open in the background while the detail sheet covers it; without this it reappeared
   * after the switch). Default no-op (demo / snapshot).
   */
  readonly onSwitchRecommendationVideo?: (videoId: string) => void;
}

/**
 * The family-3 product-sheets container. Subscribes to the bound template's
 * coalesced `subscribe()` notification, re-reads the read-only
 * {@link ProductSheetsModel} on each notify (via a `useState` tick), and passes
 * snapshot values BY VALUE to the four surface components. Paints with the resolved
 * {@link ReferenceUITheme}.
 *
 * `template == null` → the container reads the deterministic demo seeds (nothing to
 * subscribe to); the host normally supplies a live {@link DefaultPlayerTemplate}.
 */
// MARK: - sheetKindFor — pure sheet selection by entry (rb-rn-soldout-row-detail-vs-restock)
//
// Which sheet a detail snapshot presents is decided by the ENTRY the user tapped (`actionMode`),
// NOT by `soldOut` (iOS/Android/Flutter parity `sheetKind(for:)`): 補貨鈴鐺 (restock) → restock
// sheet, 加購鈕 (addToCart) → compact AddToCart, 名稱 / 明細 (detail) → full ProductDetail. Pure +
// unit-testable. A sold-out product opened via 名稱 / 明細 lands on the detail sheet (disabled CTA +
// 已售完); the restock sheet is reachable ONLY from the sold-out row's dedicated bell.
export type ProductSheetKind = 'detail' | 'addToCart' | 'notifyRestock';

export function sheetKindFor(
  mode: 'detail' | 'addToCart' | 'restock',
): ProductSheetKind {
  switch (mode) {
    case 'restock':
      return 'notifyRestock';
    case 'addToCart':
      return 'addToCart';
    case 'detail':
      return 'detail';
  }
}

export function ProductSheetsView(props: ProductSheetsViewProps): ReactElement {
  const {
    template = null,
    theme,
    live = false,
    onOpenProduct,
    onOpenCart,
    onSelectVariant,
    onSetQty,
    onInc,
    onDec,
    onAddToCart,
    onToggleFavorite,
    onShare,
    onSeekToProductIntro,
    onShareProduct,
    onNotifyRestock,
    onDismiss,
    presented = false,
    onDismissList,
    onRequestLogin,
    showStock,
    showFavorite,
    onSwitchRecommendationVideo,
  } = props;

  // Coalesced re-read tick (parity with the family-1/2 containers + the Flutter
  // ListenableBuilder re-read). On each template notify we bump the tick so React
  // re-renders and re-reads every getter off a freshly-constructed read-only model
  // (the model holds no state of its own). The demo path (template == null) has
  // nothing to subscribe to and renders the seeds.
  const [, setTick] = useState(0);
  // rb-rn-add-to-cart-route — container-local presentation mode for the in-stock
  // detail sheet (parity iOS `actionMode`): the list 明細鈕 / 名 sets `detail` (FULL
  // browse), the 加購鈕 sets `addToCart` (COMPACT add). Sold-out always routes to the
  // restock sheet (`detail.soldOut === 1`), regardless of mode.
  const [actionMode, setActionMode] =
    useState<'detail' | 'addToCart' | 'restock'>('detail');
  // rb-rn-sheetkit-resize-dismiss-unify — the shared `BottomSheetPresenter` instance's LIVE
  // drag-resize/dismiss height fraction, reported upward by its (always-on, no more opt-in)
  // drag hit-zone. Shared by ALL THREE sheets that presenter carries (`ProductDetail` in
  // either presentation + `NotifyRestockSheet`, swapped via `detailOrRestock`) — `undefined`
  // until the user actually drags the handle (the presenter's own floor measurement never
  // reports on its own; each leaf falls back to its own `SheetScaffold` default — content-
  // sized for `.detail`, fixed 0.4 for `.addToCart` / `NotifyRestockSheet` — and keeps
  // tracking real content changes until a drag happens, exactly the pre-existing behavior).
  const [detailHeightPct, setDetailHeightPct] = useState<number | undefined>(undefined);
  // rb-rn-sheetkit-resize-dismiss-unify — SAME shared gesture, wired to `ProductListView`'s
  // own pre-existing scrim + plain View presentation (Surface 1 below), which is NOT routed
  // through `BottomSheetPresenter` (see design.md Decision 5 — its presentation mechanism
  // stays untouched).
  const [listHeightPct, setListHeightPct] = useState<number | undefined>(undefined);
  const { cardOnLayout: listCardOnLayout, dragHandlers: listDragHandlers } = useSheetDragGesture({
    visible: presented,
    onDismiss: onDismissList,
    onHeightPctChange: setListHeightPct,
  });
  // Product-image lightbox presentation state (rb-rn-product-image-zoom-lightbox): a LOCAL
  // presentation-only affordance (NOT view-model). A sheet's zoom badge sets it; the lightbox
  // close clears it. Default null → demo / snapshot don't mount the overlay (baselines unchanged).
  // Parity iOS `zoomedDetail`.
  const [zoomedDetail, setZoomedDetail] = useState<LBProductDetailState | null>(null);
  // rb-rn-product-detail-image-gallery (design R34): the photo the `.detail` gallery was
  // CURRENTLY showing when its zoom badge was tapped — forwarded verbatim into
  // `ProductImageZoomOverlay`'s `overridePhotoURL` so the lightbox magnifies that exact photo
  // instead of always the resolver's `primaryPhoto`. Set alongside `zoomedDetail` below; reset
  // to `undefined` on close and whenever the zoom badge has no gallery context (NotifyRestock —
  // no gallery, always falls back to the overlay's own resolver).
  const [zoomOverridePhotoURL, setZoomOverridePhotoURL] = useState<string | undefined>(undefined);
  // Retains the last non-null detail/restock sheet for the slide-down dismiss animation.
  const lastDetailRef = useRef<ReactElement | null>(null);
  // FALLBACK cache for `ProductSheetsModel.briefForProduct`/`.descriptionForProduct`, read when a
  // 「更多商品」推薦卡商品 is NOT present in the current video's own `products` snapshot (RN has no
  // bridge-side channel resolver to carry a fuller `LBProduct` through — see
  // `recommendationBreadcrumb.ts`'s file header). `useRef` (NOT `useState`): `model` below is
  // reconstructed fresh EVERY render (unlike iOS's class-instance-per-session model), so the cache
  // needs a single stable object that persists across renders and is mutated in place — writes made
  // in `openRecommendation` must be visible to whichever LATER render's freshly-constructed `model`
  // reads it back, which a `useState` setter (schedules a re-render rather than mutating in place)
  // cannot guarantee. Same idiom this file already uses for `lastDetailRef` above.
  // rb-rn-recommendation-product-intro-carry-through (design.md Decision 2).
  const recommendationCacheRef = useRef<Map<string, { brief: string; description: string }>>(
    new Map(),
  );
  useEffect(() => {
    if (template == null) return;
    const unsubscribe = template.subscribe(() => setTick((t) => t + 1));
    return unsubscribe;
  }, [template]);

  const model = new ProductSheetsModel(template, recommendationCacheRef.current);

  // 加購「需登入」gate (cart-needs-login-gate, parity iOS/Android) — present on the template flag's
  // false→true transition (a LOCAL state, not direct gating on `model.addToCartNeedsLogin`, so
  // 稍後再說 dismisses without reference-ui resetting the template flag; the next add attempt
  // re-fires false→true and re-presents). The genuine-failure banner is unaffected (it draws only
  // on the orthogonal `addToCartFailed`, never set together with needs-login).
  const needsLogin = model.addToCartNeedsLogin;
  const [cartGatePresented, setCartGatePresented] = useState(false);
  const prevNeedsLoginRef = useRef(false);
  useEffect(() => {
    if (needsLogin && !prevNeedsLoginRef.current) setCartGatePresented(true);
    prevNeedsLoginRef.current = needsLogin;
  }, [needsLogin]);

  // 「請選規格」prompt (rn-variant-prompt-overlay-fix + rn-variant-prompt-reprompt-rearm, parity
  // iOS/Android) — a LOCAL presentation state set PER add-to-cart tap in `handleAddToCart` below
  // (NOT on a `selectSpecRequired` false→true rising edge). The template's variant guard is a
  // SYNCHRONOUS early-return that leaves the flag true across a dismiss (only `selectVariant` clears
  // it), so a rising-edge present (the old `prevNeedsVariantRef` + `useEffect`) MISSED the 2nd, 3rd,
  // … unselected re-add after the user dismissed the prompt — the bug this fixes. Driving it per-tap
  // re-arms on every attempt: after the (synchronous) `model.addToCart()`, `model.needsVariantSelection`
  // reflects the guard result, so `handleAddToCart` re-presents whenever it is still true. HOISTED to
  // this overlay root (NOT the sheet element) so its full-bleed scrim can't break the sheet's layout
  // measurement (the old 跑版 / 死鎖). 我知道了 / scrim dismisses the local state so the user can reach
  // the variant chips; the user picks a spec → template's `selectVariant` clears `selectSpecRequired`.
  const [variantPromptPresented, setVariantPromptPresented] = useState(false);

  // 加購成功提示 toast (rb-rn-cart-add-success-toast, parity iOS/Android) — flashed ~1.8s on a
  // `cartCTA.count` RISE (success → the template increments it). The watermark `lastCartCountRef`
  // is seeded on the FIRST `useEffect` pass so the bind-time / demo-seed value does NOT flash;
  // only a STRICT increase past it does (inline `lastCount >= 0 && cartCount > lastCount`). dedup /
  // needsLogin / failure leave the count unchanged → no toast (D-1 known limitation). A rapid
  // second success `clearTimeout`s the pending dismiss and re-arms (extends the toast, parity iOS
  // cancel+re-arm). The unmount effect clears the timer.
  const cartCount = model.cartCTA.count;
  const [cartToastVisible, setCartToastVisible] = useState(false);
  const lastCartCountRef = useRef<number>(-1);
  const cartToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const last = lastCartCountRef.current;
    lastCartCountRef.current = cartCount;
    // First pass (un-seeded watermark) or a non-rise (dedup / clear) → seed / track, no toast.
    if (last < 0 || cartCount <= last) return;
    setCartToastVisible(true);
    if (cartToastTimerRef.current != null) clearTimeout(cartToastTimerRef.current);
    cartToastTimerRef.current = setTimeout(() => setCartToastVisible(false), 1800);
  }, [cartCount]);
  useEffect(
    () => () => {
      if (cartToastTimerRef.current != null) clearTimeout(cartToastTimerRef.current);
    },
    [],
  );

  // 加購 CTA 請求中 loading (rb-rn-cart-add-loading-state, parity iOS/Android) — derive 一個
  // 防閃爍的 `cartLoadingVisible`：template `addToCartInFlight` 可能在極短時間內 true→false
  // （特別是 dedup 同步丟 cartAddDeduplicated），直接綁會讓 spinner 一閃即逝。true → 立即顯示並記下
  // 起始時間；false → 依 `cartLoadingFloorRemainingMs`（320ms floor）算剩餘，>0 則 `setTimeout` 後再
  // 隱藏。demo / unbound（addToCartInFlight 恆 false）→ 不顯示，既有 snapshot baseline byte-identical。
  const inFlight = model.addToCartInFlight;
  const [cartLoadingVisible, setCartLoadingVisible] = useState(false);
  const cartLoadingShownAtRef = useRef<number>(0);
  const cartLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (inFlight) {
      if (cartLoadingTimerRef.current != null) {
        clearTimeout(cartLoadingTimerRef.current);
        cartLoadingTimerRef.current = null;
      }
      cartLoadingShownAtRef.current = Date.now();
      setCartLoadingVisible(true);
      return;
    }
    // in-flight false → 套用 320ms 防閃爍 floor 再解除（不可一閃即逝）。
    const elapsed = Date.now() - cartLoadingShownAtRef.current;
    const remaining = cartLoadingFloorRemainingMs(elapsed);
    if (remaining <= 0) {
      setCartLoadingVisible(false);
      return;
    }
    if (cartLoadingTimerRef.current != null) clearTimeout(cartLoadingTimerRef.current);
    cartLoadingTimerRef.current = setTimeout(() => setCartLoadingVisible(false), remaining);
  }, [inFlight]);
  useEffect(
    () => () => {
      if (cartLoadingTimerRef.current != null) clearTimeout(cartLoadingTimerRef.current);
    },
    [],
  );

  const detail = model.detail;

  // -- Interaction funnels (container owns NO core action) --------------------

  // Forward a product-row tap (明細鈕 / 名) → FULL browse detail sheet. THIS view never
  // opens the detail itself; it forwards `onOpenProduct`, whose behaviour is owned by the
  // turnkey container's seam (built-in `defaultOpenProduct` = core telemetry +
  // `attachment.handleProductTap(product, 0)`; host `config.onOpenProduct` replaces both).
  const handleOpenProduct = (product: LBProduct): void => {
    setActionMode('detail');
    onOpenProduct?.(product);
  };

  // Forward a row 加購鈕 (in-stock cart glyph) tap → COMPACT add-to-cart sheet. Records the
  // addToCart mode BEFORE forwarding the SAME core product-tap exit.
  const handleQuickAdd = (product: LBProduct): void => {
    setActionMode('addToCart');
    onOpenProduct?.(product);
  };

  // Forward a sold-out row 補貨鈴鐺 tap → restock-notify sheet (rb-rn-soldout-row-detail-vs-restock，
  // 問題 2). Records the `restock` mode (so `sheetKindFor` picks NotifyRestock), then forwards the
  // SAME core product-tap exit. 名稱 / 明細 keep `handleOpenProduct` (→ detail); no soldOut override.
  const handleOpenRestock = (product: LBProduct): void => {
    setActionMode('restock');
    onOpenProduct?.(product);
  };

  // Sheet dismiss → clear the open product-detail in the template (so a later re-tap of
  // the SAME product re-opens — the template's `openDetail` is diff-then-notify, parity
  // iOS sheet-dismiss → closeDetail), then forward the host dismiss. No-op for demo.
  //
  // This is the ONLY dismiss path — rb-rn-recommendation-nav-simplify removed the breadcrumb /
  // 「返回」mechanism (rb-rn-product-detail-recommendations design.md D1, reversed): the header
  // close button always routes here, regardless of how many times the user has drilled into a
  // 「更多商品」recommendation via `openRecommendation` below.
  const handleDismiss = (): void => {
    model.closeProductDetail();
    onDismiss?.();
  };

  // 「更多商品」推薦卡卡片本體 / 加購鈕 → SAME-SHEET SWAP (rb-rn-recommendation-nav-simplify;
  // reverses rb-rn-product-detail-recommendations design.md D1's breadcrumb push). Reuses the
  // SAME `onOpenProduct` exit a product-list row tap already uses — the template swaps its
  // single `detail`/`variant`/`qty` slot to the recommended product's content; it never sees a
  // second sheet instance, and this container no longer records any return path.
  const openRecommendation = (
    recommendation: LBProductRecommendation,
    mode: 'detail' | 'addToCart',
  ): void => {
    // rb-rn-recommendation-product-intro-carry-through: cache brief/description BEFORE forwarding
    // onOpenProduct, so ProductSheetsModel.briefForProduct/.descriptionForProduct can fall back to
    // it once the template's productDetailState flips to this recommendation's productId (the
    // PRIMARY products-snapshot lookup misses for an otherGoods-sourced product — see
    // recommendationBreadcrumb.ts's file header for why RN structurally cannot resolve a fuller
    // LBProduct here).
    recommendationCacheRef.current.set(recommendation.productId, {
      brief: recommendation.brief ?? '',
      description: recommendation.description ?? '',
    });
    setActionMode(mode);
    onOpenProduct?.(recommendationAsDisplayProduct(recommendation));
  };

  // Forward a cart-CTA tap → `template.openCart()` (host passthrough; no-op for demo
  // via the model) + the host callback.
  const handleOpenCart = (): void => {
    model.openCart();
    onOpenCart?.();
  };

  const handleSelectVariant = (groupIndex: number, optionIndex: number): void => {
    model.selectVariant(groupIndex, optionIndex);
    onSelectVariant?.(groupIndex, optionIndex);
  };

  const handleSetQty = (value: number): void => {
    model.setQty(value);
    onSetQty?.(value);
  };

  const handleInc = (): void => {
    model.incQty();
    onInc?.();
  };

  const handleDec = (): void => {
    model.decQty();
    onDec?.();
  };

  const handleAddToCart = (): void => {
    // Per-attempt re-arm (rn-variant-prompt-reprompt-rearm, iOS/Android/Flutter parity): forward the
    // add, then SYNCHRONOUSLY read the variant guard result and (re)present the「請選規格」prompt if the
    // spec is still unselected. `model.addToCart()` fires `void template.addToCart()` and an async
    // function runs its synchronous prefix (the guard early-return) before the first `await`, so
    // `model.needsVariantSelection` already reflects the outcome here — this re-fires on EVERY
    // unselected tap (incl. after a dismiss), unlike the old rising-edge `useEffect`.
    model.addToCart();
    if (variantPromptShouldPresent(model.needsVariantSelection)) {
      setVariantPromptPresented(true);
    }
    onAddToCart?.();
  };

  // Forward a 收藏（到貨追蹤 type=1）toggle for the product detail. The container
  // resolves goodsGpn from the detail's productId (D-5), forwards through the model
  // (no-op for demo), and surfaces the goodsGpn to the host callback.
  const handleToggleFavorite = (productId: string): void => {
    const gpn = model.goodsGpnForProduct(productId);
    if (gpn == null) return;
    model.toggleFavorite(gpn);
    onToggleFavorite?.(gpn);
  };

  // Forward a restock-notify toggle for the sold-out product (NOTICE flag only).
  const handleNotifyRestock = (productId: string): void => {
    const gpn = model.goodsGpnForProduct(productId);
    if (gpn == null) return;
    model.toggleRestock(gpn);
    onNotifyRestock?.(gpn);
  };

  // Mini-cart peek dismiss / open-detail handlers REMOVED with the floating peek surface
  // (rb-rn-remove-minicart-peek-surface); `model.dismissMiniCart()` stays a vestigial forwarder.

  // The detail-or-restock sheet, picked by ENTRY (`actionMode`) via the pure `sheetKindFor`
  // (rb-rn-soldout-row-detail-vs-restock，問題 2): 補貨鈴鐺 (restock) → restock-notify sheet;
  // 加購鈕 / 名稱 / 明細 → ProductDetail (addToCart vs detail). The prior `soldOut === 1`
  // first-priority override is REMOVED — sold-out 名稱/明細 now open the detail sheet (disabled
  // CTA + 已售完). The model resolves goodsGpn from the detail's productId.
  let detailOrRestock: ReactElement | null = null;
  if (detail != null) {
    if (sheetKindFor(actionMode) === 'notifyRestock') {
      // NOTE: `showStock` is deliberately NOT forwarded here (rb-rn-show-stock-caption-toggle).
      // The restock sheet's「尚無庫存」is a SOLD-OUT status line, not the stock-quantity
      // caption the merchant flag gates — this branch must render identically either way.
      detailOrRestock = (
        <NotifyRestockSheet
          theme={theme}
          detail={detail}
          live={live}
          restockSubscribed={model.restockSubscribedForProduct(detail.productId)}
          // rb-rn-sheetkit-resize-dismiss-unify — same shared presenter instance / same live
          // drag-resize fraction as `ProductDetail` below (the presenter has no idea which of
          // the two is currently mounted).
          heightPct={detailHeightPct}
          onToggleNotice={() => handleNotifyRestock(detail.productId)}
          onDismiss={handleDismiss}
          // NotifyRestock has no gallery — always clear any stale override from a PREVIOUS
          // `.detail` gallery zoom so the lightbox falls back to its own resolver
          // (rb-rn-product-detail-image-gallery).
          onZoomImage={() => {
            setZoomedDetail(detail);
            setZoomOverridePhotoURL(undefined);
          }}
        />
      );
    } else {
      detailOrRestock = (
        <ProductDetail
          theme={theme}
          detail={detail}
          presentation={actionMode === 'addToCart' ? 'addToCart' : 'detail'}
          live={live}
          isLive={model.isLive}
          variant={model.variant}
          qty={model.qty}
          needsVariantSelection={model.needsVariantSelection}
          addToCartFailed={model.addToCartFailed}
          addToCartInFlight={cartLoadingVisible}
          faved={model.favedForProduct(detail.productId)}
          brief={model.briefForProduct(detail.productId)}
          // 商品介紹（description，rb-rn-product-intro-real-data，parity iOS/Android）—— SAME
          // resolver pattern as `brief` above. THIS IS THE ONLY `<ProductDetail>` construction
          // site in production (see the `showStock` comment below for why that matters): omitting
          // this line would leave the resolver + view fully wired but never actually fed a real
          // value, silently keeping the fallback copy for every host — the exact no-op gap the iOS
          // counterpart change shipped and had to fix in a second round.
          description={model.descriptionForProduct(detail.productId)}
          // Raw hand-off — the sheet owns the single fallback (`normalizeShowStock`).
          // THIS IS THE ONLY `<ProductDetail>` construction site in production, and it serves
          // BOTH presentations (`detail` and `addToCart` are two values of one component, not
          // two components — RN has no separate AddToCartSheet). So dropping this one line
          // silently disables the merchant setting in both sheets at once; a runtime test
          // drives the container through both `actionMode`s to keep that from going unnoticed.
          showStock={showStock}
          // 收藏鈕可見性（rb-rn-subscribe-favorite-visibility-toggle）：raw 轉發，`ProductDetail`
          // owns 唯一的預設值 false（隱藏）。THIS IS THE ONLY `<ProductDetail>` construction site in
          // production — dropping this line would silently disable host opt-in entirely.
          showFavorite={showFavorite}
          // rb-rn-sheetkit-resize-dismiss-unify — LIVE drag-resize/dismiss fraction from the
          // shared presenter below, forwarded for BOTH `.detail` and `.addToCart` presentations.
          heightPct={detailHeightPct}
          onSelectVariant={handleSelectVariant}
          onSetQty={handleSetQty}
          onInc={handleInc}
          onDec={handleDec}
          onAddToCart={handleAddToCart}
          onToggleFavorite={() => handleToggleFavorite(detail.productId)}
          onShare={onShare}
          onDismiss={handleDismiss}
          // rb-rn-product-detail-image-gallery (design R34): `ProductDetail` now forwards the
          // photo URL CURRENTLY shown at the tapped zoom badge (the `.detail` gallery's
          // selection, or `.addToCart`'s single photo) — captured into `zoomOverridePhotoURL` so
          // the lightbox magnifies exactly what the user was looking at, not always the
          // resolver's `primaryPhoto`.
          onZoomImage={(photoURL) => {
            setZoomedDetail(detail);
            setZoomOverridePhotoURL(photoURL);
          }}
          // 「商品介紹」恆顯示 (design R21) — 見 `ProductDetailSheetView` 的 `showsProductIntro`
          // doc comment。
          showsProductIntro
          // 「更多商品」推薦格恆顯示 (rb-rn-recommendation-nav-simplify) — the breadcrumb / nested-
          // detail concept that used to gate this (`detailBreadcrumb.length === 0`) is REMOVED
          // (reverses rb-rn-product-detail-recommendations design.md D1); every `.detail` open is
          // now just "the current one", so there is no remaining "don't render recommendations
          // while nested" guard to express.
          showsRecommendations
          // `isBack` omitted — always the `ProductDetailSheetView` default `false` (header close
          // 恆「✕ 關閉」，no breadcrumb-driven「返回」affordance; see `handleDismiss` above).
          onOpenRecommendation={(recommendation) => openRecommendation(recommendation, 'detail')}
          onQuickAddRecommendation={(recommendation) => openRecommendation(recommendation, 'addToCart')}
          // 換片後關閉 sheet (rb-rn-recommendation-nav-simplify — reverses
          // rb-rn-product-detail-recommendations design.md D3「換片不關閉 sheet」；使用者對既有設計
          // 決定的明確反轉，非疏漏). Forward the switch seam FIRST, then close via the container's
          // existing true-dismiss path.
          //
          // rb-rn-recommendation-close-bag-sheet-on-switch — ALSO close the outer product LIST
          // drawer (`presented`) via the existing `onDismissList` callback. `presented` is a
          // SEPARATE container state from the product-detail sheet (see the `presented` prop doc
          // above) — if the user had the list drawer open, tapped a row to open its detail (the
          // drawer stays `presented=true` in the background, just hidden because the detail sheet
          // draws on top), then switched video from a recommendation card, `handleDismiss()` alone
          // only closed the detail — the drawer reappeared since nothing covered it anymore. Forward
          // unconditionally (same style as the scrim-tap / close-button / rb-rn-product-bag-seek-
          // dismiss call sites below): if the drawer was already closed this is a no-op for the host.
          onPlayRecommendation={(videoId) => {
            onSwitchRecommendationVideo?.(videoId);
            handleDismiss();
            onDismissList?.();
          }}
        />
      );
    }
  }

  // Retain the last non-null sheet so the slide-DOWN dismiss animation still has content while
  // `detailOrRestock` is already null (mirror iOS `displayItem` / Android `shownDetail` / Flutter
  // AnimatedSwitcher's outgoing child).
  if (detailOrRestock != null) lastDetailRef.current = detailOrRestock;

  return (
    <View style={{ flex: 1 }}>
      {/* Surface 1 — product list drawer (GATED): a dim scrim (tap → dismiss) + the bottom-anchored
          drawer. Container-driven (default closed; the GOODS rail/bag tap opens it) — parity iOS
          `ProductSheetsModel.listPresented`, so it no longer auto-presents over the video.
          rb-rn-sheetkit-resize-dismiss-unify: this presentation mechanism (scrim + plain View,
          no slide animation) is UNTOUCHED — the shared drag-resize/dismiss gesture is layered on
          top via `useSheetDragGesture` (design.md Decision 5), not by routing through
          `BottomSheetPresenter`. */}
      {presented ? (
        <>
          <Pressable
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
            onPress={(): void => onDismissList?.()}
          />
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
            onLayout={listCardOnLayout}
          >
            <ProductList
              theme={theme}
              products={model.products}
              cartCount={model.cartCTA.count}
              live={live}
              // rn-product-bag-multi-narrating: the FULL set of LIVE narrate_status==2 products
              // (ProductSheetsModel.liveActiveProducts, mirroring the existing view-model
              // DefaultPlayerTemplate.liveActiveProducts) — NOT the single-value introducingProductId,
              // which only ever carries the core/host "first" convention and would badge at most
              // one row when the backend narrates multiple products simultaneously.
              introducingProductIds={new Set(model.liveActiveProducts.map((p) => p.id))}
              // 縮圖疊層三模式（product-row-status-overlay）：rowMode 為 null（demo model）→
              // ProductList 回退 `live` 派生（baseline byte-identical）；live-bound model 供應
              // 真實 mode + 播放秒數。
              mode={model.rowMode}
              playbackPosition={Math.floor(model.position)}
              heightPct={listHeightPct}
              onOpenProduct={handleOpenProduct}
              onQuickAdd={handleQuickAdd}
              onNotifyRestock={handleOpenRestock}
              onSeekToIntro={onSeekToProductIntro}
              onShareProduct={onShareProduct}
              onOpenCart={handleOpenCart}
              onClose={onDismissList}
            />
            {/* Invisible drag hit-zone over the drawer's own grab handle band
                (rb-rn-sheetkit-resize-dismiss-unify) — same shared gesture as the other 4 sheets.
                rb-rn-sheetkit-drag-row-height: `left`/`right` inset by `DRAG_HIT_SIDE_INSET` so
                this doesn't swallow taps on the header's search-toggle button (leading) / close
                button (trailing) — see `sheetDragGesture.ts`'s `DRAG_HIT_SIDE_INSET` doc comment. */}
            <View
              testID={LBTestIDs.bottomSheetDragHandle}
              {...listDragHandlers}
              style={{
                position: 'absolute',
                top: 0,
                left: DRAG_HIT_SIDE_INSET,
                right: DRAG_HIT_SIDE_INSET,
                height: DRAG_HIT_HEIGHT,
              }}
            />
          </View>
        </>
      ) : null}

      {/* Surface 3 — floating mini-cart peek REMOVED (rb-rn-remove-minicart-peek-surface,
          parity iOS e87e3e0 / Android 2918664): the floating peek looked identical to the VOD
          now-introducing card (same `MiniCartPeek` component) and duplicated the「current
          product」(VOD → now-introducing carousel / LIVE → pinned card); recent-add confirmation
          is the bag-button badge. The `MiniCartPeek` component is retained (the now-introducing
          carousel still renders it) + re-exported (public API); `model.miniCart` /
          `ProductSheetsSeeds.miniCart` stay vestigial (the MiniCartPeek snapshot test uses the
          seed by value). */}

      {/* Surface 2 / 4 — the detail-or-restock sheet, presented when a detail is open. A
          SOLD-OUT detail presents the restock-notify sheet; otherwise the product detail sheet.
          Presented through the shared BottomSheetPresenter (rb-rn-sheetkit-parity, iOS
          BottomSheetPresenter): a full-bleed dim scrim (tap-to-dismiss + background-interaction
          block + fade) BELOW a translate-only sliding card. The presenter stays mounted through
          the dismiss with the retained last content so the slide-down has content; tapping the
          scrim closes the detail (model.closeProductDetail via handleDismiss). */}
      <BottomSheetPresenter
        visible={detailOrRestock != null}
        onDismiss={handleDismiss}
        sheetStyle={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        // rb-rn-sheetkit-resize-dismiss-unify — the unified drag-resize/dismiss gesture is now
        // ALWAYS on (no more `resizable` opt-in); this ONE presenter instance is SHARED by all
        // three sheet kinds (`ProductDetail` in either presentation + `NotifyRestockSheet`,
        // swapped via `detailOrRestock`) and reports the same `heightPct` regardless of which
        // is currently mounted.
        onHeightPctChange={setDetailHeightPct}
      >
        {detailOrRestock ?? lastDetailRef.current}
      </BottomSheetPresenter>

      {/* Product-image lightbox — the LAST child of the root View so it layers ABOVE the
          BottomSheetPresenter (covers the open sheet), mirroring the design's ProductZoomOverlay
          mounted at the player root. Present only while a sheet's zoom badge set `zoomedDetail`. */}
      {zoomedDetail != null ? (
        <ProductImageZoomOverlay
          theme={theme}
          detail={zoomedDetail}
          // Same selected spec the sheet resolved its photo from, so the lightbox magnifies the
          // photo the user actually tapped (rn-product-sheet-spec-photo-reference-ui, mirroring
          // iOS `ProductSheetsOverlayView.swift`). Read live rather than captured with
          // `zoomedDetail`: the lightbox covers the sheet, so the selection cannot change while
          // it is open.
          selectedSpec={model.variant.selectedSpec}
          // rb-rn-product-detail-image-gallery (design R34): the gallery's currently-selected
          // photo (captured at zoom-badge-tap time) wins over the resolver's `primaryPhoto`;
          // `undefined` (NotifyRestock / no gallery context / no resolvable photo) falls back to
          // `ProductImageZoomOverlay`'s own resolver, unchanged from before this prop existed.
          overridePhotoURL={zoomOverridePhotoURL}
          live={live}
          onClose={() => {
            setZoomedDetail(null);
            setZoomOverridePhotoURL(undefined);
          }}
        />
      ) : null}

      {/* 加購「需登入」gate (cart-needs-login-gate) — TOPMOST (last child). REUSES the comment
          login-gate's `AuthGateModal` surface (no new pixel surface); the modal owns its own
          scrim. 前往登入 → host `onRequestLogin` (reference-ui NEVER logs in itself); 稍後再說 /
          scrim → dismiss. `isLoggedIn={false}` — a needs-login add only fires for a guest. */}
      {cartGatePresented ? (
        <AuthGateModal
          theme={theme}
          gate={
            {
              triggerAction: LBAuthTriggerAction.CartAdd,
              productId: null,
              videoId: null,
            } as LBAuthGateState
          }
          isLoggedIn={false}
          // Optional-preserving (lbForwardLogin): undefined onRequestLogin → undefined → 前往登入 hidden
          // (dismiss still via 稍後再說 / scrim). dropin-hide-unwired-affordances-rn.
          onLogin={lbForwardLogin(onRequestLogin, () => setCartGatePresented(false))}
          onDismiss={() => setCartGatePresented(false)}
        />
      ) : null}

      {/* 「請選規格」prompt — TOPMOST (last child), same layer as the cart-needs-login gate. A
          centered LBPAlertModal over its own full-bleed scrim; 我知道了 / scrim → dismiss so the
          variant chips become reachable. Hoisted here (rn-variant-prompt-overlay-fix) — it used to
          be nested in `ProductDetailSheetView` and broke the sheet layout (跑版 / 死鎖). */}
      {variantPromptPresented ? (
        <SelectVariantPromptModal
          theme={theme}
          onDismiss={() => setVariantPromptPresented(false)}
        />
      ) : null}

      {/* 加購成功提示 toast — TOPMOST (last child), bottom-centered over the player frame. The
          wrapper is `pointerEvents="none"` so the toast never eats taps (iOS `allowsHitTesting(false)`
          parity); the下層 sheet / 手勢 stays interactive. Default-hidden → structural snapshots
          unchanged. Flashed on a `cartCTA.count` rise, auto-dismissed ~1.8s later. */}
      {cartToastVisible ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 96,
            alignItems: 'center',
          }}
        >
          <CartToastView theme={theme} />
        </View>
      ) : null}
    </View>
  );
}
