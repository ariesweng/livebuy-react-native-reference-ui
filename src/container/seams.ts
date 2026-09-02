// seams — the drop-in container's default-seam handler builders (PURE; no value
// import of `livebuy-react-native`, so they stay fake-testable in plain node and
// the test suite never loads the core's `requireNativeComponent` bridge).
//
// Each `build*Handlers` is a PURE function of its `SeamDeps` (no react / render):
// it returns the `on*` callbacks the container passes to a family overlay, each as
// `config.onX ?? (built-in default)`. The fake-based wiring tests (D-8 / R3) build
// a fake `attachment` + capturing `playerRef` and assert every un-overridden
// default forwards to the expected `attachment` / `playerRef` call.

import type { LivebuyPlayerCoreRef } from 'livebuy-react-native';
import type { LBProduct, LBVideoItem, LBWinner, LBAwardClaimInput } from 'livebuy-react-native';
import { LBSideRailKind, LBAuthTriggerAction } from 'livebuy-react-native-ui';
import type { PlayerTemplateAttachment } from 'livebuy-react-native-ui';

import { switchedVideoItem } from './collapsibleLogic';

import type {
  ChatComposerController,
  NicknamePromptController,
  LoginPromptController,
} from './ChatComposerBar';
import { GapSurfacesModel } from '../gapsurfaces/GapSurfacesModel';
import type { LivebuyPlayerConfig } from './LivebuyPlayerConfig';

/**
 * The minimal player-ref surface the container drives (subset of `LivebuyPlayerCoreRef` + two flat
 * facade methods). `simulateSubscribeTap` is a FLAT convenience the container's `safePlayerRef`
 * adapts to core `videoInfoPanel.simulateSubscribeTap()` (rb-rn-subscribe-login-gate): the header
 * 訂閱徽章的已登入分支呼叫它 → core `toggleSubscribe()` → API + `SUBSCRIBE_CHANGED`.
 * `simulateProductTap` is the SAME flattening applied to core
 * `productOverlay.simulateProductTap()` (rb-rn-product-tap-wire); `simulateLikeTap` likewise for
 * core `operationPanel.simulateLikeTap()` (rb-rn-like-tap-wire). `setGuestNicknameVerified` is a
 * DIRECT pick (no flattening needed — it sits top-level on `LivebuyPlayerCoreRef` already), used by
 * the 設定暱稱 modal's checkName-gated turnkey submit (rb-rn-nickname-taken-inline-error).
 */
export type PlayerRefLike = Pick<
  LivebuyPlayerCoreRef,
  | 'load'
  | 'setMuted'
  | 'skipStart'
  | 'cancelAutoNext'
  | 'minimize'
  | 'sendChat'
  | 'seek'
  | 'unload'
  | 'setGuestNicknameVerified'
> & {
  /** 已登入訂閱出口（facade → core `videoInfoPanel.simulateSubscribeTap()`；rb-rn-subscribe-login-gate）。 */
  simulateSubscribeTap(): void;
  /**
   * 商品點擊的 **telemetry** 出口（facade → core `productOverlay.simulateProductTap(product)`；
   * rb-rn-product-tap-wire）。native 端 `productOverlayView.onProductTap` 由此派出 `INFO_PRODUCT_VIEW`
   * 事件 + `goods_pv` stat + `PRODUCT_CLICK` 事件——這三件**只**在 native 觸發，JS 側無法補發。
   *
   * 取 `productOverlay` 而**非** `productListPanel`：telemetry 掛在前者的 handler 上，且 iOS
   * `performProductTap` / Android `defaultProductTap` 委派的也是它（`productListPanel.simulateProductTap`
   * 是另一條 handler，取它會與四端 parity 斷掉）。
   *
   * 注意這個出口**不會**開明細 sheet——見 {@link defaultOpenProduct} 的說明。
   */
  simulateProductTap(product: LBProduct): void;
  /**
   * 按讚出口（facade → core `operationPanel.simulateLikeTap()`；rb-rn-like-tap-wire）。橋接命令
   * `operationPanel_simulateLikeTap` 打到 native `operationPanelView.simulateLikeTap()`，下游是**既有**
   * 250ms throttle → 按讚 API → `VIDEO_LIKE`。
   *
   * reference-ui **MUST NOT** 在這之上再疊一層防連點節流 —— 節流是 core 的既有職責，疊第二層會讓兩層
   * 都對「使用者按了幾次」有意見，且四端只有 RN 有，屬新增分歧。
   *
   * 這個出口與 LIVE 底部 bar 的**飄心動畫是兩條獨立的線**：動畫由 `PlayerShellView` 自己的
   * `liveHeartTick` state 驅動，本 facade 只負責真動作。修法前只有動畫那條是活的（見
   * {@link defaultRailTap}）。
   */
  simulateLikeTap(): void;
  /**
   * CC 字幕開關出口（facade → core `operationPanel.simulateSubtitleToggleTap()`；
   * rb-react-native-subtitle-vtt-caption-display）。橋接命令
   * `operationPanel_simulateSubtitleToggleTap` 打到 native
   * `operationPanelView.simulateSubtitleToggleTap()`，下游是 core 既有的 `subtitleTrack.toggle()`
   * → 派發 `SUBTITLE_TOGGLE` 統一事件（容器監聽後回寫 `template.handleMomentSnapshot({
   * subtitleEnabled })`，見 `container/subtitlePipeline.ts` 與 `LivebuyPlayer.tsx` 的接線）。
   */
  simulateSubtitleToggleTap(): void;
};

/**
 * The minimal player-ref surface the award-claim injection drives (a structural subset of
 * `LivebuyPlayerCoreRef`, so `seams.ts` stays value-import-free and node-testable).
 */
export interface AwardClaimPlayerRefLike {
  requestAwardClaim(winner: LBWinner, contact?: LBAwardClaimInput): void;
}

/**
 * 🔴 Build the turnkey container's player-bound award-claim injection — a **FULL 2-arity**
 * forwarder (rb-rn-win-claim-email-flow). `LivebuyPlayer` hands the result to
 * `attachPlayerTemplate({ requestAwardClaim })`.
 *
 * **改動前務必讀完這段。** 這個 seam 之前寫在容器裡、且只吃一個參數：
 * `requestAwardClaim: (winner) => playerRef.current?.requestAwardClaim(winner)`。注入型別早就是
 * 2-arity 的 `RequestAwardClaimWithContact`，但 TypeScript **允許把少參數的 callback 指派給多參數
 * 的函式型別**，所以那一行**編譯完全通過卻靜默丟棄 `contact`**：上游 template 已把使用者輸入的
 * email 包成 `{ email }` 交出來，卻在這裡消失，於是 RN turnkey 路徑的領獎在未被 host 攔截時
 * **必然失敗**（core 預設領獎路徑 `email` 必填，缺 email 直接 fail-fast、**連
 * `POST /sdk/video/claim` 都不送**）。
 *
 * 型別**抓不到**這種缺漏，所以除了寫成完整 2-arity，它還被抽到這個純模組並有一條「core 端真的
 * 收到 contact」的行為釘樁 —— 容器 `LivebuyPlayer.tsx` 在 jest 環境載不起來（core 的
 * `NativeModules` / `requireNativeComponent` 不在 in-package mock 內），inline arrow 無法被測，
 * 這正是此 bug 得以存活至今的原因。
 *
 * 未掛載的 native ref → safe no-op（never throws）。
 */
