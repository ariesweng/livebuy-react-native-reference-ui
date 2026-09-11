import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

// MARK: - PersonEditGlyph — self-drawn person-edit (head + pencil badge) nickname icon
//
// Spec: `reference-ui-rendering/spec.md` (rb-align-nickname-icon-person-edit).
// RN parity of iOS `Glyphs/PersonEditGlyph.swift` / Android `PersonEditGlyph.kt` / Flutter
// `person_edit_glyph.dart`. Design `design/shared/icons.jsx` `Icons.personEdit` (24px viewBox,
// `stroke="currentColor"`, `strokeWidth=1.8`, round cap/join, `fill="none"`):
//
//   <circle cx="10" cy="8" r="3.2" />
//   <path d="M3 21c0-4 3-6 7-6" />
//   <path d="M14 18l5-5 2 2-5 5h-2v-2z" />
//
// rb-rn-personedit-pencil-badge-visibility-fix (2026-09-11): this used to be a `View`-composed
// approximation (bordered circle + bordered arch + rotated rect for the pencil badge) from
// before this package depended on `react-native-svg`. That approximation's pencil badge had a
// structural bug (border width consumed the entire box height at every `size`, confirmed via a
// real-device screenshot to render as an unrecognizable diagonal sliver merged into the
// shoulders) and, even after fixing that arithmetic (filled instead of bordered), still didn't
// read as a "pencil" — a plain rotated bar next to a person silhouette isn't legible as an edit
// affordance no matter how it's filled. `react-native-svg` is ALREADY a peer dependency of this
// package (used by `BagGlyph` / `CcGlyph` / `DetailGlyph` / `HeartFillGlyph` / `HeartGlyph` /
// `MegaphoneGlyph` / `PeopleGlyph` / `ShareFillGlyph` / `SpeakerGlyphs` — `PersonEditGlyph`
// and `ShareGlyph` were simply never migrated when it was added), so this draws the design's
// exact `d` path data verbatim instead of approximating it with the CSS box model — true vector
// parity with the iOS/Android/Flutter siblings, not just "same design intent".
//
// Pure presentation: only `color` / `size` props. The nickname BEHAVIOR (`onNickname`) is
// unchanged — this is a pixel-only fix.

export function PersonEditGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 18 } = props;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={10} cy={8} r={3.2} />
      <Path d="M3 21c0-4 3-6 7-6" />
      <Path d="M14 18l5-5 2 2-5 5h-2v-2z" />
    </Svg>
  );
}
