// ProductListView — family-3 product sheet-stack surface 1 (product list drawer).
//
// Spec: `reference-ui-rendering/spec.md` (family-3 product + sheets, surface 1).
// Phase-4 RN sibling of the DONE iOS `ProductListView.swift` (rb-ios-product-sheets
// D-2 #1), Android `ProductListSheet.kt` (rb-android-product-sheets, golden
// `product-list-drawer-populated`), and Flutter `product_list_sheet.dart`
// (rb-flutter-product-sheets — the authoritative blueprint translated here 1:1).
//   Design source: `design/templates/minimal/screens.jsx` `ProductListSheet`
//     (lines 505-595) + `design/templates/minimal/sdk-components.jsx`
//     `LBPBottomSheet` (751) / `LBPSheetHeader` (787) / `LBPProductRow`
//     `layout:'row'` (816-912) / `LBPCartCTA` (993-1006).
//
// The bag-opened product LIST drawer: a top-rounded bottom-sheet shell (grab handle
// + centered 「銷售商品」header + decorative close) listing the core-fed products in
// a plain column (縮圖 placeholder + name + sale/strike price, or 已售完 line when
// sold out), plus a bottom-pinned cart CTA showing the cart count when `> 0`.
//
// SUB-VIEW INPUT PATTERN (mirrors family-1 `OperationRailView` / family-2
// `ChatFeedView` and the iOS / Android / Flutter surfaces EXACTLY — see the contract
// in `ProductSheetsView`):
//   1. `theme` (ReferenceUITheme)            — FIRST argument, always.
//   2. bound SNAPSHOT VALUES, BY VALUE       — `products: readonly LBProduct[]` (the
//      core-fed, already-merged / ordered list — this layer MUST NOT slice / merge /
//      re-sort) + `cartCount: number` (per-session successful-add count for the CTA
//      badge). Read-only; never the model / template.
//   3. action callbacks (LAST, each defaulting to a no-op):
//      • `onOpenProduct: (LBProduct) => void` — a product-row tap funnels HERE, NOT to
//        a template intent. THIS VIEW never opens the detail itself (D-2 — mirrors
//        family-2 ChatFeedView's eventJoin forwarder); it only forwards. The turnkey
//        container's `config.onOpenProduct` seam supplies the working default
//        (`defaultOpenProduct`: core `productOverlay.simulateProductTap` for telemetry +
//        `attachment.handleProductTap(product, 0)` to open the detail —
//        rb-rn-product-tap-wire); a host may override that seam and take over entirely.
//      • `onOpenCart: () => void` — the bottom-pinned cart CTA tap forwards to
//        `model.openCart()` → `DefaultCartCTA.openCart()` (host passthrough; the
//        template owns no checkout page).
//      • `onSeekToIntro: (LBProduct) => void` — a row THUMBNAIL tap forwards this AND
//        (rb-rn-product-bag-seek-dismiss, parity iOS/Android) triggers `onClose` — the
//        SAME existing drawer-close path the header close button / scrim tap already use.
//        Scoped to the thumbnail entry point ONLY; the row's other actions are untouched.
//
// One-way data flow (D-1): this surface reads ONLY its passed-in values; it never
// reaches back into `ProductSheetsModel` / `DefaultPlayerTemplate`, and it does NOT
// call any core `simulate*` / `addToCart`. It renders correctly with all callbacks
// omitted (so demo / preview / snapshot instances construct action-free).
//
// FAMILY BOUNDARY: the RECONCILED 收藏鈕 (favorite affordance) lives ONLY in the
// product-DETAIL sheet (`ProductDetailView`), NOT here. This list surface MUST NOT
// render a favorite control and MUST NOT read goods-tracking state.
//
// RENDER DISCIPLINE (inherited from iOS / Android / Flutter): plain `View` / `Text` /
// `Pressable` for the rows — NO FlatList / SectionList / VirtualizedList (lazy content
// renders BLANK, the「snapshot 綠 ≠ 畫對」trap). The product ROWS are still drawn as a
// plain (eagerly-materialized) column; that column is now placed INSIDE the shared
// `SheetScaffold`'s `<ScrollView>` body (rb-rn-sheet-pinned-header-footer) so a long
// list scrolls under the pinned header / cart CTA instead of overflowing the sheet — the
// documented overflow follow-up, fixed here. live === false (default) → the 縮圖 is a
// deterministic placeholder fill (no network-uri Image; live === true loads the real
// photo over it); icons are deterministic Text glyphs. Deterministic (no animation /
// randomness).

import type { ReactElement } from 'react';
import { useState } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { Text } from '../TightText';

import { ShareGlyph } from '../playershell/ShareGlyph';
import { DetailGlyph } from '../playershell/DetailGlyph';
import { CartGlyph } from './CartGlyph';
import { BellGlyph } from './BellGlyph';
import { EqualizerGlyph } from './EqualizerGlyph';
import { CartFillGlyph } from './CartFillGlyph';
import { HotGlyph } from './HotGlyph';
import {
  productRowOverlay,
  productRowNumberBadge,
  ProductBagNarratingBadge,
  isReplayNeverIntroduced,
  type ProductRowMode,
} from './ProductRowOverlay';
import { ProductStatusBadge } from './ProductStatusBadge';
import { RemoteImage } from './RemoteImage';
import { SheetHeaderCloseButton } from './SheetHeaderCloseButton';
import { SheetScaffold } from './SheetScaffold';
import {
  LBTestIDs,
  productRowThumb,
  productRowDetail,
  productRowShare,
  productRowCart,
  productRecommendationCard,
  productRecommendationPlay,
  productRecommendationCart,
} from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';
import type { LBProduct } from 'livebuy-react-native';

// MARK: - Decorative design tokens (literal minimal hex)
//
// `theme.accent` / `theme.text` / `theme.background` come from the resolved theme.
// These are FIXED decorative colors lifted verbatim from the design's
// `theme.surface.*` / `theme.sale` / `theme.soldOut` (light mode,
// `design/brands/livebuy/tokens.jsx`) — design-literal, NOT theme-resolved. Kept
// consistent with iOS `ProductListView` / Android `ProductListSheet` / Flutter
// `product_list_sheet.dart` so the family-3 sheets read as one family.

/** `theme.surface.textDim` (secondary / caption / strike text). */
const TEXT_DIM = '#6B6775';
/** `theme.surface.stroke` (hairline row / footer border). */
const STROKE = '#ECEAF0';
/** `theme.surface.strokeStrong` (grab handle). */
const STROKE_STRONG = '#D8D5DE';
/** `theme.surface.bgSunken` (thumbnail placeholder fill — light mode). */
const BG_SUNKEN = '#F4F4F6';
/** `theme.sale` (sale price red — `design/brands/livebuy/tokens.jsx`). */
const SALE_COLOR = '#E0334B';
/** `theme.soldOut` (sold-out grey label — `design/brands/livebuy/tokens.jsx`). */
const SOLD_OUT_COLOR = '#9A96A3';
/** out_soon「即將售完」徽章色（暖橘；最終配色 DECISION-PENDING 待設計稿）。 */
const OUT_SOON_COLOR = '#F5A623';
/** `row` 態縮圖底部「看講解」文字膠囊背景（design R21，近似 `rgba(255,255,255,0.75)` +
 *  `backdropFilter: blur(4px)` 的視覺意圖；RN 無原生 backdrop-blur 對應，取半透明白底本身，
 *  rb-rn-product-row-play-hint-pill）。 */
