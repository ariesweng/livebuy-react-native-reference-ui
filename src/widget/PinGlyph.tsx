// PinGlyph — self-drawn "pushpin/flag" icon for the family-5 widget card's PIN BADGE.
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-carousel-card-pin-viewers-duration-removal).
// Design: `design/templates/minimal/widgets.jsx` `LBPCarouselCard`'s inline `item.pinned` svg
// (a literal `<svg width="16" height="16" viewBox="0 0 384 512" fill="#fff" stroke="none">`
// with one filled `<path>`), NOT `design/shared/icons.jsx`'s `Icons.pinFill` — the design
// ledger (`claude-design-sync.md` R33) explicitly notes the two are DIFFERENT shapes
// (`Icons.pinFill` is a map-pin/teardrop; this one is a classic pushpin/flag) and that the
// upstream author deliberately kept the inline svg rather than switching to `Icons.pinFill`.
// This glyph is the RN faithful port of that inline svg, hand-drawn to match verbatim.
//
// Marks a PINNED VIDEO (`LBVideoItem.pin`) — unrelated to, and deliberately not named after,
// the family-2 chat「置頂留言」(pinned CHAT MESSAGE) feature (see `feedwin`'s `pinnedCard` /
// `pinnedBanner`). Do not conflate the two when reading test ids or component names.
//
// `react-native-svg`'s `<Path>` parses the design's `d` string verbatim — same technique this
// directory's sibling glyphs (`ShareFillGlyph.tsx`, `DetailGlyph.tsx`) already established.
//
// Pure presentation: only `color` / `size` props, no state. The design's viewBox (384×512,
// portrait) is NOT square, but both `width` / `height` are pinned to the same `size` (matching
// the design's own literal `width="16" height="16"` on a 384×512 viewBox) — react-native-svg
// applies the same default `preserveAspectRatio` (`xMidYMid meet`) as a browser, so the glyph
// letterboxes inside the square box exactly like the design source.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface PinGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's filled pushpin/flag path, copied verbatim from `widgets.jsx`. */
const PIN_PATH_D =
  'M298.028 214.267L285.793 96H328c13.255 0 24-10.745 24-24V24c0-13.255-10.745-24-24-24H56C42.745 0 32 10.745 32 24v48c0 13.255 10.745 24 24 24h42.207L85.972 214.267C37.465 236.82 0 277.261 0 328c0 13.255 10.745 24 24 24h136v104.007c0 1.242.289 2.467.845 3.578l24 48c2.941 5.882 11.364 5.893 14.311 0l24-48a8.008 8.008 0 0 0 .845-3.578V352h136c13.255 0 24-10.745 24-24-.001-51.183-37.983-91.42-85.973-113.733z';

/** The design's pushpin/flag glyph, hand-drawn to match the `LBPCarouselCard` inline svg.
 *  Default size 16 (design's literal icon size — the design does NOT use its own 24px `Icon`
 *  wrapper default here). */
export function PinGlyph(props: PinGlyphProps): ReactElement {
  const { color, size = 16 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512" fill={color} stroke="none">
      <Path d={PIN_PATH_D} />
    </Svg>
  );
}
