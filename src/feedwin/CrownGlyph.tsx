// CrownGlyph — self-drawn FILLED "crown" icon (design `Icons.crown`, SF `crown.fill`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-chatfeed-ai-host-badge). Backs
// `ChatFeedView.tsx`'s `HostChatRow` 24px accent icon rail — the host (non-AI) chat-line identity
// badge, previously a plain `👑` emoji `<Text>`. Most emoji glyphs ignore an explicit `Text`
// `color` and render via the platform's own emoji font, so the rail could never take an arbitrary
// fill color — a parity gap against Android `IconGlyphs.kt`'s `CrownGlyph` (Canvas `fillPath`,
// `D_CROWN`, colorable) and iOS's SF Symbol `Image(systemName: "crown.fill")`
// (`.foregroundColor(...)`, also colorable). Flutter uses Material `Icons.workspace_premium`
// (also colorable) — RN was the only platform stuck on an uncolorable emoji.
//
// Design: `design/shared/icons.jsx` `Icons.crown` — `d="M3 8 L7 12 L12 5.5 L17 12 L21 8 L19.3
// 18.5 L4.7 18.5 Z"`, viewBox 0 0 24 24 — copied VERBATIM, byte-identical to Android's own
// `IconGlyphs.D_CROWN` constant (already pixel-verified there — see `ChatFeed.kt`'s
// `CrownGlyph(color = Color.White, modifier = Modifier.size(12.dp))` call site). Path is built
// entirely from `M`/`L`/`Z` commands (no arcs), so `icon-authoring.md` 規則 1 (arc → cubic-bezier
// conversion) does not apply.
//
// NOTE: `design/templates/minimal/moments.jsx`'s `LBChatLine` function ALSO carries its own
// inline duplicate host-slot SVG (`<path d="M4 8l3.6 2.8L12 5l4.4 5.8L20 8l-1.4 9.5H5.4L4 8z" />`,
// a stroked outline, not filled) that differs from `Icons.crown` above. This component
// deliberately follows the ALREADY-ESTABLISHED, pixel-verified Android `D_CROWN` shape (per this
// change's scope), not that inline duplicate — reconciling the two design paths, if needed, is a
// separate design-layer concern out of scope here.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface CrownGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's filled 3-peak crown glyph, copied verbatim from `Icons.crown` / Android
 *  `D_CROWN`. Default size 12 — matches Android's `HostChatRow`-equivalent call-site size
 *  (`ChatFeed.kt`'s `CrownGlyph(..., modifier = Modifier.size(12.dp))`). */
export function CrownGlyph(props: CrownGlyphProps): ReactElement {
  const { color, size = 12 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M3 8 L7 12 L12 5.5 L17 12 L21 8 L19.3 18.5 L4.7 18.5 Z" />
    </Svg>
  );
}
