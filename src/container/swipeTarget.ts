// videoSwitchToId — pure VIDEO_SWITCH target-id extractor for the drop-in container's
// swipe-baseline tracking (rb-rn-swipe-prev-after-autoadvance). Pure (no react / native
// imports) so the container's switch-tracking and the unit tests share ONE implementation.
//
// (The former `swipeTarget` host-feed resolver was removed —
// rb-rn-swipe-always-channel-adjacency; vertical swipe uses the shell's built-in backend
// prev/next, so there is no host-feed `swipeFeed` to resolve.)

/**
 * The target video id of a `VIDEO_SWITCH` event (core auto-advance / in-place switch's
 * `to_video_id`). Pure (no react / native imports) so the container's switch-tracking and the
 * unit tests share one implementation. Returns the id when `eventName === 'VIDEO_SWITCH'` and
 * `params.to_video_id` is a non-empty string; otherwise `null` (non-switch event / missing).
 * The container subscribes via `registerListener` and updates its swipe baseline so a CORE
 * auto-advance keeps `currentVideoId` fresh (rb-rn-swipe-prev-after-autoadvance, parity iOS/
 * Android/Flutter).
 */
export function videoSwitchToId(
  eventName: string,
  params: Record<string, unknown>,
): string | null {
  if (eventName !== 'VIDEO_SWITCH') return null;
  const to = params.to_video_id;
  return typeof to === 'string' && to.length > 0 ? to : null;
}

/**
 * Whether a `VIDEO_SWITCH` target id (`to`, resolved by {@link videoSwitchToId}) represents a CORE
 * auto-advance that the collapsible container must sync to the floating card (vs a user-interaction
 * switch already reported by `switchVideo`). True iff `to` is non-null AND differs from the current
 * swipe-baseline id (rb-rn-collapsible-autoadvance-switch-sync).
 *
 * Timing rationale (load-bearing): a USER-INTERACTION switch (swipe / hot-pick / watch-next)
 * synchronously calls `switchVideo(to, …)` in the JS handler, whose first line advances
 * `currentVideoIdRef` to `to`. The `playerRef.load(to)` a switch triggers surfaces `VIDEO_SWITCH`
 * only ASYNCHRONOUSLY (native bridge round-trip), so by the time the listener runs `to === currentId`
 * → returns false → skip (no redundant fire, no real-cover overwrite, no double host callback). A
 * CORE auto-advance never calls `switchVideo` (core-internal `load`), so the baseline is still the
 * PREVIOUS id → `to !== currentId` → returns true → sync. Pure (node-testable).
 */
export function shouldSyncAutoAdvance(to: string | null, currentId: string): boolean {
  return to != null && to !== currentId;
}
