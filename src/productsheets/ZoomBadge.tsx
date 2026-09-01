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
// `ProductImageZoomOverlay`. The magnifier glyph is drawn with deterministic `View`s (a
// bordered lens circle + a rotated handle) — NOT an emoji / network `Image` — so the
// structural snapshot is stable and the glyph renders consistently across platforms.
// `onPress` omitted (demo / snapshot) → the bare `View` (no `Pressable`) → the structural
// snapshot is byte-identical to the prior decorative badge.

import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

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
export function ZoomBadge(props: ZoomBadgeProps): ReactElement {
  const { diameter, discColor, glyphColor, style, onPress } = props;
  const lens = diameter * 0.42;
  const stroke = Math.max(1, Math.round(diameter * 0.08));
  const handleLen = diameter * 0.26;
  const discBox: ViewStyle = {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    backgroundColor: discColor,
  };
  const inner = (
    <>
      {/* Lens — a bordered circle in the upper-left. */}
      <View
        style={{
          position: 'absolute',
          left: diameter * 0.22,
          top: diameter * 0.22,
          width: lens,
          height: lens,
          borderRadius: lens / 2,
          borderWidth: stroke,
          borderColor: glyphColor,
        }}
      />
      {/* Handle — a short rotated bar running to the lower-right. */}
      <View
        style={{
          position: 'absolute',
          right: diameter * 0.2,
          bottom: diameter * 0.18,
          width: stroke,
          height: handleLen,
          borderRadius: stroke / 2,
          backgroundColor: glyphColor,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </>
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
