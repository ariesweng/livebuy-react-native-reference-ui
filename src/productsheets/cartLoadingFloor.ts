// MARK: - cartLoadingFloor — 加購 loading 防閃爍最小顯示時間（純函式）
//
// Spec: `reference-ui-rendering/spec.md`「加購 CTA 請求中 loading」防閃爍 floor
// (rb-rn-cart-add-loading-state). RN parity of iOS `CartLoadingFloor.remainingHoldNanos`
// / Android `CartLoadingFloor.remainingHoldMillis`。template 的 `addToCartInFlight` 可能
// 在極短時間內 true→false（特別是 dedup 同步丟 `cartAddDeduplicated`），不加 floor 會讓
// spinner 一閃即逝（strobe）。容器層以此純函式 derive 還需 hold 多久才可解除 loading。

/** 加購 loading 最小顯示時間（ms）— 與 iOS / Android 320ms 對稱。 */
export const CART_LOADING_FLOOR_MS = 320;

/**
 * 給「loading 已顯示」的 elapsed（ms），回傳還需 hold 多久（ms）才可隱藏。
 * elapsed ≥ floor → 0（可立即隱藏）；否則回剩餘正值（容器 `setTimeout(remaining)` 再隱藏）。
 * 純函式（不依賴時鐘）→ 可單元測試。
 */
export function cartLoadingFloorRemainingMs(elapsedMs: number): number {
  const remaining = CART_LOADING_FLOOR_MS - elapsedMs;
  return remaining > 0 ? remaining : 0;
}
