// channelChrome — pure derivation of PlayerHeader top-bar chrome fields + the
// side-rail「聯繫商家」availability flag from the native `onChannelChange`
// projection (player-channel-chrome-wiring-reference-ui-rn). PURE (no
// `livebuy-react-native` VALUE import — same jest-loadability constraint as
// `subtitlePipeline.ts`'s own doc comment: `container/LivebuyPlayer.tsx` itself
// cannot be loaded in this package's jest environment, since it imports
// `livebuy-react-native` which pulls in `NativeModules` / `requireNativeComponent`).
// This constraint is about the CORE package specifically — importing a pure
// function VALUE from `livebuy-react-native-ui` (the view-model package, no RN
// runtime dependency) is safe and already established elsewhere in this
// container (`seams.ts` imports `LBSideRailKind`/`LBAuthTriggerAction`,
// `widgetData.ts` imports `decodeWidgetSnapshot`, both as values).
// Every piece of derivation logic beyond the raw `onChannelChange` dispatch lives
// here so it stays unit-testable; the container only calls these functions.
//
// Parity source: iOS `ingestChannel(_ ch: LBChannel)`
// (`ios/Sources/LivebuyUI/Templates/Default/DefaultPlayerTemplate.swift:698-729`),
// which auto-derives `handleHeaderChrome(...)` + `handleRailEnablement(
// serviceLinkAvailable: !ch.shop.serviceLink.isEmpty, ...)` on every channel load.
// RN has no `ingestChannel` — `LivebuyPlayer.tsx`'s `onChannelChange` is the
// host-fed equivalent trigger point (RN has no automatic view-model-layer path).

import { isFinishedLiveReplay } from 'livebuy-react-native-ui';
import type { EndScreenNavRow } from 'livebuy-react-native-ui';

// rb-rn-endscreen-live-duration — reuses `formatTimestamp` from the playershell module (a plain
// exported pure function, not a `livebuy-react-native` VALUE import — the jest-loadability
// constraint documented above is specifically about this package's OWN core npm dependency,
// which pulls in `NativeModules`/`requireNativeComponent`; `react-native` itself is safely
// module-mapped to a mock for every test in this package, so a `.tsx` component module that
// merely imports `react-native` loads fine here too).
import { formatTimestamp } from '../playershell/PlaybackProgressBarView';

/**
 * Shape of the fields this module reads off `LBPlayerChannelInfo`. A structural
 * subset (not an import of the real type from `livebuy-react-native`) — mirrors
 * `subtitlePipeline.ts`'s own convention of not importing any `livebuy-react-native`
 * value into this pure module.
 */
export interface PlayerChannelChromeSource {
  readonly title: string;
  readonly shopName: string;
  readonly shopLogo: string;
  readonly shareUrl: string;
  readonly liveStatus: number;
  /**
   * Channel type (`channel.type`, parity `LBPlayerChannelInfo.type`): `1` = VOD,
   * `2` = live (upcoming + in-progress), `3` = finished-live replay. `-1` =
   * unknown (field absent on the wire). Feeds `isFinishedLiveReplay(type,
   * liveStatus)` below — carries no rendering meaning on its own.
   */
  readonly type: number;
  /**
   * Whether the channel is a flash sale (`channel.isFlashSale`, parity
   * `LBPlayerChannelInfo.isFlashSale`) — `= upstream sale_type==2`, always
   * present on the wire, independent of `type` / `liveStatus`. Passed straight
   * through to {@link DerivedHeaderChromeFields.isFlashSale} below (no
   * derivation — rb-rn-flash-sale-live-signal-wiring).
   */
  readonly isFlashSale: boolean;
}

/**
 * `handleHeaderChrome` field shape this module produces — a structural subset of
 * `DefaultPlayerTemplate.handleHeaderChrome`'s parameter. `isFinishedLiveReplay`
 * IS derived here (isfinishedlivereplay-wiring-reference-ui-rn) now that
 * `channel-type-bridge-core-rn` has bridged `channel.type` onto
 * `LBPlayerChannelInfo` — the data-source gap that previously blocked this is
 * closed. `isFlashSale` is passed straight through (no derivation) now that
 * `channel-flash-sale-flag-core-rn` has bridged `channel.isFlashSale` onto
 * `LBPlayerChannelInfo` (rb-rn-flash-sale-live-signal-wiring).
 */
export interface DerivedHeaderChromeFields {
  readonly title: string;
  readonly hostName: string;
  readonly shopLogo: string;
  readonly shareUrl: string;
  readonly isLive: boolean;
  readonly isFinishedLiveReplay: boolean;
  readonly isFlashSale: boolean;
}

