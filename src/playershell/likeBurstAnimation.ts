// likeBurstAnimation — pure variant-selection + scheduling logic for the LIVE 讚 (like) burst
// restyle (design R37, `rb-rn-live-like-burst-restyle`).
//
// Pure (no react / react-native imports) so `HeartBurst.tsx` (the flying visual) and
// `PlayerShellView.tsx` (the LIVE bottom-bar tap → burst trigger) share ONE implementation and
// both are unit-testable without a renderer.
//
// Mirrors `design/templates/minimal/screens.jsx`'s `doAnimation` / `likeAnimation` verbatim:
//
//   const LIKE_ICONS = ['./assets/like-heart.png', './assets/like-star.png',
//                        './assets/like-arrow.png', './assets/like-cross.png'];
//   const doAnimation = () => {
//     const icon = LIKE_ICONS[Math.floor(Math.random() * LIKE_ICONS.length)];
//     const y = Math.floor(Math.random() * 3) + 1;       // trajectory 1-3
//     const swing = Math.floor(Math.random() * 3) + 1;   // swing path 1-3
//     const speed = Math.floor(Math.random() * 2) + 1;   // 1 | 2
//     const dur = `${0.6 + speed * 0.2}s`;                // 0.8s | 1.0s
//     setHearts(h => [...h, { id, icon, y, swing, dur }]);
//     setTimeout(() => setHearts(h => h.filter(x => x.id !== id)), 2000); // FIXED, not dur-scaled
//   };
//   const likeAnimation = (n) => {
//     const count = (n != null ? n : Math.floor(Math.random() * 4)) + 1; // 1-4
//     for (let i = 0; i < count; i++) setTimeout(doAnimation, 300 * i);
//     setLiked(true);
//     likeActiveTimerRef.current = setTimeout(() => setLiked(false), 300 * (count - 1) + 2000);
//   };
//
// Two load-bearing details that are easy to get wrong by re-deriving from memory instead of
// reading the source above:
//   1. `dur` (0.8s/1.0s) ONLY controls how fast the CSS position/scale/rotate keyframes PLAY —
//      the heart is force-removed after a FIXED 2000ms regardless of which `dur` it drew. A
//      "fast" (0.8s) heart simply finishes invisible (its own keyframes end at `opacity: 0`)
//      and sits invisible for the remainder of the 2000ms, it is NOT removed early.
//   2. `rotate(Ndeg)` in `lbp-like-y-2`/`-3` is present at EVERY keyframe stop (0/35/80/100%) —
//      it is a FIXED additive rotation for the whole trajectory, never itself animated.

/** The 4 like-burst icons (design `LIKE_ICONS`), in array order (index drives random pick). */
export const BURST_GLYPH_KINDS = ['heart', 'star', 'arrow', 'cross'] as const;
export type BurstGlyphKind = (typeof BURST_GLYPH_KINDS)[number];

/** `y` (trajectory) / `swing` — design's `Math.floor(Math.random() * 3) + 1`, so 1-3. */
export type BurstTrajectoryKind = 1 | 2 | 3;
export type BurstSwingKind = 1 | 2 | 3;

/** design `dur = 0.6 + speed * 0.2` for `speed ∈ {1,2}` → 0.8s / 1.0s, in MILLISECONDS. */
export const BURST_DURATIONS_MS = [800, 1000] as const;

/** A spawned heart is force-removed this long after spawn, regardless of its own
 *  {@link BurstVariant.durationMs} (design `doAnimation`'s `setTimeout(..., 2000)` — fixed). */
export const BURST_LIFETIME_MS = 2000;

/** Stagger between hearts in one like-tap's burst (design `setTimeout(doAnimation, 300 * i)`). */
export const BURST_STAGGER_MS = 300;

/** One spawned heart's randomly-picked look (design `doAnimation`'s 4 `Math.random()` calls). */
export interface BurstVariant {
  readonly glyphKind: BurstGlyphKind;
  readonly trajectory: BurstTrajectoryKind;
  readonly swing: BurstSwingKind;
  readonly durationMs: number;
}

