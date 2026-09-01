import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - BagGlyph — self-drawn outline shopping-bag glyph (design `Icons.bag`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-bag-glyph-stroke-align).
// RN parity of iOS SF Symbol `bag` (stroke) / Android `BagGlyph` (`IconGlyphs.D_BAG`). RN has
// NO Canvas / react-native-svg, so the glyph is drawn with deterministic `View`s — the same
// View-drawing convention as `ShopBagGlyph` / `ShareGlyph` / `PersonEditGlyph` — NOT a filled
// `🛍` emoji.
//
// `BagGlyph` is `ShopBagGlyph` WITHOUT the bag-mouth line (`M9 12h6`): the simple `bag`
// (袋身 + ∩ 提把) vs the `shopBag` (袋身 + ∩ 提把 + 袋口橫線). The footer 「查看購物車」 CTA uses
// `ShopBagGlyph`; the chat / sale-card / bottom-bar / floating-bag action bags use `BagGlyph`
// — mirroring iOS's SF `bag` vs hand-drawn `ShopBagGlyph` two-glyph split.
//
// Geometry mirrors design `bag` (24-unit space, scaled by `s = size/24`):
//   body   M6 8h12... → bordered rounded-bottom rect (6,8)-(18,22)
//   handle ∩ ring     → rounded-top semicircle (r=3) + two sides, open bottom

// Stroke bumped 1.8 → 2.3 to visually compensate for iOS SF Symbol `.semibold`/`.bold`
// rendering more thickly than this literal View-border trace (rb-bag-glyph-stroke-weight,
// same value across RN/Android/Flutter for cross-platform consistency).
const STROKE = 2.3;

export function BagGlyph(props: { color: string; size?: number }): ReactElement {
  const { color, size = 16 } = props;
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
    </View>
  );
}
