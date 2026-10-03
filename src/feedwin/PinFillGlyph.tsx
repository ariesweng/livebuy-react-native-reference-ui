import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

// PinFillGlyph — the chat pinned-message banner's round-head pin (rb-rn-feed-emoji-glyph-parity).
// Same shape as iOS `Glyphs/PinFillGlyph.swift`, Android `PinFillGlyph` and Flutter
// `playershell/pin_fill_glyph.dart` (24 viewBox, filled): head circle r4.5 at (12, 7.5) + tail
// `M10 11.5 L8 21 L12 18.5 L16 21 L14 11.5 Z`. Replaces the emoji `📌`, which ignored the accent tint.
// Not the widget card's pushpin (`widget/PinGlyph.tsx`, a different design shape).

export interface PinFillGlyphProps {
  readonly color: string;
  readonly size?: number;
}

export function PinFillGlyph(props: PinFillGlyphProps): ReactElement {
  const { color, size = 18 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Circle cx={12} cy={7.5} r={4.5} />
      <Path d="M10 11.5L8 21L12 18.5L16 21L14 11.5Z" />
    </Svg>
  );
}