const PLAY_HINT_BG = 'rgba(255,255,255,0.75)';
/** `row` 態「看講解」膠囊內容色（play icon + 文字皆為 `#111`，design R21）。 */
const PLAY_HINT_TEXT = '#111';
/** 「介紹中」橫幅底色 — fixed coral `rgba(240,50,70,0.7)`（rb-rn-vod-live-product-card-restyle,
 *  design re-sync R31：不再是 `theme.accent`，不隨商家主題色變動；同一色值也用於
 *  `LiveOverlayChromeView.pinnedCard` 的「介紹中」底部橫幅，統一兩處視覺語彙）。 */
const NARRATE_BANNER_COLOR = 'rgba(240,50,70,0.7)';
/** Shared empty-set default for {@link ProductListProps.introducingProductIds} (avoids allocating
 *  a fresh `Set` per render when the prop is omitted — VOD / demo / no callers passing it yet). */
const NO_INTRODUCING_IDS: ReadonlySet<string> = new Set();
/** Shared empty-array default for {@link ProductListProps.productsBackendOrder}
 *  (rb-rn-product-row-number-badge). Omitted → `productRowNumberBadge`'s `findIndex` always
 *  misses → `null` → no badge renders, existing call sites/snapshots byte-identical. */
const NO_BACKEND_ORDER: readonly LBProduct[] = [];

// MARK: - Static copy (LBPSheetHeader / LBPProductRow / LBPCartCTA labels)

/** Sheet header title (design `ProductListSheet` 「銷售商品 (n)」). */
const TITLE_LABEL = '銷售商品';
/** Bottom cart CTA label. */
const CART_LABEL = '查看購物車';
/** Sold-out price-line label. */
const SOLD_OUT_LABEL = '已售完';
/** Empty-state line (no products). */
const EMPTY_LABEL = '目前沒有商品';
/** Now-introducing banner label (LIVE narrate_status==2 row). */
const INTRODUCING_LABEL = '介紹中';
/** out_soon / hot 小徽章文案（goods-status-label-render ③，僅明確 label 觸發）。 */
const OUT_SOON_LABEL = '即將售完';
const HOT_LABEL = '熱賣中';
/** Search field placeholder / cancel (rb-rn-product-list-search，問題 2). */
const SEARCH_PLACEHOLDER = '搜尋商品名稱';
const SEARCH_CANCEL = '取消';
/** No-search-hit empty line for `query`. */
const noResultsLabel = (query: string): string => `找不到符合「${query}」的商品`;

/** Props for the {@link ProductList} surface. */
export interface ProductListProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * The core-fed products snapshot (`productOverlayState.products`), BY VALUE.
   * Already merged / ordered by the data layer — this layer MUST NOT slice / merge /
   * re-sort. Read-only.
   */
  readonly products: readonly LBProduct[];
  /**
   * Per-session successful-add count (`cartCTAState.count`) — the cart CTA shows the
   * count badge when `> 0`. Read-only.
   */
  readonly cartCount: number;
  /**
   * rb-rn-product-real-images (parity iOS `live`): `false` (snapshot / demo — the
   * DEFAULT) → row 縮圖 draws the placeholder only (baselines unchanged); `true` (host
   * runtime) → the real `product.photos[0]` loads over the placeholder (fall back on
   * error). Read-only.
   */
  readonly live?: boolean;
  /**
   * The id SET of ALL products currently being introduced LIVE (`narrate_status == 2`) —
   * `ProductSheetsModel.liveActiveProducts` mapped to ids (rn-product-bag-multi-narrating). The
   * backend MAY narrate MULTIPLE products simultaneously; EVERY row whose `id` is a member draws
   * the「介紹中」bottom banner on its 64px thumbnail (never just the first) — in LIVE the play
   * affordance is hidden on every row (live has no timeline to scrub). The data layer surfaces
   * this list introducing-FIRST (`productsIntroducingFirst`, the core/host「first」convention) —
   * this layer MUST NOT re-sort. Empty set (default; VOD / demo / nothing introducing) → no
   * banner on any row, play shown. Membership test extracted as the pure
   * `ProductBagNarratingBadge.isNarrating`. Parity iOS / Android `introducingProductIds`.
   */
  readonly introducingProductIds?: ReadonlySet<string>;
  /**
   * The core-fed products snapshot in RAW BACKEND ORDER (`ProductSheetsModel
   * .productsBackendOrder` ← `productOverlayState.products`) — NOT the introducing-first
   * DISPLAY order {@link ProductListProps.products} carries. Backs the product-row NUMBER
   * BADGE (rb-rn-product-row-number-badge, design R35): each row's badge number is its
   * 1-based position in THIS list, via the pure `productRowNumberBadge(mode, product.id,
   * productsBackendOrder)`. Omitted (default empty array) → every row's `findIndex` misses →
   * no badge renders (existing call sites stay byte-identical). Read-only.
   */
  readonly productsBackendOrder?: readonly LBProduct[];
  /**
   * 縮圖疊層的播放模式（product-row-status-overlay）：`'vod'` → 播放 icon；`'live'` → 介紹中
   * 落在 narrating row；`'replay'` → 介紹中 落在 `playbackPosition ∈ [beginTime, endTime]` 的商品，
   * 否則播放 icon。`null` / 省略（既有呼叫點 / snapshot）→ 回退由真實影格 `live` 派生
   * （`live ? 'live' : 'vod'`）保 baseline byte-identical；production 容器由 `model.rowMode` 供應。
   * 與 `live`（圖片載入）正交。
   */
  readonly mode?: ProductRowMode | null;
  /**
   * 當下播放秒數（replay 用）——對照每個商品的 `[beginTime, endTime]` 判「介紹中」。Default 0。
   */
  readonly playbackPosition?: number;
  /**
   * Product-row tap → opens the FULL browse detail sheet (`presentation='detail'`).
   * Funneled by the 縮圖 / 名 / 明細鈕 (≣). This view only FORWARDS; the turnkey
   * container's `config.onOpenProduct` seam owns the behaviour — its built-in default
   * (`defaultOpenProduct`, rb-rn-product-tap-wire) fires core
   * `productOverlay.simulateProductTap(product)` for telemetry AND
   * `attachment.handleProductTap(product, 0)` to open the detail; a host `config`
   * override replaces both. Default no-op here so demo / snapshot instances render
   * correctly action-free (D-2).
   */
  readonly onOpenProduct?: (product: LBProduct) => void;
  /**
   * Host-wired QUICK-ADD tap (the row 加購鈕, `CartGlyph`) → opens the COMPACT add-to-cart
   * sheet (`presentation='addToCart'`, rb-rn-add-to-cart-route — parity iOS). Same core
   * product-tap exit as {@link onOpenProduct}; the container records the addToCart mode
   * BEFORE forwarding. A SOLD-OUT row's 補貨 bell (`BellGlyph`) routes to {@link onOpenProduct}
   * instead (the container opens the restock sheet by `soldOut === 1`). Default no-op.
   */
  readonly onQuickAdd?: (product: LBProduct) => void;
  /**
   * Host-wired 縮圖點擊 → 影片跳轉到該商品介紹時間（`LBProduct.beginTime`）。對齊設計
   * `LBPProductRow` 縮圖 `onSeek`（issue 5）。容器轉發到 host-wired `onSeekToProductIntro`，
   * 預設呼 core `seek(beginTime)`。Default no-op for demo / snapshot instances.
   *
   * rb-rn-product-bag-seek-dismiss (parity iOS/Android): the seek forward is ALWAYS accompanied
   * by triggering the existing drawer-close path {@link ProductListProps.onClose} (this component
   * wraps the forwarder fed to the row) — a thumbnail tap both seeks AND dismisses the drawer.
   * Scoped to THIS ONE entry point; the row's other actions (明細鈕 / 加購鈕 / 補貨鈴鐺 / 分享鈕)
   * are untouched and MUST NOT gain this side effect.
   */
  readonly onSeekToIntro?: (product: LBProduct) => void;
  /**
   * Host-wired 列分享鈕點擊 → 系統分享，連結帶該商品介紹時間 `?t=beginTime`。對齊設計
   * `LBPProductRow` 的 `onShare`（精簡圓形 icon，與明細 footer 直式分享為不同元件，issue 6）。
   * Default no-op for demo / snapshot instances.
   */
  readonly onShareProduct?: (product: LBProduct) => void;
  /**
   * Host-wired cart-CTA tap → `model.openCart()` (host passthrough). Default no-op
   * for demo / snapshot instances.
   */
  readonly onOpenCart?: () => void;

  /**
   * 售完列補貨鈴鐺專屬入口 → restock-notify sheet (rb-rn-soldout-row-detail-vs-restock，問題 2).
   * Omitted → falls back to {@link ProductListProps.onOpenProduct}. 名稱 / 明細 keep onOpenProduct.
   */
  readonly onNotifyRestock?: (product: LBProduct) => void;

  /**
   * Header 右上角關閉 icon tap (rb-rn-sheet-header-close-unify): no longer decorative — forwarded
   * to the host (RN's ProductList drawer is host-presented; closing is a host concern, like
   * Android/Flutter). Omitted → inert (demo / snapshot).
   */
  readonly onClose?: () => void;

  /**
   * 搜尋兩態 seed（rb-rn-product-list-search，問題 2）：預設收合 / 空 → 既有 snapshot 不變；
   * snapshot 測試可 seed 展開態（命中 / 無結果）。
   */
  readonly searchOpenInitial?: boolean;
  readonly queryInitial?: string;

  /**
   * The drawer's cap height, a fraction of screen height, forwarded VERBATIM to
   * `SheetScaffold`'s `capPct` (rb-rn-sheetkit-resize-dismiss-unify — fed by the container's
   * local drag gesture wiring, `useSheetDragGesture`). `undefined` (demo / snapshot, or ANY
   * presentation the user has not yet dragged the handle on — the floor measurement alone
   * never reports) → `SheetScaffold` falls back to its own content-sized 0.5 default,
   * unchanged from before this prop existed, and keeps tracking actual content changes
   * (search filtering, …).
   */
  readonly heightPct?: number;
}

