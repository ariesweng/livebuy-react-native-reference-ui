// ArrowDownGlyph — self-drawn simple down arrow (design `Icons.arrowDown`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-chat-returntolatest-arrow).
// Design: `design/shared/icons.jsx` `Icons.arrowDown` (24px viewBox, stroke 1.8 default,
// fill none) — single `d`:
//   M12 4V20M6 14L12 20L18 14   (vertical shaft + down-chevron head)
//
// Replaces the bare Unicode `"↓"` prefix previously baked into the chat feed's「回到最新訊息」
// pill `Text` string — the same反模式 that was already fixed on iOS (`Glyphs/ArrowDownGlyph.swift`),
// Android (`IconGlyphs.kt`'s `ArrowDownGlyph`, `rb-android-icon-parity`), and Flutter
// (`ArrowDownGlyph` widget, `rb-flutter-icon-parity-chat-returntolatest-arrow`). RN was the last
// platform still carrying the reversed anti-pattern (tracked as
// `docs/reference-ui/parity-debt-ledger.md` item 6 until this change).
//
// Stroke width 2 (not iOS's 1.8) — aligns with Android's `strokePath(p, color, 2f)` and the
// design source's global default stroke (`icons.jsx`'s `Icon` component default `stroke = 1.8`
// is overridden per-glyph on Android/Flutter to 2; RN follows the same precedent rather than
// introducing a third distinct value).
//
// Pure presentation: only `color` / `size` props, no state. Its only call site
// (`ChatFeedView.tsx`) uses `size={10}`.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface ArrowDownGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's simple down-arrow glyph, hand-drawn to match `Icons.arrowDown`. Default size 24
 *  (design viewBox); the chat feed's「回到最新訊息」pill call site uses `size={10}`. */
export function ArrowDownGlyph(props: ArrowDownGlyphProps): ReactElement {
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
      <Path d="M12 4V20M6 14L12 20L18 14" />
    </Svg>
  );
}
