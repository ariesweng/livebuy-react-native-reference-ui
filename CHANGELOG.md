# Changelog

All notable changes to `livebuy-react-native-reference-ui` (distributed via this mirror
repository) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Distribution.** This package is served as a public git dependency
> (`git+https://github.com/ariesweng/livebuy-react-native-reference-ui.git#v<ver>`). The
> published `<ver>` is read from this package's own `package.json` `version` field at release
> time; the channel itself is version-agnostic.

## [Unreleased]

## [1.12.1] - 2026-10-02

> **reference-ui，patch。** 只發 `livebuy-react-native-reference-ui`；`livebuy-react-native`（`2.9.2`）與
> `livebuy-react-native-ui`（`1.12.2`）不發。純缺陷修正，無公開符號新增／移除／改簽章。
> peer `livebuy-react-native-ui: ^1.9.0` 不變。

### Fixed

- **drop-in 播放器的進度條會隨播放前進**（`rb-rn-dropin-playback-progress-and-error-wiring`）：`LivebuyPlayer`
  容器原本沒有把播放進度交給 template，進度條一直停在起點。**`1.12.0` 及更早版本都有此問題。**
- **影片不存在或播放失敗時顯示錯誤畫面**（同上）：容器原本沒有把播放錯誤交給 template，失敗時只剩黑畫面。
  載入階段的終局錯誤（影片不存在、SDK 版本不支援、受限、簽章無效）立即顯示；其餘錯誤在播放器進入 `error`
  狀態時顯示。聊天限流、暱稱重複、需登入才能留言、尚未開播、重複加購這類**非播放錯誤不會**觸發錯誤畫面。
- **商品列縮圖上的播放／介紹中疊層看得到了**（`rb-rn-emoji-magnifier-and-row-overlay-fix`）：原本畫在商品圖
  底下被蓋住。
- **錯誤畫面「找不到影片」與聊天活動列「瀏覽」的圖示改為向量圖**（同上）：原為 emoji `🔍`，不吃主題色。

> **行為變更提醒**：先前自行監聽 `onError`／狀態並在播放器上方疊自家錯誤 UI 的 host，升級後會同時看到 SDK
> 的錯誤畫面。
> **驗證範圍**：Android API 35 與 iOS 26.5 模擬器以範例 host 的 release build 對真實後端實跑（進度條前進、
> 無效影片 ID 顯示錯誤畫面、縮圖疊層、新圖示）。**未經真機驗證**；直播路徑與「播放中途斷線」的錯誤畫面未驗。

## [1.12.0] - 2026-10-02

> **reference-ui，minor。** 只發 `livebuy-react-native-reference-ui`；`livebuy-react-native`（`2.9.2`）與
> `livebuy-react-native-ui`（`1.12.2`）不發。無公開符號移除、無簽章破壞；新增公開元件／選用 prop 與一個
> **optional** peer 相依，並含行為變更。peer `livebuy-react-native-ui: ^1.9.0` 不變。

### Fixed

- **容器先掛載、host 後 `configure()` 時不再永久空白**（`rb-rn-dropin-release-blockers`）：`LivebuyWidget` /
  `LivebuyPlayer` / `LivebuyLiveEntry` 原本掛載時只查一次 `getSdkConfig()`，SDK 尚未 configure 就拿不到、之後
  不再查。現在依固定排程重試（100／200／400／800 ms，之後每 1 秒，最多約 31.5 秒）直到取得或卸載。**`1.11.1`
  及更早版本都有此問題**；先前要自己等 `configure()` 完成才掛載容器的 host 不受影響。
- **點卡片的預覽影片區域現在可開啟播放器**（`rb-rn-dropin-release-blockers`）：Android 上預覽影片的原生視圖
  會攔下觸控，只有縮圖下方的標題列點得動；預覽層改為不接收觸控。`1.11.1` 及更早版本都有此問題。
- **drop-in 播放器重開時靜音圖示對齊實際狀態**（`rb-rn-drop-in-mute-icon-seed-wiring`）：容器把
  `queryIsMuted` 接上 core 的 `isMuted()`；使用者操作不會被過期的查詢結果覆蓋。沒有記憶值時圖示可能晚一拍
  才正確（需等原生 Player 建立）。
- **商品列表的搜尋圖示改為向量圖**（`rb-rn-product-list-search-icon-parity`）：原為 emoji `🔍`，不吃主題色且
  與 iOS／Android／Flutter 不同；現為設計稿 `Icons.search` 的線條放大鏡。

### Added

- **drop-in 容器自行處理系統邊距**（`rb-rn-edge-to-edge-safe-area`）：chrome 避開狀態列／導覽或手勢列／
  cutout／鍵盤，影片與背景維持滿版；host 已把容器往內推時不重複套用。inset 來源依序為：容器 config 新欄位
  `safeAreaInsets`、新公開元件 `LivebuySafeAreaInsetsProvider`、host 已安裝的
  `react-native-safe-area-context`（自動取用）；**三者皆無時輸出與先前相同（不會被修正），需 host 接線**。
  另新增 `playerSafeAreaInsets`（SDK 自有全螢幕播放器 Modal 用）。不改 host 的系統列外觀。
