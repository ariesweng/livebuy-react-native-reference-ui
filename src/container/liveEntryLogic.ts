// liveEntryLogic — pure gate / dismissed-reset / state-machine helpers for the RN
// turnkey「現正直播」entry container (introduce-dropin-live-entry-container-rn).
//
// Parity source: iOS `LivebuyLiveEntryController` (`lbLiveEntryGate` /
// `lbLiveEntryShouldResetDismiss` / `apply` / `handleLiveEnded` / `dismiss`), Android
// `LivebuyLiveEntryController`, and the RN sample's `useFloatingLive` hook (PROMOTED
// here). Pure (no react / react-native VALUE imports — only a type-only `LBVideoItem`)
// so the container's poll / signal wiring and the unit tests share ONE implementation,
// and the state machine is exhaustively node-testable WITHOUT loading the native bridge
// or rendering the component (matching the RN reference-ui test discipline —
// `collapsibleLogic.ts` / `widgetData.ts`).

import type { LBVideoItem } from 'livebuy-react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Pure predicates (parity iOS lbLiveEntry* / Android lbLiveEntry*)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gate: a `fetchLatestLive` result counts as「現正直播」ONLY when `liveStatus === 1`.
 * Absorbs `null`, `liveStatus === 3` (external-platform live, e.g. Facebook), and a
 * `ty:"live"` VOD fallback (`liveStatus !== 1`) → all return `null`. Pure.
 */
export function liveEntryGate(video: LBVideoItem | null): LBVideoItem | null {
  return video != null && video.liveStatus === 1 ? video : null;
}

/**
 * New-live reset predicate: a new session (`newId` differs from the current `currentId`,
 * including `null → id`) returns true so the container resets the user's `dismissed`
 * (closing one live never hides the next). Pure.
 */
export function liveEntryShouldResetDismiss(
  currentId: string | null,
  newId: string | null,
): boolean {
  return currentId !== newId;
}

/**
 * Reset-INITIAL-VALUE predicate (`rb-rn-live-entry-dismiss-survives-remount`): when a reset IS
 * happening (see {@link liveEntryShouldResetDismiss} — an ORTHOGONAL, independent question this
 * function does not answer), what should `dismissed` start at? `true` only when the new session
 * (`newId`, non-null) is exactly the session the user last explicitly closed
 * (`lastDismissedId`, read from `liveEntryDismissMemory.ts` by the CALLER — this function itself
 * takes both values explicitly and never reads that module, staying deterministically unit-testable).
 * Lets an explicit close survive `LivebuyLiveEntry` unmounting/remounting for the SAME live id,
 * while a genuinely new live (`newId !== lastDismissedId`, including `newId == null`) still starts
 * un-dismissed — existing "closing one live never hides the next" behaviour is unchanged. Pure.
 */
