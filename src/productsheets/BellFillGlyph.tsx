import type { ReactElement } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

// BellFillGlyph — self-drawn "restock notify (subscribed)" FILLED bell glyph for the
// `NotifyRestockSheetView` CTA.
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-restock-bell-fill).
// Parity: Android `IconGlyphs.kt`'s `BellFillGlyph` composable, called at
// `NotifyRestockSheet.kt:469` (`BellFillGlyph(color = fg, modifier = Modifier.size(18.dp))`) when
// `noticeEnabled == true`. iOS parity: `Image(systemName: "bell.fill")` at
// `NotifyRestockSheetView.swift:282`.
//
//   D_BELL (bell body, FILLED here — same closed path `BellGlyph.tsx` draws STROKED) =
//     "M12 5C8.4 5 6.6 7.8 6.6 11.6C6.6 14.8 5.6 16.4 4.8 17.6L19.2 17.6" +
//     "C18.4 16.4 17.4 14.8 17.4 11.6C17.4 7.8 15.6 5 12 5Z"
//   clapper: a filled circle at (12, 18.8) radius 1.3 — NOT a filled version of
//     `BellGlyph.tsx`'s `D_BELL_CLAPPER` stroke path. Android's `BellFillGlyph` draws
//     `fillPath(D_BELL, color)` plus `drawCircle(color, radius = 1.3f, center = Offset(12f,
//     18.8f))` scaled by `size.minDimension / VB` (`VB = 24f`) — in `react-native-svg`, an
//     `<Svg viewBox="0 0 24 24">` already maps that 24-unit coordinate space to the requested
//     pixel `size`, so `<Circle cx={12} cy={18.8} r={1.3} />` reproduces Android's scaled circle
//     with no manual scale step needed.
//
// The bell-body path data is copied verbatim from this directory's own `BellGlyph.tsx` (its
// `D_BELL` constant, itself copied from Android) rather than retyped, so the outline→filled
// transition never shifts the bell's outer silhouette — only the interior fill/stroke treatment
// changes, matching what both iOS's SF Symbol pair (`bell`/`bell.fill`) and Android's own pair
// (`BellGlyph`/`BellFillGlyph`) produce. `BellGlyph.tsx` itself is NOT imported from — this
// package's established outline/filled convention (`HeartGlyph`/`HeartFillGlyph`,
// `CartGlyph`/`CartFillGlyph`) keeps each file self-contained with its own path constants, so the
// string is duplicated here (verified character-for-character against `BellGlyph.tsx`), not
// shared via a cross-file import.
//
// Deliberately the ONLY call site for this component: `NotifyRestockSheetView.tsx`'s footer CTA,
// subscribed state (`restockSubscribed === true`). `ProductListView.tsx`'s `RowCartButton`
// sold-out branch uses the OUTLINE `BellGlyph` unconditionally (a different call site, not
// state-driven) and is untouched by this component's introduction.
//
// Pure presentation: only `color` / `size` props, no state.

const D_BELL =
  'M12 5C8.4 5 6.6 7.8 6.6 11.6C6.6 14.8 5.6 16.4 4.8 17.6L19.2 17.6' +
  'C18.4 16.4 17.4 14.8 17.4 11.6C17.4 7.8 15.6 5 12 5Z';

export interface BellFillGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The Android-verified (`D_BELL` filled + a filled clapper circle) filled bell glyph. Default
 *  size 24 (design viewBox); call sites scale it to the button's effective icon size. */
export function BellFillGlyph(props: BellFillGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d={D_BELL} />
      <Circle cx={12} cy={18.8} r={1.3} />
    </Svg>
  );
}
