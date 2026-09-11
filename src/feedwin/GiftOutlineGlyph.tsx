// GiftOutlineGlyph — self-drawn OUTLINE gift-box glyph (design `Icons.gift`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-winclaim-gift-mail).
// Design: `design/shared/icons.jsx` `Icons.gift` (24px viewBox, stroke 1.8 default,
// fill none) —
//   bow    M12 8.5L7.5 4.5L7.5 8.5Z  M12 8.5L16.5 4.5L16.5 8.5Z   (2 triangular loops)
//   lid    <rect x=4   y=8    width=16 height=3.5 rx=1/>
//   body   <rect x=5.5 y=11.5 width=13 height=8.5 rx=1.5/>
//
// Parity: this is the RN counterpart of iOS `Glyphs/GiftGlyph.swift` (SwiftUI `Path.stroke`)
// and Android `IconGlyphs.kt`'s `GiftOutlineGlyph` composable (Compose `drawRoundRect` +
// a stroked path for the bow) — all three platforms use the SAME coordinate constants.
//
// Replaces the retired `GLYPH_GIFT = '\u{1F381}'` (🎁) emoji constant previously inlined into
// a `Text` node at `WinClaimSheetView.tsx`'s pending-checkout row (`DoneCardBody`) — the sole
// call site. This is DISTINCT from the same file's `GiftBadge` (the top "always gift" success
// badge, a filled two-tone SVG built from `GIFT_OUTER_D`/`GIFT_INNER_D` in `GiftGlyphPaths.ts`)
// — that badge is a different glyph at a different call site and is UNCHANGED by this
// component. Do NOT merge or confuse the two: `GiftBadge` is filled, `GiftOutlineGlyph` is
// stroked (outline) — same as the iOS/Android distinction between their filled top badge and
// this outline pending-row glyph.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

export interface GiftOutlineGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's outline gift-box glyph, hand-drawn to match `Icons.gift`. Default size 24
 *  (design viewBox); the win-claim pending-checkout row call site uses `size={18}`. */
export function GiftOutlineGlyph(props: GiftOutlineGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Bow — 2 triangular loops (design `M12 8.5L7.5 4.5L7.5 8.5Z M12 8.5L16.5 4.5L16.5 8.5Z`). */}
      <Path d="M12 8.5L7.5 4.5L7.5 8.5ZM12 8.5L16.5 4.5L16.5 8.5Z" />
      {/* Lid — stroked rounded rect (design `<rect x=4 y=8 width=16 height=3.5 rx=1/>`). */}
      <Rect x={4} y={8} width={16} height={3.5} rx={1} />
      {/* Body — stroked rounded rect (design `<rect x=5.5 y=11.5 width=13 height=8.5 rx=1.5/>`). */}
      <Rect x={5.5} y={11.5} width={13} height={8.5} rx={1.5} />
    </Svg>
  );
}
