// CloseGlyph — self-drawn "X" close affordance for the family-5 widget surfaces'
// close buttons (`MinimizedWidgetView` / `FloatingWidgetView`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-widget-close-glyph).
// Design: Android `IconGlyphs.kt` `D_CLOSE = "M5 5l14 14M19 5L5 19"` (icons.jsx `close` ↔
// iOS `Image(systemName: "xmark")`) — two independent stroked line segments forming an
// X, `fill="none"`. This glyph is the RN port of that same shape, hand-drawn to match.
//
// Replaces the bare Unicode `<Text>{'✕'}</Text>` previously drawn at both
// `MinimizedWidgetView.tsx`'s `closeButton` and `FloatingWidgetView.tsx`'s
// `floatingClose` — RN was the last of the three platforms (iOS SF Symbol, Android
// `IconGlyphs.kt`) still using a bare character here.
//
// `react-native-svg`'s `<Path>` parses the two-segment `d` string verbatim — same
// technique this directory's sibling glyphs (`PinGlyph.tsx`) already established. This
// package's `react-native-svg` dependency is NOT banned in this layer: it is a declared
// `peerDependency` (`package.json`) and already used by multiple existing `widget/`
// glyphs (`PinGlyph.tsx`, `LockGlyph.tsx`, `ShareFillGlyph.tsx`, `CartFillGlyph.tsx`,
// `CcGlyph.tsx`, `DetailGlyph.tsx`).
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface CloseGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The two independent stroked line segments forming the X (Android `D_CLOSE`, verbatim). */
const CLOSE_PATH_D = 'M5 5l14 14M19 5L5 19';

/** The design's close "X" glyph, hand-drawn to match Android `IconGlyphs.kt`'s `D_CLOSE`.
 *  Default size 24 (design viewBox) — both existing call sites (`MinimizedWidgetView`,
 *  `FloatingWidgetView`) pass an explicit `size={14}`, matching their prior fixed
 *  `styles.closeGlyph.fontSize: 14`. */
export function CloseGlyph(props: CloseGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d={CLOSE_PATH_D} />
    </Svg>
  );
}
