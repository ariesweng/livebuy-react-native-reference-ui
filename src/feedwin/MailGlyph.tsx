// MailGlyph — self-drawn outline mail/envelope glyph (design `LBWinSheet.mailSvg`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-winclaim-gift-mail).
// Design: `design/templates/minimal/moments.jsx` `mailSvg(size, color)` (24px viewBox,
// stroke 1.9, fill none) — a rounded-rect envelope body + the flap polyline:
//   body  <rect x=3 y=5 width=18 height=14 rx=2/>
//   flap  <path d="M3.5 6.5L12 12l8.5-5.5"/>
//
// Parity: this is the RN counterpart of Android `IconGlyphs.kt`'s `MailGlyph` composable
// (`drawRoundRect` for the body + `strokePath(D_MAIL_FLAP, ...)` for the flap, both stroke
// width 1.9 — logged there as a direct transcription of the same design `mailSvg`). iOS uses
// the system SF Symbol `envelope` at the same call site (`WinClaimModalView.swift`'s
// `emailField`) instead of a hand-drawn glyph — not an emoji/anti-pattern, just a different
// (already-vector) rendering choice, so there is no RN geometry to port from iOS here.
//
// Replaces the retired `GLYPH_MAIL = '✉'` emoji constant previously inlined into a `Text`
// node at `WinClaimSheetView.tsx`'s email input row (`ClaimCardBody`) — the sole call site.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

export interface MailGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's outline envelope glyph, hand-drawn to match `mailSvg`. Default size 24
 *  (design viewBox); the win-claim email row call site uses `size={16}`. */
export function MailGlyph(props: MailGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Envelope body — stroked rounded rect (design `<rect x=3 y=5 width=18 height=14 rx=2/>`). */}
      <Rect x={3} y={5} width={18} height={14} rx={2} />
      {/* Flap — stroked polyline (design `<path d="M3.5 6.5L12 12l8.5-5.5"/>`). */}
      <Path d="M3.5 6.5L12 12L20.5 6.5" />
    </Svg>
  );
}
