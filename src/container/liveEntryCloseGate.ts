// liveEntryCloseGate — cross-container "when was the collapsible player last closed" memory
// (rb-rn-live-entry-close-grace-period).
//
// `CollapsibleLivebuyPlayer` (the collapsible player) and `LivebuyLiveEntry` (the floating「現正
// 直播」entry card) are two completely independent sibling containers: neither imports the other,
// neither shares a React tree, and a host typically mounts only one of them at a time (its own
// convention is `sessionVideo == null` ⟹ show `LivebuyLiveEntry`). That means the moment a user
// closes the collapsible player and `LivebuyLiveEntry` mounts (or was already mounted, hidden by
// `state.live == null`) is, from `LivebuyLiveEntry`'s point of view, indistinguishable from a cold
// app open — UNLESS something outside React state carries "a player was JUST closed" across that
// boundary. This module is that carrier.
//
// MODULE-LEVEL (not React state, not Context) is a deliberate choice, not a shortcut: a Context
// would require the host to wrap both sibling containers in one Provider, which breaks the
// existing "each drop-in container mounts independently, host wires nothing extra" contract both
// containers are built on. This mirrors the package's existing `LivebuyWidgetVisibility` bridge
// (`../widget/livebuyWidgetVisibility`) — same shape: one container writes, an unrelated container
// reads, via a plain module-level variable, not through React.
//
// Deliberately NOT persisted (no AsyncStorage): the grace window this feeds
// (`LIVE_ENTRY_CLOSE_GRACE_MS`, `liveEntryLogic.ts`) is on the order of seconds, well within a
// single JS process lifetime — persisting "when did the user last close a player" across app
// restarts has no product value here and would only add async-read complexity to a purely
// in-memory concern.

/**
 * Wall-clock ms (`Date.now()`) of the last genuine user-initiated `CollapsibleLivebuyPlayer.close()`
 * this process, or `null` if none has happened yet (cold open). Read via {@link getLastPlayerClosedAtMs}.
 */
let lastClosedAtMs: number | null = null;

/**
 * Record "now" as the moment the user closed the collapsible player. Called ONLY from
 * `CollapsibleLivebuyPlayer.close()` — a real user-initiated close (`onDismiss` seam / the
 * floating card's own close button), never from the floating card's restore `onTap`, an in-place
 * switch, or the `openSignal` reopen effect (those are "still watching, just changed presentation",
 * not "ended the session").
 */
export function markPlayerClosed(): void {
  lastClosedAtMs = Date.now();
}

/** Read the last recorded close moment, or `null` if the player has never been closed this process. */
export function getLastPlayerClosedAtMs(): number | null {
  return lastClosedAtMs;
}

/**
 * Test-only: reset the module-level close memory back to "never closed" (cold open). Production
 * code never calls this — it exists so tests don't leak `lastClosedAtMs` across cases sharing this
 * module.
 */
export function _resetLiveEntryCloseGateForTesting(): void {
  lastClosedAtMs = null;
}
