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
}

/**
 * `handleHeaderChrome` field shape this module produces — a structural subset of
 * `DefaultPlayerTemplate.handleHeaderChrome`'s parameter. `isFinishedLiveReplay`
 * IS derived here (isfinishedlivereplay-wiring-reference-ui-rn) now that
 * `channel-type-bridge-core-rn` has bridged `channel.type` onto
 * `LBPlayerChannelInfo` — the data-source gap that previously blocked this is
 * closed.
 */
export interface DerivedHeaderChromeFields {
  readonly title: string;
  readonly hostName: string;
  readonly shopLogo: string;
  readonly shareUrl: string;
  readonly isLive: boolean;
  readonly isFinishedLiveReplay: boolean;
}

/**
 * Derive the PlayerHeader top-bar chrome fields from a channel-change projection.
 * `hostName` ← `shopName` (parity iOS `ch.shop.name`); `isLive` ← strict
 * `liveStatus === 1` (mirrors iOS's `ch.liveStatus == 1` — upcoming (`0`), VOD, and
 * the `-1` unknown sentinel are all NOT live); `isFinishedLiveReplay` ←
 * `isFinishedLiveReplay(type, liveStatus)` (`livebuy-react-native-ui` pure
 * function — `type === 3 || (type === 2 && liveStatus === 3)`, mutually
 * exclusive with `isLive`).
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
