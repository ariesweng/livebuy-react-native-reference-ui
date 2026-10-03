import type { ReactElement } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// ActivityTierGlyphs — vector icons for the activity row's tier slot (rb-rn-feed-emoji-glyph-parity),
// replacing the emoji `👤` / `🏆`. Path data copied from `design/shared/icons.jsx`
// (`personBadgePlus`, `trophy`; 24 viewBox, stroke 1.8 round). The slot is currently hidden
// (`SHOW_FEED_ICON_SLOT = false` in `ChatFeedView.tsx`); these keep it emoji-free when it returns.

export interface ActivityTierGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** `Icons.personBadgePlus` — head + shoulders + a plus badge. */
export function PersonBadgePlusGlyph(props: ActivityTierGlyphProps): ReactElement {
  const { color, size = 12 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={9.2} cy={7.5} r={3} fill={color} stroke="none" />
      <Path d="M3.5 19C3.5 14.4 6 12.8 9.3 12.8C12.6 12.8 15 14.4 15 19Z" fill={color} stroke="none" />
      <Path d="M18.5 4L18.5 9M16 6.5L21 6.5" />
    </Svg>
  );
}

/** `Icons.trophy` — cup + two handles + stem + base. The handles are the only stroked parts and use
 *  the design's per-path `strokeWidth="1.5"`, so it is set once on the `Svg`. */
export function TrophyGlyph(props: ActivityTierGlyphProps): ReactElement {
  const { color, size = 12 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 5L17 5L16.5 10C16.5 12.5 14.5 14 12 14C9.5 14 7.5 12.5 7.5 10Z" fill={color} stroke="none" />
      <Path d="M7.3 6C4.5 6 4.5 10.5 8 10.5" />
      <Path d="M16.7 6C19.5 6 19.5 10.5 16 10.5" />
      <Rect x={11} y={13.5} width={2} height={3.5} fill={color} stroke="none" />
      <Rect x={8} y={17} width={8} height={2.8} rx={1} fill={color} stroke="none" />
    </Svg>
  );
}
