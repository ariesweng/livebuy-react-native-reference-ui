// productListKeyboardAvoidance — keyboard avoidance for the product LIST drawer's search field
// (rb-rn-product-list-search-usability).
//
// The list drawer is a bottom-anchored absolute card inside `ProductSheetsView` (not routed
// through `BottomSheetPresenter`). When its search `TextInput` is focused:
//   • iOS — the window does NOT resize for the keyboard, so the card stays under it. The card is
//     lifted by the part of the keyboard that still overlaps the enclosing Tier B container
//     (`useLBImeBottomInset()`, the same measured overlap the chat composer bar uses — zero when
//     the host already moved the container above the keyboard), minus the bottom safe-area spacer
//     the card already reserves (that spacer then sits under the keyboard, so the cart footer
//     ends exactly at the keyboard's top edge instead of floating above it).
//   • Android — the host Activity / RN `Modal` window resizes for the keyboard (`adjustResize`),
//     which already lifts the bottom-anchored card. A second lift here would double the shift, so
//     the lift is zero on every non-iOS platform. (The measured overlap is NOT trusted on Android:
//     for the render between the keyboard event and the re-measure it is computed against the
//     pre-resize container frame, which would flash a double shift.)
//
// Pure functions only — exported so the platform rule and the geometry are directly unit-testable.

/**
 * How far (px) the list drawer card is lifted above the container's bottom edge.
 *
 * @param os             `Platform.OS`.
 * @param imeBottom      Measured keyboard overlap with the container's bottom edge
 *                       (`useLBImeBottomInset()`; zero when no keyboard / no Tier B container).
 * @param safeAreaBottom The bottom safe-area inset the card's `SheetScaffold` already reserves.
 */
export function productListKeyboardLift(os: string, imeBottom: number, safeAreaBottom: number): number {
  if (os !== 'ios') return 0;
  if (!(imeBottom > 0)) return 0;
  return Math.max(0, imeBottom - Math.max(0, safeAreaBottom));
}

/**
 * The height fraction actually rendered while the card is lifted. A user-dragged `heightPct`
 * (up to the shared 80% ceiling) plus the lift could push the card's top — and with it the
 * search field — above the screen; this caps the fraction so the card's top stays at or below
 * the top safe-area inset. The cap is display-only: the drag gesture's own committed height is
 * untouched, so the drawer returns to it once the keyboard hides.
 *
 * `heightPct === undefined` (the user never dragged — content-sized `maxHeight` mode) is passed
 * through unchanged so the drawer keeps tracking its content (search filtering shrinks it);
 * returning a number here would force `SheetScaffold` into fixed-height mode.
 */
export function productListKeyboardHeightPct(
  heightPct: number | undefined,
  lift: number,
  safeAreaTop: number,
  safeAreaBottom: number,
  windowHeight: number,
): number | undefined {
  if (heightPct === undefined || !(lift > 0) || !(windowHeight > 0)) return heightPct;
  const available = (windowHeight - lift - Math.max(0, safeAreaTop) - Math.max(0, safeAreaBottom)) / windowHeight;
  return Math.min(heightPct, Math.max(0, available));
}