/**
 * The family-3 product LIST drawer. Renders the core-fed {@link ProductListProps.products}
 * as a plain non-scrolling column of product rows (縮圖 placeholder + name +
 * sale/strike price, or 已售完 when sold out) inside a top-rounded bottom-sheet shell
 * with the 「商品清單」header, plus a bottom-pinned cart CTA badged with `cartCount`.
 * A row tap forwards to `onOpenProduct` (→ container seam / host override); the CTA
 * forwards to `onOpenCart`. This layer NEVER opens the detail itself and NEVER renders
 * the 收藏鈕 (that is the detail sheet's affordance).
 *
 * Renders correctly with both callbacks omitted (demo / snapshot safe).
 */
export function ProductList(props: ProductListProps): ReactElement {
  const {
    theme,
    products,
    cartCount,
    live = false,
    introducingProductIds = NO_INTRODUCING_IDS,
    productsBackendOrder = NO_BACKEND_ORDER,
    mode = null,
    playbackPosition = 0,
    onOpenProduct,
    onQuickAdd,
    onSeekToIntro,
    onShareProduct,
    onOpenCart,
    onClose,
    onNotifyRestock,
    searchOpenInitial = false,
    queryInitial = '',
    heightPct,
  } = props;

  // 縮圖 seek 連動關閉抽屜（rb-rn-product-bag-seek-dismiss，parity iOS rb-ios-product-bag-seek-dismiss
  // / Android rb-android-product-bag-seek-dismiss）：先觸發抽屜既有的關閉路徑 `onClose`（與 header
  // 關閉鈕 / scrim tap 完全相同的 callback，容器 `ProductSheetsView` 轉發同一個 `onDismissList`），
  // 再轉發 seek，讓使用者立即看見影片跳轉後的畫面。呼叫順序比照 Android
  // `{ product -> onClose(); onSeekToIntro(product) }` 既有判例。僅包裝餵給 `ProductRow` 的
  // `onSeekToIntro` 這一個具名參數——`onOpenProduct` / `onQuickAdd` / `onNotifyRestock` /
  // `onShareProduct` 各自是獨立參數，未被觸碰，MUST NOT 連動關閉。`onClose` 本來就是 optional
  // no-op，未接線時安全（demo / 未接線 fixture）。
  //
  // EXCEPTION（rb-rn-replay-never-introduced-tap-noop，parity iOS
  // rb-ios-replay-never-introduced-tap-noop）：`'replay'` 模式下，若該商品的
  // `[beginTime, endTime]` 為 `[0, 0]`「從未介紹過」sentinel
  // （`ProductRowOverlay.isReplayNeverIntroduced`，rb-rn-replay-never-introduced-no-ui 既有），
  // 代表沒有真實的介紹時間可跳轉——完全 no-op：不轉發 `onSeekToIntro`、不觸發 `onClose`，避免誤導
  // 使用者「跳到影片開頭」。此例外僅限 `'replay'`；`'vod'` 模式即使商品剛好
  // `beginTime === 0 && endTime === 0` 也不受影響（那是合法真實資料，sentinel 語意僅在回放情境
  // 成立）。`effectiveMode` 公式與下方逐列渲染迴圈內的既有公式同構。
  const handleSeekAndDismiss = (product: LBProduct): void => {
    const effectiveMode: ProductRowMode = mode ?? (live ? 'live' : 'vod');
    if (effectiveMode === 'replay' && isReplayNeverIntroduced(product.beginTime, product.endTime)) {
      return;
    }
    onClose?.();
    onSeekToIntro?.(product);
  };

  // 本地搜尋 UI 狀態——使用者驅動的呈現過濾，非 view-model（parity iOS/Android/Flutter）。
  const [searchOpen, setSearchOpen] = useState(searchOpenInitial);
  const [query, setQuery] = useState(queryInitial);
  // 顯示過濾：case-insensitive `name` contains。純呈現過濾、不 mutate products snapshot。
  const q = query.trim().toLowerCase();
  const displayed =
    q.length === 0
      ? products
      : products.filter((p) => p.name.toLowerCase().includes(q));

  const headerTitle =
    products.length > 0 ? `${TITLE_LABEL} (${products.length})` : TITLE_LABEL;

  // Top-rounded bottom-sheet shell via the shared SheetScaffold (pinned grab handle +
  // header / scrollable product column / pinned cart CTA + ½-screen cap,
  // rb-rn-sheet-pinned-header-footer). The product column is now a SCROLLABLE body
  // (the previous plain non-scrolling column overflowed for a long list — this is the
  // documented follow-up's fix; the rows themselves are still plainly drawn inside the
  // scaffold ScrollView, not a lazy FlatList).
  const header = (
    <View>
      <GrabHandle />
      {/* 收合：🔍 鈕可點展開 · 標題 · 關閉；展開：搜尋膠囊 + 取消（parity iOS/Android/Flutter）。 */}
      {searchOpen ? (
        <SearchHeader
          theme={theme}
          query={query}
          onChangeQuery={setQuery}
          onCancel={() => {
            setSearchOpen(false);
            setQuery('');
          }}
        />
      ) : (
        <SheetHeader
          theme={theme}
          title={headerTitle}
          onClose={onClose}
          onSearch={() => setSearchOpen(true)}
        />
      )}
    </View>
  );

  const body =
    displayed.length === 0 ? (
      // 區分「本來就沒商品」與「搜尋無命中」（parity iOS/Android/Flutter）。
      <EmptyState
        theme={theme}
        message={products.length === 0 ? EMPTY_LABEL : noResultsLabel(query)}
      />
    ) : (
      // Plain column — each row carries its own bottom hairline.
      <View>
        {/* 縮圖 seek 連動關閉抽屜（rb-rn-product-bag-seek-dismiss，parity iOS
            rb-ios-product-bag-seek-dismiss / Android rb-android-product-bag-seek-dismiss）：wrap
            the forwarder fed to `ProductRow` so the SAME 既有關閉路徑 `onClose`（header 關閉鈕 /
            scrim tap 共用）fires alongside the seek forward — no second sheet-state field, no
            second close path. Scoped to THIS ONE entry point (縮圖 tap only); the row's other
            actions（明細鈕 / 加購鈕 / 補貨鈴鐺 / 分享鈕）forward their own callbacks unchanged and
            MUST NOT gain this side effect. */}
        {displayed.map((product, index) => {
          // 縮圖疊層由播放 MODE 決定（product-row-status-overlay），透過純函式。`mode` 為 null
          // （既有呼叫點 / snapshot）→ 由真實影格 `live` 派生（live → 'live' else 'vod'）保 baseline
          // byte-identical。showPlay / showIntroducing 在單一 row 互斥。
          const effectiveMode: ProductRowMode = mode ?? (live ? 'live' : 'vod');
          const isNarratingThis = ProductBagNarratingBadge.isNarrating(
            product.id,
            introducingProductIds,
          );
          const overlay = productRowOverlay(
            effectiveMode,
            isNarratingThis,
            product.beginTime,
            product.endTime,
            playbackPosition,
          );
          // 縮圖左上角編號徽章（rb-rn-product-row-number-badge, design R35）：由純函式
          // productRowNumberBadge 算出，來源是 BACKEND ORDER（`productsBackendOrder`，原始未依
          // 「介紹中」重排的順序），不是這個迴圈本身在跑的 `displayed`（介紹中優先 + 搜尋過濾後的
          // 顯示順序）——避免編號隨介紹中商品變動而跳動。VOD 恆 null；找不到該 id 亦回 null。
          const numberBadge = productRowNumberBadge(
            effectiveMode,
            product.id,
            productsBackendOrder,
          );
          return (
            <ProductRowView
              key={product.id}
              layout="row"
              index={index}
              theme={theme}
              product={product}
              live={live}
              mode={effectiveMode}
              showPlay={overlay.showPlay}
              isIntroducing={overlay.showIntroducing}
              showShare={overlay.showShare}
              numberBadge={numberBadge}
              onOpenProduct={onOpenProduct}
              onQuickAdd={onQuickAdd}
              onNotifyRestock={onNotifyRestock}
              onSeekToIntro={handleSeekAndDismiss}
              onShareProduct={onShareProduct}
            />
          );
        })}
      </View>
    );

  const footer = (
    <CartCTAFooter theme={theme} cartCount={cartCount} onOpenCart={onOpenCart} />
  );

  // `heightPct` 轉發給 `capPct`（rb-rn-sheetkit-resize-dismiss-unify）——省略時落回既有內容自適應 0.5。
  return (
    <SheetScaffold
      testID={LBTestIDs.productList}
      theme={theme}
      header={header}
      body={body}
      footer={footer}
      capPct={heightPct}
    />
  );
}