/**
 * Derive the PlayerHeader top-bar chrome fields from a channel-change projection.
 * `hostName` ← `shopName` (parity iOS `ch.shop.name`); `isLive` ← strict
 * `liveStatus === 1` (mirrors iOS's `ch.liveStatus == 1` — upcoming (`0`), VOD, and
 * the `-1` unknown sentinel are all NOT live); `isFinishedLiveReplay` ←
 * `isFinishedLiveReplay(type, liveStatus)` (`livebuy-react-native-ui` pure
 * function — `type === 3 || (type === 2 && liveStatus === 3)`, mutually
 * exclusive with `isLive`); `isFlashSale` ← `info.isFlashSale` straight
 * pass-through (no derivation — `rb-rn-flash-sale-live-signal-wiring`, the data
 * source `channel-flash-sale-flag-core-rn` had already bridged onto
 * `LBPlayerChannelInfo` but no caller fed it into `handleHeaderChrome` until now).
 */
export function deriveHeaderChromeFields(
  info: PlayerChannelChromeSource,
): DerivedHeaderChromeFields {
  return {
    title: info.title,
    hostName: info.shopName,
    shopLogo: info.shopLogo,
    shareUrl: info.shareUrl,
    isLive: info.liveStatus === 1,
    isFinishedLiveReplay: isFinishedLiveReplay(info.type, info.liveStatus),
    isFlashSale: info.isFlashSale,
  };
}

/**
 * Derive the side-rail「聯繫商家」enabled flag from the channel's serviceLink
 * (parity iOS `!ch.shop.serviceLink.isEmpty`). `''` (no service link configured,
 * or `onChannelChange` not yet fired) → `false`.
 */
export function deriveServiceLinkAvailable(serviceLink: string): boolean {
  return serviceLink !== '';
}

/**
 * Shape of a single `LBPlayerChannelInfo.next[]` entry this module reads (rb-rn-endscreen-live-
 * empty-state) — a structural subset of the core `LBNavItem`, mirroring
 * {@link PlayerChannelChromeSource}'s own decoupling convention (no `livebuy-react-native` type
 * import here either).
 */
export interface PlayerChannelNavItem {
  readonly id: string;
  readonly cover: string;
  readonly title: string | null;
  readonly duration: number;
  readonly shopName: string;
}

/**
 * Fold the channel's `next[]` navigation rows (rn-endscreen-next-bridge-core) into the
 * template's `EndScreenNavRow` shape for `handleMomentSnapshot({ next })` — the EndScreen
 * 「倒數播放下一支」variant's data source (rb-rn-endscreen-live-empty-state). `title: string |
 * null` on the core row folds to `''` (the template's own `EndScreenNavRow` requires `title:
 * string`) — a genuinely title-less entry then renders the surface's own「下一支影片」fallback,
 * the SAME as an already-empty string does downstream in `EndScreenView`. `cover` / `duration` /
 * `shopName` pass straight through — the core row already defaults them (`''` / `0` / `''`), and
 * `EndScreenNavRow`'s `duration` / `shopName` are optional, so a `0` / `''` value renders the
 * surface's own absent-field fallback (`metaLine` already omits an empty/zero side — unchanged
 * by this function). Pure / deterministic.
 */
export function deriveEndScreenNavRows(
  next: readonly PlayerChannelNavItem[],
): EndScreenNavRow[] {
  return next.map((item) => ({
    id: item.id,
    title: item.title ?? '',
    cover: item.cover,
    shopName: item.shopName,
    duration: item.duration,
  }));
}

/**
 * Format `LBPlayerChannelInfo.liveDurationSeconds` (raw seconds, `null` when no goods poll has
 * landed yet for this video) into the EndScreen 空狀態's「直播時長：…」line
 * (rb-rn-endscreen-live-duration). `null` → `''`, letting `EndScreenView`'s own default prop
 * value (`liveDuration = ''`) render its existing `"--:--:--"` fallback — this function does
 * NOT invent a fallback string itself, mirroring `deriveEndScreenNavRows`'s convention of
 * passing missing-data straight through to the surface's own absent-field handling. A non-null
 * value is formatted via {@link formatTimestamp} (reused from the playershell module, NOT
 * reimplemented) — a zero-padded, ALWAYS-3-segment `HH:MM:SS` (e.g. `5070` → `"01:24:30"`),
 * matching the visual shape of the `"--:--:--"` fallback it replaces. Pure / deterministic.
 */
export function deriveLiveDuration(seconds: number | null): string {
  return seconds == null ? '' : formatTimestamp(seconds);
}
