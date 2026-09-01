import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - ChevronForwardGlyph — self-drawn open double chevron » (design skip glyph)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-fill-stroke-align).
// RN parity of iOS `ChevronForwardGlyph` / Android `MomentGlyphs.ChevronForwardGlyph`. RN has NO
// Canvas / react-native-svg, so the glyph is drawn with deterministic `View`s — the same
// View-drawing convention as `BagGlyph` / `ShopBagGlyph` — NOT a filled `⏩` emoji.
//
// Design: `design/shared/icons.jsx` skip path + `design/templates/minimal/moments.jsx`
//   `LBPSkipIntroButton` — <svg fill="none" stroke strokeWidth="2.2"><path
//   d="M5 4l8 8-8 8M14 4l6 8-6 8"/></svg> = two OPEN `>` chevrons.
//
// Each arm is a positioned + rotated `View` line whose geometry is derived DIRECTLY from the two
// design polyline endpoints (length / atan2 angle / midpoint), scaled by `s = size / 24`:
//   chevron 1: (5,4)→(13,12)→(5,20)   chevron 2: (14,4)→(20,12)→(14,20)

const STROKE = 2.2; // design strokeWidth (24-unit space)

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

export function ChevronForwardGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 13 } = props;
  const s = size / 24;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {arm(5, 4, 13, 12, s, color, 'c1a')}
      {arm(13, 12, 5, 20, s, color, 'c1b')}
      {arm(14, 4, 20, 12, s, color, 'c2a')}
      {arm(20, 12, 14, 20, s, color, 'c2b')}
    </View>
  );
}
