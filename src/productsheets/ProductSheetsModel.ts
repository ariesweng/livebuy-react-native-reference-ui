// ProductSheetsModel — family-3 product sheet-stack read-only snapshot bridge (RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-3 product + sheets, 4 surfaces).
// Phase-4 RN sibling of the DONE iOS `ProductSheetsModel.swift`
// (rb-ios-product-sheets D-1..D-5 + rb-ios-gap-surfaces-design-reconcile 收藏鈕),
// Android `ProductSheetsModel.kt` (rb-android-product-sheets), and Flutter
// `product_sheets_model.dart` (rb-flutter-product-sheets). This RN family builds in
// the iOS-reconciled FINAL state from scratch — the product DETAIL sheet INCLUDES
// the 收藏鈕 (到貨追蹤 type=1) to the LEFT of the 加入購物車 CTA (this is why the RN
// gap-surfaces family later is 2-ADDED-only).
//
// It bridges the headless template view-models exposed by `DefaultPlayerTemplate`
// (obtained at runtime by the host via `attachPlayerTemplate`) into a read-only
// snapshot the four family-3 RN surface components read. It is a pure read-only
// MIRROR — IDENTICAL pattern to family-1 `PlayerShellModel` / family-2 `FeedWinModel`:
//
//   - It owns NO second copy of authoritative state. Every getter reads the
//     template's own public getter each call (`productOverlayState.products` /
//     `cartCTAState.count` / `productDetailState` / `variantState` / `qtyState` /
//     `miniCartPeek` / `awaitEnabled` / `noticeEnabled` / `selectSpecRequired` /
//     `addToCartFailed`), so there is nothing to drift from the template (D-1).
//   - It adds NO pixels and adds NO accessor / view-model to
//     `livebuy-react-native-ui` (a template-layer concern, out of scope here).
//   - reference-ui NEVER calls core `addToCart` / `setAwaitGoods` / `setNoticeGoods`
//     directly. Mutating interactions are thin forwarders to the EXISTING public
//     template exits (`selectVariant` / `setQty` / `incQty` / `decQty` / `addToCart`
//     / `dismissMiniCart` / `openCart` / `toggleNotice` / `toggleAwait`). The template
//     assembles the route-B cart request internally (NO HTTP in this layer).
//   - PRODUCT-ROW TAP is NOT a template forwarder. The list row only forwards the tap to
//     a container callback (`onOpenProduct`); this model carries NO row-tap forwarder
//     (mirrors family-2 `FeedWinModel`'s eventJoin exit). The turnkey container owns the
//     behaviour behind that callback (`defaultOpenProduct` — core
//     `productOverlay.simulateProductTap` for telemetry + `attachment.handleProductTap`
//     to open the detail; a host `config.onOpenProduct` replaces both).
//
// ★ RN TEMPLATE BINDING NOTES (differ from the Flutter blueprint — confirmed by
//   reading react-native-ui/src/DefaultTemplate.ts + ProductSheet.ts):
//   - The「請選規格」guard getter is `selectSpecRequired` (NOT `needsVariantSelection`).
//   - Goods-tracking is exposed via DIRECT template methods —
//     `template.awaitEnabled(gpn)` / `template.noticeEnabled(gpn)` /
//     `template.toggleAwait(gpn)` / `template.toggleNotice(gpn)` (the internal
//     `DefaultGoodsTracking` is private; there is NO public `template.goodsTracking`
//     field on RN, unlike the Flutter `goodsTracking.*` path).
//   - `LBVariantState.selection` is a `readonly number[]` indexed by groupIndex
//     (`-1` = unchosen), NOT a `Map<int,int>`. A chip is selected when
//     `selection[groupIndex] === optionIndex`.
//   - core `LBProduct.id` / `goodsGpn` / `price` / `originalPrice` are STRINGS
//     (cross-platform parity / JS Number-precision rule; differs from Flutter's
//     numeric `price`).
//
// React components re-render via the container's `useState` + the template's
// coalesced `subscribe()`; on each notify the container RE-READS these getters off a
// freshly-constructed read-only model (the model holds no state of its own). It just
// centralizes the read mapping + deterministic demo seeds (parity with the Flutter
// `ProductSheetsModel`, which holds no Flutter state either).
//
// No react / react-native import here — pure reads + plain-literal demo seeds, so it
// stays unit-testable in a plain node environment.

import type { DefaultPlayerTemplate } from 'livebuy-react-native-ui';
import type {
  LBProductDetailState,
  LBProductRecommendation,
  LBVariantState,
  LBQtyState,
  LBMiniCartPeek,
  LBCartCTAState,
} from 'livebuy-react-native-ui';
import type { LBProduct } from 'livebuy-react-native';
import type { ProductRowMode } from './ProductRowOverlay';

/**
 * Read-only snapshot bridge for the family-3 product-sheets surfaces. Wraps a live
 * {@link DefaultPlayerTemplate}; every accessor reads the template's public getter
 * each call (no stored mirror). For demos / previews / structural snapshot tests,
 * construct with `template = null` and the accessors return the deterministic
 * {@link ProductSheetsSeeds} defaults instead (parity with the Flutter
 * `ProductSheetsModel(template: null)`).
 */
export class ProductSheetsModel {
  /** The bound template, or `null` for demo / snapshot instances. */
  readonly template: DefaultPlayerTemplate | null;

  /**
   * FALLBACK source for {@link briefForProduct} / {@link descriptionForProduct} — a「更多商品」
   * 推薦卡商品可能只存在於 `channel.otherGoods`，不在 `products` 快照內（RN 結構性沒有 iOS/Android
   * 那種 channel resolver，見 `recommendationBreadcrumb.ts` 檔頭）。容器（`ProductSheetsView`）持有
   * 一個跨 render 存續的 `useRef` Map，在使用者點推薦卡本體 / 加購鈕（`openRecommendation`）轉發
   * `onOpenProduct` 之前，把該推薦商品的 `{ brief, description }` 以 `productId` 為 key 寫入；此欄位
   * 只持有「同一個 Map 物件」的參照（container 每次 render 傳入同一個 `recommendationCacheRef.current`），
   * 故容器稍後的寫入對後續任一次讀取皆可見。`ReadonlyMap`——本類別自己永不寫入，只讀。`undefined`（demo /
   * 既有未傳第二參數的測試實例）時兩個 resolver 單純略過 FALLBACK 查找（PRIMARY-only，行為不變）。
   * rb-rn-recommendation-product-intro-carry-through（design.md Decision 2）。
   */
  private readonly recommendationFallbackCache?: ReadonlyMap<
    string,
    { readonly brief: string; readonly description: string }
  >;

