import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - ArrowUpCircleGlyph — self-drawn outline up-arrow-in-circle (design `Icons.arrowUpCircle`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-errorscreen-icons).
// RN parity of iOS `Glyphs/ArrowUpCircleGlyph.swift` / Android `IconGlyphs.kt`'s
// `ArrowUpCircleGlyph` / Flutter `moments/arrow_up_circle_glyph.dart`.
// `react-native-reference-ui/src/moments/` explicitly forbids react-native-svg /
// Canvas / Animated (see `ErrorScreenView.tsx`'s RENDER DISCIPLINE header), so the
// circle is a bordered round `View` (the same technique as `ShareGlyph`'s node
// circles) and the arrow is straight positioned + rotated `View` lines (the
// `ChevronForwardGlyph` convention) — NOT a filled `⬆` emoji.
//
// Design: `design/shared/icons.jsx` `Icons.arrowUpCircle` (24px viewBox, stroke 2,
// fill none) —
//   circle  <circle cx=12 cy=12 r=9/>
//   arrow   M12 16V8  M8 12L12 8L16 12   (vertical shaft + up-chevron head)
//
// Replaces the bare Unicode `'⬆'` `Text` glyph at the outdated-build error icon
// badge (`ErrorScreenView.tsx`'s `errorCopyFor(Outdated)`), matching iOS / Android /
// Flutter's hand-drawn arrow-up-circle.
//
// Pure presentation: only `color` / `size` props, no state.

const STROKE = 2;
const RADIUS = 9;

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

export function ArrowUpCircleGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 26 } = props;
  const s = size / 24;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {/* Outline circle — bordered round View (transparent fill, matches the
          design's `stroke`-only semantics). */}
      <View
        style={{
          position: 'absolute',
          left: (12 - RADIUS) * s,
          top: (12 - RADIUS) * s,
          width: RADIUS * 2 * s,
          height: RADIUS * 2 * s,
          borderRadius: RADIUS * s,
          borderWidth: STROKE * s,
          borderColor: color,
        }}
      />
      {/* Shaft — M12 16 V8. */}
      {line(12, 16, 12, 8, s, color, 'shaft')}
      {/* Chevron head — M8 12 L12 8 L16 12 (two arms). */}
      {line(8, 12, 12, 8, s, color, 'head-a')}
      {line(12, 8, 16, 12, s, color, 'head-b')}
    </View>
  );
}
