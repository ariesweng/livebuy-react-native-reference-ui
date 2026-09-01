// LoadingMarkAnimation — RN `.loading` brand PNG-sequence loader.
//
// Spec: `reference-ui-rendering/spec.md`
//   § "RN reference-ui `.loading` 品牌動畫改用 PNG 序列幀播放（無動畫規則窄範圍例外）"
// Design: `rb-rn-loading-mark-png-sequence` design.md.
// Change: rb-rn-loading-mark-png-sequence.
//
// Plays the SAME 17-frame brand loading-mark PNG sequence (500×500 RGBA) as iOS
// `LoadingMarkAnimationView.swift` (`rb-ios-loading-mark-png-sequence`, archived) —
// bytes copied verbatim from `ios/Sources/LivebuyReferenceUI/Resources/LoadingMark/`
// (md5-verified identical), NOT re-extracted. Replaces the generic procedural
// `renderSpinnerRing(76, 4)` call in `StartScreenView.renderLoading` — see that file
// for why `renderSpinnerRing` itself is left in place as now-dead code (parity to
// the iOS `spinnerRing()` precedent; cleanup deferred, not this change's job).
//
// TIMELINE (decision-locked, four-platform parity — MUST match iOS exactly): frame 0
// → 68ms, frames 1-15 → 34ms each, frame 16 → 476ms hold. Total loop 1054ms, then
// repeats from frame 0. The pure `loadingMarkFrameIndex(elapsedMs)` function below is
// independently unit-tested (`__tests__/LoadingMarkAnimation.test.ts`) and is a
// direct TypeScript port of iOS `LoadingMarkAnimationView.frameIndex(elapsed:)`.
//
// TIMING MECHANISM: `setInterval` + `useState`/`useEffect` — the standard RN/React
// timer pattern, already established in this package by `LivebuyWidget.tsx`'s
// `refreshTimer` (`container/LivebuyWidget.tsx:213-224`, itself parity to iOS
// `LivebuyWidget.swift`'s `refreshTimer`). No RN/React version-compatibility concern
// analogous to iOS's `TimelineView` (iOS 15+) vs `Timer.scheduledTimer` (iOS 14+)
// tradeoff exists here — `setInterval`/`useEffect` have no such floor gap against
// this package's resolved `react-native@0.85.3` / `react@19` — but per design.md this
// was verified by actually running `npm run typecheck` + `npm test`, not assumed.
//
// All 17 frames are `require()`d once at module load (Metro/TS module-load resolves
// each to a numeric asset id) — module-scope `require()`, not per-render — so there is
// no "lazy per-frame decode" concern to design around (design.md 決策 2 parity: iOS
// preloads all 17 into an array at `init`; here the array is simply a module-level
// constant, since `require()` is inherently eager/static in RN's bundler model).
//
// NO-ANIMATION RULE EXCEPTION (see spec.md ADDED requirement, design.md 決策 1): the
// existing family-4 StartScreen requirement says "spinner 用 deterministic Text/View,
// 無動畫/隨機/Animated；縮圖 MUST NOT 用網路 uri Image". This component uses `Image`
// (not `Animated`) sourced from a LOCAL bundled asset via `require()` (NOT a network
// `uri`) driven by discrete `setInterval`-ticked state (NOT the RN `Animated` API).
// Under Jest + `react-test-renderer` with real (non-fake, non-advanced) timers, the
// structural snapshot deterministically captures the mount-time state (frame index 0)
// — the rule's underlying intent (protect snapshot determinism) is preserved even
// though the on-screen render visibly animates. See spec.md for the full carve-out
// text; it is narrowly scoped to THIS `.loading` brand mark only.

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Image } from 'react-native';

import { LBTestIDs } from '../../testing/LBTestIDs';

// MARK: - Timeline tokens (locked — MUST match iOS `LoadingMarkAnimationView` exactly)

/** Total frame count (`frame_00` ~ `frame_16`). */
export const LOADING_MARK_FRAME_COUNT = 17;
/** Frame 0's display duration (ms). */
export const LOADING_MARK_FRAME0_DURATION_MS = 68;
/** Each of frames 1-15's display duration (ms). */
export const LOADING_MARK_MID_FRAME_DURATION_MS = 34;
/** Count of "mid" frames (frames 1-15). */
export const LOADING_MARK_MID_FRAME_COUNT = 15;
/** Frame 16's hold duration (ms) before the loop repeats. */
export const LOADING_MARK_LAST_FRAME_HOLD_MS = 476;
/** Total loop length (ms) — 68 + 34*15 + 476 = 1054. */
export const LOADING_MARK_TOTAL_LOOP_MS =
  LOADING_MARK_FRAME0_DURATION_MS +
  LOADING_MARK_MID_FRAME_DURATION_MS * LOADING_MARK_MID_FRAME_COUNT +
  LOADING_MARK_LAST_FRAME_HOLD_MS;

