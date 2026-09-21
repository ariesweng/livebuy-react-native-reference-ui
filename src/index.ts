// livebuy-react-native-reference-ui — public barrel.
//
// reference-ui layer: the ONLY RN layer that contains UI pixel code (`.tsx`).
// One-way dependency:
//   livebuy-react-native-reference-ui  →  livebuy-react-native-ui  →  livebuy-react-native
//   (reference-ui                          template                     core)
// core / template MUST NOT depend on this package.
//
// NOTE: `./theme` and `./LivebuyReferenceUISmoke` are authored by the Surfaces
// phase of `rb-rn-scaffold`. Until they land, the imports below are the EXPECTED
// skeleton state (unresolved). Do NOT run tsc/jest against this skeleton.

// rb-rn-scaffold D2 — ReferenceUITheme + ReferenceUIThemeResolver (pure-function
// merge core > host > minimal, mirroring ConfigMerger precedence) + colorFromHex
// helper + the minimal palette const (design/templates/minimal/*.jsx; same
// values as iOS / Android / Flutter).
export { ReferenceUIThemeResolver, colorFromHex, MINIMAL_PALETTE } from './theme';
export type { ReferenceUITheme } from './theme';

// rb-rn-widget-embed-colors — the widget-scope embed-color derivation that runs AFTER
// the resolver and ONLY on the widget surfaces (`Carousel` / `VideoShopGrid`). The
// resolver above is untouched and still never sees `widget_color` / `widget_bgcolor`.
export {
  ReferenceUIWidgetEmbedTheme,
  INVERTED_TEXT_HEX,
  INVERTED_COLOR_MODE,
} from './widgetEmbedTheme';

// rb-rn-scaffold D4 — smoke component + identity helper. Proves the
// reference-ui → template → core chain compiles & renders a tiny `.tsx` tree
// (binds DefaultPlayerTemplate.identityLabelState?.displayName). Ships exactly
// ONE structural snapshot; renders NO family pixels.
export { LivebuyReferenceUISmoke, smokeIdentityName } from './LivebuyReferenceUISmoke';

// rb-rn-player-shell — FAMILY-1 player-shell + chrome (Phase-4 RN parity with
// the DONE iOS/Android/Flutter family-1). The container `PlayerShellView` +
// read-only `PlayerShellModel` (snapshot bridge over `DefaultPlayerTemplate`) +
// deterministic `PlayerShellSeeds`, composing the FOUR family-1 surfaces:
// PlayerHeaderBar / OperationRail / VideoInfoPanel (notice tab renders the
// systemNotice + notice TWO segments in-panel — iOS-reconciled FINAL state) /
// LiveOverlayChrome. The four surface `.tsx` files are authored by the Surfaces
// agents; until they land the four surface re-exports below are the EXPECTED
// skeleton state (unresolved). Do NOT run tsc/jest against this skeleton.
export { PlayerShellView } from './playershell/PlayerShellView';
export type { PlayerShellViewProps } from './playershell/PlayerShellView';
export { PlayerShellModel, PlayerShellSeeds } from './playershell/PlayerShellModel';
export {
  PlayerHeaderBar,
  OperationRail,
  VideoInfoPanel,
  LiveOverlayChrome,
  CaptionOverlayView,
} from './playershell/PlayerShellView';
// rb-react-native-subtitle-vtt-caption-display — the pure WebVTT parsing pipeline behind the VOD
// CC caption line (decode-tolerant `parse` + `activeCue` time-indexed lookup). Exported so a host
// composing its own design can reproduce the same parsing / lookup contract PlayerShellView uses.
export { VTTSubtitleParser } from './playershell/VTTSubtitleParser';
export type { VTTCue } from './playershell/VTTSubtitleParser';
// rb-rn-marquee-title-scroll — the header title slot (design `LBPMarqueeText`) plus the FOUR
// pure functions behind it: the SINGLE fallback entry point for the raw merchant gate
// (`extensions.video_title_scroll`), the content-driven overflow measurement, the one AND gate
// that decides whether the marquee attaches, and the loop-duration formula. Exported so a host
// composing its own design resolves the raw wire value and reproduces the decision exactly the
// way reference-ui does (same reasoning as `normalizeShowStock` / `normalizeProductCardMode`).
export {
  MarqueeTitle,
  normalizeTitleScroll,
  marqueeTitleOverflows,
  showsMarqueeTitle,
  marqueeDurationSeconds,
  MARQUEE_GAP,
  MARQUEE_SPEED_PX_PER_SEC,
  MARQUEE_MIN_DURATION_SECONDS,
} from './playershell/MarqueeTitleView';
export type { MarqueeTitleProps } from './playershell/MarqueeTitleView';

