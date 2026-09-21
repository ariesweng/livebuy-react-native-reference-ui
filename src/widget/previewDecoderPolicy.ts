// previewDecoderPolicy — widget 循環預覽在「所在 route 被蓋住」與「卡片離屏」時對解碼器的處置政策，
// 初始化 / 播放失敗的有上限重試退避表，以及離屏釋放 debounce / 捲動訊號節流的常數
// （RN，純模組，rb-rn-widget-preview-route-cover-release + rb-rn-widget-preview-offscreen-decoder-release）。
//
// RN parity of Flutter `previewDecoderPolicyFor(TargetPlatform)` / `previewInitRetryDelay(int)` /
// `previewOffScreenReleaseDelay()`（`flutter-reference-ui/lib/src/widget/looping_video_view.dart`，
// `rb-flutter-widget-preview-route-cover-release` + `rb-flutter-widget-preview-offscreen-decoder-release`）。
// 同一個政策同時管 route-cover 與 off-screen 兩軸（兩軸的理由是同一個：paused 的 `<Video>` 仍占解碼器，
// 平台分野也同一個），不另立第二個 policy。
//
// 為何 Android 是 `release`、其他平台是 `pause`：
//   • Android 上 `react-native-video`（6.19.2，`android/src/main/java/com/brentvatne/exoplayer/
//     ReactExoplayerView.java`）的 `onDetachedFromWindow()` 只 `cleanupPlaybackService()`、
//     `onHostPause` 只 `setPlayWhenReady(false)`——**都不釋放 player**；只有
//     `ReactExoplayerViewManager.onDropViewInstance` → `cleanUpResources()` → `releasePlayer()`
//     才 `player.release()` 放掉 ExoPlayer 與它占用的 `MediaCodec` 硬體解碼器。也就是一支 paused 的
//     `<Video>` 仍占一個硬體解碼器（與 Flutter `video_player` 相同），裝置解碼器實例有上限，
//     被 route 蓋住的首頁 N 支預覽會把被 push 上去那頁自己的卡片擠到初始化失敗。原生 Android
//     sample 是就地切換 surface、離開組合即 `exo.release()`——RN 要達到同樣的資源狀態只能
//     **卸載 `<Video>`**（條件式不渲染），route 回來再重新掛載（新的 native view）。
//   • iOS AVFoundation 沒有 `MediaCodec` 那種實例上限，且 iOS 原生 parity 來源
//     （`LoopingPlayerUIView`，`AVQueuePlayer`）在被 NavigationLink push 蓋住時只是暫停、不重載，
//     故 iOS 維持 `<Video>` 常駐、只由 `paused` 控制（keep-alive，逐字維持既有行為）。
//
// 純模組（不 import react-native / react-native-video）：可獨立單元測。呼叫端
// （`LoopingVideoView`）以 `Platform.OS` 餵入，測試以字串直接驅動。

/**
 * route 被蓋住（`routeVisible === false`）或卡片離屏（自 `rb-rn-widget-preview-offscreen-decoder-release`
 * 起）時對該卡 `<Video>` 的處置：
 * - `'release'`：不渲染 `<Video>`（卸載 → 原生 `onDropViewInstance` 釋放 ExoPlayer / 解碼器），
 *   route 回來 / 滾回可見時重新掛載；從未量到在螢幕上的卡從不掛載。route-cover 釋放立即，
 *   離屏釋放經 {@link previewOffScreenReleaseDelayMs} debounce。
 * - `'pause'`：`<Video>` 常駐，只由統一閘的 `paused` 控制（keep-alive）。
 */
export type PreviewDecoderPolicy = 'release' | 'pause';

/** `'android'` → `'release'`；其他（`'ios'` / `'web'` / `'windows'` / `'macos'` …）→ `'pause'`。 */
export function previewDecoderPolicyFor(os: string): PreviewDecoderPolicy {
  return os === 'android' ? 'release' : 'pause';
}

/** 有上限重試的退避表（毫秒）：第 0 次失敗後 500、第 1 次後 1000、第 2 次後 2000，之後放棄。 */
export const PREVIEW_INIT_RETRY_DELAYS_MS: readonly number[] = [500, 1000, 2000];

/**
 * 第 `attempt` 次失敗（0-based）後，距下一次重新掛載 `<Video>` 的延遲；`null` = 超過上限、放棄
 * （維持不渲染，`CarouselCardView` 的 placeholder 透出）。負值 / 非整數 → `null`。
 *
 * 用途：react-navigation push / pop 時新舊畫面在同一個 commit 內 mount / unmount，解碼器釋放與
 * 配置順序不保證——另一頁尚未釋放時新頁的卡會撞解碼器上限，退一小段再試即可成功；總計最多
 * 3 次重試（500 + 1000 + 2000 = 3.5 s），對壞 URL 這類非資源類失敗亦有上限、無害。
 */
export function previewInitRetryDelayMs(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 0) return null;
  return PREVIEW_INIT_RETRY_DELAYS_MS[attempt] ?? null;
}

/**
 * `'release'` 政策下，卡片量到離屏後距釋放 `<Video>`（卸載）的 debounce 延遲（毫秒）：1000。
 * 期間量回可見即取消、`<Video>` 不動（同一個元素、不重掛）；到期仍離屏才卸載。
 *
 * 取捨（對齊 Flutter `previewOffScreenReleaseDelay()` = 1 s）：捲動訊號以 {@link previewScrollSignalThrottleMs}
 * 節流、慢速來回捲動不該 create / drop 抖動；但整台裝置的硬體解碼器預算只有十來個，太長會讓正在滾入
 * 的卡撞上限。一次長 fling 的暫時超額由既有 `onError` 有上限重試吸收，滾停後一秒內回到預算內。
 * route-cover 的釋放維持立即、不經此 debounce。
 */
export function previewOffScreenReleaseDelayMs(): number {
  return 1000;
}

/**
 * reference-ui 自己的 scroll 容器（`ScrollableVideoShopView`、`Carousel` 的 `scrollable` 分支）把
 * `onScroll` 轉為捲動訊號（`LivebuyPreviewScrollSignalContext`）的 JS 端節流間隔（毫秒）：100——
 * 距上次 emit 未滿此值的 `onScroll` 不 emit；`onScrollEndDrag` / `onMomentumScrollEnd` 不受節流、
 * 結束時一定 emit（讓捲停後的最終可見性必被重量）。`scrollEventThrottle={16}` 下每秒最多約 60 個
 * 原生事件，節流成每秒最多 10 次 N 張卡的 `measureInWindow` 往返。
 */
export function previewScrollSignalThrottleMs(): number {
  return 100;
}
