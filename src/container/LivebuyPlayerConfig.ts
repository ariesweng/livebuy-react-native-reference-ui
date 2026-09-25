// LivebuyPlayerConfig — per-instance wiring for the drop-in `LivebuyPlayer`
// container (introduce-dropin-player-container-rn, D-3).
//
// Parity source: iOS `LivebuyPlayerConfig` (struct). EVERY interaction callback
// is OPTIONAL with a documented sensible default — a host that passes nothing
// still gets a working player ("不 wire 也能跑"); passing a callback REPLACES that
// one default (the container does `config.onX ?? (built-in default)`). RN's
// per-family host callbacks are finer-grained than iOS's closures, but each maps
// 1:1 to an `attachment` forwarder or a `playerRef` method.
//
// This module is PURE TypeScript (type-only react-native imports), so it stays
// reliably testable in a plain node environment and avoids dragging the RN
// runtime into jest.

import type { ViewStyle } from 'react-native';
import type { LBVideoItem } from 'livebuy-react-native';
import type { LBSdkEvent, LBWinner, LBProduct } from 'livebuy-react-native';
import type { LBUIOptions, LBSideRailKind, PlayerTemplateAttachment } from 'livebuy-react-native-ui';
import type { SDKConfig } from 'livebuy-react-native';
import type { HotRow } from '../moments/MomentsModel';
import type { ReferenceUIDesign } from './ReferenceUIDesign';

/**
 * Per-instance wiring for {@link LivebuyPlayer}. All callbacks optional; each has
 * a documented built-in default the container supplies when the callback is
 * omitted. Passing a callback REPLACES that single default; the rest stay default.
 */
export interface LivebuyPlayerConfig {
  // -- Optional explicit data overrides (turnkey defaults if omitted) ----------

  /**
   * The merchant SDKConfig used to attach the template + resolve the theme. When
   * omitted, the container fetches it via `LivebuySDK.getSdkConfig()` (the host
   * has already `configure()`d). Provide it to skip the async fetch (e.g. tests).
   */
  sdkConfig?: SDKConfig | null;
  /** Host UI options forwarded into the theme resolver. Default: `LivebuyUI.hostOptions`. */
  hostOptions?: LBUIOptions | null;

  /**
   * The design that composes the whole player overlay (the design seam — parity with
   * iOS `LivebuyPlayerConfig.design`). Default: `MinimalDesign` (the existing minimal
   * composition). A host injects its own `ReferenceUIDesign` to change the WHOLE overlay
   * layout (not just the theme palette). The container delegates to
   * `resolveDesign(config.design).playerOverlay(context)` and knows nothing about any
   * concrete design.
   */
  design?: ReferenceUIDesign;

  // -- Global -----------------------------------------------------------------

  /**
   * An extra unified-event listener registered for the host (via core
   * `registerListener`). Does NOT replace the template's built-in routing —
   * `attachPlayerTemplate` keeps routing events to the surfaces; this just lets
   * the host observe every event too. Default: none.
   *
   * Delivery contract (rn-fold-host-listener-into-single-slot): the container folds this listener
   * and its own internal handling into ONE core registration, and delivers **internal → host**, so
   * the container's invariants (swipe baseline / collapsible sync / PiP tracking) are already
   * up to date when this listener runs. Swapping the listener identity between renders is free —
   * it never re-registers and never disturbs the container. A throw from this listener is caught
   * and swallowed (it must not break the container or escape into the native emitter), so do your
   * own try/catch + logging if you need to see the error.
   *
   * PREFER this over calling core `registerListener` yourself: core keeps a SINGLE active handler,
   * so a direct host registration and the reference-ui containers still replace each other. This
   * seam is the supported path.
   */
  eventListener?: (event: LBSdkEvent) => void;

  /**
   * 選用的防禦性事件轉發口（`rb-rn-dropin-container-event-forwarding`）。讓 host 把自己在**這個
   * 容器之外**持有的一份 `livebuy-react-native-ui.attachPlayerTemplate()` 回傳值（或任何實作
   * `handleEvent` 的等價物，方便測試替身）交給容器 —— 容器每收到一個 SDK 事件時，會**額外**
   * 呼叫一次 `externalTemplateAttachment.handleEvent(event)`（派送序 internal → host → forward，
   * 排在既有 {@link LivebuyPlayerConfig.eventListener} 之後）。
   *
   * **與 `eventListener` 的差異**：`eventListener` 是 host 的一個「多加一個觀察者」callback；
   * 這個欄位轉發的對象是一份**真實的外部 `PlayerTemplateAttachment`**，其自身的 `routeEvent`
   * 內部路由（`WIN_RECEIVED` / `startScreen.phase` 等）靠持續收到事件才會推進。
   *
   * **為什麼需要這個欄位**：`subscribeSdkEvents`（`rn-fold-host-listener-into-single-slot`）是
   * 套件內部模組層單例多工器，只保證**套件內部**訂閱者共用同一格 core `registerListener`。若
   * host 在這個容器（或任何 reference-ui 容器）之外自行呼叫 `attachPlayerTemplate()`，該呼叫
   * 落回其 `defaultRegisterListener`，直接對 core 單槽註冊；**之後**任一 reference-ui 容器掛載
   * 都會頂替掉這份外部原始註冊，使其永久收不到事件。這個欄位讓 host 選擇性地把這份外部
   * attachment 接回來，透過本容器持有的那一格繼續收到事件。
   *
   * **生命週期由 host 自行管理**：容器不會偵測、也無從偵測外部 attachment 是否已
   * `detach()` —— host 在呼叫外部 attachment 的 `detach()` 的同時，也要把這個欄位設回
   * `null` / 省略，比照 {@link LivebuyPlayerConfig.sdkConfig} / {@link
   * LivebuyPlayerConfig.eventListener} 等其他選用欄位既有的「host 自行管理生命週期」慣例。
   *
   * **純選用、純加法**：省略（`undefined`）或顯式 `null` 時完全 no-op，容器行為與本欄位存在前
   * byte-identical；不會讓容器自動偵測「host 是否真的在別處呼叫了 `attachPlayerTemplate()`」
   * ——轉發永遠是 host 顯式提供才發生的行為。
   */
  externalTemplateAttachment?: Pick<PlayerTemplateAttachment, 'handleEvent'> | null;

