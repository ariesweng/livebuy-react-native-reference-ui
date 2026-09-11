import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - WifiSlashGlyph — self-drawn struck-through wifi glyph (design `Icons.wifiSlash`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-errorscreen-icons).
// RN parity of iOS `Glyphs/WifiSlashGlyph.swift` (`SwiftUI Path.addQuadCurve`) /
// Android `IconGlyphs.kt`'s `WifiSlashGlyph` / Flutter
// `moments/wifi_slash_glyph.dart` (`CustomPainter` `Path.quadraticBezierTo`).
// `react-native-reference-ui/src/moments/` explicitly forbids react-native-svg /
// Canvas / Animated (see `ErrorScreenView.tsx`'s RENDER DISCIPLINE header), so the
// two quadratic wifi arcs are approximated with short straight-line `View` segments
// sampled along the curve — the same positioned + rotated bar technique as
// `ChevronForwardGlyph`'s `arm()`, extended from a single chord to a multi-point
// polyline so the shallow curve reads smoothly at glyph scale.
//
// Design: `design/shared/icons.jsx` `Icons.wifiSlash` (24px viewBox) —
//   arc 1 (near)  M8.5 15.3 Q12 12 15.5 15.3     (stroke 1.8, quadratic control (12,12))
//   arc 2 (far)   M5 11.3 Q12 5.5 19 11.3         (stroke 1.8, quadratic control (12,5.5))
//   dot           <circle cx=12 cy=19 r=1.3/>     (filled)
//   strike        M4 4 L20 20                     (stroke 2.2 — thicker override, drawn
//                                                   LAST so it composites on top, matching
//                                                   icons.jsx's document order)
//
// Replaces the bare Unicode `'⚠'` `Text` glyph at the stream-error icon badge
// (`ErrorScreenView.tsx`'s `errorCopyFor(Stream)`), matching iOS / Android / Flutter's
// hand-drawn wifi-slash.
//
// Pure presentation: only `color` / `size` props, no state, no randomness.

const ARC_STROKE = 1.8;
const STRIKE_STROKE = 2.2;
/** Straight-segment samples per quadratic arc — enough to read as a smooth curve at
 *  glyph scale without any curve primitive. */
const ARC_SEGMENTS = 8;

type Point = readonly [number, number];

/** One point on the quadratic Bezier `p0 → control → p1` at parameter `t` (0..1). */
function quadPoint(p0: Point, control: Point, p1: Point, t: number): Point {
  const mt = 1 - t;
  const x = mt * mt * p0[0] + 2 * mt * t * control[0] + t * t * p1[0];
  const y = mt * mt * p0[1] + 2 * mt * t * control[1] + t * t * p1[1];
  return [x, y];
}

/** A single straight `View` bar from `(x1,y1)` to `(x2,y2)` in the 24-unit space,
 *  scaled by `s` — the same positioned + rotated line technique as
 *  `ChevronForwardGlyph`'s `arm()`. */
function segment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number,
  s: number,
  color: string,
  key: string,
): ReactElement {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const stroke = strokeWidth * s;
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

/** Render one quadratic arc as {@link ARC_SEGMENTS} chained straight segments. */
function quadArc(
  p0: Point,
  control: Point,
  p1: Point,
  s: number,
  color: string,
  keyPrefix: string,
): ReactElement[] {
  const points: Point[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    points.push(quadPoint(p0, control, p1, i / ARC_SEGMENTS));
  }
  const segs: ReactElement[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[i + 1]!;
    segs.push(segment(x1, y1, x2, y2, ARC_STROKE, s, color, `${keyPrefix}${i}`));
  }
  return segs;
}

export function WifiSlashGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 26 } = props;
  const s = size / 24;
  const dotR = 1.3;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {quadArc([8.5, 15.3], [12, 12], [15.5, 15.3], s, color, 'near')}
      {quadArc([5, 11.3], [12, 5.5], [19, 11.3], s, color, 'far')}
      {/* Signal dot — filled. */}
      <View
        style={{
          position: 'absolute',
          left: (12 - dotR) * s,
          top: (19 - dotR) * s,
          width: dotR * 2 * s,
          height: dotR * 2 * s,
          borderRadius: dotR * s,
          backgroundColor: color,
        }}
      />
      {/* Strike-through diagonal — thicker stroke, drawn last (on top). */}
      {segment(4, 4, 20, 20, STRIKE_STROKE, s, color, 'strike')}
    </View>
  );
}
