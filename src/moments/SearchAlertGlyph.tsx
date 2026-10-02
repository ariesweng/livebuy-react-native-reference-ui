import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

// SearchAlertGlyph — the error screen's `notFound` icon: a magnifying glass with an exclamation
// mark inside the lens ("looked for it, it is not there").
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-emoji-magnifier-and-row-overlay-fix).
// Design `design/templates/minimal/moments.jsx` `LBErrorScreen` → `config.notFound.icon`:
//   <svg viewBox="0 0 24 24" fill="none" stroke={DANGER} strokeWidth="2" round cap/join>
//     <circle cx="11" cy="11" r="7" />
//     <line x1="21" y1="21" x2="16.5" y2="16.5" />      // handle
//     <line x1="11" y1="8" x2="11" y2="11.5" />          // exclamation stem
//     <line x1="11" y1="14" x2="11" y2="14" />           // exclamation dot (zero-length, round cap)
//   </svg>
//
// Replaces the literal emoji `Text` glyph (`'🔍'`), which ignored the tint colour and rendered as a
// colour-emoji bitmap. The dot is drawn as a 0.01-long segment rather than a true zero-length one:
// a round-capped zero-length segment is a dot in the SVG spec, but not every native path renderer
// draws it.
//
// Pure presentation: only `color` / `size` props, no state.

const D_HANDLE = 'M21 21L16.5 16.5';
const D_EXCLAMATION_STEM = 'M11 8V11.5';
const D_EXCLAMATION_DOT = 'M11 14h0.01';

export interface SearchAlertGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design `notFound` icon (lens + handle + exclamation mark). Default size 24 (design viewBox). */
export function SearchAlertGlyph(props: SearchAlertGlyphProps): ReactElement {
  const { color, size = 24 } = props;
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
      <Circle cx={11} cy={11} r={7} />
      <Path d={D_HANDLE} />
      <Path d={D_EXCLAMATION_STEM} />
      <Path d={D_EXCLAMATION_DOT} />
    </Svg>
  );
}