  /**
   * Bridge a live template (host-supplied) — or `null`/omitted for the
   * deterministic demo seeds (previews / structural snapshot tests). `recommendationFallbackCache`
   * is optional (existing single-argument call sites — `ProductSheetsModel.test.ts` /
   * `PlayerDemoSeedGating.test.ts` — remain source-compatible); the production call site
   * (`ProductSheetsView.tsx`) passes its `recommendationCacheRef.current`.
   */
  constructor(
    template?: DefaultPlayerTemplate | null,
    recommendationFallbackCache?: ReadonlyMap<string, { readonly brief: string; readonly description: string }>,
  ) {
    this.template = template ?? null;
    this.recommendationFallbackCache = recommendationFallbackCache;
  }

  // -- Surface 1: ProductList ← product list drawer + cart CTA ----------------

  /**
   * The core-fed products snapshot, surfaced INTRODUCING-FIRST by the data layer
   * (`productOverlayState.productsIntroducingFirst` — the LIVE narrate_status==2
   * product is moved to the front, the rest keep their relative order; VOD / nothing
   * introducing → equal to the plain order). Already ordered by the data layer — this
   * layer MUST NOT slice / merge / re-sort (a second copy would violate single-truth).
   * For demo instances returns {@link ProductSheetsSeeds.products}. Parity iOS /
   * Android `ProductSheetsModel.products` ← `productsIntroducingFirst`.
   */
  get products(): readonly LBProduct[] {
    // demo seed ONLY when unbound; a BOUND template returns its real (possibly empty) list —
    // the `??` must NOT leak demo products into a real session (rb-rn-player-demo-seed-leak).
    return this.template == null
      ? ProductSheetsSeeds.products
      : this.template.productOverlayState.productsIntroducingFirst;
  }

  /**
   * The currently-introducing product's id (`productOverlayState.introducingProductId`).
   * The product-list row whose `id` matches draws the「介紹中」banner (LIVE-only). `null`
   * → none. For demo instances returns `null`. Parity iOS / Android `introducingProductId`.
   */
  get introducingProductId(): string | null {
    return this.template?.productOverlayState.introducingProductId ?? null;
  }

  /**
   * The core-fed products snapshot in RAW BACKEND ORDER (`productOverlayState.products`) — NOT
   * introducing-first-reordered (contrast {@link products} above, which reads
   * `productsIntroducingFirst`). Backs the product-row NUMBER BADGE
   * (rb-rn-product-row-number-badge, design R35): a row's number is its 1-based position in
   * THIS list, so it stays stable across an introducing-product reorder (LIVE) and simply
   * reflects the backend's own delivered order (VOD / replay — a fixed list, no reorder at
   * all). `productOverlayState.products` is an EXISTING public template field (`DefaultTemplate
   * .ts`'s `productOverlayState` getter already returns it) — this getter adds no view-model
   * capability, it is the first reference-ui reader of this existing field. For demo instances
   * returns {@link ProductSheetsSeeds.products} (the SAME seed array {@link products} falls back
   * to when unbound — the demo seeds are never reordered either way, so both getters agree for
   * demo instances). Parity iOS / Android / Flutter `ProductSheetsModel.productsBackendOrder`.
   */
  get productsBackendOrder(): readonly LBProduct[] {
    return this.template == null
      ? ProductSheetsSeeds.products
      : this.template.productOverlayState.products;
  }

  /**
   * ALL products currently being introduced LIVE (`narrate_status == 2`) — mirrors the EXISTING
   * view-model capability `DefaultPlayerTemplate.liveActiveProducts` (rb-rn-live-now-introducing-carousel;
   * already consumed by the SEPARATE `PlayerShellModel.liveActiveProducts`, family-1's LIVE
   * pinned-card carousel — a DIFFERENT model / surface that this class does not share state with).
   * {@link introducingProductId} above is the single-value ("first") reading of the SAME underlying
   * core/host data (`productOverlayState.introducingProductId`); this exposes the FULL set so the
   * product-bag LIST can badge every simultaneously-narrating row instead of only the first
   * (rn-product-bag-multi-narrating). Order follows the template's own `products` order (no
   * re-sort here — ordering is the data layer's job). For demo instances (`template == null`)
   * returns `[]` (parity `PlayerShellModel.liveActiveProducts`'s demo leg).
   */
  get liveActiveProducts(): readonly LBProduct[] {
    return this.template == null ? [] : this.template.liveActiveProducts;
  }

  // -- Surface 1: ProductList ← product-row thumbnail overlay mode (product-row-status-overlay) --
  //
  // Playback-mode signals for the row thumbnail overlay. Mirrored from the template
  // `playerHeaderState.isLive` / `playerHeaderState.isFinishedLiveReplay` / `playbackProgressState
  // .position`. For demo instances (`template == null`) return false / false / 0 so {@link rowMode}
  // is `null` → ProductList falls back to the real-frame `live` flag (snapshots byte-identical).
  // Parity iOS / Android `ProductSheetsModel.isLive` / `isReplay` / `position`.

  /** LIVE/VOD flag (`playerHeaderState.isLive`). Demo → false. */
  get isLive(): boolean {
    return this.template?.playerHeaderState.isLive ?? false;
  }

