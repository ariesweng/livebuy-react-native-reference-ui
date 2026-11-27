// ExternalLive — external-platform live detection (rb-rn-external-live-watch).
//
// RN sibling of iOS `ExternalLive.swift` / Android `ExternalLive.kt`. Spec:
// `openspec/specs/external-live-watch`.
//
// The shop's latest live can be an externally-hosted broadcast (a Facebook live).
// The backend returns it as an `LBVideoItem` whose `liveurl` is a `facebook.com`
// page (verified dev shop `Pw8PJ99J`, video `7epqqM`) — none of the SDK playback
// engines can play that. The FB URL exists ONLY on the widget-layer
// `LBVideoItem.liveurl`; the in-app player loads `/sdk/video`, whose `path` is a
// livebuy MP4 with no `liveurl`/`source`, so detection MUST happen here (the widget
// card / tap-routing layer) before the player opens.

import { Linking } from 'react-native';

import type { LBVideoItem } from 'livebuy-react-native';
// rb-url-exit-policy-gate — deep-path value import of the PURE core URL open policy (zero
// `react-native` dependency; the root barrel would load the native bridge — same reasoning as
// `feedwin/FeedWinView.tsx`).
import { LBURLOpenPolicy } from 'livebuy-react-native/src/LBURLOpenPolicy';

/** Hosts whose lives are watched on their own platform (NOT in-app). Each entry
 *  matches the host itself and any sub-domain. Extend to add YouTube / IG live. */
const EXTERNAL_HOSTS: readonly string[] = ['facebook.com', 'fb.watch', 'fb.gg'];

/** Lower-cased host of an absolute `scheme://host[:port]/...` URL, else null. Regex-
 *  based (RN has no reliable global `URL`): strips any `userinfo@` and `:port`. */
function hostOf(urlString: string): string | null {
  const m = urlString.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/);
  if (m == null) return null;
  let host = m[1]!;
  const at = host.indexOf('@');
  if (at >= 0) host = host.slice(at + 1);
  const colon = host.indexOf(':');
  if (colon >= 0) host = host.slice(0, colon);
  host = host.toLowerCase();
  return host.length > 0 ? host : null;
}

/**
 * Whether [urlString] points at an external broadcast platform — a PURE, POSITIVE
 * host allowlist. NEVER a negative "not `.m3u8`" rule: the backend may legitimately
 * return a non-`.m3u8` MP4/VOD `liveurl` for a normal in-app video (per
 * `widget-live-nested-decode`), so a negative rule would misclassify those and break
 * in-app playback. Sub-domain match is anchored on a leading dot (`host === base` OR
 * `host.endsWith('.' + base)`) so look-alikes like `facebook.com.evil.example` and
 * `notfacebook.com` do NOT match.
 */
export function isExternalLiveURL(urlString: string): boolean {
  return externalLiveOpenURL(urlString) !== null;
}

/** Schemes an external live URL may use (a subset of the core openable allowlist). */
const WEB_SCHEME = /^https?:/i;

/**
 * The URL to open when [urlString] is an external live, else null
 * (rb-url-exit-policy-gate). The string is first run through the core
 * `LBURLOpenPolicy.decide` allowlist — a `null` decision (custom app scheme / `intent:` /
 * `file:` / `javascript:` / …) is NEVER an external live, even with a `facebook.com` host.
 * A live URL must additionally be `http` / `https` (`mailto` / `tel` / `sms` are openable but
 * are not lives). The host allowlist then runs on the policy's `decision.url` (the trimmed
 * string the policy judged), and that same string is what gets opened.
 */
export function externalLiveOpenURL(urlString: string): string | null {
  const decision = LBURLOpenPolicy.decide(urlString);
  if (decision === null || !WEB_SCHEME.test(decision.url)) return null;
  const host = hostOf(decision.url);
  if (host == null) return null;
  return EXTERNAL_HOSTS.some((base) => host === base || host.endsWith('.' + base))
    ? decision.url
    : null;
}

/** The external-platform watch URL when this live's `liveurl` is an external broadcast
 *  (Facebook today), else null. Tapping such a live opens this URL externally. The value
 *  is the core policy's `decision.url` (rb-url-exit-policy-gate). */
export function externalLiveWatchURL(item: LBVideoItem): string | null {
  return externalLiveOpenURL(item.liveurl);
}

/**
 * Wraps a host-wired `onTapVideo` into an external-aware callback: when the tapped
 * live is an external-platform broadcast, open its `liveurl` via `openExternal`
 * (default `Linking.openURL`) and do NOT invoke `onTapVideo` (so no in-app player is
 * presented); otherwise forward unchanged. `openExternal` is injectable so the
 * routing is unit-testable without `Linking`.
 */
export function externalLiveAwareTap(
  onTapVideo: ((item: LBVideoItem) => void) | undefined,
  openExternal: (url: string) => void = (url) => {
    void Linking.openURL(url);
  },
): (item: LBVideoItem) => void {
  return (item) => {
    const url = externalLiveWatchURL(item);
    if (url != null) openExternal(url);
    else onTapVideo?.(item);
  };
}
