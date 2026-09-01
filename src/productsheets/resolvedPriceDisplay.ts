// resolvedPriceDisplay — spec-aware, SAME-SOURCE price pair for the product sheets (RN).
//
// Spec: `reference-ui-rendering/spec.md`
//   § "react-native-reference-ui 商品明細 / 加入購物車 sheet 價格線跟隨 selectedSpec,
//      售價與原價同源原子解析（RN）"
// Change: rn-product-sheet-spec-price-reference-ui.
//
// ⚠️ FOUR-PLATFORM PARITY CONTRACT ⚠️
// iOS is the LEAD platform for this rule — this file MIRRORS
// `ios/Sources/LivebuyReferenceUI/ProductSheets/ResolvedPriceDisplay.swift` VERBATIM:
// same type name, same function name, same field names, same degradation ladder, same
// test matrix. Android (`:livebuy-reference-ui` `ResolvedPriceDisplay.kt`) and Flutter
// (`resolved_price_display.dart`) mirror it too. Do NOT "improve" the shape here without
// re-deriving all four platforms.
//
// ── WHY A SINGLE FUNCTION RETURNING A PAIR (and not two independent resolvers) ──
//
// The sale price and the struck-through original price MUST come from the SAME SOURCE.
// If they are resolved by two independent `??` fallbacks, the two can silently disagree
// the moment their degradation conditions differ — producing a FAKE DISCOUNT RATE on
// screen, e.g.:
//
//     spec sale NT$290  ×  product original NT$590   → claims 51% off
//     (reality: the product level is NT$390 / NT$590)
//
// Returning ONE value object makes the mismatch UNREPRESENTABLE rather than merely
// discouraged-by-comment. Each independent resolver would also unit-test "correct" in
// isolation while the composed screen is wrong — the exact failure mode most likely to
// be re-introduced when this rule is mirrored to the remaining platforms.
//
// The structural guarantee is concrete: `productLevel` below is the SINGLE SHARED TARGET
// of BOTH degradation rungs, and every `return` emits a COMPLETE pair. No code path can
// assemble one field from the spec and the other from the product.
//
// ── DEGRADATION LADDER ──
//
//   1. `selectedSpec === null` (selection incomplete / unresolvable)
//        → the WHOLE PAIR falls back to the product level.
//        Mirrors the view-model's existing stock fallback shape
//        (`const stock = spec ? spec.stock : (detail?.stock ?? 0)`,
//        `react-native-ui/src/DefaultTemplate.ts:1783-1787` — NOT modified by this change).
//   2. `selectedSpec !== null` but its `priceShow` is blank (empty / whitespace-only)
//        → the WHOLE PAIR falls back to the product level.
//   3. otherwise
//        → the WHOLE PAIR is taken from the spec — INCLUDING a blank original price.
//
// ── WHY A BLANK `originalPriceShow` DOES *NOT* TRIGGER FALLBACK ──
//
// This is the single most mirror-fragile clause in the contract, so the reasoning is
// spelled out. The two fields are NOT symmetric:
//
//   • `priceShow` (sale price) is a MANDATORY-TO-DRAW field. A blank sale price cannot
//     be rendered, so a spec carrying one does not stand up as a source at all → the
//     whole pair falls back.
//   • `originalPriceShow` (was-price / strike-through) is an OPTIONAL-TO-DRAW field.
//     "This variant has no was-price" is a LEGITIMATE *no-discount* state, not a data
//     gap — the product level has always treated a blank original the same way.
//
// So a blank original MUST keep the spec source and simply not draw the strike-through.
// The two rejected alternatives, for the record:
//
//   • blank original → fall back the whole pair  ⇒ the screen would show the PRODUCT'S
//     SALE PRICE while the user has a NT$290 variant selected. Displayed price ≠ price
//     actually added to cart — far worse than a missing strike-through.
//   • blank original → borrow the product's original, keep the spec's sale price
//     ⇒ violates same-source atomicity outright, i.e. the fake discount above.
//
// ── BLANK CHECKS TRIM; RETURNED STRINGS ARE NEVER TRIMMED ──
//
// Per the SDK's JSON-decoder tolerance rules a free-text field may arrive as `''` or
// whitespace-only, so emptiness is judged AFTER trimming. But trimming is used for
// JUDGEMENT ONLY: the returned strings are the ORIGINALS, character for character.
// Returning a trimmed string would change rendered pixels (a merchant may pad
// `priceShow` deliberately) and would let per-platform trimming differences (JS
// `String.prototype.trim` vs Swift `.whitespacesAndNewlines` vs Kotlin `isBlank`) grow
// into cross-platform visual drift.
//
// ── WHY `hasOriginalPrice` IS A FIELD, NOT A HELPER THE CALLER INVOKES ──
//
// iOS expresses it as a Swift computed property. TypeScript has no equivalent on a plain
// interface, and turning this into a class with a getter would stop it being plain data.
// So it is computed DURING resolution and stored as the third field: WHETHER a
// strike-through is drawn and WHICH string is drawn are decided in the same pass and can
// never disagree. Exporting only a standalone `hasOriginalPrice(pair)` helper would let a
// caller pass a hand-assembled object and quietly reintroduce the mixed-source bug.

