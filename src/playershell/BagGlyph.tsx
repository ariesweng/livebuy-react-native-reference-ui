// BagGlyph — self-drawn FILLED "shopping bag" icon (design `Icons.bag`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-bag-cart-batch).
// Design: `design/shared/icons.jsx` `Icons.bag` (24px viewBox, `stroke="none"`,
//   `fill=currentColor`, 2026-08-25 定版) — a SINGLE filled path whose `d` string carries 3
//   subpaths (outer silhouette + handle-ring hole + lower-belly-band hole) that collapse into a
//   punched-out silhouette via SVG's default nonzero winding fill rule:
//
//   d="M17.44 9L15.89 9C15.89 6.85 14.15 5.11 12 5.11C9.85 5.11 8.11 6.85 8.11 9L6.56 9
//      C5.7 9 5.01 9.7 5.01 10.56L5 19.89C5 20.74 5.7 21.44 6.56 21.44L17.44 21.44
//      C18.3 21.44 19 20.74 19 19.89L19 10.56C19 9.7 18.3 9 17.44 9Z
//      M12 6.67C13.29 6.67 14.33 7.71 14.33 9L9.67 9C9.67 7.71 10.71 6.67 12 6.67Z
//      M12 14.44C9.85 14.44 8.11 12.7 8.11 10.56L10.4 10.56C10.4 11.469 11.114 12.2 12 12.2
//      C12.886 12.2 13.6 11.469 13.6 10.56L15.89 10.56C15.89 12.7 14.15 14.44 12 14.44Z"
//
// Replaces the PRIOR `View`-border outline technique (bordered rounded-bottom rect body +
// bordered ∩-ring handle, no belly-band hole) — that technique predated this package's
// `react-native-svg` dependency (its header used to read "RN has NO Canvas / react-native-svg",
// which is now stale: `react-native-svg` is a `package.json` peerDependency (`15.15.5`) and
// `CcGlyph.tsx` / `DetailGlyph.tsx` / `ShareFillGlyph.tsx` already self-draw with it). This
// glyph now follows the same convention: `react-native-svg`'s `<Path>` parses the design's `d`
// string verbatim (three `M`/`Z` subpaths), so the path is copied straight from the design
// source rather than hand-translated into Bézier control points — zero transcription error.
// `viewBox="0 0 24 24"` lets `width`/`height` scale the whole 24-unit coordinate space via
// `size`, so (unlike the old View technique) nothing needs to be manually multiplied by `s`.
//
// RN parity of iOS SF Symbol `bag` (stroke)/Android `BagGlyph` (`IconGlyphs.D_BAG`, filled path
// per the same 2026-08-25 design revision) — note iOS's SF Symbol choice predates this design
// revision and is tracked separately; this file only concerns the RN reference-ui glyph.
//
// `BagGlyph` remains the glyph used at the chat / sale-card / bottom-bar / floating-bag action
// slots; the footer「查看購物車」CTA uses the separate `CartFillGlyph`
// (`productsheets/CartFillGlyph.tsx`, aligned to design `cartFill`, NOT `Icons.bag`) — mirroring
// iOS's SF `bag` vs hand-drawn `CartFillGlyph` two-glyph split at those two distinct slots.
//
// Export signature (`color` / `size` props, default `size = 16`) is UNCHANGED from the prior
// `View`-drawn implementation — all 5 existing call sites (`OperationRailView.tsx`,
// `LiveBottomBarView.tsx`, `ChatFeedView.tsx`, plus 2 test files) need no changes.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface BagGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's single filled/punched-out shopping-bag silhouette, hand-copied from
 *  `Icons.bag`'s own `d` string. Default size 16 (prior implementation's default, unchanged). */
export function BagGlyph(props: BagGlyphProps): ReactElement {
  const { color, size = 16 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M17.44 9L15.89 9C15.89 6.85 14.15 5.11 12 5.11C9.85 5.11 8.11 6.85 8.11 9L6.56 9C5.7 9 5.01 9.7 5.01 10.56L5 19.89C5 20.74 5.7 21.44 6.56 21.44L17.44 21.44C18.3 21.44 19 20.74 19 19.89L19 10.56C19 9.7 18.3 9 17.44 9ZM12 6.67C13.29 6.67 14.33 7.71 14.33 9L9.67 9C9.67 7.71 10.71 6.67 12 6.67ZM12 14.44C9.85 14.44 8.11 12.7 8.11 10.56L10.4 10.56C10.4 11.469 11.114 12.2 12 12.2C12.886 12.2 13.6 11.469 13.6 10.56L15.89 10.56C15.89 12.7 14.15 14.44 12 14.44Z"
        fill={color}
        stroke="none"
      />
    </Svg>
  );
}
