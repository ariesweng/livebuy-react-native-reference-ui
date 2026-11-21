// livebuyPlayerSession — reference-ui 內部的「Livebuy 播放器 session 進行中」訊號
// (rb-rn-widget-preview-pip-unmount, reference-ui layer).
//
// ─── 病根 ────────────────────────────────────────────────────────────────────
// Android 上 `react-native-video`(6.19.2)每個 `<Video>` 在 player 初始化時**無條件**向 Activity
// 註冊 PiP 模式監聽(`ReactExoplayerView.java` `initializePlayer` →
// `PictureInPictureUtil.addLifecycleEventListener`),沒有任何 prop 能關掉。App 進 PiP 時每個實例都
// 呼叫 `setIsInPictureInPicture(true)`:把自己的影片 view 搬到 `android.R.id.content` 撐滿、把其他子
// view 設為 GONE 並記下原可見度;離開 PiP 時再依記錄還原。多個實例同時做會互相搶,於是:
//   • drop-in 播放器播放中按 Home → PiP 視窗顯示的是 widget 卡片的**預覽影片**;
//   • 點 PiP 回 App → 還原時可見度清單長度對不上 → `IndexOutOfBoundsException` 閃退。
// `paused` 救不了(監聽仍在)。只有**卸載** `<Video>` 會走 `onDropViewInstance` →
// `cleanUpResources()` → `releasePlayer()` → `pipListenerUnsubscribe.run()` 解除監聽。
//
// ─── 修法 ────────────────────────────────────────────────────────────────────
// 本模組是一個 ref-count 訊號:`LivebuyPlayer` 掛載時 `beginLivebuyPlayerSession()`(+1)、卸載時呼叫
// 其回傳的結束函式(−1)。計數 > 0 = session 進行中。`CollapsibleLivebuyPlayer` 縮小成浮卡時
// `LivebuyPlayer` 仍掛載 → session 仍在。widget 卡片預覽(`CarouselCardView` / `LoopingVideoView`)
// 以 `useLivebuyPlayerSessionActive()` 訂閱,session 進行中不渲染 `<Video>`,結束後重新掛回並交回既有
// play-gate 決定播放。
//
// 純模組(只 import react 的 `useSyncExternalStore`;不 import react-native / react-native-video):
// `createLivebuyPlayerSessionStore()` 可獨立單元測。套件內共用 `livebuyPlayerSession` 單例。
// 非公開 API,不從 `src/index.ts` 匯出。

import { useSyncExternalStore } from 'react';

/** session 進行中與否變化時的通知(不帶值;讀 `isActive()`)。 */
export type LivebuyPlayerSessionListener = () => void;

/** ref-count 訊號的介面。 */
export interface LivebuyPlayerSessionStore {
  /** +1;回傳的結束函式 −1,冪等(重複呼叫只有第一次有效)。 */
  begin(): () => void;
  /** 計數 > 0。 */
  isActive(): boolean;
  /** 目前計數(測試 / 除錯用)。 */
  count(): number;
  /** 訂閱「進行中與否」翻轉(0 ↔ 1 才通知;1 → 2 不通知)。回傳退訂函式。 */
  subscribe(listener: LivebuyPlayerSessionListener): () => void;
}

/** 建立一個獨立的 ref-count 訊號(純函式,測試可各自建一份)。 */
export function createLivebuyPlayerSessionStore(): LivebuyPlayerSessionStore {
  let active = 0;
  const listeners = new Set<LivebuyPlayerSessionListener>();

  const notify = (): void => {
    for (const listener of Array.from(listeners)) listener();
  };

  return {
    begin(): () => void {
      active += 1;
      if (active === 1) notify();
      let ended = false;
      return (): void => {
        if (ended) return;
        ended = true;
        active -= 1;
        if (active === 0) notify();
      };
    },
    isActive: (): boolean => active > 0,
    count: (): number => active,
    subscribe(listener: LivebuyPlayerSessionListener): () => void {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };
}

/** 套件內共用的單例(`LivebuyPlayer` 寫、預覽讀)。 */
export const livebuyPlayerSession: LivebuyPlayerSessionStore = createLivebuyPlayerSessionStore();

/** `LivebuyPlayer` 掛載時呼叫;回傳的函式於卸載時呼叫。 */
export function beginLivebuyPlayerSession(): () => void {
  return livebuyPlayerSession.begin();
}

/** React 端訂閱:任一 `LivebuyPlayer` 掛載中 → `true`。 */
export function useLivebuyPlayerSessionActive(): boolean {
  return useSyncExternalStore(
    livebuyPlayerSession.subscribe,
    livebuyPlayerSession.isActive,
    livebuyPlayerSession.isActive,
  );
}
