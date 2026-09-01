import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - TagGlyph — self-drawn outline price-tag (design tag / Android `TagGlyph`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-tag-warning-glyph).
// RN parity of Android `TagGlyph` (`D_TAG`) / iOS SF `tag`. RN has NO Canvas / react-native-svg,
// so the glyph is drawn with deterministic `View`s — the same View-drawing convention as
// `BagGlyph` / `ChevronForwardGlyph` — NOT a filled `🏷` emoji.
//
// Geometry mirrors Android `IconGlyphs.D_TAG = "M9 6L20 6L20 18L9 18L3 12Z"` (a 5-vertex price-tag
// polygon: rectangle (9,6)-(20,18) with a pointed left corner at (3,12)) + a stroked hole ring at
// (8,12) r=1.3 — coordinates already pixel-verified on Android. Scaled by `s = size / 24`.

const STROKE = 1.8; // design polygon strokeWidth (24-unit space)
const HOLE = { x: 8, y: 12, r: 1.3, stroke: 1.5 };

function arm(
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

export function TagGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 12 } = props;
  const s = size / 24;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {/* Price-tag polygon: (9,6)→(20,6)→(20,18)→(9,18)→(3,12)→(9,6). */}
      {arm(9, 6, 20, 6, s, color, 't1')}
      {arm(20, 6, 20, 18, s, color, 't2')}
      {arm(20, 18, 9, 18, s, color, 't3')}
      {arm(9, 18, 3, 12, s, color, 't4')}
      {arm(3, 12, 9, 6, s, color, 't5')}
      {/* Hole ring at (8,12). */}
      <View
        style={{
          position: 'absolute',
          left: (HOLE.x - HOLE.r) * s,
          top: (HOLE.y - HOLE.r) * s,
          width: HOLE.r * 2 * s,
          height: HOLE.r * 2 * s,
          borderRadius: HOLE.r * s,
          borderWidth: HOLE.stroke * s,
          borderColor: color,
        }}
      />
    </View>
  );
}
