import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - PersonEditGlyph — self-drawn person-edit (head + pencil badge) nickname icon
//
// Spec: `reference-ui-rendering/spec.md` (rb-align-nickname-icon-person-edit).
// RN parity of iOS `Glyphs/PersonEditGlyph.swift` / Android `PersonEditGlyph.kt` / Flutter
// `person_edit_glyph.dart`. Design `design/templates/minimal/live-chrome.jsx` `LBLiveBottomBar`
// 設定暱稱 button (≈224): head circle + shoulders + a pencil badge (bottom-right).
//
// RN has NO Canvas / react-native-svg (same constraint as `ShareGlyph.tsx`), so the composite is
// drawn with deterministic `View`s — a bordered head circle, a bordered shoulders arch (clipped
// to the box), and a rotated bordered rect for the pencil badge — NOT the prior `👤` emoji Text.
// Same design INTENT (person + edit pencil) as the vector-faithful platforms.
//
// Geometry mirrors the 24-unit design space, scaled by `size/24`.

const STROKE = 1.8;

export function PersonEditGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 18 } = props;
  const s = size / 24;
  const sw = STROKE * s;

  // Head: stroked circle ~ center (9.5,8) r=3.2.
  const headR = 3.2 * s;
  const headCx = 9.5 * s;
  const headCy = 8 * s;

  // Shoulders: a bordered arch under the head (top rounded, sides down, bottom clipped by the box).
  const shW = 12 * s;
  const shLeft = 3.5 * s;
  const shTop = 15 * s;

  // Pencil badge: a rotated bordered rect at the bottom-right (the edit affordance).
  const penW = 9 * s;
  const penH = 3.6 * s;
  const penCx = 17.5 * s;
  const penCy = 16.5 * s;

  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }} pointerEvents="none">
      {/* Shoulders arch (drawn first, under the head). */}
      <View
        style={{
          position: 'absolute',
          left: shLeft,
          top: shTop,
          width: shW,
          height: shW,
          borderTopLeftRadius: shW / 2,
          borderTopRightRadius: shW / 2,
          borderTopWidth: sw,
          borderLeftWidth: sw,
          borderRightWidth: sw,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
      {/* Head circle. */}
      <View
        style={{
          position: 'absolute',
          left: headCx - headR,
          top: headCy - headR,
          width: headR * 2,
          height: headR * 2,
          borderRadius: headR,
          borderWidth: sw,
          borderColor: color,
        }}
      />
      {/* Pencil badge (rotated bordered rect, bottom-right). */}
      <View
        style={{
          position: 'absolute',
          left: penCx - penW / 2,
          top: penCy - penH / 2,
          width: penW,
          height: penH,
          borderRadius: 1 * s,
          borderWidth: sw,
          borderColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}
