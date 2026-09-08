import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { ReferenceUITheme } from '../theme';
import {
  BURST_LIFETIME_MS,
  pickRandomBurstVariant,
  trajectoryKeyframes,
  swingKeyframes,
  type BurstVariant,
} from './likeBurstAnimation';

// MARK: - HeartBurst — shared floating-hearts burst (`LBPHeartBurst`)
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-live-bottom-heart-burst, 問題 5;
// rb-rn-live-like-burst-restyle, design R37; rb-rn-live-like-burst-png-glyphs).
// RN parity of iOS `HeartBurstView` / Android / Flutter (rb-ios-live-bottom-heart-burst / 1733176).
//
// A `tick`-driven burst: each time `tick` INCREASES, one heart spawns at the origin. Its LOOK is
// randomly picked per spawn (design `doAnimation`, see `likeBurstAnimation.ts`'s file header for
// the full mirrored source + the two load-bearing "fixed lifetime" / "fixed rotation" details):
// one of 4 glyphs (heart / star / arrow / cross) × one of 3 rise trajectories (scale/opacity/
// rotation curve) × one of 3 left-right swing paths × one of 2 speeds (0.8s/1.0s, how fast the
// rise+swing keyframes PLAY — NOT how long the node stays mounted, which is a fixed 2000ms
// regardless). Self-removes after that fixed lifetime so repeated ticks never accumulate. Pure
// presentation — never calls core / template.
//
// PNG glyphs (`rb-rn-live-like-burst-png-glyphs`): all 4 randomly-picked glyphs render from the
// bundled `./like-burst/*.png` assets (design-supplied, byte-identical to
// `design/brands/livebuy/assets/like-{heart,star,arrow,cross}.png`) via `<Image>` — same
// `require()`-map + `<Image>` pattern as `LoadingMarkAnimation.tsx` (see that file's header for
// the same "Metro resolves `require('./x.png')` to a numeric asset id, eager not lazy" posture).
// This SUPERSEDES the prior restyle's mixed rendering: `HeartFillGlyph` (self-drawn vector,
// tinted by `theme.accent`) for `heart`, and `LikeBurstStarGlyph` / `LikeBurstArrowGlyph` /
// `LikeBurstCrossGlyph` (self-drawn vectors, fixed brand colors) for the other 3 — those 3 glyph
// files are deleted. `HeartFillGlyph` itself is NOT deleted: it is still used by
// `LiveBottomBarView`'s static LIKE button and `OperationRailView`'s VOD side-rail icon, neither
// of which is reached through this component. No glyph kind is tinted by `theme.accent` anymore
// (all 4 PNGs carry their own baked-in color, including `heart` — the prior restyle's "heart
// stays accent-tinted" carve-out is retired). The `theme` prop stays on this component's public
// signature (both `PlayerShellView.tsx` call sites still pass it) but is no longer consumed here.
//
// Container anchoring is UNCHANGED by this change (deliberately out of scope, same as the prior
// restyle): the caller's `style` prop still positions this component the same way it always has;
// only the per-heart glyph rendering (vector → PNG) changed, not the flight math.
//
// Snapshot-neutral: at rest (no in-flight heart) it renders `null` (no node in the jest tree), so
// the player-shell snapshot is unchanged. `tick` does not change during a static render → no spawn.

const FLY_DISTANCE = -90; // upward travel (unchanged anchor/positioning contract, see above)

/** Maps each {@link BurstVariant.glyphKind} to its bundled PNG asset (design-supplied,
 *  `rb-rn-live-like-burst-png-glyphs`). All 4 `require()`d once at module load (Metro resolves
 *  each `require('./x.png')` to a numeric asset id) — module-scope, not per-render, mirroring
 *  `LoadingMarkAnimation.tsx`'s `LOADING_MARK_FRAMES` precedent. */
const BURST_GLYPH_SOURCES: Record<BurstVariant['glyphKind'], number> = {
  heart: require('./like-burst/like-heart.png'),
  star: require('./like-burst/like-star.png'),
  arrow: require('./like-burst/like-arrow.png'),
  cross: require('./like-burst/like-cross.png'),
};

interface Heart {
  readonly id: number;
  readonly anim: Animated.Value;
  readonly variant: BurstVariant;
}

export function HeartBurst(props: {
  theme: ReferenceUITheme;
  tick: number;
  glyphSize?: number;
  /** Anchor style (e.g. absolute positioning) applied to the root only while a heart is in flight,
   * so at rest the component renders `null` (no node → snapshot-neutral). */
  style?: StyleProp<ViewStyle>;
}): ReactElement | null {
  const { tick, glyphSize = 26, style } = props;
  const [hearts, setHearts] = useState<readonly Heart[]>([]);
  const lastTick = useRef(tick);
  const nextId = useRef(0);
  // Removal is a plain `setTimeout` (design `doAnimation`'s own removal timer) — decoupled from
  // `Animated.timing`'s completion, since the two run on independent clocks (fixed 2000ms vs the
  // per-heart `durationMs`). Tracked so unmount can clear any still-pending ones.
  const removalTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(
    () => () => {
      removalTimers.current.forEach((timer) => clearTimeout(timer));
      removalTimers.current.clear();
    },
    [],
  );

  useEffect(() => {
    // Only spawn on a CHANGE (mirrors iOS `onChange(of: tick)`), never on first mount.
    if (tick === lastTick.current) return;
    lastTick.current = tick;
    const anim = new Animated.Value(0);
    const id = nextId.current;
    nextId.current += 1;
    const variant = pickRandomBurstVariant();
    const heart: Heart = { id, anim, variant };
    setHearts((prev) => [...prev, heart]);
    // design keyframes run `linear` (`animation: ... ${dur} linear forwards`).
    Animated.timing(anim, {
      toValue: 1,
      duration: variant.durationMs,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    const removalTimer = setTimeout(() => {
      removalTimers.current.delete(id);
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, BURST_LIFETIME_MS);
    removalTimers.current.set(id, removalTimer);
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
      {hearts.map((heart) => {
        const traj = trajectoryKeyframes(heart.variant.trajectory);
        const swing = swingKeyframes(heart.variant.swing);
        return (
          <Animated.View
            key={heart.id}
            style={{
              position: 'absolute',
              opacity: heart.anim.interpolate({
                inputRange: [...traj.stops],
                outputRange: [...traj.opacity],
              }),
              transform: [
                {
                  translateX: heart.anim.interpolate({
                    inputRange: [...swing.stops],
                    outputRange: [...swing.translateXPx],
                  }),
                },
                {
                  translateY: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [0, FLY_DISTANCE] }),
                },
                // Fixed additive rotation for the WHOLE trajectory (never itself animated — see
                // `likeBurstAnimation.ts`'s file header note 2).
                { rotate: `${traj.rotateDeg}deg` },
                {
                  scale: heart.anim.interpolate({ inputRange: [...traj.stops], outputRange: [...traj.scale] }),
                },
              ],
            }}
          >
            {/* PNG glyph (design `LIKE_ICONS`, randomly picked per spawn — see
                `likeBurstAnimation.ts`). Never a literal text character; never a self-drawn
                vector — all 4 read from `./like-burst/*.png` (rb-rn-live-like-burst-png-glyphs). */}
            <Image
              source={BURST_GLYPH_SOURCES[heart.variant.glyphKind]}
              resizeMode="contain"
              style={{ width: glyphSize, height: glyphSize }}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}
