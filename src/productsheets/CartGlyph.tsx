import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - CartGlyph — self-drawn outline shopping-cart glyph (design / Android `CartGlyph`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-cart-bell-glyph).
// RN parity of iOS SF Symbol `cart` / Android self-drawn `CartGlyph`. RN has NO Canvas /
// react-native-svg, so the glyph is drawn with deterministic `View`s — the same View-drawing
// convention as `BagGlyph` / `TagGlyph` / `WarningGlyph` — NOT a filled `🛒` emoji.
//
// Geometry mirrors `design/shared/icons.jsx` `cart: "M3 5h2l2 11h11l2-8H6"` (a 5-segment
// polyline: cart frame + handle) + two FILLED wheel circles (`fill={color} stroke="none"` in the
// design — NOT a stroked hole ring like `TagGlyph`): `cx=9,cy=20,r=1.5` and `cx=17,cy=20,r=1.5`.
// Scaled by `s = size / 24`. `bell` is explicitly OUT of scope for this file / change (see
// `openspec/changes/rb-rn-cart-bell-glyph/design.md`) — the design `bell` path contains a true
// arc + cubic Bézier curves the `arm()` polyline technique cannot faithfully render.

const STROKE = 1.8; // design polyline strokeWidth (24-unit space)
const WHEEL_LEFT = { x: 9, y: 20, r: 1.5 };
const WHEEL_RIGHT = { x: 17, y: 20, r: 1.5 };

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

/** A filled (solid) wheel dot — the design's `fill={color} stroke="none"` circle. */
function wheel(cx: number, cy: number, r: number, s: number, color: string, key: string): ReactElement {
  return (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: (cx - r) * s,
        top: (cy - r) * s,
        width: r * 2 * s,
        height: r * 2 * s,
        borderRadius: r * s,
        backgroundColor: color,
      }}
    />
  );
}

export function CartGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 16 } = props;
  const s = size / 24;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {/* Cart frame + handle polyline: (3,5)→(5,5)→(7,16)→(18,16)→(20,8)→(6,8). */}
      {arm(3, 5, 5, 5, s, color, 'c1')}
      {arm(5, 5, 7, 16, s, color, 'c2')}
      {arm(7, 16, 18, 16, s, color, 'c3')}
      {arm(18, 16, 20, 8, s, color, 'c4')}
      {arm(20, 8, 6, 8, s, color, 'c5')}
      {/* Two filled wheel dots. */}
      {wheel(WHEEL_LEFT.x, WHEEL_LEFT.y, WHEEL_LEFT.r, s, color, 'wl')}
      {wheel(WHEEL_RIGHT.x, WHEEL_RIGHT.y, WHEEL_RIGHT.r, s, color, 'wr')}
    </View>
  );
}
