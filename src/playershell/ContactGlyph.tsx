// ContactGlyph — self-drawn FILLED dual speech-bubble + question-mark icon
// (design `Icons.contact`, "聯繫商家" / customer-service semantic).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-contact-glyph).
// Design: `design/shared/icons.jsx` `Icons.contact` (24px viewBox, `stroke="none"`,
//   `fill=currentColor`) — a SINGLE filled path whose `d` string carries 4 subpaths (small
//   trailing/upper-right speech bubble, large leading/lower-left speech bubble, the
//   question-mark's dot, the question-mark's hook) that collapse into the final silhouette via
//   SVG's default nonzero winding fill rule. Straight lines + cubic beziers only (no arcs).
//
// `d` copied verbatim (programmatically extracted, not hand-transcribed) from Android
// `IconGlyphs.kt`'s `D_CONTACT` constant, and cross-checked point-for-point against iOS
// `Glyphs/ContactGlyph.swift`'s 4 `addCurve`/`addLine` subpaths — both platforms draw the exact
// same coordinates (iOS's `Z` + next `M` is the same shape as this file's `ZM` — a closepath
// immediately followed by a moveto, just written without the space).
//
// Replaces the generic chat-bubble emoji `'💬'` previously reused at all three RN
// "聯繫商家" call sites (`OperationRailView`'s `ServiceLink` rail pill, `LiveMoreMenuView`'s
// 「客服」cell, `VideoInfoPanelView`'s footer CTA) — the SAME emoji `railGlyphFor(Chat)` still
// uses for the unrelated plain-chat semantic (unaffected by this change). Matches iOS
// `ContactGlyph` (`rb-ios-icon-parity`, 2026-08-25 redesign, replacing SF Symbol
// `bubble.left.fill`), Android `ContactGlyph` (`rb-android-icon-parity`), and Flutter
// `ContactGlyph` (`rb-flutter-icon-parity-operation-rail-batch`) — RN was the only platform
// still missing this component.
//
// Follows the same `react-native-svg` single-filled-path convention as `BagGlyph.tsx` (NOT the
// multi-shape stroke convention of `DetailGlyph.tsx`) — `Icons.contact` has no stroke elements.
//
// Pure presentation: only `color` / `size` props, no state.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export interface ContactGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's dual speech-bubble + question-mark "聯繫商家" glyph, hand-copied from
 *  `Icons.contact`'s own `d` string. Default size 24 (design viewBox) — every existing call
 *  site passes an explicit size. */
export function ContactGlyph(props: ContactGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.4851 18.6388C23.4301 17.5213 24.0001 16.1225 24.0001 14.6C24.0001 10.955 20.7751 8 16.8001 8C16.7883 8 16.7769 8.0015 16.7651 8.0016C16.7813 8.1988 16.8001 8.3975 16.8001 8.6C16.8001 12.2983 13.8121 15.395 9.8213 16.1938C10.6013 19.0662 13.3913 21.2 16.8001 21.2C18.0634 21.2 19.2496 20.8997 20.2819 20.3757C21.1951 20.825 22.3538 21.2 23.7113 21.2C23.826 21.2 23.9273 21.1353 23.9746 21.0273C24.0207 20.9193 23.9993 20.7968 23.9205 20.714C23.9101 20.7013 23.0963 19.8238 22.4851 18.6388ZM15.6001 8.6C15.6001 4.955 12.1088 2 7.8001 2C3.4913 2 0.0001 4.955 0.0001 8.6C0.0001 10.0839 0.5858 11.4485 1.5627 12.5525C0.9481 13.781 0.0916 14.702 0.0781 14.7155C-0.0007 14.7982 -0.0221 14.9208 0.024 15.0288C0.0713 15.1363 0.1726 15.2 0.2873 15.2C1.7254 15.2 2.9408 14.783 3.8776 14.2985C5.0326 14.8663 6.3676 15.2 7.8001 15.2C12.1088 15.2 15.6001 12.245 15.6001 8.6ZM7.8188 12.8C7.3013 12.8 6.9001 12.3988 6.9001 11.8812C6.9001 11.3649 7.3017 10.9636 7.8177 10.9636C8.3341 10.9636 8.7353 11.3652 8.7353 11.8812C8.7338 12.3988 8.3326 12.8 7.8188 12.8ZM9.7913 8.4275L8.5051 9.23L8.5051 9.2873C8.5051 9.6601 8.1896 9.9755 7.817 9.9755C7.4443 9.9755 7.1288 9.6612 7.1288 9.29L7.1288 8.8287C7.1288 8.5994 7.2435 8.3701 7.4729 8.2265L9.1075 7.2515C9.3076 7.1375 9.4238 6.935 9.4238 6.7062C9.4238 6.3621 9.137 6.0755 8.7931 6.0755L7.3013 6.0755C6.9571 6.0755 6.6706 6.3622 6.6706 6.7062C6.6706 7.079 6.3551 7.3944 5.9824 7.3944C5.6097 7.3944 5.2943 7.0789 5.2943 6.7062C5.2951 5.5891 6.1838 4.7 7.3013 4.7L8.7923 4.7C9.9113 4.7 10.8001 5.5891 10.8001 6.7062C10.8001 7.3963 10.4288 8.0563 9.7913 8.4275Z"
        fill={color}
        stroke="none"
      />
    </Svg>
  );
}
