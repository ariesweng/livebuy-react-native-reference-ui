import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

// StorefrontFillGlyph — filled storefront, the bid-won popup's merchant-logo fallback
// (rb-rn-flash-sale-bid).
//
// Design: `design/shared/icons.jsx` `Icons.storefrontFill` (24 viewBox, filled, no stroke), called
// by `moments.jsx:LBBidWonModal` at size 30 in the accent color. Same shape as iOS
// `Glyphs/StorefrontFillGlyph.swift` and Android `IconGlyphs.kt` `StorefrontFillGlyph`. Path data
// copied verbatim (lines + cubic béziers incl. relative `c` / smooth `S`, no arc —
// `icon-authoring.md` rule 1; react-native-svg parses both natively).

export interface StorefrontFillGlyphProps {
  readonly color: string;
  readonly size?: number;
}

export function StorefrontFillGlyph(props: StorefrontFillGlyphProps): ReactElement {
  const { color, size = 30 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M4 3h16l2 5c0 1.4-1.1 2.5-2.5 2.5S17 9.4 17 8c0 1.4-1.1 2.5-2.5 2.5S12 9.4 12 8c0 1.4-1.1 2.5-2.5 2.5S7 9.4 7 8c0 1.4-1.1 2.5-2.5 2.5S2 9.4 2 8l2-5z" />
      <Path d="M4.5 12h15v9.5h-5.5v-5.5h-4v5.5h-5.5z" />
    </Svg>
  );
}
