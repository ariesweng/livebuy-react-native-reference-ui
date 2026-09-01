// containerEventListener — reference-ui 內部的「core 單槽事件 listener」多工器 + 容器 hook
// (rn-fold-host-listener-into-single-slot, reference-ui layer).
//
// ─── 病根 ────────────────────────────────────────────────────────────────────
// core `registerListener` (`react-native/src/LivebuyEvents.ts`) 是 **單槽**：它用一個模組層
// `subscription` 變數，後註冊者會先 `subscription.remove()` 掉前一個 —— 其 JSDoc 明文
// 「Calling registerListener twice replaces the prior handler.」。
//
// 這個套件卻在三處各自呼叫它：`LivebuyPlayer` 的 host `config.eventListener`、`LivebuyPlayer`
// 的內部 listener（swipe 換片基準 + collapsible 換片同步 + iOS PiP 前景恢復追蹤）、以及
// `LivebuyWidget` 的 host `config.eventListener`。三者互相踢掉，造成雙向失效：
//
//   • 掛載時 effect 依宣告順序執行 → 內部 listener 後註冊 → 取代 host 的 →
//     `config.eventListener` 靜默永不觸發；
//   • host 換 `config.eventListener` identity → 該 effect 重跑 → 註冊 host 的 → 反殺內部
//     listener（其 deps 為 `[]`，永不重註冊）→ swipe 基準 / collapsible 同步 / PiP 追蹤永久壞掉；
//   • `LivebuyWidget` 的 default-open player 會 mount `LivebuyPlayer` → widget 的 host listener
//     被踢掉，且 player 卸載時的 cleanup 會把整格清空 → widget host listener 再也回不來。
//
// ─── 修法 ────────────────────────────────────────────────────────────────────
// 本模組把「整個 reference-ui 套件對 core 只佔用一格」變成結構性保證：
//
//   1. `subscribeSdkEvents` —— ref-count fan-out 多工器。訂閱者計數 0 → 1 時才真的呼叫一次
//      core `registerListener`；1 → 0 時才真的退訂。對內把該唯一事件流分送給所有訂閱者。
//   2. `useContainerEventListener` —— 容器用的 hook。host listener 與內部 handler 都以 **ref**
//      持有並每 render 更新，註冊 effect 的 deps 是 `[]` → host 換 identity 不需要重新註冊，
//      因此不可能再踢掉任何人。
//
// 依賴注入（`internal-testability`）：core `registerListener` 由**呼叫端**傳入，本模組只
// `import type` core 型別。若在模組層 `import { registerListener } from 'livebuy-react-native'`，
// import 會執行 core 模組 body（`const { LivebuyRNBridge } = NativeModules`），而 reference-ui 的
// jest `react-native` mock 不提供 `NativeModules` → 整個測試檔載不起來。注入讓多工器與 hook
// 可在無 native bridge 的環境下獨立單元測試。
//
// 邊界（明文不保證）：本多工器只涵蓋 **reference-ui 套件內部**的訂閱者。host 若在套件之外
// 自己呼叫 core `registerListener`，仍與這一格相爭 —— 那是 core 單槽的既有契約（本層 MUST NOT
// 改 `react-native/`），也正是 `LivebuyLiveEntry` 以注入式 `config.liveEndedSignal` 而非自行訂閱
// 的原因。受支援的 host 路徑是 `config.eventListener`。

import { useEffect, useRef } from 'react';

import type { LBSdkEvent } from 'livebuy-react-native';

/** 收 SDK 事件的 handler（與 core `LBEventHandler` 同形）。 */
export type SdkEventHandler = (event: LBSdkEvent) => void;

/**
 * core `registerListener` 的形狀（注入用）：吃一個 handler、回傳退訂函式。
 * 單槽語意由 core 擁有，本模組只保證「最多呼叫它一次」。
 */
export type RegisterListenerFn = (handler: SdkEventHandler) => () => void;

// -- 單槽多工器 ---------------------------------------------------------------

/** 目前所有 reference-ui 訂閱者。插入順序 = 派送順序。 */
const subscribers = new Set<SdkEventHandler>();

/** core 那一格的退訂函式；`null` 表示目前沒佔用（訂閱者計數為 0）。 */
let releaseCoreSlot: (() => void) | null = null;

/**
 * 訂閱 SDK 事件流（reference-ui 內部用）。
 *
 * 計數 0 → 1 時才呼叫一次 `register`（core `registerListener`），1 → 0 時才呼叫其回傳的退訂。
 * 中途任一訂閱者退訂不影響其餘訂閱者 —— 這正是舊碼壞掉的地方（`LivebuyPlayer` 卸載時把
 * `LivebuyWidget` 的 listener 一起清掉）。
 *
 * @param register core `registerListener`（由容器注入 —— 見檔頭 DI 說明）
 * @param handler  訂閱者
 * @returns 退訂函式（冪等：重複呼叫只有第一次有效）
 */
