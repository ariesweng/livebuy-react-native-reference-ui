import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - ShareGlyph — self-drawn three-node share glyph (design `Icons.share`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-share-icon-design-align, 問題 8).
// RN parity of iOS `Glyphs/ShareGlyph.swift` / Android `ShareGlyph.kt` / Flutter `ShareGlyph`
// (34dfec3 / 76ce565). RN has NO Canvas / react-native-svg, so the glyph is drawn with
// deterministic `View`s (3 bordered node circles + 2 rotated connector lines) — the same
// View-drawing convention as `ZoomBadge` — NOT the prior `↗` Unicode Text.
//
// Geometry mirrors the other platforms (24-unit space, scaled by `size/24`): three r=2.5 stroked
// nodes at (6,12) / (18,6) / (18,18) + two stroke-1.8 connector lines (8,11)→(16,7) and
// (8,13)→(16,17). Identical design intent.

const NODES: readonly (readonly [number, number])[] = [
  [6, 12],
  [18, 6],
  [18, 18],
];
const NODE_R = 2.5;
const STROKE = 1.8;
// Connector lines (start → end) in the 24-unit space.
const LINES: readonly (readonly [number, number, number, number])[] = [
  [8, 11, 16, 7],
  [8, 13, 16, 17],
];

export function ShareGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 18 } = props;
  const s = size / 24;

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {/* Connector lines (rendered first, under the nodes). */}
      {LINES.map(([x1, y1, x2, y2], i) => {
        const dx = (x2 - x1) * s;
        const dy = (y2 - y1) * s;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const mx = ((x1 + x2) / 2) * s;
        const my = ((y1 + y2) / 2) * s;
        return (
          <View
            key={`l${i}`}
            style={{
              position: 'absolute',
              left: mx - len / 2,
              top: my - (STROKE * s) / 2,
              width: len,
              height: STROKE * s,
              borderRadius: (STROKE * s) / 2,
              backgroundColor: color,
              transform: [{ rotate: `${angleDeg}deg` }],
            }}
          />
        );
      })}
      {/* Stroked node circles. */}
      {NODES.map(([cx, cy], i) => (
        <View
          key={`n${i}`}
          style={{
            position: 'absolute',
            left: (cx - NODE_R) * s,
            top: (cy - NODE_R) * s,
            width: NODE_R * 2 * s,
            height: NODE_R * 2 * s,
            borderRadius: NODE_R * s,
            borderWidth: STROKE * s,
            borderColor: color,
          }}
        />
      ))}
    </View>
  );
}
