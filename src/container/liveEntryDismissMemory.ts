// liveEntryDismissMemory — same-container "which live did the user just explicitly close" memory
// that survives `LivebuyLiveEntry` remounting (rb-rn-live-entry-dismiss-survives-remount).
//
// `LivebuyLiveEntry` is a turnkey drop-in the host keeps mounted only while no player is in the
// foreground: the host's own convention (documented in `LivebuyLiveEntry.tsx`'s file header) is
// "no player in foreground ⟹ show `LivebuyLiveEntry`" — so the moment a user opens a player and
// later closes it, `LivebuyLiveEntry` unmounts and then remounts as a BRAND NEW component instance.
// The container's `dismissed` state lives in `useLiveEntry`'s `useState` — instance-scoped React
// state — so it resets to `false` on every remount, even for the SAME live session the user just
// explicitly closed. `LivebuyLiveEntryConfig.onClose`'s existing doc comment already promises
// "hide until the next live"; this module is what makes that promise survive the remount.
//
// Unlike `liveEntryCloseGate.ts` (a cross-CONTAINER bridge: `CollapsibleLivebuyPlayer` writes,
// `LivebuyLiveEntry` reads — two different components), this module's writer and reader are the
// SAME container (`LivebuyLiveEntry`) across DIFFERENT mount lifecycles — a same-component,
// cross-instance memory. The two modules solve structurally similar problems (React state cannot
// survive what it needs to survive) with the same MODULE-LEVEL (not React state, not Context)
// shape, but they carry different data for different producer/consumer relationships, so they stay
// separate files rather than merging into one.
//
// MODULE-LEVEL is deliberate, not a shortcut: a Context would require the host to wrap
// `LivebuyLiveEntry` in a Provider that itself survives the container's own remounts, which
// defeats the purpose — the whole point is surviving `LivebuyLiveEntry` disappearing entirely.
//
// Deliberately NOT persisted (no AsyncStorage): this is a pure PROCESS-lifetime memory — an app
// restart (process restart) naturally zeroes it, by design (per the user-facing requirement: only
// the CURRENT app session remembers an explicit close; there is no merchant setting to configure
// this, and no cross-restart "remember forever" behaviour).
//
// ONLY the user's explicit close button (`LivebuyLiveEntry`'s `dismiss` callback) writes here.
// Tapping the entry card itself to WATCH the live ("I want to see it") is a completely different
// signal from closing it ("I don't want to see it") and MUST NOT write to this module — see the
// `LivebuyLiveEntry.tsx` `onTapVideo` / default-open-player call sites, neither of which imports
// this module.

/**
 * The `video.id` of the last live session the user EXPLICITLY closed via `LivebuyLiveEntry`'s
 * close button this process, or `null` if none has happened yet (cold open, or the app process was
 * just restarted). Read via {@link getLastDismissedLiveId}.
 */
let lastDismissedLiveId: string | null = null;

/**
 * Record `liveId` as the live session the user just explicitly closed. Called ONLY from
 * `LivebuyLiveEntry`'s `dismiss` callback (the entry card's own close button) — never from the
 * "tap the card to watch" path (`onTapVideo` / the default-open-player `<Modal>`), which is "still
 * interested, just watching" rather than "don't show me this session again".
 */
export function markLiveEntryDismissed(liveId: string): void {
  lastDismissedLiveId = liveId;
}

/**
 * Read the `video.id` of the last explicitly-closed live session, or `null` if none has been
 * recorded this process (cold open / never closed / process just restarted).
 */
export function getLastDismissedLiveId(): string | null {
  return lastDismissedLiveId;
}

/**
 * Test-only: reset the module-level dismiss memory back to "never closed" (cold open). Production
 * code never calls this — it exists so tests don't leak `lastDismissedLiveId` across cases sharing
 * this module.
 */
export function _resetLiveEntryDismissMemoryForTesting(): void {
  lastDismissedLiveId = null;
}
