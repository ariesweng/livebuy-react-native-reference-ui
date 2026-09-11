// LockGlyph — self-drawn closed/filled padlock (design `Icons.lock`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-authgate-lock-glyph).
// Design: `design/shared/icons.jsx` `Icons.lock` (24px viewBox, `stroke="none"`,
//   `fill=currentColor` on the outer wrapper, per-shape overrides below):
//
//   shackle    <path d="M6.48 8.64A5.52 5.28 0 0 1 17.52 8.64" fill="none" stroke strokeWidth="2.64" />
//   drop lines <path d="M6.48 8.64L6.48 11.04M17.52 8.64L17.52 11.04" stroke strokeWidth="2.64" />
//   body       <rect x="4.8" y="9.6" width="14.4" height="11.52" rx="2.64" />  (filled)
//
// A CLOSED padlock (shackle connects to the body) — parity with iOS
// `Glyphs/LockGlyph.swift` (SwiftUI `Path.stroke` + `Path.fill` layers, manually
// expands the elliptical arc into 2 cubic-bezier quarter segments — an iOS-14
// `Path` API workaround), Android `IconGlyphs.kt LockGlyph` (Compose `drawArc` +
// 2 `drawLine` + `drawRoundRect`), and Flutter `gapsurfaces/lock_glyph.dart`
// (`CustomPainter`, native `Path.addArc`) — all four share the same design
// coordinates. Unlike iOS/Android/Flutter, `react-native-svg`'s `<Path>` parses
// the SVG `A` (elliptical arc) command natively, so the shackle is copied
// verbatim from the design's own `d` string rather than hand-expanded into
// bezier segments — zero transcription error.
//
// Replaces the bare emoji `<Text>{'🔒'}</Text>` previously drawn at
// `AuthGateModalView.tsx`'s `LockBadge` — RN `Text`'s `color` style does not
// apply to emoji (a system color bitmap glyph), so the lock color was hard-locked
// by the system emoji font and could not follow `ON_ACCENT_TEXT` / `theme.accent`.
// RN was the last of the four platforms still using a bare emoji here.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export interface LockGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** Shackle — half-ellipse arc (design `Icons.lock`, SVG `A` command copied verbatim). */
const SHACKLE_ARC_D = 'M6.48 8.64A5.52 5.28 0 0 1 17.52 8.64';

/** The 2 drop lines bridging the shackle ends down into the body (keeps the lock CLOSED). */
const DROP_LINES_D = 'M6.48 8.64L6.48 11.04M17.52 8.64L17.52 11.04';

/** The design's closed padlock glyph, hand-drawn to match `Icons.lock`. Default size 24
 *  (design viewBox); the `AuthGateModalView` `LockBadge` call site uses
 *  `size={24 * theme.fontScale}` (parity with iOS's `LockGlyph(size: 24 * theme.fontScale, ...)`).
 *
 *  `strokeWidth`/`strokeLinecap`/`strokeLinejoin` are set once on the outer `<Svg>` and inherited
 *  by both stroked `<Path>` elements (SVG presentation-attribute cascade) — the same convention as
 *  `productsheets/CartFillGlyph.tsx` — rather than repeated on each `<Path>`; only `fill`/`stroke`
 *  are overridden per-element (the shackle/drop-line paths flip `fill` to `"none"`, the body `Rect`
 *  inherits the `Svg`-level filled `stroke="none"` with no override needed). */
export function LockGlyph(props: LockGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      stroke="none"
      strokeWidth={2.64}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Shackle — stroked half-ellipse arc, no fill (design `fill="none"`). */}
      <Path d={SHACKLE_ARC_D} fill="none" stroke={color} />
      {/* Drop lines — stroked, connect the shackle ends into the body, no fill. */}
      <Path d={DROP_LINES_D} fill="none" stroke={color} />
      {/* Body — filled rounded rect, no stroke (inherits Svg-level fill/stroke:none). */}
      <Rect x={4.8} y={9.6} width={14.4} height={11.52} rx={2.64} />
    </Svg>
  );
}