// MARK: - Grab handle (`LBPBottomSheet` handle — shared styling w/ WinClaimSheet)

/** A 36×4 fully-rounded grab handle, centered (`theme.surface.strokeStrong` fill). */
function GrabHandle(): ReactElement {
  return (
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
  );
}

// MARK: - Sheet header (`LBPSheetHeader` — search slot · centered title · close)
//
// Mirrors `LBPSheetHeader`: a 32-wide leading slot (search affordance — purely
// decorative here, the list search field is out of scope for the reference-ui
// surface), a centered bold title, and a trailing decorative close circle. The title
// shows the count when there are products (matches `ProductListSheet`'s 「銷售商品
// (n)」), otherwise the plain「銷售商品」.

function SheetHeader(props: {
  theme: ReferenceUITheme;
  title: string;
  onClose?: () => void;
  onSearch?: () => void;
}): ReactElement {
  const { theme, title, onClose, onSearch } = props;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
      }}
    >
      {/* Leading 32-wide search button — taps expand the search field (rb-rn-product-list-search，
          問題 2). No longer decorative. */}
      <Pressable
        testID={LBTestIDs.productSearchButton}
        onPress={() => onSearch?.()}
        style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: theme.text, fontSize: 15 * theme.fontScale }}>🔍</Text>
      </Pressable>
      <View style={{ width: 8 }} />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          textAlign: 'center',
          color: theme.text,
          fontSize: 15 * theme.fontScale,
          fontWeight: 'bold',
        }}
      >
        {title}
      </Text>
      <View style={{ width: 8 }} />
      {/* Trailing close — shared transparent close button (rb-rn-sheet-header-close-unify).
          No longer decorative: tapping forwards `onClose` (host-wired drawer close). */}
      <SheetHeaderCloseButton theme={theme} onPress={onClose} />
    </View>
  );
}

// MARK: - Expanded search header (`LBPSheetHeader` 展開態, parity iOS/Android/Flutter)

/** bgSunken 膠囊（🔍 + TextInput「搜尋商品名稱」）+ 取消 accent 文字鈕。清除（x）鈕已移除——
 *  取消已同時收合搜尋列並清空 query，單獨的清除鈕是多餘的（rb-search-bar-cancel-only）。 */
function SearchHeader(props: {
  theme: ReferenceUITheme;
  query: string;
  onChangeQuery: (q: string) => void;
  onCancel: () => void;
}): ReactElement {
  const { theme, query, onChangeQuery, onCancel } = props;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 12,
      }}
    >
      <View
        style={{
          flex: 1,
          height: 36,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 18,
          backgroundColor: BG_SUNKEN,
          paddingHorizontal: 14,
        }}
      >
        <Text style={{ color: TEXT_DIM, fontSize: 14 * theme.fontScale }}>🔍</Text>
        <View style={{ width: 8 }} />
        <TextInput
          testID={LBTestIDs.sheetSearchField}
          value={query}
          onChangeText={onChangeQuery}
          placeholder={SEARCH_PLACEHOLDER}
          placeholderTextColor={TEXT_DIM}
          style={{ flex: 1, padding: 0, color: theme.text, fontSize: 14 * theme.fontScale }}
        />
        {/* Clear ("x") button removed — 取消 already collapses the search bar AND clears the
            query in one tap, making a separate clear affordance redundant
            (rb-search-bar-cancel-only). */}
      </View>
      <View style={{ width: 8 }} />
      <Pressable testID={LBTestIDs.sheetSearchCancel} onPress={onCancel}>
        <Text style={{ color: theme.accent, fontSize: 14 * theme.fontScale, fontWeight: '600' }}>
          {SEARCH_CANCEL}
        </Text>
      </Pressable>
    </View>
  );
}

// MARK: - Empty state (no products / no search results)

/** A centered empty-state line. `message` distinguishes 目前沒有商品 (empty) from 找不到… (no hit). */
function EmptyState(props: { theme: ReferenceUITheme; message?: string }): ReactElement {
  const { theme, message = EMPTY_LABEL } = props;
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <Text style={{ color: TEXT_DIM, fontSize: 13 * theme.fontScale }}>{message}</Text>
    </View>
  );
}