  /**
   * 已結束直播回放旗標（`playerHeaderState.isFinishedLiveReplay` — `type == 3 || (type == 2 &&
   * liveStatus == 3)`，host-fed via `handleHeaderChrome`）。**getter 名稱維持 `isReplay`**（既有
   * `rowMode` 商品列縮圖覆蓋層模式的公開介面），但資料來源 MUST NOT 讀 `playbackProgressState
   * .isReplay`——那是一個語意完全不同、互斥的窄義 DVR 旗標（直播仍在進行中、播放頭被拖到直播邊緣後方，
   * `liveStatus == 1` 時才可能為 `true`；對「已結束直播回放」的影片永遠是 `false`，會讓 `rowMode`
   * 誤判為 `'vod'` —— rb-rn-product-row-replay-flag-fix 修正的接線錯誤）。對照 family-1
   * `PlayerShellModel` 已正確拆成兩個獨立 getter（`PlayerShellModel.isReplay` ←
   * `playbackProgressState.isReplay`；`PlayerShellModel.isFinishedLiveReplay` ←
   * `playerHeaderState.isFinishedLiveReplay`，`PlayerShellModel.ts:123-144`）——`ProductSheetsModel`
   * 這裡只有單一「該不該當回放渲染」的消費端（`rowMode`），故不比照拆成兩個 getter，直接把 `isReplay`
   * 指向正確來源。Demo → false.
   */
  get isReplay(): boolean {
    return this.template?.playerHeaderState.isFinishedLiveReplay ?? false;
  }

  /** Current playhead seconds (`playbackProgressState.position`). Demo → 0. */
  get position(): number {
    return this.template?.playbackProgressState.position ?? 0;
  }

  /**
   * Derived playback mode for the product-row overlay (replay takes precedence over
   * live). `null` for a demo / snapshot model (no bound template) → the view falls
   * back to its real-frame `live` flag so baselines stay byte-identical. Parity iOS /
   * Android `ProductSheetsModel.rowMode`.
   */
  get rowMode(): ProductRowMode | null {
    if (this.template == null) return null;
    if (this.isReplay) return 'replay';
    if (this.isLive) return 'live';
    return 'vod';
  }

  /**
   * The detail target (`productOverlayState.activeProduct`); the narrate_status==2
   * product the list drawer pins. `null` → none. For demo instances returns the
   * in-stock variant product ({@link ProductSheetsSeeds.activeProduct}).
   */
  get activeProduct(): LBProduct | null {
    // demo seed ONLY when unbound; a BOUND template with no narrate_status==2 product → null
    // (the `??` must NOT leak the demo product into a real session, rb-rn-player-demo-seed-leak).
    return this.template == null
      ? ProductSheetsSeeds.activeProduct
      : this.template.productOverlayState.activeProduct;
  }

  /**
   * Per-session successful-add count (`cartCTAState`); the cart CTA shows the
   * count badge when `> 0`. For demo instances returns
   * {@link ProductSheetsSeeds.cartCTA}.
   */
  get cartCTA(): LBCartCTAState {
    // demo seed ONLY when unbound; a BOUND template returns its real count (count 0 when none) —
    // the `??` must NOT leak the demo count==2 badge into a real session (rb-rn-player-demo-seed-leak).
    return this.template == null ? ProductSheetsSeeds.cartCTA : this.template.cartCTAState;
  }

  // -- Surface 2/4: ProductDetail / NotifyRestockSheet ← detail snapshot -------

  /**
   * Product-detail sheet snapshot (`productDetailState`); `null` until a
   * `diversion == 0` product-tap opens a detail. Drives whether the detail (and,
   * when sold-out, the restock-notify) sheet is presented. For demo instances
   * returns {@link ProductSheetsSeeds.detail} (the in-stock variant detail).
   */
  get detail(): LBProductDetailState | null {
    // demo seed ONLY when unbound; a BOUND template with no open detail → null (no sheet) —
    // the `??` must NOT leak the demo detail sheet into a real session before any product-tap
    // (rb-rn-player-demo-seed-leak). variant / qty are read only when detail != null, so gating
    // detail alone keeps the whole detail sheet from leaking.
    return this.template == null ? ProductSheetsSeeds.detail : this.template.productDetailState;
  }

  // -- Surface 2: ProductDetail ← variant + qty -------------------------------

  /**
   * Variant-picker snapshot (`variantState` — `groups` / `selection` (a
   * `readonly number[]`, groupIndex → optionIndex, `-1` = unchosen) /
   * `selectedSpec` / `selectedSpecificationId`). A chip is selected when
   * `selection[groupIndex] === optionIndex`. For demo instances returns
   * {@link ProductSheetsSeeds.variant}.
   */
  get variant(): LBVariantState {
    return this.template?.variantState ?? ProductSheetsSeeds.variant;
  }

  /**
   * Qty-stepper snapshot (`qtyState` — `{ qty, min, max }`). Sold-out /
   * out-of-stock → `max === 0` (stepper + CTA disabled). For demo instances
   * returns {@link ProductSheetsSeeds.qty}.
   */
  get qty(): LBQtyState {
    return this.template?.qtyState ?? ProductSheetsSeeds.qty;
  }

  // -- Surface 2 (guard flags): add-to-cart prompts ---------------------------

  /**
   * 「請選規格」guard flag (`DefaultPlayerTemplate.selectSpecRequired`) — set true
   * when `addToCart()` is called with an incomplete spec selection. For demo
   * instances false. (RN getter name is `selectSpecRequired`, NOT
   * `needsVariantSelection`.)
   */
  get needsVariantSelection(): boolean {
    return this.template?.selectSpecRequired ?? false;
  }

  /**
   * Add-to-cart failure flag (`DefaultPlayerTemplate.addToCartFailed`) — set true
   * when the route-B add rejected; drives the failure banner. For demo instances
   * false.
   */
  get addToCartFailed(): boolean {
    return this.template?.addToCartFailed ?? false;
  }

