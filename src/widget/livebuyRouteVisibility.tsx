// livebuyRouteVisibility — host→SDK 的 **per-subtree** route 焦點信號（React context），
// 讓 widget 循環預覽知道「承載我的畫面是否被 host 導覽庫 push 上來的另一個畫面蓋住」
// （rb-rn-widget-preview-route-cover-release）。
//
// 為何是 context、不是既有的 process-global `LivebuyWidgetVisibility` 橋接：
//   • react-native core 沒有「被哪個畫面蓋住」的框架訊號——那是 react-navigation 這類 host
//     導覽庫的概念（`useIsFocused()`），而 `react-native-reference-ui` 的 peerDependencies 只有
//     react / react-native / react-native-svg / react-native-video、**沒有任何 navigation 依賴**。
//     所以 route 軸只能由 host 餵入（Flutter 有 `TickerMode` 框架訊號可自足偵測、RN 沒有）。
//   • 但它必須是 **per-subtree** 的：host 用 stack push 疊上第二個承載 widget 的畫面時，
//     前一頁的預覽要暫停（Android 上釋放解碼器），**新頁自己的卡片必須正常播**。
//     `LivebuyWidgetVisibility` 是 process-global 單一 level、`register` 立即 replay 當前值——
//     對「widget 蓋 widget」語意就是錯的（新頁的卡一掛載就被 replay 成 covered，結構上永遠不播；
//     Flutter sibling 在實機上證實了同一機制）。React context 天然 per-subtree：每個 Provider
//     只管自己的子樹，被 push 上去那頁沒有被包在前一頁的 Provider 裡，讀到的仍是預設 `true`。
//
// host 接線（react-navigation）——在承載 widget 的 screen 元件內：
//
//     import { useIsFocused } from '@react-navigation/native';
//     import { LivebuyRouteVisibilityContext, LivebuyWidget } from 'livebuy-react-native-reference-ui';
//
//     function HomeScreen() {
//       const focused = useIsFocused();
//       return (
//         <LivebuyRouteVisibilityContext.Provider value={focused}>
//           <LivebuyWidget shopId="Pw8PJ99J" />
//         </LivebuyRouteVisibilityContext.Provider>
//       );
//       // 或等價的單行寫法:<LivebuyWidget shopId="Pw8PJ99J" routeVisible={focused} />
//     }
//
// **不要**為 stack push 呼叫全域 `LivebuyWidgetVisibility.setWidgetsCovered(true)`——它會把被 push
// 上去那頁自己的預覽也蓋住。全域橋接只給**非 route 的 overlay**（collapsible presenter 的全螢幕
// 播放器、host 自製的 overlay）用。
//
// 未提供 Provider（或 `LivebuyWidget` 未給 `routeVisible`）時值為 `true` = 現況，向後相容：
// 統一閘第四軸 `routeVisible` 恆 true，行為與本 change 之前逐位元組相同。
//
// 值只表達「該子樹所在的 route 目前可見」；每支 `LoopingVideoView` 以 `useContext` 讀取後灌進
// `PreviewPlaybackController.setRouteVisible`，處置（Android 卸載 `<Video>` 釋放解碼器 / iOS
// keep-alive pause）由 `previewDecoderPolicy.ts` 決定，不在本檔。

import { createContext, useContext } from 'react';

/**
 * per-subtree route 焦點信號。`true`（預設）= 承載 widget 的畫面目前可見；`false` = 被 host
 * 導覽庫 push 上來的另一個畫面蓋住（react-navigation `useIsFocused()` 為 false）。host 以
 * `<LivebuyRouteVisibilityContext.Provider value={focused}>` 包住承載 widget 的子樹，或用
 * `LivebuyWidget` 的 `routeVisible` prop（等價的單行寫法）。
 */
export const LivebuyRouteVisibilityContext = createContext<boolean>(true);
LivebuyRouteVisibilityContext.displayName = 'LivebuyRouteVisibility';

/** 讀取當前子樹的 route 焦點信號（`useContext(LivebuyRouteVisibilityContext)` 的具名 hook）。 */
export function useLivebuyRouteVisible(): boolean {
  return useContext(LivebuyRouteVisibilityContext);
}