// MARK: - Status pill (out_soon / hot 小徽章 — goods-status-label-render ③)
//
// 最小中性 pill（鏡像 iOS `statusPill`）。最終樣式 DECISION-PENDING 待設計稿。
function StatusPill(props: {
  theme: ReferenceUITheme;
  text: string;
  color: string;
}): ReactElement {
  const { theme, text, color } = props;
  return (
    <View
      style={{
        marginLeft: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: color,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 10 * theme.fontScale, fontWeight: 'bold' }}>
        {text}
      </Text>
    </View>
  );
}

// MARK: - Product card (`LBPProductRow` — row / grid two states)
//
// Spec: `reference-ui-rendering/spec.md` §"react-native-reference-ui 商品卡元件（row / grid
//        兩態）供商品列表與商品明細更多商品推薦格共用" (rb-rn-product-detail-recommendations,
//        design R21, technical decisions per `rb-ios-product-detail-recommendations` /
//        `rb-android-product-detail-recommendations` — not re-decided here).
//
// Extracted from this file's former private `ProductRow` (rb-rn-product-detail-recommendations
// §1). `ProductList` above constructs THIS component for its EXISTING call site with
// `layout="row"` — behavior / pixels UNCHANGED (see the ROW DELIBERATE DEVIATION note below).
// The new `layout="grid"` state is used ONLY by the「更多商品」推薦格
// (`ProductDetailSheetView`'s recommendations section).
//
// `hideSub` (default `false`) hides the secondary text line under the name (row: struck-through
// original / 已售完 line is UNAFFECTED by this flag — only `grid`'s optional strike-through
// original reads it, see below); `onPlayClick` (default `undefined`) is an independent
// 播放/看講解 tap handler — `row`: `undefined` falls back to `onSeekToIntro` (design R21「未傳退回
// onSeek」), so `ProductList`'s existing call site (never passes this) is behavior-unchanged.
// `grid`: this ALSO gates whether the play button is shown at all — the caller (the
// recommendations renderer) MUST only pass a non-null lambda when the underlying
// `LBProductRecommendation.videoId` is non-null.
export type ProductRowLayout = 'row' | 'grid';

export interface ProductRowViewProps {
  index?: number;
  theme: ReferenceUITheme;
  product: LBProduct;
  layout?: ProductRowLayout;
  hideSub?: boolean;
  live?: boolean;
  // `row`-only (rb-rn-product-row-vod-intro-mask): the resolved playback mode
  // (`ProductListView`'s `effectiveMode`) — drives WHICH visual `showPlay` / `isIntroducing`
  // render as. `mode === 'vod'` → the NEW unified centered play button / full-bleed equalizer
  // mask (design R36); anything else (including omitted — direct `ProductRowView` callers that
  // predate this prop, e.g. this file's own structural tests) → the EXISTING bottom「看講解」
  // pill / 「介紹中」coral banner, byte-identical. Ignored by `grid` (no live-narrating concept).
  mode?: ProductRowMode | null;
  // `row`-only: 縮圖疊層的播放 affordance（product-row-status-overlay）：由純函式
  // productRowOverlay 算出，與「介紹中」(`isIntroducing`) 互斥。VOD → true；active-live →
  // false；replay → 不在介紹窗時 true。Ignored by `grid` (cross-video recommendation cards have
  // no live-narrating concept).
  showPlay?: boolean;
  isIntroducing?: boolean;
  // `row`-only: 縮圖左上角編號徽章（rb-rn-product-row-number-badge, design R35）：由純函式
  // productRowNumberBadge 算出（`null` → VOD 或找不到該 id，不畫）。`isIntroducing` 為真時內容換成
  // HotGlyph + "HOT"（與 `soldOut` 互不影響，rb-rn-product-row-soldout-introducing-visible），
  // 否則顯示這個數字。Ignored by `grid`（跨影片推薦卡沒有「介紹中 / 播放模式」的概念）。
  numberBadge?: number | null;
  // `row`-only: 列分享 icon 是否顯示（rb-rn-live-hide-product-share, design R12）：由
  // `productRowOverlay(...)` 的 `showShare`（`= mode !== 'live'`）算出。預設 `true`（既有內部呼叫
  // 相容）；進行中直播（`'live'`）時隱藏——沒有已定案的「開始銷售時間」，分享連結無法帶出正確時間點
  // 資訊。`grid` never shows a share icon.
  showShare?: boolean;
  onOpenProduct?: (product: LBProduct) => void;
  onQuickAdd?: (product: LBProduct) => void;
  // `row`-only: 售完列補貨鈴鐺鈕 tap. `grid` never shows this affordance (a sold-out
  // recommendation card simply hides the cart circle, design R21).
  onNotifyRestock?: (product: LBProduct) => void;
  // `row`-only (also the FALLBACK for `onPlayClick` when the latter is `undefined`).
  onSeekToIntro?: (product: LBProduct) => void;
  // `row`-only: 列分享鈕 tap. `grid` never shows a share icon.
  onShareProduct?: (product: LBProduct) => void;
  onPlayClick?: () => void;
}

/**
 * A single product card, in either the existing `layout="row"` (default) list-drawer row or the
 * new `layout="grid"` 更多商品推薦格 card (design R21). Renders correctly with every action prop
 * omitted (demo / snapshot safe).
 */
export function ProductRowView(props: ProductRowViewProps): ReactElement {
  const { layout = 'row', hideSub = false, onPlayClick, ...rest } = props;
  if (layout === 'grid') {
    return <GridLayoutBody hideSub={hideSub} onPlayClick={onPlayClick} {...rest} />;
  }
  return <RowLayoutBody hideSub={hideSub} onPlayClick={onPlayClick} {...rest} />;
}

// MARK: - `row` layout — extracted from the former private `ProductRow`; the play-hint visual
// below was updated by rb-rn-product-row-play-hint-pill (see the note at that Pressable).
//
// rb-rn-product-row-play-hint-pill: design R21's `row` play-hint visual (縮圖中央黑底圓點 →
// 縮圖底部「看講解」文字膠囊) is now APPLIED here — the user explicitly authorized regenerating
// the existing `__snapshots__` baselines (`ProductList.test.tsx.snap`, 4 entries total; the 2
// covering a `showPlay === true` row were regenerated, the other 2 — `product-list-live-
// introducing` and the empty-state golden — are byte-identical, no play affordance in either)
// that previously locked the black-circle pixels (CLAUDE.local.md「不要動的地方」normally bars
// this without confirmation; this change is the confirmed, deliberate baseline rewrite). TAP
// TARGET is unchanged: the thumbnail still forwards `onPlayClick` (falls back to
// `onSeekToIntro` when `undefined`).

// MARK: - VOD-only thumbnail overlays (rb-rn-product-row-vod-intro-mask, design R36)
//
// `row`-only (see `RowLayoutBody`'s `mode === 'vod'` branch above where these are used).
// Parity iOS `ProductRowView.vodPlayOverlay`/`vodIntroducingMask`, Android `VodPlayOverlay`/
// `VodIntroducingMask`. Neither reads `soldOut` itself — the CALLER gates `VodIntroducingMask`
// behind `isIntroducing` (`introducingForBadge`), unaffected by `soldOut`
// (rb-rn-product-row-soldout-introducing-visible, same rule source as the LIVE/REPLAY banner).

/** VOD `upcoming` phase: a centered black circular play button (`rgba(0,0,0,0.5)`, 32px),
 *  replacing the bottom「看講解」pill for `mode === 'vod'` rows only. Design
 *  `sdk-components.jsx:LBPProductRow`'s `playOverlay` (`vodPhase === 'upcoming'`). The `▶`
 *  glyph is a plain `Text` char scaled by `theme.fontScale` — same convention this file
 *  already uses for every other Text-rendered play glyph (`GridPlayButton`, the retired
 *  「看講解」pill's own `▶`), unlike the custom-drawn `EqualizerGlyph`/`HotGlyph` below which
 *  stay a literal unscaled `size`. */