  /**
   * Add-to-cart「需登入」flag (`DefaultPlayerTemplate.addToCartNeedsLogin`) — set true
   * when the route-B add rejected with the core empty-`buy_no` serverError(401); drives
   * the `AuthGateModal(cartAdd)` login gate instead of the failure banner (orthogonal to
   * {@link addToCartFailed}). For demo instances false (cart-needs-login-gate).
   */
  get addToCartNeedsLogin(): boolean {
    return this.template?.addToCartNeedsLogin ?? false;
  }

  /**
   * 加購「請求中」flag (`DefaultPlayerTemplate.addToCartInFlight`, rb-rn-cart-add-loading-state) —
   * addcart 請求委派中為 true、各結果（success/dedupe/failure/needs-login）回 false。驅動加購 CTA
   * loading（spinner +「加入中…」、鎖 stepper/規格）。容器以 320ms 防閃爍 floor derive 後傳入 CTA。
   * 與 {@link addToCartFailed} / {@link addToCartNeedsLogin} 正交。For demo instances false.
   */
  get addToCartInFlight(): boolean {
    return this.template?.addToCartInFlight ?? false;
  }

  // -- Surface 3: MiniCartPeek ← mini-cart peek -------------------------------

  /**
   * Mini-cart peek snapshot (`miniCartPeek`); `null` → no floating peek. For demo
   * instances returns {@link ProductSheetsSeeds.miniCart}.
   */
  get miniCart(): LBMiniCartPeek | null {
    // demo seed ONLY when unbound; a BOUND template with no recent add → null. The `??` must
    // NOT leak the demo peek into a real session (rb-rn-player-demo-seed-leak). Vestigial after
    // the floating peek surface was removed (rb-rn-remove-minicart-peek-surface), but kept gated.
    return this.template == null ? ProductSheetsSeeds.miniCart : this.template.miniCartPeek;
  }

  // -- Goods-tracking reads (product-detail 收藏 type=1 / restock notice type=2)--
  //
  // ★ RN binding: DIRECT template methods `awaitEnabled(gpn)` / `noticeEnabled(gpn)`
  //   (there is no public `template.goodsTracking` field). `LBProductDetailState`
  //   carries only `productId`, but the goods-tracking flags are keyed by `goodsGpn`
  //   (the template seeds them via `LBProduct.goodsGpn`), so the favorite / restock
  //   toggles MUST map productId → the originating `LBProduct.goodsGpn` (D-5:「goodsGpn
  //   從 product 讀」). The surfaces read these directly off the model via a goodsGpn.

  /**
   * Read the current 收藏（await type=1）state for a `goodsGpn` —
   * `DefaultPlayerTemplate.awaitEnabled(goodsGpn)`. For demo instances returns
   * {@link ProductSheetsSeeds.demoFavEnabled}.
   */
  favedFor(goodsGpn: string): boolean {
    return this.template?.awaitEnabled(goodsGpn) ?? ProductSheetsSeeds.demoFavEnabled;
  }

  /**
   * Read the current restock-notify subscription state for a `goodsGpn` —
   * `DefaultPlayerTemplate.noticeEnabled(goodsGpn)`. This is a READ of the NOTICE
   * flag ONLY (the AWAIT flag is the 收藏 affordance, read via {@link favedFor}).
   * For demo instances returns {@link ProductSheetsSeeds.demoNoticeEnabled}.
   */
  restockSubscribedFor(goodsGpn: string): boolean {
    return this.template?.noticeEnabled(goodsGpn) ?? ProductSheetsSeeds.demoNoticeEnabled;
  }

  /**
   * Resolve the goods-tracking key (`goodsGpn`) for a product detail from the
   * `products` snapshot (D-5). `LBProductDetailState` carries only `productId`, and
   * the goods-tracking flags are keyed by `goodsGpn`, so the restock / favorite
   * toggles MUST map productId → the originating `LBProduct.goodsGpn` rather than
   * key off the productId directly. `null` when the product is not in the list.
   */
  goodsGpnForProduct(productId: string): string | null {
    for (const p of this.products) {
      if (p.id === productId) return p.goodsGpn;
    }
    return null;
  }

  /** 收藏 state for a product DETAIL (resolves goodsGpn from `productId`). */
  favedForProduct(productId: string): boolean {
    const gpn = this.goodsGpnForProduct(productId);
    return gpn == null ? false : this.favedFor(gpn);
  }

  /** Restock-notify state for a product DETAIL (resolves goodsGpn from `productId`). */
  restockSubscribedForProduct(productId: string): boolean {
    const gpn = this.goodsGpnForProduct(productId);
    return gpn == null ? false : this.restockSubscribedFor(gpn);
  }

  /**
   * 商品說明（`LBProduct.brief`）— 由 `products` 快照以 `productId` 解析（D-3 同模式：
   * `LBProductDetailState` 不帶 `brief`，只有 `productId`；`brief` 在原始 `LBProduct` 上）。
   * 無對應商品（或 demo 無 products）回 `''`，呼叫端據此 gate 不畫說明區塊
   * （rb-rn-product-sheet-detail-polish 問題 4，iOS `ProductSheetsModel.brief(forProductId:)` parity）。
   *
   * **PRIMARY→FALLBACK（`rb-rn-recommendation-product-intro-carry-through`）**：上述 `products`
   * 快照查找是 PRIMARY 來源——`productId` 在 `products` 內找得到即直接回傳該商品自己的 `brief`
   * （即使恰好是空字串，也不會改讀 FALLBACK；`products`-membership、非字串是否為空，才是 PRIMARY
   * 權威的判斷依據，design.md Decision 2 的刻意簡化）。只有當 `productId` 完全不在 `products`
   * 內時（典型情境：該商品只存在於「更多商品」推薦格引用的 `channel.otherGoods`），才退回
   * {@link recommendationFallbackCache}；快取亦查無對應商品時仍回 `''`（與既有規則一致）。
   */
  briefForProduct(productId: string): string {
    for (const p of this.products) {
      if (p.id === productId) return p.brief;
    }
    return this.recommendationFallbackCache?.get(productId)?.brief ?? '';
  }