- **optional peer 相依 `react-native-safe-area-context` `>=4.0.0`**：未安裝不影響執行。⚠️ 需要 Metro 的
  `allowOptionalDependencies`（`@react-native/metro-config` 與 Expo 預設已開）；自訂 Metro 設定且關閉該選項、
  又未安裝該套件的 host 會在 bundle 階段失敗。

### Changed

- **遠端靜態圖依顯示框尺寸解碼**（`rb-rn-remote-image-resize-method`）：Android 帶 `resizeMethod="resize"`，
  框變大時重新請求較大的圖；`RemoteImage` 新增 `decode` prop（放大燈箱以來源解析度解碼）。
- **放大燈箱在 iOS 上依放大後尺寸解碼**（`rb-rn-zoom-lightbox-ios-decode`）：把商品圖版面框鋪成
  「圖卡 × 最大放大倍率」（像素邊長上限 4096）再以反向 transform 縮回，繪製結果不變；Android 輸出不變。

> **驗證範圍**：Android API 35 模擬器以範例 host 的 release build 對真實後端實跑（未安裝選用套件可啟動、
> widget 載入、點預覽區開播放器、播放、商品列表與圖片、搜尋圖示）；iOS 26.5 模擬器同樣以 release build
> 看過啟動、widget 載入、點預覽區開播放器、播放、商品列表與圖片、搜尋圖示。**未經真機驗證**；host 有安裝
> `react-native-safe-area-context` 的畫面未驗；**放大燈箱在 iOS 的畫質與記憶體未驗**（範例 host 會攔截商品
> 點擊，到不了 SDK 的商品詳情）。範例 host 沒有提供任何 inset 來源，在 iOS 上播放器 header 會與狀態列重疊——
> 這是「無 inset 來源時輸出與先前相同」的既有情形，host 需接線。
> 撰寫 `rb-rn-edge-to-edge-safe-area` 時的實作在 host 未安裝該選用套件時 release build 會啟動即崩潰，已於
> `rb-rn-dropin-release-blockers` 修正，該缺陷從未隨任何已發佈版本出貨。

## [1.11.1] - 2026-09-30

> **reference-ui，patch，純 bug fix，零 BREAKING。** 只發 `livebuy-react-native-reference-ui`；
> `livebuy-react-native`（`2.9.0`）與 `livebuy-react-native-ui`（`1.12.0`）不發。原生 pin 與 peer 範圍不需動
> （本修復純 reference-ui 層；使用的 `template.clearAuthGate()` 為 `livebuy-react-native-ui` 既有公開方法，
> 早於 peer 下限 `^1.9.0`）。

### Fixed

- **drop-in 主動加購閘觸發時不再疊出兩個「請先登入」**（`rb-rn-cart-login-gate-gap-authgate-mutual-
  exclusion`）：開了 `requireLoginForAddToCart`、訪客點加購時，商品面板 cart 登入閘與 gap-surface
  `AuthGateModal(cartAdd)`（經 `AUTH_REQUIRED(cart_add)` 回流的 template `authGate`）原本會同時顯示。現在 gap
  層在「商品面板 cart 閘目前正在畫面上呈現」時讓位，並以既有 `template.clearAuthGate()` 消耗殘留 authGate。
  cart 閘不在畫面上（按「稍後再說」後再點、外部 widget／headless 訪客）時 gap modal 仍顯示，其他 trigger
  不受影響。新增兩個**可選** prop（additive，既有呼叫端不受影響）：`ProductSheetsView.onCartGatePresentedChange`、
  `GapSurfacesOverlayView.cartGatePresented`（預設 `false`）；另新增 `GapSurfacesModel.authGateYieldsToCartGate()`
  方法。已知取捨：被動 401 時序 gap modal 可能閃現約一格（一個 render）才讓位；未經真機驗證，僅單元／
  整合測試與讀碼推演。

## [1.11.0] - 2026-09-25

> **reference-ui，minor，零 BREAKING。** 自 `1.10.0`（發版準備，尚未實際 publish）以來累積 1
> 個內容 commit。

### Added

- **drop-in 容器 `LivebuyPlayerConfig` 新增 `initialSeekSeconds`**（`rb-rn-player-initial-
  seek`，depends `rn-player-load-initial-seek-core`）：`LivebuyPlayerConfig` 新增可選
  `initialSeekSeconds?: number`，只在容器首次 mount 套用一次（透過一次性旗標 ref
  `hasAppliedInitialSeekRef`）轉發到 `playerRef.current?.load(videoId, startAt)`，換片路徑、
  imperative `loadVideo`、`seams.ts` 各預設分支皆不套用，避免「產品頁指定的初始 seek 意圖」外洩
  到之後任何使用者手勢換片 / 重試路徑。讓 host 不用繞過容器直接拿底層 `playerRef` 也能用到 core
  剛補上的 `startAt` 能力，維持容器「不用碰 core API 也能跑」的 turnkey 定位。

## [1.10.0] - 2026-09-23