  // -- player-shell -----------------------------------------------------------

  /**
   * Top-right minimize tap. Default (D-4 / R2): forwards `playerRef.minimize()` —
   * the architecturally-correct seam (today a safe no-op stub; activates when core
   * ships the deferred in-app PiP). The in-app floating-preview collapse is a HOST
   * presentation concern, so a host that wants it overrides `onMinimize`.
   */
  onMinimize?: () => void;
  /**
   * Per-instance override for the top-right button's close behaviour
   * (rb-rn-player-direct-close-button). `undefined` (default) → falls back to the
   * global `LivebuySDK.isDirectCloseButtonEnabled()` preference (itself default
   * `false`, set via `LivebuySDK.configure({ enableDirectCloseButton })`); a
   * non-`undefined` value here WINS over the global preference for THIS player
   * instance only (including an explicit `false` overriding a global `true`).
   *
   * Both decision sites resolve this the SAME way, via the shared pure function
   * `resolveDirectCloseButtonEnabled` (`collapsibleLogic.ts`), so they never
   * diverge:
   * - `LivebuyPlayerOverlays` resolves it into `PlayerHeaderBar`'s `showCloseIcon`
   *   (minimize icon `PipGlyph` ↔ close icon `✕`) — this runs for EVERY use of
   *   `LivebuyPlayer`, whether or not it is wrapped by `CollapsibleLivebuyPlayer`.
   * - `CollapsibleLivebuyPlayer` (the turnkey "full-screen + minimize → bottom-right
   *   floating preview" presenter) resolves it to pick `onMinimize`'s actual
   *   behaviour: resolved `false` (default) → collapses into the floating preview
   *   (existing two-step close — the floating card's own close button then fully
   *   closes it), byte-identical to before this flag existed. Resolved `true` →
   *   skips the floating step entirely and goes straight through the SAME close
   *   path the floating card's own close button uses (including the existing
   *   close-grace-period bookkeeping).
   *
   * A host using the bare, non-collapsible `LivebuyPlayer` directly (not wrapped in
   * `CollapsibleLivebuyPlayer`) has no floating-preview concept to skip, so this
   * flag does not change what its own `onMinimize` default does on tap — only
   * `onMinimize` above governs there. Its header button icon still reflects the
   * resolved value, since icon resolution happens unconditionally one layer below
   * the presenter split.
   */
  enableDirectCloseButton?: boolean;
  /**
   * Tap the video to toggle mute. Default: `playerRef.setMuted(!muted)` so first
   * tap unmutes. (The mute truth lives in the template's `handleMutedChange`,
   * host-forwarded — see design R3.)
   */
  onToggleMute?: (muted: boolean) => void;
  /**
   * Side-rail / LIVE-bottom-bar item tap, by kind.
   *
   * Default（rb-rn-like-tap-wire，parity Android `defaultRailTap` / Flutter `_routeRailItem`）——
   * 各 kind 在容器裡的真實分工：
   * - **`Like`** → `playerRef.simulateLikeTap()`（→ core `operationPanel.simulateLikeTap()` → 既有
   *   250ms throttle → 按讚 API）。修法前這裡是純 no-op，於是 LIVE 底部 bar 的愛心只播本地飄心動畫、
   *   **從未真正按讚**。飄心動畫由 `PlayerShellView` 自己的 state 驅動，不受本 seam 影響。
   * - `Goods` → **到不了本 callback**：容器先攔截它並開商品列表 overlay。
   * - `Share` / `ServiceLink` / `GuestNameEdit` → **到不了本 callback**：分別由專用 seam
   *   {@link LivebuyPlayerConfig.onShare} / {@link LivebuyPlayerConfig.onServiceLink} 與容器本地的
   *   設定暱稱 modal 先行處理。
   * - `More` → **保留路徑，目前不可達**：沒有任何呼叫端發出這個 kind（rail 不畫、底部 bar 無此鈕、
   *   seed 為 disabled）。`PlayerShellView.handleRailTap` 雖有 `more` 分支，但無人觸發；資訊面板實際
   *   由 header host pill 與公告橫幅開啟。
   * - `Chat` → RN reference-ui 沒有對應的 UI 進場點。
   * - `Subtitle`（CC）→ **仍為 no-op，已知且刻意**：它同屬死按鈕形態，但 RN reference-ui 目前沒有任何
   *   字幕渲染面，接上 core toggle 後的可見結果是未決問題，屬後續 reference-ui change。host 想要現在
   *   就有 CC 行為，可自行設本 callback 攔截。
   *
   * host 設此 closure 則**完全取代**上述預設（愛心也不再由容器轉發，單一路由來源）。
   */
  onTapRailItem?: (kind: LBSideRailKind) => void;
  /** LIVE「留言...」pill. Default: open + focus the on-demand chat composer. */
  onComment?: () => void;
  /**
   * 聯絡商家（`ContactMerchantModalView` 確認框「確定」之後的動作）. Default
   * (dropin-service-link-default-browser-rn): 以容器 `<LivebuyPlayerCore onChannelChange>` 收到的最新
   * `LBPlayerChannelInfo.serviceLink`（`channel.shop.serviceLink`）經
   * `LivebuySDK.openInAppBrowser` 開站內瀏覽器；`serviceLink` 為空 → no-op（不開空白頁，也不退回
   * `onTapRailItem`）。host 設此 closure 完全覆蓋（不開瀏覽器，改跑 host 自己的流程）。
   */
  onServiceLink?: () => void;

