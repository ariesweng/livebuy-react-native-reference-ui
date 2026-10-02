import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

// SearchGlyph — self-drawn magnifying-glass glyph for the product list sheet's search button
// (collapsed header) and the search pill's leading glyph (expanded header) in `ProductListView.tsx`.
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-product-list-search-icon-parity).
// Design `design/shared/icons.jsx`:
//   search: (p) => <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></Icon>
// — a 24-unit viewBox, stroke width 1.8, round cap/join (the shared `Icon` wrapper's defaults).
// Parity: Android `IconGlyphs.kt` `SearchGlyph` (same lens circle + `D_SEARCH_HANDLE = "M16 16l4 4"`),
// Flutter `search_glyph.dart` `SearchGlyph`, iOS SF Symbol `magnifyingglass`.
//
// Replaces the literal emoji `Text` glyph (`'🔍'`) previously drawn at both call sites: an emoji is
// rendered by the platform's colour-emoji font, so it ignored the theme colour and looked nothing
// like the other three platforms.
//
// Pure presentation: only `color` / `size` props, no state. Same `react-native-svg` stroke
// convention as `BellGlyph.tsx` / `PersonGlyph.tsx` (fill="none", stroke=color, strokeWidth=1.8,
// round cap/join, 24-viewBox).

const D_SEARCH_HANDLE = 'M16 16l4 4';

export interface SearchGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design `Icons.search` magnifying glass (lens circle + diagonal handle). Default size 24
 *  (design viewBox); call sites pass the size iOS / Android use at that call site. */
export function SearchGlyph(props: SearchGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={11} cy={11} r={6.5} />
      <Path d={D_SEARCH_HANDLE} />
    </Svg>
  );
}