> **reference-ui，minor，零 BREAKING。** 自 `1.9.1` 以來累積 7 個內容 commit（3 個新增能力 + 4
> 個修復）。

### Added

- 直播預告單擊訂正真實封面圖疊加（`rb-rn-upcoming-live-wiring-fix`，parity
  `rb-android-upcoming-cover-real-image`；同批訂正主 spec 一句誤述 RN/Flutter 為 headless
  bridge 的過期敘述，解決 `parity-debt-ledger` #42）。
- 開場影片乾淨模式隱藏略過鈕、展開進度條改為完全可互動（可暫停/播放/拖曳 seek）
  （`rb-rn-clean-mode-upcoming-intro-coverage`、`rb-rn-intro-progress-bar-interactive`）。
- 直播結束畫面顯示真實直播時長（`rb-rn-endscreen-live-duration`）。

### Fixed

- 直播預告單擊訂正為完全不觸發乾淨模式（`rb-rn-clean-mode-upcoming-not-triggered`）。
- 開場影片乾淨模式展開進度條拖動放開後失去與播放進度同步、播放/暫停按鈕熱區太小
  （`rb-rn-intro-progress-bar-followup-fix`）。

## [1.9.1] - 2026-09-21

> **reference-ui，patch，零 BREAKING。** 自 `1.9.0` 以來累積 3 個內容 commit：2 個 widget 卡片
> 預覽 Android 解碼器資源管理（route-cover 釋放 + 離屏釋放）+ 1 個新增 Android PiP 進行中隱藏
> overlay chrome。

### Added

- **Android PiP 進行中隱藏 overlay chrome**（`rn-android-pip-hide-chrome-reference-ui`，
  reference-ui 層，僅 Android）：`livebuy-react-native-reference-ui` 的 drop-in 容器
  `LivebuyPlayer` 在 Android OS Picture-in-Picture 進行中只保留底層影片，隱藏整層 overlay
  chrome（header / 操作列 / 商品卡 / 字幕 / 合流聊天 / composer / 活動通知），退出 PiP 立即
  復原，對齊 Android 原生 `:livebuy-reference-ui` 既有行為。iOS 完全不受影響
  （`AVPictureInPictureController` 天生 video-layer-based，chrome 本來就進不去 PiP 視窗）。
- **widget 卡片預覽新增 per-subtree route 軸**（`rb-rn-widget-preview-route-cover-release`）：
  host 以 `react-navigation` 的 `useIsFocused()` 餵入 `LivebuyRouteVisibilityContext` /
  `LivebuyWidget.routeVisible`，Android 被 stack push 蓋住時卸載 `<Video>` 釋放解碼器、回來
  重掛，`onError` 有上限重試；iOS 維持既有 keep-alive（`<Video>` 常駐、只由 `paused` 控制）。
- **widget 卡片預覽 Android 離屏釋放解碼器**（`rb-rn-widget-preview-offscreen-decoder-release`）：
  reference-ui 自持的 Grid ScrollView 與 scrollable 輪播發捲動訊號、卡片訂閱重量，離屏 1 秒後
  卸載釋放解碼器、滾入重掛、從未量到可見不掛載；iOS 維持既有 keep-alive。

## [1.9.0] - 2026-09-20

> **minor，零 BREAKING。** 自 `1.8.0` 以來累積 12 個內容 commit，皆為像素/行為缺口修復與
> design 批次 parity。

### Added

- **MiniCartPeek 補原價劃線渲染**（`vod-now-introducing-original-price-reference-ui-rn`），
  parity iOS/Android 已完成、Flutter 待補。
- **`PlaybackProgressBarView` 新增 `onScrubBegin`/`onScrubEnd`**（`rn-vod-scrub-seek-tolerance-
  reference-ui`），串接 `PlayerShellModel`/`PlayerShellView`/`LivebuyPlayer.tsx` 到 RN core
  scrub-tolerance 橋接；RN 是繼 Flutter/Android 之後第三個完成全鏈路串接的平台（parity-debt-
  ledger #34 收斂），iOS 待真機驗證後續補。

### Fixed

- **Design R39/R45/D8/R46/R47 五輪視覺批次**（reference-ui）：商品列名稱前標籤改行內
  `View`-in-`Text` 修正換行擠壓（R39 parity）、商品列表 row 排版重分組 + 新增折扣百分比
  （R45）、商品明細「更多商品」grid 原價改用 `flex-wrap` 換行、雙擊快進/快退提示改半螢幕
  漸層、`AddToCartSheet` 主圖旁價格區改垂直堆疊（原價移到現價上方）；商品明細 sheet 原價
  劃線色票統一 `#A0A0A0`。皆為純視覺/排版修正，parity iOS/Android/Flutter。
- **`VideoInfoPanel` 三態文案改版**（`rb-rn-video-info-panel-replay-copy`，R44 parity，四端
  完成）。
- **修復 scrub 結算 seek 順序 bug**：release/terminate 路徑此前最終強制 `onScrub` 早於
  `onScrubEnd` 送出，導致監聽 scrub-end 的一方來不及生效；同時修復 release/terminate 從未讀取
  事件自身觸控位置的缺口（`rn-vod-scrub-seek-tolerance-reference-ui`）。
