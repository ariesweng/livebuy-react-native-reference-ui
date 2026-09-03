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

（目前無待發項目——`1.4.1` 已於下方發布。）

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
