// DetailGlyph — self-drawn "bulleted list in a box" icon (design `Icons.detail`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-clean-mode-exit-icon-fix).
// Design: `design/shared/icons.jsx` `Icons.detail` (24px viewBox, stroke 1.8, fill none for the
// frame + lines; filled dots) — a bordered rounded rect containing 3 rows of (small dot + line):
//   frame  <rect x=3 y=4 width=18 height=16 rx=3/>
//   row 1  <circle cx=7 cy=9  r=1/>  <path d="M10.5 9h7"/>
//   row 2  <circle cx=7 cy=12 r=1/>  <path d="M10.5 12h7"/>
//   row 3  <circle cx=7 cy=15 r=1/>  <path d="M10.5 15h7"/>
//
// Parity: this is the RN counterpart of iOS `Glyphs/DetailGlyph.swift` (SwiftUI `Path.stroke` +
// `Path.fill` layers) and Android `IconGlyphs.kt`'s `DetailGlyph` composable (Compose
// `drawRoundRect`/`drawCircle` + a stroked path for the 3 lines) — all three platforms use the
// SAME coordinate constants, copied verbatim from the design source rather than hand-redrawn.
// RN uses `react-native-svg`'s `Rect`/`Circle`/`Path` primitives directly (mirroring the design's
// own `<rect>`/`<circle>`/`<path>` elements) instead of collapsing everything into one composite
// `<Path>` d string — the frame and dots are true rounded-rect/circle shapes, not line segments.
//
// Replaces the prior placeholder `<Text>{'✕'}</Text>` used at the "exit clean mode" button
// (`PlayerShellView.tsx`) — that was an X glyph standing in for this list icon while the clean
// mode gesture rewrite (`rb-rn-gesture-clean-mode-v2`) shipped the interaction first and deferred
// pixel-accurate icon/position (see that change's design.md Non-Goals).
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Rect, Circle, Path } from 'react-native-svg';

export interface DetailGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The three bullet-row y-coordinates in the design's 24-unit space. */
const ROW_YS = [9, 12, 15] as const;

/** The design's bulleted-list-in-a-box glyph, hand-drawn to match `Icons.detail`.
 *  Default size 24 (design viewBox); the exit-clean-mode button call site uses `size={18}`. */
export function DetailGlyph(props: DetailGlyphProps): ReactElement {
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
      {/* Frame — stroked rounded rect (design `<rect x=3 y=4 width=18 height=16 rx=3/>`). */}
      <Rect x={3} y={4} width={18} height={16} rx={3} />
      {/* 3 rows of (filled bullet dot + stroked line). */}
      {ROW_YS.map((rowY) => (
        <Circle key={rowY} cx={7} cy={rowY} r={1} fill={color} stroke="none" />
      ))}
      {ROW_YS.map((rowY) => (
        <Path key={rowY} d={`M10.5 ${rowY}h7`} />
      ))}
    </Svg>
  );
}
