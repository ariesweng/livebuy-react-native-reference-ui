// ProductRowNameTag — 商品列名稱前標籤的純決策（RN）.
//
// rb-rn-product-row-name-tag-system (design R39, parity iOS `ProductRowNameTag.resolve(mode:
// label:soldOut:)` / Android `ProductRowNameTag.resolve(mode, label, soldOut)`). 決定
// `ProductRowView` 的 `.row` 排版商品名稱**之前** inline 顯示哪一種小標籤——「直播價」/「搶購中」
// （`mode === 'live'` 且未售罄，依 `isFlashSale` 二選一）/「即將售完」（`mode` 為 `'vod'` 或
// `'replay'` 且 `label === 'out_soon'`）/「熱賣中」（同上 `label === 'hot'`）/ 無標籤。
//
// 已售完是**最高優先序**的閘門——SHALL 在依 `mode` 分流**之前**檢查呼叫端傳入的、已解析的
// `soldOut: boolean`（呼叫端既有的 `ProductStatusBadge.resolve(product) === SoldOut`，涵蓋明確
// `label === 'sold_out'` 與 `label === '' && product.soldOut === 1` raw fallback 兩種來源）——
// `soldOut === true` 時**任何** mode（含 `'live'`）名稱前皆 MUST NOT 顯示任何標籤。此函式本身
// 不重新推導 `soldOut`（不 import `LBProduct` / 不呼叫 `ProductStatusBadge.resolve`），只消費
// 呼叫端已解析的布林值——對齊 iOS/Android sibling change 訂正後的最終版本（iOS 初版曾漏做
// `.live` 分支的售罄檢查，是一個真的 bug，非設計決定；本檔案從一開始就是正確版本，不重蹈覆轍）。
//
// out_soon / hot 的觸發資料來源不變：僅認**明確** `product.label`（透過既有
// `ProductStatusBadge.fromLabel`，`label` 空 / `undefined` 不臆測），MUST NOT 改用 `stock` /
// `orderedPct`（core 尚無 `orderedPct` 欄位，`stock` 刻意不用，避免跟既有已上線邏輯打架）。
//
// 搶購中（rb-rn-flash-sale-live-signal-wiring）：`mode === 'live'` 且未售罄時，依呼叫端傳入的
// `isFlashSale: boolean`（`= channel.isFlashSale`，`LBPlayerChannelInfo` 頂層旗標，經
// `deriveHeaderChromeFields` → `handleHeaderChrome` → `PlayerHeaderState.isFlashSale` →
// `PlayerShellModel`/`ProductSheetsModel` 一路帶下來）二選一：`isFlashSale === true` → `Rush`
// （「搶購中」，實心 accent 底、白字）；`isFlashSale === false`（含省略呼叫端）→ `LivePrice`
// （「直播價」，既有外框膠囊，行為 byte-identical 於本旗標新增之前）。**先前「pipe-first, no water
// yet」的階段性限制已解除**——當時沒有任何呼叫端能表達「搶購模式」（view-model 無 `liveMode` /
// rush 訊號來源），現在 `isFlashSale` 資料源已備齊並接線。以 `switch (mode)` 撰寫（而非扁平
// `if`），未來若有更多 live 訊號變體可直接新增一個 case，不需重構既有 View。
//
// 純函式（無 react / react-native import；`ProductStatusBadge` / `ProductRowMode` 皆為同風格的
// 零依賴純模組）→ 可獨立單元測試。

import { ProductStatusBadge } from './ProductStatusBadge';
import type { ProductRowMode } from './ProductRowOverlay';

/**
 * 商品列名稱前標籤的種類。
 * - `LivePrice` 直播價（`mode === 'live'`，未售罄，`isFlashSale === false`）
 * - `Rush`      搶購中（`mode === 'live'`，未售罄，`isFlashSale === true`，
 *   rb-rn-flash-sale-live-signal-wiring）
 * - `OutSoon`   即將售完（`mode` 為 `'vod'` / `'replay'`，`label === 'out_soon'`）
 * - `Hot`       熱賣中（同上，`label === 'hot'`）
 * - `None`      無標籤（含已售完的全域最高優先序、`label` 空不臆測、`mode === 'live'` 時
 *   `label` 為 `out_soon`/`hot` 皆不顯示——`mode` 分流優先於 `label`，但售罄優先於兩者）
 */
export type ProductRowNameTagValue = 'LivePrice' | 'Rush' | 'OutSoon' | 'Hot' | 'None';

/**
 * Enum-like 命名空間 + 一個純函式（與 `ProductStatusBadge` / `ProductBagNarratingBadge` 同風格）。
 */
export const ProductRowNameTag = {
  LivePrice: 'LivePrice' as ProductRowNameTagValue,
  Rush: 'Rush' as ProductRowNameTagValue,
  OutSoon: 'OutSoon' as ProductRowNameTagValue,
  Hot: 'Hot' as ProductRowNameTagValue,
  None: 'None' as ProductRowNameTagValue,

  /**
   * 決定商品名稱前標籤。`soldOut` SHALL 由呼叫端傳入**已解析**的售罄狀態，在 `switch (mode)` 之前
   * 短路——對 `'live'`/`'vod'`/`'replay'` 一視同仁，售罄優先序高於 `mode` 分流。`isFlashSale`
   * （預設 `false`，省略時行為與本旗標新增之前 byte-identical）只影響 `'live'` 分支：`true` →
   * `Rush`（搶購中）、`false` → `LivePrice`（直播價）。Pure / testable.
   */
  resolve(
    mode: ProductRowMode,
    label: string | undefined,
    soldOut: boolean,
    isFlashSale = false,
  ): ProductRowNameTagValue {
    if (soldOut) return 'None';
    switch (mode) {
      case 'live':
        return isFlashSale ? 'Rush' : 'LivePrice';
      case 'vod':
      case 'replay': {
        const badge = ProductStatusBadge.fromLabel(label);
        if (badge === 'OutSoon') return 'OutSoon';
        if (badge === 'Hot') return 'Hot';
        return 'None';
      }
      default:
        return 'None';
    }
  },
} as const;
