// resolvedProductPhoto — spec-aware product photo SOURCE for the product sheets (RN).
//
// Spec: `reference-ui-rendering/spec.md`
//   § "react-native-reference-ui 商品明細 / 加入購物車 sheet 與 zoom 燈箱的商品主圖跟隨
//      selectedSpec, 來源有效性與所繪項目同述詞解析（RN）"
// Change: rn-product-sheet-spec-photo-reference-ui.
// Sibling: `resolvedPriceDisplay.ts` (rn-product-sheet-spec-price-reference-ui) — same
// skeleton, same degradation-ladder shape, same "single shared fallback target" structure,
// same "derived field computed during resolution" pattern.
//
// ⚠️ FOUR-PLATFORM PARITY CONTRACT ⚠️
// iOS is the LEAD platform for this rule — this file MIRRORS
// `ios/Sources/LivebuyReferenceUI/ProductSheets/ResolvedProductPhoto.swift` VERBATIM:
// same type name, same function name, same field names, same degradation ladder, same
// `primaryPhoto` predicate, same test matrix. Android (`:livebuy-reference-ui`
// `ResolvedProductPhoto.kt`) and Flutter (`resolved_product_photo.dart`) mirror it too.
// Do NOT "improve" the shape here without re-deriving all four platforms.
//
// The ONE thing that is deliberately NOT mirrored is iOS's `primaryPhotoURL` (returns a
// `Foundation.URL?`). That is an iOS-LOCAL ADAPTER, not part of the contract — trimming
// there is a URL-CONSTRUCTION requirement (`URL(string: " https://x ")` fails), not a
// rendering decision. RN hands `primaryPhoto` straight to `RemoteImage`, which already
// trims before building its `uri` (`RemoteImage.tsx`).
//
// ── WHY THE RESULT IS THE WHOLE ARRAY (and not a single resolved URL) ──
//
// What this resolution decides is the SOURCE (the selected spec, or the product level).
// "Which one of its photos do we draw" is a DERIVED question, asked after the source is
// settled. If the function returned a single value, the source decision would be buried
// inside that value and lost: every additional consumer (the zoom lightbox today, a
// multi-image gallery tomorrow) would have to RE-DERIVE the degradation ladder for itself
// — and the moment two derivations disagree, the screen shows the spec's photo in the
// sheet and the product's photo in the lightbox.
//
// RN had EXACTLY that shape before this change: `ProductDetailSheetView` and
// `ProductImageZoomOverlay` each carried their own verbatim copy of
// `detail.photos.length > 0 ? detail.photos[0] : undefined`. This module exists to
// collapse both into ONE decision.
//
// That is the same failure mode `resolvedPriceDisplay` exists to make unrepresentable
// (two independent `??` fallbacks silently disagreeing → a fake discount), transposed
// onto photos. Returning the array makes the source decision happen EXACTLY ONCE; every
// consumer reads the same resolved source, and `primaryPhoto` is the single place that
// answers "which one".
//
// ── DEGRADATION LADDER ──
//
//   1. `selectedSpec === null` (selection incomplete / unresolvable)
//        → the product level. Mirrors the view-model's existing stock fallback shape
//        (`const stock = spec ? spec.stock : (detail?.stock ?? 0)`,
//        `react-native-ui/src/DefaultTemplate.ts` — NOT modified by this change) and the
//        sibling price resolver's rung 1.
//   2. `selectedSpec !== null` but its `photos` is empty, OR contains no entry that is
//      non-blank after trimming
//        → the product level (that source cannot draw anything, so it does not stand up
//        as a source at all).
//   3. otherwise
//        → the spec's photos.
//
// ── THE MOST MIRROR-FRAGILE CLAUSE: `primaryPhoto` IS *NOT* `photos[0]` ──
//
// `primaryPhoto` is the FIRST NON-BLANK entry, not the first entry. This is load-bearing,
// and an implementation that uses `photos[0]` will still pass the two obvious tests
// ("spec has no photos" / "spec's first photo is valid") while being wrong:
//
//     spec.photos === ['', 'https://cdn/spec-rose.jpg']
//
//   • rung 2 asks "does this source have anything drawable?" → YES → the source is
//     LOCKED to the spec, no fallback to the product level.
//   • a `photos[0]` display predicate then reads `''` → undefined → the sheet draws the
//     PHOTO_FILL + monogram PLACEHOLDER.
//
// So the user picks a variant that demonstrably HAS a photo and sees a monogram, with no
// product photo to fall back to either — strictly WORSE than before this change. The fix
// is not a bigger comment: "is this source valid" and "what do we draw" MUST BE THE SAME
// PREDICATE. `resolveProductPhoto` therefore spells rung 2 as `primaryPhoto === null` ON
// A CANDIDATE VALUE, so the two are coupled STRUCTURALLY and cannot drift apart.
//
// For the same reason rung 2 MUST NOT be written as a second, independent scan such as
// `selectedSpec.photos.some((s) => s.trim() !== '')`. That is semantically equivalent
// TODAY, but it is a SECOND IMPLEMENTATION of the predicate, and two implementations can
// each be "improved" until they disagree — at which point the failure above returns.
//
// Side effect, deliberate and accepted: the PRODUCT level gets the same predicate, so
// `detail.photos === ['', 'https://…']` now loads that photo instead of drawing a
// placeholder. A strict improvement, observable only on the host-runtime path that loads
// real images (`live === true`); the snapshot path never loads images, so jest baselines
// are untouched.
//
// ── BLANK CHECKS TRIM; RETURNED STRINGS ARE NEVER TRIMMED ──
//
// Per the SDK's JSON-decoder tolerance rules a free-text field may arrive as `''` or
// whitespace-only, so emptiness is judged AFTER trimming. Trimming is for JUDGEMENT ONLY:
// `photos` and `primaryPhoto` hand back the ORIGINAL strings, character for character,
// and `photos` is a VERBATIM copy of the winning source — never filtered, reordered, or
// cleaned up. (Filtering out the blanks here would quietly change indices, which a future
// gallery would then disagree with.) Per-platform trimming differences (JS
// `String.prototype.trim` vs Swift `.whitespacesAndNewlines` vs Kotlin `isBlank`) must
// never grow into cross-platform visual drift.

