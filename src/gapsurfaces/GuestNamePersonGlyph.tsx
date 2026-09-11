// GuestNamePersonGlyph — self-drawn outline "person" glyph for the family-6 guest
// nickname-edit modal (`GuestNameEditModalView.tsx`)'s two person-icon call sites.
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-guestname-person-glyph).
// Design: `design/templates/minimal/live-chrome.jsx` `LiveNicknameModal`'s input-row
//   inline SVG (the badge itself is the LB logo image in the design; the person glyph
//   only appears at the input-row prefix):
//
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
//        stroke={theme.surface.textDim} strokeWidth="1.8">
//     <circle cx="12" cy="9" r="3.5"/><path d="M5 21c0-4 3-6 7-6s7 2 7 6"/>
//   </svg>
//
// Parity: iOS `GapSurfaces/GuestNameEditModalView.swift` (SF Symbol `person.crop.circle.fill`
// / `person`), Android `gapsurfaces/GuestNameEditModalView.kt` (self-drawn `Canvas`
// `PersonGlyph`, a stroked head circle + shoulders arc reused at both call sites), Flutter
// `gapsurfaces/guest_name_edit_modal.dart` (Material Icons `Icons.person` / `Icons.person_outline`).
// RN was the last of the four platforms still drawing this as a bare Unicode emoji (`👤`)
// embedded in a `Text` node (rb-rn-icon-parity-guestname-person-glyph fixes exactly that —
// same class of bug as `PersonEditGlyph` / `HeartFillGlyph`: an emoji glyph ignores the
// caller's `color` and renders inconsistently across devices/fonts).
//
// This component mirrors the design's ACTUAL geometry verbatim (a stroked outline circle +
// shoulders path, `fill="none"`) rather than reusing `widget/PersonGlyph.tsx` (a DIFFERENT
// design token — `Icons.person`'s FILLED silhouette, `circle cx=12 cy=8 r=3.4` + a filled
// polygon) or `playershell/PersonEditGlyph.tsx` (a person head + pencil-badge composite for a
// different call site). Both call sites in `GuestNameEditModalView.tsx` (the `LogoBadge`
// 徽章 and the `InputRow` prefix) share this ONE component, only varying `size` / `color` —
// the same reuse pattern as Android's `PersonGlyph` Composable.
//
// No `strokeLinecap` / `strokeLinejoin` override: the design's inline SVG does not set
// either (browser default `butt` / `miter`), unlike `Icons.personEdit` (which does specify
// `round`/`round`) — this is a DIFFERENT icon definition, so this component stays literal to
// its own design source rather than borrowing `PersonEditGlyph`'s stroke-cap style.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface GuestNamePersonGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's stroked outline person glyph (head circle + shoulders path). Default size 24
 *  (design viewBox); call sites pass their own `size` (badge 24 * theme.fontScale, input row
 *  16 * theme.fontScale). */
export function GuestNamePersonGlyph(props: GuestNamePersonGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Circle cx={12} cy={9} r={3.5} />
      <Path d="M5 21c0-4 3-6 7-6s7 2 7 6" />
    </Svg>
  );
}
