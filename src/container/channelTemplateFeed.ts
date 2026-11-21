// rb-rn-channel-feed-backfill — every channel-sourced view-model feed of the drop-in player, in ONE
// place. RN has no iOS / Android `ingestChannel()`: `LivebuyPlayer` feeds each
// `<LivebuyPlayerCore onChannelChange>` snapshot into the template field by field. It runs both on
// every callback AND once when an attachment is created / replaced, because the attachment is built
// asynchronously (after `sdkConfig` resolves) while the native bridge de-dupes channel snapshots —
// a channel that arrived before the attachment would otherwise never reach it.
import type { LivebuyPlayerCoreProps } from 'livebuy-react-native';
import type { PlayerTemplateAttachment } from 'livebuy-react-native-ui';
import {
  deriveEndScreenNavRows,
  deriveHeaderChromeFields,
  deriveServiceLinkAvailable,
} from './channelChrome';

/** The channel snapshot `<LivebuyPlayerCore onChannelChange>` delivers. */
export type ChannelFeedInfo = Parameters<NonNullable<LivebuyPlayerCoreProps['onChannelChange']>>[0];

/** The template calls this feed makes (the real `DefaultPlayerTemplate` satisfies it). */
export type ChannelFeedTarget = Pick<
  PlayerTemplateAttachment['template'],
  | 'handleHeaderChrome'
  | 'handleRailEnablement'
  | 'handleUpcoming'
  | 'handleInfo'
  | 'applyLoadingCover'
  | 'handleChannelShopId'
  | 'handleMomentSnapshot'
>;

/**
 * Feeds one channel snapshot into the view-model. Pure field pass-through (derivations live in
 * `channelChrome.ts`); each target method merges / diffs internally, so re-feeding the same
 * snapshot is harmless.
 */
export function feedChannelToTemplate(template: ChannelFeedTarget, info: ChannelFeedInfo): void {
  // Top-bar chrome (title / host / logo / share / live / replay / flash-sale).
  template.handleHeaderChrome(deriveHeaderChromeFields(info));
  // Side-rail「聯繫商家」visibility (partial merge; `subtitleAvailable` is fed separately).
  template.handleRailEnablement({ serviceLinkAvailable: deriveServiceLinkAvailable(info.serviceLink) });
  // Upcoming / intro (StartScreen skip button, 直播預告 countdown).
  template.handleUpcoming({
    publishAt: info.publishAt,
    cover: info.cover,
    start: info.start,
    liveStatus: info.liveStatus,
    type: info.type,
  });
  // 「直播資訊」info tab (`description` is not on the channel info).
  template.handleInfo({
    title: info.title,
    publishAt: info.publishAt,
    shopName: info.shopName,
    shopIntro: info.shopIntro,
    shopLogo: info.shopLogo,
  });
  // Loading-phase cover background.
  template.applyLoadingCover(info.cover);
  // Channel shop id for the default add-to-cart requester (`""` → configured shop).
  template.handleChannelShopId(info.shopId);
  // Live-updating products / narrating product / viewer count / EndScreen watch-next rows.
  template.handleMomentSnapshot({
    products: info.products,
    activeProduct: info.narratingProduct,
    viewerCount: info.viewerCount,
    next: deriveEndScreenNavRows(info.next),
  });
}
