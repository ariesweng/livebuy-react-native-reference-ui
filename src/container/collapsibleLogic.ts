// collapsibleLogic — pure phase / reopen / clamp helpers for the RN collapsible player
// presenter (rb-rn-collapsible-player).
//
// Parity source: iOS `collapsiblePhase` / `shouldReopenOnVideoChange` / `clampFloatingOffset`,
// Flutter `collapsible_live_buy_player.dart`, Android `CollapsibleLivebuyPlayer.kt`. Pure (no
// react / react-native VALUE imports — only a type-only geometry alias) so the presenter's
// drag / phase wiring and the unit tests share ONE implementation, and the cases are
// exhaustively testable in a plain node environment WITHOUT loading the native bridge.

import type { LBVideoItem } from 'livebuy-react-native';

// Type-only (zero runtime edge) — the resting-corner union lives with the live-entry logic that
// owns the `floating_setting` contract; the clamp only needs to know which side it anchors to.
import type { LBFloatingEntryPosition } from './liveEntryLogic';

/** A 2-D point (drag offset). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A 2-D size (card / container). */
export interface Sizing {
  readonly width: number;
  readonly height: number;
}

/**
 * Build the `LBVideoItem` reported via `onVideoSwitchedItem` after an in-place switch, from the
 * switch target's display fields — the REAL `cover` / `title` taken from the hot item (hot-pick) /
 * next nav row (watch-next) that drove the switch (swipe passes empty `cover` + the correct `id`,
 * as RN reference-ui has no channel adjacency nav rows in JS). KIND is derived from `liveStatus`
 * (`type === 2` when live, else `1`); the rest is empty / 0. `preview` stays "" on RN (the
 * `EndScreenNavRow` / `EndScreenHotRow` sources carry no preview). Pure (type-only `LBVideoItem`
 * import → node-testable). Parity iOS / Android `switchedVideoItem`.
 */
export function switchedVideoItem(args: {
  id: string;
  cover: string;
  title: string;
  duration: number;
  liveStatus: number;
  preview?: string;
}): LBVideoItem {
  const { id, cover, title, duration, liveStatus, preview = '' } = args;
  return {
    id,
    type: liveStatus === 1 ? 2 : 1,
    title,
    cover,
    preview,
    duration,
    publishAt: '',
    watchNum: 0,
    pvNum: 0,
    liveStatus,
    pin: 0,
    showPvNum: 0,
    liveurl: '',
    playbackurl: '',
    previewTime: '',
    showStock: false,
  };
}

/**
 * Build the id-only fallback `LBVideoItem` reported via `onVideoSwitchedItem` when the CORE
 * auto-advances (VOD / replay finished → `handleEngineEnded → load(next)`) — the 4th switch-sync
 * path (rb-rn-collapsible-autoadvance-switch-sync). Unlike hot-pick / watch-next, a core auto-advance
 * surfaces to JS only as a headless `VIDEO_SWITCH` event carrying `to_video_id` (no cover / title),
 * so this delegates to {@link switchedVideoItem} with `cover` / `title` empty + the correct `id`. The
 * floating card then shows the auto-advanced video with the CORRECT id + empty cover — the SAME
 * quality as RN swipe (which also has no channel adjacency rows in JS), NOT a regression. Parity
 * Android `autoAdvanceSwitchedItem` (Android's core seam carries the full nav item so its cover /
 * title are real; RN's `VIDEO_SWITCH` event carries id only). `liveStatus = 0` (VOD) is the
 * switch-time guess — auto-advance only happens in VOD / replay context (LIVE goes to endScreen via
 * poll `live_end`, never auto-advances) → `switchedVideoItem` derives `type = 1`. RN has no
 * `onLiveStatusChange` self-correction seam in the container, so this guess is final (correct, since
 * auto-advance is definitively VOD). Pure (type-only `LBVideoItem` import → node-testable).
 */
export function autoAdvanceSwitchedItem(id: string): LBVideoItem {
  return switchedVideoItem({ id, cover: '', title: '', duration: 0, liveStatus: 0 });
}

/** The presentation phase of a collapsible player (parity iOS / Flutter / Android). */
export type CollapsiblePlayerPhase = 'closed' | 'full' | 'floating';

/** Pure phase derivation: no video → closed; minimized → floating; else full. */
export function collapsiblePhase(hasVideo: boolean, isMinimized: boolean): CollapsiblePlayerPhase {
  if (!hasVideo) return 'closed';
  return isMinimized ? 'floating' : 'full';
}