- **修復 `LivebuyPlayer.tsx` drop-in container 從未注入 `requestTogglePlayPause`/`requestSeek`/
  `requestSeekBy`**：`useTemplateAttachment` 只注入了 `loadVideo`/`requestEventJoin`/
  `requestAwardClaim`，導致 VOD/回放進度條的播放/暫停鈕、拖曳 seek，以及雙擊 ±10 秒/長按 2 倍速
  （同一條 request 鏈）視覺上有反應但從未真正送達 player——靜默 no-op、無任何錯誤訊息
  （`fix-rn-livebuyplayer-scrub-control-wiring-reference-ui`）。
- **widget 卡片預覽在 Android 不再參與 audio focus 仲裁**（reference-ui）：parity Android
  原生 ExoPlayer 預設行為 / iOS `AVQueuePlayer`，四端全數對齊。
- **EndScreen 快照測試清理**：清除 `EndScreen.test.tsx.snap` 4 個 obsolete 快照鍵，測試
  維護，無行為變化。

## [1.8.0] - 2026-09-13

> **minor，零 BREAKING。** 自 `1.7.0` 以來累積 4 個內容 commit，皆為像素/行為缺口修復。

### Added

- **觀看人數轉發死接線修復**（`rn-viewer-count-bridge-reference-ui`）：容器
  `handleMomentSnapshot` 補上 `viewerCount` 轉發，parity iOS/Android/Flutter。

### Fixed

- **CC 未提供字幕 tooltip 文字逐字元換行修復**（`rb-rn-cc-tooltip-text-wrap-fix`），根因為
  Yoga 對單邊 inset 絕對定位節點的 shrink-to-fit 量測缺陷。
- **結束畫面右上角關閉鈕觸控攔截修復＋固定直接關閉**（`fix-rn-endscreen-close-button-blocked`），
  既有死按鈕，非行為倒退。
- **Widget/Player fetch 失敗改為 `__DEV__` 可見**（`rn-widget-live-entry-fetch-error-visibility`），
  回應 host QA 可觀測性缺口，既有行為（空清單/3 秒重試）不變。

## [1.7.0] - 2026-09-11

> **minor，含 1 項 ⚠️ BREAKING（僅本套件內部視覺實作，非公開 API）。** 自 `1.6.0` 以來累積 54
> 個內容 commit（另 3 個 sample/git-housekeeping/iOS-scoped 不列入；其中 1 個「商品照片載入體驗
> 優化」已於 `livebuy-react-native-ui` 套件段落記錄，不重複列出），大量像素/行為缺口修復批次，
> 含 17 項向量圖示化收尾。

### Added

- **圖示向量化批次（17 項）**：取代裸 emoji / Unicode 字元 / 文字字元，全面改用自繪向量 glyph
  或 `react-native-svg`，parity iOS/Android/Flutter 既有向量圖示系統。涵蓋暱稱設定徽章尺寸與色彩
  角色、人像徽章（`rb-rn-icon-parity-guestname-badge-icon-size` / `-color-role-fix` /
  `-person-glyph`）、錯誤畫面三個終態圖示與重試箭頭（`rb-rn-icon-parity-errorscreen-icons`）、
  加購打勾徽章＋彈跳動畫（`rb-rn-icon-parity-carttoast-check-glyph`）、商品列表播放三角
  （`rb-rn-icon-parity-productlist-play-glyph`）、領獎失敗徽章改圓形（`rb-rn-icon-parity-
  winclaim-fail-badge-shape`）、Widget 關閉鈕（`rb-rn-icon-parity-widget-close-glyph`）、客服
  聯絡雙泡泡（`rb-rn-icon-parity-contact-glyph`）、領獎信封/禮物（`rb-rn-icon-parity-winclaim-
  gift-mail`）、聊天列 AI/主播徽章（`rb-rn-icon-parity-chatfeed-ai-host-badge`）、播放器縮小/PiP
  鈕（`rb-rn-icon-parity-player-minimize-pip`）、補貨提醒鈴鐺雙態（`rb-rn-icon-parity-restock-
  bell-fill`）、鎖頭徽章（`rb-rn-icon-parity-authgate-lock-glyph`）、促銷標籤鏤空孔洞
  （`rb-rn-icon-parity-tag-glyph-hole-fix`，訂正 `borderWidth` box-model 算術錯誤導致鏤空被吃
  穿成實心色塊）、聊天送出鈕圓盤箭頭（`rb-rn-icon-parity-chat-send-arrow-circle`）、商品明細
  收藏鈕（`rb-rn-icon-parity-product-detail-favorite-icon-parity`）。
- **EndScreen 直播限定收斂**：移除熱門變體，改為直播限定的倒數／無推薦空狀態，並鎖存
  `isLive` 避免 `onChannelChange` 因無關改動每 poll tick 重 fire 而誤判關閉 player
  （`rb-rn-endscreen-live-empty-state` / `rb-rn-endscreen-live-gate-latch`）。