// rb-rn-upcoming-intro-chrome — 直播預告 (upcoming / awaitingLive) full-bleed
// countdown background surface (cover + dark mask + date + big time, NO ticking) +
// the pure `scheduledDate` / `scheduledTime` reformatters (shared with the family-5
// CarouselCardView upcoming overlay). The PlayerShellView upcoming branch composes
// it. Parity iOS / Android / Flutter.
export { UpcomingCountdownView, scheduledDate, scheduledTime } from './playershell/UpcomingCountdownView';
export type { UpcomingCountdownViewProps } from './playershell/UpcomingCountdownView';

// rb-rn-feed-win — FAMILY-2 feed + win (Phase-4 RN parity with the DONE
// iOS/Android/Flutter family-2). The container `FeedWinView` + read-only
// `FeedWinModel` (snapshot bridge over `DefaultPlayerTemplate`) + deterministic
// `FeedWinSeeds`, composing the THREE family-2 surfaces: ChatFeed (merged
// chat/join/eventJoin/purchase/win feed — eventJoin is the only interactive row)
// / WinEntry (floating 中獎 entry + count badge) / WinClaimSheet (四階段領獎 modal
// — claim / confirmSubmit / confirmClose / submitting / done / fail, 含 ✉ email 輸入欄;
// CTA forwards onSubmit(email) → host → `submitAwardClaim(winner, email)` → core
// `requestAwardClaim(winner, { email })`; EMAIL-LESS 已由 rb-rn-win-claim-email-flow
// 退役; reference-ui 仍 NEVER 直接呼叫 core). The
// three surface `.tsx` files are authored by the Surfaces agents; until they
// land the three surface re-exports below are the EXPECTED skeleton state
// (unresolved). Do NOT run tsc/jest against this skeleton.
export { FeedWinView } from './feedwin/FeedWinView';
export type { FeedWinViewProps } from './feedwin/FeedWinView';
export { FeedWinModel, FeedWinSeeds } from './feedwin/FeedWinModel';
export {
  ChatFeed,
  WinEntry,
  WinClaimSheet,
} from './feedwin/FeedWinView';
// rb-rn-win-claim-email-flow — the four-stage claim modal's props + the PURE stage-machine /
// presentation helpers (unit-testable without rendering; the stage is DERIVED, never a second
// copy of the view-model's `submitInFlight` / `awardClaimResultState`).
export type { WinClaimSheetProps, WinClaimStage, WinClaimPhase } from './feedwin/WinClaimSheetView';
export {
  winClaimStage,
  winClaimResultStage,
  winClaimDiscountCode,
  winClaimConfetti,
  keyboardAvoidBehavior,
  lightened,
} from './feedwin/WinClaimSheetView';

