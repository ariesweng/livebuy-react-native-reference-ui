// LivebuyWidgetConfig — per-instance wiring for the drop-in `LivebuyWidget`
// container (introduce-dropin-widget-container-rn).
//
// Parity source: iOS `LivebuyWidgetConfig` (struct). EVERY interaction callback is
// OPTIONAL with a documented sensible default — a host that passes nothing still
// gets a working, scrolling widget list ("不 wire 也能顯示"); passing a callback
// REPLACES that one default.
//
// PURE TypeScript (type-only react-native imports) so it stays reliably testable in
// a plain node environment without dragging the RN runtime into jest.

import type { ViewStyle } from 'react-native';
import type { LBSdkEvent, LBVideoItem, SDKConfig } from 'livebuy-react-native';
import type { LBUIOptions, PlayerTemplateAttachment } from 'livebuy-react-native-ui';

import type { WidgetGoods } from '../widget/WidgetModel';
import type { ReferenceUIDesign } from './ReferenceUIDesign';
import type { LBSafeAreaInsets } from '../safearea/LBSafeArea';

/**
 * Per-instance wiring for {@link LivebuyWidget}. All callbacks optional; each has a
 * documented built-in default the container supplies when omitted. Mirrors the iOS
 * `LivebuyWidgetConfig`.
 */
export interface LivebuyWidgetConfig {
  // -- Optional explicit data overrides (turnkey defaults if omitted) ----------

  /**
   * The merchant SDKConfig used to attach the widget template + resolve the theme.
   * Omitted → the container fetches it via `LivebuySDK.getSdkConfig()` (the host
   * has already `configure()`d). Provide it to skip the async fetch (e.g. tests).
   */
  sdkConfig?: SDKConfig | null;
  /** Host UI options forwarded into the theme resolver. Default: `LivebuyUI.hostOptions`. */
  hostOptions?: LBUIOptions | null;

  /**
   * The design that composes the embedded widget surface (the design seam — parity with
   * iOS `LivebuyWidgetConfig.design`). Default: `MinimalDesign` (the existing
   * `WidgetOverlayView` dispatcher). The container delegates to
   * `resolveDesign(config.design).widgetSurface(context)`.
   */
  design?: ReferenceUIDesign;

  // -- Interaction callbacks (all optional, each defaulted) --------------------

  /**
   * An extra unified-event listener registered for the host (via core
   * `registerListener`). Does NOT replace the widget template's routing. Default: none.
   *
   * Delivery contract (rn-fold-host-listener-into-single-slot): every reference-ui container shares
   * ONE core registration through an internal ref-counted multiplexer, so this listener keeps
   * working while the widget's default-open `LivebuyPlayer` is on screen and survives that player's
   * unmount. Swapping the listener identity between renders never re-registers. A throw from this
   * listener is isolated — it cannot stop other containers' listeners from receiving the event.
   *
   * PREFER this over calling core `registerListener` yourself: core keeps a SINGLE active handler,
   * so a direct host registration and the reference-ui containers still replace each other.
   */
  eventListener?: (event: LBSdkEvent) => void;

  /**
   * 選用的防禦性事件轉發口（`rb-rn-dropin-container-event-forwarding`）。轉發對象是 host 在
   * **別處**（與這個 widget 自身內容管線無關的另一個畫面）持有的一份
   * `livebuy-react-native-ui.attachPlayerTemplate()` 回傳值（外部
   * **player** template，`PlayerTemplateAttachment`）—— 與這個 widget 自己 attach 的
   * `WidgetTemplateAttachment` 是兩條完全獨立的路徑，兩者互不相干。容器每收到一個 SDK 事件時，
   * 會**額外**呼叫一次 `externalTemplateAttachment.handleEvent(event)`（派送序
   * internal → host → forward，排在既有 {@link LivebuyWidgetConfig.eventListener} 之後）。
   *
   * **為什麼 `LivebuyWidget` 也需要這個欄位**：`subscribeSdkEvents`
   * （`rn-fold-host-listener-into-single-slot`）是套件內部模組層單例多工器。`LivebuyWidget`
   * 作為一個容器，掛載時一樣會觸發訂閱者計數 0→1、一樣會對 core 單槽重新註冊 —— 若 host 在
   * 這個 widget 之外自行呼叫 `attachPlayerTemplate()`（落回其 `defaultRegisterListener`，
   * 直接對 core 單槽註冊），`LivebuyWidget` 掛載一樣會頂替掉這份外部原始註冊，不分是哪個
   * reference-ui 容器觸發了那次 0→1 註冊。
   *
   * **生命週期由 host 自行管理**：容器不會偵測、也無從偵測外部 attachment 是否已
   * `detach()` —— host 在呼叫外部 attachment 的 `detach()` 的同時，也要把這個欄位設回
   * `null` / 省略，比照 {@link LivebuyWidgetConfig.sdkConfig} / {@link
   * LivebuyWidgetConfig.eventListener} 等其他選用欄位既有的「host 自行管理生命週期」慣例。
   *
   * **純選用、純加法**：省略（`undefined`）或顯式 `null` 時完全 no-op，容器行為與本欄位存在前
   * byte-identical。
   */
  externalTemplateAttachment?: Pick<PlayerTemplateAttachment, 'handleEvent'> | null;

