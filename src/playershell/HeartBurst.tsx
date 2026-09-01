import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Animated, Easing, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { ReferenceUITheme } from '../theme';

// MARK: - HeartBurst — shared floating-hearts burst (`LBPHeartBurst`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-live-bottom-heart-burst, 問題 5).
// RN parity of iOS `HeartBurstView` / Android / Flutter (rb-ios-live-bottom-heart-burst / 1733176).
//
// A `tick`-driven burst: each time `tick` INCREASES, one accent heart spawns at the origin and
// flies up (translateY -90), fading + shrinking + rotating over 2.4s, then self-removes so
// repeated ticks never accumulate. Pure presentation — never calls core / template.
//
// Snapshot-neutral: at rest (no in-flight heart) it renders `null` (no node in the jest tree), so
// the player-shell snapshot is unchanged. `tick` does not change during a static render → no spawn.

const FLY_DISTANCE = -90; // upward travel
const FLY_DURATION = 2400; // lbp-heart-fly 2.4s
const DX_MAX = 22; // --dx jitter ±22
const ROT_MAX_DEG = 28; // --rot jitter ±28°

interface Heart {
  readonly id: number;
  readonly anim: Animated.Value;
  readonly dx: number;
  readonly rotDeg: number;
}

export function HeartBurst(props: {
  theme: ReferenceUITheme;
  tick: number;
  glyphSize?: number;
  /** Anchor style (e.g. absolute positioning) applied to the root only while a heart is in flight,
   * so at rest the component renders `null` (no node → snapshot-neutral). */
  style?: StyleProp<ViewStyle>;
}): ReactElement | null {
  const { theme, tick, glyphSize = 26, style } = props;
  const [hearts, setHearts] = useState<readonly Heart[]>([]);
  const lastTick = useRef(tick);
  const nextId = useRef(0);

  useEffect(() => {
    // Only spawn on a CHANGE (mirrors iOS `onChange(of: tick)`), never on first mount.
    if (tick === lastTick.current) return;
    lastTick.current = tick;
    const anim = new Animated.Value(0);
    const id = nextId.current;
    nextId.current += 1;
    const heart: Heart = {
      id,
      anim,
      dx: (Math.random() * 2 - 1) * DX_MAX,
      rotDeg: (Math.random() * 2 - 1) * ROT_MAX_DEG,
    };
    setHearts((prev) => [...prev, heart]);
    Animated.timing(anim, {
      toValue: 1,
      duration: FLY_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => setHearts((prev) => prev.filter((h) => h.id !== id)));
  }, [tick]);

  if (hearts.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        { width: glyphSize, height: glyphSize, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {hearts.map((heart) => (
        <Animated.Text
          key={heart.id}
          style={{
            position: 'absolute',
            color: theme.accent,
            fontSize: glyphSize,
            opacity: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateX: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [0, heart.dx] }) },
              { translateY: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [0, FLY_DISTANCE] }) },
              { rotate: heart.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${heart.rotDeg}deg`] }) },
              { scale: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) },
            ],
          }}
        >
          ♥
        </Animated.Text>
      ))}
    </View>
  );
}