  // -- live-now-pill (rb-rn-live-now-pill, rn-live-now-pill-auto-shopid-turnkey-reference-ui) ---

  /**
   * Whether the「現正直播」`LiveNowPillView` right-edge half-pill feature is enabled at all
   * (rn-live-now-pill-auto-shopid-turnkey-reference-ui). **Omitted ⇒ treated as `true`** by the
   * consuming container (`LivebuyPlayer.tsx`'s `config.showsLiveNowPill ?? true`) — TypeScript
   * optional fields carry no default-value syntax of their own, unlike a Swift stored property
   * (`= true`) or a Dart constructor parameter default, so the substitution happens at the ONE
   * consuming call site, not here. Set `false` to disable the feature UNCONDITIONALLY — the
   * effective shop id fed to `useLiveNowPoll` resolves to `undefined` regardless of what
   * {@link LivebuyPlayerConfig.shopId} is set to, which trips that hook's own pre-existing
   * `shopId == null` → permanent no-op branch (zero extra `fetchLatestLive` calls, the pill never
   * appears). Parity iOS `showsLiveNowPill: Bool = true` / Flutter `showsLiveNowPill: bool`
   * (default `true`) — this is the RN spelling of the same "唯一開關" concept those two platforms
   * already ship.
   */
  showsLiveNowPill?: boolean;

  /**
   * Explicit shop ID override for the「現正直播」`LiveNowPillView` right-edge half-pill (VOD
   * 播放中 / 直播回放時偵測到「目前有其他直播正在進行」的紅色提示鈕). **This is no longer the
   * sole switch that turns the feature on** ({@link LivebuyPlayerConfig.showsLiveNowPill}, default
   * `true`, is) — as of rn-live-now-pill-auto-shopid-turnkey-reference-ui, when
   * `showsLiveNowPill` resolves to `true` (the default) and this field is `undefined`, the
   * effective shop id fed to `useLiveNowPoll` automatically falls back to
   * `LivebuySDK.currentShopId()` (the shopId last passed to `LivebuySDK.configure(...)`) instead
   * of always being `undefined`. Set this field only when you want the pill to watch a
   * **different** shop than the one `configure()` was called with — a host using the same shop
   * throughout needs no wiring here at all. See {@link resolvedLiveNowShopId} for the exact
   * resolution logic and {@link LivebuyPlayerConfig.showsLiveNowPill} for the off-switch.
   *
   * RN's poll lives in a React hook (`LivebuyPlayer.tsx`'s file-local `useLiveNowPoll`), which by
   * the Rules of Hooks MUST be called UNCONDITIONALLY on every render — unlike Android's
   * Composable, which can conditionally `remember` a controller only when the resolved shop id is
   * non-null, RN cannot conditionally call a hook keyed on this field. So RN resolves the
   * effective shop id BEFORE calling the hook (via {@link resolvedLiveNowShopId}) and mirrors
   * iOS's nullable-input-internal-no-op shape rather than Android's/Flutter's
   * caller-decides-whether-to-construct shape (see that change's design.md for the full
   * comparison).
   *
   * Independent of `LivebuyLiveEntry`'s OWN required `shopId` prop — the two drop-in surfaces
   * never share a poll instance (design decision carried over from iOS/Android): a host wanting
   * BOTH the floating entry AND this pill passes the same shop id to both, and each polls on its
   * own.
   */
  shopId?: string;

  /**
   * Tap on the「現正直播」`LiveNowPillView` — carries the detected ongoing `LBVideoItem`, parity
   * `onPickHot`'s「host can override, else default in-place switch」shape (`seams.ts`
   * `buildGoLiveHandler`). Default: `playerRef.load(video.id)` then `switchVideo(video.id, video)`
   * — the SAME in-place-switch path `onPickHot`'s default uses, just carrying the already-complete
   * `LBVideoItem` `fetchLatestLive` returned (no `switchedVideoItem(...)` reassembly needed the way
   * `onPickHot`'s `HotRow` source requires). host override REPLACES the default entirely — the
   * container does NOT also call `load` / `switchVideo` in that case.
   */
  onGoLive?: (video: LBVideoItem) => void;

  /**
   * Whether `PlayerShellView` paints its opaque background placeholder. Default
   * `false` (the container overlays a real native video surface; painting it
   * would cover the video).
   */
  paintsBackgroundPlaceholder?: boolean;
  /** Whether to show the one-time gesture hint. Default `false`. */
  showGestureHints?: boolean;
  /**
   * 訂閱徽章（header 頭像上的 +/✓ 小圓標）要不要顯示 (rb-rn-subscribe-favorite-visibility-toggle)。
   *
   * 訂閱走既有 core `simulateSubscribeTap`（經 {@link LivebuyPlayerConfig.onTapRailItem} 以外的獨立
   * seam，未登入時先走本地登入 gate），純 client 端狀態，與後端 `sdkConfig` 無關——這個旗標只決定
   * 「畫不畫得出訂閱徽章」，不改變該 seam 本身在已掛載時的行為。
   *
   * **Default（省略）＝ `false`（隱藏）**——與訂閱鈕先前恆顯示的行為相反，是使用者明確要求的行為變更
   * （host app 要把訂閱功能改成預設關閉隱藏，可設定開啟顯示）。host 需顯式傳 `true` 才會顯示訂閱徽章。
   * 關閉時徽章節點完全不掛載（不是掛載但停用），頭像版位尺寸不受影響（徽章是絕對定位疊加層）。
   */
  showSubscribe?: boolean;

