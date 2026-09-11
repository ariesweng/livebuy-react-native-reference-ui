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
// ScrollView / FlatList, NO network Image, NO platform Switch, NO randomness (the
// react-test-renderer structural snapshot stays deterministic). The checkmark is a self-drawn
// vector `CheckGlyph` (`react-native-svg`, parity iOS SF Symbol `checkmark` / Android
// `IconGlyphs.kt`'s `CheckGlyph` / Flutter `Icons.check` — replaces a prior deterministic-but-
// non-vector `Text` glyph `✓`, rb-rn-icon-parity-carttoast-check-glyph).
//
// ENTRANCE BOUNCE (rb-rn-icon-parity-carttoast-check-glyph): the checkmark badge now springs in
// (scale 0.4 → 1.0 overshoot-and-settle) via `Animated`, parity iOS `withAnimation(.spring(...))`
// / Android `Animatable` spring / Flutter `TweenAnimationBuilder` `elasticOut` — this package's
// established "`Animated` + jest-mock-synced" idiom already used by `LiveNowPillView.tsx`
// (pulsing dot), `MarqueeTitleView.tsx`, `HeartBurst.tsx`, and `SlideUpSheet.tsx` (a PRIOR
// revision of this file's header claimed "NO Animated", which predated all of those and is no
// longer accurate for this package). The structural snapshot stays deterministic via the SAME
// technique `SlideUpSheet` uses: the `Animated.Value` is constructed directly at its RESTING
// value (`1`, not the small entrance value `0.4`) — the in-package `react-native` jest mock's
// `Animated.Value.setValue` is an inert no-op (the class field is `readonly`), so the value a
// snapshot observes never drifts off `1` even though the real (non-mocked) runtime effect calls
// `setValue(0.4)` before springing back up.

import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { Animated, View } from 'react-native';
import { Text } from '../TightText';

import { CheckGlyph } from './CheckGlyph';
import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';

// MARK: - Decorative design tokens (literal minimal hex from LBPCartToast)

/** `rgba(20,20,24,0.86)` — the dark glass pill fill (`LBPCartToast`), parity iOS/Android. */
const GLASS_FILL = 'rgba(20,20,24,0.86)';
/** On-glass primary text — white (`#fff` in the design). */
const ON_GLASS_TEXT = '#FFFFFF';
/** Accent-ring checkmark diameter (design `LBPCartToast` 24px circle). */
const CHECK_SIZE = 24;

/** `CheckGlyph` icon size inside the accent-ring badge (parity Android `Modifier.size(13.dp)`). */
const CHECK_GLYPH_SIZE = 13;

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
 * auto-dismiss; this surface only paints + (on mount) springs the checkmark badge in. It renders
 * correctly with no callbacks (none exist).
 */
export function CartToastView(props: CartToastViewProps): ReactElement {
  const { theme, label = DEFAULT_LABEL } = props;
  const fontScale = theme.fontScale;

  // Checkmark badge entrance bounce (parity iOS `checkScale` spring / Android `Animatable`
  // spring / Flutter `TweenAnimationBuilder` elasticOut — see file header). Constructed at the
  // RESTING value (1) so the structural snapshot captures the final state byte-stably (the
  // jest mock's `Animated.Value.setValue` is an inert no-op); the real runtime effect below
  // snaps it small and springs it back for the live bounce.
  const checkScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    checkScale.setValue(0.4);
    const animation = Animated.spring(checkScale, {
      toValue: 1,
      damping: 10,
      stiffness: 180,
      mass: 1,
      delay: 60,
      useNativeDriver: true,
    });
    animation.start();
    return (): void => animation.stop();
  }, [checkScale]);

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
      {/* Accent-ringed checkmark (design `LBPCartToast` accent circle + white tick), springs in. */}
      <Animated.View
        style={{
          width: CHECK_SIZE,
          height: CHECK_SIZE,
          borderRadius: CHECK_SIZE / 2,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 9,
          transform: [{ scale: checkScale }],
        }}
      >
        <CheckGlyph color={ON_GLASS_TEXT} size={CHECK_GLYPH_SIZE} />
      </Animated.View>
      <Text style={{ color: ON_GLASS_TEXT, fontSize: 13.5 * fontScale, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}
