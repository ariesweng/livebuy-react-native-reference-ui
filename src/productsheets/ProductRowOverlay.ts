// ProductRowOverlay — 商品列縮圖疊層三模式純決策（RN）.
//
// product-row-status-overlay (parity iOS `ProductRowOverlay.swift` / Android
// `ProductRowOverlay.kt`). 與真實影格 `live` 旗標（縮圖載真實圖 vs placeholder）正交——
// 此處決定的是 VOD / active-live / replay 三模式下的「播放 icon vs 介紹中」疊層。
//
// 純函式（無 react / react-native import）→ 可獨立單元測試。

/**
 * 商品列 row 縮圖疊層的播放模式。與真實影格的 `live` 旗標（圖片載入）不同——這是
 * VOD vs active-live vs replay。
 * - `'vod'`    純點播：二態（rb-rn-product-row-vod-done-state-removed），與 `'replay'`
 *   同構——依 {@link productRowOverlay} 的 `position` vs 商品 `[beginTime, endTime)` 介紹
 *   時間窗判斷：`now`（正在介紹時間窗內）等化器遮罩；其餘所有情況（尚未介紹 或 已介紹完畢）
 *   一律播放 icon 可 seek。缺 `beginTime` 或 `endTime` 任一者 → 同樣退回播放 icon（永遠可
 *   seek）。
 * - `'live'`   直播中：無未來可跳 → 正在介紹的商品標「介紹中」、其餘無 icon。
 * - `'replay'` 直播回放：依 begin_time/end_time vs 當下播放秒數逐商品判「介紹中」。
 *   `beginTime === 0 && endTime === 0`（後端 sentinel，代表從未被介紹過）為第三種、與二態結構
 *   不同的狀態——不顯示看講解 pill 或介紹中橫幅（rb-rn-replay-never-introduced-no-ui，見
 *   {@link isReplayNeverIntroduced}），僅限定 `'replay'`，`'vod'` 的同款 `[0,0]` 是合法真實資料
 *   不受影響。
 */
export type ProductRowMode = 'vod' | 'live' | 'replay';

/** {@link productRowOverlay} 的結果。`showPlay` 與 `showIntroducing` 在單一 row 互斥. */
export interface ProductRowOverlayResult {
  readonly showPlay: boolean;
  readonly showIntroducing: boolean;
  /**
   * 列分享 icon 是否顯示（rb-rn-live-hide-product-share, design R12, parity iOS
   * `rb-ios-live-hide-product-share`）. `= mode !== 'live'` — `'vod'` / `'replay'` 有真實
   * `beginTime` 可供分享連結標註時間點, `true`；`'live'`（進行中直播）沒有已定案的「開始銷售
   * 時間」, 分享連結無法帶出正確時間點資訊, `false`。與 `showPlay` / `showIntroducing` 正交
   * （縮圖 seek 互動不受影響）。
   */
  readonly showShare: boolean;
}

/**
 * 商品列 row 縮圖疊層的純決策（product-row-status-overlay）。播放 affordance 與
 * 「介紹中」標籤在任一 row 互斥。
 *
 * - VOD（rb-rn-product-row-vod-done-state-removed）：二態，與 `'replay'` 同構——依
 *   `position` vs 商品 `[beginTime, endTime)` 介紹時間窗判斷——`beginTime <= position <
 *   endTime` → now（`showIntroducing = true`）；其餘所有情況（`position < beginTime` 或
 *   `position >= endTime`）→ 播放 affordance（`showPlay = true`）。`beginTime` 或
 *   `endTime` 缺任一者 → 同樣退回播放 affordance（`showPlay = true`），不因缺資料而讓縮圖
 *   silently 不顯示互動 affordance。二態決策完全忽略 `isNarrating`（那是 LIVE 專屬訊號）。
 * - active live: 「介紹中」⟺ `isNarrating`（`narrate_status == 2` 的商品）；永不顯示
 *   播放 affordance（直播無未來可 scrub）。
 * - replay: TWO-phase（與 VOD 同構，但邊界含閉區間 `[beginTime, endTime]`，非半開區間）——
 *   「介紹中」⟺ 當下播放 `position` 落在商品 `[beginTime, endTime]` 窗（含邊界）；否則顯示
 *   播放 affordance（seek 到該片段）。沒有「done」態——一個 row 永遠顯示某一種覆蓋層。
 *   replay 不看 `isNarrating`（`introducingProductId` 只在 active live 非 null）。**例外**：
 *   `beginTime === 0 && endTime === 0`（`isReplayNeverIntroduced`，後端 sentinel，代表這個商品
 *   在原始直播中從未被介紹過，非缺資料的 `null`）時，二態邏輯完全不套用——`showPlay` 與
 *   `showIntroducing` 皆 `false`（rb-rn-replay-never-introduced-no-ui，parity iOS
 *   `rb-ios-replay-never-introduced-no-ui`）。`beginTime === 0` 但 `endTime` 為真實非零值
 *   （如 `[0, 10)`）不受此例外影響，仍走上述正常窗口比較。
 *
 * `showShare` 只看 `mode`（`!== 'live'`）——與 `isNarrating` / `beginTime` / `endTime` /
 * `position` 正交（rb-rn-live-hide-product-share）。
 */
