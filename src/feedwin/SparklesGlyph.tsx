// SparklesGlyph — self-drawn FILLED "sparkles" icon (design `Icons.sparkles`, SF `sparkles`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-chatfeed-ai-host-badge). Backs
// `ChatFeedView.tsx`'s `HostChatRow` 24px accent icon rail — the AI-reply chat-line identity
// badge, previously a plain `✨` emoji `<Text>`. Most emoji glyphs ignore an explicit `Text`
// `color` and render via the platform's own emoji font, so the rail could never take an arbitrary
// fill color — a parity gap against Android `IconGlyphs.kt`'s `SparklesGlyph` (Canvas
// `fillPath` × 2, `D_SPARKLE_BIG` + `D_SPARKLE_SMALL`, colorable) and iOS's SF Symbol
// `Image(systemName: "sparkles")` (`.foregroundColor(...)`, also colorable). Flutter uses
// Material `Icons.auto_awesome` (also colorable) — RN was the only platform stuck on an
// uncolorable emoji.
//
// Design: `design/shared/icons.jsx` `Icons.sparkles` — two paths, viewBox 0 0 24 24:
//   `M9 6Q9 13 16 13Q9 13 9 20Q9 13 2 13Q9 13 9 6Z` (big 4-point star)
//   `M17.5 3Q17.5 6 20.5 6Q17.5 6 17.5 9Q17.5 6 14.5 6Q17.5 6 17.5 3Z` (small 4-point star)
// copied VERBATIM, byte-identical to Android's own `IconGlyphs.D_SPARKLE_BIG` /
// `D_SPARKLE_SMALL` constants (already pixel-verified there — see `ChatFeed.kt`'s
// `SparklesGlyph(color = Color.White, modifier = Modifier.size(13.dp))` call site). Both paths
// use only `M`/`Q`/`Z` commands (no elliptical arcs), so `icon-authoring.md` 規則 1 (arc →
// cubic-bezier conversion) does not apply — `react-native-svg`'s `<Path>` accepts `Q` directly.
//
// NOTE: `design/templates/minimal/moments.jsx`'s `LBChatLine` function ALSO carries its own
// inline duplicate AI-slot SVG (a single 4-point star `<path d="M12 2.5l1.7 5.3 5.3 1.7-5.3
// 1.7L12 16.5l-1.7-5.3L5 9.5l5.3-1.7z" />` + a small `<circle>`) that differs from
// `Icons.sparkles` above. This component deliberately follows the ALREADY-ESTABLISHED,
// pixel-verified Android `D_SPARKLE_BIG` / `D_SPARKLE_SMALL` shapes (per this change's scope),
// not that inline duplicate — reconciling the two design paths, if needed, is a separate
// design-layer concern out of scope here.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface SparklesGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's filled big+small 4-point-star sparkles glyph, copied verbatim from
 *  `Icons.sparkles` / Android `D_SPARKLE_BIG` + `D_SPARKLE_SMALL`. Default size 13 — matches
 *  Android's `HostChatRow`-equivalent call-site size (`ChatFeed.kt`'s `SparklesGlyph(...,
 *  modifier = Modifier.size(13.dp))`). */
export function SparklesGlyph(props: SparklesGlyphProps): ReactElement {
  const { color, size = 13 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M9 6Q9 13 16 13Q9 13 9 20Q9 13 2 13Q9 13 9 6Z" />
      <Path d="M17.5 3Q17.5 6 20.5 6Q17.5 6 17.5 9Q17.5 6 14.5 6Q17.5 6 17.5 3Z" />
    </Svg>
  );
}
