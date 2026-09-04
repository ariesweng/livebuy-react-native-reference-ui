// PersonGlyph — self-drawn filled "person" silhouette icon for the family-5 widget card's
// VIEWER BADGE.
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-carousel-card-pin-viewers-duration-removal).
// Design: `design/shared/icons.jsx` `Icons.person` (24px viewBox, `stroke="none"`,
//   `fill=currentColor`) — a FILLED head + shoulders silhouette:
//
//   <circle cx="12" cy="8" r="3.4" />
//   <path d="M5.2 19C5.2 14.4 8.4 12.8 12 12.8C15.6 12.8 18.8 14.4 18.8 19Z" />
//
// design ledger `claude-design-sync.md` R33: upstream switched `Icons.person` / `Icons.people`
// from an outlined (stroked) glyph to this filled silhouette as part of the same sync that
// added the viewer-count badge (`LBPCarouselCard`'s `item.viewers` block, which is this
// glyph's only call site — `<Icons.person size={9} color="#fff" />`). Only `person` is ported
// here (`people`, the two-figure variant, has no reference-ui call site today).
//
// `react-native-svg`'s `<Circle>`/`<Path>` mirror the design's own `<circle>`/`<path>` — same
// technique this directory's sibling glyphs (`ShareFillGlyph.tsx`, `DetailGlyph.tsx`) already
// established.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface PersonGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's filled person silhouette, hand-drawn to match `Icons.person`. Default size 24
 *  (design viewBox); the viewer-badge call site uses the design's own `size={9}`. */
export function PersonGlyph(props: PersonGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Circle cx={12} cy={8} r={3.4} />
      <Path d="M5.2 19C5.2 14.4 8.4 12.8 12 12.8C15.6 12.8 18.8 14.4 18.8 19Z" />
    </Svg>
  );
}