- **CC 字幕鈕圖示重新設計**（⚠️ BREAKING，見下方專節）＋不可用時恆渲染＋提示泡泡
  （`rb-rn-cc-icon-availability-redesign`），並新增啟用時 active 填色態
  （`rb-rn-cc-icon-active-fill-state`）。
- **商品名稱標籤系統**：直播價/熱賣中/即將售完標籤落地，接上搶購中/介紹中真實資料
  （`rb-rn-product-row-name-tag-system`、`rb-rn-flash-sale-live-signal-wiring`；
  `rb-rn-narrating-banner-revert-flash-sale-text` 撤回搶購場二選一文案，恆顯示介紹中）。
- **介紹中商品卡即時更新**：容器接線 `onChannelChange`（`rn-moment-products-wiring-reference-ui`）、
  VOD 介紹中商品卡顯示時機比照側欄/浮動商品袋（`rb-rn-now-introducing-carousel-buffering-gate`）。
- **直播疊層/浮動小卡新增能力**：進度條拖曳節流真實 seek IPC（`rb-rn-progress-bar-drag-seek-
  throttle`）、進度條展開暫留期間疊層元件避讓 transport bar（`rb-rn-scrub-expanded-chrome-
  lift`）、浮動小卡新增 position/inset host 覆寫參數（`rb-rn-collapsible-player-floating-
  position-inset`）、直播公告橫幅改自訂 bullhorn 向量圖示（`rb-rn-live-announce-bullhorn-
  icon`）、`LivebuyLiveEntry` 隱藏觀看人數徽章（`rb-rn-live-entry-hide-viewer-count`）、已結束
  直播回放觀看人數改為顯示＋統一走 LIVE chrome（`rb-rn-playerheaderbar-viewer-count-replay-
  parity` / `rb-rn-replay-live-chrome-parity`）、直播模式點商品縮圖跳過關閉商品列表抽屜
  （`rb-rn-product-sheet-keep-open-on-live-seek`）。
- **聊天室視覺調整**：一般觀眾留言暱稱改粉色＋訊息不限行數（`rb-rn-chat-audience-bubble-pink-
  nickname-full-lines`）、最新訊息 pill 改白底 accent 字置中（`rb-rn-chat-pill-color-align`）、
  加入活動列改顯示訊息自帶主播名（`rb-rn-event-join-streamer-name`）、延遲冒泡 sheet 關閉事件
  對齊滑出動畫（`rb-rn-chat-reveal-sheet-dismiss-timing`）。
- **字幕（CC）疊層對齊窄框置中**，VOD/回放不同 right inset，回放開字幕時隱藏聊天室
  （`rb-rn-caption-overlay-align-hide-chat`），VOD 字幕疊層底部固定預留商品卡空間
  （`rb-rn-vod-caption-reserve-card-space`）、字幕疊層/釘選卡/公告底部安全間隙改為單一事實來源
  避免與底部列重疊（`rb-rn-caption-overlay-bottom-bar-clearance-fix`）、CC「未提供字幕」tooltip
  改量測式置中並加螢幕邊界夾制、邊界夾制後箭頭改反向補償（`rb-rn-cc-tooltip-position-fix` /
  `-arrow-anchor-fix`）。
- **無公告時合流聊天 feed 底部對齊置頂商品卡**（`rb-rn-live-chat-clearance-realign`）。
- **EqualizerGlyph 改為呼吸動畫**（`rb-rn-live-equalizer-motion`），取代靜態版，parity
  iOS/Android/Flutter。

### Fixed

- **回放聊天依時間顯示的完整修復鏈（reference-ui 容器端）**：接上正確的漸進式
  `onReplayChatRevealed` 資料來源（core 層新轉發，見 `livebuy-react-native` 套件），完成 RN 端
  回放聊天依時間顯示的完整修復鏈，parity iOS/Android/Flutter（`fix-rn-replay-chat-progressive-
  reveal-reference-ui`）。
- **暱稱設定圖示鉛筆 badge**：改用真實 `react-native-svg` 向量路徑，修復無法辨識的視覺缺陷
  （`rb-rn-personedit-pencil-badge-visibility-fix`）。
- **已結束直播回放改用嚴格 `isLive` 排除**，讓真正 VTT/CC 字幕可顯示
  （`rb-rn-replay-caption-overlay-fix`）。
- **觀眾留言暱稱冒號改回白色**，不再誤套暱稱粉色（`rb-rn-chat-audience-nickname-colon-color-
  fix`）。
- **商品明細切換「更多商品」推薦商品時捲動位置重置回最上方**（`rb-rn-recommendation-switch-
  scroll-reset`）。
- **容器補不透明兜底背景**，防禦性比照 Flutter 修法（`rb-rn-player-open-opaque-backdrop`）。
- **`LivebuyPlayerConfig` 新增 `showsLiveNowPill` + `shopId` 自動 fallback**，parity
  iOS/Flutter（`rn-live-now-pill-auto-shopid-turnkey-reference-ui`）。