  /**
   * 商品介紹（`LBProduct.description`，`add-product-description-core-rn`）— 由 `products` 快照以
   * `productId` 解析，SAME PATTERN as `briefForProduct` above (`LBProductDetailState` 不帶
   * `description`，只有 `productId`；`description` 在原始 `LBProduct` 上). 無對應商品（或 demo 無
   * products）、或該商品的 `description` 本身就是空字串／未設定，皆回 `''`——與 `briefForProduct`
   * 不同的是 `LBProduct.description` 是 OPTIONAL (`string | undefined`，
   * `add-product-description-core-rn` design.md Decision 1：optional 是為了不破壞下游套件手寫字面
   * 量的 typecheck)，故這裡要 `p.description ?? ''` 把 `undefined` 收斂成 `''`，回傳型別維持
   * `string`（與 `briefForProduct` 一致；`brief` 是必填欄位不需要這個 nullish coalescing）。
   *
   * 呼叫端（`ProductDetail` 的 `productIntroSection`，rb-rn-product-intro-bgcolor-and-hide-empty
   * 起）用 `''` 這個空字串整塊隱藏商品介紹區塊（含標題）——沒有任何 fallback 文案。
   *
   * **PRIMARY→FALLBACK（`rb-rn-recommendation-product-intro-carry-through`）**：SAME 順序 as
   * `briefForProduct` above——`products` 快照查找是 PRIMARY，只有 `productId` 完全不在 `products`
   * 內時才退回 {@link recommendationFallbackCache}；快取亦查無對應商品時仍回 `''`。
   */
  descriptionForProduct(productId: string): string {
    for (const p of this.products) {
      if (p.id === productId) return p.description ?? '';
    }
    return this.recommendationFallbackCache?.get(productId)?.description ?? '';
  }

  // -- Read-only host intents (pass-through to the bound template) ------------
  //
  // Thin forwarders for the template-owned product sheet-stack intents the family-3
  // surfaces drive. Each is a no-op for demo instances (no bound template).
  // reference-ui NEVER calls core directly — these route through the EXISTING public
  // template / model exits.

  /** Forward a variant chip tap → `template.selectVariant(gi, oi)`. No-op for demo. */
  selectVariant(groupIndex: number, optionIndex: number): void {
    this.template?.selectVariant(groupIndex, optionIndex);
  }

  /** Forward a direct qty set → `template.setQty(n)`. No-op for demo. */
  setQty(value: number): void {
    this.template?.setQty(value);
  }

  /** Forward a qty `+` tap → `template.incQty()`. No-op for demo. */
  incQty(): void {
    this.template?.incQty();
  }

  /** Forward a qty `-` tap → `template.decQty()`. No-op for demo. */
  decQty(): void {
    this.template?.decQty();
  }

  /**
   * Forward the 加入購物車 intent → `template.addToCart()` (template assembles the
   * route-B request internally; reference-ui NEVER calls core addToCart directly —
   * NO HTTP here). No-op for demo instances.
   */
  addToCart(): void {
    void this.template?.addToCart();
  }

  /**
   * Forward a cart-CTA tap → `template.openCart()` (host passthrough; the template
   * owns no checkout page). No-op for demo instances.
   */
  openCart(): void {
    this.template?.openCart();
  }

  /** Forward a mini-cart dismiss → `template.dismissMiniCart()`. No-op for demo. */
  dismissMiniCart(): void {
    this.template?.dismissMiniCart();
  }

  /**
   * Forward a sheet dismiss → `template.closeProductDetail()` (clears the open
   * `productDetailState` so a later re-tap of the SAME product re-opens — the
   * template's `openDetail` is diff-then-notify, parity with iOS / Android / Flutter
   * sheet-dismiss → closeDetail). No-op for demo instances (no bound template).
   */
  closeProductDetail(): void {
    this.template?.closeProductDetail();
  }

  /**
   * Forward a 收藏（到貨追蹤 type=1）toggle → `template.toggleAwait(goodsGpn)`
   * (optimistic flip of ONLY the await flag → core `setAwaitGoods` type=1; corrected
   * by `AWAIT_GOODS_CHANGED`). This is the product-detail 收藏 / 加入我的最愛 affordance
   * (reconciled into family-3); the restock NOTICE toggle is independent. No-op for
   * demo instances.
   */
  toggleFavorite(goodsGpn: string): void {
    this.template?.toggleAwait(goodsGpn);
  }

  /**
   * Forward a restock-notify toggle → `template.toggleNotice(goodsGpn)` (optimistic
   * flip of ONLY the notice flag → core `setNoticeGoods` type=2; corrected by
   * `NOTICE_GOODS_CHANGED`). This is the ONLY goods-tracking write the restock sheet
   * makes (the AWAIT switch is the product-detail 收藏 affordance). No-op for demo.
   */
  toggleRestock(goodsGpn: string): void {
    this.template?.toggleNotice(goodsGpn);
  }
}

// MARK: - Deterministic demo seeds (previews / structural snapshot tests)

/**
 * Plain-literal deterministic seeds for the family-3 surfaces' previews + the
 * per-surface structural snapshot tests. Built from the public template / core
 * view-model shapes (`LBProduct` / `LBProductDetailState` / `LBVariantState` /
 * `LBQtyState` / `LBMiniCartPeek` / `LBCartCTAState`) so a snapshot does NOT depend
 * on a live player. Mirrors the iOS / Android / Flutter `ProductSheetsSeeds`.
 *
 * ★ RN `LBProduct.id` / `goodsGpn` are STRINGS; `price` / `originalPrice` are STRINGS
 *   (`originalPrice` nullable) — cross-platform parity / JS Number-precision rule
 *   (differs from Flutter's `double` price). `LBVariantState.selection` is a
 *   `readonly number[]` (groupIndex → optionIndex; `-1` = unchosen).
 *
 * The seeds are FULLY stocked so the container can drive all four surface states with
 * a single `template = null` model:
 *   • {@link products} — the list drawer (one sold-out row) + `cartCTA.count === 2`.
 *   • {@link detail} / {@link variant} / {@link qty} — the in-stock variant detail.
 *   • {@link miniCart} — the in-stock mini-cart peek.
 *   • {@link restockDetail} — the SOLD-OUT detail for the restock-notify sheet.
 */