function VodPlayOverlay(props: { theme: ReferenceUITheme }): ReactElement {
  const { theme } = props;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 15 * theme.fontScale, fontWeight: 'bold' }}>
          ▶
        </Text>
      </View>
    </View>
  );
}

/** VOD `now` phase: a full-bleed `rgba(0,0,0,0.5)` mask + centered white equalizer glyph, NO
 *  text — visually distinct from the LIVE/REPLAY bottom-anchored coral「介紹中」banner (same
 *  semantic — this product is currently being introduced — different presentation), replacing
 *  it for `mode === 'vod'` rows only. Reuses the existing `EqualizerGlyph` (same bars as the
 *  LIVE/REPLAY banner's, just larger: 18 here vs 9 there), matching design `introBadge`'s VOD
 *  branch. The 64×64 thumbnail `Pressable`'s `overflow: 'hidden'` clips this to the rounded
 *  corners exactly like the banner it replaces. */
function VodIntroducingMask(): ReactElement {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <EqualizerGlyph size={18} color="#FFFFFF" />
    </View>
  );
}

function RowLayoutBody(props: {
  index?: number;
  theme: ReferenceUITheme;
  product: LBProduct;
  hideSub: boolean;
  live?: boolean;
  mode?: ProductRowMode | null;
  showPlay?: boolean;
  isIntroducing?: boolean;
  numberBadge?: number | null;
  showShare?: boolean;
  onOpenProduct?: (product: LBProduct) => void;
  onQuickAdd?: (product: LBProduct) => void;
  onNotifyRestock?: (product: LBProduct) => void;
  onSeekToIntro?: (product: LBProduct) => void;
  onShareProduct?: (product: LBProduct) => void;
  onPlayClick?: () => void;
}): ReactElement {
  const {
    index,
    theme,
    product,
    hideSub,
    live = false,
    mode = null,
    showPlay = false,
    isIntroducing = false,
    numberBadge = null,
    showShare = true,
    onOpenProduct,
    onQuickAdd,
    onNotifyRestock,
    onSeekToIntro,
    onShareProduct,
    onPlayClick,
  } = props;
  // 狀態標籤改吃後端結論欄 `label`（goods-status-label-render ③，單一優先序）；label 空
  // （舊後端 / demo）經 raw fallback 仍正確 → baseline 不變。
  const soldOut = ProductStatusBadge.resolve(product) === ProductStatusBadge.SoldOut;
  // out_soon / hot 小徽章只認**明確** label（label 空不臆測 → demo / 舊後端中性）。
  const explicitBadge = ProductStatusBadge.fromLabel(product.label);
  // 縮圖左上角編號徽章的 HOT 內容切換（rb-rn-product-row-number-badge, design R35）：是否顯示介紹中
  // 效果單純由 `isIntroducing` 決定，與 `soldOut` 互不影響（rb-rn-product-row-soldout-introducing
  // -visible，2026-09-07 使用者拍板 D6 撤回舊有 `isIntroducing && !soldOut` sold_out > narrating
  // 優先序——交付設計稿 `sdk-components.jsx` 的 `introBadge`/`numberBadge` 從未有 `!p.sold` 排除，
  // 售完商品同樣正確顯示介紹中效果）。
  const introducingForBadge = isIntroducing;
  // 名 / 明細鈕 → open the FULL browse detail sheet.
  const open = (): void => onOpenProduct?.(product);
  // 加購鈕 → open the COMPACT add-to-cart sheet (in-stock). A SOLD-OUT row's 補貨 bell
  // routes to `onNotifyRestock` (→ container sets restock mode); null → falls back to `open`.
  const quickAdd = (): void =>
    soldOut ? (onNotifyRestock ?? onOpenProduct)?.(product) : onQuickAdd?.(product);
  // 縮圖點擊 → 影片跳轉到該商品介紹時間（beginTime），issue 5。
  const seek = (): void => onSeekToIntro?.(product);
  // design R21 task 1.3: `onPlayClick` non-null OVERRIDES the existing seek forward — undefined
  // (`ProductList`'s existing call site) falls back to `seek` exactly as before extraction.
  const playTap = onPlayClick ?? seek;
  // 列分享鈕 → 系統分享，連結帶該商品介紹時間 ?t=beginTime，issue 6。
  const share = (): void => onShareProduct?.(product);
  const photoUri = product.photos.length > 0 ? product.photos[0] : undefined;
  const showStrike =
    product.originalPriceShow.length > 0 &&
    product.originalPriceShow !== product.priceShow;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        {/* 縮圖 + play affordance (64×64 rounded-12, sunken placeholder fill). Real
            product image loads over the placeholder when live (snapshot-safe off).
            縮圖點擊 → 影片跳轉到該商品介紹時間（beginTime），對齊設計 LBPProductRow 縮圖 onSeek（issue 5）。 */}
        <Pressable
          testID={index != null ? productRowThumb(index) : undefined}
          accessibilityRole="button"
          onPress={playTap}
          style={{
            width: 64,
            height: 64,
            // rb-rn-product-detail-image-gallery (design R34): borderRadius 12 → 4
            // (`0.25rem`) + a hairline `#D2D2D2` border, same visual direction as R33's
            // carousel-card white-carding and the product-sheet gallery in this same change.
            borderRadius: 4,
            borderWidth: 1,
            borderColor: '#D2D2D2',
            backgroundColor: BG_SUNKEN,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* VOD (rb-rn-product-row-vod-intro-mask, design R36): a DIFFERENT, unified
              three-phase visual — centered play button / full-bleed equalizer mask / no
              overlay — replaces the「看講解」pill below and the「介紹中」banner further down
              for `mode === 'vod'` ONLY. `mode !== 'vod'` (`'live'` / `'replay'`, or omitted —
              direct `ProductRowView` callers that predate this prop) keeps those existing
              visuals byte-identical. */}
          {mode === 'vod' ? (
            <>
              {showPlay ? <VodPlayOverlay theme={theme} /> : null}
              {introducingForBadge ? <VodIntroducingMask /> : null}
            </>
          ) : (
            /* Play affordance — VOD / replay only (`showPlay = !live`). LIVE has no
               timeline to scrub, so it is hidden for live rows. Bottom-centered「看講解」text
               pill (design R21, rb-rn-product-row-play-hint-pill) — replaces the prior
               center black-circle icon; the thumbnail's rounded-12 `overflow: 'hidden'`
               clips it exactly like the "介紹中" banner below. */
            <>
              {showPlay ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 4,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderRadius: 999,
                      backgroundColor: PLAY_HINT_BG,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text
                      style={{
                        color: PLAY_HINT_TEXT,
                        fontSize: 9 * theme.fontScale,
                        fontWeight: 'bold',
                      }}
                    >
                      ▶
                    </Text>
                    <View style={{ width: 3 }} />
                    <Text
                      style={{
                        color: PLAY_HINT_TEXT,
                        fontSize: 9.5 * theme.fontScale,
                        fontWeight: '600',
                      }}
                    >
                      看講解
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          )}
          <RemoteImage live={live} uri={photoUri} borderRadius={12} />
          {/* 縮圖左上角編號徽章（rb-rn-product-row-number-badge, design R35）：黑底半透明白字，
              外側兩角圓角（對應設計 0.25rem 0 0.25rem 0）。`numberBadge == null`（VOD / 找不到該
              id）→ 不畫。介紹中時內容換成 HotGlyph + "HOT"，不論是否售完（sold_out 與 narrating
              互不影響，rb-rn-product-row-soldout-introducing-visible），否則顯示純數字。 */}
          {numberBadge != null ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                minWidth: 18,
                height: 18,
                paddingHorizontal: introducingForBadge ? 6 : 5,
                borderTopLeftRadius: 4,
                borderBottomRightRadius: 4,
                backgroundColor: 'rgba(0,0,0,0.7)',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {introducingForBadge ? (
                <>
                  <HotGlyph size={10} color="#FFFFFF" />
                  <View style={{ width: 3 }} />
                  <Text
                    style={{ color: '#FFFFFF', fontSize: 11 * theme.fontScale, fontWeight: 'bold' }}
                  >
                    HOT
                  </Text>
                </>
              ) : (
                <Text
                  style={{ color: '#FFFFFF', fontSize: 11 * theme.fontScale, fontWeight: 'bold' }}
                >
                  {String(numberBadge)}
                </Text>
              )}
            </View>
          ) : null}
          {/* 「介紹中」橫幅 — 貼齊縮圖底部、左右填滿（accent 底滿版 + 白色等化器 + 白字）。
              clipped to the thumbnail's rounded-12 by the Pressable's `overflow: 'hidden'`.
              與 sold_out 互不影響：售完商品同樣顯示此橫幅（rb-rn-product-row-soldout-introducing
              -visible，撤回舊有 sold_out > narrating 優先序）。`mode === 'vod'`：本橫幅由上方的
              `VodIntroducingMask`（無文字滿版遮罩）取代，此處 MUST NOT 重複渲染
              （rb-rn-product-row-vod-intro-mask）。 */}
          {mode !== 'vod' && introducingForBadge ? (
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
                // rb-rn-vod-live-product-card-restyle (design re-sync R31): fixed coral
                // NARRATE_BANNER_COLOR — no longer `theme.accent` (unifies with
                // `LiveOverlayChromeView.pinnedCard`'s「介紹中」banner, same visual
                // vocabulary / same literal color value, not merchant-theme-derived).
                backgroundColor: NARRATE_BANNER_COLOR,
                paddingVertical: 3,
                paddingHorizontal: 4,
              }}
            >
              <EqualizerGlyph size={9} color="#FFFFFF" />
              <View style={{ width: 3 }} />
              <Text
                numberOfLines={1}
                style={{ color: '#FFFFFF', fontSize: 12 * theme.fontScale, fontWeight: 'bold' }}
              >
                {INTRODUCING_LABEL}
              </Text>
            </View>
          ) : null}
        </Pressable>
        <View style={{ width: 12 }} />

        {/* Name + price column (tap → open detail via host/core). */}
        <Pressable
          testID={index != null ? productRowDetail(index) : undefined}
          onPress={open}
          style={{ flex: 1 }}
        >
          <Text
            numberOfLines={2}
            style={{
              color: theme.text,
              fontSize: 14 * theme.fontScale,
              fontWeight: '600',
            }}
          >
            {product.name}
          </Text>
          {/* hideSub (design R21 task 1.3, mirrors Android's ROW contract): hides this ENTIRE
              secondary line — soldOut label OR price+strike row — when set. `ProductList`'s
              existing call site never passes `hideSub`, so this stays byte-identical. */}
          {!hideSub ? (
            <>
              <View style={{ height: 4 }} />
              {soldOut ? (
                <Text style={{ color: SOLD_OUT_COLOR, fontSize: 12 * theme.fontScale }}>
                  {SOLD_OUT_LABEL}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  {showStrike ? (
                    <Text
                      style={{
                        color: TEXT_DIM,
                        fontSize: 12 * theme.fontScale,
                        textDecorationLine: 'line-through',
                        textDecorationColor: TEXT_DIM,
                        marginRight: 6,
                      }}
                    >
                      {product.originalPriceShow}
                    </Text>
                  ) : null}
                  <Text
                    style={{
                      color: SALE_COLOR,
                      fontSize: 14 * theme.fontScale,
                      fontWeight: '900',
                    }}
                  >
                    {product.priceShow}
                  </Text>
                  {/* out_soon / hot 小徽章（goods-status-label-render ③）——僅明確 label 觸發
                      （label 空不臆測）。最終配色 DECISION-PENDING 待設計稿。 */}
                  {explicitBadge === ProductStatusBadge.OutSoon ? (
                    <StatusPill theme={theme} text={OUT_SOON_LABEL} color={OUT_SOON_COLOR} />
                  ) : explicitBadge === ProductStatusBadge.Hot ? (
                    <StatusPill theme={theme} text={HOT_LABEL} color={theme.accent} />
                  ) : null}
                </View>
              )}
            </>
          ) : null}
        </Pressable>
        <View style={{ width: 8 }} />

        {/* Trailing action group (detail · share · cart/bell). The detail icon (`DetailGlyph`,
            design Icons.detail, rb-rn-icon-parity-product-detail-button — parity iOS/Android/Flutter)
            funnels the FULL browse detail exit; the cart button (`CartGlyph`) funnels the
            COMPACT add-to-cart exit (in-stock) or the 補貨 restock exit (sold-out `BellGlyph`);
            the share icon (↑) forwards `share` (→ host → system share with ?t=beginTime, issue 6). */}
        <RowOutlineIcon theme={theme} onTap={open}>
          <DetailGlyph color={theme.accent} size={16} />
        </RowOutlineIcon>
        <View style={{ width: 8 }} />
        {/* 列分享 改設計稿自繪三節點 ShareGlyph（rb-rn-share-icon-design-align，問題 8）。 進行中直播
            （`showShare === false`）時連同其後 spacer 一併不畫（rb-rn-live-hide-product-share，design
            R12）——沒有已定案的「開始銷售時間」，分享連結無法帶出正確時間點資訊；VOD / 回放不受影響。 */}
        {showShare ? (
          <>
            <RowOutlineIcon
              testID={index != null ? productRowShare(index) : undefined}
              theme={theme}
              onTap={share}
            >
              <ShareGlyph color={theme.accent} size={14} />
            </RowOutlineIcon>
            <View style={{ width: 8 }} />
          </>
        ) : null}
        <RowCartButton
          testID={index != null ? productRowCart(index) : undefined}
          theme={theme}
          soldOut={soldOut}
          onTap={quickAdd}
        />
      </View>

      {/* Bottom hairline (`LBPProductRow` borderBottom: 1px solid stroke). */}
      <View style={{ height: 1, backgroundColor: STROKE }} />
    </View>
  );
}

