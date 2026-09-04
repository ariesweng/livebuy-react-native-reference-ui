// ShareFillGlyph — self-drawn FILLED "share" icon (design `Icons.shareFill`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-live-more-sheet-share-fill-icon).
// Design: `design/shared/icons.jsx` `Icons.shareFill` (24px viewBox, `stroke="none"`,
//   `fill=currentColor`) — a FILLED variant of `Icons.share`:
//
//   <circle cx="6"  cy="12" r="3" />
//   <circle cx="18" cy="6"  r="3" />
//   <circle cx="18" cy="18" r="3" />
//   <path d="M8.2 10.6l7.8-3.9 1 2-7.8 3.9zM8.2 13.4l7.8 3.9 1-2-7.8-3.9z" />
//
// Distinct from the existing STROKED `ShareGlyph` (`Icons.share`, used by
// `OperationRailView.tsx` / `LiveBottomBarView.tsx` / `ProductListView.tsx` /
// `ProductDetailSheetView.tsx` — all correctly keep the outline glyph, that IS their design
// intent): this filled variant is what the「更多」(more) collapsed menu's「分享」cell uses
// (`LiveMoreMenuView.tsx`, design `screens.jsx` `live_more` block — `<Icons.shareFill
// size={20} .../>`). Parity with iOS `Glyphs/ShareFillGlyph.swift` (same coordinate
// constants, same `Path.move`/`addLine`/`closeSubpath` polygon tracing).
//
// `react-native-svg`'s `<Path>` parses the design's `d` string verbatim (two `M` subpaths,
// each a closed 4-point filled polygon — NOT simple straight lines like the stroked
// `ShareGlyph`'s connector bars) — same technique this directory's `CcGlyph.tsx` already
// established for `Icons.cc`'s cubic-Bézier curves. The three filled nodes use `<Circle>`
// (already used by `DetailGlyph.tsx` in this same directory for its filled dot markers)
// rather than folding them into the `<Path>`, mirroring the design source's own three
// separate `<circle>` elements.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface ShareFillGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's filled three-node share glyph, hand-drawn to match `Icons.shareFill`.
 *  Default size 24 (design viewBox); the「更多」menu call site uses `ICON_GLYPH_SIZE` (20). */
export function ShareFillGlyph(props: ShareFillGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      {/* Three r=3 filled nodes (design's three separate `<circle>` elements). */}
      <Circle cx={6} cy={12} r={3} />
      <Circle cx={18} cy={6} r={3} />
      <Circle cx={18} cy={18} r={3} />
      {/* Two filled parallelogram connector bars, one path (design's own `M...zM...z`
          single `<path>`, two closed 4-point subpaths). */}
      <Path d="M8.2 10.6l7.8-3.9 1 2-7.8 3.9zM8.2 13.4l7.8 3.9 1-2-7.8-3.9z" />
    </Svg>
  );
}