/** goodsGpn of the in-stock variant product (detail + list row + fav/notice key). */
const VARIANT_GOODS_GPN = 'gpn-velvet-lip-04';
/** goodsGpn of the sold-out product (list sold-out row + restock detail key). */
const SOLD_OUT_GOODS_GPN = 'gpn-aurora-blush-soldout';
/** productId of the in-stock variant product. */
const VARIANT_PRODUCT_ID = 'demo-prod-velvet-lip';
/** productId of the sold-out product. */
const SOLD_OUT_PRODUCT_ID = 'demo-prod-aurora-blush';

/** The in-stock variant spec dimensions (one「色號」group with three options). */
const VARIANT_SPEC_OPTIONS = [
  { name: '色號', child: ['#02 裸粉', '#04 焦糖', '#07 楓糖'] },
];

/** The resolvable specs for the variant product (one per color option). */
const VARIANT_SPECS = [
  {
    id: 'spec-02',
    name: '#02 裸粉',
    specificationNo: 'SN-02',
    price: '380',
    priceShow: 'NT$380',
    originalPrice: null,
    originalPriceShow: '',
    stock: 4,
    photos: [],
  },
  {
    id: 'spec-04',
    name: '#04 焦糖',
    specificationNo: 'SN-04',
    price: '380',
    priceShow: 'NT$380',
    originalPrice: null,
    originalPriceShow: '',
    stock: 9,
    photos: [],
  },
  {
    id: 'spec-07',
    name: '#07 楓糖',
    specificationNo: 'SN-07',
    price: '380',
    priceShow: 'NT$380',
    originalPrice: null,
    originalPriceShow: '',
    stock: 6,
    photos: [],
  },
];

/**
 * The SPEC-PRICED spec — a copy of the seeded `#04 焦糖` spec whose ONLY difference is
 * the price pair. Backs {@link ProductSheetsSeeds.variantSpecPriced}.
 *
 * ── WHY THIS EXISTS (rn-product-sheet-demo-fixture-spec-coverage-reference-ui) ──
 *
 * `VARIANT_SPECS[1]` (the spec `ProductSheetsSeeds.variant` resolves to) carries
 * `priceShow: 'NT$380'` — LITERALLY THE SAME as `ProductSheetsSeeds.detail.priceShow`.
 * So `resolvePriceDisplay` can pick the spec source or the product source and the
 * rendered sale price is IDENTICAL: the existing 6 `ProductDetail` snapshots have ZERO
 * discriminating power over the sibling change's headline behavior ("the spec price
 * REPLACES the product price"). A regression that made the resolver always return the
 * product level would leave all 6 of them green. "The baseline didn't move" MUST NOT be
 * read as a correctness signal there.
 *
 * This fixture is that missing signal — and it is a PURE ADDITION: the existing seeds
 * are NOT touched, because the existing 6 baselines are currently the only thing
 * guarding D3-b (spec HAS a sale price but NO original → do NOT draw the strike-through,
 * do NOT borrow the product's NT$480 — the fake-discount rule, the most mirror-fragile
 * clause across the four platforms).
 *
 * ── WHY THESE PARTICULAR STRINGS ──
 *
 *   • BOTH differ from the product level ('NT$380' / 'NT$480') — so "the sale price
 *     didn't follow the spec" and "the original price didn't follow the spec" are each
 *     independently detectable.
 *   • NEITHER COLLIDES with any product-level string — which is what lets the tests
 *     assert "the tree MUST NOT contain 'NT$380' / 'NT$480'" cleanly. (This is why the
 *     values are not the equidistant 'NT$280' / 'NT$380': that original would collide
 *     with the product's SALE price and void the assertion.)
 *   • SAME CHARACTER WIDTH as the product-level strings (same `NT$` prefix, 3 digits) —
 *     the diff against the twin snapshot stays confined to the characters themselves.
 *   • RN's OWN FORMAT — no space after `NT$` (`'NT$380'`), unlike iOS's `"NT$ 390"`.
 *
 * `price` / `originalPrice` are kept in sync with their `*Show` counterparts (RN price
 * fields are STRINGS): a fixture claiming an original price while its numeric model says
 * `null` would be self-contradictory — exactly the shape rejected in the price change.
 *
 * Built by SPREADING `VARIANT_SPECS[1]` (a COPY, not an alias) so `id` / `name` /
 * `specificationNo` / `stock` / `photos` provably carry over and the price pair is the
 * only difference — and so `VARIANT_SPECS` itself is left untouched. It MUST NOT be
 * pushed into / edited inside `VARIANT_SPECS`: that array is SHARED by
 * `products[0].specifications`, `detail.specifications` and `variant.selectedSpec`, so
 * any in-place edit would also churn the product-list baseline.
 *
 * ★ `photos` stays `[]` DELIBERATELY — see the note on {@link ProductSheetsSeeds.detail}.
 */
const SPEC_PRICED_SPEC = {
  ...VARIANT_SPECS[1]!,
  price: '290',
  priceShow: 'NT$290',
  originalPrice: '390',
  originalPriceShow: 'NT$390',
};

/** Build a full-shape demo `LBProduct` (all required core fields). */
function demoProduct(p: Partial<LBProduct> & Pick<LBProduct, 'id' | 'goodsGpn' | 'name'>): LBProduct {
  return {
    goodsNo: '',
    price: '',
    priceShow: '',
    originalPrice: null,
    originalPriceShow: '',
    stock: 0,
    pic: '',
    photos: [],
    brief: '',
    soldOut: 0,
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
    ...p,
  } as LBProduct;
}

