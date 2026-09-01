// MARK: - variantPromptTrigger — 「請選規格」per-tap re-arm 的純決策（rn-variant-prompt-reprompt-rearm）
//
// Spec: `reference-ui-rendering/spec.md` §「渲染 RN ProductDetail 商品明細」。RN parity of iOS /
// Android `VariantPromptTrigger.shouldPresent`。
//
// 「請選規格」prompt 由容器（`ProductSheetsView`）在**每次加購點擊**（`handleAddToCart`）決定是否
// （重新）呈現，**不是**靠 `selectSpecRequired` 的 false→true rising edge——template 的變體 guard 是
// 同步早退、旗標一旦設 true 就持續 true（只有 `selectVariant` 才清），故 rising-edge 寫法
// （舊的 `prevNeedsVariantRef` + `useEffect`）會在使用者「我知道了」關閉提示後、未選規格再點加購時
// 漏跳第二次（"dismiss then re-add shows nothing" 的 bug）。決策很單純：（同步）加購後，只要變體仍未
// 選完就呈現。抽成純函式以便 jest 直接驗 re-arm 規則（unit-test-discipline），鏡射同目錄 `cartLoadingFloor.ts`。

/**
 * 加購一次後，是否（重新）呈現「請選規格」提示。`needsVariantSelection`（= template
 * `selectSpecRequired`）為 true（規格仍未選完）即呈現——**每一次**這樣的加購皆 true（re-arm），
 * 含使用者關閉前一個提示卻仍未選規格的情境；一旦選到規格（`selectVariant` 清旗標）即 false，加購正常進行。
 */
export function variantPromptShouldPresent(needsVariantSelection: boolean): boolean {
  return needsVariantSelection;
}
