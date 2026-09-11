// CheckGlyph — self-drawn "checkmark" icon (design `Icons.check`, parity iOS SF Symbol
// `checkmark` / Android `IconGlyphs.kt`'s `CheckGlyph` / Flutter `Icons.check`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-carttoast-check-glyph).
// Design: `design/shared/icons.jsx`-style checkmark stroke path — a single open polyline
// (short down-stroke + long up-stroke), NOT a filled glyph.
//
// Geometry mirrors Android `IconGlyphs.kt`'s `D_CHECK = "M4 12.5l5 5L20 6.5"` (a 3-point
// checkmark polyline in the standard 24-unit icon box), which that file draws with
// `strokePath(p, color, 2f)` — this file reproduces the identical `d` string and stroke width
// via `react-native-svg`, following this package's established "`<Svg>` sets stroke look,
// single `<Path>`" convention for simple stroke-only glyphs (see `ArrowDownGlyph.tsx` /
// `DetailGlyph.tsx`'s line elements).
//
// Replaces the deterministic-but-non-vector `Text` glyph `'✓'` previously inlined at this
// package's only call site (`CartToastView.tsx`'s accent-ringed add-to-cart success badge) — RN
// was the last of the four platforms still drawing this checkmark as a Unicode text character
// instead of a vector path (iOS/Android/Flutter already draw it as a real glyph/icon).
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface CheckGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's checkmark stroke glyph, hand-drawn to match Android `IconGlyphs.kt`'s
 *  `CheckGlyph` (`D_CHECK`). Default size 24 (design viewBox); the cart-toast call site uses an
 *  explicit smaller size to fit its 24px accent circle badge. */
export function CheckGlyph(props: CheckGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Checkmark polyline: short down-stroke (4,12.5)→(9,17.5) + long up-stroke →(20,6.5).
          Verbatim copy of Android `IconGlyphs.kt`'s `D_CHECK`. */}
      <Path d="M4 12.5l5 5L20 6.5" />
    </Svg>
  );
}
