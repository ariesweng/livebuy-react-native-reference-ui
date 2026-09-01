import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - ShopBagGlyph — self-drawn outline shopping-bag glyph (design `Icons.shopBag`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-cart-cta-shopbag-glyph).
// RN parity of iOS / Android `ShopBagGlyph` (Android `IconGlyphs.kt` D_SHOP_BAG_*). RN has NO
// Canvas / react-native-svg, so the glyph is drawn with deterministic `View`s — the same
// View-drawing convention as `ShareGlyph` / `PersonEditGlyph` — NOT the prior 🛍 emoji.
//
// Geometry mirrors design `shopBag` (24-unit space, scaled by `s = size/24`):
//   body   M6 8h12l-1 12a2 2 0 01-2 2H9a2 2 0 01-2-2L6 8z  → bordered rounded-bottom rect (6,8)-(18,22)
//   handle M9 8V6a3 3 0 016 0v2                            → ∩ ring: top semicircle (r=3) + 2 sides, open bottom
//   mouth  M9 12h6                                         → horizontal hairline at y=12, x9→x15
// The FULL handle ring + mouth line is exactly what distinguishes `shopBag` from the simple `bag`.

// Stroke bumped 1.8 → 2.3 to visually compensate for iOS SF Symbol `.semibold`/`.bold`
// rendering more thickly than this literal View-border trace (rb-bag-glyph-stroke-weight,
// same value across RN/Android/Flutter for cross-platform consistency).
const STROKE = 2.3;

export function ShopBagGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 20 } = props;
  const s = size / 24;
  const stroke = STROKE * s;

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {/* Handle ∩ ring (rendered first, under the bag top edge). Bounding box (9,3)-(15,8):
          rounded-top semicircle (r=3) + two straight sides, open bottom. */}
      <View
        style={{
          position: 'absolute',
          left: 9 * s,
          top: 3 * s,
          width: 6 * s,
          height: 5 * s,
          borderColor: color,
          borderTopWidth: stroke,
          borderLeftWidth: stroke,
          borderRightWidth: stroke,
          borderBottomWidth: 0,
          borderTopLeftRadius: 3 * s,
          borderTopRightRadius: 3 * s,
        }}
      />
      {/* Bag body — bordered rounded-bottom rect (6,8)-(18,22) (top corners ~sharp per design). */}
      <View
        style={{
          position: 'absolute',
          left: 6 * s,
          top: 8 * s,
          width: 12 * s,
          height: 14 * s,
          borderColor: color,
          borderWidth: stroke,
          borderBottomLeftRadius: 2.5 * s,
          borderBottomRightRadius: 2.5 * s,
        }}
      />
      {/* Mouth line — horizontal hairline at y=12, x9→x15. */}
      <View
        style={{
          position: 'absolute',
          left: 9 * s,
          top: 12 * s - stroke / 2,
          width: 6 * s,
          height: stroke,
          borderRadius: stroke / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
