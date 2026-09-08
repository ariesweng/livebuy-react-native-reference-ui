// PeopleGlyph — self-drawn "two-person" stroke-outline icon for the player-header viewer-count
// badge (`PlayerHeaderBarView.tsx`'s `renderViewerBadge`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-viewer-count-badge-vector-glyph).
// Parity: Android `IconGlyphs.kt`'s `PeopleGlyph` composable (`PlayerHeaderBar.kt:786` call site,
// `PeopleGlyph(color = onGlassDim, modifier = Modifier.size(12.dp))`) — two stroke circles
// (back head r=2.6 @ (8,8), front head r=3 @ (14.5,9), both stroke width 1.8) plus two OPEN
// stroke body-arc paths (round cap/join), copied VERBATIM from Android's own constants:
//
//   D_PEOPLE_BACK  = "M1.8 18C1.8 14.6 3.8 13.3 6.2 13.3C7.6 13.3 8.8 13.8 9.7 14.7"
//   D_PEOPLE_FRONT = "M8.2 19C8.2 14.9 11 13.4 14 13.4C17 13.4 19.8 14.9 19.8 19"
//
// NOT the design `icons.jsx` `Icons.people` FILLED variant — Android deliberately chose this
// stroke-outline rendering over the design's literal fill glyph (see `IconGlyphs.kt`), and this
// glyph follows that already-verified choice rather than re-deriving from the design source.
// Same `react-native-svg` stroke convention as `CcGlyph.tsx` (fill="none", stroke=color,
// strokeWidth=1.8, round cap/join, 24-viewBox) — copied structure, not reinvented.
//
// Replaces the literal emoji `Text` glyph (`'\u{1F465}'`) previously drawn at
// `PlayerHeaderBarView.tsx`'s `renderViewerBadge` (rb-rn-viewer-count-badge-vector-glyph).
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface PeopleGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design-adjacent (Android-verified) two-person stroke-outline glyph. Default size 24
 *  (design viewBox); the viewer-badge call site scales it to the prior emoji's effective size. */
export function PeopleGlyph(props: PeopleGlyphProps): ReactElement {
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
      <Circle cx={8} cy={8} r={2.6} />
      <Circle cx={14.5} cy={9} r={3} />
      <Path d="M1.8 18C1.8 14.6 3.8 13.3 6.2 13.3C7.6 13.3 8.8 13.8 9.7 14.7" />
      <Path d="M8.2 19C8.2 14.9 11 13.4 14 13.4C17 13.4 19.8 14.9 19.8 19" />
    </Svg>
  );
}
