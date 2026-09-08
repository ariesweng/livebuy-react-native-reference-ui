import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

// BellGlyph — self-drawn "restock notify" bell outline glyph for the sold-out
// `RowCartButton` (`ProductListView.tsx`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-product-restock-bell).
// Parity: Android `IconGlyphs.kt`'s `BellGlyph` composable (`ProductRowView.kt:644` call site,
// `BellGlyph(color = Color.White, modifier = Modifier.size(15.dp))`) — a stroked (outline, NOT
// filled) bell body + clapper, copied VERBATIM from Android's own constants:
//
//   D_BELL         = "M12 5C8.4 5 6.6 7.8 6.6 11.6C6.6 14.8 5.6 16.4 4.8 17.6L19.2 17.6" +
//                     "C18.4 16.4 17.4 14.8 17.4 11.6C17.4 7.8 15.6 5 12 5Z"
//   D_BELL_CLAPPER = "M10.2 17.6C10.2 19.4 13.8 19.4 13.8 17.6"
//
// `D_BELL` is a closed path but is drawn STROKED, not filled (Android's `strokePath`, default
// stroke width 1.8) — Android hand-redrew the design source's arc-based `bell` path as an
// all-cubic shape because the raw arc degenerates under Android's `PathParser` when filled (see
// `IconGlyphs.kt`'s own "#1 教訓：arc 不可靠、cubic 可靠" comment). `react-native-svg` doesn't
// share that specific degeneracy, but reusing Android's already-verified geometry keeps this
// glyph pixel-identical in silhouette to both Android and (transitively) iOS's SF Symbol `bell`.
//
// This is deliberately the OUTLINE variant (matches iOS `"bell"` / Android `BellGlyph`, NOT
// `"bell.fill"` / `BellFillGlyph`) — both platforms use outline at this exact call site (the
// sold-out row's restock-notify trigger), reserving the filled variant for the subscribed toggle
// state inside `NotifyRestockSheetView` (a different, out-of-scope component/call-site).
//
// Replaces the literal emoji `Text` glyph (`'🔔'`) previously drawn at `ProductListView.tsx`'s
// `RowCartButton` sold-out branch (rb-rn-icon-parity-product-restock-bell).
//
// Pure presentation: only `color` / `size` props, no state. Same `react-native-svg` stroke
// convention as `PeopleGlyph.tsx` / `CcGlyph.tsx` (fill="none", stroke=color, strokeWidth=1.8,
// round cap/join, 24-viewBox) — copied structure, not reinvented.

const D_BELL =
  'M12 5C8.4 5 6.6 7.8 6.6 11.6C6.6 14.8 5.6 16.4 4.8 17.6L19.2 17.6' +
  'C18.4 16.4 17.4 14.8 17.4 11.6C17.4 7.8 15.6 5 12 5Z';
const D_BELL_CLAPPER = 'M10.2 17.6C10.2 19.4 13.8 19.4 13.8 17.6';

export interface BellGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The Android-verified (`D_BELL` / `D_BELL_CLAPPER`) outline bell glyph. Default size 24
 *  (design viewBox); call sites scale it to the button's effective icon size. */
export function BellGlyph(props: BellGlyphProps): ReactElement {
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
      <Path d={D_BELL} />
      <Path d={D_BELL_CLAPPER} />
    </Svg>
  );
}
