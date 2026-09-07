// CartFillGlyph — self-drawn FILLED "shopping cart" icon (design `Icons.cartFill`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-bag-cart-batch).
// Design: `design/shared/icons.jsx` `Icons.cartFill` (24px viewBox) — a mixed fill/stroke glyph:
//
//   <path d="M6 8L20 8L18 16L7 16Z" stroke="none" />                     basket body (filled trapezoid)
//   <path d="M3 5h2l1.6 3" fill="none" strokeWidth="2" />                 hook handle (stroked open polyline)
//   <circle cx="9"  cy="20" r="1.6" stroke="none" />                      left wheel (filled)
//   <circle cx="17" cy="20" r="1.6" stroke="none" />                      right wheel (filled)
//
// Replaces `ShopBagGlyph` (retired, deleted — `productsheets/ShopBagGlyph.tsx`) at the cart
// summary footer (`ProductListView.tsx`'s `CartCTAFooter`,「查看購物車」CTA): the design's
// 2026-08-25 revision moved this slot from the bag silhouette (`shopBag`) to the shopping-basket
// silhouette (`cartFill`). iOS (`CartFillGlyph.swift`) and Android (`IconGlyphs.kt`'s
// `CartFillGlyph`, with `ShopBagGlyph` fully removed) already made this switch; Flutter followed
// the same day (`rb-flutter-icon-parity-cart-cta-retirement`) — RN is the last of the four
// platforms to catch up.
//
// Distinct from the existing STROKED `CartGlyph` in this same directory (outline cart, aligned
// to design `Icons.cart`, used by `ProductListView.tsx` / `ProductDetailSheetView.tsx` at an
// unrelated call site) — the two files are independent and do not interact.
//
// Technique: follows this package's established "`<Svg>` sets the default stroke look,
// individual elements override `fill`/`stroke` only where the design differs" convention (see
// `DetailGlyph.tsx`'s stroked frame + filled dot markers), rather than repeating a full
// fill/stroke/strokeWidth set on every element. `<Svg>` sets `fill={color} stroke={color}
// strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"` (the style the hook handle
// actually needs); the basket body `<Path stroke="none">` and both wheel `<Circle stroke="none">`
// elements turn stroke back off (inheriting `fill`); the hook handle `<Path fill="none">` turns
// fill back off (inheriting `stroke`/`strokeWidth`/`strokeLinecap`/`strokeLinejoin`). The design
// source's own `d` string for the handle doesn't specify `strokeLinecap`/`strokeLinejoin`, but
// `round`/`round` is added here to match the existing iOS `CartFillGlyph.swift`
// (`StrokeStyle(lineCap: .round, lineJoin: .round)`) and the Android/Flutter ports for
// cross-platform visual consistency.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export interface CartFillGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's filled shopping-basket-with-hook-handle glyph, hand-drawn to match
 *  `Icons.cartFill`. Default size 20 (the retired `ShopBagGlyph`'s prior default, unchanged —
 *  the cart-summary-footer call site passes an explicit size regardless). */
export function CartFillGlyph(props: CartFillGlyphProps): ReactElement {
  const { color, size = 20 } = props;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Basket body — filled trapezoid, no stroke (design `stroke="none"`). */}
      <Path d="M6 8L20 8L18 16L7 16Z" stroke="none" />
      {/* Hook handle — stroked open polyline, no fill (design `fill="none" strokeWidth="2"`). */}
      <Path d="M3 5h2l1.6 3" fill="none" />
      {/* Two filled wheels, no stroke (design `stroke="none"`). */}
      <Circle cx={9} cy={20} r={1.6} stroke="none" />
      <Circle cx={17} cy={20} r={1.6} stroke="none" />
    </Svg>
  );
}