// rb-rn-product-sheets — FAMILY-3 product + sheets (Phase-4 RN parity with the
// DONE iOS/Android/Flutter family-3). The container `ProductSheetsView` +
// read-only `ProductSheetsModel` (snapshot bridge over `DefaultPlayerTemplate`) +
// deterministic `ProductSheetsSeeds`, composing the FOUR family-3 surfaces:
// ProductList (bottom-sheet product list drawer + cart CTA; the 收藏鈕 MUST NOT
// appear here) / ProductDetail (variant chips as MANUAL CHUNKED ROWS / qty stepper
// / footer = RECONCILED 收藏鈕 to the LEFT of the 加入購物車 CTA — iOS-reconciled
// FINAL state) / MiniCartPeek (floating peek, drawn only when miniCart != null) /
// NotifyRestockSheet (sold-out 補貨通知 sheet with a custom pill switch). The four
// surface `.tsx` files are authored by the Surfaces agents; until they land the
// four surface re-exports below are the EXPECTED skeleton state (unresolved). Do
// NOT run tsc/jest against this skeleton.
export { ProductSheetsView } from './productsheets/ProductSheetsView';
export type { ProductSheetsViewProps } from './productsheets/ProductSheetsView';
export { ProductSheetsModel, ProductSheetsSeeds } from './productsheets/ProductSheetsModel';
export {
  ProductList,
  ProductDetail,
  MiniCartPeek,
  NotifyRestockSheet,
} from './productsheets/ProductSheetsView';
// 庫存文案開關 (`extensions.show_stock`, rb-rn-show-stock-caption-toggle): the SINGLE pure
// fallback entry point + the AND gate that decides whether the caption is drawn, exported so a
// host composing its own design resolves the raw wire value exactly the way reference-ui does
// (same reasoning as `normalizeProductCardMode` below).
export { normalizeShowStock, showsStockCaption } from './productsheets/ProductDetailSheetView';

// rb-rn-moments — FAMILY-4 player moments (Phase-4 RN parity with the DONE
// iOS/Android/Flutter family-4). The container `MomentsView` + read-only
// `MomentsModel` (PURE read-only snapshot bridge over `DefaultPlayerTemplate`, NO
// mutating forwarders — moment actions are host-wired container callbacks) +
// deterministic `MomentsSeeds`, composing the THREE family-4 full-screen surfaces:
// StartScreen (loading brand spinner / buffering nothing / splash skip-only — bottom-right
// 略過介紹 skip pill / done = nothing) / EndScreen (倒數變體: View-based countdown ring
// + next[0] preview + 立即觀看 / 取消 — 熱門變體: hot as plain Row/Column FIXED set,
// duration→mm:ss + onPickHot) / ErrorScreen (by kind: stream 播放發生問題 重試+返回 /
// notFound 找不到影片 僅返回 / outdated 請更新版本 前往更新+返回; retry FORWARDS only). The
// three surface `.tsx` files are authored by the Surfaces agents; until they land
// the three surface re-exports below are the EXPECTED skeleton state (unresolved).
// Do NOT run tsc/jest against this skeleton.
export { MomentsView } from './moments/MomentsView';
export type { MomentsViewProps } from './moments/MomentsView';
export { MomentsModel, MomentsSeeds } from './moments/MomentsModel';
export type { HotRow } from './moments/MomentsModel';
export {
  StartScreen,
  EndScreen,
  ErrorScreen,
} from './moments/MomentsView';