// MARK: - `grid` layout — new vertical card (design R21), used ONLY by the「更多商品」推薦格.
//
// Thumbnail on top (1:1, sunken placeholder fill) with an ACCENT play circle in the top-right
// corner (only when `onPlayClick` is provided — no `showPlay`/`isIntroducing`/`ProductRowOverlay`
// concept here, cross-video recommendation cards have no live-narrating state); name + optional
// strike-through original (unless `hideSub`) + price-or-已售完 row with an independent accent
// cart circle (hidden when sold out — a plain hide, NOT the row's bell-swap).
//
// Deterministic (no animation / randomness — parity `WinEntryView`'s own precedent): design R21
// calls for a breathing/pulse animation on the play circle (mirrored on iOS `continuousAnimationGate`
// / Android `LocalContinuousAnimationGate`), but this layer's RENDER DISCIPLINE (see this file's
// header) forbids `Animated` in the structural jest snapshot tree — the play circle is drawn at
// its AT-REST full-opacity frame, statically, exactly like `WinEntryView`'s accent ring.

/** 26×26 accent circle with a white play glyph, top-right of the grid thumbnail. */
function GridPlayButton(props: {
  theme: ReferenceUITheme;
  onTap: () => void;
  testID?: string;
}): ReactElement {
  const { theme, onTap, testID } = props;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onTap}
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 10 * theme.fontScale, fontWeight: 'bold' }}>
        ▶
      </Text>
    </Pressable>
  );
}

