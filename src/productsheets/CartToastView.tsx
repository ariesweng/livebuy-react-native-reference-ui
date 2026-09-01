// CartToastView — family-3 add-to-cart success toast (~1.8s confirmation, RN).
//
// Spec: `reference-ui-rendering/spec.md` § "渲染 React Native 加入購物車成功提示 toast".
// Design: `design/templates/minimal/sdk-components.jsx` `LBPCartToast`.
// RN parity of iOS `CartToastView.swift` (rb-ios-cart-add-success-toast) + Android
// `CartToastView.kt` (rb-android-cart-add-success-toast).
//
// A small dark-glass pill flashed for ~1.8s after an add-to-cart SUCCEEDS (the bound
// template's `cartCTAState.count` ticks up). It is PURE 呈現: it reads only `theme` (accent
// ring) + a label, owns NO timer, NO business state, and NO trigger logic — `ProductSheetsView`
// drives its presentation (transient `useState`, `setTimeout` auto-dismiss). The container wraps
// it in a `pointerEvents="none"` overlay so it never eats taps (iOS `allowsHitTesting(false)`
// parity).
//
// RENDER DISCIPLINE (iOS / Android / Flutter lessons baked in): plain View / Text only — NO
// ScrollView / FlatList, NO network Image, NO platform Switch, NO Animated / randomness (the
// react-test-renderer structural snapshot stays deterministic). The checkmark is a deterministic
// Text glyph `✓` (parity to the close `×` glyph convention — iOS SF Symbols / Flutter Icons).

import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from '../TightText';

import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';

// MARK: - Decorative design tokens (literal minimal hex from LBPCartToast)

/** `rgba(20,20,24,0.86)` — the dark glass pill fill (`LBPCartToast`), parity iOS/Android. */
const GLASS_FILL = 'rgba(20,20,24,0.86)';
/** On-glass primary text — white (`#fff` in the design). */
const ON_GLASS_TEXT = '#FFFFFF';
/** Accent-ring checkmark diameter (design `LBPCartToast` 24px circle). */
const CHECK_SIZE = 24;

/** Confirmation glyph (`checkmark` / `Icons.check`) — deterministic Text glyph. */
const GLYPH_CHECK = '✓';

/** The confirmation label (design default 「已加入購物車」). */
const DEFAULT_LABEL = '已加入購物車';

/** Props for the family-3 add-to-cart success toast. */
export interface CartToastViewProps {
  /** The resolved reference-ui theme (FIRST, always). The accent drives the checkmark ring. */
  readonly theme: ReferenceUITheme;
  /** The confirmation label (design default 「已加入購物車」). */
  readonly label?: string;
}

/**
 * The add-to-cart success toast: a dark-glass pill with an accent-ringed checkmark + a
 * confirmation label (「已加入購物車」). Pure presentation — the container drives presentation +
 * auto-dismiss; this surface only paints. It renders correctly with no callbacks (none exist).
 */
export function CartToastView(props: CartToastViewProps): ReactElement {
  const { theme, label = DEFAULT_LABEL } = props;
  const fontScale = theme.fontScale;

  return (
    <View
      testID={LBTestIDs.cartToast}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        paddingLeft: 12,
        paddingRight: 16,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: GLASS_FILL,
      }}
    >
      {/* Accent-ringed checkmark (design `LBPCartToast` accent circle + white tick). */}
      <View
        style={{
          width: CHECK_SIZE,
          height: CHECK_SIZE,
          borderRadius: CHECK_SIZE / 2,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 9,
        }}
      >
        <Text style={{ color: ON_GLASS_TEXT, fontSize: 13 * fontScale, fontWeight: '700' }}>
          {GLYPH_CHECK}
        </Text>
      </View>
      <Text style={{ color: ON_GLASS_TEXT, fontSize: 13.5 * fontScale, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}
