import type { ReactElement } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

// MARK: - TagGlyph — self-drawn outline price-tag (design tag / Android `TagGlyph`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-tag-warning-glyph; hole geometry fixed by
// rb-rn-icon-parity-tag-glyph-hole-fix). RN parity of Android `TagGlyph` (`D_TAG`) / iOS SF `tag`.
//
// Geometry mirrors Android `IconGlyphs.D_TAG = "M9 6L20 6L20 18L9 18L3 12Z"` (a 5-vertex price-tag
// polygon: rectangle (9,6)-(20,18) with a pointed left corner at (3,12)) + a stroked hole ring at
// (8,12) r=1.3 — coordinates already pixel-verified on Android. Scaled by the `<Svg>`'s
// `width`/`height` against the fixed `viewBox="0 0 24 24"`.
//
// Uses `react-native-svg`'s `<Svg><Path/><Circle/></Svg>` (this package's established convention
// for curved glyphs — see `DetailGlyph.tsx` / `CartFillGlyph.tsx` / `ArrowDownGlyph.tsx`), NOT a
// `View`/`borderWidth` hack. This matters for the hole specifically: SVG (and Android Compose's
// `Stroke`) center a stroke ON the path — half the stroke width extends outward, half inward —
// so a circle's visible inner (hole) radius is `r − strokeWidth / 2`. A PRIOR revision of this
// file approximated the hole with a `View` + CSS `borderWidth`/`borderRadius`, which uses the
// border-box model instead (the border eats inward from the outer edge only): with
// `borderRadius = r = 1.3` treated as the outer radius and `borderWidth = 1.5`, the inner radius
// came out to `1.3 − 1.5 = −0.2` (negative) — the stroke was wider than the whole circle, so it
// painted over the entire disc and the hole disappeared entirely. Android's reference
// implementation (`IconGlyphs.kt`'s `TagGlyph` composable) never had this bug because Compose's
// `Stroke(width)` is path-centered like SVG's `stroke`, not border-box — `r=1.3` with
// `Stroke(width=1.5)` yields the correct positive inner radius `1.3 − 0.75 = 0.55`. The `<Circle>`
// below reproduces that exact math (`r=1.3`, `strokeWidth=1.5`), not an approximation of it.
//
// Pure presentation: only `color` / `size` props, no state.

export interface TagGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's outline price-tag-with-hole glyph, hand-drawn to match Android `TagGlyph`.
 *  Default size 12 (this component's historical default — its original call site,
 *  `ChatFeedView`'s now-removed `LBProductSaleCardRow`, used `size={12}`). */
export function TagGlyph(props: TagGlyphProps): ReactElement {
  const { color, size = 12 } = props;
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
      {/* Price-tag polygon: (9,6)→(20,6)→(20,18)→(9,18)→(3,12)→(9,6). Inherits the `<Svg>`'s
          stroke/strokeWidth/fill above. */}
      <Path d="M9 6L20 6L20 18L9 18L3 12Z" />
      {/* Hole ring at (8,12) — stroke path-centered (see file header), inner radius 0.55. Only
          `strokeWidth` is overridden (1.5, distinct from the polygon's 1.8); `stroke`/`fill` are
          inherited from the `<Svg>` above. */}
      <Circle cx={8} cy={12} r={1.3} strokeWidth={1.5} />
    </Svg>
  );
}
