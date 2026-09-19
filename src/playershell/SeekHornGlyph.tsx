// SeekHornGlyph — self-drawn "horn" glyph (rb-rn-double-tap-seek-feedback).
//
// Spec: `reference-ui-rendering/spec.md` §「livebuy-react-native-reference-ui player-shell 影片區
//   手勢二度重寫...」Requirement's「雙擊 seek 的半螢幕漸層視覺回饋」段落.
// Design: `design/templates/minimal/sdk-components.jsx`'s `LBPSeekHorn` helper (8×11 viewBox,
//   filled play-triangle shape, used in a group of three with fading opacity as the double-tap
//   seek toast's direction indicator):
//
//   const LBPSeekHorn = ({ size = 15, style }) => (
//     <svg width={size} height={size * 11 / 8} viewBox="0 0 8 11" ...>
//       <path d="M7.478 6.142l-6.242 4.39A.784.784 0 010 9.89V1.109A.784.784 0 011.236.468l6.242
//         4.39a.784.784 0 010 1.283z" fill="#FFF" fillRule="evenodd" />
//     </svg>
//   );
//
// Path data copied VERBATIM from the design source — do NOT hand-redraw or approximate. Parity
// with this package's established `react-native-svg` glyph convention (`SpeakerGlyphs.tsx` /
// `PlayGlyph.tsx`): a single filled `<Path>`, no stroke.
//
// Pure presentation: `size` (width; height follows the design's `size * 11 / 8` aspect) and
// `opacity` (the caller — `GestureSeekToastView` — renders three of these at opacity 0.3/0.5/1).
// `opacity` is applied via a wrapping `View` rather than a `react-native-svg` prop, so the
// existing `test-support/react-native-svg.mock.tsx` (`SvgProps`/`PathProps`) needs no change.

import type { ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface SeekHornGlyphProps {
  readonly size?: number;
  readonly opacity?: number;
}

const SEEK_HORN_D =
  'M7.478 6.142l-6.242 4.39A.784.784 0 010 9.89V1.109A.784.784 0 011.236.468l6.242 4.39a.784.784 ' +
  '0 010 1.283z';

/** The design's filled play-triangle "horn" glyph, hand-drawn to match `LBPSeekHorn` verbatim.
 *  Default size 8 (the double-tap seek toast's own usage size); height is derived from the
 *  design's `size * 11 / 8` aspect (the 8×11 viewBox). */
export function SeekHornGlyph(props: SeekHornGlyphProps): ReactElement {
  const { size = 8, opacity = 1 } = props;
  return (
    <View style={{ opacity }}>
      <Svg width={size} height={(size * 11) / 8} viewBox="0 0 8 11">
        <Path d={SEEK_HORN_D} fill="#FFFFFF" fillRule="evenodd" />
      </Svg>
    </View>
  );
}