- **直播公告橫幅只顯示一行**，聊天避讓量針對 RN 自己的 base clearance 重新推導
  （`rn-live-announce-two-line-clearance-fix`）。

### ⚠️ BREAKING

- **CC 字幕鈕圖示重新設計**（`rb-rn-cc-icon-availability-redesign`，僅本套件內部視覺實作，非
  公開 API）——舊圖示樣式移除，字幕不可用狀態現在恆渲染並顯示提示泡泡（先前不可用時完全不
  渲染）；無 API 簽章影響，純視覺行為變更，parity iOS/Android/Flutter 同批決策。

## [1.6.0] - 2026-09-08

> **minor，含 1 項 ⚠️ BREAKING（內部實作細節，非公開 API）。** 自 `1.5.0` 以來累積 25 個
> commit，大量像素/行為缺口修復批次。

### Added

- **channel 封面圖真實接線出像素**（`player-loading-cover-background-reference-ui-rn`）——
  loading 階段此前只顯示純黑品牌底，現疊真實 channel 封面圖 + 深色遮罩，parity iOS/Android。
- **`showViewerCount` host 旗標**（`rb-rn-viewer-count-visibility-toggle`，預設 `true`、向後相容、
  非 BREAKING）——可強制隱藏頂欄觀看人數徽章。
- **LIVE 疊層手勢提示自動淡出**（`rb-rn-live-overlay-gesture-hint-autofade`）——新增
  `autoFadeGestureHints` 參數，parity iOS/Android/Flutter。
- **讚按鈕特效重寫**（`rb-rn-live-like-burst-restyle` → `rb-rn-live-like-burst-png-glyphs`，design
  R37）——4 種隨機圖案 × 3 種上升軌跡 × 3 種擺動路徑，讚鈕新增亮色態；4 種圖案最終改用設計稿提供
  的真實 PNG 素材繪製（見下方 BREAKING）。
- **直播回放「從未介紹過」商品的縮圖行為訂正**（`rb-rn-replay-never-introduced-no-ui` +
  `rb-rn-replay-never-introduced-tap-noop`）——不再誤顯示看講解/介紹中效果，點擊完全 no-op，
  parity iOS。
- **直播疊層置頂商品卡新增售完標籤**（`rb-rn-live-pinned-card-soldout-label`，含後續色碼訂正
  `#6B6775`→`#9A96A3`）。

### Fixed

- **向量圖示化批次**（6 項，取代裸 emoji / Unicode 字元 / 文字字元）：商品明細按鈕
  （`rb-rn-icon-parity-product-detail-button`）、補貨鈴（`rb-rn-icon-parity-product-restock-
  bell`）、觀看人數徽章（`rb-rn-viewer-count-badge-vector-glyph`）、聊天「回到最新」箭頭
  （`rb-rn-icon-parity-chat-returntolatest-arrow`）、商品明細放大鏡握把對齊（`rb-rn-product-
  detail-zoom-badge-glyph-alignment`）、飄動愛心與 LIKE 按鈕（`rb-rn-heart-burst-icon-parity`）
  ——皆改用向量 glyph（多項使用 `react-native-svg` 逐字複製設計稿座標），parity iOS/Android/
  Flutter。
- **商品資料/圖片載入缺口**：商品 sheet 補傳 `live` prop 修復縮圖/明細主圖/更多商品格恆佔位
  （`rb-rn-product-sheets-live-images-wiring`）；點播間介紹面板文字恆空（`video-info-wiring-
  reference-ui-rn`）；開場略過介紹鈕不出現、直播預告 view-model 恆預設值（`rn-intro-overlay-
  wiring-reference-ui`）。
- **售完/介紹中/回放狀態旗標修正批次**：售完商品不再排除介紹中效果（`rb-rn-product-row-soldout-
  introducing-visible`）；商品列縮圖覆蓋層模式改讀 `isFinishedLiveReplay`（`rb-rn-product-row-
  replay-flag-fix`）；VOD 商品列縮圖撤回 `done` 態（`rb-rn-product-row-vod-done-state-removed`，
  設計拍板撤回）。
- **其他修復**：Grid cell 寬度改由容器寬動態推導，取代寫死 179（`rb-rn-grid-cell-width-
  responsive`）；展開態進度條 play/pause icon 尺寸 12→14 對齊雙原生（`rb-rn-progress-bar-
  expanded-ui-parity`）；商品列表分享鈕預設接上真系統分享（`rb-rn-product-list-share-tap-
  noop`）；sheet resize 下限恆為結構性下限、dismiss 下限獨立每手勢重新錨定（`rb-rn-sheetkit-
  resize-floor-not-reanchored`）。

### ⚠️ BREAKING

- **讚特效愛心圖案不再吃 `theme.accent` 染色**（`rb-rn-live-like-burst-png-glyphs`，僅本套件
  內部實作細節，非公開 API）——4 種飄動圖案（愛心/星星/箭頭/十字）統一改用設計稿提供的 PNG
  素材繪製固定色，`heart` 圖案此前吃呼叫端 `color`/`theme.accent` 的行為移除。host 若有自訂
  theme accent 且依賴愛心跟隨變色，視覺會改變；無 API 簽章影響，`HeartBurstView` 的公開
  `color` prop 仍保留（源碼相容）但渲染邏輯不再讀取它。

