import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

import {
  EQUALIZER_PERIOD_MS,
  EQUALIZER_PHASES,
  equalizerBarKeyframes,
  equalizerBarLeft,
  equalizerBarWidth,
  equalizerBottomInset,
  equalizerCornerRadius,
  equalizerRestingHeight,
  shouldEqualizerAnimate,
} from './equalizerMotion';

// MARK: - EqualizerGlyph — self-drawn 3-bar equalizer (design「介紹中」mark), NOW ANIMATED
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-product-list-introducing-banner for the original
// static mark; rb-rn-live-equalizer-motion for the breathing animation added here).
// RN parity of iOS `Glyphs/EqualizerGlyph.swift` / Android `IconGlyphs.kt` `EqualizerGlyph` /
// Flutter `EqualizerGlyph` — those three land the same `design/contract/equalizer-motion.json`
// motion in sibling changes (`rb-{ios,android,flutter}-live-equalizer-motion`), each in its own
// platform idiom; this file is RN's.
//
// Design source: `design/templates/minimal/sdk-components.jsx` `LBPProductRow.introBadge` +
// `live-chrome.jsx` `LBLivePinnedCard` — `Icons.equalizerLive` (design/contract/claude-design-sync
// .md R40), which replaced the previously-static `Icons.equalizer` 3-rect SVG. Geometry/motion
// constants live in `./equalizerMotion.ts` (pure, unit-tested independent of this component —
// see that file's header for why: the `Animated`-stub jest mock this package's tests run against,
// `test-support/react-native.mock.tsx`, cannot itself verify animated values).
//
// Three bottom-aligned bars breathing between `equalizer-motion.json`'s `minHeight`(29.17%) and
// `maxHeight`(70.83%) of `size`, 900ms period, phases 0/0.3333/0.6667 left to right. RN has NO
// Canvas / react-native-svg for this glyph (same constraint as `ShareGlyph.tsx` /
// `PersonEditGlyph.tsx`), so bars are still absolutely-positioned filled `View`s (now
// `Animated.View`s while animating), scaled by `size`.
//
// JS driver, not native driver + scaleY (design.md D1): `height` is a layout prop — RN's
// `useNativeDriver` does not support animating it. The alternative, `transform: scaleY` +
// `useNativeDriver: true`, would need a hand-rolled `translateY` compensation to keep the bars
// bottom-anchored (RN's transform-origin is fixed at the element center) — exactly the kind of
// cross-platform transform-origin inconsistency `equalizer-motion.json`'s own `motion.note`
// warns against ("動 height，不要動 scaleY"). For 3 small bars the JS-driven perf cost is
// negligible, so this file follows the note literally and drives `height` directly
// (`useNativeDriver: false`).
//
// Lifecycle (`equalizer-motion.json` `lifecycle`): stops and holds at `restingHeights` (NOT 0)
// when the caller passes `paused`, or when the system's reduced-motion setting is on
// (`AccessibilityInfo.isReduceMotionEnabled()` at mount + `reduceMotionChanged` thereafter).
// Unmounting stops the loop and removes the subscription (this component's own `useEffect`
// cleanups) — that alone satisfies the lifecycle's "元件離開畫面" stop condition. The remaining
// `stopWhen` entries (player paused/buffering, cell/view recycle, App backgrounded) are NOT wired
// here: neither existing call site threads a playback-state signal down to this leaf glyph today
// (design.md Non-Goals) — `paused` is exposed so a future call site CAN drive it without any
// further change to this file.

export function EqualizerGlyph(props: {
  size: number;
  color: string;
  /** Hold the static resting frame instead of breathing — e.g. a future call site could pass
   *  this while the player is paused/buffering. Omitted / `false` (default) → animates whenever
   *  the system's reduce-motion setting also allows it. Existing call sites need no change. */
  paused?: boolean;
}): ReactElement {
  const { size, color, paused = false } = props;
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => setReducedMotion(enabled),
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const animating = shouldEqualizerAnimate(paused, reducedMotion);
  const clock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animating) return undefined;
    clock.setValue(0);
    const loop = Animated.loop(
      Animated.timing(clock, {
        toValue: 1,
        duration: EQUALIZER_PERIOD_MS,
        easing: Easing.linear,
        useNativeDriver: false, // `height` is a layout prop — see file header D1.
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animating, clock]);

  const bottomInset = equalizerBottomInset(size);
  const barWidth = equalizerBarWidth(size);
  const cornerRadius = equalizerCornerRadius(size);

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {EQUALIZER_PHASES.map((phase, i) => {
        const base = {
          position: 'absolute' as const,
          left: equalizerBarLeft(i, size),
          bottom: bottomInset,
          width: barWidth,
          borderRadius: cornerRadius,
          backgroundColor: color,
        };
        if (!animating) {
          return <View key={`b${i}`} style={{ ...base, height: equalizerRestingHeight(i, size) }} />;
        }
        const { inputRange, outputRange } = equalizerBarKeyframes(phase, size);
        return (
          <Animated.View
            key={`b${i}`}
            style={{ ...base, height: clock.interpolate({ inputRange, outputRange }) }}
          />
        );
      })}
    </View>
  );
}