export function productRowOverlay(
  mode: ProductRowMode,
  isNarrating: boolean,
  beginTime: number | null,
  endTime: number | null,
  position: number,
): ProductRowOverlayResult {
  const showShare = mode !== 'live';
  switch (mode) {
    case 'vod': {
      // rb-rn-product-row-vod-done-state-removed: two phases, half-open window
      // [beginTime, endTime) — parity iOS/Android, isomorphic to 'replay' below. Missing
      // either bound falls back to the always-play behavior (showPlay = true), same as
      // replay's own missing-bound fallback below. There is no third "done" phase — once
      // outside the intro window (before OR after), the play affordance shows again.
      if (beginTime == null || endTime == null) {
        return { showPlay: true, showIntroducing: false, showShare };
      }
      if (position < beginTime || position >= endTime) {
        return { showPlay: true, showIntroducing: false, showShare }; // not introducing
      }
      return { showPlay: false, showIntroducing: true, showShare }; // now
    }
    case 'live':
      return { showPlay: false, showIntroducing: isNarrating, showShare };
    case 'replay': {
      // rb-rn-replay-never-introduced-no-ui: beginTime === 0 AND endTime === 0 is a distinct
      // backend sentinel meaning this product was NEVER narrated during the original live
      // broadcast — NOT the same as missing (`null`) data, which falls back to the play
      // affordance below via the inWindow null-check. Scoped ONLY to this exact [0, 0] pair
      // (checked BEFORE the window comparison so it can't be swept into a "real" window match) —
      // beginTime === 0 alone with a real, non-zero endTime (e.g. [0, 10)) is NOT affected and
      // evaluates via the normal window comparison. Parity iOS
      // `ProductRowOverlay.isReplayNeverIntroduced` (rb-ios-replay-never-introduced-no-ui).
      if (isReplayNeverIntroduced(beginTime, endTime)) {
        return { showPlay: false, showIntroducing: false, showShare };
      }
      const inWindow =
        beginTime != null && endTime != null && beginTime <= position && position <= endTime;
      return { showPlay: !inWindow, showIntroducing: inWindow, showShare };
    }
  }
}

// MARK: - isReplayNeverIntroduced — REPLAY-only "never narrated" sentinel
// (rb-rn-replay-never-introduced-no-ui, parity iOS/Android/Flutter isReplayNeverIntroduced).
//
// Exported as a standalone pure function (not inlined into productRowOverlay's 'replay' case) so
// `ProductList`'s 縮圖 tap handler (rb-rn-replay-never-introduced-tap-noop, a sibling change in the
// same batch) can reuse the EXACT same condition rather than each maintaining its own copy that
// could drift apart.

/**
 * Whether a REPLAY-mode product's `[beginTime, endTime]` is the backend's "never introduced
 * during the original live broadcast" sentinel — `beginTime === 0 AND endTime === 0` (`&&`, not
 * `||`). Distinct from missing (`null`) data, which is a different reason with different
 * behavior (falls back to the play affordance). This sentinel's meaning is ONLY valid in
 * `'replay'` mode — a `'vod'` product with `beginTime === 0 && endTime === 0` is legitimate real
 * data (e.g. introduced from the very start of the recording), so callers MUST gate this check on
 * `mode === 'replay'` themselves; this function does not take `mode` as an argument.
 */