  /**
   * 播放器頂欄觀看人數徽章要不要顯示 (rb-rn-viewer-count-visibility-toggle)。
   *
   * **Default（省略）＝ `true`（顯示）**——與 {@link showSubscribe} 的預設 `false` 相反：這個旗標
   * 讓 host **選擇關閉**既有行為（一律顯示），不是讓 host 選擇開啟一個預設隱藏的功能。省略此欄位
   * 對既有呼叫端是 byte-identical（非 BREAKING），parity iOS/Android/Flutter 同名
   * `showViewerCount`（皆預設 `true`）。
   *
   * 顯式傳 `false` 時，即使 `isLive === true`（含回放）也不畫觀看人數徽章；同一段落的 LIVE 紅膠囊
   * （`isLive && !isReplay`）不受影響。不改變觀看人數資料本身（`viewerCount` 照常從 core 更新）——
   * 純粹是 reference-ui 渲染端的呈現旗標。
   */
  showViewerCount?: boolean;

  /**
   * 播放器頂欄影片標題「長標題是否以跑馬燈捲動」（rb-rn-marquee-title-scroll，design R15）。
   *
   * 收的是後端 `POST /sdk/config` 回應 `data.extensions.video_title_scroll` 的 **raw 值**
   * （Int 0/1，來源後台 `/admin/additional` 的設定項 `video_title_display`——⚠️ **wire key 與來源
   * 設定項不同名**，以 wire 欄位語意為準）。`extensions` 是 opaque raw bag，SDK 不解讀其語意
   * （`sdk-config` capability），所以由 **host** 讀出後注入這裡；容器**不會**自行讀 `sdkConfig`。
   * 型別刻意是 `unknown`，因為 RN core 的 `SDKConfig.extensions` 就是 `Record<string, unknown>`：
   *
   * ```ts
   * const cfg = await LivebuySDK.getSdkConfig();
   * <LivebuyPlayer config={{ titleScroll: cfg.extensions['video_title_scroll'] }} … />
   * ```
   *
   * 不需要 cast、也不需要 host 自己補預設——正規化只發生在 reference-ui 唯一的入口
   * `normalizeTitleScroll`（由本套件 re-export）：只有 `false` / 數值 `0` / **逐字** `'0'` 關閉，
   * 其餘一切（省略 / `null` / `1` / `'1'` / `''` / `' 0 '` / `'false'`）一律允許捲動。比較是
   * **嚴格相等**（不 trim、不 case-fold），與設計稿 `normalizeTitleScroll` 逐字一致。
   *
   * **Default（省略）＝ 允許捲動**。與 `showStock` 不同，這個 fallback **可以**、而且應該用後端
   * 預設來說明：後端契約對 `video_title_scroll` 明文「**未設定時為 `1`**」
   * （`openspec/specs/backend/sdk-config.md`）。
   *
   * 與內容量測是 **AND**：本旗標只回答「**允不允許**捲」，「有沒有東西可捲」由標題是否覆蓋容器的
   * 量測決定（`showsMarqueeTitle` = `titleScroll && marqueeTitleOverflows(...)`）。短標題設 `1`
   * 也不會捲。
   *
   * ⚠️ **MUST NOT 被讀成標題的可見性開關**——後端契約明文禁止。關閉時標題照常以單行 + tail
   * ellipsis、**完全不透明**顯示，且與開啟時**同高**（其下的主持人名 / LIVE 膠囊 / 觀看人數不會位移）。
   *
   * ⚠️ 範圍僅限**播放器頂欄標題**。widget 影片卡標題（`CarouselCard`）本來就單行截斷、從不捲動，
   * 設計稿 R15 明載本設定是否涵蓋該處**無證據**，故不受本旗標影響。
   */
  titleScroll?: unknown;

  // -- product-sheets ---------------------------------------------------------

