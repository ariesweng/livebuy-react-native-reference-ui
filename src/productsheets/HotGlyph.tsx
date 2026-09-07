// HotGlyph — self-drawn FILLED "flame" icon (design `Icons.hot`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-product-row-number-badge, design R35). Backs the
// product-row NUMBER BADGE's「介紹中」content swap (`ProductListView.tsx`'s `RowLayoutBody`): the
// badge shows this glyph + "HOT" text instead of the plain 1-based number while the row is
// introducing (and not sold out).
//
// Design: `design/shared/icons.jsx` `Icons.hot` — a NEW icon added by R35 (repo had none before):
//
//   <path
//     d="M323.56 51.2c-20.8 19.3-39.58 39.59-56.22 59.97C240.08 73.62 206.28 35.53 168 0
//        69.74 91.17 0 209.96 0 281.6 0 408.85 100.29 512 224 512s224-103.15 224-230.4
//        c0-53.27-51.98-163.14-124.44-230.4zm-19.47 340.65C282.43 407.01 255.72 416 226.86 416
//        154.71 416 96 368.26 96 290.75c0-38.61 24.31-72.63 72.79-130.75 6.93 7.98 98.83 125.34
//        98.83 125.34l58.63-66.88c4.14 6.85 7.91 13.55 11.27 19.97 27.35 52.19 15.81 118.97
//        -33.43 153.42z"
//     fill="currentColor" stroke="none" viewBox="0 0 448 512"
//   />
//
// `design/contract/icon-authoring.md` 規則 1 (arc → cubic-bezier conversion before landing an
// icon's `d` as authoritative): this path is built ENTIRELY from `M`/`c`/`C`/`s`/`S`/`m`/`l`/`z`
// commands — it contains NO `a`/`A` (elliptical arc) instructions, so rule 1 does not apply. The
// `d` string below is copied VERBATIM from `design/shared/icons.jsx`, zero transliteration.
//
// `viewBox="0 0 448 512"` is NOT square (unlike this package's other 24×24-viewBox glyphs). This
// component sets `width={size} height={size}` (matching the design's own `<svg width={size}
// height={size} viewBox={viewBox}>` combination) and relies on react-native-svg's default
// `preserveAspectRatio="xMidYMid meet"` to keep the true aspect ratio (centered, letterboxed, NOT
// stretched) — same behavior as the browser SVG the design renders.
//
// icon-authoring.md 規則 2 (confirm at ACTUAL render size, not just the design canvas): the badge
// renders this glyph at a fixed `size={10}` (design value, `sdk-components.jsx`'s `numberBadge`).
// This has NOT been visually confirmed at that size on a real device/simulator — jest's structural
// snapshot can verify the JSX tree shape but not legibility. A filled blob shape (no thin strokes)
// is structurally more robust at small sizes than the `shopBag` failure case icon-authoring.md
// documents (a thin-stroke glyph whose line width got swallowed by rounded caps at 18dp), but that
// is a reasoned expectation, not a verified one — flagged here for a follow-up manual check.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface HotGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's filled flame glyph, copied verbatim from `Icons.hot`. Default size 10 (the
 *  product-row number badge's fixed icon size, regardless of row/grid — grid never uses this
 *  glyph, see this file's header). */
export function HotGlyph(props: HotGlyphProps): ReactElement {
  const { color, size = 10 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 448 512" fill={color} stroke="none">
      <Path d="M323.56 51.2c-20.8 19.3-39.58 39.59-56.22 59.97C240.08 73.62 206.28 35.53 168 0 69.74 91.17 0 209.96 0 281.6 0 408.85 100.29 512 224 512s224-103.15 224-230.4c0-53.27-51.98-163.14-124.44-230.4zm-19.47 340.65C282.43 407.01 255.72 416 226.86 416 154.71 416 96 368.26 96 290.75c0-38.61 24.31-72.63 72.79-130.75 6.93 7.98 98.83 125.34 98.83 125.34l58.63-66.88c4.14 6.85 7.91 13.55 11.27 19.97 27.35 52.19 15.81 118.97-33.43 153.42z" />
    </Svg>
  );
}
