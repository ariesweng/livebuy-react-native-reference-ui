// HeartFillGlyph — self-drawn FILLED heart icon (design `Icons.heartFill`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-heart-burst-icon-parity).
// Design: `design/shared/icons.jsx` `Icons.heartFill` (24px viewBox, `stroke="none"`,
//   `fill=currentColor`):
//
//   <path d="M12 20C6 15 4 12 4 9C4 6.5 6 5 8 5C10 5 11.3 6.3 12 7.6C12.7 6.3 14 5 16 5C18 5 20 6.5 20 9C20 12 18 15 12 20Z" />
//
// Replaces the literal Unicode `'♥'` character previously drawn via `<Text>` / `<Animated.Text>`
// in three call sites — `HeartBurst.tsx` (the flying burst), `LiveBottomBarView.tsx`'s LIVE
// bottom-bar LIKE button, and `OperationRailView.tsx`'s `railGlyphFor(LBSideRailKind.Like)`
// (dead code there — see that file's own comment) — on some devices/fonts a literal character
// renders in an emoji style and ignores the caller's `color` tint (parity-debt-ledger.md #20;
// same class of bug Android fixed in `rb-android-heart-burst-deemoji` and Flutter fixed in
// `rb-flutter-heart-burst-icon-parity`). iOS uses SF Symbol `heart.fill`; Android self-draws its
// own `HeartFillGlyph` (`IconGlyphs.kt`, a separately fill-ratio-tuned path — not copied here, RN
// draws the design source's `Icons.heartFill` path verbatim instead: parity-in-spirit across all
// four platforms — a vector heart everywhere — not pixel-identical coordinates).
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface HeartFillGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's filled heart glyph, hand-drawn to match `Icons.heartFill`. Default size 24
 *  (design viewBox); callers pass their own size (`HeartBurst` burst glyph size, LIKE button
 *  `ICON_GLYPH_SIZE` 18). */
export function HeartFillGlyph(props: HeartFillGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M12 20C6 15 4 12 4 9C4 6.5 6 5 8 5C10 5 11.3 6.3 12 7.6C12.7 6.3 14 5 16 5C18 5 20 6.5 20 9C20 12 18 15 12 20Z" />
    </Svg>
  );
}
