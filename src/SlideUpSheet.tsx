// SlideUpSheet — shared bottom-sheet slide animation (rb-rn-sheet-slide-consistency).
//
// Parity: iOS `BottomSheetPresenter.sheetSlide` + Android `ProductSheetsOverlayView.sheetEnter/
//          Exit` + Flutter `sheet_slide_transition.dart` (rb-*-sheet-slide-consistency). The
//          design `lbp-sheet-in` curve (`cubic-bezier(0.32, 0.72, 0.18, 1)` / 0.32s). present →
//          slide-up（卡片純位移）; dismiss → slide-down（卡片純位移）.
//
// The card carries NO fade — design `lbp-sheet-in` is translate-only (opacity stays 1); the
// `lbp-fade-in` dim belongs to the scrim/`dimUnderneath`, not the card (rb-sheet-card-slide-only).
//
// A reusable wrapper for a present/dismiss bottom sheet: it stays MOUNTED through the dismiss
// animation (so the slide-DOWN has content), measures its own height via `onLayout`, and
// translates from `+height` (below) to `0`. `useNativeDriver: true` keeps the transform on the
// UI thread. When the dismiss animation finishes it unmounts.

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Animated, Easing, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

/** Shared sheet slide duration (design `lbp-sheet-in`, 0.32s). */
const DURATION = 320;
/** Fallback slide distance until the sheet height is measured (one tall sheet's worth). */
const FALLBACK_HEIGHT = 600;

export interface SlideUpSheetProps {
  /** Whether the sheet is shown. `true` → slide up（純位移）; `false` → slide down（純位移）→ unmount. */
  readonly visible: boolean;
  /** The positioning style for the sheet container (e.g. `{ position: 'absolute', bottom: 0 }`). */
  readonly style?: StyleProp<ViewStyle>;
  /** The sheet content. KEEP it stable through dismiss (pass the last content) so the slide-out has content. */
  readonly children: ReactNode;
}

/**
 * Animate a present/dismiss bottom sheet: slide up on present, slide down on dismiss (then
 * unmount), translate-only (the card carries no fade — design `lbp-sheet-in`). Renders `null`
 * while hidden + unmounted. Mirrors the iOS / Android / Flutter sheet slide (design `lbp-sheet-in`).
 */
export function SlideUpSheet(props: SlideUpSheetProps): ReactElement | null {
  const { visible, style, children } = props;
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      // Design `lbp-sheet-in` curve (`cubic-bezier(0.32, 0.72, 0.18, 1)`). Computed here (not at
      // module scope) so importing this module in a `react-native`-mocked jest env never calls it.
      easing: Easing.bezier(0.32, 0.72, 0.18, 1),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, anim]);

  if (!mounted) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [height || FALLBACK_HEIGHT, 0],
  });

  return (
    <Animated.View
      onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}
      style={[style, { transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}
