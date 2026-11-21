import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

// HourglassGlyph — the flash-sale「正在等待結果...」banner's hourglass (rb-rn-flash-sale-bid).
//
// Design: `design/shared/icons.jsx` `Icons.hourglass` (24 viewBox, stroke 2, round caps / joins),
// called by `screens.jsx:LBPBidWaitingBanner` at size 14, white. Same shape as iOS
// `Glyphs/HourglassGlyph.swift` and Android `IconGlyphs.kt` `HourglassGlyph`. Path data is copied
// verbatim (straight lines + cubic béziers only, no arc — `icon-authoring.md` rule 1):
//   frame + walls are stroked; the sand pile is filled with no stroke.

export interface HourglassGlyphProps {
  readonly color: string;
  readonly size?: number;
}

export function HourglassGlyph(props: HourglassGlyphProps): ReactElement {
  const { color, size = 14 } = props;
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
      <Path d="M6 3h12M6 21h12" />
      <Path d="M7.5 3v2.5c0 2.2 1.8 3.7 4.5 6.5c-2.7 2.8-4.5 4.3-4.5 6.5V21M16.5 3v2.5c0 2.2-1.8 3.7-4.5 6.5c2.7 2.8 4.5 4.3 4.5 6.5V21" />
      <Path d="M9.3 18.6h5.4c0-1.3-1.3-2.5-2.7-3.8c-1.4 1.3-2.7 2.5-2.7 3.8z" fill={color} stroke="none" />
    </Svg>
  );
}
