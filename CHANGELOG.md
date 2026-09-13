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