  /**
   * 商品點擊。**四個**進場點共用此一 seam：(a) 商品列表列的名稱/價格欄與明細鈕
   * （`actionMode='detail'`）、(b) 同列的加購鈕（in-stock，`actionMode='addToCart'`）、
   * (c) 售完列的補貨鈴鐺（`actionMode='restock'`；經 `ProductSheetsView.handleOpenRestock`
   * 記下模式後仍走這條出口）、(d) VOD now-introducing 卡片輪播。
   *
   * 注意 (c) 的 `ProductList` 層 `onNotifyRestock`（吃 `LBProduct`，開 sheet 的入口）與本 config
   * 的 {@link LivebuyPlayerConfig.onNotifyRestock}（吃 `goodsGpn: string`，訂閱 toggle）**同名但
   * 不同層、不同簽章**，不要混淆。
   *
   * Default（rb-rn-product-tap-wire，parity iOS `performProductTap` / Android `defaultProductTap` /
   * Flutter `productOverlay.simulateProductTap`）：**兩個出口都做**——先
   * `playerRef.simulateProductTap(product)`（→ core `productOverlay.simulateProductTap` → native 派
   * `INFO_PRODUCT_VIEW` + `goods_pv` + `PRODUCT_CLICK`），再
   * `attachment.handleProductTap(product, 0)`（帶完整 `LBProduct` 開商品明細 sheet）。缺任一個都會退回
   * 死按鈕：只做前者則 sheet 不開（native 回流的 `PRODUCT_CLICK` 是 light payload、`handleProductTap`
   * 讀不到 `id` 即 early-return），只做後者則三件 telemetry 全不送。
   *
   * host 設此 closure 則**完全取代**預設（上述兩個出口都不再由容器呼叫），自行決定要不要補 telemetry。
   *
   * **已知限制**：`diversion` 固定傳 `0`（＝開站內明細）。iOS / Android 傳的是**頻道級**
   * `channel.diversion`，而 RN 橋接的 `LBPlayerChannelInfo` 不含該欄位、RN 也沒有其他管道取得。導購頻道
   * （`diversion == 1`）的分支需先由 core 橋接吐出該欄位，屬 `-core` 層、另行提案。容器**不會**以
   * `product.diversionUrl` 是否非空來推導 diversion（導購為頻道級決定，那樣推導會誤開外部瀏覽器）。
   *
   * 注意這與同名但不同層的 `PlayerShellView.onOpenProduct`（no-arg，容器接成
   * `setProductListPresented(true)`、開商品**列表** overlay）不是同一件事。
   */
  onOpenProduct?: (product: LBProduct) => void;
  /** Cart-CTA「開啟購物車」. Default: `attachment.openCart()`. */
  onOpenCart?: () => void;
  /** Variant chip tap. Default: `attachment.selectVariant(gi, oi)`. */
  onSelectVariant?: (groupIndex: number, optionIndex: number) => void;
  /** Direct qty set. Default: `attachment.setQty(qty)`. */
  onSetQty?: (qty: number) => void;
  /** Qty `+`. Default: `attachment.incQty()`. */
  onInc?: () => void;
  /** Qty `-`. Default: `attachment.decQty()`. */
  onDec?: () => void;
  /** 加入購物車. Default: `attachment.addToCart()`. */
  onAddToCart?: () => void;
  /** 收藏（到貨追蹤 type=1）toggle. Default: forward to the host (no-op if unset). */
  onToggleFavorite?: (goodsGpn: string) => void;
  /** 補貨通知（type=2）toggle. Default: forward to the host (no-op if unset). */
  onNotifyRestock?: (goodsGpn: string) => void;
  /**
   * 頻道 / detail-footer 分享. Default (dropin-player-default-share-sheet-rn): 以 `channel.share_url`
   * （`playerHeaderState.shareUrl`）經 react-native `Share.share` 開系統分享；空 url → no-op；頻道級不附
   * `?t=`. host 設此 closure 完全覆蓋（自畫 sheet / 流程，零變更）。RN 無同步 native `performShare()` 回傳
   * （§3182 DEFERRED）——host 攔截分享的 seam 即此 `onShare`.
   */
  onShare?: () => void;
  /**
   * 商品列表列**縮圖**點擊 → 影片跳轉到該商品介紹時間（issue 5）. Default:
   * `playerRef.seek(product.beginTime)`（`beginTime == null` 不 seek；core seek 僅 replay 生效）.
   */
  onSeekToProductIntro?: (product: LBProduct) => void;
  /**
   * 商品列表列**分享鈕**點擊 → 系統分享，連結帶該商品介紹時間 `?t=beginTime`（issue 6，
   * rb-rn-product-list-share-tap-noop 修正）. Default: 以 `channel.share_url`
   * （`playerHeaderState.shareUrl`）+ `?t=<beginTime>`（經套件純函式 `productShareUrlString`）經
   * `onShare` 頻道分享已在用的同一個系統分享出口（`Share.share`）真的開系統分享；`channel.share_url`
   * 本身為空才退回 core 頻道級分享事件（`operationPanel.simulateShareTap()`，parity iOS
   * `presentProductShare` 的空 `shareUrl` fallback）。host 設此 closure 完全覆蓋（自畫 sheet /
   * 流程，零變更）。
   */
  onShareProduct?: (product: LBProduct) => void;
  /**
   * 商品明細「更多商品」推薦格（rb-rn-product-detail-recommendations，design R21）播放圖示 tap →
   * 换片。Default: `playerRef.load(videoId)` then `switchVideo(videoId)`——比照容器層既有的
   * `onPickHot` 模式（`seams.ts` `buildMomentHandlers`），但**不**呼叫 `dismissDetail()` 等效行為
   * ——商品明細 sheet stack 由 `ProductSheetsView` 保證維持開啟（design.md D3）。`LBProductRecommendation`
   * 沒有 cover/title/duration，故不比照 `onPickHot` 手動組 `LBVideoItem`；`switchVideo` 內建的
   * cover-empty fallback（與 swipe 換片同一條）已經處理「沒有完整 item 可帶」這件事。
   */
  onSwitchProductVideo?: (videoId: string) => void;
  /**
   * 商品 sheet 的「只剩庫存 N 組」文案要不要顯示（rb-rn-show-stock-caption-toggle，design R15）。
   *
   * 收的是後端 `POST /sdk/config` 回應 `data.extensions.show_stock` 的 **raw 值**（Int 0/1，來源
   * 後台 `/admin/additional` 的設定項 `stock`）。`extensions` 是 opaque raw bag，SDK 不解讀其語意
   * （`sdk-config` capability），所以由 **host** 讀出後注入這裡；容器**不會**自行讀 `sdkConfig`。
   * 型別刻意是 `unknown`，因為 RN core 的 `SDKConfig.extensions` 就是 `Record<string, unknown>`：
   *
   * ```ts
   * const cfg = await LivebuySDK.getSdkConfig();
   * <LivebuyPlayer config={{ showStock: cfg.extensions['show_stock'] }} … />
   * ```
   *
   * 不需要 cast、也不需要 host 自己補預設——正規化只發生在 reference-ui 唯一的入口
   * `normalizeShowStock`（由本套件 re-export）：只有 `false` / 數值 `0` / **逐字** `'0'` 關閉，
   * 其餘一切（省略 / `null` / `1` / `'1'` / `''` / `' 0 '` / `'false'`）一律顯示。比較是**嚴格
   * 相等**（不 trim、不 case-fold），與設計稿逐字一致。
   *
   * **Default（省略）＝ 顯示**，行為與本設定存在之前完全相同（既有 host 零改動）。fallback 落在
   * 「顯示」的理由是「缺值時不讓既有畫面突然少一段文字」——**不是**因為後端預設為 1：後端契約對
   * `show_stock` 明文不宣告預設值（與同表 `show_pv_num` / `video_title_scroll` 不同）。
   *
   * 與售完是 **AND**：售完商品本來就不畫庫存數字，此旗標對它是 no-op。與 `NotifyRestockSheet` 的
   *「尚無庫存」（售完狀態文案）及任何「已售完」標籤無關，那些不受本設定影響。
   *
   * ⚠️ 與 core `LBVideoItem.showStock`（`POST /sdk/widget` 的 per-video `show_stock`）**同名但不同
   * 來源**，本設定既不讀取也不衍生自它。
   */
  showStock?: unknown;

