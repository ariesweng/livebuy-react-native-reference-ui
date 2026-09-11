// ArrowUpCircleFillGlyph — self-drawn filled circle + white cutout arrow
//                          (design `Icons.arrowUpCircleFill`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-chat-send-arrow-circle).
// Design: `design/shared/icons.jsx` `Icons.arrowUpCircleFill` (24px viewBox) —
//   circle  <circle cx=12 cy=12 r=10/>                                   (filled, `color`)
//   arrow   M12 15.5V8.5  M8.3 12.2L12 8.5L15.7 12.2                     (stroke, FIXED
//           `#fff` — always white regardless of the circle's `color`, per icons.jsx)
//
// Replaces the bare Unicode `"⬆"` `Text` send glyph previously baked into the chat
// composer's send button (`ChatComposerBar.tsx`) — the same anti-pattern already fixed
// on iOS (`Glyphs/ArrowUpCircleFillGlyph.swift`, `rb-ios-icon-parity`), Android
// (`IconGlyphs.kt`'s `ArrowUpCircleFillGlyph`, `rb-android-icon-parity` — whose own
// doc-comment records this exact send button as the bug it fixed), and Flutter
// (`container/arrow_up_circle_fill_glyph.dart`). The prior RN glyph also had the color
// split BACKWARDS — the arrow character itself changed color with `canSend`, with no
// disc at all. This glyph corrects that: the disc tints with `color`, the arrow is
// always white.
//
// Pure presentation: only `color` / `size` props, no state. Its only call site
// (`ChatComposerBar.tsx`) passes `color={canSend ? theme.accent : 'rgba(255,255,255,0.35)'}`.

import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface ArrowUpCircleFillGlyphProps {
  /** Tints ONLY the background disc. The arrow itself is always white (design-fixed). */
  readonly color: string;
  readonly size?: number;
}

/** The design's filled-circle + white-cutout-arrow glyph, hand-drawn to match
 *  `Icons.arrowUpCircleFill`. Replaces the bare Unicode send arrow at the chat composer
 *  send button. `color` tints ONLY the background disc — the arrow is always white,
 *  per the design source. Default size 24 (design viewBox); the send button call site
 *  uses `size={26}`. */
export function ArrowUpCircleFillGlyph(props: ArrowUpCircleFillGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Background disc — filled, tints with `color`. Overrides the Svg-level stroke to
          "none" so the disc itself is never outlined (mirrors DetailGlyph's bullet dots). */}
      <Circle cx={12} cy={12} r={10} fill={color} stroke="none" />
      {/* Arrow — inherits the Svg-level fixed white stroke. NEVER tints with `color`. */}
      <Path d="M12 15.5V8.5M8.3 12.2L12 8.5L15.7 12.2" />
    </Svg>
  );
}
