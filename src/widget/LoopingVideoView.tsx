import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactElement,
} from 'react';
import { AppState, Dimensions, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';

import { LBTestIDs } from '../testing/LBTestIDs';
import { LivebuyWidgetVisibility } from './livebuyWidgetVisibility';
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
//     (無 `FlatList` 的 `onViewableItemsChanged` 可借),故 turnkey scrollable 面「捲動當下」
//     的可見性變化需 host 提供 scroll 信號或改用 lazy 面才精準。主案(default plain-View 面
//     的靜態 overflow 離屏卡、初始離屏)由 `onLayout` 量測涵蓋。誠實標明,不誇大。
//   • widget 預覽**永不是** PiP 內容(全螢幕 player / PiP 走 core),故不需、也不加 PiP guard。

/** 讀取當前 App 前景狀態(`AppState.currentState` 可能為 null,保守視為前景)。 */
function isForegroundNow(): boolean {
  return AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
}

export function LoopingVideoView(props: { uri: string; borderRadius?: number }): ReactElement {
  const { uri, borderRadius = 0 } = props;

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
    });
  }

  // 離屏軸:量測卡片容器的 window-relative frame,交 window 判可見性 → 灌進 gate。
  const measure = useCallback((): void => {
    const node = containerRef.current;
    if (node == null) return;
    node.measureInWindow((x, y, width, height) => {
      const win = Dimensions.get('window');
      gateRef.current?.setOnScreen(
        isCardOnScreen(
          { x, y, width, height },
          { x: 0, y: 0, width: win.width, height: win.height },
        ),
      );
    });
  }, []);

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

  // URL 變:對新來源以當下 `foreground && onScreen && notCovered` 決策重套一次(不誤播
  // 離屏/背景/已被覆蓋卡)。
  useEffect(() => {
    gateRef.current?.reapply();
  }, [uri]);

  // 覆蓋軸(host opt-in,rn-refui-widget-host-visibility-pause):訂閱 `LivebuyWidgetVisibility`
  // 把 host 餵入的覆蓋信號接進 gate 第三軸 `notCovered`。register 當下會**立即 replay** 當前
  // covered(有狀態 level 橋接),使掛載時若已覆蓋即先暫停;卸載時 unregister。host 不接時
  // 從不觸發,`notCovered` 恆 true → gate 退化為現況(向後相容)。
  useEffect(() => {
    const listener = (covered: boolean): void => {
      gateRef.current?.setNotCovered(!covered);
    };
    LivebuyWidgetVisibility.register(listener);
    return () => {
      LivebuyWidgetVisibility.unregister(listener);
    };
  }, []);

  return (
    <View ref={containerRef} onLayout={measure} style={StyleSheet.absoluteFill}>
      <Video
        testID={LBTestIDs.loopingPreview}
        source={{ uri }}
        repeat
        muted
        paused={paused}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />
    </View>
  );
}