export function subscribeSdkEvents(
  register: RegisterListenerFn,
  handler: SdkEventHandler,
): () => void {
  subscribers.add(handler);

  if (releaseCoreSlot == null) {
    // 派送對訂閱者集合的**快照**迭代：訂閱者在派送途中退訂（例如 host listener 觸發關閉 →
    // 容器卸載）不會讓 Set 迭代器爆掉。每個訂閱者獨立 `try/catch` —— 一個拋錯不得阻止其餘
    // 訂閱者收到同一個事件（隔離粒度就是「訂閱者之間」，放在別處都達不到這個保證）。
    releaseCoreSlot = register((event) => {
      for (const subscriber of Array.from(subscribers)) {
        try {
          subscriber(event);
        } catch {
          /* 一個訂閱者拋錯不得毀掉其他訂閱者，也不得逸出至 native emitter callback。 */
        }
      }
    });
  }

  let released = false;
  return (): void => {
    if (released) return;
    released = true;
    subscribers.delete(handler);
    if (subscribers.size === 0 && releaseCoreSlot != null) {
      const release = releaseCoreSlot;
      releaseCoreSlot = null;
      release();
    }
  };
}

/** Test-only：目前訂閱者數量（讓測試可斷言 ref-count 真的歸零）。 */
export function sdkEventBusSubscriberCountForTesting(): number {
  return subscribers.size;
}

/** Test-only：清空模組層單例狀態（測試 `beforeEach` 呼叫；不觸發 core 退訂）。 */
export function _resetSdkEventBusForTesting(): void {
  subscribers.clear();
  releaseCoreSlot = null;
}

// -- 容器 hook ----------------------------------------------------------------

/** `useContainerEventListener` 的兩個 handler 出口。 */
export interface ContainerEventHandlers {
  /**
   * 容器自己的內部處理（維護容器不變式：swipe 換片基準 / collapsible 同步 / PiP 追蹤）。
   * 每個事件**先**跑這個。不包 `try/catch` —— 這是套件自己的程式碼，出錯就該炸出來，
   * 而不是被吞成沉默的壞掉。
   */
  readonly internal?: SdkEventHandler;
  /**
   * host 的 `config.eventListener`。**額外**觀察者，MUST NOT 取代 view-model 的 template
   * routing。在 `internal` **之後**收到同一個事件。
   */
  readonly host?: SdkEventHandler;
}

/**
 * 把容器的內部處理與 host listener 折進 **同一格** core 訂閱。
 *
 * 兩個 handler 都以 ref 持有並每 render 更新，註冊 effect 的 deps 是 `[]`：
 *
 *   • host 換 listener identity（例如每 render 重建的 inline closure）只改 ref 的值，
 *     **不觸發** effect → 不重註冊 → 不可能踢掉內部 listener；
 *   • 內部 handler 同樣走 ref，容器每 render 重建該 closure 也保證讀到最新（順帶關掉
 *     stale-closure 這類問題）。
 *
 * 派送順序固定 **internal → host**：內部處理維護的是容器不變式，host 只是額外觀察者；
 * 內部先跑才能保證 host listener 做任何事（含拋錯、含同步 `setState`、含把自己卸載）之前，
 * 容器不變式已經正確。host 轉發包 `try/catch` 且不重拋 —— 拋錯的 host listener 不得破壞
 * 內部處理、也不得逸出至 native emitter。
 *
 * @param register core `registerListener`（由容器注入）
 * @param handlers 內部處理 + host listener
 */
export function useContainerEventListener(
  register: RegisterListenerFn,
  handlers: ContainerEventHandlers,
): void {
  const internalRef = useRef(handlers.internal);
  internalRef.current = handlers.internal;
  const hostRef = useRef(handlers.host);
  hostRef.current = handlers.host;
  // `register` 也走 ref：容器傳的一律是同一個 core 匯入，但 ref 讓 `[]` deps 不必把它列進
  // 依賴、也不會因為呼叫端換了函式參考而重註冊。
  const registerRef = useRef(register);
  registerRef.current = register;

  // 兩個 handler 都沒有時**完全不碰** core 那一格。`LivebuyWidget` 沒有內部 handler，host 也沒傳
  // `config.eventListener` 時舊碼是「早退、根本不註冊」——若改成無條件訂閱，就會把 core 那一格佔走、
  // 反過來踢掉「host 自己直呼 core `registerListener`」的註冊（core 單槽）。這個 boolean 進 deps
  // （**只有** boolean，不是 listener identity）保留舊行為：無 handler → 不佔格；handler 之後才出現
  // → 那時才訂閱。identity 變動仍完全不會 re-register。
  const hasHandlers = handlers.internal != null || handlers.host != null;

  useEffect(() => {
    if (!hasHandlers) return;
    return subscribeSdkEvents(registerRef.current, (event) => {
      internalRef.current?.(event);
      try {
        hostRef.current?.(event);
      } catch {
        /* host listener 是觀察者：它拋錯不得破壞內部處理、也不得逸出至 native emitter。 */
      }
    });
    // 一次註冊：handler 全部走 ref，故 identity 變動不需進 deps（放進去就會重註冊 churn）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHandlers]);
}