// rb-rn-widget — FAMILY-5 embedded widget (Phase-4 RN parity with the DONE
// iOS/Android/Flutter family-5). The container `WidgetOverlayView` + read-only
// `WidgetModel` (PURE read-only snapshot bridge over the WIDGET template
// `DefaultWidgetTemplate.content`, NO mutating forwarders — widget actions are
// host-wired container callbacks) + deterministic `WidgetSeeds` + the SHARED 9:16
// card primitive `CarouselCardView` (LBPCarouselCard: cover placeholder + LIVE/VOD
// kind badge + bottom dark-glass goods overlay READ-ONLY tag + title), composing the
// FOUR family-5 surfaces by `content.mode`: Carousel (header row + PLAIN Row of cards
// + 查看更多 ›) / VideoShopGrid (2-col PLAIN Column-of-Rows + load-more footer) /
// FloatingWidget (single live card + close; null liveVideo → nothing) /
// MinimizedWidget (96-wide pill + LIVE tag + close). widgetColor / widgetBgcolor stay
// RAW on the model / container and are interpreted ONLY inside Carousel /
// VideoShopGrid, via `ReferenceUIWidgetEmbedTheme.derive` (rb-rn-widget-embed-colors) —
// never by `ReferenceUIThemeResolver`, never on FloatingWidget / MinimizedWidget. The
// four surface `.tsx` files
// are authored by the Surfaces agents; until they land the four surface re-exports
// below are the EXPECTED skeleton state (unresolved). Do NOT run tsc/jest against
// this skeleton.
export { WidgetOverlayView } from './widget/WidgetOverlayView';
export type { WidgetOverlayViewProps } from './widget/WidgetOverlayView';
export { WidgetModel, WidgetSeeds } from './widget/WidgetModel';
export type { WidgetGoods } from './widget/WidgetModel';
export { CarouselCardView, formatSeconds, DEFAULT_CARD_WIDTH } from './widget/CarouselCardView';
export type { CarouselCardViewProps } from './widget/CarouselCardView';
// Product-card三態 (`product_card`, rb-rn-widget-product-card-modes): the SINGLE pure
// fallback entry point + its closed value domain, exported so a host composing its own
// design can resolve the raw wire value the same way the reference-ui cards do.
export { normalizeProductCardMode, strikePrice } from './widget/CarouselCardView';
export type { LBProductCardMode } from './widget/CarouselCardView';
// External-platform live redirect (external-live-watch): hosts composing the bare
// FloatingWidget surface use these to detect + route an external (e.g. Facebook)
// live's tap out to the platform instead of the in-app player.
export {
  isExternalLiveURL,
  externalLiveWatchURL,
  externalLiveAwareTap,
} from './widget/ExternalLive';
// rn-refui-widget-host-visibility-pause — opt-in host→SDK 橋接:host 一行
// `LivebuyWidgetVisibility.setWidgetsCovered(true/false)` 宣告承載 widget 預覽的畫面被**非 route 的
// overlay** 覆蓋(最典型:collapsible presenter 的全螢幕直播播放器蓋住底下首頁、host 自製 overlay),
// 把信號餵進每支 `LoopingVideoView` 的 play-gate 第三軸 `notCovered`,暫停 SDK 自足兩軸(AppState
// 背景 / measureInWindow 離屏)偵測不到的「被覆蓋」預覽。RN parity of Android `LivebuyWidgetVisibility`。
// 向後相容:host 不呼叫時行為與現況逐位元組相同。**不要**為 stack / route push(`Navigator.push` 類的
// react-navigation push)呼叫它——它是 process-global 單一 level,會把被 push 上去那頁自己的預覽也蓋住;
// route push 請用下方的 `LivebuyRouteVisibilityContext` / `LivebuyWidget.routeVisible`。
export { LivebuyWidgetVisibility } from './widget/livebuyWidgetVisibility';
// rb-rn-widget-preview-route-cover-release — host 餵入的 **per-subtree** route 焦點信號(React context)。
// react-native core 沒有「被哪個畫面蓋住」的框架訊號(那是 react-navigation 的概念,本套件無任何
// navigation 依賴),所以 host 在承載 widget 的 screen 內以 `useIsFocused()` 餵入:
//     <LivebuyRouteVisibilityContext.Provider value={useIsFocused()}>…</LivebuyRouteVisibilityContext.Provider>
//     // 或等價單行:<LivebuyWidget shopId="…" routeVisible={useIsFocused()} />
// 每支 `LoopingVideoView` 以 `useContext` 讀取作為 play-gate 第四軸 `routeVisible`:被 push 蓋住時
// 暫停,Android 上更**卸載 `<Video>` 釋放硬體解碼器**(paused 的 react-native-video 仍占一個 MediaCodec)、
// pop 回來重新掛載(含有上限的 onError 重試);iOS 只 keep-alive pause。per-subtree,所以被 push 上去
// 那頁自己的 `LivebuyWidget` 正常播——這正是 process-global `LivebuyWidgetVisibility` 做不到的。
// 未提供 Provider 時預設 `true` = 現況,向後相容。`previewDecoderPolicyFor` / `previewInitRetryDelayMs`
// 為對應的純函式(Android → 'release'、其他 → 'pause';重試退避 500 / 1000 / 2000 ms 後放棄),
// 匯出供 host 自組 design 時比照。
export { LivebuyRouteVisibilityContext, useLivebuyRouteVisible } from './widget/livebuyRouteVisibility';
export {
  previewDecoderPolicyFor,
  previewInitRetryDelayMs,
  PREVIEW_INIT_RETRY_DELAYS_MS,
  previewOffScreenReleaseDelayMs,
  previewScrollSignalThrottleMs,
} from './widget/previewDecoderPolicy';
export type { PreviewDecoderPolicy } from './widget/previewDecoderPolicy';
// rb-rn-widget-preview-offscreen-decoder-release — reference-ui 自己的 scroll 容器發的**捲動訊號**
// (React context,event source)。RN 的 `onLayout` 不因祖先 `ScrollView` 捲動而重發,所以卡片預覽的
// 離屏量測原本只在 layout 時做一次;`ScrollableVideoShopView`(「查看更多」Grid)與 turnkey 首頁輪播
// (`Carousel scrollable`)現在各自在 `onScroll`(100 ms 節流)/ `onScrollEndDrag` / `onMomentumScrollEnd`
// emit,每支 `LoopingVideoView` 訂閱後重新 `measureInWindow`——Android 上任一時刻只有量到在螢幕上的
// 卡持有 `<Video>` / 解碼器(離屏 1000 ms debounce 後卸載、滾入重掛、從未量到可見的卡從不掛載;
// `previewOffScreenReleaseDelayMs` / `previewScrollSignalThrottleMs` 為對應純函式),iOS 只讓
// `paused` 更準。**不靠 host**——turnkey 面自動生效。
// host 可選(optional):若把 windowed `Carousel` / `CarouselRowView`(plain Row,真正的捲動由 host 的
// `ScrollView` 負責、reference-ui 拿不到那些事件)放進自己的 `ScrollView`,可用同一 context 餵入自己的
// 捲動事件:
//     const signal = useRef(createPreviewScrollSignal()).current;
//     <LivebuyPreviewScrollSignalContext.Provider value={signal.source}>
//       <ScrollView onScroll={() => signal.emit()} onMomentumScrollEnd={() => signal.emit()} scrollEventThrottle={16}>…
// 未餵時維持「只在 layout 時量」的既有行為(離屏卡不會被釋放,與現況相同)——誠實限制,不宣稱涵蓋。
export {
  LivebuyPreviewScrollSignalContext,
  createPreviewScrollSignal,
} from './widget/livebuyPreviewScrollSignal';
export type {
  LivebuyPreviewScrollSignal,
  LivebuyPreviewScrollSignalSource,
} from './widget/livebuyPreviewScrollSignal';
export {
  Carousel,
  VideoShopGrid,
  FloatingWidget,
  MinimizedWidget,
} from './widget/WidgetOverlayView';

