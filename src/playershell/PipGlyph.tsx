// PipGlyph — self-drawn frame + inset rect + directional arrow icon (design `Icons.pip`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-player-minimize-pip).
// Design: `design/shared/icons.jsx` `Icons.pip` (24px viewBox) — coordinates copied verbatim
// from iOS `Glyphs/PipGlyph.swift` / Android `IconGlyphs.kt`'s `PipGlyph` composable (both
// already self-draw this glyph; RN was the last of the four platforms still using a bare
// Unicode character):
//
//   outer frame  <rect x=3  y=5  width=18 height=14 rx=2/>   (stroke, fill none, width 1.8)
//   inset rect   <rect x=11 y=11 width=8  height=6  rx=1/>   (filled, no stroke)
//   arrow        <path d="M7 8.5L9.6 11.1M9.6 8.5v2.6h-2.6"/> (stroke, fill none, width 1.8)
//
// The arrow `d` string is copied verbatim from Android `IconGlyphs.kt`'s `D_PIP_ARROW` constant
// (already a standard SVG path string, `v`/`h` relative commands supported natively by
// `react-native-svg`'s `<Path>`) — no coordinate re-derivation needed.
//
// Replaces the prior placeholder `<Text>{'◳'}</Text>` (U+25F3 WHITE SQUARE WITH UPPER RIGHT
// QUADRANT) drawn at the player header's minimize/PiP button (`PlayerHeaderBarView.tsx`'s
// `renderMinimizeButton`) — that bare Unicode character is outside the standard emoji range and
// is not guaranteed to be covered by every system font, risking a tofu (missing-glyph box) render
// on some devices. `react-native-svg`'s `<Rect>`/`<Path>` primitives are used directly (mirroring
// the design's own `<rect>`/`<path>` elements), matching this file's own `DetailGlyph.tsx`
// precedent of mixing basic shapes rather than collapsing everything into one composite `<Path>`
// d string (there is no `addRoundedRect`-equivalent single-path primitive in `react-native-svg`).
// The close-icon glyph (`CLOSE_GLYPH`, `'✕'`) at the SAME button is UNCHANGED by this file — only
// the PiP/minimize state's glyph is affected.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

export interface PipGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's frame + inset-rect + directional-arrow glyph, hand-drawn to match `Icons.pip`.
 *  Default size 24 (design viewBox); the player header minimize button call site uses
 *  `size={20 * theme.fontScale}` (parity with the prior text glyph's `fontSize`).
 *
 *  Ambient stroke props live on `<Svg>` (`fill="none" stroke={color} strokeWidth={1.8}
 *  strokeLinecap="round" strokeLinejoin="round"`) and cascade to the outer frame `<Rect>` and the
 *  arrow `<Path>` by SVG inheritance, exactly like `DetailGlyph.tsx`'s established pattern — only
 *  the inner filled rect overrides `fill`/`stroke` back to a solid, unstroked fill. */
export function PipGlyph(props: PipGlyphProps): ReactElement {
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
      {/* Outer frame — stroked rounded rect (design `<rect x=3 y=5 width=18 height=14 rx=2/>`). */}
      <Rect x={3} y={5} width={18} height={14} rx={2} />
      {/* Directional (minimize) arrow — copied verbatim from Android `D_PIP_ARROW`. */}
      <Path d="M7 8.5L9.6 11.1M9.6 8.5v2.6h-2.6" />
      {/* Inset rect (the "screen" of the PiP frame) — filled, no stroke. */}
      <Rect x={11} y={11} width={8} height={6} rx={1} fill={color} stroke="none" />
    </Svg>
  );
}
