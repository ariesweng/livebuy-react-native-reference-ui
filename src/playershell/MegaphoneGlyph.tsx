// MegaphoneGlyph — self-drawn FILLED "bullhorn" icon (design `Icons.megaphone`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-live-announce-bullhorn-icon). Backs the LIVE
// overlay chrome's announcement banner (`LiveOverlayChromeView.tsx`'s `announceBanner`): the
// red `#F03246` 22×22 icon badge previously drew a plain emoji placeholder (`'\u{1F4E2}'` 📢
// loudspeaker, never a real vector glyph) instead of the design's actual icon shape.
//
// Design: `design/shared/icons.jsx` `Icons.megaphone` — replaced by commit `904654d5a`
// (2026-09-09) from a plain flag-shaped placeholder path to a Font Awesome bullhorn glyph:
//
//   <path
//     d="M576 240c0-23.63-12.95-44.04-32-55.12V32.01C544 23.26 537.02 0 512 0c-7.12
//        0-14.19 2.38-19.98 7.02l-85.03 68.03C364.28 109.19 310.66 128 256 128H64
//        c-35.35 0-64 28.65-64 64v96c0 35.35 28.65 64 64 64h33.7c-1.39 10.48-2.18
//        21.14-2.18 32 0 39.77 9.26 77.35 25.56 110.94 5.19 10.69 16.52 17.06 28.4
//        17.06h74.28c26.05 0 41.69-29.84 25.9-50.56-16.4-21.52-26.15-48.36-26.15-77.44
//        0-11.11 1.62-21.79 4.41-32H256c54.66 0 108.28 18.81 150.98 52.95l85.03 68.03
//        C497.68 477.52 504.73 479.99 511.99 480c24.92 0 32-22.78 32-32V295.13
//        C563.05 284.04 576 263.63 576 240zm-96 141.42l-33.05-26.44C392.95 311.78
//        325.12 288 256 288v-96c69.12 0 136.95-23.78 190.95-66.98L480 98.58v282.84z"
//     fill="currentColor" stroke="none" viewBox="0 0 576 512"
//   />
//
// `design/contract/icon-authoring.md` 規則 1 (arc → cubic-bezier conversion before landing an
// icon's `d` as authoritative): this path is built entirely from `M`/`c`/`C`/`z` commands — it
// contains NO `a`/`A` (elliptical arc) instructions, so rule 1 does not apply. The `d` string
// below is copied VERBATIM from `design/shared/icons.jsx`, zero transliteration.
//
// `viewBox="0 0 576 512"` is NOT square (same non-square-viewBox pattern as this package's
// `productsheets/HotGlyph.tsx`, unlike the majority-square 24×24-viewBox glyphs). This component
// sets `width={size} height={size}` and relies on `react-native-svg`'s default
// `preserveAspectRatio="xMidYMid meet"` to keep the true aspect ratio (centered, letterboxed, NOT
// stretched) — no manual scale/padding math needed.
//
// Replaces the announce banner badge's emoji `<Text>` glyph — same design-parity motivation as
// `CcGlyph` / `HotGlyph`: the design's `Icons.megaphone` is a drawn vector glyph, not a unicode
// character. Icon badge size (22×22), corner radius (5), and background color (`#F03246`,
// `ANNOUNCE_BADGE_COLOR`) are unaffected — only the glyph drawn inside the badge changes.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface MegaphoneGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's filled bullhorn glyph, copied verbatim from `Icons.megaphone`. Default size 13
 *  (the announce banner badge's fixed icon size, matching iOS/Android/Flutter parity). */
export function MegaphoneGlyph(props: MegaphoneGlyphProps): ReactElement {
  const { color, size = 13 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 576 512" fill={color} stroke="none">
      <Path d="M576 240c0-23.63-12.95-44.04-32-55.12V32.01C544 23.26 537.02 0 512 0c-7.12 0-14.19 2.38-19.98 7.02l-85.03 68.03C364.28 109.19 310.66 128 256 128H64c-35.35 0-64 28.65-64 64v96c0 35.35 28.65 64 64 64h33.7c-1.39 10.48-2.18 21.14-2.18 32 0 39.77 9.26 77.35 25.56 110.94 5.19 10.69 16.52 17.06 28.4 17.06h74.28c26.05 0 41.69-29.84 25.9-50.56-16.4-21.52-26.15-48.36-26.15-77.44 0-11.11 1.62-21.79 4.41-32H256c54.66 0 108.28 18.81 150.98 52.95l85.03 68.03C497.68 477.52 504.73 479.99 511.99 480c24.92 0 32-22.78 32-32V295.13C563.05 284.04 576 263.63 576 240zm-96 141.42l-33.05-26.44C392.95 311.78 325.12 288 256 288v-96c69.12 0 136.95-23.78 190.95-66.98L480 98.58v282.84z" />
    </Svg>
  );
}
