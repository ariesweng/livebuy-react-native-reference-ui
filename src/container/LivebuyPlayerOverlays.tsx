// LivebuyPlayerOverlays — the composed player-overlay tree (extracted from
// `LivebuyPlayer.tsx` so the design seam `MinimalDesign` can compose it without a
// circular import).
//
// This is the minimal `minimal`-design player overlay: the five player-overlay families
// (player-shell / feed-win / product-sheets / gap-surfaces / moments) + the on-demand
// chat composer, all bound to the SAME `attachment.template`, absolutely positioned over
// the native player (box-none passthrough). Each seam is `config.onX ?? default` via the
// pure `./seams` builders. It is composed by `MinimalDesign.playerOverlay` (the default
// `ReferenceUIDesign`) — the assembly is UNCHANGED from when it lived inline in the
// container, so behaviour is identical.

import { useMemo, useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import { Share, View } from 'react-native';

import { LivebuySDK, nicknameSetPreconditionRejection } from 'livebuy-react-native';
import type { LivebuyPlayerCoreRef, LBVideoItem, LBProduct } from 'livebuy-react-native';
import { LBSideRailKind } from 'livebuy-react-native-ui';
import type { PlayerTemplateAttachment } from 'livebuy-react-native-ui';

import type { ReferenceUITheme } from '../theme';

import { PlayerShellView } from '../playershell/PlayerShellView';
import { PlayerShellModel } from '../playershell/PlayerShellModel';
import type { VTTCue } from '../playershell/VTTSubtitleParser';
import { FeedWinView } from '../feedwin/FeedWinView';
import { ProductSheetsView } from '../productsheets/ProductSheetsView';
import { MomentsView } from '../moments/MomentsView';
import { MomentsModel } from '../moments/MomentsModel';
import { GapSurfacesOverlayView } from '../gapsurfaces/GapSurfacesOverlayView';

import { ChatComposerBar } from './ChatComposerBar';
import type { LivebuyPlayerConfig } from './LivebuyPlayerConfig';
import type {
  ChatComposerController,
  NicknamePromptController,
  LoginPromptController,
} from './ChatComposerBar';
import {
  buildShellHandlers,
  buildSheetHandlers,
  buildFeedHandlers,
  buildMomentHandlers,
  buildWatchNextHandler,
  buildGapHandlers,
  buildGoLiveHandler,
  applyEventJoinGate,
} from './seams';
import type { PlayerRefLike, SeamDeps } from './seams';
import { GapSurfacesModel } from '../gapsurfaces/GapSurfacesModel';
import { resolveDirectCloseButtonEnabled, switchedVideoItem } from './collapsibleLogic';

// rb-rn-scrub-expanded-chrome-lift — mirrors `PlayerShellView`'s OWN `SCRUB_CHROME_LIFT` (`36`,
// declared PRIVATE there — this container cannot import it). Declared here as a SEPARATE constant
// of the same value, cross-file doc-commented — the same two-constants-of-the-same-value pattern
// this repo's iOS `PlayerShellView.scrubChromeLift` / `MinimalDesign.scrubChromeLift` and the
// Android equivalent already use, not a new technique introduced by this change.
const SCRUB_CHROME_LIFT = 36;

/** Props for the composed {@link LivebuyPlayerOverlays} tree. */
export interface LivebuyPlayerOverlaysProps {
  attachment: PlayerTemplateAttachment;
  theme: ReferenceUITheme;
  config: LivebuyPlayerConfig;
  composer: ChatComposerController;
  nickname: NicknamePromptController;
  login: LoginPromptController;
  playerRef: RefObject<LivebuyPlayerCoreRef | null>;
  currentVideoId: () => string;
  switchVideo: (id: string) => void;
  /**
   * Reads the most recently received `LBPlayerChannelInfo.serviceLink` (from the container's
   * `<LivebuyPlayerCore onChannelChange>` subscription; dropin-service-link-default-browser-rn).
   */
  serviceLink: () => string;
  /**
   * VOD CC 字幕 cue 清單（rb-react-native-subtitle-vtt-caption-display）——容器 `LivebuyPlayer` 抓取
   * + 解析 `channel.subtitle_url` 後持有的 React state，逐層以 prop 傳給 `PlayerShellView`（design.md
   * D1）。預設 `[]`。
   */
  subtitleCues?: readonly VTTCue[];
  /**
   * 容器「現正直播」輪詢結果（rb-rn-live-now-pill）——`LivebuyPlayer.tsx` 的 `useLiveNowPoll
   * (config.shopId)` 持有的 React state，已經過既有純函式 `liveEntryGate` 過濾（只認
   * `liveStatus === 1`）。`null`（未接 `config.shopId` 或目前沒有偵測到另一場直播）→
   * `LiveNowPillView` 永不出現。本元件由此值推導 `hasLiveNow` 布林 + 建構
   * `onGoLive` tap handler（`seams.ts` `buildGoLiveHandler`）餵給 `PlayerShellView`。預設
   * `undefined`。
   */
  liveNow?: LBVideoItem | null;
  /**
   * EndScreen 空狀態的「直播時長：…」line，已格式化（`HH:MM:SS` 或 `''`；rb-rn-endscreen-live-
   * duration）——`LivebuyPlayer.tsx` 的 `onChannelChange` 持有的 React state，由
   * `LBPlayerChannelInfo.liveDurationSeconds`（moment-state-sourced 原始秒數）經純函式
   * `deriveLiveDuration`（`channelChrome.ts`）算出。直接轉發給 `MomentsView.liveDuration`——
   * 不經過 `react-native-ui` template 套件，比照本元件既有的 `live` / `cleanMode` 慣例。預設
   * `''`（渲染 `MomentsView` / `EndScreenView` 既有的 `"--:--:--"` fallback）。
   */
  liveDuration?: string;
}

/**
 * The composed overlay tree (split out so the seam builders run with a non-null
 * `attachment`). All overlays share `attachment.template`; each seam is
 * `config.onX ?? default`. Absolutely positioned over the native player.
 */
export function LivebuyPlayerOverlays(props: LivebuyPlayerOverlaysProps): ReactElement {
  const {
    attachment,
    theme,
    config,
    composer,
    nickname,
    login,
    playerRef,
    currentVideoId,
    switchVideo,
    serviceLink,
    subtitleCues = [],
    liveNow = null,
    liveDuration = '',
  } = props;
  const template = attachment.template;

  // rb-rn-player-direct-close-button — resolve the SAME way `CollapsibleLivebuyPlayer` does (shared
  // pure function), so the header button's icon and the presenter's actual close behaviour never
  // diverge. Runs for EVERY use of `LivebuyPlayer`, whether or not it is wrapped by
  // `CollapsibleLivebuyPlayer` (see `LivebuyPlayerConfig.enableDirectCloseButton`'s own doc comment
  // for the bare-usage caveat: the icon still reflects this, even though a bare `LivebuyPlayer`'s
  // own `onMinimize` default is unaffected by it).
  const showCloseIcon = resolveDirectCloseButtonEnabled(
    config.enableDirectCloseButton,
    LivebuySDK.isDirectCloseButtonEnabled(),
  );

  // A safe player-ref facade: the seam builders call methods unconditionally; every
  // VOID member no-ops if the native ref is not mounted yet (never throws). The one
  // Promise-returning member does NOT — see the exception right below.
  //
  // guest-nickname-verified-fails-loudly-rn — ONE deliberate exception to that
  // no-op rule: `setGuestNicknameVerified` returns a Promise whose RESOLUTION is
  // read as「暱稱已提交」by its consumer, so an unmounted ref REJECTS instead of
  // no-op-resolving (still no throw — a rejected Promise). Every other member here
  // is void fire-and-forget, where no-op is harmless.
  const safePlayerRef: PlayerRefLike = useMemo(
    () => ({
      load: (id: string) => playerRef.current?.load(id),
      setMuted: (m: boolean) => playerRef.current?.setMuted(m),
      skipStart: () => playerRef.current?.skipStart(),
      cancelAutoNext: () => playerRef.current?.cancelAutoNext(),
      minimize: () => playerRef.current?.minimize(),
      sendChat: (msg: string, eventId?: number) => playerRef.current?.sendChat(msg, eventId),
      seek: (seconds: number) => playerRef.current?.seek(seconds),
      unload: () => playerRef.current?.unload(),
      // 已登入訂閱出口（rb-rn-subscribe-login-gate）：header 徽章的 onToggleSubscribe 已登入分支呼叫，
      // facade → core `videoInfoPanel.simulateSubscribeTap()` → toggleSubscribe() → SUBSCRIBE_CHANGED。
      simulateSubscribeTap: () => playerRef.current?.videoInfoPanel.simulateSubscribeTap(),
      // 商品點擊 telemetry 出口（rb-rn-product-tap-wire）：sheet seam 的 onOpenProduct 預設呼叫，
      // facade → core `productOverlay.simulateProductTap(product)` → native 派 INFO_PRODUCT_VIEW +
      // goods_pv + PRODUCT_CLICK。明細 sheet 由 `attachment.handleProductTap` 另一條線負責開。
      simulateProductTap: (product: LBProduct) =>
        playerRef.current?.productOverlay.simulateProductTap(product),
      // 按讚出口（rb-rn-like-tap-wire）：shell seam 的 onTapRailItem 預設（defaultRailTap）對
      // LBSideRailKind.Like 呼叫，facade → core `operationPanel.simulateLikeTap()` → native
      // operationPanelView.simulateLikeTap() → 既有 250ms throttle → 按讚 API。飄心動畫是
      // PlayerShellView 本地 liveHeartTick 的另一條線，不經此。
      simulateLikeTap: () => playerRef.current?.operationPanel.simulateLikeTap(),
      // CC 字幕開關出口（rb-react-native-subtitle-vtt-caption-display）：shell 側欄 CC 鈕的
      // onTapRailItem 預設（defaultRailTap）對 LBSideRailKind.Subtitle 呼叫，facade → core
      // `operationPanel.simulateSubtitleToggleTap()` → native `subtitleTrack.toggle()` → 派發
      // `SUBTITLE_TOGGLE` 統一事件（容器另一條線監聽並回寫 template，見 `LivebuyPlayer.tsx`）。
      simulateSubtitleToggleTap: () => playerRef.current?.operationPanel.simulateSubtitleToggleTap(),
      // 頻道級分享 fallback 出口（rb-rn-product-list-share-tap-noop）：sheet seam 的 onShareProduct
      // 預設在 channelShareUrl 為空時呼叫，facade → core `operationPanel.simulateShareTap()` →
      // native operationPanelView.simulateShareTap() → 既有頻道級分享事件（由有接 listener 的 host
      // 自行呈現）。與 onShare 走的 shareSystem 是不同出口，見 seams.ts `defaultShareProduct` 說明。
      simulateShareTap: () => playerRef.current?.operationPanel.simulateShareTap(),
      // checkName-驗證的設名出口（rb-rn-nickname-taken-inline-error）：`buildGapHandlers` 的 turnkey
      // `onSubmitName` 呼叫它取代舊的 fire-and-forget `setGuestNickname`。
      //
      // guest-nickname-verified-fails-loudly-rn：未掛載的 native ref → **reject**（先前是
      // `?? Promise.resolve()`）。這個 facade 的其餘方法都是 void 的 fire-and-forget，未掛載時安全
      // no-op 沒有問題；但這一支回傳 Promise，而它的唯一消費者 `buildGapHandlers.onSubmitName`
      // **把 resolve 當成唯一的成功判準**（關 modal → 開 composer → 續作 pending 的「加入活動」
      // join）。ref 未掛載時 resolve 等於謊報「暱稱已設定」——與 core 這次修掉的缺陷完全同型，
      // 只是被搬到最上層。code 用 core 套件匯出的權威常數，與 native 走完全程時逐字相同。
      setGuestNicknameVerified: (name: string): Promise<void> =>
        playerRef.current?.setGuestNicknameVerified(name) ??
        nicknameSetPreconditionRejection(
          'setGuestNicknameVerified: the Livebuy player ref is not mounted — nothing was submitted.',
        ),
    }),
    [playerRef],
  );

  const deps: SeamDeps = {
    playerRef: safePlayerRef,
    attachment,
    config,
    composer,
    nickname,
    login,
    // turnkey 頻道分享出口（dropin-player-default-share-sheet-rn）：注入 react-native Share.share，使
    // `seams.ts` 保持純粹（無 react-native value import）。host 設 config.onShare 則完全覆蓋（不走此預設）。
    shareSystem: (url: string): void => {
      void Share.share({ message: url });
    },
    // turnkey 聯絡商家出口（dropin-service-link-default-browser-rn）：注入 LivebuySDK.openInAppBrowser
    // （已是既有 import），使 `seams.ts` 保持純粹（無 react-native / SDK value import）。host 設
    // config.onServiceLink 則完全覆蓋（不走此預設）。
    openInAppBrowser: (url: string): void => LivebuySDK.openInAppBrowser(url),
    serviceLink,
    currentVideoId,
    switchVideo,
  };

  const shell = buildShellHandlers(deps);
  const sheet = buildSheetHandlers(deps);
  const feed = buildFeedHandlers(deps);
  const moment = buildMomentHandlers(deps);
  const gap = buildGapHandlers(deps);

  // 「現正直播」LiveNowPillView tap 預設（rb-rn-live-now-pill，parity onPickHot 形狀）：
  // `deps.switchVideo` 已在上方 `SeamDeps` 建構好，`liveNow` resolver 直接讀本元件持有的
  // `liveNow` prop（容器 `LivebuyPlayer.tsx` 的輪詢結果，唯一權威來源）。
  const goLive = buildGoLiveHandler(deps, () => liveNow);

  // rb-rn-event-join-gate:「加入活動」抽獎 CTA 三層閘（parity iOS / Android）。唯一到得了 core 的
  // chokepoint 是 FeedWinModel.joinEvent（FeedWinView.handleJoin 經 model.joinEvent → template）；容器
  // 建構此閘 closure、讀既有 template 訊號（identity / operationRail，與 onComment 同一讀法），present
  // 既有 login / nickname controller，經 <FeedWinView joinEventGate> 注入到 overlay 自持的 model。回 true
  // = 已攔截 → model.joinEvent 不 forward（不 join / 不 markJoined）。共用留言 pill 的同一組純函式故永不
  // 分歧；暱稱閘把該次 (eid, keyword) 記為 pending join，設名成功後由 gap.onSubmitName 接續完成恰一次。
  const joinEventGate = (eid: number, keyword: string): boolean => {
    const id = new GapSurfacesModel(template);
    return applyEventJoinGate({
      isLoggedIn: id.isLoggedIn,
      chatEnabled: template.operationRailState.chatEnabled,
      displayName: id.identity?.displayName ?? '',
      eid,
      keyword,
      presentLogin: (): void => login.present(),
      presentNickname: (e: number, k: string): void => nickname.presentPendingJoin(e, k),
    });
  };

  // 立即觀看 default: advance in place to the moment model's auto-next target (`next[0]`), then
  // notify the host. Resolve it as a full `LBVideoItem` carrying the next row's REAL cover / title
  // (so a minimized floating preview shows the switched video, rb-rn-collapsible-player-track-switch;
  // `EndScreenNavRow` carries no preview → ""). (The host-feed swipeFeed fallback was removed —
  // rb-rn-swipe-always-channel-adjacency; vertical swipe uses backend prev/next.)
  const nextItem = (): LBVideoItem | null => {
    const row = new MomentsModel(template).next[0];
    if (row == null) return null;
    return switchedVideoItem({
      id: row.id,
      cover: row.cover,
      title: row.title,
      duration: 0,
      liveStatus: 1,
    });
  };
  const onWatchNext = buildWatchNextHandler(deps, nextItem);

  // Mirror PlayerShellView's info-panel open state so the LIVE-only chat feed (Surface 2,
  // rendered ABOVE the shell) is hidden while the panel is up (parity iOS rb-ios-info-panel-
  // not-covered-by-chat). PlayerShellView reports every open/close via onInfoPanelOpenChange.
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  // rb-rn-clean-mode-hide-chat-feed — mirror PlayerShellView's cleanMode (乾淨模式) the SAME way
  // infoPanelOpen is mirrored above: PlayerShellView already reports every cleanMode change
  // (including the initial mount) via onCleanModeChange, but nothing in this container was
  // listening. Threading it here lets the LIVE-only chat feed (Surface 2, rendered OUTSIDE
  // PlayerShellView's own render tree) hide itself while clean mode is on (design screens.jsx:532
  // LBLiveChatOverlay `!cleanMode` gate), parity Android / Flutter's existing wiring.
  const [cleanMode, setCleanMode] = useState(false);

  // rb-rn-live-more-sheet-above-chat — mirror PlayerShellView's「更多」(⋯) collapsed-menu open
  // state the SAME way infoPanelOpen / cleanMode are mirrored above: the menu (`LiveMoreMenuView`)
  // is presented from INSIDE PlayerShellView's own render tree (Surface 1), so it can never paint
  // above the family-2 合流聊天 feed (Surface 2, declared AFTER Surface 1 below — RN stacks
  // z-index-less absolutely-positioned siblings by declaration order). Threading this here lets
  // the chat feed hide itself while the menu is up, so it isn't hidden behind the chat / doesn't
  // have its taps swallowed by the chat's scrollable hit-testing.
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // rb-rn-scrub-expanded-chrome-lift — mirror PlayerShellView's scrub-bar post-release hold
  // window (`onScrubBarExpandedChange`, already GATED to `scrubBarExpanded && !isScrubbing`) the
  // SAME way infoPanelOpen / cleanMode / moreMenuOpen are mirrored above, so the LIVE-only chat
  // feed (Surface 2, rendered OUTSIDE PlayerShellView's own render tree) lifts by the SAME
  // SCRUB_CHROME_LIFT during that hold window that PlayerShellView's own LIVE overlay chrome /
  // VOD chrome already apply internally.
  const [scrubBarExpanded, setScrubBarExpanded] = useState(false);

  // Container-owned product LIST drawer open state (default CLOSED). The GOODS rail / bag tap
  // opens it; the scrim / close button dismisses it (re-openable). Parity iOS
  // `ProductSheetsModel.listPresented` (default false) — no longer auto-presents over the video.
  const [productListPresented, setProductListPresented] = useState(false);
  const onRailTap = (kind: LBSideRailKind): void => {
    if (kind === LBSideRailKind.Goods) setProductListPresented(true);
    else shell.onTapRailItem(kind);
  };

  return (
    <>
      {/* Surface 1 — player-shell chrome (header / rail / LIVE bottom bar / swipe). */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <PlayerShellView
          template={template}
          theme={theme}
          // Turnkey container composes over a real video surface → load the real shop
          // logo in the header avatar (rb-rn-player-header-real-shop-logo parity).
          live
          onMinimize={shell.onMinimize}
          // Tap-to-mute is a no-arg shell callback; read the LIVE muted truth off a
          // fresh read-only model so the toggle flips the actual state (first tap
          // unmutes). The seam default → `setMuted(!muted)`.
          onToggleMute={(): void => shell.onToggleMute(new PlayerShellModel(template).muted)}
          // 訂閱徽章（PlayerHeader 頭像徽章）→ 容器注入的 gate（未登入 → 本地 AuthGate(Subscribe)、已登入
          // → simulateSubscribeTap）。RN 訂閱鈕原本未接 → 死按鈕；本 gate 一併修好（rb-rn-subscribe-login-gate）。
          onToggleSubscribe={shell.onToggleSubscribe}
          onTapRailItem={onRailTap}
          // 頻道分享預設 fallback（rb-rn-player-share-default-sheet，parity iOS rb-ios-live/vod-share-default-sheet）：
          // 直播/回放底部 bar（lb_live_share）與純 VOD 側欄（lb_rail_share）分享鈕改走與商品詳情分享同一條
          // sheet.onShare（= config.onShare ?? (shareUrl 非空時 shareSystem(shareUrl))）；未攔截 host 得系統分享。
          onShare={sheet.onShare}
          // 聯絡商家 confirm「確定」預設 fallback（dropin-service-link-default-browser-rn，parity
          // iOS/Android performServiceLink()）：容器注入 shell.onServiceLink（= config.onServiceLink ??
          // (serviceLink 非空時開站內瀏覽器)）；未攔截 host 得站內瀏覽器。
          onServiceLink={shell.onServiceLink}
          // 「現正直播」right-edge half-pill（rb-rn-live-now-pill）：`hasLiveNow` 由容器輪詢結果
          // 推導，`onGoLive` 為上方建構好的 tap handler（host `config.onGoLive` 覆蓋 或 預設
          // in-place 換片，見 buildGoLiveHandler）。
          hasLiveNow={liveNow != null}
          onGoLive={goLive}
          onOpenProduct={(): void => setProductListPresented(true)}
          onComment={shell.onComment}
          // LIVE 底部 bar 暱稱按鈕 → 本地呈現 設定暱稱 modal（parity iOS / Android；不走 host 轉接的 rail 出口）。
          onNickname={shell.onNickname}
          // VOD now-introducing 卡片 body tap → 開該商品明細（core simulateProductTap），重用
          // 既有 sheet product-tap 出口（rb-rn-now-introducing-real-image-carousel，問題 9/10）。
          // 真實圖 `live` 沿用此 container 對 <ProductSheetsView> 的傳遞（見下方 Surface 3 呼叫，
          // rb-rn-product-sheets-live-images-wiring 起已接上 live → 真圖，不再是 placeholder）。
          onTapNowIntroducingProduct={sheet.onOpenProduct}
          // Mirror info-panel open state so the chat feed hides while it's up.
          onInfoPanelOpenChange={setInfoPanelOpen}
          // rb-rn-clean-mode-hide-chat-feed — mirror cleanMode so the sibling FeedWinView
          // (below) can also hide the chat feed while clean mode is on.
          onCleanModeChange={setCleanMode}
          // rb-rn-live-more-sheet-above-chat — mirror the「更多」menu open state so the sibling
          // FeedWinView (below) can hide the chat feed while the menu is presented.
          onMoreMenuOpenChange={setMoreMenuOpen}
          // rb-rn-scrub-expanded-chrome-lift — mirror the scrub-bar post-release hold window so
          // the sibling FeedWinView (below) can lift its chat feed by the SAME SCRUB_CHROME_LIFT.
          onScrubBarExpandedChange={setScrubBarExpanded}
          // Once-per-open LIVE gesture hints — host opts in via config (default false).
          showGestureHints={config.showGestureHints}
          // 訂閱徽章可見性（rb-rn-subscribe-favorite-visibility-toggle）：raw 轉發，leaf 元件
          // （PlayerHeaderBarView）owns 唯一的預設值 false（隱藏）。
          showSubscribe={config.showSubscribe}
          // 觀看人數徽章可見性（rb-rn-viewer-count-visibility-toggle）：raw 轉發，leaf 元件
          // （PlayerHeaderBarView）owns 唯一的預設值 true（顯示）——與 showSubscribe 極性相反。
          showViewerCount={config.showViewerCount}
          // 右上角按鈕圖示（rb-rn-player-direct-close-button）：容器已用 resolveDirectCloseButtonEnabled
          // 解析過 config.enableDirectCloseButton ?? LivebuySDK.isDirectCloseButtonEnabled()，這裡轉發
          // 的是「已解析值」，非 raw config 欄位。
          showCloseIcon={showCloseIcon}
          // 標題跑馬燈的商家能力閘（rb-rn-marquee-title-scroll）：**raw 轉發**，容器不解讀
          // `extensions` 語意；唯一的 fallback 入口在葉元件 `MarqueeTitle` 的
          // `normalizeTitleScroll`（缺值 / 畸形值一律落「允許捲」，對齊後端未設定即 1）。
          titleScroll={config.titleScroll}
          // Hide the LIVE bottom bar while the opaque 留言 composer is up (avoid overlap). The
          // controller's isOpen is React state held up-tree, so this re-renders on open/close.
          composerPresented={composer.isOpen}
          // Swipe toward an empty direction (no next / prev) → close the player
          // (swipe-nav-close-on-empty): host `config.onDismiss` wins, else fall back to core
          // `player.unload()` (stop poll/timer, pause, clear video/channel, playerState=ended).
          // reference-ui itself NEVER directly calls unload — it routes through this facade.
          onCloseRequest={config.onDismiss ?? ((): void => safePlayerRef.unload())}
          // Swipe in-place switch → record the shown id + raise `config.onVideoSwitched(id)`
          // (swipe-video-switched-notify, parity iOS / Android). `switchVideo` is notify-only (the
          // swipe already loaded via the template forwarder), so no redundant `load` here.
          onDidSwitchVideo={switchVideo}
          // VOD CC 字幕 cue 清單（rb-react-native-subtitle-vtt-caption-display）：容器 fetch + 解析
          // channel.subtitle_url 後持有的 state，往下傳給 shell 現算目前 position 命中的字幕文字。
          subtitleCues={subtitleCues}
        />
      </View>

      {/* Surface 2 — merged feed + 四階段領獎 modal（含 email 輸入）。 */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <FeedWinView
          template={template}
          theme={theme}
          // Runtime: scrollable chat (binds deeper feedHistory) so the user can scroll
          // up to view history (rb-rn-chat-feed-scrollable parity #5b/#6).
          chatScrollable
          // Hide the chat feed while the info panel is up (parity iOS rb-ios-info-panel-not-
          // covered-by-chat); FeedWinView also drops it entirely in VOD (LIVE-only).
          infoPanelOpen={infoPanelOpen}
          // rb-rn-clean-mode-hide-chat-feed — hide the chat feed while clean mode is on
          // (design screens.jsx:532 LBLiveChatOverlay `!cleanMode` gate). WinEntry / its
          // WinClaimSheetView are unaffected — see FeedWinView.tsx's chatVisible comment.
          cleanMode={cleanMode}
          // rb-rn-live-more-sheet-above-chat — hide the chat feed while PlayerShellView's
          // 「更多」(⋯) collapsed menu is presented (the menu lives inside Surface 1's render
          // tree and can never paint above this Surface 2 sibling otherwise). WinEntry /
          // ActivityEntry / their sheets are unaffected — see FeedWinView.tsx's chatVisible
          // comment.
          moreMenuOpen={moreMenuOpen}
          // rb-rn-scrub-expanded-chrome-lift — 進度條展開暫留期間額外上移聊天 feed，與既有公告避讓量
          // 獨立相加（見 FeedWinView.chatBottomInsetWithScrubLift）。
          scrubBottomInset={scrubBarExpanded ? SCRUB_CHROME_LIFT : 0}
          // rb-rn-event-join-gate:「加入活動」三層閘注入 overlay 自持的 FeedWinModel.joinEvent（唯一到
          // 得了 core 的 chokepoint）。onJoin 為 no-op 觀察者（join 由已被閘的 model.joinEvent 單一送出）。
          joinEventGate={joinEventGate}
          onJoin={feed.onJoin}
          // 🔴 帶 email 的領獎提交（rb-rn-win-claim-email-flow —— EMAIL-LESS 已退役）。
          onSubmitClaim={feed.onSubmitClaim}
          onOpenClaim={feed.onOpenClaim}
          onDismissClaim={feed.onDismissClaim}
          onCopyClaimCode={feed.onCopyClaimCode}
        />
      </View>

      {/* Surface 3 — product list / detail / variant / qty / mini-cart / restock. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <ProductSheetsView
          template={template}
          theme={theme}
          // Turnkey container composes over a real video surface → load the real product photos
          // in the sheet list / detail /「更多商品」推薦格 / restock notice / zoom lightbox
          // (rb-rn-product-sheets-live-images-wiring; parity with PlayerShellView's `live` above).
          live
          presented={productListPresented}
          onDismissList={(): void => setProductListPresented(false)}
          onOpenProduct={sheet.onOpenProduct}
          onOpenCart={sheet.onOpenCart}
          onSelectVariant={sheet.onSelectVariant}
          onSetQty={sheet.onSetQty}
          onInc={sheet.onInc}
          onDec={sheet.onDec}
          onAddToCart={sheet.onAddToCart}
          onToggleFavorite={sheet.onToggleFavorite}
          onNotifyRestock={sheet.onNotifyRestock}
          onShare={sheet.onShare}
          onSeekToProductIntro={sheet.onSeekToProductIntro}
          onShareProduct={sheet.onShareProduct}
          // 商家的 `extensions.show_stock`（rb-rn-show-stock-caption-toggle）：raw 值原樣往下遞，
          // 唯一的 fallback 入口在葉元件 `ProductDetail` 的 `normalizeShowStock`。容器不解讀、
          // 不正規化、也不自行讀 `sdkConfig.extensions`（那是 host 責任）。
          showStock={config.showStock}
          // 收藏鈕可見性（rb-rn-subscribe-favorite-visibility-toggle）：raw 轉發，leaf 元件
          // （ProductDetail）owns 唯一的預設值 false（隱藏）。
          showFavorite={config.showFavorite}
          // 加購「需登入」gate's 前往登入 → host login flow (`config.onLogin`), the SAME host hook the
          // comment login-gate uses (cart-needs-login-gate). reference-ui NEVER logs in itself.
          onRequestLogin={gap.onLogin}
          // 「更多商品」推薦格播放圖示 → 换片（rb-rn-product-detail-recommendations，design.md D3）。
          onSwitchRecommendationVideo={sheet.onSwitchProductVideo}
        />
      </View>

      {/* Surface 4 — gap-surface modals (auth-gate / guest-name-edit). */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <GapSurfacesOverlayView
          template={template}
          theme={theme}
          // 設定暱稱 modal 由容器本地呈現（parity iOS / Android）：controller 驅動可見性 + runtime
          // editable + 送出中 / 錯誤呈現（rb-rn-nickname-taken-inline-error：`nickname.submitting` /
          // `.submitFailure`）；submit / scrim 經 gap 出口（onSubmitName turnkey →
          // setGuestNicknameVerified，checkName-驗證）。
          nicknameController={nickname}
          // 「請先登入」modal 由容器本地呈現（rb-rn-live-comment-login-gate）：controller 驅動可見性；
          // 前往登入經 gap onLogin（host config.onLogin）。
          loginController={login}
          onLogin={gap.onLogin}
          onSubmitName={gap.onSubmitName}
          onDismiss={gap.onDismiss}
        />
      </View>

      {/* On-demand chat composer (LIVE「留言...」pill opens it). */}
      <ChatComposerBar
        theme={theme}
        controller={composer}
        onSend={(text: string): void => safePlayerRef.sendChat(text)}
      />

      {/* Surface 5 — full-screen moments (start / end / error), topmost. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <MomentsView
          template={template}
          theme={theme}
          // Turnkey container composes over a real video surface → load the real end-screen
          // cover photo in the 倒數變體 preview card (rb-rn-endscreen-recommended-video-cover;
          // parity with PlayerShellView's `live` above). Standalone / snapshot faces omit it → false.
          live
          // rb-rn-clean-mode-upcoming-intro-coverage — mirror PlayerShellView's cleanMode the SAME
          // way it is already mirrored to FeedWinView above (the `cleanMode` state declared near
          // the top of this component), so the splash-phase StartScreen can hide its「略過介紹」
          // skip pill while clean mode is on.
          cleanMode={cleanMode}
          // rb-rn-endscreen-live-duration — forward the container-held, already-formatted
          // live-duration string straight through to the EndScreen 空狀態's「直播時長：…」line.
          liveDuration={liveDuration}
          onWatchNext={onWatchNext}
          onSkip={moment.onSkip}
          onCancel={moment.onCancel}
          // 空狀態「查看購物車」CTA (rb-rn-endscreen-live-empty-state) — reuses the SAME
          // open-product-list action the bag / side-rail Goods tap already uses above.
          onViewCart={(): void => setProductListPresented(true)}
          onRetry={moment.onRetry}
          onDismiss={moment.onDismiss}
          onClosePlayer={moment.onClosePlayer}
        />
      </View>
    </>
  );
}
