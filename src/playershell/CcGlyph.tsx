// CcGlyph — self-drawn "closed captions" icon (design `Icons.cc`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-cc-icon-design-align).
// Design: `design/shared/icons.jsx` `Icons.cc` (24px viewBox, stroke 1.8, fill none) — a
// stroked rounded-rect badge containing two "c"-shaped curves:
//   frame   <rect x=3 y=5 width=18 height=14 rx=3/>
//   curves  <path d="M9 11c-.5-.6-1.3-1-2-1-1.4 0-2.5 1.1-2.5 2.5S5.6 15 7 15c.7 0 1.5-.4 2-1
//                    M16 11c-.5-.6-1.3-1-2-1-1.4 0-2.5 1.1-2.5 2.5S12.6 15 14 15c.7 0 1.5-.4 2-1"/>
//
// Parity: same coordinate constants as Android `IconGlyphs.kt`'s `CcGlyph` (`D_CC_CURVES`),
// copied verbatim from the design source rather than hand-redrawn. Unlike `DetailGlyph` (which
// splits the design's `<rect>`/`<circle>`/`<path>` into separate `react-native-svg` primitives),
// the two "c" curves collapse into a SINGLE `<Path>` `d` string — exactly as `icons.jsx` itself
// draws them (one path, two `M` subpaths) — since `react-native-svg`'s `<Path>` parses the full
// SVG path grammar (relative cubic `c` + smooth-cubic `S` commands) natively, unlike Android's
// custom `PathParser`, which needed the curves pre-converted to a named constant.
//
// Replaces the plain-text `'CC'` `Text` glyph previously drawn at the side rail's Subtitle/CC
// pill (`OperationRailView.tsx`'s `PillButton`) — same design-parity motivation as `ShareGlyph`
// (rb-rn-share-icon-design-align, problem 8): the design's `Icons.cc` is a drawn glyph, not a
// two-letter label. `OperationRailView.railGlyphFor(LBSideRailKind.Subtitle)` still returns the
// `'CC'` string (unchanged) for the `railGlyphFor` kind→glyph parity test. `LiveBottomBarView`'s
// separate `chatClosed` CC toggle slot — left out of scope here — is now ALSO drawing this same
// `CcGlyph` (rb-rn-live-bottom-bar-cc-icon-align, same day): that slot is still not reachable
// from the current call site (see `LiveBottomBarView.tsx`'s header comment), but its component-
// level rendering is now visually aligned regardless of whether/when it becomes reachable.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

export interface CcGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's two-"c"-curves-in-a-badge glyph, hand-drawn to match `Icons.cc`. Default size 24
 *  (design viewBox); the side-rail pill call site uses the rail's glyph size. */
export function CcGlyph(props: CcGlyphProps): ReactElement {
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
      {/* Frame — stroked rounded rect (design `<rect x=3 y=5 width=18 height=14 rx=3/>`). */}
      <Rect x={3} y={5} width={18} height={14} rx={3} />
      {/* Two "c" curves, one path (design's own `M...M...` single `<path>`). */}
      <Path d="M9 11c-.5-.6-1.3-1-2-1-1.4 0-2.5 1.1-2.5 2.5S5.6 15 7 15c.7 0 1.5-.4 2-1M16 11c-.5-.6-1.3-1-2-1-1.4 0-2.5 1.1-2.5 2.5S12.6 15 14 15c.7 0 1.5-.4 2-1" />
    </Svg>
  );
}