export function isReplayNeverIntroduced(
  beginTime: number | null,
  endTime: number | null,
): boolean {
  return beginTime === 0 && endTime === 0;
}

// MARK: - ProductBagNarratingBadge — LIVE 商品袋清單「介紹中」橫幅的集合成員判斷
// (rn-product-bag-multi-narrating, parity iOS/Android `ProductBagNarratingBadge.isNarrating`).
//
// LIVE 直播後端可能**同時**把多件商品標記 `narrate_status == 2`（`DefaultPlayerTemplate
// .liveActiveProducts` 早已回傳全部符合的商品——既有 view-model 能力，本檔案/本函式不新增/不修改
// view-model）。商品袋清單 `ProductListView` 逐列判斷「是否介紹中」時，過去把單一 id
// （`ProductSheetsModel.introducingProductId`，只留 core/host「narrate_status==2 第一件」慣例）拿去
// 跟每一列的 `product.id` 比對，結構上只可能命中一列，漏標其餘同時介紹中的商品。
//
// `isNarrating` 抽成獨立純函式（`Set.has` 的具名包裝）而非直接內聯：(1) 對齊 iOS/Android 同名判例，
// 降低三端對照的認知負擔；(2) 符合 `docs/unit-test-discipline.md`「純函式抽出」——不需渲染
// `ProductListView` 元件即可單元測試；(3) 與 RN 既有的 `ProductStatusBadge`（enum-like 命名空間 +
// 純函式）風格一致，同放進本檔案（與逐列縮圖疊層決策 `productRowOverlay` 同檔案，比照 Android 把
// `ProductBagNarratingBadge` 放進 `ProductRowOverlay.kt` 的判例）。
export const ProductBagNarratingBadge = {
  /**
   * Whether `productId` is one of the currently-narrating products (LIVE `narrate_status == 2`,
   * the FULL set — `ProductSheetsModel.liveActiveProducts`, not just the single "first" id).
   * Pure `Set.has` wrapper. Empty set → always `false` (VOD / demo / nothing introducing).
   */
  isNarrating(productId: string, narratingIds: ReadonlySet<string>): boolean {
    return narratingIds.has(productId);
  },
} as const;

// MARK: - productRowNumberBadge — 商品列縮圖左上角編號徽章的純決策
// (rb-rn-product-row-number-badge, design R35, parity iOS/Android/Flutter
// productRowNumberBadge). VOD → 恆 null（純點播只留播放 seek affordance）；live/replay →
// 該商品在 BACKEND ORDER（未依「介紹中」重排的原始清單，`ProductSheetsModel
// .productsBackendOrder` ← `productOverlayState.products`）中的 1-based 位置。刻意 NOT 用
// `productOverlayState.productsIntroducingFirst`（顯示用、介紹中商品排最前的順序）——用那個
// 順序算編號會讓數字隨介紹中商品變動而跳動，與設計稿「序號取自原始順序」矛盾。
//
// `backendOrder` 收窄成結構型別（非 `LBProduct[]`）——本檔案維持零 import 的純決策慣例（同檔
// 既有的 `productRowOverlay` / `ProductBagNarratingBadge` 皆不 import 任何型別）。

/** Minimal shape `productRowNumberBadge` needs from a backend-order product entry. */
export interface ProductRowNumberBadgeSource {
  readonly id: string;
}

/**
 * The 1-based position badge for a product row's thumbnail (rb-rn-product-row-number-badge).
 * `mode === 'vod'` → always `null` (no badge). `'live'` / `'replay'` → `productId`'s 1-based
 * index within `backendOrder`; `productId` absent from `backendOrder` (defensive — should not
 * happen in practice) → `null`, same as VOD.
 */
export function productRowNumberBadge(
  mode: ProductRowMode,
  productId: string,
  backendOrder: readonly ProductRowNumberBadgeSource[],
): number | null {
  if (mode === 'vod') return null;
  const i = backendOrder.findIndex((p) => p.id === productId);
  return i >= 0 ? i + 1 : null;
}
