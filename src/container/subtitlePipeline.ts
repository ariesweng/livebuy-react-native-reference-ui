// subtitlePipeline — turnkey container's VTT subtitle fetch/apply orchestration
// (rb-react-native-subtitle-vtt-caption-display). PURE (except the injectable fetcher seam), no
// `livebuy-react-native` value import — `container/LivebuyPlayer.tsx` cannot be loaded in this
// package's jest environment (it imports `NativeModules` / `requireNativeComponent`; see the
// existing `buildAwardClaimInjection` doc comment in `seams.ts` for the same constraint and the
// same reason it was pulled into a standalone module). Every piece of logic beyond the raw
// `onChannelChange` / `SUBTITLE_TOGGLE` dispatch lives here so it stays unit-testable; the
// container itself only calls these functions.

import { VTTSubtitleParser } from '../playershell/VTTSubtitleParser';
import type { VTTCue } from '../playershell/VTTSubtitleParser';

/**
 * Pure: does this channel carry a fetchable subtitle track? `isSubtitle === 1` gates whether
 * captions are configured for this video at all (mirrors core's own `SubtitleTrack.configure`
 * semantics); `subtitleUrl` is needed to actually fetch anything. Port of iOS
 * `channelHasFetchableSubtitle(isSubtitle:subtitleUrl:)` / Android
 * `channelHasFetchableSubtitle(isSubtitle, subtitleUrl)`.
 */
export function channelHasFetchableSubtitle(isSubtitle: number, subtitleUrl: string): boolean {
  return isSubtitle === 1 && subtitleUrl.trim().length > 0;
}

/**
 * Pure: should a just-completed subtitle fetch for `fetchedForUrl` be applied, given the CURRENT
 * `currentUrl` the container is tracking? Guards a slow, now-stale fetch (the viewer switched
 * video before the earlier VTT download finished) from clobbering a newer channel's cues. Port of
 * iOS `shouldApplySubtitleCues(fetchedForChannelId:currentChannelId:)` — RN keys on the
 * `subtitleUrl` VALUE rather than a channel id because `LBPlayerChannelInfo` (the lightweight
 * projection `onChannelChange` carries) has no `id` field (design.md D3).
 */
export function shouldApplySubtitleCues(fetchedForUrl: string, currentUrl: string): boolean {
  return fetchedForUrl === currentUrl;
}

/**
 * Pure: derive the `enabled` boolean from a raw `SUBTITLE_TOGGLE` unified-event `params` object.
 * The wire payload is `{ enabled: boolean }` (confirmed against the iOS / Android emit sites —
 * `EventDispatcher.dispatch(LBEvent.subtitleToggle, params: ["enabled": enabled])`); this is a
 * STRICT `=== true` comparison (not a truthy check) so any unexpected shape safely resolves to
 * `false` rather than accidentally turning captions on.
 */
export function subtitleToggleEnabled(params: Record<string, unknown> | undefined): boolean {
  return params?.enabled === true;
}

/** Injectable VTT-text fetch side effect (test seam — no real network in unit tests). Resolves
 *  `null` on any failure (network error, non-2xx, etc.) — never throws. */
export type SubtitleVttFetcher = (url: string) => Promise<string | null>;

/**
 * Default `SubtitleVttFetcher`: a plain global `fetch()` GET, tolerant of any failure. No retry —
 * a VTT file is small and fetched at most once per subtitle-url change (deduped by
 * `refreshSubtitleCuesIfUrlChanged`'s own `lastFetchedUrlRef` check), mirroring iOS
 * `defaultSubtitleVTTFetcher`'s no-retry policy.
 */
export const defaultSubtitleVttFetcher: SubtitleVttFetcher = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
};

/**
 * Orchestrates ONE `onChannelChange`-driven subtitle refresh (rb-react-native-subtitle-vtt-
 * caption-display): computes availability (drives the side-rail CC pill's visibility via the
 * injected `setAvailable`, design.md D4), and — only when a fetchable + NEW `subtitleUrl` is
 * present — fetches + parses the VTT file and applies the result via the injected `setCues`.
 *
 * Dedupe / staleness contract (design.md D3):
 * - No fetchable subtitle (`channelHasFetchableSubtitle` false) → `setAvailable(false)`; if a
 *   previous fetch's URL is still tracked, clears it (`setCues([])`, `lastFetchedUrlRef.current =
 *   ''`) — a channel switch AWAY from a subtitled video drops stale cues immediately, no fetch.
 * - Fetchable + SAME `subtitleUrl` as already tracked → `setAvailable(true)`, no re-fetch
 *   (`onChannelChange` re-firing for the identical channel is a safe no-op here).
 * - Fetchable + a NEW `subtitleUrl` → `setAvailable(true)`, marks `lastFetchedUrlRef.current`
 *   BEFORE the async fetch starts (so a second `onChannelChange` for the same new url arriving
 *   before this fetch resolves does not double-fetch), then fetches + parses. On resolution,
 *   re-checks `shouldApplySubtitleCues` against `lastFetchedUrlRef.current` — if the tracked url
 *   has since moved on again, this (now stale) result is DROPPED (not applied), so a fast
 *   channel-switch-back-and-forth can never let an old fetch clobber a newer one.
 */
export async function refreshSubtitleCuesIfUrlChanged(args: {
  isSubtitle: number;
  subtitleUrl: string;
  lastFetchedUrlRef: { current: string };
  setCues: (cues: readonly VTTCue[]) => void;
  setAvailable: (available: boolean) => void;
  fetcher?: SubtitleVttFetcher;
}): Promise<void> {
  const {
    isSubtitle,
    subtitleUrl,
    lastFetchedUrlRef,
    setCues,
    setAvailable,
    fetcher = defaultSubtitleVttFetcher,
  } = args;

  const available = channelHasFetchableSubtitle(isSubtitle, subtitleUrl);
  setAvailable(available);

  if (!available) {
    if (lastFetchedUrlRef.current !== '') {
      lastFetchedUrlRef.current = '';
      setCues([]);
    }
    return;
  }

  if (subtitleUrl === lastFetchedUrlRef.current) return; // same file already fetched — no-op

  lastFetchedUrlRef.current = subtitleUrl; // mark BEFORE the async fetch starts (dedupe races)
  const raw = await fetcher(subtitleUrl);
  if (!shouldApplySubtitleCues(subtitleUrl, lastFetchedUrlRef.current)) return; // stale — a newer url has since started
  const cues = raw != null ? VTTSubtitleParser.parse(raw) : [];
  setCues(cues);
}
