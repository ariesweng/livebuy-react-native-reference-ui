import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';

// MARK: - SheetHeaderCloseButton — shared transparent sheet-header close affordance
//
// Spec: `reference-ui-rendering/spec.md` (family-3 product sheets / family-1 VideoInfoPanel
//        header close). RN parity of iOS `SheetKit/SheetHeaderCloseButton.swift` / Android /
//        Flutter (rb-rn-sheet-header-close-unify).
//
// One shared close glyph for EVERY bottom-sheet header (ProductListView / ProductDetailSheet /
// AddToCartSheet / NotifyRestockSheet / VideoInfoPanel), replacing the prior divergence (deep
// `bgSunken` circle on the detail/restock sheets vs the bare decorative `✕` on the list).
// Mirrors the design `Icons.close`: a TRANSPARENT 32×32 tap target (NO fill) + `✕` in
// `theme.text` (16). Tapping forwards `onPress`.
//
// When `onPress` is undefined (demo / snapshot, no host wiring) it renders an inert `View`
// (no Pressable) so the jest snapshot tree carries no extra interactive node.
//
// `isBack` (rb-rn-product-detail-recommendations, design R21 §5.4 — parity iOS `chevron.left` /
// Android `ChevronLeftGlyph`): the product-detail sheet header's SAME close button switches to a
// 「返回」(‹) glyph + a DISTINCT test id (`sheetHeaderBack`, existing `sheetHeaderClose`
// unaffected) when the container has a non-empty `detailBreadcrumb` (a nested drill-in from the
// 「更多商品」推薦格). This component has NO OPINION on what `onPress` does — the "back vs close"
// SEMANTICS live entirely in the caller (`ProductSheetsView.backOrDismiss`); this is purely a
// glyph + test-id switch. Default `false` → every pre-existing call site (list / restock /
// VideoInfoPanel / non-nested detail) stays byte-identical.

export function SheetHeaderCloseButton(props: {
  theme: ReferenceUITheme;
  onPress?: () => void;
  isBack?: boolean;
}): ReactElement {
  const { theme, onPress, isBack = false } = props;
  const glyph = (
    <Text style={{ color: theme.text, fontSize: 16 * theme.fontScale }}>
      {isBack ? '‹' : '✕'}
    </Text>
  );
  const testID = isBack ? LBTestIDs.sheetHeaderBack : LBTestIDs.sheetHeaderClose;
  const box = { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' } as const;
  if (onPress == null) {
    return <View testID={testID} style={box}>{glyph}</View>;
  }
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={box}>
      {glyph}
    </Pressable>
  );
}
