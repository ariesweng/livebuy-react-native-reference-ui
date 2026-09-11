import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - ArrowClockwiseGlyph — self-drawn ~300° circular arc + arrowhead corner
//                                (design `Icons.arrowClockwise`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-errorscreen-icons).
// RN parity of iOS `Glyphs/ArrowClockwiseGlyph.swift` (`addEllipticalArcSegmentBezier`) /
// Android `IconGlyphs.kt`'s `ArrowClockwiseGlyph` / Flutter
// `moments/arrow_clockwise_glyph.dart`. `react-native-reference-ui/src/moments/`
// explicitly forbids react-native-svg / Canvas / Animated (see `ErrorScreenView.tsx`'s
// RENDER DISCIPLINE header), so the circular arc is approximated with short
// straight-line `View` segments sampled around the circle — the same positioned +
// rotated bar technique as `ChevronForwardGlyph` / `WifiSlashGlyph`, extended to a
// many-point polyline so the near-full-circle sweep reads smoothly at glyph scale.
//
// Design: `design/shared/icons.jsx` `Icons.arrowClockwise` (24px viewBox, stroke 2,
// fill none) —
//   arc     M19 12 A7 7 0 1 1 15.5 6.2   (large-arc=1 sweep=1 — the LONG way around,
//                                          center (12,12) r=7, start (19,12) = 3 o'clock)
//   corner  M19 4.5 V9 H14.5              (arrowhead, near the arc's gap)
//
// The end angle is DERIVED (via `atan2`) from the design's literal end point
// (15.5, 6.2), not a hand-typed magic-number degree value — mirrors the iOS
// implementation's derivation so all four platforms sweep to the exact same stop.
//
// Replaces the bare Unicode `'↻'` `Text` leading glyph on the ErrorScreenView retry
// button (`ErrorScreenView.tsx`'s `errorCopyFor(Stream).primaryGlyph`), matching
// iOS / Android / Flutter's hand-drawn arrow-clockwise.
//
// Pure presentation: only `color` / `size` props, no state, no randomness.

const STROKE = 2;
const CENTER = 12;
const RADIUS = 7;
/** Degrees per straight-line arc segment — small enough that the ~300° sweep reads
 *  as a smooth curve at glyph scale without any curve primitive. */
const DEGREES_PER_SEGMENT = 12;

/** The arc's literal end point per icons.jsx (15.5, 6.2) — its angle (measured via
 *  `atan2` in the same screen-space convention as the design's SVG, 0° = 3 o'clock,
 *  increasing clockwise) is DERIVED, not hand-typed, so the sweep always matches the
 *  design's literal end point (mirrors the iOS derivation). Exported for tests. */
export function arrowClockwiseEndDegrees(): number {
  const rawDegrees = (Math.atan2(6.2 - CENTER, 15.5 - CENTER) * 180) / Math.PI;
  return rawDegrees < 270 ? rawDegrees + 360 : rawDegrees;
}

/** A single straight `View` bar from `(x1,y1)` to `(x2,y2)` in the 24-unit space,
 *  scaled by `s` — the same positioned + rotated line technique as
 *  `ChevronForwardGlyph`'s `arm()`. */
function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  s: number,
  color: string,
  key: string,
): ReactElement {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const stroke = STROKE * s;
  return (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: (mx - len / 2) * s,
        top: my * s - stroke / 2,
        width: len * s,
        height: stroke,
        backgroundColor: color,
        borderRadius: stroke / 2,
        transform: [{ rotate: `${deg}deg` }],
      }}
    />
  );
}

/** Build the chained straight-segment approximation of the 0°→{@link arrowClockwiseEndDegrees}
 *  circular arc, stepping by at most {@link DEGREES_PER_SEGMENT} degrees per segment. */
function arcSegments(s: number, color: string): ReactElement[] {
  const endDegrees = arrowClockwiseEndDegrees();
  const segs: ReactElement[] = [];
  let deg = 0;
  let i = 0;
  while (deg < endDegrees) {
    const nextDeg = Math.min(deg + DEGREES_PER_SEGMENT, endDegrees);
    const x1 = CENTER + RADIUS * Math.cos((deg * Math.PI) / 180);
    const y1 = CENTER + RADIUS * Math.sin((deg * Math.PI) / 180);
    const x2 = CENTER + RADIUS * Math.cos((nextDeg * Math.PI) / 180);
    const y2 = CENTER + RADIUS * Math.sin((nextDeg * Math.PI) / 180);
    segs.push(line(x1, y1, x2, y2, s, color, `arc${i}`));
    deg = nextDeg;
    i++;
  }
  return segs;
}

export function ArrowClockwiseGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 14 } = props;
  const s = size / 24;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {arcSegments(s, color)}
      {/* Arrowhead corner — M19 4.5 V9 H14.5 (two arms). */}
      {line(19, 4.5, 19, 9, s, color, 'corner-a')}
      {line(19, 9, 14.5, 9, s, color, 'corner-b')}
    </View>
  );
}