export function liveEntryInitialDismissedForId(
  newId: string | null,
  lastDismissedId: string | null,
): boolean {
  return newId != null && newId === lastDismissedId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Immutable state machine (parity iOS / Android controller transitions)
// ─────────────────────────────────────────────────────────────────────────────

/** The「現正直播」entry state. Immutable — every transition returns a new value. */
export interface LiveEntryState {
  /** The ongoing live to preview, or `null` (no live / gated out / ended). */
  readonly live: LBVideoItem | null;
  /** Whether the user closed the entry for the CURRENT live (reset on a new live id). */
  readonly dismissed: boolean;
  /** The id of the live last applied — detects "new live" to reset `dismissed`. */
  readonly lastLiveId: string | null;
  /** Live ids reported ENDED — treated as "no live" by `applyLiveEntry` (backend-lag guard). */
  readonly endedLiveIds: ReadonlySet<string>;
}

/** The initial (no-live, not-dismissed) state. */
export const initialLiveEntryState: LiveEntryState = {
  live: null,
  dismissed: false,
  lastLiveId: null,
  endedLiveIds: new Set<string>(),
};

/**
 * Apply an already-GATED result (or `null`). A live whose id was already reported ENDED
 * is treated as "no live" (avoids resurfacing a just-ended live on a stale fetch); on a
 * live-`id` change reset `dismissed` — to `true` when `newId` is the live the user last
 * explicitly closed ({@link liveEntryInitialDismissedForId}, `rb-rn-live-entry-dismiss-survives-remount`),
 * else `false` — and update `lastLiveId`; finally update `live`. Transition order mirrors
 * iOS / Android `apply` + the sample `useFloatingLive` apply.
 *
 * `lastDismissedId` is an OPTIONAL third parameter (default `null`) so this function stays a pure
 * function of its explicit inputs — the actual `getLastDismissedLiveId()` read happens at the
 * impure call site (`LivebuyLiveEntry.tsx`'s `useLiveEntry` hook), matching the existing convention
 * for `liveEntryCloseGate.ts` reads. Omitting it (or passing `null`) reproduces the exact pre-change
 * behaviour (`dismissed` unconditionally resets to `false` on a live-id change).
 */
export function applyLiveEntry(
  state: LiveEntryState,
  gated: LBVideoItem | null,
  lastDismissedId: string | null = null,
): LiveEntryState {
  let next = gated;
  if (next != null && state.endedLiveIds.has(next.id)) next = null; // ended → never resurface
  const newId = next?.id ?? null;
  if (liveEntryShouldResetDismiss(state.lastLiveId, newId)) {
    return {
      ...state,
      live: next,
      dismissed: liveEntryInitialDismissedForId(newId, lastDismissedId),
      lastLiveId: newId,
    };
  }
  return { ...state, live: next };
}

/**
 * The shown live has ENDED (host signalled via `liveEndedSignal`). If the currently-shown
 * entry is a live (`liveStatus === 1`), hide it IMMEDIATELY (don't wait for the next poll)
 * and remember its id so a stale fetch cannot resurface it. No-op when not currently
 * showing a live. Parity iOS `handleLiveEnded` / Android `handleLiveEnded`.
 */
export function liveEntryHandleEnded(state: LiveEntryState): LiveEntryState {
  if (state.live == null || state.live.liveStatus !== 1) return state;
  const endedLiveIds = new Set(state.endedLiveIds);
  endedLiveIds.add(state.live.id);
  return { ...state, live: null, lastLiveId: null, endedLiveIds };
}

/** Record the user closing the entry for the current live. */
export function liveEntryDismiss(state: LiveEntryState): LiveEntryState {
  return { ...state, dismissed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Config defaults (parity iOS / Android — production-safe)
// ─────────────────────────────────────────────────────────────────────────────

/** Default poll interval in SECONDS (`fetchLatestLive` failure → 3s fast retry). */
export const LIVE_ENTRY_DEFAULT_POLL_INTERVAL = 30;
/** Default draggable flag (on-screen clamp; the resting corner comes from `position`). */
export const LIVE_ENTRY_DEFAULT_DRAGGABLE = true;
/**
 * Default resting-corner inset (`x` = the distance from the OWNED horizontal edge — `right` at the
 * `'right_bottom'` position, `left` at `'left_bottom'` — `y` = bottom). SINGLE source driving BOTH
 * the resting position (`styles.floatingLive` + `lbLiveEntryRestingInset`) AND the drag-clamp bound
 * (`clampFloatingOffset` inset), so the two never drift. Parity iOS `CGSize(12, 24)` / Android
 * `DpOffset(12, 24)`. A host with bottom chrome (TabBar) overrides via `config.inset = { x: 12, y: 70 }`.
 */
export const LIVE_ENTRY_DEFAULT_INSET: { x: number; y: number } = { x: 12, y: 24 };

/**
 * Default wait in SECONDS for `timing === 'delay'`. Carries the backend's Int-seconds
 * `extensions.floating_setting.delay` field, whose own default is `3`.
 */
export const LIVE_ENTRY_DEFAULT_DELAY_SECONDS = 3;

/**
 * Fixed SDK-internal buffer in MILLISECONDS (`rb-rn-live-entry-close-grace-period`): how long
 * `LivebuyLiveEntry` withholds its appearance right after the user closes
 * `CollapsibleLivebuyPlayer`, so the entry card does not pop straight into the same corner the
 * player was just dismissed from. Deliberately **NOT** wired to any merchant config / wire field —
 * unlike {@link LIVE_ENTRY_DEFAULT_DELAY_SECONDS} (which answers "how long to wait on a COLD app
 * open"), this answers a completely different question ("how long to wait right after a CLOSE"),
 * and the two are combined via `Math.max` at the call site, never replaced or added.
 */
export const LIVE_ENTRY_CLOSE_GRACE_MS = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// Close-grace pure helpers (`rb-rn-live-entry-close-grace-period`)
//
// Both take every time value as an explicit argument — NEITHER calls `Date.now()` — so they stay
// deterministically unit-testable. The impure "what time is it / when did the player last close"
// glue lives in the call site (`LivebuyLiveEntry.tsx`) and the sibling module
// `liveEntryCloseGate.ts`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Milliseconds elapsed since `CollapsibleLivebuyPlayer` was last closed, or `null` when it has
 * never been closed this process (cold open — the close-grace mechanism then contributes `0` and
 * the merchant's own `timing`/`delaySeconds` config governs unconditionally). Pure.
 */
export function msSinceLastPlayerClose(
  lastClosedAtMs: number | null,
  nowMs: number,
): number | null {
  return lastClosedAtMs == null ? null : nowMs - lastClosedAtMs;
}

/**
 * How many MORE milliseconds `LivebuyLiveEntry` must wait before it may appear, purely due to a
 * recent player close. `msSinceClose == null` (never closed) or `msSinceClose >= graceMs` (grace
 * already elapsed) → `0`; otherwise the remaining portion of the buffer. Combined with the
 * merchant's own configured wait via `Math.max` at the call site — this function alone never
 * decides the final wait, only its own contribution to it.
 */
export function liveEntryCloseGraceRemainingMs(
  msSinceClose: number | null,
  graceMs: number = LIVE_ENTRY_CLOSE_GRACE_MS,
): number {
  if (msSinceClose == null || msSinceClose >= graceMs) return 0;
  return graceMs - msSinceClose;
}

// ─────────────────────────────────────────────────────────────────────────────
// floating_setting — initial resting corner + appearance timing
// (rb-rn-floating-entry-position-timing; parity iOS 54e66ddf / Android df17280f)
//
// The three settings ride RAW wire values the HOST reads out of
// `sdkConfig.extensions.floating_setting` and injects into `LivebuyLiveEntryConfig`.
// `extensions` is an OPAQUE raw bag (`sdk-config` capability) — the container never reads
// it and never interprets backend semantics.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which bottom corner the floating entry rests in. TypeScript's analogue of the Swift /
 * Kotlin enum is a STRING UNION: the member values ARE the wire values, so there is no
 * `rawValue` / `wireValue` mapping layer. Same shape as the sibling `LBProductCardMode`
 * (`widget/CarouselCardView.tsx`).
 */
export type LBFloatingEntryPosition = 'right_bottom' | 'left_bottom';

/** Whether the entry appears as soon as it is eligible, or after a wait. */
export type LBFloatingEntryTiming = 'immediate' | 'delay';

/**
 * THE ONLY place a raw `floating_setting.position` value becomes a corner. Mirrors the design's
 * `normalizeFloatingPosition(raw)` (`raw === 'left_bottom' ? 'left_bottom' : 'right_bottom'`,
 * `design/templates/minimal/sdk-components.jsx`) EXACTLY — the comparison is STRICT, with NO
 * trimming and NO case folding, so `' left_bottom '` / `'LEFT_BOTTOM'` fall back to
 * `'right_bottom'` just like any other unknown string. Being deliberately as strict as the design
 * keeps the four platforms' fallback boundary identical precisely when the backend emits something
 * malformed, which is when a divergence would be hardest to spot (the backend passes
 * `position` through RAW and does no enum normalization of its own).
 *
 * Accepts `undefined` as well as `null`: the RN call site is an OPTIONAL config field (omitted →
 * `undefined`) while a value fished out of a JSON bag may be `null`; both mean "the backend / host
 * sent nothing".
 *
 * ⚠️ The fallback branch is `'right_bottom'` — the RN behaviour that predates this setting — and
 * NOT the backend's own fill-in default (`left_bottom`). The two answer DIFFERENT questions: the
 * backend's is "what goes on the wire when the merchant configured nothing", this one is "what does
 * the screen look like when the host injected nothing / injected garbage". Only `'right_bottom'`
 * keeps existing hosts byte-identical. Do not "fix" this to match the backend default.
 *
 * The normalized value MUST NOT be written back into config or any view-model.
 */
export function normalizeFloatingPosition(
  raw: string | null | undefined,
): LBFloatingEntryPosition {
  return raw === 'left_bottom' ? 'left_bottom' : 'right_bottom';
}

/**
 * THE ONLY place a raw `floating_setting.timing` value becomes a timing. Same strictness contract
 * as {@link normalizeFloatingPosition} (exact equality, no trim, no case fold); the fallback branch
 * is `'immediate'` — the RN behaviour that predates this setting.
 */
export function normalizeFloatingTiming(
  raw: string | null | undefined,
): LBFloatingEntryTiming {
  return raw === 'delay' ? 'delay' : 'immediate';
}

/** The absolute-position style keys pinning the entry to its resting corner. */
export interface LiveEntryRestingInset {
  readonly right?: number;
  readonly left?: number;
  readonly bottom: number;
}

/**
 * THE ONLY place the resting corner becomes style. `inset.x` hugs the OWNED horizontal edge
 * (`right` at `'right_bottom'`, `left` at `'left_bottom'`); `inset.y` is always `bottom`.
 * The opposite horizontal key is ABSENT (not `undefined`), so the returned object can be dropped
 * straight into a style array without a stale key fighting the new one.
 *
 * Both `draggable` render branches of `LivebuyLiveEntry` consume THIS function — they already
 * shared one `{ position: 'absolute' }` style plus one inset object before this setting existed,
 * so switching sides adds no JSX node and no layout container, which is why `position` applies in
 * both modes on RN (design D2).
 *
 * NOTE: RN's `left` / `right` are PHYSICAL edges — they do not flip under RTL the way Android's
 * `start` / `end` do. RTL behaviour is out of scope here.
 */
export function lbLiveEntryRestingInset(
  position: LBFloatingEntryPosition,
  inset: { x: number; y: number },
): LiveEntryRestingInset {
  return position === 'left_bottom'
    ? { left: inset.x, bottom: inset.y }
    : { right: inset.x, bottom: inset.y };
}

/**
 * How long to wait before the entry appears, in MILLISECONDS. `'immediate'` is always `0` — the
 * `delaySeconds` value is completely inert in that mode. `'delay'` converts seconds → ms and
 * absorbs junk: negatives and non-finite values (`NaN` / `±Infinity`, both reachable from a JSON
 * bag) collapse to `0` rather than producing a `setTimeout` that never fires or fires forever.
 */
export function lbLiveEntryAppearDelayMs(
  timing: LBFloatingEntryTiming,
  delaySeconds: number,
): number {
  if (timing !== 'delay') return 0;
  if (!Number.isFinite(delaySeconds) || delaySeconds <= 0) return 0;
  return delaySeconds * 1000;
}

/**
 * The INITIAL value of the container's appearance gate: `true` for `'immediate'` (the entry draws
 * the moment it is eligible, exactly as it did before this setting existed), `false` for `'delay'`
 * (the scheduling effect raises it).
 *
 * ⚠️ This function is the ONLY source of that initial value — the call site MUST NOT hardcode a
 * boolean. It genuinely carries behaviour, and the consumption chain was traced rather than
 * assumed (design D4): the gate reaches the render condition
 * `if (dismissed || live == null || !appeared) return null`, and EVERY `setAppeared` call lives
 * inside the delay effect, which early-returns for `'immediate'` before touching it. So on the
 * DEFAULT (`'immediate'`) path this initial value is the only thing deciding whether the entry
 * ever shows: pin it to `false` and every default host's entry disappears forever.
 *
 * Honest limit: `LivebuyLiveEntry.tsx` cannot be loaded under jest (core's `NativeModules` is
 * absent from the in-package `react-native` mock), so no test EXECUTES that chain — the call site
 * is only held by a source pin, which proves the line exists, not that it runs.
 */
export function lbLiveEntryInitialAppeared(timing: LBFloatingEntryTiming): boolean {
  return timing !== 'delay';
}

// -- Entrance animation constants (design `lbp-float-in`) ---------------------
//
// `@keyframes lbp-float-in { 0% { opacity:0; transform: translateY(16px) scale(0.78) }
//                            60% { opacity:1 }
//                            100% { opacity:1; transform: translateY(0) scale(1) } }`
// played as `0.42s cubic-bezier(0.22,1,0.36,1) both`
// (`design/templates/minimal/sdk-components.jsx` · `LBPFloatingWidget`).
// Named so the four platforms copy ONE set of numbers instead of re-deriving them.

/** Entrance duration in ms (design `0.42s`). */
export const LIVE_ENTRY_ENTRANCE_DURATION_MS = 420;
/** Entrance easing control points (design `cubic-bezier(0.22, 1, 0.36, 1)`). */
export const LIVE_ENTRY_ENTRANCE_BEZIER: readonly [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];
/** Entrance scale at progress 0 (design `scale(0.78)`). */
export const LIVE_ENTRY_ENTRANCE_INITIAL_SCALE = 0.78;
/** Entrance vertical offset at progress 0, in points (design `translateY(16px)`). */
export const LIVE_ENTRY_ENTRANCE_TRANSLATE_Y = 16;
/** Progress at which opacity reaches 1 (design keyframe `60%`). */
export const LIVE_ENTRY_ENTRANCE_OPACITY_STOP = 0.6;

/**
 * The scale anchor for the entrance animation — the card grows out of the corner it rests in
 * (design `transformOrigin: side === 'left' ? 'left bottom' : 'right bottom'`). Returned as an RN
 * `transformOrigin` style string (RN 0.74+).
 */
export function lbLiveEntryTransformOrigin(position: LBFloatingEntryPosition): string {
  return position === 'left_bottom' ? 'left bottom' : 'right bottom';
}