  /**
   * 商品明細 sheet 的收藏鈕（到貨追蹤 type=1）要不要顯示 (rb-rn-subscribe-favorite-visibility-toggle)。
   *
   * 收藏走既有 {@link LivebuyPlayerConfig.onToggleFavorite} → core `toggleAwait(goodsGpn)`，純 client
   * 端狀態，與後端 `sdkConfig` 無關——這個旗標只決定「畫不畫得出收藏鈕」，不改變該 seam 本身在已掛載時
   * 的行為，也與 `isLive`（分享鈕隱藏旗標）正交。
   *
   * **Default（省略）＝ `false`（隱藏）**——與收藏鈕先前恆顯示的行為相反（`ProductDetailSheetView` 舊
   * 版文件曾寫「the favorite button is UNAFFECTED — it always renders」，現已由本旗標接管可見性），是
   * 使用者明確要求的行為變更。host 需顯式傳 `true` 才會顯示收藏鈕。只影響商品明細 sheet 的 `.detail`
   * （完整瀏覽）呈現——`.addToCart`（加購）呈現本來就不畫收藏鈕，此旗標對它是 no-op。
   */
  showFavorite?: boolean;

  // -- feed-win ---------------------------------------------------------------

  /**
   * Event-join「加入」— a host OBSERVE hook, NOT the funnel. Default: **no-op**.
   *
   * The authoritative funnel is `FeedWinModel.joinEvent`, which consults the container-injected
   * three-tier gate (rb-rn-event-join-gate) before forwarding. This hook is called **if and only
   * if** that forward actually happened (rn-event-join-gate-suppress-host-callback) — a gated tap
   * (guest not logged in / no nickname yet) notifies nothing, so the host never sees a join that
   * did not occur. A nickname-gate continuation (設名後自動接續) DOES notify, since that join is real.
   */
  onJoin?: (eid: number, keyword: string) => void;
  /**
   * Win-claim「確認領獎」CARRYING the user-entered email (rb-rn-win-claim-email-flow).
   * Default: `attachment.template.submitAwardClaim(winner, email)` → core
   * `requestAwardClaim(winner, { email })`.
   */
  onSubmitClaim?: (winner: LBWinner, email: string) => void;
  /**
   * Win-claim「領取」(EMAIL-LESS).
   *
   * @deprecated EMAIL-LESS 領獎在未被 host 攔截時**必然失敗**（core 預設領獎路徑 `email`
   * 必填，缺 email 直接 fail-fast、**連 `POST /sdk/video/claim` 都不送**）。改用
   * {@link onSubmitClaim}。形狀刻意維持不變以保源碼相容：**已設定它的 host 行為完全不變**
   * （turnkey 預設仍走它、email 收不到 —— 該 host 本來就自行接管領獎流程）。將於下一個
   * major 移除（`docs/contract-governance.md` I6 / 情境 F）。
   */
  onClaim?: (winner: LBWinner) => void;
  /** Claim-modal open. Default: presentation only (the container governs the modal). */
  onOpenClaim?: (winner: LBWinner) => void;
  /** Claim-modal ✕ /「關閉視窗」/ `done` 點 scrim. Default: presentation only. */
  onDismissClaim?: () => void;
  /**
   * `done`（discount）折扣碼「複製」. Default: no-op —— 本層保留版面 + 本地「已複製」回饋，
   * 實際寫入剪貼簿委派 host（RN 核心 `Clipboard` 已 deprecated，外部剪貼簿套件違反本層零外部
   * 依賴原則）。
   */
  onCopyClaimCode?: (code: string) => void;

  // -- moments ----------------------------------------------------------------

  /** 立即觀看. Default: `playerRef.load(nextVideoId)` then `onVideoSwitched`. */
  onWatchNext?: (nextVideoId: string) => void;
  /** 熱門卡 tap. Default: `playerRef.load(hot.id)` then `onVideoSwitched`. */
  onPickHot?: (hot: HotRow) => void;
  /** 略過片頭. Default: `playerRef.skipStart()`. */
  onSkip?: () => void;
  /**
   * 取消（rb-rn-endscreen-live-empty-state, design R41: EndScreen is now LIVE-only, so there is
   * no more 熱門變體 to retreat to — 取消 therefore also closes the whole EndScreen overlay, not
   * just the auto-next countdown). Default: `playerRef.cancelAutoNext()` THEN the same
   * default-close resolution `onDismiss` below falls back to (`playerRef.unload()` when
   * `onDismiss` is unset).
   */
  onCancel?: () => void;
  /** 重試. Default: `playerRef.load(currentVideoId)` (reload what is showing). */
  onRetry?: () => void;
  /**
   * Error-screen「返回」/「前往更新」. Default: host presentation no-op (the container can't
   * dismiss itself). Also consulted (rb-rn-endscreen-live-empty-state) as the close-target for
   * `onCancel` above and for the internal VOD-結束無-next auto-close gate — set this to make
   * BOTH close the player your own way; leaving it unset makes both fall back to
   * `playerRef.unload()`.
   */
  onDismiss?: () => void;

