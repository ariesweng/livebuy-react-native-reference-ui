import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactElement,
} from 'react';
import { AppState, Dimensions, Platform, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';

import { LBTestIDs } from '../testing/LBTestIDs';
import { LivebuyPreviewScrollSignalContext } from './livebuyPreviewScrollSignal';
import { LivebuyRouteVisibilityContext } from './livebuyRouteVisibility';
import { LivebuyWidgetVisibility } from './livebuyWidgetVisibility';
import {
  previewDecoderPolicyFor,
  previewInitRetryDelayMs,
  previewOffScreenReleaseDelayMs,
} from './previewDecoderPolicy';
import { PreviewPlaybackController, isCardOnScreen } from './previewPlaybackController';

// MARK: - LoopingVideoView (rb-rn-widget-card-looping-preview)
//
// RN parity of iOS `LoopingVideoView` (`AVQueuePlayer` + `AVPlayerLooper`) / Android media3
// `LoopingVideoView`. A muted, control-free, infinitely-looping video that fills its parent
// (`resizeMode="cover"` = resizeAspectFill). Used by `CarouselCardView` for the live card
// `LBVideoItem.preview` animated thumbnail.
//
// `react-native-video` is a host-supplied peerDependency (the dev sandbox resolves a stub via
// tsconfig `paths` + jest `moduleNameMapper`; real consumers resolve the native module).
//
// MARK: - BACKGROUND / OFF-SCREEN DECODE STOP (rn-refui-widget-preview-lifecycle-pause)
//
// 此前 `<Video>` 硬寫 `paused={false}` —— 一支預覽從掛載到卸載**無條件**全速硬解;widget
// 又刻意用非-lazy 的 plain `View` Row / Column(golden 決定性,禁 `FlatList`/`ScrollView`
// 於快照面),故:
//   (A) App 進背景:仍持續解碼。react-native-video 的 `playInBackground` 預設 `false`,native
//       端(iOS AVFoundation / Android ExoPlayer)通常在 App 背景時暫停播放,故 (A) 多半已由
//       library 大致涵蓋;此處加 `AppState` gate 屬**明確化 + 對齊** Android/Flutter/iOS parity
//       (涵蓋 library 未暫停的邊界,且與離屏軸摺成單一閘)。
//   (B) 卡滾出 viewport(真缺口,重點):非-lazy 容器不回收,離屏卡仍掛載仍解碼。一個 N 支
//       live 預覽的清單 = N 支解碼器空燒,與 Android 消費端實機量到的背景 ~150% CPU 同源。
//
// 修法(對齊 iOS/Flutter/Android 的「widget 預覽半」單一 gate):兩軸合成「foreground ∧
// onScreen 才播」→ `paused = !(foreground && onScreen)`,由單一 `PreviewPlaybackController`
// edge-triggered 命令式驅動(`onPlay`/`onPause` → `setPaused(false/true)`)。**刻意用單一
// controller 而非兩個獨立 observer**:否則回前景會誤喚醒仍滾出螢幕的卡。
//   • 背景軸 `AppState`:`active` → 前景;`background` / `inactive` → 暫停。
//   • 離屏軸:RN 內建量測 —— 卡片容器 `onLayout` 時 `measureInWindow` 取 window-relative
//     frame,與 `Dimensions.get('window')` 求交(`isCardOnScreen`),對齊 Android
//     `boundsInWindow` window-based 語意。不引入重的第三方 viewability 依賴。
//   • `reapply()`:`<Video>` 掛載 / URL 變後以當下 `foreground && onScreen` 決策套用一次,
//     取代原無條件 `paused={false}`,使離屏 / 背景時掛載的卡不誤播。
//
// 誠實限制(對齊四端的 host 待辦文化):
//   • **切 tab 覆蓋**:host 把首頁 widget 留在畫面、僅以另一畫面**覆蓋**它時,卡仍 laid-out、
//     window frame 仍與 window 重疊、App 仍 active —— `measureInWindow` 偵測不到「被覆蓋」
//     (z-order 覆蓋只有 host 導航層知道)。此殘餘漏洞由 opt-in 橋接 `LivebuyWidgetVisibility`
//     (rn-refui-widget-host-visibility-pause,鏡像 Android)補起:host 一行
//     `LivebuyWidgetVisibility.setWidgetsCovered(true/false)` 餵入覆蓋信號 → play-gate 第三軸
//     `notCovered` → 被覆蓋的預覽暫停;**host 不接時仍偵測不到(向後相容,不宣稱涵蓋)**。
//   • **scroll-without-relayout**:RN 內建 `onLayout` 不會因祖先 `ScrollView` 捲動而重發
//     (無 `FlatList` 的 `onViewableItemsChanged` 可借)。自 rb-rn-widget-preview-offscreen-decoder-
//     release 起,**reference-ui 自己持有的 scroll 容器**(`ScrollableVideoShopView` Grid、`Carousel`
//     的 `scrollable` 分支)以 `LivebuyPreviewScrollSignalContext` 發捲動訊號、本元件訂閱後重量
//     (見下方 OFF-SCREEN DECODER RELEASE 段),turnkey 面「捲動當下」的可見性變化已涵蓋。**仍是
//     誠實限制的部分**:windowed carousel / `CarouselRowView` 是 plain Row、真正的捲動由 **host 的**
//     `ScrollView` 負責,reference-ui 拿不到那些捲動事件——host 未以同一 context 餵入時仍只在
//     layout 時量、離屏卡不會被釋放(與現況相同);巢狀子 viewport 以 window 為基準判 on-screen
//     的限制亦不變。主案(default plain-View 面的靜態 overflow 離屏卡、初始離屏)由 `onLayout`
//     量測涵蓋。誠實標明,不誇大。
//   • widget 預覽**永不是** PiP 內容(全螢幕 player / PiP 走 core),故不需、也不加 PiP guard。
//
// MARK: - AUDIO FOCUS (rb-rn-widget-preview-no-audio-focus)
//
// Android 上 `react-native-video`(6.19.2,`android/src/main/java/com/brentvatne/exoplayer/
// ReactExoplayerView.java`)預設把每個 `<Video>` 當成會出聲的播放器:`setPlayWhenReady(true)` 先走
// `requestAudioFocus()` —— 只有 `disableFocus || source.getUri() == null || hasAudioFocus` 才跳過,
// **不看 `muted`** —— 向 `AudioManager.requestAudioFocus(listener, STREAM_MUSIC, AUDIOFOCUS_GAIN)`
// 要 focus;收到 `onAudioFocusChange(AUDIOFOCUS_LOSS)` 則 `hasAudioFocus = false` + `pausePlayback()`
// + `abandonAudioFocus`。widget 輪播 / Grid 是非-lazy 的 plain View,N 張帶 `preview` 的卡同時
// `paused=false`,每張的 focus 請求都把前一張踢成 LOSS → 暫停,最後只剩最後一張在動、其餘停在第一幀。
// Flutter sibling(`rb-flutter-widget-preview-no-audio-focus`)已在 SM-G887F 實機證實同一機制:logcat
// `MediaFocusControl` 對 example uid 記到 9 次 `requestAudioFocus()`(兩次量測各派送 9 / 8 次
// `AUDIOFOCUS_LOSS`),改為不請求 focus 後 0 次、首頁輪播全部持續播放。RN 是同款機制的另一個實作,
// 屬**靜態判定**(測試機未裝 RN sample,見 change tasks 3.1),不宣稱真機驗過。原生 parity 來源從不
// 請求 focus:Android `LoopingVideoView.kt`(ExoPlayer 預設 `handleAudioFocus = false`)、iOS
// `LoopingPlayerUIView`(`AVQueuePlayer`,無 per-player focus)。
//
// 修法:`<Video disableFocus={Platform.OS === 'android'}>`。`disableFocus` 是 RNV 對 Android focus
// 仲裁的唯一開關(`@ReactProp(name = "disableFocus", defaultBoolean = false)` → `setDisableFocus`),
// 為 true 時 `requestAudioFocus()` 直接回 true、不向 `AudioManager` 請求,預覽也就不會因 LOSS 被
// `pausePlayback()`。**只在 Android**:RNV 6.19.2 把此 prop 標為 Android-only(`src/specs/
// VideoNativeComponent.ts` 註記 `// android`;`ios/` 端無任何 focus 處理、完全忽略此 prop),iOS 今日
// 亦無此症狀,以平台分流讓 iOS 明確傳 `false`(= 改動前行為,也讓測試能鎖住兩個分支;若未來 RNV 替
// iOS 賦予語意亦不會被意外打開)。既有 `paused` 三軸閘門、`repeat` / `muted` / `resizeMode="cover"` /
// `testID` 全部不動。
//
// MARK: - ROUTE COVER (rb-rn-widget-preview-route-cover-release)
//
// 上面「切 tab 覆蓋」段講的殘餘漏洞,對 **stack / route push**(host 用 react-navigation 把另一個
// 畫面 push 到承載 widget 的畫面之上)這個最常見的情境,用 process-global 橋接
// `LivebuyWidgetVisibility.setWidgetsCovered(true)` 去補是**錯的**:橋接是單一 level、`register` 立即
// replay 當前值,被 push 上去那頁若自己也承載 widget(「查看更多」Grid 頁),它的卡一掛載就被 replay 成
// covered → `reapply()` 走 pause,結構上永遠不播。Flutter sibling(`rb-flutter-widget-preview-route-
// cover-release`)在 SM-G887F 實機證實了這個機制;Flutter 用框架訊號 `TickerMode` 自足偵測 opaque route,
// 但 react-native core 沒有這種訊號——「被哪個畫面蓋住」是 react-navigation 的概念,而本套件的
// peerDependencies 沒有任何 navigation 依賴。所以 RN 的 route 軸只能由 host 餵入,但必須是
// **per-subtree**(React context `LivebuyRouteVisibilityContext`,見 `livebuyRouteVisibility.tsx`;
// `LivebuyWidget` 的 `routeVisible` prop 是等價的單行寫法),不是 process-global:
//   • 第四軸 `routeVisible`:`useContext(LivebuyRouteVisibilityContext)` → `gate.setRouteVisible`,
//     `shouldPlay = foreground && onScreen && notCovered && routeVisible`,edge-triggered 與其他軸一致;
//     建構 gate 時以掛載當下的 context 值 seed(route-hidden 期間才掛載的卡不誤播)。未提供 Provider
//     時預設 `true` = 現況,向後相容。
//   • Android `release` 政策(`previewDecoderPolicyFor(Platform.OS)`,見 `previewDecoderPolicy.ts`):
//     `routeVisible === false` 時**不渲染 `<Video>`**。RNV 6.19.2 Android 的 `onDetachedFromWindow()`
//     只 `cleanupPlaybackService()`、`onHostPause` 只 `setPlayWhenReady(false)`,paused 的 `<Video>` 仍占
//     一個 `MediaCodec` 硬體解碼器;只有 `ReactExoplayerViewManager.onDropViewInstance` →
//     `cleanUpResources()` → `releasePlayer()` 才釋放——所以 RN 上「釋放解碼器」= 卸載 `<Video>`
//     (對齊原生 Android sample 就地切換 surface → `onDispose { exo.release() }`)。容器 `View` 與
//     `onLayout` 量測保留(`CarouselCardView` 底下本來就有恆常的深色 placeholder,透出即可);route
//     回來時重新渲染 `<Video>`(新的 native view,掛載後由 `gate.reapply()` 依當下四軸決定 `paused`)。
//   • iOS `pause` 政策:`<Video>` 常駐、只由 `paused` 控制(逐字維持現況,不重載;AVFoundation 無
//     解碼器實例上限,原生 `LoopingPlayerUIView` 被 push 蓋住時也只是暫停)。
//   • 橋接 `notCovered` 軸(非 route overlay)在**所有平台**維持只 pause、不卸載——release 只屬於 route 軸
//     (與下方 OFF-SCREEN 段的離屏軸)。
//   • 有上限的錯誤重試(`release` 政策且 route 可見;離屏軸的互動見 OFF-SCREEN 段):`<Video onError>` → 卸載該 `<Video>`(釋放半建立
//     的 ExoPlayer),依 `previewInitRetryDelayMs(attempt)`(500 / 1000 / 2000 ms,之後放棄)以
//     `setTimeout` 排重新掛載(遞增 `key` 讓 React 建全新 native view);`onLoad` 成功 → 失敗計數歸零;
//     元件卸載 / route 變 hidden / `uri` 變更時 `clearTimeout` 並重開世代(計數歸零);超過上限維持
//     不渲染(placeholder 透出)。用途:react-navigation push / pop 時新舊畫面在同一個 commit 內
//     mount / unmount,解碼器釋放與配置順序不保證,另一頁尚未釋放時新頁會撞解碼器上限。`pause`
//     政策(iOS)不掛 `onError` / `onLoad`、不重試,`<Video>` props 逐字不變。
//   • 靜態判定:測試機未裝 RN sample,本段以 RNV 原始碼路徑 + jest 為證,不宣稱真機驗過。
//
// MARK: - OFF-SCREEN DECODER RELEASE (rb-rn-widget-preview-offscreen-decoder-release)
//
// ROUTE COVER 段修好「首頁被 push 蓋住時釋放解碼器」後的**殘餘**:`<Video>` 仍在**掛載時**就建、
// 離屏只 `paused`——而 paused 的 `<Video>` 仍持有一個 `MediaCodec`(見 ROUTE COVER 段的 RNV 路徑)。
// 「查看更多」Grid(`ScrollableVideoShopView` → `VideoShopGrid` render-ALL、非 lazy)第一頁 9 張、
// load-more 一次 18 張,全部同時持有解碼器;首頁 turnkey 輪播 9 張只有 3 張可見、6 張離屏各占一個。
// Flutter sibling(`rb-flutter-widget-preview-offscreen-decoder-release`,**語意基準**)在 SM-G887F
// 實機量到:18 張時解碼器初始化失敗 log 123 行、27 張時全部凍結(6 個可見區塊像素變化 0.00%);修後
// 首頁只建可見 3 支、load-more 兩次後失敗 log 0 行。RN 結構相同(`react-native-video` paused 仍占
// 解碼器)、sample shop 65 支幾乎全有 preview,故為**靜態判定**(測試機未裝 RN sample,不宣稱真機驗過)。
//
// 修法(Android `release` 政策;iOS `pause` 政策 `<Video>` 常駐、只 `paused`,逐字不變):
//   • **捲動訊號**(`livebuyPreviewScrollSignal.tsx`):reference-ui 自己的 scroll 容器發、本元件訂閱
//     `LivebuyPreviewScrollSignalContext`,每次 emit 重新 `measureInWindow`(`onLayout` 量測保留)。
//     `measureInWindow` 是非同步 native 呼叫,卸載後才落地的回呼以 `mountedRef` 擋掉。
//   • **離屏軸三態** `onScreen: boolean | null`:`null` = 尚未量到有效(非零面積)frame——不算離屏、
//     不排釋放、也不掛載;`true` = 已知在螢幕上(持有 / 允許持有解碼器);`false` = 離屏 debounce 到期
//     已釋放。`videoRendered = policy === 'pause' || (routeVisible && onScreen === true && !suspended)`
//     ——從未量到可見的卡(Grid 第三列以下、load-more 新增的卡)從不渲染 `<Video>`。播放閘的離屏軸
//     另行每次量測即時餵入(`gate.setOnScreen`,零面積依 `isCardOnScreen` 視為離屏 → pause,維持既有語意)。
//   • **離屏 debounce 釋放**:`onScreen` 為 true 的卡量到離屏 → 排 `setTimeout(previewOffScreenReleaseDelayMs())`
//     (1000 ms);到期且仍離屏 → 釋放:不渲染 `<Video>`(卸載 → `onDropViewInstance` → `releasePlayer()`)、
//     取消 pending retry、失敗計數歸零、`onScreen = false`。到期前量回可見 → 取消 timer、`<Video>` 不動
//     (同一個元素、不重掛)。釋放後滾入 → `onScreen = true` + 遞增 `generation`(新 `key` 世代、全新
//     native view,掛載後 `gate.reapply()`),失敗計數從 0 起算。route-hidden 的釋放維持**立即**(ROUTE
//     COVER 段行為不變);橋接 `notCovered` 軸仍只 pause、不卸載。
//   • **與重試的關係**:離屏 debounce 待釋放期間到期的重試**不掛載**(記為 deferred),滾回可見時才以新
//     世代補掛;到期釋放則連同 deferred 一併清掉。
//   • 取捨 1000 ms:捲動訊號 100 ms 節流下慢速來回不該 create / drop 抖動;整台裝置解碼器預算只有十來個,
//     太長會讓正在滾入的卡撞上限。一次長 fling 的暫時超額由既有 `onError` 有上限重試吸收。
//   • iOS(`pause` 政策)訂閱捲動訊號後的重量只讓 `paused` 更準(捲動當下離屏即暫停),不卸載、不排任何
//     timer,`<Video>` props 逐字不變。

/** 讀取當前 App 前景狀態(`AppState.currentState` 可能為 null,保守視為前景)。 */
function isForegroundNow(): boolean {
  return AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
}

export function LoopingVideoView(props: { uri: string; borderRadius?: number }): ReactElement {
  const { uri, borderRadius = 0 } = props;

  // route 軸(host 餵入,per-subtree;未提供 Provider 時 true = 現況)、捲動訊號(reference-ui 自己的
  // scroll 容器提供;未提供時為永不發的 no-op source = 只在 layout 時量)與解碼器政策(Android → release:
  // route-hidden / 離屏釋放時卸載 `<Video>`;其他 → pause:keep-alive)。見檔頭 ROUTE COVER / OFF-SCREEN 段。
  const routeVisible = useContext(LivebuyRouteVisibilityContext);
  const scrollSignal = useContext(LivebuyPreviewScrollSignalContext);
  const policy = previewDecoderPolicyFor(Platform.OS);

  // 單一 gate 命令式驅動 `<Video>` 的 `paused`(取代硬寫 `paused={false}`)。
  // 容器 ref 供 `measureInWindow` 取 window-relative frame(離屏軸,RN 內建量測)。
  const [paused, setPaused] = useState<boolean>(() => !isForegroundNow());
  const containerRef = useRef<ComponentRef<typeof View> | null>(null);
  const gateRef = useRef<PreviewPlaybackController | null>(null);
  if (gateRef.current == null) {
    gateRef.current = new PreviewPlaybackController({
      onPlay: () => setPaused(false),
      onPause: () => setPaused(true),
      foreground: isForegroundNow(),
      onScreen: true, // 樂觀種子;首次 measureInWindow 即時校正離屏軸。
      routeVisible, // 掛載當下的 context 值:route-hidden 期間才掛載的卡不誤播(reapply 走 pause)。
    });
  }

  // 解碼器世代(release 政策的 route 覆蓋釋放 + 有上限重試):
  //   • `generation`:`<Video key>`,每次重試重新掛載時遞增 → React 建全新 native view(全新 ExoPlayer)。
  //   • `suspended`:true = 失敗後等待重試中、或已放棄 → 不渲染 `<Video>`(placeholder 透出)。
  //   • `attemptsRef`:本世代連續失敗次數(`onLoad` 成功歸零);`retryTimerRef`:待執行的重試 timer。
  const [generation, setGeneration] = useState(0);
  const [suspended, setSuspended] = useState(false);
  const attemptsRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelRetry = useCallback((): void => {
    if (retryTimerRef.current != null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // 離屏解碼器軸(release 政策;見檔頭 OFF-SCREEN DECODER RELEASE 段):
  //   • `onScreen` 三態:null = 尚未量到有效(非零面積)frame;true = 已知在螢幕上(持有 / 允許持有
  //     解碼器);false = 離屏 debounce 到期已釋放。驅動 `<Video>` 是否在樹上(`videoRendered`)。
  //   • `onScreenRef`:同值鏡像,供 timer / 量測回呼讀(closure 不讀舊 state)。
  //   • `offScreenTimerRef`:待執行的離屏釋放;`deferredRemountRef`:離屏 debounce 期間到期而未掛載
  //     的重試,滾回可見時補掛;`mountedRef`:擋掉卸載後才落地的 `measureInWindow` 非同步回呼。
  const [onScreen, setOnScreenState] = useState<boolean | null>(null);
  const onScreenRef = useRef<boolean | null>(null);
  const offScreenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredRemountRef = useRef(false);
  const mountedRef = useRef(false);

  const setOnScreenAxis = useCallback((value: boolean | null): void => {
    onScreenRef.current = value;
    setOnScreenState(value);
  }, []);

  const cancelOffScreenRelease = useCallback((): void => {
    if (offScreenTimerRef.current != null) {
      clearTimeout(offScreenTimerRef.current);
      offScreenTimerRef.current = null;
    }
  }, []);

  // 離屏 debounce 到期:仍掛載且仍持有 → 釋放(不渲染 `<Video>` → 原生 onDropViewInstance 釋放解碼器)、
  // 取消 pending retry、失敗計數歸零、解除 suspended / deferred(下一世代從乾淨狀態起算)。
  const onOffScreenReleaseDue = useCallback((): void => {
    offScreenTimerRef.current = null;
    if (!mountedRef.current || onScreenRef.current !== true) return;
    cancelRetry();
    attemptsRef.current = 0;
    deferredRemountRef.current = false;
    setSuspended(false);
    setOnScreenAxis(false);
  }, [cancelRetry, setOnScreenAxis]);

  // 量到離屏:只在有東西可釋放(`onScreen === true`)且尚未排程時排 debounce。
  const scheduleOffScreenRelease = useCallback((): void => {
    if (onScreenRef.current !== true || offScreenTimerRef.current != null) return;
    offScreenTimerRef.current = setTimeout(onOffScreenReleaseDue, previewOffScreenReleaseDelayMs());
  }, [onOffScreenReleaseDue]);

  // 量到可見:取消 debounce;已持有 → `<Video>` 不動(同一元素),只補掛 debounce 期間被延後的重試;
  // 首次可見 → 掛載;釋放後滾入 → 遞增世代(新 key → 全新 native view)再掛載。
  const noteOnScreen = useCallback((): void => {
    cancelOffScreenRelease();
    if (onScreenRef.current === true) {
      if (deferredRemountRef.current) {
        deferredRemountRef.current = false;
        setGeneration((g) => g + 1);
        setSuspended(false);
      }
      return;
    }
    const wasReleased = onScreenRef.current === false;
    setOnScreenAxis(true);
    if (wasReleased) setGeneration((g) => g + 1);
  }, [cancelOffScreenRelease, setOnScreenAxis]);

  // 離屏軸:量測卡片容器的 window-relative frame,交 window 判可見性 → 灌進 gate(每次量測即時餵,
  // 零面積依 `isCardOnScreen` 視為離屏 → pause,維持既有語意);release 政策再更新解碼器軸——零面積
  // (尚未 layout)不算離屏:不排釋放、也不掛載,維持原狀。`onLayout` 與捲動訊號 emit 都走這裡。
  const measure = useCallback((): void => {
    const node = containerRef.current;
    if (node == null) return;
    node.measureInWindow((x, y, width, height) => {
      if (!mountedRef.current) return;
      const win = Dimensions.get('window');
      const visible = isCardOnScreen(
        { x, y, width, height },
        { x: 0, y: 0, width: win.width, height: win.height },
      );
      gateRef.current?.setOnScreen(visible);
      if (policy !== 'release') return;
      if (width <= 0 || height <= 0) return;
      if (visible) {
        noteOnScreen();
      } else {
        scheduleOffScreenRelease();
      }
    });
  }, [policy, noteOnScreen, scheduleOffScreenRelease]);

  // 掛載旗標(宣告在首次量測之前,使掛載當下的 measureInWindow 回呼不被擋);卸載時連同離屏 debounce 一併取消。
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelOffScreenRelease();
    };
  }, [cancelOffScreenRelease]);

  // 背景軸:AppState;掛載時 reapply 一次把當下 desired 套到 `<Video>`,並做首次量測。
  useEffect(() => {
    const gate = gateRef.current;
    const sub = AppState.addEventListener('change', (state) => {
      gate?.setForeground(state === 'active');
    });
    gate?.reapply();
    measure();
    return () => {
      sub.remove();
    };
  }, [measure]);

  // 捲動訊號(reference-ui 自己的 scroll 容器發;預設 no-op source 永不發):每次 emit 重新量測。
  useEffect(() => scrollSignal.subscribe(measure), [scrollSignal, measure]);

  // route 軸:context 值變 → gate 第四軸(edge-triggered;掛載時與 seed 同值 → 無事)。
  // 宣告在 reapply effect 之前,使同一個 commit 內 gate 先吃到新 route 值再重套。
  useEffect(() => {
    gateRef.current?.setRouteVisible(routeVisible);
  }, [routeVisible]);

  // 世代重開:`uri` 變更 / route 軸翻轉 → 取消待執行重試、失敗計數歸零、解除 suspended / deferred
  // (route 回來或換來源時從乾淨世代起算);元件卸載亦取消 timer(pending retry 不得在卸載後觸發)。
  // 離屏 debounce timer 不在此取消:route-hidden 期間到期照樣把離屏軸落成 false(卡本來就已離屏)。
  useEffect(() => {
    cancelRetry();
    attemptsRef.current = 0;
    deferredRemountRef.current = false;
    setSuspended(false);
    return cancelRetry;
  }, [uri, routeVisible, cancelRetry]);

  // `<Video>` 是否在樹上:pause 政策(iOS)恆常駐;release 政策(Android)只在 route 可見、離屏軸
  // 已知在螢幕上(`onScreen === true`;null = 從未量到可見 → 從不掛載,false = 離屏已釋放)且非
  // suspended 時渲染——route-hidden / 離屏釋放 = 卸載釋放解碼器,失敗等待重試 / 已放棄 = placeholder 透出。
  const videoRendered = policy === 'pause' || (routeVisible && onScreen === true && !suspended);

  // `<Video>` 掛載 / URL 變 / 重試、route 回來或離屏釋放後滾入重新掛載後:對(新的)native view 以當下
  // `foreground && onScreen && notCovered && routeVisible` 決策重套一次(不誤播離屏 / 背景 /
  // 已被覆蓋 / route-hidden 卡)。
  useEffect(() => {
    if (videoRendered) gateRef.current?.reapply();
  }, [uri, generation, videoRendered]);

  // 覆蓋軸(host opt-in,rn-refui-widget-host-visibility-pause):訂閱 `LivebuyWidgetVisibility`
  // 把 host 餵入的覆蓋信號接進 gate 第三軸 `notCovered`。register 當下會**立即 replay** 當前
  // covered(有狀態 level 橋接),使掛載時若已覆蓋即先暫停;卸載時 unregister。host 不接時
  // 從不觸發,`notCovered` 恆 true → gate 退化為現況(向後相容)。此軸在所有平台只 pause、
  // 不卸載 `<Video>`(release 只屬於 route 軸與離屏軸)。
  useEffect(() => {
    const listener = (covered: boolean): void => {
      gateRef.current?.setNotCovered(!covered);
    };
    LivebuyWidgetVisibility.register(listener);
    return () => {
      LivebuyWidgetVisibility.unregister(listener);
    };
  }, []);

  // 有上限重試(release 政策;`<Video>` 只在 route 可見且離屏軸已知在螢幕上時渲染,故此處必為兩者皆成立):
  // 卸載失敗的 `<Video>`(→ 原生 onDropViewInstance → releasePlayer()),依退避表排重新掛載;
  // 超過上限維持不渲染。到期時若離屏 debounce 待釋放中 → 不掛載(記為 deferred,滾回可見時補掛;
  // 到期釋放則一併清掉)。`onLoad` 成功 → 本世代失敗計數歸零。
  const onVideoError = useCallback((): void => {
    const delay = previewInitRetryDelayMs(attemptsRef.current);
    attemptsRef.current += 1;
    cancelRetry();
    setSuspended(true);
    if (delay == null) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (offScreenTimerRef.current != null) {
        deferredRemountRef.current = true;
        return;
      }
      setGeneration((g) => g + 1);
      setSuspended(false);
    }, delay);
  }, [cancelRetry]);
  const onVideoLoad = useCallback((): void => {
    attemptsRef.current = 0;
  }, []);

  return (
    <View ref={containerRef} onLayout={measure} style={StyleSheet.absoluteFill}>
      {videoRendered ? (
        <Video
          key={generation}
          testID={LBTestIDs.loopingPreview}
          source={{ uri }}
          repeat
          muted
          paused={paused}
          resizeMode="cover"
          // Android:不參與 audio focus 仲裁(見檔頭 AUDIO FOCUS 段);iOS 傳 false = 改動前現況。
          disableFocus={Platform.OS === 'android'}
          // release 政策(Android)才掛失敗重試 / 成功歸零;pause 政策(iOS)不掛 → props 逐字不變。
          onError={policy === 'release' ? onVideoError : undefined}
          onLoad={policy === 'release' ? onVideoLoad : undefined}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      ) : null}
    </View>
  );
}