## [1.5.0] - 2026-09-07

> **minor，非 BREAKING。** 自 `1.4.2` 以來累積 10 個 commit，與 v4.14.0 iOS/Android/Flutter
> 同源的四端 parity 補課批次之 reference-ui 部分。`handleInfo`（直播資訊面板）接線本輪**未
> 涵蓋**，仍是已知缺口，留待未來獨立 change。

### Added

- 直播回放版型統一判斷 `isFinishedLiveReplay` 接線。
- 播放器 header chrome + 側欄「聯繫商家」icon 接線（`handleHeaderChrome` /
  `handleRailEnablement` 皆為既有公開方法，本輪讓它們第一次真的被餵值，非 BREAKING）。
- widget 商品卡改預設自動讀 `item.goods`；widget 輪播卡片封面改 `BoxFit.cover`。
- 商品明細主圖改絕不放大/不裁切/動態高度留白；介紹中商品卡縮圖改正方形 56×56。
- bag/cart icon 改用 `react-native-svg` 自繪向量對齊設計稿。
- 商品列縮圖左上角編號徽章、介紹中換 HOT；VOD 商品列縮圖依播放進度顯示三態覆蓋層。
- Floating widget 商品卡行為補進 spec+測試（純追認，`rb-rn-floating-widget-goods-spec-
  catchup`）。

> ⚠️ **事後補記（1.4.2 CHANGELOG 遺漏）**：`1.4.2`（兩項皆屬本套件）實際上也包含
> `rb-rn-carousel-card-pin-viewers-duration-removal`（VOD/回放輪播卡時長徽章移除，commit
> `02836bdf`，2026-09-04 14:22）與 `rb-rn-activity-sheet-cta-repeatable`（抽獎活動彈窗
> `ActivitySheetView` 內部 API 變動，commit `d86cfaf2`，2026-09-03 13:44）兩項
> reference-ui-internal ⚠️ BREAKING——這兩項當時已隨那次真實發布（皆是版號 bump commit
> `028c7dec` 的祖先），但當時 CHANGELOG 段落聚焦在 xsmartlive 回報的整合缺陷修復，未一併
> 記載。本補記不改變 `1.4.2` 版號、不重新發版。

## [1.4.2] - 2026-09-04

> **Patch，含 1 項新增 optional config field（additive、非 BREAKING）。** 源自外部 Flutter
> host（xsmartlive）對 mirror repo `livebuy-flutter-sdk` 的整合缺陷回報，查證後發現 RN 有一個
> 很窄的邊緣情境同根因：host 在 reference-ui 容器**之外**另行呼叫 template 層
> `attachPlayerTemplate()`，之後才掛載 `LivebuyPlayer`/`LivebuyWidget` 容器時，容器掛載觸發的
> core 單槽重新註冊會頂替掉這份外部 attachment 的原始註冊，使其永久收不到事件。**容器本身平常
> 單獨使用不受影響**——這不是既有 host 的 regression。
>
> ⚠️ 事後補記（見上方 `1.5.0` 段末）：本版實際上也包含 2 項 reference-ui-internal BREAKING
> （VOD/回放輪播卡時長徽章移除、`ActivitySheetView` 內部 API 變動），當時未記載。

### Added

- **`LivebuyPlayerConfig` / `LivebuyWidgetConfig` 新增選填 `externalTemplateAttachment` prop**
  （型別為 `Pick<PlayerTemplateAttachment, 'handleEvent'> | null`，additive，省略或 `null` 時
  行為 byte-identical）——讓 host 把自己在容器之外持有的一份
  `livebuy-react-native-ui.attachPlayerTemplate()` 回傳值交給容器；容器收到事件時會額外轉發
  一次給這份外部 attachment（`internal → host → forward` 派送序，`forward` 拋錯不影響其餘兩者）。
  依賴 `livebuy-react-native-ui@1.4.1` 曝露的 `PlayerTemplateAttachment.handleEvent()`。`LivebuyWidget`
  也提供此欄位（`subscribeSdkEvents` 為模組層單例，不分容器種類）。

## [1.4.1] - 2026-09-03

> **Patch，含 1 項新增 optional prop（additive、非 BREAKING）。** 兩項獨立修正：① 補齊
> `1.4.0`（R29 播放器手勢三度改版）design.md 當時刻意記錄的 Non-Goals 延後項——乾淨模式退出鈕
> 像素對齊設計稿；② `CollapsibleLivebuyPlayer` in-place 換片同步必填 `onVideoChanged` 回呼＋
> 新增 `openSignal` 機制，parity Android/iOS/Flutter。

### Added

- **`CollapsibleLivebuyPlayer` 新增選填 `openSignal` prop**（`number`，additive，省略等同
  `0`）——縮小播放器後，在浮動小卡狀態下換片再點回同一支影片時，可遞增此值觸發正確重新展開，
  對齊 Android/iOS 既有機制。

### Fixed