export const ProductSheetsSeeds = {
  // -- goodsGpn / productId constants (keep seeds self-consistent) ------------
  variantGoodsGpn: VARIANT_GOODS_GPN,
  soldOutGoodsGpn: SOLD_OUT_GOODS_GPN,
  variantProductId: VARIANT_PRODUCT_ID,
  soldOutProductId: SOLD_OUT_PRODUCT_ID,

  // -- Demo goods-tracking flags (state selectors) ----------------------------

  /**
   * 收藏（await type=1）demo flag: the in-stock golden reads `false` (空心 heart
   *「收藏」); a favorited golden flips this to `true` (實心 heart + accent「已收藏」).
   */
  demoFavEnabled: false,

  /** Restock notice（type=2）demo flag: not-subscribed reads `false` (toggle off). */
  demoNoticeEnabled: false,

  // -- Surface 1: product list drawer + cart CTA ------------------------------

  /** Per-session add count for the cart CTA (the populated drawer shows count == 2). */
  cartCTA: { count: 2 } as LBCartCTAState,

  /**
   * Deterministic demo products: the in-stock variant product, a second in-stock
   * product, and a SOLD-OUT product (one `soldOut == 1` row). Insertion-ordered
   * (the list MUST NOT re-sort). Mirrors iOS / Android / Flutter list seeds.
   */
  products: [
    demoProduct({
      id: VARIANT_PRODUCT_ID,
      goodsNo: 'V-LIP-04',
      name: '絲絨霧面唇釉 #04 焦糖',
      price: '380',
      priceShow: 'NT$380',
      originalPrice: '480',
      originalPriceShow: 'NT$480',
      stock: 9,
      goodsGpn: VARIANT_GOODS_GPN,
      // 商品說明（brief）— 不在列表渲染（只在 detail 出現），故不影響 snapshot；供 briefForProduct
      // 解析（問題 4，rb-rn-product-sheet-detail-polish）。
      brief: '夏日通勤彩妝主打色',
      // 商品介紹（description）— 同上不在列表渲染，只供 descriptionForProduct 解析
      // （rb-rn-product-intro-real-data）。與 brief 是刻意不同的兩個獨立欄位，值也刻意不同。
      description: '質地輕盈、顯色持久，特殊配方不易脫色，適合長時間配戴。',
      soldOut: 0,
      isHot: 1,
      specifications: VARIANT_SPECS as LBProduct['specifications'],
      specOptions: VARIANT_SPEC_OPTIONS as LBProduct['specOptions'],
    }),
    demoProduct({
      id: 'demo-prod-glow-serum',
      goodsNo: 'GLOW-SER',
      name: '亮顏精華露 30ml',
      price: '690',
      priceShow: 'NT$690',
      originalPrice: null,
      originalPriceShow: '',
      stock: 5,
      goodsGpn: 'gpn-glow-serum',
      soldOut: 0,
    }),
    demoProduct({
      id: SOLD_OUT_PRODUCT_ID,
      goodsNo: 'AURORA-BLUSH',
      name: 'Aurora 腮紅 #02 蜜桃',
      price: '320',
      priceShow: 'NT$320',
      originalPrice: '420',
      originalPriceShow: 'NT$420',
      stock: 0,
      goodsGpn: SOLD_OUT_GOODS_GPN,
      soldOut: 1,
    }),
  ] as readonly LBProduct[],

  // -- Surface 2: in-stock variant product detail -----------------------------

  /** The detail target (`activeProduct`) — the in-stock variant product. */
  get activeProduct(): LBProduct {
    return ProductSheetsSeeds.products[0]!;
  },

  /**
   * The in-stock product detail: has `specOptions` → variant groups, `soldOut == 0`,
   * `stock == 9`. Drives the product-detail sheet (variant / qty / 加購 / 收藏鈕).
   *
   * ── ★ WHY `photos` IS `[]` AND MUST STAY `[]` (a DOCUMENTED blind spot) ──
   *
   * Every seed here — this detail, each `VARIANT_SPECS` entry, and
   * {@link variantSpecPriced} — carries `photos: []` DELIBERATELY, NOT by omission.
   *
   * `ProductDetail`'s `live` prop defaults to `false` and every snapshot test runs on
   * that default; `RemoteImage` returns null outright when `live === false`, so the
   * structural tree contains ZERO `Image` nodes. That is precisely why the flag exists:
   * it keeps network I/O and load timing out of the baselines.
   *
   * So SNAPSHOTS CANNOT SEE THE MAIN PHOTO AT ALL, and filling these arrays with fake
   * CDN URLs would buy no coverage whatsoever — while making the fixture LOOK like it
   * covers "the main photo follows the selected spec". That false coverage signal is the
   * very thing this fixture set was fixed to eliminate (in the price dimension); we do
   * not re-stage it in the photo dimension. The blind spot is documented here instead of
   * disguised.
   *
   * The real coverage for the photo rule lives in `__tests__/resolvedProductPhoto.test.ts`
   * (pure-function unit tests) plus the `live === true` component tests in
   * `__tests__/ProductDetail.test.tsx` — which is the correct level: resolution is a pure
   * function and drawing is a single `live` condition. Do NOT flip `live` to `true` in a
   * snapshot test to chase this; that would make the baselines non-deterministic.
   */
  detail: {
    productId: VARIANT_PRODUCT_ID,
    name: '絲絨霧面唇釉 #04 焦糖',
    priceShow: 'NT$380',
    originalPriceShow: 'NT$480',
    price: '380',
    stock: 9,
    soldOut: 0,
    photos: [],
    specifications: VARIANT_SPECS,
    specOptions: VARIANT_SPEC_OPTIONS,
    // 「更多商品」推薦清單 — empty by DEFAULT (expose-other-goods-recommendations-template):
    // this seed mirrors an `otherGoods`-less session (the common turnkey RN case today, see
    // `recommendationBreadcrumb.ts`'s file header). {@link recommendations} below is the
    // POPULATED sibling used by the recommendations-section tests.
    recommendations: [],
  } as LBProductDetailState,

  /**
   * Demo variant-picker snapshot. One「色號」group with three options; the middle
   * option (`#04 焦糖`, optionIndex 1) is selected (`selection[0] === 1`); the
   * resolved spec is the matching `#04 焦糖` spec.
   */
  variant: {
    groups: [{ label: '色號', options: ['#02 裸粉', '#04 焦糖', '#07 楓糖'] }],
    selection: [1],
    selectedSpec: VARIANT_SPECS[1],
    selectedSpecificationId: 'spec-04',
  } as LBVariantState,

  /**
   * Demo variant-picker snapshot whose SELECTED SPEC IS PRICED DIFFERENTLY FROM THE
   * PRODUCT — structurally identical to {@link variant} (same 「色號」 group, same
   * selected option `#04 焦糖` / `selection: [1]`, same `selectedSpecificationId`, same
   * in-stock, same non-null `selectedSpec`); the ONLY difference is the spec's price
   * pair (see {@link SPEC_PRICED_SPEC} for the full rationale and how the values were
   * picked):
   *
   *     spec    'NT$290' / 'NT$390'      ← this fixture
   *     detail  'NT$380' / 'NT$480'      ← ProductSheetsSeeds.detail (UNCHANGED)
   *
   * Exists so the sheet snapshots can DISCRIMINATE "the spec price replaces the product
   * price" — which {@link variant} structurally cannot, its spec sale price being
   * literally equal to the product's. Any fallback regression is now immediately visible:
   * dropping to the product level draws 'NT$380', and splitting the same-source pair into
   * two independent fallbacks draws 'NT$290' against a borrowed 'NT$480' (a fake 40% off).
   *
   * Used ONLY by the two `-spec-price` snapshot tests in `__tests__/ProductDetail.test.tsx`.
   * {@link variant} keeps driving the other 6 baselines — it is the one guarding D3-b
   * (spec with a sale price but NO original → no strike-through, no borrowing), so it
   * MUST NOT be re-pointed at this fixture.
   */
  variantSpecPriced: {
    groups: [{ label: '色號', options: ['#02 裸粉', '#04 焦糖', '#07 楓糖'] }],
    selection: [1],
    selectedSpec: SPEC_PRICED_SPEC,
    selectedSpecificationId: 'spec-04',
  } as LBVariantState,

  /** Demo qty state for the in-stock detail: `{ qty: 1, min: 1, max: 9 }`. */
  qty: { qty: 1, min: 1, max: 9 } as LBQtyState,

  // -- Surface 3: in-stock mini-cart peek -------------------------------------

  /** The in-stock mini-cart peek: a just-added in-stock product (`soldOut == 0`). */
  miniCart: {
    productId: VARIANT_PRODUCT_ID,
    name: '絲絨霧面唇釉 #04 焦糖',
    priceShow: 'NT$380',
    soldOut: 0,
    pic: '',
  } as LBMiniCartPeek,

  // -- Surface 4: sold-out detail for the restock-notify sheet ----------------

  /**
   * The SOLD-OUT product detail: `soldOut == 1`, `stock == 0`, no specs. Its
   * `goodsGpn` (resolved from {@link products} by `productId`) reads
   * `restockSubscribed === false` (not subscribed).
   */
  restockDetail: {
    productId: SOLD_OUT_PRODUCT_ID,
    name: 'Aurora 腮紅 #02 蜜桃',
    priceShow: 'NT$320',
    originalPriceShow: 'NT$420',
    price: '320',
    stock: 0,
    soldOut: 1,
    photos: [],
    specifications: [],
    specOptions: [],
    recommendations: [],
  } as LBProductDetailState,

  // -- 「更多商品」推薦格 demo fixtures (rb-rn-product-detail-recommendations, design R21) -----
  //
  // `LBProductRecommendation` is deliberately thin ({@link
  // ../../react-native-ui/src/ProductSheet.ts | productId/name/priceShow/pic/videoId?/soldOut}) —
  // see `expose-other-goods-recommendations-template` design.md D2. Six entries so the
  // `.prefix(4)` cap AND the odd-tail-row spacer are both exercised by trimming this array; the
  // FIRST FOUR (what `.slice(0, 4)` actually shows) intentionally mix sold-out (2nd) / no-`videoId`
  // (3rd) so both「售完 → cart circle hidden」and「no videoId → play button hidden」are covered
  // without needing a 5th/6th-item test.

  /** Six-entry recommendation pool — `.slice(0, 4)` (see {@link ProductDetailProps.recommendations
   * consumers}) exercises the design R21 4-card cap; the full six exercises the裁切 boundary. */
  recommendations: [
    { productId: 'demo-rec-serum', name: '亮顏精華露 30ml', priceShow: 'NT$690', pic: '', videoId: 'demo-video-serum', soldOut: 0, originalPriceShow: '' },
    { productId: 'demo-rec-blush', name: 'Aurora 腮紅 #02 蜜桃', priceShow: 'NT$320', pic: '', videoId: 'demo-video-blush', soldOut: 1, originalPriceShow: '' },
    { productId: 'demo-rec-cream', name: '晚安修護霜 50ml', priceShow: 'NT$980', pic: '', videoId: undefined, soldOut: 0, originalPriceShow: '' },
    { productId: 'demo-rec-mist', name: '玫瑰保濕噴霧', priceShow: 'NT$450', pic: '', videoId: 'demo-video-mist', soldOut: 0, originalPriceShow: '' },
    { productId: 'demo-rec-brush', name: '腮紅刷組', priceShow: 'NT$280', pic: '', videoId: 'demo-video-brush', soldOut: 0, originalPriceShow: '' },
    { productId: 'demo-rec-tone', name: '柔膚水 200ml', priceShow: 'NT$390', pic: '', videoId: 'demo-video-tone', soldOut: 0, originalPriceShow: '' },
  ] as readonly LBProductRecommendation[],

  /** {@link detail} with the six-entry {@link recommendations} pool attached — the
   *  recommendations-section tests render this instead of the empty-by-default {@link detail}. */
  get detailWithRecommendations(): LBProductDetailState {
    return { ...ProductSheetsSeeds.detail, recommendations: ProductSheetsSeeds.recommendations };
  },
} as const;
