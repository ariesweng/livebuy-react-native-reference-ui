import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

// HeartGlyph — self-drawn OUTLINE heart icon (design `Icons.heart`), the unfilled companion to
// the existing `HeartFillGlyph`.
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-product-detail-favorite-icon-parity).
// Design: `design/shared/icons.jsx` `Icons.heart` (24px viewBox, default `Icon` stroke
//   convention: `stroke={color}`, `strokeWidth={1.8}`, `fill="none"`, round cap/join) — the SAME
//   path `Icons.heartFill` fills, drawn stroked instead:
//
//   <path d="M12 20C6 15 4 12 4 9C4 6.5 6 5 8 5C10 5 11.3 6.3 12 7.6C12.7 6.3 14 5 16 5C18 5 20 6.5 20 9C20 12 18 15 12 20Z" />
//
// Replaces the literal Unicode `'♡'` character (`GLYPH_HEART_OUTLINE`) previously drawn via
// `<Text>` at `ProductDetailSheetView.tsx`'s inline 收藏鈕 (favorite button) unfaved state —
// same class of bug as the filled glyph's own header comment (`HeartFillGlyph.tsx`): a literal
// character can render in an emoji style on some devices/fonts and ignores the caller's `color`
// tint (parity-debt-ledger.md #23). iOS uses SF Symbol `"heart"`; Android self-draws its own
// outline `HeartGlyph` (`IconGlyphs.kt`); this file draws the design source's `Icons.heart` path
// verbatim, same "parity-in-spirit, not pixel-identical coordinates" posture as `HeartFillGlyph`.
//
// Lives alongside `HeartFillGlyph` (both under `playershell/`) even though this glyph's only
// consumer today is `productsheets/ProductDetailSheetView.tsx` — cross-directory glyph imports
// are an established pattern in this module (`ShareGlyph` / `DetailGlyph` are both consumed from
// `productsheets/` despite living in `playershell/`), and keeping the outline/fill pair together
// keeps them discoverable as a matched set.
//
// Pure presentation: only `color` / `size` props, no state.

export interface HeartGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's outline heart glyph, hand-drawn to match `Icons.heart`. Default size 24 (design
 *  viewBox); callers pass their own size (`ProductDetailSheetView`'s inline 收藏鈕 uses 18). */
export function HeartGlyph(props: HeartGlyphProps): ReactElement {
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
      <Path d="M12 20C6 15 4 12 4 9C4 6.5 6 5 8 5C10 5 11.3 6.3 12 7.6C12.7 6.3 14 5 16 5C18 5 20 6.5 20 9C20 12 18 15 12 20Z" />
    </Svg>
  );
}
