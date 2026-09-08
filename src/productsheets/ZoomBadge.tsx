// ZoomBadge — decorative media-zoom affordance (family-3 product sheets, RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-3 product + sheets — zoom badges).
// Parity of the iOS `ProductDetailSheetView` / `NotifyRestockSheetView` zoom disc
// (rb-ios-product-sheets follow-on `8f8fad0` #8) and Android `ZoomBadge.kt`. Design:
//   `design/templates/minimal/screens.jsx` — ProductDetailSheet 4:3 media zoom disc
//   (644-647: 32×32, rgba(255,255,255,0.85), Icons.zoom #15131a) and
//   NotifyRestockSheet 96×96 thumb zoom disc (790-793: 24×24, rgba(0,0,0,0.55),
//   Icons.zoom #fff).
//
// TAPPABLE (rb-rn-product-image-zoom-lightbox): the badge paints the design's media-zoom
// affordance AND, when {@link ZoomBadgeProps.onPress} is provided, opens the full-frame
// `ProductImageZoomOverlay`. The magnifier glyph is drawn with `react-native-svg` — NOT an
// emoji / network `Image` — so the structural snapshot is stable and the glyph renders
// consistently across platforms.
// `onPress` omitted (demo / snapshot) → the bare `View` (no `Pressable`) → the structural
// snapshot is byte-identical to the prior decorative badge.
//
// GEOMETRY FIX (rb-rn-product-detail-zoom-badge-glyph-alignment): the glyph previously drew
// the lens circle and the handle bar as two independently-positioned `View`s (`left`/`top`
// offsets for the lens, `right`/`bottom` offsets + `transform: rotate('45deg')` for the
// handle) with no shared reference point — the handle floated with a visible gap away from
// the lens edge AND pointed along the wrong diagonal ("/" instead of the design's "\"). The
// fix switches to `react-native-svg` and copies the design source's own coordinates
// verbatim: `design/shared/icons.jsx`'s `Icons.zoom` — `<circle cx="11" cy="11" r="6.5" />`
// for the lens + the diagonal sub-path of `<path d="M16 16l4 4M9 11h4M11 9v4" />` (only
// `M16 16l4 4`; the interior "+" crosshair sub-paths are deliberately NOT reproduced — none
// of iOS/Android/Flutter's established magnifier convention includes one, and adding it now
// would be new, unreviewed scope creep). Because these are the design's own fixed
// coordinates in a fixed `0 0 24 24` viewBox, the handle inherently starts near the lens
// edge and radiates toward the bottom-right — no rotation sign to get wrong, no independent
// magic numbers to keep in sync. Mirrors Android `ZoomBadge.kt`'s already-correct
// `MagnifierGlyph` (mathematically anchored to `lensCenter + lensRadius*0.72`) and the
// Flutter fix `rb-flutter-product-detail-zoom-badge-glyph-alignment` (archived 2026-09-07).

import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { LBTestIDs } from '../testing/LBTestIDs';

export interface ZoomBadgeProps {
  /** Disc diameter (32 on the detail 4:3 photo, 24 on the 96 thumb). */
  readonly diameter: number;
  /** Disc fill (white@0.85 on detail, black@0.55 on restock). */
  readonly discColor: string;
  /** Magnifier glyph color (#15131A on detail, white on restock). */
  readonly glyphColor: string;
  /** Positioning style — the caller insets it at the photo's bottom-trailing corner. */
  readonly style?: StyleProp<ViewStyle>;
  /**
   * Tap handler → container opens the lightbox. Omitted (demo / snapshot) → inert (no
   * `Pressable`), structural snapshot byte-identical to the prior decorative badge.
   */
  readonly onPress?: () => void;
}

/**
 * A circular zoom badge: a {@link ZoomBadgeProps.diameter} disc filled
 * {@link ZoomBadgeProps.discColor} with a centered self-drawn magnifier glyph in
 * {@link ZoomBadgeProps.glyphColor}. Tap ({@link ZoomBadgeProps.onPress}) opens the lightbox.
 */
// Glyph size relative to the disc — mirrors Android `MagnifierGlyph`'s
// `Modifier.size(diameter * 0.56f)` ratio, which also closely approximates the design's own
// per-variant `Icons.zoom` sizes (32*0.56=17.92 vs design's 18 for the 32 "light" variant,
// 24*0.56=13.44 vs design's 12 for the 24 variant) without needing a separate variant flag.
const GLYPH_SIZE_RATIO = 0.56;

export function ZoomBadge(props: ZoomBadgeProps): ReactElement {
  const { diameter, discColor, glyphColor, style, onPress } = props;
  const glyphSize = diameter * GLYPH_SIZE_RATIO;
  const discBox: ViewStyle = {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    backgroundColor: discColor,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const inner = (
    // Magnifier glyph — lens circle + diagonal handle, coordinates copied verbatim from the
    // design source `Icons.zoom` (`design/shared/icons.jsx`) in its native 24x24 viewBox. The
    // handle (`M16 16L20 20`) is the design's own fixed diagonal sub-path: it already starts
    // near the lens edge and points toward the bottom-right, so no rotation or independent
    // offset is needed. The interior "+" crosshair sub-paths of the design's full compound
    // path are intentionally omitted — see header comment.
    <Svg
      width={glyphSize}
      height={glyphSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke={glyphColor}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="M16 16L20 20" />
    </Svg>
  );
  // onPress omitted (demo / snapshot) → the bare disc View (byte-identical to the prior
  // decorative badge). Provided → a Pressable carries the positioning + tap.
  if (onPress == null) {
    return <View testID={LBTestIDs.zoomBadge} style={[discBox, style]}>{inner}</View>;
  }
  return (
    <Pressable testID={LBTestIDs.zoomBadge} onPress={onPress} style={style}>
      <View style={discBox}>{inner}</View>
    </Pressable>
  );
}