/** Frame-clock poll interval (ms) — ~60Hz, comfortably under the shortest (34ms)
 *  frame window, matching iOS `tickIntervalSeconds = 1.0/60.0`. */
const TICK_INTERVAL_MS = 1000 / 60;

/**
 * Maps elapsed time (ms, since the animation loop started) to the frame index
 * (`0...16`) that MUST be displayed, per the locked timeline. Direct TypeScript port
 * of iOS `LoadingMarkAnimationView.frameIndex(elapsed:)` — MUST stay numerically
 * identical (verified by the unit tests in `__tests__/LoadingMarkAnimation.test.ts`).
 * Wraps at the loop boundary (e.g. `elapsedMs = 1054 + 17` MUST equal `elapsedMs = 17`)
 * and defensively wraps negative input too (not expected from a monotonic clock read).
 */
export function loadingMarkFrameIndex(elapsedMs: number): number {
  let t = elapsedMs % LOADING_MARK_TOTAL_LOOP_MS;
  if (t < 0) t += LOADING_MARK_TOTAL_LOOP_MS;

  if (t < LOADING_MARK_FRAME0_DURATION_MS) {
    return 0;
  }
  const afterFrame0 = t - LOADING_MARK_FRAME0_DURATION_MS;
  const midFramesTotalMs = LOADING_MARK_MID_FRAME_DURATION_MS * LOADING_MARK_MID_FRAME_COUNT;
  if (afterFrame0 < midFramesTotalMs) {
    const offset = Math.floor(afterFrame0 / LOADING_MARK_MID_FRAME_DURATION_MS);
    return 1 + Math.min(offset, LOADING_MARK_MID_FRAME_COUNT - 1);
  }
  return LOADING_MARK_FRAME_COUNT - 1;
}

// MARK: - Frame assets (module-scope `require()` — eager, not lazy; bytes copied
// verbatim from the iOS bundle, md5-verified identical)

/** All 17 frames, in display order. `require()` of a local `.png` resolves to a
 *  numeric asset id at build time (Metro) — see `assets.d.ts` for the ambient
 *  `declare module '*.png'` this relies on for `tsc`. */
export const LOADING_MARK_FRAMES: readonly number[] = [
  require('./frame_00.png'),
  require('./frame_01.png'),
  require('./frame_02.png'),
  require('./frame_03.png'),
  require('./frame_04.png'),
  require('./frame_05.png'),
  require('./frame_06.png'),
  require('./frame_07.png'),
  require('./frame_08.png'),
  require('./frame_09.png'),
  require('./frame_10.png'),
  require('./frame_11.png'),
  require('./frame_12.png'),
  require('./frame_13.png'),
  require('./frame_14.png'),
  require('./frame_15.png'),
  require('./frame_16.png'),
];

/** Props for {@link LoadingMarkAnimation}. */
export interface LoadingMarkAnimationProps {
  /** Rendered width/height (square). Matches the `spinnerRing(76, 4)` call site it
   *  replaces (`StartScreenView`'s `.loading` layout). */
  readonly size: number;
}

/**
 * Plays the 17-frame brand loading-mark PNG sequence on a `setInterval`-driven frame
 * clock (started on mount, cleared on unmount — standard React effect-cleanup
 * lifecycle, mirrors `LivebuyWidget.tsx`'s `refreshTimer`). Only reassigns state when
 * the computed frame index actually changes (avoids redundant re-renders), mirroring
 * iOS's `if index != currentIndex` guard.
 */
export function LoadingMarkAnimation(props: LoadingMarkAnimationProps): ReactElement {
  const { size } = props;
  const [frameIndex, setFrameIndex] = useState(0);
  const frameIndexRef = useRef(0);

  useEffect(() => {
    frameIndexRef.current = 0;
    setFrameIndex(0);
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsedMs = Date.now() - start;
      const next = loadingMarkFrameIndex(elapsedMs);
      if (next !== frameIndexRef.current) {
        frameIndexRef.current = next;
        setFrameIndex(next);
      }
    }, TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Image
      testID={LBTestIDs.momentLoadingMark}
      source={LOADING_MARK_FRAMES[frameIndex]}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