/** 26×26 accent circle with a white cart glyph, beside the grid card's price. */
function GridCartButton(props: {
  theme: ReferenceUITheme;
  onTap: () => void;
  testID?: string;
}): ReactElement {
  const { theme, onTap, testID } = props;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onTap}
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CartGlyph color="#FFFFFF" size={12} />
    </Pressable>
  );
}

function GridLayoutBody(props: {
  index?: number;
  theme: ReferenceUITheme;
  product: LBProduct;
  hideSub: boolean;
  live?: boolean;
  onOpenProduct?: (product: LBProduct) => void;
  onQuickAdd?: (product: LBProduct) => void;
  onPlayClick?: () => void;
}): ReactElement {
  const { index, theme, product, hideSub, live = false, onOpenProduct, onQuickAdd, onPlayClick } = props;
  const soldOut = ProductStatusBadge.resolve(product) === ProductStatusBadge.SoldOut;
  const open = (): void => onOpenProduct?.(product);
  const quickAdd = (): void => onQuickAdd?.(product);
  const photoUri = product.photos.length > 0 ? product.photos[0] : product.pic || undefined;
  const showStrike =
    !hideSub &&
    !soldOut &&
    product.originalPriceShow.length > 0 &&
    product.originalPriceShow !== product.priceShow;

  return (
    <Pressable
      testID={index != null ? productRecommendationCard(index) : undefined}
      accessibilityRole="button"
      onPress={open}
      style={{
        borderRadius: 14,
        backgroundColor: theme.background,
        overflow: 'hidden',
      }}
    >
      <View style={{ aspectRatio: 1, backgroundColor: BG_SUNKEN }}>
        <RemoteImage live={live} uri={photoUri} borderRadius={0} />
        {/* 播放圖示可見性單純吃 `onPlayClick != null`（由呼叫端依 `videoId` 決定是否傳入），不涉及
            `productRowOverlay`（那是 `row` 三模式決策，`grid` 跨影片推薦卡沒有「介紹中」的概念）。 */}
        {onPlayClick != null ? (
          <View style={{ position: 'absolute', top: 6, right: 6 }}>
            <GridPlayButton
              theme={theme}
              onTap={onPlayClick}
              testID={index != null ? productRecommendationPlay(index) : undefined}
            />
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 }}>
        <Text
          numberOfLines={2}
          style={{ color: theme.text, fontSize: 13 * theme.fontScale, fontWeight: '600' }}
        >
          {product.name}
        </Text>
        {/* 價格 cell（rb-rn-product-row-price-cart-layout-fix）：售價（或已售完）與劃線原價同屬
            一個 View，售價在上、劃線原價在下——對齊設計 `sdk-components.jsx:1116-1129`
            `flexDirection: p.was ? 'column' : 'row'` 分支（JSX 子節點順序 price span 先於 was
            span，即視覺上原價落在售價下方）。此 cell 與加購圓鈕同為外層列（`alignItems:'flex-end'`）
            的直接手足節點，讓加購圓鈕永遠貼齊列底、不受這個 cell 是 1 行或 2 行高度影響。 */}
        <View
          style={{
            marginTop: 6,
            flexDirection: 'row',
            alignItems: 'flex-end',
          }}
        >
          <View>
            {soldOut ? (
              <Text style={{ color: SOLD_OUT_COLOR, fontSize: 13 * theme.fontScale, fontWeight: 'bold' }}>
                {SOLD_OUT_LABEL}
              </Text>
            ) : (
              <>
                <Text style={{ color: SALE_COLOR, fontSize: 14 * theme.fontScale, fontWeight: '900' }}>
                  {product.priceShow}
                </Text>
                {showStrike ? (
                  <Text
                    style={{
                      marginTop: 2,
                      color: TEXT_DIM,
                      fontSize: 11 * theme.fontScale,
                      textDecorationLine: 'line-through',
                      textDecorationColor: TEXT_DIM,
                    }}
                  >
                    {product.originalPriceShow}
                  </Text>
                ) : null}
              </>
            )}
          </View>
          <View style={{ flex: 1 }} />
          {/* 獨立加購圓鈕（design R21「soldOut 時不顯示」——單純隱藏，不像 row 的 RowCartButton 換成
              鈴鐺）。 */}
          {!soldOut ? (
            <GridCartButton
              theme={theme}
              onTap={quickAdd}
              testID={index != null ? productRecommendationCart(index) : undefined}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * An outline-accent 30-wide circular icon button (detail / share affordances —
 * the detail one is wired to the row open-detail exit; share is decorative).
 */
function RowOutlineIcon(props: {
  theme: ReferenceUITheme;
  glyph?: string;
  onTap?: () => void;
  children?: ReactElement;
  testID?: string;
}): ReactElement {
  const { theme, glyph, onTap, children, testID } = props;
  return (
    <Pressable
      testID={testID}
      onPress={() => onTap?.()}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children ?? (
        <Text style={{ color: theme.accent, fontSize: 14 * theme.fontScale }}>{glyph}</Text>
      )}
    </Pressable>
  );
}

/**
 * The filled-accent cart button — bell glyph (補貨通知) when sold out, cart glyph
 * (加購) otherwise. Both funnel to `onTap` (the row open-detail exit); the actual
 * add / notify happens after the detail opens (D-2/D-3).
 */
function RowCartButton(props: {
  theme: ReferenceUITheme;
  soldOut: boolean;
  onTap?: () => void;
  testID?: string;
}): ReactElement {
  const { theme, soldOut, onTap, testID } = props;
  return (
    <Pressable
      testID={testID}
      onPress={() => onTap?.()}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {soldOut ? (
        <BellGlyph color="#FFFFFF" size={13} />
      ) : (
        <CartGlyph color="#FFFFFF" size={13} />
      )}
    </Pressable>
  );
}

// MARK: - Bottom cart CTA footer (`LBPCartCTA` — bag glyph + label + count)
//
// A top-hairline-separated footer carrying the full-width accent cart CTA, badged
// with the cart count when `> 0`.

function CartCTAFooter(props: {
  theme: ReferenceUITheme;
  // rb-rn-product-sheet-cart-cta-cleanup (問題6) — `cartCount` is the per-session successful-add
  // count (`DefaultCartCTA.count`), NOT the real cart quantity, so the misleading `(n)` badge is no
  // longer rendered. The prop is RETAINED (call site still passes it, ctor stable, one-line restore)
  // but the footer shows only the fixed「查看購物車」label.
  cartCount: number;
  onOpenCart?: () => void;
}): ReactElement {
  const { theme, onOpenCart } = props;
  return (
    <View>
      {/* Top hairline over the CTA footer (LBPCartCTA footer borderTop: 1px stroke). */}
      <View style={{ height: 1, backgroundColor: STROKE }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18 }}>
        <Pressable
          testID={LBTestIDs.cartCtaFooter}
          onPress={() => onOpenCart?.()}
          style={{
            backgroundColor: theme.accent,
            // 統一按鈕圓角 → theme.cornerRadius（原 14，rb-rn-button-corner-radius-unify）。
            borderRadius: theme.cornerRadius,
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* rb-rn-icon-parity-bag-cart-batch: design `LBPCartCTA` moved (2026-08-25) from the
              outline `shopBag` bag silhouette to the filled `cartFill` basket-with-hook-handle
              glyph; `ShopBagGlyph` is retired (deleted). NOT the multicolor 🛍 emoji. */}
          <CartFillGlyph color="#FFFFFF" size={20 * theme.fontScale} />
          <View style={{ width: 10 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 16 * theme.fontScale, fontWeight: 'bold' }}>
            {CART_LABEL}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