  // -- gap-surfaces -----------------------------------------------------------

  /** Auth-gate「前往登入」. Default: host-wired no-op (reference-ui NEVER logs in). */
  onLogin?: () => void;
  /**
   * 設定暱稱 modal「送出」. Default (turnkey, rb-rn-nickname-taken-inline-error): calls the
   * checkName-gated `playerRef.setGuestNicknameVerified(name)` — only on success does it dismiss
   * the modal + (when entered from the 留言 gating) open the chat composer + complete any pending
   * 加入活動 join. A rejection (name taken, or any other error) does NOT dismiss; the modal shows an
   * inline error (via `NicknamePromptController.submitFailure`) and stays open for a retry. Sets the
   * GUEST nickname, NEVER `setUser` (設名 ≠ 登入). An override REPLACES the default entirely — the
   * override itself stays `(name: string) => void` (no Promise involved) and none of the
   * `submitting` / `submitFailure` presentation state is touched by the container in that case.
   */
  onSubmitName?: (name: string) => void;

  // -- in-place switch ---------------------------------------------------------

  /**
   * Fired when an IN-PLACE switch (hot-pick / watch-next) changes the shown video,
   * with the NEW video id, so a host can keep its own "current video" state in sync.
   * Default: undefined. (Vertical swipe is driven by the shell's built-in backend
   * prev/next — there is no host-feed `swipeFeed`.)
   */
  onVideoSwitched?: (videoId: string) => void;

  /**
   * Fired ALONGSIDE {@link onVideoSwitched} on an IN-PLACE switch (swipe / hot-pick / watch-next),
   * carrying the SWITCHED video as a full `LBVideoItem`. hot-pick / watch-next carry the REAL
   * `cover` / `title` (from the `HotRow` / `MomentsModel.next[0]` that drove the switch); swipe
   * carries a `cover`-empty fallback with the correct `id` (RN reference-ui has no channel
   * adjacency nav rows in JS). The collapsible presenter (`CollapsibleLivebuyPlayer`) consumes it
   * so a minimized floating preview shows the SWITCHED video, not the entry one. Additive, default
   * undefined; {@link onVideoSwitched} (id-only) still fires unchanged. Parity iOS / Android
   * `onVideoSwitchedItem` (rb-rn-collapsible-player-track-switch). NOTE: RN nav/hot sources carry
   * no `preview`, so the floating card shows a static cover (no preview loop) — `LBVideoItem
   * .preview` stays "".
   */
  onVideoSwitchedItem?: (item: LBVideoItem) => void;

  // -- collapsible floating card (only meaningful under CollapsibleLivebuyPlayer) ---------------

  /**
   * Raw `floating_setting.position` for the MINIMIZED floating preview card
   * ({@link CollapsibleLivebuyPlayer}'s collapsed state) — `rb-rn-collapsible-player-floating-
   * position-inset`, parity with the sibling {@link LivebuyLiveEntryConfig.position}. Accepted
   * values `'left_bottom'` / `'right_bottom'`; ANYTHING else (omitted, `''`, `' left_bottom '`,
   * `'LEFT_BOTTOM'`, an unknown string) falls back to `'right_bottom'` — the corner
   * `CollapsibleLivebuyPlayer` used before this field existed. Normalization happens in the one
   * pure `normalizeFloatingPosition` (`liveEntryLogic.ts`) with STRICT equality: no trimming, no
   * case folding — the SAME entry point `LivebuyLiveEntryConfig.position` already uses, so both
   * floating surfaces in this package share one fallback boundary.
   *
   * This is a **raw wire value** — the host reads it out of
   * `sdkConfig.extensions.floating_setting.position` and passes it straight through; the SDK does
   * not interpret backend semantics (`extensions` is an opaque raw bag, `sdk-config` capability).
   *
   * **No-op on a bare `LivebuyPlayer`** used directly (not wrapped in `CollapsibleLivebuyPlayer`) —
   * that container has no floating-preview concept, same carve-out as
   * {@link LivebuyPlayerConfig.enableDirectCloseButton}'s collapsible-only half.
   */
  position?: string;
  /**
   * Resting-corner inset for the MINIMIZED floating preview card ({@link CollapsibleLivebuyPlayer}'s
   * collapsed state) — `rb-rn-collapsible-player-floating-position-inset`, parity with the sibling
   * {@link LivebuyLiveEntryConfig.inset}. `x` = the distance from the OWNED horizontal edge (`right`
   * when {@link position} resolves to `'right_bottom'`, `left` when it resolves to `'left_bottom'`),
   * `y` = bottom. Default `{ x: 12, y: 24 }` (constant `LIVE_ENTRY_DEFAULT_INSET`, re-exported from
   * `liveEntryLogic.ts` — the SAME value `CollapsibleLivebuyPlayer` hardcoded before this field
   * existed, so an omitting host is unaffected). A host with bottom chrome (e.g. a tab bar) sets
   * `{ x: 12, y: 70 }` to clear it. Drives BOTH the resting style AND the drag-clamp bound, so the
   * two never drift — same single-source contract as `LivebuyLiveEntryConfig.inset`.
   *
   * **No-op on a bare `LivebuyPlayer`** used directly (not wrapped in `CollapsibleLivebuyPlayer`).
   */
  inset?: { x: number; y: number };

  // -- initial seek (rb-rn-player-initial-seek) -------------------------------

