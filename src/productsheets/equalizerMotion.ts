// equalizerMotion.ts — pure geometry/motion math for `EqualizerGlyph` (rb-rn-live-equalizer-motion).
//
// Spec: `design/contract/equalizer-motion.json` (authoritative source, `design/contract
// /claude-design-sync.md` R40) — DO NOT hand-edit the constants below without first updating
// that file; this module mirrors it 1:1. All fractions are of the glyph's `size` (icon-size-
// relative, matching every platform's own equalizer-motion implementation per that file's
// `platformPrimitives`).
//
// GEOMETRY reproduces the pre-existing hardcoded 24-unit bar table (`x∈{3,10.5,18}`,
// `y∈{14,9,4}`, `w=3`, `h∈{7,12,17}` — all bottom-aligned at `y=21`) byte-for-byte EXCEPT
// `cornerRadius`: the JSON's published `0.0208` is a 4-decimal rounding of the exact
// `0.5/24 = 0.020833…` the old hardcoded `BAR_RADIUS` used — a ~0.03px difference at typical
// sizes (9/18), imperceptible, and deliberately favoring the JSON contract as the single source
// of truth going forward over preserving the old exact rounding (design.md D2).
//
// All functions here are pure — no React, no `Animated`, no IO — so the formula and geometry are
// unit-testable independent of the `Animated`-stub jest mock (`test-support/react-native.mock
// .tsx`'s `Animated.Value.interpolate()` is an inert passthrough, so it cannot itself verify
// these numbers; see `EqualizerGlyph.test.tsx`'s file header for that split).

/** Number of bars — always 3 (`equalizer-motion.json` `geometry.bars`). */
export const EQUALIZER_BAR_COUNT = 3;

/** Full breathing cycle duration in ms (`motion.periodMs`). */
export const EQUALIZER_PERIOD_MS = 900;

/** `motion.minHeight` / `motion.maxHeight` — bar height bounds, as a fraction of `size`. */
export const EQUALIZER_MIN_HEIGHT_FRACTION = 0.2917;
export const EQUALIZER_MAX_HEIGHT_FRACTION = 0.7083;

/** `motion.phases` — left-to-right per-bar phase offset (fraction of one period). */
export const EQUALIZER_PHASES: readonly number[] = [0, 0.3333, 0.6667];

/** `restingHeights` — the fixed frame shown when the animation is stopped (`paused` prop or
 *  system reduced-motion). SAME three fractions as the pre-existing static `Icons.equalizer`
 *  bars — `lifecycle.onStop` requires landing here, never at 0. */
export const EQUALIZER_RESTING_HEIGHT_FRACTIONS: readonly number[] = [0.2917, 0.5, 0.7083];

const GEOMETRY = {
  barWidth: 0.125,
  gap: 0.1875,
  sideInset: 0.125,
  bottomInset: 0.125,
  cornerRadius: 0.0208,
} as const;

/** `motion.formula`: a smooth 0↔1 breathing curve, `phase`-shifted per bar, continuous across
 *  the loop boundary (`h(0, phase) === h(1, phase)` since the cosine argument always advances by
 *  exactly one full turn over one period). `progress` is elapsed-time-as-a-fraction-of-
 *  `EQUALIZER_PERIOD_MS` (0 at cycle start, 1 at cycle end — NOT wall-clock ms). Returns a
 *  fraction of `size`, same units as {@link EQUALIZER_MIN_HEIGHT_FRACTION}. */
export function equalizerBarHeightFraction(progress: number, phase: number): number {
  const wave = 0.5 - 0.5 * Math.cos(2 * Math.PI * (progress + phase));
  return (
    EQUALIZER_MIN_HEIGHT_FRACTION +
    (EQUALIZER_MAX_HEIGHT_FRACTION - EQUALIZER_MIN_HEIGHT_FRACTION) * wave
  );
}

/** Sample the formula into `Animated.Value#interpolate`'s piecewise-linear input/output ranges
 *  — `interpolate` cannot express the cosine curve directly, so this approximates it with enough
 *  samples (default 32 ⇒ ~28ms per segment at the 900ms period) to read as smooth. `sizePx` is
 *  the glyph's resolved `size` prop (px), baked into `outputRange` so callers can pass the result
 *  straight to `interpolate`. */
export function equalizerBarKeyframes(
  phase: number,
  sizePx: number,
  samples = 32,
): { readonly inputRange: number[]; readonly outputRange: number[] } {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const progress = i / samples;
    inputRange.push(progress);
    outputRange.push(equalizerBarHeightFraction(progress, phase) * sizePx);
  }
  return { inputRange, outputRange };
}

/** Left offset (px) of bar `index` (0-based, left to right) — `geometry.sideInset` then
 *  `geometry.barWidth + geometry.gap` per subsequent bar. */
export function equalizerBarLeft(index: number, sizePx: number): number {
  return (GEOMETRY.sideInset + index * (GEOMETRY.barWidth + GEOMETRY.gap)) * sizePx;
}

export function equalizerBarWidth(sizePx: number): number {
  return GEOMETRY.barWidth * sizePx;
}

export function equalizerBottomInset(sizePx: number): number {
  return GEOMETRY.bottomInset * sizePx;
}

export function equalizerCornerRadius(sizePx: number): number {
  return GEOMETRY.cornerRadius * sizePx;
}

/** The fixed resting height (px) for bar `index` — see {@link EQUALIZER_RESTING_HEIGHT_FRACTIONS}. */
export function equalizerRestingHeight(index: number, sizePx: number): number {
  return EQUALIZER_RESTING_HEIGHT_FRACTIONS[index]! * sizePx;
}

/** `lifecycle.stopWhen` gate: animate only when BOTH the caller allows it (`!paused`) AND the
 *  system doesn't request reduced motion. Pure — kept separate from the component so the
 *  decision itself is unit-testable without React/Animated/AccessibilityInfo. */
export function shouldEqualizerAnimate(paused: boolean, reducedMotion: boolean): boolean {
  return !paused && !reducedMotion;
}
