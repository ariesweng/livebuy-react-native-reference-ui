import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - EqualizerGlyph — self-drawn 3-bar equalizer (design「介紹中」mark)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-product-list-introducing-banner).
// RN parity of iOS `Glyphs/EqualizerGlyph.swift` / Android `IconGlyphs.kt`
// `EqualizerGlyph` / Flutter `EqualizerGlyph`. Design
// `design/templates/minimal/live-chrome.jsx` `LBLivePinnedCard` +
// `sdk-components.jsx` `LBPProductRow` introBadge —
//   <rect x3   y14 w3 h7  rx0.5/>
//   <rect x10.5 y9 w3 h12 rx0.5/>
//   <rect x18  y4  w3 h17 rx0.5/>   (24-unit viewBox, fill)
//
// Three bottom-aligned, ascending-height filled bars — the「介紹中」(now-introducing)
// vocabulary shared by the LIVE pinned card tag and the product-list banner. RN has
// NO Canvas / react-native-svg (same constraint as `ShareGlyph.tsx` / `PersonEditGlyph.tsx`),
// so the bars are drawn with deterministic absolutely-positioned filled `View`s, scaled
// by `size / 24` — same design INTENT as the vector-faithful platforms.
//
// Pure presentation: only `size` / `color`.

// (x, y, w, h) per the design svg — all bars bottom at y21, cornerRadius 0.5.
const BARS: readonly (readonly [number, number, number, number])[] = [
  [3, 14, 3, 7],
  [10.5, 9, 3, 12],
  [18, 4, 3, 17],
];
const BAR_RADIUS = 0.5;

/** The design's 3-bar equalizer mark, drawn with Views to match the「介紹中」badge. */
export function EqualizerGlyph(props: { size: number; color: string }): ReactElement {
  const { size, color } = props;
  const s = size / 24;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {BARS.map(([x, y, w, h], i) => (
        <View
          key={`b${i}`}
          style={{
            position: 'absolute',
            left: x * s,
            top: y * s,
            width: w * s,
            height: h * s,
            borderRadius: BAR_RADIUS * s,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}