  /**
   * Card tap (carousel / grid). Default: `undefined` → inert (the container NEVER
   * opens the player — a host wires this to open its own full-screen player for
   * `item.id`). The list still renders correctly; only the tap is inert until wired.
   */
  onTapVideo?: (item: LBVideoItem) => void;
  /** Carousel「查看更多 ›」header link. Default: `undefined` → inert. */
  onSeeMore?: () => void;
  /**
   * Carousel header row visibility (`rb-rn-widget-carousel-header-visibility`). Default:
   * `true` (opt-out) — the header row (title「精選影片」+ the already-gated「查看更多 ›」
   * link) renders exactly as today. Set `false` to hide the ENTIRE header row (title +
   * see-more link together — no finer-grained control), e.g. a host that embeds the
   * carousel as a pure card strip with its own navigation elsewhere. Card row rendering
   * (`loading` / empty-list handling) is unaffected. No effect on grid / floating /
   * minimized widget modes (they never had a header). Forwarded verbatim through
   * `WidgetSurfaceContext.showsHeader` → `MinimalDesign.widgetSurface` →
   * `WidgetOverlayView` (carousel branch only) → `Carousel`.
   */
  showsHeader?: boolean;
  /**
   * Called after the first load with the ordered video feed, so a host can keep its own
   * list state in sync (e.g. a floating live-entry preview). Default: none.
   */
  onVideosChanged?: (videos: readonly LBVideoItem[]) => void;

  /**
   * OPTIONAL OVERRIDE for the per-card product overlay
   * (`rb-rn-video-linked-goods-auto-render`). Default (omitted, the common case):
   * each live card's overlay is derived automatically from its own core
   * `item.goods` (`LBVideoItem.goods`, `video-linked-goods-core-rn`) — `item.goods
   * == null` → no overlay on that card; the opted-in demo fixtures still use the
   * deterministic seed overlays. Providing this callback FULLY REPLACES that
   * default for every card (including an explicit per-item `null` return to hide a
   * card that does carry `item.goods`) — it is an escape hatch, not the only data
   * source.
   */
  goodsFor?: (item: LBVideoItem) => WidgetGoods | null;

  /**
   * When the live `/sdk/widget` fetch returns nothing, show demo fixtures + a
   * 「示範資料」caption. Default: `false` (PRODUCTION-SAFE — never show fake data to
   * real users). QA / example hosts opt-in `true`.
   */
  showsDemoFallbackWhenEmpty?: boolean;
  /**
   * Host-policy list auto-refresh interval in SECONDS. Default: `30` (`0` = disabled).
   * Distinct from `PollManager`'s 5s comment polling — this re-fetches page 1 of the
   * list. Skipped while showing demo fixtures and once a grid has paged forward.
   */
  listRefreshInterval?: number;

  /**
   * Real-cover flag (parity iOS `LivebuyWidgetConfig.live`). When `true` (the DEFAULT,
   * since the turnkey container is a host-runtime surface) widget cards load each
   * `video.cover` real photo OVER the deterministic placeholder (via the cards'
   * `RemoteImage` — on a load error it falls back to the placeholder). Set `false` to
   * keep the deterministic placeholder-only look (e.g. a host that prefers the monogram
   * tiles, or a demo). The reference-ui SURFACE default stays `false` (snapshot / golden
   * safe — `WidgetSurfaceContext.live` defaults `false`), so the per-card structural
   * snapshots are unchanged; only the turnkey container opts in to `true`.
   */
  live?: boolean;

  // -- safe area (rb-rn-edge-to-edge-safe-area) --------------------------------

  /**
   * 預設點擊開啟的全螢幕播放器（未接 {@link onTapVideo} 時由 SDK 以自己的 `<Modal>` 呈現）的 chrome
   * 內縮量，原樣轉給該播放器的 `LivebuyPlayerConfig.safeAreaInsets`。widget 本身嵌在 host 版面中、由 host 排版，不受這個欄位影響。
   *
   * Modal 是獨立視窗，host 主視窗的 inset 不一定適用，所以規則是「拿得到 Modal 視窗自己的 inset 才
   * 讓 Modal 延伸到系統列後方」：
   * - **省略**：host 有安裝 `react-native-safe-area-context` 時，SDK 在 Modal 內重新量測並讓 Modal
   *   延伸到系統列後方；沒有安裝時 Modal 維持原樣（Android 上 `LivebuySafeAreaInsetsProvider` 注入的
   *   主視窗值不會被套用到 Modal 內；iOS 的全螢幕 Modal 與主視窗佔同一塊螢幕，直向且 provider 未帶
   *   `frame` 時會沿用，橫向或帶 `frame` 時不沿用）。
   * - **有任一邊非零**：這個值就是「Modal 延伸到系統列後方時」的內縮量，Modal 會延伸。
   * - **四邊皆零**：明確關閉——Modal 不延伸、chrome 不內縮。
   *
   * host 的 Android app 若已啟用 React Native 的 edge-to-edge（該設定會強制所有 Modal 延伸到系統列
   * 後方）而又沒有安裝 `react-native-safe-area-context`，必須傳這個值，否則 chrome 會被系統列蓋住
   * （本欄位存在前就是如此）。
   */
  playerSafeAreaInsets?: Partial<LBSafeAreaInsets>;

  // -- container styling ------------------------------------------------------

  /** Optional style for the container's outer `View`. */
  style?: ViewStyle;
}