  /**
   * 一次性初始 seek 秒數（`rb-rn-player-initial-seek`，parity iOS
   * `LivebuyPlayerConfig.initialSeekSeconds` / Android 同名欄位，兩者皆已 archive）。**Default
   * （省略）＝ `undefined`（維持既有行為，向後相容）**。
   *
   * 純轉發到既有 core 公開 API `LivebuyPlayerCoreRef.load(videoId, startAt)`
   * （`rn-player-load-initial-seek-core`）的 `startAt` 參數，reference-ui 這層 MUST NOT 重新實作
   * core 已完成的任何判斷邏輯（intro-aware、直播靜默丟棄、一次性消費、每次 `load()` 覆蓋殘留值）。
   *
   * 轉發只發生在「這個 {@link LivebuyPlayer} 容器實例第一次建立」（即容器唯一驅動 `videoId` 的
   * `useEffect` 第一次執行，也就是這個元件實例的初始 mount）。容器內其餘每一個換片路徑——host 改變
   * `videoId` prop 觸發同一個 effect 的之後重新執行、「現正直播」pill 換片
   * ({@link LivebuyPlayerConfig.onGoLive})、立即觀看 ({@link LivebuyPlayerConfig.onWatchNext})、
   * 熱門卡 ({@link LivebuyPlayerConfig.onPickHot})、串流失敗重試
   * ({@link LivebuyPlayerConfig.onRetry})、商品明細推薦格切換影片
   * ({@link LivebuyPlayerConfig.onSwitchProductVideo})、以及容器對外曝露的 imperative
   * `loadVideo(videoId)` 方法——皆 MUST NOT 套用這個值，確保「容器建立時的一次性產品頁意圖」不會
   * 外洩到容器存續期間的任何換片。
   */
  initialSeekSeconds?: number;

  // -- container styling ------------------------------------------------------

  /** Optional style for the container's outer `View`. */
  style?: ViewStyle;
}

/**
 * Resolves the EFFECTIVE shop id fed to `LivebuyPlayer.tsx`'s file-local `useLiveNowPoll` hook
 * (rn-live-now-pill-auto-shopid-turnkey-reference-ui) from the three inputs that jointly decide
 * it: whether the feature is on at all ({@link LivebuyPlayerConfig.showsLiveNowPill}), an explicit
 * per-instance override ({@link LivebuyPlayerConfig.shopId}), and the shop id
 * `LivebuySDK.configure(...)` was last called with (`LivebuySDK.currentShopId()`).
 *
 * Deliberately a PURE function with zero `LivebuySDK` / RN-runtime reference (parity iOS/Flutter's
 * own equivalent resolver design decision) — the ONE call site in `LivebuyPlayer.tsx` reads
 * `LivebuySDK.currentShopId()` and passes the result in as `configuredShopId`. Kept in this file
 * (rather than `LivebuyPlayer.tsx`) because this module is PURE TypeScript with no RN/core value
 * imports (see the file header comment above), so this function's own unit tests stay runnable in
 * a plain node/jest environment with zero mock setup.
 *
 * `showsLiveNowPill === false` → `undefined` UNCONDITIONALLY, regardless of either shop id
 * input — `useLiveNowPoll`'s own pre-existing `shopId == null` guard then makes the whole feature
 * a permanent no-op (reused as-is, not duplicated here). `showsLiveNowPill === true` (the
 * container's own `config.showsLiveNowPill ?? true` default) → the explicit `explicitShopId`
 * WINS when set (host intent expressed explicitly beats an inferred default); otherwise falls
 * back to `configuredShopId`.
 */
export function resolvedLiveNowShopId(params: {
  showsLiveNowPill: boolean;
  explicitShopId: string | undefined;
  configuredShopId: string | undefined;
}): string | undefined {
  if (!params.showsLiveNowPill) return undefined;
  return params.explicitShopId ?? params.configuredShopId;
}

/**
 * Resolves the `startAt` argument for `LivebuyPlayer.tsx`'s sole `videoId`-driven
 * `playerRef.current?.load(videoId, startAt)` call (`rb-rn-player-initial-seek`) from the two
 * inputs that jointly decide it: whether this container instance's one-shot
 * {@link LivebuyPlayerConfig.initialSeekSeconds} has ALREADY been applied once
 * (`hasAppliedInitialSeek`, tracked by a ref at the call site — see that file's
 * `hasAppliedInitialSeekRef`), and the config value itself.
 *
 * `hasAppliedInitialSeek === true` → `undefined` UNCONDITIONALLY, regardless of
 * `initialSeekSeconds` — this is what makes every `videoId`-prop-change re-run of that effect
 * (in-place switch / retry / any later reload) never leak the build-time seek intent.
 * `hasAppliedInitialSeek === false` (the container instance's first run of that effect) → the
 * config value verbatim (itself `undefined` when the host never set it, which is byte-identical
 * to the pre-existing single-argument `load(videoId)` call).
 *
 * Deliberately a PURE function with zero `LivebuySDK` / RN-runtime reference (same rationale as
 * {@link resolvedLiveNowShopId} above, parity iOS/Android's own equivalent one-shot resolver
 * — `rb-ios-player-initial-seek` / `rb-android-player-initial-seek`, both already shipped) — kept
 * in this file (rather than `LivebuyPlayer.tsx`) so this function's own unit tests stay runnable
 * in a plain node/jest environment with zero mock setup, per this module's file-header rationale.
 */
export function resolvedInitialSeekStartAt(params: {
  hasAppliedInitialSeek: boolean;
  initialSeekSeconds: number | undefined;
}): number | undefined {
  if (params.hasAppliedInitialSeek) return undefined;
  return params.initialSeekSeconds;
}