// rb-rn-gap-surfaces — FAMILY-6 gap-surfaces (the FINAL Phase-4 family; RN parity
// with the DONE iOS/Android/Flutter family-6). PURELY ADDITIVE (2 ADDED, 0 MODIFIED):
// the RN family-1 (VideoInfoPanel 公告 notice-tab two-segment) + family-3
// (ProductDetail 收藏鈕) were built AFTER the 2026-06-06 design reconcile and ALREADY
// carry those surfaces, so this change adds ONLY the 2 NEW modals. The container
// `GapSurfacesOverlayView` + read-only `GapSurfacesModel` (PURE read-only snapshot
// bridge over `DefaultPlayerTemplate.{authGateState, identityLabelState}`, NO mutating
// forwarders — login/dismiss/submit are host-wired callbacks; the rename ENTRY funnels
// to the lone core exit `template.requestGuestNameEdit()`) + deterministic
// `GapSurfacesSeeds`, composing the TWO family-6 modals (mutually exclusive, auth-gate
// wins): AuthGateModal (「請先登入」card — trigger-specific body copy; shown only when
// authGate != null && !isLoggedIn; 前往登入 → onLogin / 稍後再說 → onDismiss) /
// GuestNameEditModal (「設定暱稱」card — editable=false static placeholder for snapshot;
// 送出 enabled only when trimmed length 1..10 → onSubmit; reference-ui NEVER logs in /
// sets the user / clears the gate itself). The two surface `.tsx` files are authored by
// the Surfaces agents; until they land the two surface re-exports below are the EXPECTED
// skeleton state (unresolved). Do NOT run tsc/jest against this skeleton.
export { GapSurfacesOverlayView } from './gapsurfaces/GapSurfacesOverlayView';
export type { GapSurfacesOverlayViewProps } from './gapsurfaces/GapSurfacesOverlayView';
export { GapSurfacesModel, GapSurfacesSeeds } from './gapsurfaces/GapSurfacesModel';
export {
  AuthGateModal,
  GuestNameEditModal,
} from './gapsurfaces/GapSurfacesOverlayView';