import type { LBProductDetailState } from 'livebuy-react-native-ui';
import type { LBSpec } from 'livebuy-react-native';

/**
 * A same-source price pair for the product sheets' price row: the sale price plus its
 * optional struck-through original, resolved together so they can never disagree.
 *
 * Produced ONLY by {@link resolvePriceDisplay} — do not assemble the fields from
 * different sources at a call site (that is precisely what this type exists to prevent).
 */
export interface ResolvedPriceDisplay {
  /** The sale price to draw, verbatim from whichever source won (spec or product). */
  readonly priceShow: string;
  /**
   * The original ("was") price to strike through, verbatim from the SAME source as
   * {@link priceShow}. May be blank — meaning that source genuinely has no was-price.
   */
  readonly originalPriceShow: string;
  /**
   * Whether a struck-through original price worth drawing exists — see
   * {@link computeHasOriginalPrice}. Computed during resolution from the two fields
   * above, so it always agrees with them.
   *
   * The sheet MUST read this instead of re-deriving "is there an original?" from
   * `detail` / `selectedSpec`.
   */
  readonly hasOriginalPrice: boolean;
}

/**
 * Blank (empty or whitespace-only) — the emptiness test used by every rung of the
 * ladder. JUDGEMENT ONLY; never applied to a returned string.
 */
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Whether a struck-through original price worth drawing exists.
 *
 * True only when `originalPriceShow` is non-blank AND differs from `priceShow` (an
 * original equal to the sale price is not a discount). Both sides are trimmed for the
 * comparison ONLY — the strings themselves are never mutated (see the file header).
 *
 * Exported for direct boundary testing; production code reads
 * {@link ResolvedPriceDisplay.hasOriginalPrice} off the resolved pair instead.
 */
export function computeHasOriginalPrice(
  priceShow: string,
  originalPriceShow: string,
): boolean {
  const original = originalPriceShow.trim();
  if (original.length === 0) return false;
  return original !== priceShow.trim();
}

/** Build a pair, computing `hasOriginalPrice` from the very strings being stored. */
function makePair(priceShow: string, originalPriceShow: string): ResolvedPriceDisplay {
  return {
    priceShow,
    originalPriceShow,
    hasOriginalPrice: computeHasOriginalPrice(priceShow, originalPriceShow),
  };
}

/**
 * Resolves the sheet's price pair from the product detail and the currently selected
 * spec, ATOMICALLY: both returned fields always come from the same source.
 *
 * @param detail       the product-level detail (`ProductSheetsModel.detail`).
 * @param selectedSpec the resolved variant spec (`LBVariantState.selectedSpec`), or
 *                     `null` when the selection is incomplete / unresolvable.
 * @returns a {@link ResolvedPriceDisplay} whose two price fields are both from
 *          `selectedSpec` or both from `detail` — never mixed.
 *
 * Pure: no I/O, no global state, no mutation. Safe to call per-render.
 */
export function resolvePriceDisplay(
  detail: LBProductDetailState,
  selectedSpec: LBSpec | null,
): ResolvedPriceDisplay {
  // The product-level pair — the SINGLE fallback target for BOTH degradation rungs, so a
  // fallback can never take one field from the spec and the other from here.
  const productLevel = makePair(detail.priceShow, detail.originalPriceShow);

  // Rung 1 — selection incomplete / unresolvable → whole pair from the product.
  if (selectedSpec === null) return productLevel;

  // Rung 2 — the spec cannot supply a drawable sale price → whole pair from the product.
  // NOTE this deliberately discards a non-blank `selectedSpec.originalPriceShow` too:
  // keeping it would be exactly the mixed-source fake discount this module bans.
  if (isBlank(selectedSpec.priceShow)) return productLevel;

  // Rung 3 — whole pair from the spec, INCLUDING a blank original price (a genuine
  // "this variant has no was-price" → the strike-through simply isn't drawn).
  return makePair(selectedSpec.priceShow, selectedSpec.originalPriceShow);
}
