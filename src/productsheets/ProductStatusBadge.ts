// ProductStatusBadge — 商品狀態標籤的單一優先序解析（RN）.
//
// goods-status-label-render (parity iOS `ProductStatusBadge.swift` / Android
// `ProductStatusBadge.kt`). 後端 batch ③ 由 SDK 算好結論欄 `LBProduct.label`
// （唯一優先序 `sold_out > narrating > out_soon > hot`，四者皆無 → `""`）。
// reference-ui 以此為單一來源、停止各自用 raw 欄位臨時自組。為相容舊後端 / demo
// （`label` 空 / `undefined`），`resolve` 在 label 空時以 raw 欄位**同序** fallback；
// `fromLabel` 則只認**明確** label（給「新視覺」用，空 → `None`，不臆測 raw）。
//
// 純函式（無 react / react-native import）→ 可獨立單元測試。

import type { LBProduct } from 'livebuy-react-native';

/**
 * 商品狀態標籤。對齊 iOS `ProductStatusBadge` enum / Android `ProductStatusBadge`。
 * - `SoldOut`   售罄
 * - `Narrating` 介紹中（僅直播 type=2 有意義）
 * - `OutSoon`   即將售完
 * - `Hot`       熱賣中
 * - `None`      無標籤
 */
export type ProductStatusBadgeValue = 'SoldOut' | 'Narrating' | 'OutSoon' | 'Hot' | 'None';

/**
 * Enum-like 命名空間 + 兩個純函式（與 `ProductRowOverlay` 同風格）。
 */
export const ProductStatusBadge = {
  SoldOut: 'SoldOut' as ProductStatusBadgeValue,
  Narrating: 'Narrating' as ProductStatusBadgeValue,
  OutSoon: 'OutSoon' as ProductStatusBadgeValue,
  Hot: 'Hot' as ProductStatusBadgeValue,
  None: 'None' as ProductStatusBadgeValue,

  /**
   * 後端結論欄 `label` 字串 → badge（只認明確 label；空 / `undefined` / 未知 → `None`）。Pure.
   */
  fromLabel(label?: string): ProductStatusBadgeValue {
    switch (label) {
      case 'sold_out':
        return 'SoldOut';
      case 'narrating':
        return 'Narrating';
      case 'out_soon':
        return 'OutSoon';
      case 'hot':
        return 'Hot';
      default:
        return 'None';
    }
  },

  /**
   * 單一優先序解析：`label` 優先；`label` 空（舊後端 / demo / 未計算）時以 raw 欄位
   * （`soldOut` / `isNarrating` / `isOutSoon` / `isHot`）**同序** fallback。Pure / testable.
   * `isNarrating` 缺鍵 → 由 `narrateStatus === 2` 派生（對齊 TS LBProduct 缺鍵 fallback 慣例）。
   */
  resolve(product: LBProduct): ProductStatusBadgeValue {
    const byLabel = ProductStatusBadge.fromLabel(product.label);
    if (byLabel !== 'None') return byLabel;
    // fallback（label 空）：維持與後端相同的優先序，確保既有視覺（已售完）相容。
    if (product.soldOut === 1) return 'SoldOut';
    const narrating = product.isNarrating ?? product.narrateStatus === 2;
    if (narrating) return 'Narrating';
    if (product.isOutSoon === 1) return 'OutSoon';
    if (product.isHot === 1) return 'Hot';
    return 'None';
  },
} as const;