// introduce-dropin-player-container-rn — the turnkey drop-in player CONTAINER
// (integration / assembly layer, NOT an rb-* family). `LivebuyPlayer` takes the
// GOLDEN NAME (D-0; the bare bridge was renamed `LivebuyPlayerCore` by the
// prerequisite change). It assembles the existing 6-family overlays + the existing
// `attachPlayerTemplate` forwarders into a one-line player with sensible defaults
// for every interaction (`LivebuyPlayerConfig`, all callbacks optional). The
// on-demand `ChatComposerBar` (+ `useChatComposer`) is the ONE new pixel surface
// (the LIVE「留言...」pill's input panel). PURE assembly — zero new view-models,
// zero family-pixel changes, one-way dep `reference-ui → template → core` intact.
export { LivebuyPlayer } from './container/LivebuyPlayer';
export type { LivebuyPlayerProps } from './container/LivebuyPlayer';
export type { LivebuyPlayerConfig } from './container/LivebuyPlayerConfig';
export { ChatComposerBar, useChatComposer } from './container/ChatComposerBar';
export type { ChatComposerBarProps, ChatComposerController } from './container/ChatComposerBar';

// ReferenceUIDesign — the design seam (parity with iOS `ReferenceUIDesign` /
// `MinimalDesign`). The turnkey containers (`LivebuyPlayer` / `LivebuyWidget` /
// `CollapsibleLivebuyPlayer`) delegate the WHOLE overlay / widget surface / floating
// card to a `ReferenceUIDesign` (granularity A: the entire surface is one builder).
// `MinimalDesign` (the default) wraps the existing minimal composition verbatim; a host
// injects its own via `config.design` to change the whole layout, not just the theme
// palette. `LivebuyPlayerOverlays` is re-exported so a custom design can re-use / wrap
// the minimal player overlay tree.
export { MinimalDesign, resolveDesign } from './container/ReferenceUIDesign';
export type {
  ReferenceUIDesign,
  PlayerOverlayContext,
  WidgetSurfaceContext,
  FloatingCardContext,
} from './container/ReferenceUIDesign';
export { LivebuyPlayerOverlays } from './container/LivebuyPlayerOverlays';
export type { LivebuyPlayerOverlaysProps } from './container/LivebuyPlayerOverlays';

// rb-rn-collapsible-player — the collapsible player presenter (full-screen LivebuyPlayer +
// minimize → bottom-right floating preview, keep-alive, draggable). Parity with iOS
// `LivebuyPlayerPresenter` / Flutter / Android `CollapsibleLivebuyPlayer`. The pure
// phase / reopen / clamp helpers are re-exported for hosts that want them.
export { CollapsibleLivebuyPlayer } from './container/CollapsibleLivebuyPlayer';
export type { CollapsibleLivebuyPlayerProps } from './container/CollapsibleLivebuyPlayer';
export {
  collapsiblePhase,
  presenterWidgetCovered,
  shouldReopenOnVideoChange,
  clampFloatingOffset,
} from './container/collapsibleLogic';
export type { CollapsiblePlayerPhase } from './container/collapsibleLogic';

