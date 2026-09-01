import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - WarningGlyph — self-drawn outline warning triangle (design / Android `WarningGlyph`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-tag-warning-glyph).
// RN parity of Android `WarningGlyph` / iOS SF `exclamationmark.triangle`. RN has NO Canvas /
// react-native-svg, so the glyph is drawn with deterministic `View`s — the same View-drawing
// convention as `BagGlyph` / `ChevronForwardGlyph` — NOT a filled `⚠` emoji.
//
// Geometry mirrors Android `IconGlyphs`: `D_WARN_TRI = "M12 3.5L21.5 20.5L2.5 20.5Z"` (hollow
// triangle) + `D_WARN_BAR = "M12 9.5v5"` (vertical exclamation bar) + a filled dot at (12,17.5)
// r=1.1 — coordinates already pixel-verified on Android. Scaled by `s = size / 24`.

const STROKE = 2; // design strokeWidth (24-unit space)
const DOT = { x: 12, y: 17.5, r: 1.1 };

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

export function WarningGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 15 } = props;
  const s = size / 24;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {/* Hollow triangle: (12,3.5)→(21.5,20.5)→(2.5,20.5)→(12,3.5). */}
      {arm(12, 3.5, 21.5, 20.5, s, color, 'w1')}
      {arm(21.5, 20.5, 2.5, 20.5, s, color, 'w2')}
      {arm(2.5, 20.5, 12, 3.5, s, color, 'w3')}
      {/* Exclamation bar: (12,9.5)→(12,14.5). */}
      {arm(12, 9.5, 12, 14.5, s, color, 'wbar')}
      {/* Exclamation dot at (12,17.5). */}
      <View
        style={{
          position: 'absolute',
          left: (DOT.x - DOT.r) * s,
          top: (DOT.y - DOT.r) * s,
          width: DOT.r * 2 * s,
          height: DOT.r * 2 * s,
          borderRadius: DOT.r * s,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