export function buildAwardClaimInjection(playerRef: {
  readonly current: AwardClaimPlayerRefLike | null;
}): (winner: LBWinner, contact?: LBAwardClaimInput) => void {
  return (winner: LBWinner, contact?: LBAwardClaimInput): void => {
    playerRef.current?.requestAwardClaim(winner, contact);
  };
}

/**
 * 組商品分享連結（issue 6）：在 `base`（= `channel.share_url`）後加上商品介紹時間 `t=<beginTime>`（秒）。
 * Pure（無副作用）所以單元測 + host override 共用一份實作（iOS / Android / Flutter `productShareURLString`
 * parity）。RN reference-ui 把 per-product 系統分享委派 host（與既有 `onShare` 一致），此 helper 供 host
 * 自組連結後以 `Share.share` 呈現。
 * - `base` 為空 → 回 `''`。
 * - `beginTime` 為 null 或負 → 回 `base`（不加 `?t=`）。
 * - `base` 已含 query（`?`）→ 用 `&` 串接，否則 `?`。
 */
export function productShareUrlString(base: string, beginTime: number | null | undefined): string {
  if (base.length === 0) return '';
  if (beginTime == null || beginTime < 0) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}t=${beginTime}`;
}

/**
 * 頻道分享是否該呈現（dropin-player-default-share-sheet-rn）：`shareUrl` 非空才呈現（空 → no-op，不開空
 * sheet）。Pure 所以決策與 jest 共用一份。頻道級分享**不**附 `?t=`（與 `productShareUrlString` 區隔）。
 */
export function lbShouldPresentChannelShare(shareUrl: string): boolean {
  return shareUrl.length > 0;
}

/**
 * 聯絡商家連結是否該開站內瀏覽器（dropin-service-link-default-browser-rn，parity
 * `lbShouldPresentChannelShare`）：`serviceLink` 非空才開（空 → no-op，不開空白頁）。
 */
export function lbShouldPresentServiceLink(serviceLink: string): boolean {
  return serviceLink.length > 0;
}

/**
 * Optional-preserving login forward with a dismiss (dropin-hide-unwired-affordances-rn, parity iOS /
 * Android `lbForwardLogin`): a gate that wants「前往登入」to ALSO dismiss its own local modal (LIVE 留言
 * login gate / cart-needs-login gate) must NOT wrap `onLogin` into an eternally-defined function — that
 * would defeat `AuthGateModal`'s `onLogin != null` render guard and leave the dead button. `undefined`
 * in → `undefined` out (button stays hidden, dismiss still reachable via「稍後再說」/ scrim); defined in →
 * a fn that dismisses FIRST then runs the host login.
 */
export function lbForwardLogin(
  onLogin: (() => void) | undefined,
  dismiss: () => void,
): (() => void) | undefined {
  return onLogin == null ? undefined : (): void => {
    dismiss();
    onLogin();
  };
}

/** Shared deps captured by every handler builder. */
export interface SeamDeps {
  readonly playerRef: PlayerRefLike;
  readonly attachment: PlayerTemplateAttachment;
  readonly config: LivebuyPlayerConfig;
  readonly composer: ChatComposerController;
  /** The on-demand 設定暱稱 modal controller (LIVE 暱稱 button + 留言 gating). */
  readonly nickname: NicknamePromptController;
  /** The on-demand「請先登入」modal controller (LIVE 留言 login gate; rb-rn-live-comment-login-gate). */
  readonly login: LoginPromptController;
  /**
   * Present the system share sheet for a channel URL (turnkey default for the footer 分享 when the host
   * did NOT wire `config.onShare`). Injected by the container as `(url) => void Share.share({ message: url })`
   * so `seams.ts` stays a PURE module (no `react-native` value import). Parity with iOS
   * `UIActivityViewController` / Android `Intent.ACTION_SEND` (dropin-player-default-share-sheet-rn).
   */
  readonly shareSystem: (url: string) => void;
  /**
   * Reads the most recently received `LBPlayerChannelInfo.serviceLink` (from the container's
   * `<LivebuyPlayerCore onChannelChange>` subscription; dropin-service-link-default-browser-rn).
   * `''` before the first `onChannelChange` fires, or when the shop has no service link.
   */
  readonly serviceLink: () => string;
  /**
   * Open a URL in the SDK's in-app browser (turnkey default for the 聯絡商家 confirm「確定」when
   * the host did NOT wire `config.onServiceLink`). Injected by the container as
   * `(url) => LivebuySDK.openInAppBrowser(url)` so `seams.ts` stays a PURE module (no
   * `livebuy-react-native` value import). Parity iOS / Android `performServiceLink()`
   * (dropin-service-link-default-browser-rn — RN has no synchronous intercepted-Bool return; see
   * that change's design.md for why).
   */
  readonly openInAppBrowser: (url: string) => void;
  /** Reads the currently-shown video id (cover loads + in-place switches). */
  readonly currentVideoId: () => string;
  /**
   * Records an in-place video switch and notifies the host. `item` (optional) carries the SWITCHED
   * video's full `LBVideoItem` with its REAL cover / title (hot-pick / watch-next); omitted for
   * swipe (id-only, no adjacency rows in JS — `LivebuyPlayer` then reports a cover-empty fallback).
   * (rb-rn-collapsible-player-track-switch.)
   */
  readonly switchVideo: (videoId: string, item?: LBVideoItem) => void;
}

/**
 * 留言 pill 預設 gating（純函式，與容器 `onComment` 共用一份；parity iOS / Android 同名）：
 * 暱稱**尚未選名**（`!isLoggedIn && displayName === ''`）→ 回 `true`，容器先呈現 設定暱稱 modal；
 * 已選名（訪客經 `setGuestNickname` 設名 → displayName 非空）或已登入 → 回 `false`，直接開 composer。
 * host 自訂 `config.onComment` 時 MUST NOT 經此函式（完全接管、不套 gating）。
 */
export function liveCommentRequiresNickname(isLoggedIn: boolean, displayName: string): boolean {
  return !isLoggedIn && displayName.length === 0;
}

/**
 * 留言 pill 預設**登入**閘（純函式，與容器 `onComment` 共用一份；rb-rn-live-comment-login-gate，方案 A，
 * parity iOS / Android 同名）：該場直播 `guest_comment == 0` → `chatEnabled === false`（留言 pill 只在
 * LIVE 出現，故 `!chatEnabled ⟺ guest_comment==0`；RN `chatEnabled` 已含 `!(isGuest && gc==0)`）且**未
 * 登入** → 回 `true`，容器先本地呈現「請先登入」modal（`AuthGateModal(CommentSend)`），MUST NOT 開
 * composer / 跳暱稱 modal。已登入者一律 `false`（`guest_comment` 只閘訪客）。**登入閘 MUST 優先於暱稱閘**。
 * host 自訂 `config.onComment` 時 MUST NOT 經此函式（完全接管、不套 gating）。
 */
export function liveCommentRequiresLogin(isLoggedIn: boolean, chatEnabled: boolean): boolean {
  return !isLoggedIn && !chatEnabled;
}

/**
 * 訂閱徽章預設**登入**閘（純函式，與容器 `onToggleSubscribe` 共用一份；rb-rn-subscribe-login-gate，parity
 * iOS / Android 同名）：使用者**未登入** → 回 `true`，容器先本地呈現「請先登入」modal
 * （`AuthGateModal(Subscribe)`），MUST NOT 觸發訂閱；已登入 → 回 `false`，直接
 * `playerRef.simulateSubscribeTap()`（→ core `toggleSubscribe()` + `SUBSCRIBE_CHANGED`）。訂閱要登入，故
 * **只看登入狀態、不看 chatEnabled**（與留言閘 `liveCommentRequiresLogin` 的雙條件不同——留言可開放訪客，
 * 訂閱不行）。host 自訂訂閱流程時 MUST NOT 經此函式。
 */
export function subscribeRequiresLogin(isLoggedIn: boolean): boolean {
  return !isLoggedIn;
}

/**
 * 「加入活動」抽獎 CTA 的三層閘決策（rb-rn-event-join-gate，parity iOS / Android `EventJoinGateDecision`）。
 * 加入活動送出的本質**就是一則公開留言**（core `requestEventJoin` → `performSendChat`），故套與留言送出
 * 一致的閘，且 **MUST** 共用留言 pill 的**同一組純函式**（`liveCommentRequiresLogin` /
 * `liveCommentRequiresNickname`）——決策**不複製條件**、一律委派，讓兩入口永不分歧（比照 nickname-login-gate
 * 「兩入口用同一 predicate」原則）。優先序同 `onComment`：①**登入閘優先**（訪客 + 該場 `guest_comment==0`
 * ⟺ `!chatEnabled`）→ `'login'`；②否則暱稱閘（未設名訪客）→ `'nickname'`；③否則 `'proceed'`。
 */
export type EventJoinGateDecision = 'login' | 'nickname' | 'proceed';

export function eventJoinGateDecision(
  isLoggedIn: boolean,
  chatEnabled: boolean,
  displayName: string,
): EventJoinGateDecision {
  if (liveCommentRequiresLogin(isLoggedIn, chatEnabled)) return 'login';
  if (liveCommentRequiresNickname(isLoggedIn, displayName)) return 'nickname';
  return 'proceed';
}

/**
 * 套用「加入活動」三層閘（rb-rn-event-join-gate，parity iOS / Android `applyEventJoinGate`）：跑
 * `eventJoinGateDecision`，依決策執行對應副作用（`presentLogin` / `presentNickname` 皆以參數注入 → 本函式為
 * 純控制流、可用 capturing fake 單元測試，無需 render / template / controller）。回傳是否**已攔截**（`true` →
 * 呼叫端 MUST NOT forward join 到 template）。`'nickname'` 時把該次 `(eid, keyword)` 交給 `presentNickname`
 * 記為 pending join。
 */
export function applyEventJoinGate(args: {
  isLoggedIn: boolean;
  chatEnabled: boolean;
  displayName: string;
  eid: number;
  keyword: string;
  presentLogin: () => void;
  presentNickname: (eid: number, keyword: string) => void;
}): boolean {
  switch (eventJoinGateDecision(args.isLoggedIn, args.chatEnabled, args.displayName)) {
    case 'login':
      args.presentLogin();
      return true;
    case 'nickname':
      args.presentNickname(args.eid, args.keyword);
      return true;
    case 'proceed':
      return false;
  }
}

/**
 * 設定暱稱送出後接續 pending 的「加入活動」（rb-rn-event-join-gate，parity iOS / Android
 * `completePendingEventJoin`）：若存在暱稱閘記下的 pending join 意圖，透過注入的 `forwardJoin` **恰送一次**
 * （呼叫端以 **bypass-gate 的 direct `template.joinEvent`** 實作），回傳是否有 forward。續作 bypass gate：設名
 * 後 `displayName` 由 template 非同步刷新，此刻可能尚未落地，若再跑一次 gate 會誤判暱稱未設而重開 modal
 * （比照留言 pill 設名後直接開 composer 的「直接接續」語意）。Pure（副作用注入）→ 可用 fake 單測「有 pending →
 * 接續一次帶原 (eid, keyword)」「無 pending → 不送」。
 */
export function completePendingEventJoin(
  pending: { eid: number; keyword: string } | null | undefined,
  forwardJoin: (eid: number, keyword: string) => void,
): boolean {
  if (pending == null) return false;
  forwardJoin(pending.eid, pending.keyword);
  return true;
}

/**
 * 🔴 turnkey 容器的 **side-rail tap** 預設（rb-rn-like-tap-wire）。修法前 `onTapRailItem` 的預設是
 * `((): void => undefined)` —— 純 no-op，於是零 config 的 `<LivebuyPlayer />` 點 LIVE 底部 bar 的**愛心**
 * 只播本地飄心動畫、**按讚 API 一次都沒送**。
 *
 * 這顆死按鈕比一般的更難發現：動畫與動作是**兩條獨立的線**，而且只有其中一條是活的 ——
 * `PlayerShellView` 的 `onLike` 同時做 `setLiveHeartTick(t => t + 1)`（本地 state，活的）與
 * `handleRailTap(Like)`（→ 本預設，死的）。心照樣飛，所以目視 QA 抓不到。
 *
 * **為什麼寫在這個 seam、而不是像 iOS 那樣在 `PlayerShellView` 內硬接**（三個理由，任一條都足以否決）：
 *
 * 1. **RN 沒有 iOS 那條通道。** iOS 硬接的實體是 `model.performLike()` → `template.performLike()` →
 *    `player.performLike()`；RN 三層**都沒有** `performLike`，且 `react-native-ui` 的
 *    `handleLikePerformed` doc 明文宣示「The template NEVER fires like itself」。要複製 iOS 得先改
 *    view-model 層 → 跨層（I7），且與該層刻意的設計相牴觸。
 * 2. **`PlayerShellView` 是 zero-core-dependency 的像素層**，且被 snapshot / demo 路徑直接使用（沒有
 *    player ref）。硬接等於在像素層引入 core value-import。
 * 3. **硬接會讓愛心變成 host 不可覆寫的行為** —— Android / Flutter 的 host 可用 `config.onTapRailItem`
 *    完整接管愛心，RN 若硬接就對愛心失效，是往壞方向的四端分歧。
 *
 * **範圍：`Like` 與 `Subtitle`（rb-react-native-subtitle-vtt-caption-display 新增）有分支。** 其餘 6
 * 個 kind 在**容器路徑**下的現況（design.md D2 的逐 kind 判定；本函式本身是純的，直接以任何 kind
 * 呼叫都合法且 no-op）：
 * - `Goods` —— 到不了這裡：容器 `LivebuyPlayerOverlays.onRailTap` 先攔截 → 開商品列表抽屜。
 * - `Share` / `ServiceLink` / `GuestNameEdit` —— 到不了這裡：`PlayerShellView` / 容器以各自的**專用
 *   seam**（`onShare` / `onServiceLink` / `onNickname`）先行處理，而容器**一律**注入這三個 seam。
 * - `More` —— **保留路徑，目前不可達**：RN reference-ui production 源碼**沒有任何呼叫端**發出這個
 *   kind（`RAIL_PRESENTATION_ORDER` 只畫 Subtitle / Share / ServiceLink 且其 doc 明列 MORE 非 rail
 *   kind、`LiveBottomBarView` 無 more 鈕、`PlayerShellSeeds.railItems` 的 More 為 `enabled: false`）。
 *   `PlayerShellView.handleRailTap` 內確實有一個 `more` 分支（toggle 資訊面板後 fall-through 到這裡），
 *   但**沒有東西觸發它**；資訊面板實際的開啟點是 header host pill（`onTapHostBadge`）與公告橫幅
 *   （`onTapAnnounce`）。列在這裡是因為它在 enum 裡，不是因為它現在有作用。
 * - `Chat` —— RN reference-ui **沒有任何 UI 進場點**（不在 `RAIL_PRESENTATION_ORDER`、不在
 *   `LiveBottomBarView`），構不成死按鈕。
 * - `Subtitle`（CC）—— **已修復**（rb-react-native-subtitle-vtt-caption-display）：轉發到
 *   `deps.playerRef.simulateSubtitleToggleTap()`。修前是一顆死按鈕（有進場點、到得了這裡、這裡
 *   no-op）——當時刻意不修的理由是「RN reference-ui 沒有任何字幕渲染面，接上 core toggle 之後使用者
 *   看得到什麼是獨立且未決的問題」；現在 `CaptionOverlayView` + `VTTSubtitleParser` +
 *   `PlayerShellView.subtitleCues` 這條渲染面已經存在（同一 change 一併補上），接上 toggle 才有
 *   使用者可見的結果，不再是「呼叫了 core 卻依然沒有可見結果」的新型死按鈕。
 *
 * 未列出的 kind 在此就是**丟棄** —— core **看不到** reference-ui 自畫的 rail tap，不派 `simulate*`
 * 就沒有任何 core 動作、也沒有任何 core telemetry（這正是舊註解裡「telemetry already fired by core」
 * 那個假前提讓 no-op 看起來安全的地方）。
 *
 * 抽成具名純函式（而非容器內 inline arrow）的理由同 {@link defaultOpenProduct} /
 * {@link buildAwardClaimInjection}：inline arrow 在 jest 環境測不到。名稱刻意與 Android
 * `internal fun defaultRailTap` 一致，讓四端對照是純字串比對。
 */
export function defaultRailTap(deps: Pick<SeamDeps, 'playerRef'>, kind: LBSideRailKind): void {
  if (kind === LBSideRailKind.Like) deps.playerRef.simulateLikeTap();
  if (kind === LBSideRailKind.Subtitle) deps.playerRef.simulateSubtitleToggleTap();
}

/** player-shell seam defaults (minimize / mute / rail / comment / nickname / subscribe). */
export function buildShellHandlers(deps: SeamDeps): {
  onMinimize: () => void;
  onToggleMute: (muted: boolean) => void;
  onTapRailItem: (kind: LBSideRailKind) => void;
  onComment: () => void;
  onNickname: () => void;
  onToggleSubscribe: () => void;
  onServiceLink: () => void;
} {
  const { playerRef, attachment, config, composer, nickname, login, serviceLink, openInAppBrowser } =
    deps;
  return {
    onMinimize: config.onMinimize ?? ((): void => playerRef.minimize()),
    // Tap-to-toggle mute default（rn-player-mute-icon-echo，四端 parity iOS `LivebuyPlayer.swift` /
    // Android `android-reference-ui-wire-toggle-mute` / Flutter `flutter-player-toggle-mute-wire-reference-ui`）：
    // ①轉發 core 音訊 `playerRef.setMuted(!muted)`；②echo 回 template 圖示真相
    // `attachment.template.handleMutedChange(!muted)`——翻 `playerHeaderState.muted` + side-rail `muted`
    // （單一真相，靜音圖示 / `PlayerShellModel.muted` 讀此）。容器 overlay 每次點擊 live 讀該真相餵進本
    // seam，故有 echo 才會翻圖示、且下一下讀到翻轉值 → 可解除靜音（無 echo 則圖示恆脫鉤、靜音後永不解除，
    // Bug B）。`handleMutedChange` 是 view-model 層既有 public 方法，容器持有 player ref 故由此 echo 之。
    onToggleMute:
      config.onToggleMute ??
      ((muted: boolean): void => {
        playerRef.setMuted(!muted); // core 音訊
        attachment.template.handleMutedChange(!muted); // 圖示真相：echo → header + side-rail muted
      }),
    // side-rail / LIVE-bottom-bar tap（rb-rn-like-tap-wire）。DEFAULT: defaultRailTap —— `Like` →
    // playerRef.simulateLikeTap()（真按讚；缺這條就只剩飄心動畫的死按鈕），`Subtitle` →
    // playerRef.simulateSubtitleToggleTap()（rb-react-native-subtitle-vtt-caption-display），其餘
    // kind no-op。
    //
    // 這裡曾經寫著三句話，三句都與實情不符，故整段重寫（design.md D4 逐句佐證）：
    //   ①「Goods → the product-list overlay is ALWAYS composed」—— 已過時：`ProductSheetsView` 的
    //     `presented` 預設是 false（rb-rn-product-list-gated 對齊 iOS listPresented），抽屜並非恆常
    //     composed。`Goods` 之所以不需要這裡的預設，是因為容器 `LivebuyPlayerOverlays.onRailTap` 先
    //     攔截它並 setProductListPresented(true)（結論碰巧對，理由是錯的）。
    //   ②「other kinds are host-wired (telemetry already fired by core)」—— **明確為假**，而且正是讓
    //     no-op 看起來「安全」的假前提：RN 的 rail 是 reference-ui 自己畫在 headless core 之上，core
    //     根本看不到這個 tap；不派 simulate* 就沒有任何 core 動作、也沒有任何 core telemetry。
    //   ③「Default forwards to the host」—— 誤導：host 沒設 config.onTapRailItem 時它不是 forward 給
    //     誰，就是**丟掉**。
    //
    // 逐 kind 的真實分工見 defaultRailTap 的 doc。host 設 config.onTapRailItem 則完全取代本預設
    // （愛心 / CC 字幕開關也交給 host，parity Android / Flutter）。
    onTapRailItem:
      config.onTapRailItem ?? ((kind: LBSideRailKind): void => defaultRailTap(deps, kind)),
    // LIVE「留言...」pill → 三層 gating（rb-rn-live-comment-login-gate，方案 A）：①登入閘優先——訪客且
    // 該場 guest_comment==0（operationRailState.chatEnabled===false）→ 先本地呈現「請先登入」modal；
    // ②否則暱稱閘——未設名訪客 → 設定暱稱 modal（composeAfter=true、送出後接 composer）；③否則開 composer。
    // host 自訂 config.onComment 則完全接管、不套 gating（parity iOS / Android）。
    onComment:
      config.onComment ??
      ((): void => {
        const id = new GapSurfacesModel(attachment.template);
        const chatEnabled = attachment.template.operationRailState.chatEnabled;
        if (liveCommentRequiresLogin(id.isLoggedIn, chatEnabled)) {
          login.present();
        } else if (liveCommentRequiresNickname(id.isLoggedIn, id.identity?.displayName ?? '')) {
          nickname.present(true);
        } else {
          composer.open();
        }
      }),
    // LIVE 底部 bar 暱稱按鈕 → 本地呈現 設定暱稱 modal（不走 host 轉接的 rail 出口；parity iOS / Android
    // 問題 1）。送出後不接 composer（composeAfter=false）。固定 reference-ui 行為，非 host override。
    // **登入閘**（rb-rn-nickname-login-gate / iOS 9d1048e / Android 5e87816）：若該場直播留言需登入
    // （訪客 + guest_comment==0 ⟺ operationRailState.chatEnabled===false）→ 點暱稱也比照留言先呈現
    // 「請先登入」modal（與 onComment 共用同一純函式 liveCommentRequiresLogin），MUST NOT 開暱稱 modal
    // ——非登入不可留言的訪客不該先去設一個用不到的暱稱。決策與 onComment 的登入閘完全一致。
    onNickname: (): void => {
      const id = new GapSurfacesModel(attachment.template);
      const chatEnabled = attachment.template.operationRailState.chatEnabled;
      if (liveCommentRequiresLogin(id.isLoggedIn, chatEnabled)) {
        login.present();
      } else {
        nickname.present(false);
      }
    },
    // 訂閱徽章（PlayerHeader 頭像徽章；RN 唯一可互動的訂閱入口）→ **登入閘**（rb-rn-subscribe-login-gate，
    // parity iOS / Android）：訪客（`subscribeRequiresLogin`）→ 先本地呈現「請先登入」modal
    // （`login.present(Subscribe)` → `AuthGateModal(Subscribe)`），MUST NOT 訂閱；已登入 →
    // `playerRef.simulateSubscribeTap()`（→ core `toggleSubscribe()` → API + `SUBSCRIBE_CHANGED`，行為
    // 零改）。訂閱只看登入狀態、不看 chatEnabled。固定 reference-ui 行為，非 host override（RN 訂閱鈕原本
    // 未接 → 死按鈕；本 gate 一併修好並補登入閘）。
    onToggleSubscribe: (): void => {
      const id = new GapSurfacesModel(attachment.template);
      if (subscribeRequiresLogin(id.isLoggedIn)) {
        login.present(LBAuthTriggerAction.Subscribe);
      } else {
        playerRef.simulateSubscribeTap();
      }
    },
    // 聯絡商家 confirm「確定」預設（dropin-service-link-default-browser-rn）：host 設
    // config.onServiceLink → 覆蓋；未設 → 讀容器 onChannelChange 收到的最新 serviceLink，非空才開站內
    // 瀏覽器（lbShouldPresentServiceLink 閘）；空 → no-op（不退回 onTapRailItem — 與 onShare 對齊，
    // PlayerShellView 的 fallback 只在此 handler 完全未注入、即非容器用法時才觸發）。
    onServiceLink:
      config.onServiceLink ??
      ((): void => {
        const url = serviceLink();
        if (lbShouldPresentServiceLink(url)) openInAppBrowser(url);
      }),
  };
}

/**
 * 🔴 turnkey 容器的**商品點擊**預設（rb-rn-product-tap-wire）。修法前 `onOpenProduct` 的預設是
 * `((): void => undefined)` —— 純 no-op，於是零 config 的 `<LivebuyPlayer />` 點商品**完全沒反應**：
 * 明細 sheet 不開（不是「開了但空」），三件 telemetry 也全不送。
 *
 * **兩個出口缺一不可**，這是本函式存在的全部理由：
 *
 * 1. `playerRef.simulateProductTap(product)` → core `productOverlay.simulateProductTap` → native
 *    `productOverlayView.onProductTap` 派 `INFO_PRODUCT_VIEW` + `goods_pv` + `PRODUCT_CLICK`。
 *    這三件**只**在 native 觸發，JS 側補不了。
 * 2. `attachment.handleProductTap(product, 0)` → view-model `DefaultPlayerTemplate.handleProductTap`
 *    → `productSheet.openDetail(full)` → `productDetailState` 非 null → 明細 sheet 才 mount。
 *
 * **為什麼只做 1 不夠**（這是最容易踩的陷阱）：native 派回的 `PRODUCT_CLICK` 在 RN 橋接上是 light
 * payload `{product_id, video_id}`，`TemplateAttachment` 原封轉給 `handleProductTap`，該處
 * `product.id === undefined`（`product_id` ≠ `id`）就 early-return。iOS / Android 之所以只要一行
 * `performProductTap` 就夠，是因為它們有**同進程**的 route-A typed callback 把完整 `LBProduct` 交回
 * template；RN 沒有那條線（且橋接把 `PRODUCT_CLICK` 列入 `SYNC_INTERCEPTOR_EVENTS`，只要 JS 註冊過
 * listener 就回 intercepted=true，native 的 route-A callback 根本不會跑）。這個 light-payload 守衛
 * 是 `react-native-ui` 刻意且被測試釘死的行為，MUST NOT 為了本 change 去放寬它。
 *
 * **為什麼只做 2 不夠**：sheet 會開，但 `goods_pv`（商品曝光統計）與 `PRODUCT_CLICK`（host 攔截導購的
 * 官方 hook）全部不送。
 *
 * **順序**：先 1 後 2，對齊 native 既有順序（先 telemetry、後開 sheet）。跨橋接的相對順序本就不可觀測，
 * 這麼寫純粹是讓程式碼與 native 同形、降低日後對照成本。
 *
 * **`diversion` 固定 `0`**：iOS / Android 傳的是**頻道級** `channel.diversion`，而 RN 橋接的
 * `LBPlayerChannelInfo` 不含該欄位、RN 也沒有其他管道拿得到它；`0` 與 RN 既有 fallback 一致
 * （`TemplateAttachment` 對缺席的 `params.diversion` 亦取 `0`）。**MUST NOT** 改用「`product.diversionUrl`
 * 非空 → `diversion = 1`」來推導：導購是**頻道級**決定，商品可以帶著 `diversionUrl` 而頻道
 * `diversion == 0`（此時 native 開的是站內明細），照那樣推導會誤開外部瀏覽器。要支援 `diversion == 1`
 * 得先讓 core 橋接吐出 `channel.diversion`，屬 `-core` 層、另行提案。
 *
 * host-takeover 兩道閘都仍然有效且**不需**本函式自己判：reference-ui 層由 `config.onOpenProduct`
 * 完全取代本預設；view-model 層由 `handleProductTap` 的第一道 `if (this.hostOwnsCart) return;` 守衛。
 *
 * 抽成具名純函式（而非容器內 inline arrow）的理由同 {@link buildAwardClaimInjection}：inline arrow 在
 * jest 環境測不到，這正是那個「靜默丟棄 contact 參數卻編譯得過」的 bug 得以存活的原因；雙出口的預設有
 * 「漏掉其中一個出口」的同型風險，具名函式讓它被直接釘住。parity Android `internal fun defaultProductTap`。
 */
export function defaultOpenProduct(
  deps: Pick<SeamDeps, 'playerRef' | 'attachment'>,
  product: LBProduct,
): void {
  // 1) telemetry（native）— INFO_PRODUCT_VIEW + goods_pv + PRODUCT_CLICK。
  deps.playerRef.simulateProductTap(product);
  // 2) 明細 sheet（view-model）— 帶**完整** LBProduct，light 回流事件開不了它。
  deps.attachment.handleProductTap(product, 0);
}

/** product-sheets seam defaults (product tap / cart / variant / qty / fav / restock / share). */
export function buildSheetHandlers(deps: SeamDeps): {
  onOpenProduct: (product: LBProduct) => void;
  onOpenCart: () => void;
  onSelectVariant: (gi: number, oi: number) => void;
  onSetQty: (qty: number) => void;
  onInc: () => void;
  onDec: () => void;
  onAddToCart: () => void;
  onToggleFavorite: (goodsGpn: string) => void;
  onNotifyRestock: (goodsGpn: string) => void;
  onShare: () => void;
  onSeekToProductIntro: (product: LBProduct) => void;
  onShareProduct: (product: LBProduct) => void;
  onSwitchProductVideo: (videoId: string) => void;
} {
  const { playerRef, attachment, config, shareSystem, switchVideo } = deps;
  return {
    // 商品點擊（列表列名稱/明細鈕、列加購鈕、售完列補貨鈴鐺、VOD now-introducing 卡——**四個**
    // 進場點共用此一 seam；補貨鈴鐺經 ProductSheetsView.handleOpenRestock 記 actionMode='restock'
    // 後仍走這裡）。
    // DEFAULT: defaultOpenProduct —— telemetry + 開明細**兩個**出口，缺一即回到死按鈕（見該函式 doc）。
    // host 設 config.onOpenProduct 完全取代（兩個出口皆不再由容器呼叫）。
    onOpenProduct:
      config.onOpenProduct ?? ((product: LBProduct): void => defaultOpenProduct(deps, product)),
    onOpenCart: config.onOpenCart ?? ((): void => attachment.openCart()),
    onSelectVariant:
      config.onSelectVariant ?? ((gi: number, oi: number): void => attachment.selectVariant(gi, oi)),
    onSetQty: config.onSetQty ?? ((qty: number): void => attachment.setQty(qty)),
    onInc: config.onInc ?? ((): void => attachment.incQty()),
    onDec: config.onDec ?? ((): void => attachment.decQty()),
    onAddToCart: config.onAddToCart ?? ((): void => void attachment.addToCart()),
    onToggleFavorite: config.onToggleFavorite ?? ((): void => undefined),
    onNotifyRestock: config.onNotifyRestock ?? ((): void => undefined),
    // 頻道/footer 分享預設（dropin-player-default-share-sheet-rn，B 等義）：host 設了 onShare → 覆蓋；
    // 未設 → 以 channel.share_url（playerHeaderState.shareUrl）開系統分享（shareSystem 注入 Share.share）。
    // 空 url → no-op（lbShouldPresentChannelShare）。頻道級不附 ?t=。已設 onShare 的 host 零變更（非破壞）。
    onShare:
      config.onShare ??
      ((): void => {
        const url = attachment.template.playerHeaderState.shareUrl;
        if (lbShouldPresentChannelShare(url)) shareSystem(url);
      }),
    // 列縮圖 → seek 到商品介紹時間（issue 5）：beginTime null 不 seek（core seek 僅 replay 生效）。
    onSeekToProductIntro:
      config.onSeekToProductIntro ??
      ((product: LBProduct): void => {
        if (product.beginTime != null) playerRef.seek(product.beginTime);
      }),
    // 列分享 → 系統分享帶 ?t=（issue 6）：RN reference-ui 把 per-product 系統分享委派 host（與 onShare
    // 一致），故預設 no-op；host 以 `productShareUrlString` 組連結 + `Share.share` 呈現。
    onShareProduct: config.onShareProduct ?? ((): void => undefined),
    // 「更多商品」推薦卡播放圖示 → 换片（rb-rn-product-detail-recommendations，design.md D3）：比照
    // `onPickHot`（下方 `buildMomentHandlers`）的核心動作，但省略 `switchedVideoItem` 手動組裝——
    // `LBProductRecommendation` 沒有 cover/title/duration，`switchVideo(videoId)`（省略 `item`）已內建
    // cover-empty fallback（與 swipe 換片同一條路徑），資料不足非疏漏。`ProductSheetsView` 保證這條路徑
    // MUST NOT 連動 sheet dismiss——本 seam 只換片，不知道、也不碰任何 sheet 狀態。
    onSwitchProductVideo:
      config.onSwitchProductVideo ??
      ((videoId: string): void => {
        playerRef.load(videoId);
        switchVideo(videoId);
      }),
  };
}

/** feed-win seam defaults (join / claim — 帶 email，rb-rn-win-claim-email-flow). */
export function buildFeedHandlers(deps: SeamDeps): {
  onJoin: (eid: number, keyword: string) => void;
  onSubmitClaim: NonNullable<LivebuyPlayerConfig['onSubmitClaim']>;
  onOpenClaim: NonNullable<LivebuyPlayerConfig['onOpenClaim']>;
  onDismissClaim: () => void;
  onCopyClaimCode: NonNullable<LivebuyPlayerConfig['onCopyClaimCode']>;
} {
  const { attachment, config } = deps;
  // 🔴 領獎預設 MUST 帶 email（EMAIL-LESS 已退役）——core 預設領獎路徑 `email` 必填，缺
  // email 直接 fail-fast、連 `POST /sdk/video/claim` 都不送。優先序：
  //   1. 新 seam `config.onSubmitClaim`（帶 email）
  //   2. DEPRECATED `config.onClaim`（host 已自行接管領獎 → 行為完全不變，email 丟棄）
  //   3. turnkey 預設 → `submitAwardClaim(winner, email)`（2-arity）
  const onSubmitClaim: NonNullable<LivebuyPlayerConfig['onSubmitClaim']> =
    config.onSubmitClaim ??
    (config.onClaim != null
      ? (winner): void => config.onClaim?.(winner)
      : (winner, email): void => {
          attachment.template.submitAwardClaim(winner, email);
        });
  return {
    // 「加入活動」抽獎 CTA 三層閘（rb-rn-event-join-gate，parity iOS / Android）：**閘不在此 seam**。RN 的
    // `FeedWinView.handleJoin` 是雙 funnel——`model.joinEvent(eid,keyword)`（→ template，此路徑由容器注入的
    // `FeedWinModel.joinEventGate` 攔截，見 `applyEventJoinGate` / `LivebuyPlayerOverlays`）＋此 `onJoin`。
    // canonical iOS / Android 把閘放在 `FeedWinModel.joinEvent`（唯一到得了 core 的 chokepoint），並把 overlay
    // 的 join 觀察者預設設為 no-op（Android `onJoin = { _, _ -> }`）。RN 對齊：本 `onJoin` 預設改為 **no-op
    // host 觀察者**（原 `template.joinEvent` 會與 `model.joinEvent` 形成既有多餘雙送、且訪客被閘時仍未經閘
    // forward → 閘失效），join 由**已被閘的** `model.joinEvent` **單一**送出。host 設 `config.onJoin` → 仍以
    // 觀察者身分被呼叫（既有語意：本來就與 `model.joinEvent` 並存、非取代）。
    onJoin: config.onJoin ?? ((): void => undefined),
    onSubmitClaim,
    onOpenClaim: config.onOpenClaim ?? ((): void => undefined),
    onDismissClaim: config.onDismissClaim ?? ((): void => undefined),
    onCopyClaimCode: config.onCopyClaimCode ?? ((): void => undefined),
  };
}

/** moments seam defaults (pick-hot / skip / cancel / retry / dismiss). `onWatchNext`
 *  is built by {@link buildWatchNextHandler} (it needs the moment model's next id). */
export function buildMomentHandlers(deps: SeamDeps): {
  onPickHot: NonNullable<LivebuyPlayerConfig['onPickHot']>;
  onSkip: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
} {
  const { playerRef, config, switchVideo, currentVideoId } = deps;
  return {
    onPickHot:
      config.onPickHot ??
      ((hot): void => {
        playerRef.load(hot.id);
        // Carry the hot item's REAL cover / title so a minimized floating preview shows the
        // switched video (rb-rn-collapsible-player-track-switch). `HotRow` carries no preview → "".
        switchVideo(
          hot.id,
          switchedVideoItem({
            id: hot.id,
            cover: hot.cover,
            title: hot.title,
            duration: hot.duration ?? 0,
            liveStatus: 1,
          }),
        );
      }),
    onSkip: config.onSkip ?? ((): void => playerRef.skipStart()),
    onCancel: config.onCancel ?? ((): void => playerRef.cancelAutoNext()),
    onRetry: config.onRetry ?? ((): void => playerRef.load(currentVideoId())),
    onDismiss: config.onDismiss ?? ((): void => undefined),
  };
}

/**
 * The 立即觀看 default: advance in place to the auto-next target id (resolved by
 * the caller from the bound template's moment model), then notify the host. A host
 * override REPLACES this entirely (still receiving the resolved next id).
 */
export function buildWatchNextHandler(
  deps: SeamDeps,
  // Resolve the auto-next target as a full `LBVideoItem` carrying its REAL cover / title (built by
  // the caller from the bound template's moment model `next[0]`), or null when there is none. The
  // default switches in place + reports it (so a minimized floating preview shows the switched
  // video, rb-rn-collapsible-player-track-switch); a host override receives just the id (parity).
  nextItem: () => LBVideoItem | null,
): () => void {
  const override = deps.config.onWatchNext;
  if (override != null) {
    return (): void => {
      const item = nextItem();
      if (item != null) override(item.id);
    };
  }
  return (): void => {
    const item = nextItem();
    if (item == null) return;
    deps.playerRef.load(item.id);
    deps.switchVideo(item.id, item);
  };
}

/**
 * 「現正直播」`LiveNowPillView` tap default (rb-rn-live-now-pill) — 完全比照
 * {@link buildWatchNextHandler} 的既有形狀（同一個「host 可覆寫、否則走預設 in-place 換片」模式，
 * `LivebuyPlayerConfig.onPickHot` 也是同一形狀）：`liveNow` resolver 由呼叫端注入（容器持有的唯一
 * 權威來源——`LivebuyPlayer.tsx` 的 `useLiveNowPoll`），本函式**不**自己打 API、不自己輪詢。
 *
 * host 設 `config.onGoLive` → 完全接管（帶當下偵測到的完整 `LBVideoItem`，容器**不**額外呼叫
 * `playerRef.load` / `switchVideo`）；未設 → 預設 `playerRef.load(item.id)` +
 * `switchVideo(item.id, item)`——與 `onPickHot` 預設換片的**同一條路徑**，差別只在於這裡已經持有
 * 完整的 `LBVideoItem`（來自 `fetchLatestLive`），不需要像 `onPickHot` 那樣用
 * `switchedVideoItem(...)` 手動組裝一份簡化版（`HotRow` 缺欄位）。
 *
 * `liveNow == null`（尚未偵測到另一場直播，或該場直播已結束）→ no-op（tap 不可能發生在這個狀態，
 * 因為 `showsLiveNowPill` 的顯示閘門本身就要求 `hasLiveNow === true` 鈕才會被組出，但仍防禦性
 * 保留這個 null 檢查，比照 `buildWatchNextHandler` 同一慣例）。
 */
export function buildGoLiveHandler(
  deps: Pick<SeamDeps, 'playerRef' | 'config' | 'switchVideo'>,
  liveNow: () => LBVideoItem | null,
): () => void {
  const override = deps.config.onGoLive;
  if (override != null) {
    return (): void => {
      const item = liveNow();
      if (item != null) override(item);
    };
  }
  return (): void => {
    const item = liveNow();
    if (item == null) return;
    deps.playerRef.load(item.id);
    deps.switchVideo(item.id, item);
  };
}

/** gap-surfaces seam defaults (login / submit-name / dismiss). reference-ui NEVER logs in;
 *  the 設定暱稱 submit default uses the checkName-gated verified nickname set
 *  (rb-rn-nickname-taken-inline-error, `setGuestNicknameVerified`), NEVER `setUser`, and NEVER the
 *  older fire-and-forget unvalidated `setGuestNickname` entry (a separate, unchanged, parallel
 *  entry point — see `guest-nickname-checkname-on-set-rn`). */
export function buildGapHandlers(deps: SeamDeps): {
  onLogin: (() => void) | undefined;
  onSubmitName: (name: string) => void;
  onDismiss: () => void;
} {
  const { playerRef, attachment, config, composer, nickname } = deps;
  return {
    // Forward optional (dropin-hide-unwired-affordances-rn D2.5): undefined when host did not wire
    // `config.onLogin`, so every auth gate hides the「前往登入」dead button. MUST NOT wrap into
    // `?? (() => undefined)` (eternally-defined → defeats the gate's `onLogin != null` guard).
    onLogin: config.onLogin,
    // 設定暱稱 modal 送出 → checkName-驗證的 setGuestNicknameVerified（rb-rn-nickname-taken-inline-
    // error，parity iOS/Android）：先取本次進入意圖快照 + nickname.beginSubmit()（送出中 + 清舊錯誤 +
    // 取得本次 submission token），再呼叫 core。
    //
    // 成功（resolve）→ 沿用既有續作邏輯（不變）：關閉 modal、並依進入意圖（composeAfter）決定是否接著開
    // composer、續作 pending 的「加入活動」。
    //
    // 被取走（reject 且 error.code === 'guestNameTaken'）或其他錯誤（reject 其他 code，fallback
    // 'LB_ERROR'）→ **不** dismiss / 不開 composer / 不續作 pending join，改呼叫
    // nickname.submitFailed('taken' | 'other')，讓 GuestNameEditModal 顯示對應 inline 錯誤、使用者可
    // 修改重試。`onSubmit` 本身簽章維持 `(name: string) => void`（呼叫端不需要、也不會拿到這個內部
    // Promise chain 的結果 —— 三態呈現完全透過 `nickname` controller 的新欄位表達，見 design.md 決策 1）。
    //
    // 🔴 世代守衛（design.md 決策 5）：本函式把同步流程改成了非同步，於是多出一段「已送出、結果還沒到」的
    // 窗口，而 modal 的 scrim **沒有** in-flight 保護（取消是正常操作）。該窗口有**兩個方向相反**的過期問題，
    // 兩個都要處理，只修一邊沒有用：
    //   ①**快照太舊**：`useNicknamePrompt` 每次 render 回新物件、`buildGapHandlers` 每次 render 重建，
    //     故 continuation closure 抓到的是「送出當下那次 render」的 controller。
    //   ②**setter 太新**：`dismiss` / `submitFailed` 是 useCallback 穩定 setter，打在**結果抵達當下**的
    //     最新 state 上，而非發起這次送出的那個呈現。
    // 對策：`composeAfter` / `pendingJoin` 在**送出當下**取值（而非在 continuation 內讀已過期的快照），
    // 並在**兩個** continuation 開頭一律先問 `isCurrentSubmission(submission)` —— 期間發生過
    // present / presentPendingJoin / dismiss / 新的 beginSubmit 就整個放棄，一個狀態都不動。缺這道守衛時：
    // 送出 pending-join 暱稱 → scrim 取消（依約已清 pending）→ 遲到的 resolve 仍會完成使用者**已取消**的
    // join 並通知 host；取消後重開，遲到的 resolve 會關掉使用者**正在打字**的 modal、遲到的 reject 會把上
    // 一輪的錯誤畫到一個還沒送出過任何東西的呈現上。
    //
    // host 自訂 config.onSubmitName 則完全接管（既有 D-2 覆蓋機制不變）：新狀態不會被觸發。
    onSubmitName:
      config.onSubmitName ??
      ((name: string): void => {
        // 進入意圖在**送出當下**取值（此刻 `nickname` 必為最新），與 submission token 綁同一世代。
        // rb-rn-event-join-gate: 若這次設定暱稱是為了一個被暱稱閘擋下的 pending「加入活動」，這裡就取出該
        // 次 (eid, keyword)；設名成功後自動接續完成該次 join、**恰一次**。續作 bypass gate（直呼
        // `attachment.template.joinEvent`，非 `model.joinEvent`）：設名後 displayName 由 template 非同步
        // 刷新、此刻可能尚未落地，再跑 gate 會誤判暱稱未設而重開 modal（比照留言 pill 設名後直接開
        // composer 的「直接接續」語意）。
        const shouldCompose = nickname.composeAfter;
        const pendingJoin = nickname.pendingJoin;
        const submission = nickname.beginSubmit();
        void playerRef.setGuestNicknameVerified(name).then(
          (): void => {
            if (!nickname.isCurrentSubmission(submission)) return;
            nickname.dismiss();
            if (shouldCompose) composer.open();
            // rn-event-join-gate-suppress-host-callback (parity Android `d33ce9d0`): this
            // continuation join REALLY HAPPENS, so the host observer MUST be told — EXACTLY ONCE,
            // with the ORIGINAL (eid, keyword). Without it the contract would only be half-fixed:
            // 「攔截時不通知」修好了，卻留下「該通知時不通知」. The two are mutually exclusive by
            // construction, so this is filling in a MISSED notification, not an extra one: the tap
            // that landed on the nickname gate had `FeedWinModel.joinEvent` return `false`, so
            // `FeedWinView.handleJoin` did NOT notify then; and this path bypasses `FeedWinModel`
            // entirely (direct `template.joinEvent`). The exactly-once guarantee is
            // `completePendingEventJoin`'s (no pending → no forward at all).
            completePendingEventJoin(pendingJoin, (eid: number, keyword: string): void => {
              attachment.template.joinEvent(eid, keyword);
              config.onJoin?.(eid, keyword);
            });
          },
          (error: unknown): void => {
            if (!nickname.isCurrentSubmission(submission)) return;
            const code = (error as { code?: unknown } | null | undefined)?.code;
            nickname.submitFailed(code === 'guestNameTaken' ? 'taken' : 'other');
          },
        );
      }),
    onDismiss: config.onDismiss ?? ((): void => undefined),
  };
}