// introduce-dropin-widget-container-rn — the turnkey drop-in widget-list CONTAINER
// (integration / assembly layer, parallel to LivebuyPlayer). `LivebuyWidget` takes
// the GOLDEN NAME (the bare bridge was renamed `LivebuyWidgetCore` by the
// prerequisite `rename-bare-widget-to-core-rn`). It assembles the existing
// `WidgetOverlayView` surface + `attachWidgetTemplate` forwarders and drives the
// host-wired data path itself via core `LivebuySDK.fetchWidget`
// (`fetch-widget-content-rn-core`) — carousel / grid, with sensible defaults for
// every interaction (`LivebuyWidgetConfig`, all callbacks optional). PURE assembly —
// zero new view-models, zero family-pixel changes, one-way dep intact.
export { LivebuyWidget } from './container/LivebuyWidget';
export type { LivebuyWidgetProps } from './container/LivebuyWidget';
export type { LivebuyWidgetConfig } from './container/LivebuyWidgetConfig';
export { loadWidgetPage } from './container/widgetData';
export type { WidgetContainerMode } from './container/widgetData';

// introduce-dropin-live-entry-container-rn — the turnkey drop-in「現正直播」floating
// ENTRY container (integration / assembly layer, parallel to LivebuyWidget / LivebuyPlayer;
// RN parity of iOS / Android). `LivebuyLiveEntry` auto-detects the shop's current
// `liveStatus === 1` live (polling core `LivebuySDK.fetchLatestLive`) and floats a single
// entry card, reusing the existing `FloatingWidget` surface + the pure `clampFloatingOffset`
// drag clamp. The state machine is the pure `liveEntryLogic`. PURE assembly — zero new
// pixel surfaces, zero view-models, one-way dep intact. live-end immediate-hide rides a
// host-provided `liveEndedSignal` subscribe-function (RN `registerListener` is a single SLOT —
// a later registration replaces the prior handler — so this container never subscribes itself).
export { LivebuyLiveEntry } from './container/LivebuyLiveEntry';
export type { LivebuyLiveEntryProps } from './container/LivebuyLiveEntry';
export type { LivebuyLiveEntryConfig } from './container/LivebuyLiveEntryConfig';
export {
  liveEntryGate,
  liveEntryShouldResetDismiss,
  applyLiveEntry,
  liveEntryHandleEnded,
  liveEntryDismiss,
  initialLiveEntryState,
} from './container/liveEntryLogic';
export type { LiveEntryState } from './container/liveEntryLogic';

// rb-rn-floating-entry-position-timing — the floating entry's initial resting corner and
// appearance timing (`extensions.floating_setting`). The container consumes the two normalizers
// itself; they are re-exported (like `normalizeProductCardMode`) so a host that wants to reason
// about the raw wire value has the same type-safe entry point instead of its own `===` chain.
export {
  normalizeFloatingPosition,
  normalizeFloatingTiming,
  lbLiveEntryRestingInset,
  lbLiveEntryAppearDelayMs,
  lbLiveEntryInitialAppeared,
  lbLiveEntryTransformOrigin,
  LIVE_ENTRY_DEFAULT_DELAY_SECONDS,
  LIVE_ENTRY_ENTRANCE_DURATION_MS,
  LIVE_ENTRY_ENTRANCE_BEZIER,
  LIVE_ENTRY_ENTRANCE_INITIAL_SCALE,
  LIVE_ENTRY_ENTRANCE_TRANSLATE_Y,
  LIVE_ENTRY_ENTRANCE_OPACITY_STOP,
} from './container/liveEntryLogic';
export type {
  LBFloatingEntryPosition,
  LBFloatingEntryTiming,
  LiveEntryRestingInset,
} from './container/liveEntryLogic';

// rb-rn-e2e-test-ids — centralized E2E testID registry. Every `testID` string on
// a production reference-ui component comes from here (CI greps for literals; only
// `LBTestIDs.ts` + `__tests__` may contain them). Values are 1:1 identical to the
// Android `LBTestTags` / iOS `LBAccessibilityID` strings so the same E2E scenario
// id names carry across all four platforms. Re-exported so the QA harness + host
// apps reference the same constants instead of magic strings.
export {
  LBTestIDs,
  chatLine,
  activityLine,
  carouselCard,
  gridCard,
  productRow,
  productRowThumb,
  productRowDetail,
  productRowShare,
  productRowCart,
  variantChip,
  momentHotCard,
  livePinnedDot,
  nowIntroducingDot,
} from './testing/LBTestIDs';
export type { LBTestID } from './testing/LBTestIDs';