import type { LBProductDetailState } from 'livebuy-react-native-ui';
import type { LBSpec } from 'livebuy-react-native';

/**
 * The resolved product-photo SOURCE for the product sheets: whichever array of photo
 * strings won — the selected spec's, or the product's — together with the single answer
 * to "which one do we draw".
 *
 * Produced ONLY by {@link resolveProductPhoto} — do not pick a photo out of
 * `detail.photos` / `selectedSpec.photos` at a call site (that is precisely what this
 * type exists to prevent).
 */
export interface ResolvedProductPhoto {
  /**
   * The winning source's photo strings, VERBATIM — same order, same elements, blanks
   * included. Never a mix of the two sources, never filtered or reordered.
   */
  readonly photos: readonly string[];
  /**
   * The photo to draw: the FIRST entry that is non-blank after trimming, returned
   * VERBATIM (untrimmed). `null` when this source has nothing drawable.
   *
   * NOT `photos[0]` — see the file header. This value is also what
   * {@link resolveProductPhoto} uses to decide whether a source is valid at all, so
   * "the ladder picked this source" and "this source can be drawn" are the same
   * statement by construction.
   */
  readonly primaryPhoto: string | null;
  /**
   * Whether there is a photo worth drawing — i.e. whether the caller should load an
   * image instead of the deterministic PHOTO_FILL + monogram placeholder.
   *
   * The sheets MUST read this (or {@link primaryPhoto}) instead of re-deriving
   * "are there photos?" from `detail` / `selectedSpec`, so that WHETHER an image is
   * drawn and WHICH image is drawn always agree.
   */
  readonly hasPhoto: boolean;
}

/**
 * Blank (empty or whitespace-only) — the emptiness test used by {@link makeResolved} and,
 * through it, by the ladder's rung 2. Judgement only; never applied to a returned value.
 */
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Build a resolved source, deriving `primaryPhoto` / `hasPhoto` from the very array being
 * stored.
 *
 * iOS expresses the two derived values as Swift computed properties. TypeScript has no
 * equivalent on a plain interface, and turning this into a class with getters would stop
 * it being plain data — so they are computed DURING resolution (mirroring the sibling
 * `resolvedPriceDisplay.makePair`). WHETHER an image is drawn and WHICH image is drawn are
 * therefore decided in the same pass and can never disagree.
 *
 * NOTE `Array.prototype.find` yields `undefined`, not `null`; it is normalised with
 * `?? null` so the field's type and the `=== null` guard in {@link resolveProductPhoto}
 * stay consistent.
 */
function makeResolved(photos: readonly string[]): ResolvedProductPhoto {
  const primaryPhoto = photos.find((photo) => !isBlank(photo)) ?? null;
  return { photos, primaryPhoto, hasPhoto: primaryPhoto !== null };
}

/**
 * Resolves the sheet's product-photo SOURCE from the product detail and the currently
 * selected spec.
 *
 * @param detail       the product-level detail (`ProductSheetsModel.detail`).
 * @param selectedSpec the resolved variant spec (`LBVariantState.selectedSpec`), or
 *                     `null` when the selection is incomplete / unresolvable.
 * @returns a {@link ResolvedProductPhoto} whose `photos` is a verbatim copy of either
 *          `selectedSpec.photos` or `detail.photos` — never a mix, never filtered.
 *
 * Pure: no I/O, no global state, no mutation. Safe to call per-render.
 */
export function resolveProductPhoto(
  detail: LBProductDetailState,
  selectedSpec: LBSpec | null,
): ResolvedProductPhoto {
  // The product-level source — the single shared fallback target for BOTH degradation
  // rungs, so a fallback can never assemble a result out of two sources.
  const productLevel = makeResolved(detail.photos);

  // Rung 1 — selection incomplete / unresolvable → product level.
  if (selectedSpec === null) return productLevel;

  // Rung 2 — the spec source cannot draw anything → product level.
  //
  // The validity test is deliberately expressed as `primaryPhoto === null` ON THE
  // CANDIDATE ITSELF rather than as a separate `.length` check or `.some(...)` scan. That
  // is what makes "this source is valid" and "this source has something to draw" ONE
  // predicate instead of two that can drift — see the file header's `['', 'url']`
  // walkthrough for what drift costs.
  const specLevel = makeResolved(selectedSpec.photos);
  if (specLevel.primaryPhoto === null) return productLevel;

  // Rung 3 — the spec source wins, verbatim (blanks and ordering preserved).
  return specLevel;
}
