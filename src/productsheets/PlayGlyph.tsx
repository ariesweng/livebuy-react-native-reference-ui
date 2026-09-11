// PlayGlyph — self-drawn FILLED "play" icon (design `icons.jsx` `play`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-productlist-play-glyph).
// Design: `design/shared/icons.jsx` `Icons.play` (24px viewBox, filled triangle,
//   `fill=currentColor`, `stroke="none"`):
//
//   <path d="M8 5v14l11-7z" />
//
// Replaces the THREE bare-Unicode `▶` characters previously embedded in a `Text` string
// across `ProductListView.tsx` (`VodPlayOverlay` / the「看講解」pill / `GridPlayButton`) —
// the known anti-pattern already fixed on iOS (SF Symbol `play.fill`, `ProductRowView.swift`),
// Android (vector `PlayGlyph`, `IconGlyphs.kt`'s `D_PLAY = "M8 5v14l11-7z"`, same path data),
// and Flutter (`Icon(Icons.play_arrow, ...)`, `product_row.dart`). RN was the last of the four
// platforms still on the bare-character anti-pattern.
//
// Parity with the same-directory `ShareFillGlyph.tsx` in `playershell/` (a filled, not stroked,
// `react-native-svg` glyph): single `<Path>`, `fill={color}`, `stroke="none"`.
//
// Pure presentation: only `color` / `size` props, no state. Co-located in `productsheets/`
// (not `playershell/`) because its only consumer, `ProductListView.tsx`, lives here — mirrors
// this package's existing single-consumer glyph co-location convention (e.g. `feedwin/TagGlyph.tsx`).

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface PlayGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's filled play-triangle glyph, hand-drawn to match `icons.jsx`'s `play` (fill
 *  variant) — same path data as Android `IconGlyphs.kt`'s `D_PLAY`. Default size 24 (design
 *  viewBox); each `ProductListView.tsx` call site passes its own original size. */
export function PlayGlyph(props: PlayGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M8 5v14l11-7z" />
    </Svg>
  );
}