- 退出乾淨模式鈕 icon 改為 `DetailGlyph`（對齊設計稿 `Icons.detail`，24-viewBox、stroke 1.8，
  座標逐字對齊 iOS/Android 既有 `DetailGlyph` 常數），取代先前的純文字 `'✕'`。
- 退出鈕位置 `left` 由 `12` 修正為 `14`；`bottom` 改依 `model.isLive` 分流為 `16`（LIVE）／
  `52`（VOD/已結束直播回放），不再依賴進度條展開暫時墊高的 `scrubChromeLift`。
- **`CollapsibleLivebuyPlayer` in-place 換片原本只更新內部 `shownVideo`，不會通知必填的
  `onVideoChanged`**，host 若沒接選填的 `config.onVideoSwitchedItem` 會導致 session 狀態卡住
  （真實案例：輪播點回換片前的影片沒反應）——換片時額外呼叫 `onVideoChanged`（same-id guard
  防重複），並新增 `isInternalSwitchRef` latch + `shouldAutoRestoreOnBindingChange` 純函式，
  防止這個轉發誤觸浮動小卡狀態下的自動還原。

## [1.4.0] - 2026-09-03

> 這是 `livebuy-react-native-reference-ui` 套件（獨立 mirror repo + 獨立版號）自其 `1.3.0`
> 首次真實發版以來累積的內容，與 iOS/Android `v4.12.0`/`v4.13.0` 同一批主題（現正直播提示鈕、
> 活動入口分頁、播放器手勢三度改版 R29），詳見
> [`livebuy-ios-sdk/CHANGELOG.md`](../livebuy-ios-sdk/CHANGELOG.md#4130---2026-09-02)。**含 1
> 項 ⚠️ BREAKING**（reference-ui 內部行為契約，非公開 TS 型別簽章變更）——比照 iOS/Android/
> Flutter 對同一項變更的判定先例，仍發 **minor**（`1.3.0` → `1.4.0`）。
>
> ⚠️ **既有紀錄補正**（本次發版盤點時發現，非本輪造成）：`1.4.0` 對外發布時，這份
> `CHANGELOG.md` 因故仍停留在「Initial mirror repository staging」的佔位內容，未跟著同步
> 更新——本節內容是事後補記的正確 `1.4.0` 說明，於 `1.4.1` 發版時一併校正到位。

### Added

- **現正直播「前往直播」提示鈕（`LiveNowPillView`）** — 觀看 VOD / 已結束直播回放時，若偵測到
  同一頻道現正直播中，顯示提示鈕引導前往直播。
- **暫停覆蓋層＋靜音 toast＋雙擊送愛心延遲取消**（`PlaybackPausedOverlayView` /
  `GestureMuteToastView`）— 補建追平既有 iOS/Android 能力（R29 批次同批一併退役，見下方
  BREAKING）。
- **播放器手勢三度改版（R29）新增**：`cleanMode` 期間 `PlayerHeaderBarView` 新增靜音切換鈕；
  新增「退出乾淨模式」小圓鈕。
- **縮小按鈕 icon 放大 18 → 20px**，對齊設計稿。
- **`ActivitySheetView` 多活動分頁點＋滑動切換視覺** — 消費 `livebuy-react-native-ui@1.4.0`
  新曝露的完整活動清單＋分頁索引（見下方該套件的獨立版本項）；`FeedWinView` 相應調整。**本項
  要求 peerDependency `livebuy-react-native-ui` 至少 `1.4.0`**（1.3.0 缺對應資料 API）。

### Changed

- **⚠️ BREAKING（reference-ui 內部行為契約）— 播放器手勢觸發語意整個對調**：取代 R23 舊模型
  （長按=乾淨模式、單擊=依直播/VOD 切靜音或播放暫停）：短擊切換 `cleanMode`；雙擊（僅
  VOD/回放）依左右半螢幕 seek ±10 秒，雙擊送愛心整段退役；長按（僅 VOD/回放）近似 2 倍速
  快轉。中央暫停覆蓋層移除，播放/暫停改由播放進度條展開態上的小按鈕操作；商品袋按鈕縮小。
  **受影響對象**：直接呼叫已移除內部方法（非公開 API）的 host；走既有 `simulate*` 方法＋事件
  監聽的 host 不受影響。

### Fixed

- **`WinClaimSheetView` 領獎 modal 頂部禮物徽章換成白底圓＋雙色 SVG glyph 對齊設計稿**。
- **`ActivityEntryView` / `WinEntryView` 中獎/活動入口 icon 尺寸對齊設計稿 29pt**。
- **`FeedWinView` 活動入口 modal 加入 CTA 成功後自動關閉**，被閘攔截時維持開啟。
- **暫停覆蓋層吞噬觸控導致現正直播提示鈕點擊無反應修復**＋對齊設計稿縮小尺寸。

## [1.3.0] - 2026-09-01

### Added

First real release of the `livebuy-react-native-reference-ui` mirror repository. The one
pixel-rendering layer for the Livebuy React Native SDK — binds `livebuy-react-native-ui`'s
default template (view-model) to actual rendered UI components.