/**
 * Picks one heart's random look. `random` defaults to `Math.random` and is injectable so tests
 * can force a specific combination deterministically (design `doAnimation`).
 */
export function pickRandomBurstVariant(random: () => number = Math.random): BurstVariant {
  return {
    glyphKind: BURST_GLYPH_KINDS[Math.floor(random() * BURST_GLYPH_KINDS.length)]!,
    trajectory: (Math.floor(random() * 3) + 1) as BurstTrajectoryKind,
    swing: (Math.floor(random() * 3) + 1) as BurstSwingKind,
    durationMs: BURST_DURATIONS_MS[Math.floor(random() * BURST_DURATIONS_MS.length)]!,
  };
}

/** Rise-curve keyframes for one {@link BurstTrajectoryKind} (design `lbp-like-y-{1,2,3}`,
 *  percentages expressed as 0-1 animation-progress stops). `rotateDeg` is a FIXED additive
 *  rotation held for the whole trajectory (see file header note 2). */
export interface TrajectoryKeyframes {
  readonly stops: readonly number[];
  readonly scale: readonly number[];
  readonly opacity: readonly number[];
  readonly rotateDeg: number;
}

/** design `lbp-like-y-{1,2,3}` keyframes, verbatim. */
export function trajectoryKeyframes(trajectory: BurstTrajectoryKind): TrajectoryKeyframes {
  switch (trajectory) {
    case 1:
      return { stops: [0, 0.35, 0.8, 1], scale: [0.2, 1.2, 0.9, 0.6], opacity: [0, 1, 1, 0], rotateDeg: 0 };
    case 2:
      return { stops: [0, 0.35, 0.8, 1], scale: [0.4, 1.5, 1, 0.4], opacity: [0, 1, 1, 0], rotateDeg: 20 };
    case 3:
      return { stops: [0, 0.35, 0.8, 1], scale: [0.6, 1.7, 1.1, 0.7], opacity: [0, 1, 1, 0], rotateDeg: -30 };
  }
}

/** Left/right swing keyframes for one {@link BurstSwingKind} (design `lbp-like-swing-{1,2,3}`,
 *  `margin-left` → `translateX`). */
export interface SwingKeyframes {
  readonly stops: readonly number[];
  readonly translateXPx: readonly number[];
}

/** design `lbp-like-swing-{1,2,3}` keyframes, verbatim. */
export function swingKeyframes(swing: BurstSwingKind): SwingKeyframes {
  switch (swing) {
    case 1:
      return { stops: [0, 0.25, 0.75, 1], translateXPx: [0, -16, 16, 0] };
    case 2:
      return { stops: [0, 0.33, 1], translateXPx: [0, -16, 8] };
    case 3:
      return { stops: [0, 0.25, 0.75, 1], translateXPx: [0, 16, -16, 0] };
  }
}

/**
 * Burst size for one like tap (design `likeAnimation(n)`): explicit `n` (0-3) picks `n + 1`;
 * omitted → random 0-3 (same `+1`). Either way the result is clamped to 1-4. `random` injectable
 * for tests; unused (short-circuited) when `n` is provided, mirroring the design's `n != null ?
 * n : Math.floor(Math.random() * 4)` ternary.
 */
export function resolveLikeBurstCount(n?: number, random: () => number = Math.random): number {
  const base = n ?? Math.floor(random() * 4);
  return Math.min(4, Math.max(1, Math.trunc(base) + 1));
}

/** The `setTimeout` delay (ms) for the i-th (0-based) heart in a burst. */
export function likeBurstSpawnDelayMs(index: number): number {
  return index * BURST_STAGGER_MS;
}

/** How long (ms) the LIVE like button's `liked` (lit-up) state stays true after a `count`-sized
 *  burst starts (design `300 * (count - 1) + 2000`). */
export function likedHoldDurationMs(count: number): number {
  return (count - 1) * BURST_STAGGER_MS + BURST_LIFETIME_MS;
}