/**
 * Whether the collapsible presenter SHALL declare the host's widget-preview surface COVERED, driving
 * the opt-in `LivebuyWidgetVisibility.setWidgetsCovered(...)` bridge (rn-refui-presenter-widget-cover-by-phase,
 * RN parity of iOS `presenterWidgetCovered`). Contract: **covered ⟺ phase is `'full'`** — i.e.
 * `hasVideo && !isMinimized`. Reuses {@link collapsiblePhase} so there is ONE source of truth for the
 * phase (no second boolean derivation).
 *
 * WHY only `'full'` covers: the full-screen player is a KEEP-ALIVE overlay (hidden via `opacity: 0` +
 * `pointerEvents="none"`, NOT unmounted), so while `'full'` it keeps decoding at full rate and is the
 * source of hardware-video-decoder contention — declaring the home widget previews covered lets them
 * yield the decoder (fixes "home previews don't play while / before the full-screen live is minimized").
 * `'floating'` hides the full player behind a single small floating card, so releasing the N home
 * previews is a far lower total decode load than "full-screen live + N" → NOT covered. `'closed'` has no
 * session → NOT covered. Pure (type-free) → node-testable.
 */
export function presenterWidgetCovered(hasVideo: boolean, isMinimized: boolean): boolean {
  return collapsiblePhase(hasVideo, isMinimized) === 'full';
}

/**
 * Whether a change of the bound video's id should auto-restore the full-screen player: true ONLY
 * when a new (non-null) video arrives while minimized (the host swapped in another video).
 * Restoring from the floating card keeps the SAME id (only flips minimized) → returns false.
 * Pure (parity iOS / Flutter / Android `shouldReopenOnVideoChange`).
 */
export function shouldReopenOnVideoChange(
  newVideoId: string | null | undefined,
  isMinimized: boolean,
): boolean {
  return newVideoId != null && isMinimized;
}

/**
 * Clamp the floating card's committed-plus-live drag offset so it can be dragged to reposition but
 * never pushed off-screen. The offset is measured FROM the resting corner (resting offset
 * `{x:0, y:0}`), so the horizontal range follows which corner the card rests in:
 *
 * - `'right_bottom'` (default, and what the minimized player always uses): the card cannot move
 *   further right (upper bound 0) and can move left only until its far edge reaches the opposite
 *   inset (lower bound, negative).
 * - `'left_bottom'`: the mirror image — it cannot move further left (lower bound 0) and can move
 *   right only up to `+(container − card − inset)`.
 *
 * Vertically both corners behave identically (both are bottom-anchored). `position` is OPTIONAL and
 * omitting it is byte-identical to passing `'right_bottom'`, so every pre-existing call site is
 * untouched. Pure (parity iOS / Flutter / Android).
 *
 * ⚠️ The `'right_bottom'` branch keeps its ORIGINAL expressions verbatim rather than adopting the
 * `span = max(0, …)` form iOS / Android use. In JS that rewrite is NOT equivalent: in the
 * degenerate case (card + inset wider than the container) `Math.min(0, -(negative))` yields `+0`
 * while `-Math.max(0, negative)` yields `-0`, and jest's `toBe` / `toEqual` tell those apart via
 * `Object.is`. The left branch is written to land on `+0` in the same degenerate case.
 */
export function clampFloatingOffset(args: {
  committed: Point;
  translation: Point;
  cardSize: Sizing;
  containerSize: Sizing;
  inset: Point;
  /** Resting corner the offset is measured from. Omitted ⇒ `'right_bottom'` (prior behaviour). */
  position?: LBFloatingEntryPosition;
}): Point {
  const { committed, translation, cardSize, containerSize, inset, position = 'right_bottom' } = args;
  const desiredX = committed.x + translation.x;
  const desiredY = committed.y + translation.y;
  const minX = Math.min(0, -(containerSize.width - cardSize.width - inset.x));
  const maxX = Math.max(0, containerSize.width - cardSize.width - inset.x);
  const minY = Math.min(0, -(containerSize.height - cardSize.height - inset.y));
  const clampedX =
    position === 'left_bottom'
      ? Math.min(maxX, Math.max(0, desiredX))
      : Math.max(minX, Math.min(0, desiredX));
  const clampedY = Math.max(minY, Math.min(0, desiredY));
  return { x: clampedX, y: clampedY };
}
