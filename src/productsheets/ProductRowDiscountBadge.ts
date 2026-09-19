// ProductRowDiscountBadge — `.row` price-block discount-percentage calculation (RN).
//
// rb-rn-product-row-layout-and-price-color (design R45), parity iOS
// `ProductRowDiscountBadge.percent(price:originalPrice:)` (`ios/Sources/LivebuyReferenceUI/
// ProductSheets/ProductRowDiscountBadge.swift`) / Android `ProductRowDiscountBadge.percent`
// (sibling changes, same design). Zero-dependency pure function (no react / react-native
// import) — mirrors this module's existing pure-function siblings (`ProductStatusBadge
// .resolve`, `ProductRowNameTag.resolve`), independently unit-testable without a component
// render.
//
// Reads `LBProduct`'s raw numeric `price` / `originalPrice` fields — these are STRINGS on RN
// (`price: string`, `originalPrice: string | null`; see `react-native/src/LivebuySDK.ts` —
// the SDK keeps them as strings for cross-platform numeric-precision parity, per CLAUDE.md's
// `LBProduct.id` invariant precedent), NOT the pre-formatted `priceShow` / `originalPriceShow`
// display strings (locale-formatted text like `"NT$590"`, not parseable as a number). Callers
// pass the raw fields; this function does the `Number(...)` conversion + NaN/blank defense
// itself, so no call site needs to duplicate that guard.
//
// Formula: `floor((originalPrice - price) / originalPrice * 100)` — verified against design
// source `design/templates/minimal/sdk-components.jsx`'s own hand-authored demo data
// (`originalPrice: 890, price: 590` → the design's literal `off: 33`). `floor(33.708...) ===
// 33` matches; `round(33.708...) === 34` does NOT — this is the deciding evidence for `floor`
// over `round` (the design source has no explicit rounding-rule comment; the demo data is the
// only available ground truth).
export const ProductRowDiscountBadge = {
  /**
   * `null` whenever there is nothing meaningful to show: `originalPrice` missing / not a
   * finite number, `price` not a finite number, `originalPrice` not actually higher than
   * `price` (mirrors the pre-existing original-price-strikethrough guard's intent — the
   * caller is expected to already gate on the `originalPriceShow` non-empty/non-equal check
   * before calling this too, but this function re-derives its own defensive `null` rather
   * than trusting the caller), a non-positive `originalPrice` (avoids a divide-by-zero), or a
   * computed percentage that floors down to `0` (e.g. `originalPrice: 101, price: 100` →
   * `0.99...%` → `floor` → `0` — a real, if rare, floor-rounding boundary, not an error —
   * showing a misleading "0%" badge would be worse than showing nothing). Pure / testable.
   */
  percent(price: string, originalPrice: string | null): number | null {
    if (originalPrice == null) return null;
    const priceNum = Number(price);
    const originalPriceNum = Number(originalPrice);
    if (!Number.isFinite(priceNum) || !Number.isFinite(originalPriceNum)) return null;
    if (originalPriceNum <= priceNum || originalPriceNum <= 0) return null;
    const off = Math.floor(((originalPriceNum - priceNum) / originalPriceNum) * 100);
    return off > 0 ? off : null;
  },
} as const;
