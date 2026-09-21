// livebuyPreviewScrollSignal — reference-ui 自己的 scroll 容器 → widget 循環預覽卡片的**捲動訊號**
// （React context，event source），讓卡片在祖先 `ScrollView` 捲動時重新量測可見性
// （rb-rn-widget-preview-offscreen-decoder-release）。
//
// 為何需要它：RN 內建 `onLayout` **不因祖先 `ScrollView` 捲動而重發**（widget 面刻意非 `FlatList`，
// 無 `onViewableItemsChanged` 可借），`LoopingVideoView` 的離屏軸原本只在 `onLayout` 時
// `measureInWindow` 量一次——turnkey scrollable 面「捲動當下」的可見性變化偵測不到（檔頭「誠實限制」
// 段長期標明的缺口）。Android 上這不只是「離屏卡多解一點碼」：`react-native-video` paused 的
// `<Video>` 仍持有一個 `MediaCodec` 硬體解碼器，「查看更多」Grid render-ALL、load-more 一次 18 張，
// 全部同時持有解碼器就撞裝置上限（Flutter sibling 實機：18 張時解碼器初始化失敗 log 123 行、27 張時
// 全部凍結）。要讓「只有在螢幕上的卡持有解碼器」成立，卡片必須在捲動時被重新量測。
//
// 設計（D1）：
//   • 訊號由 **reference-ui 自己持有的 scroll 容器**發出：`ScrollableVideoShopView`（Grid）與
//     `Carousel` 的 `scrollable` 分支（turnkey 首頁輪播）各自建一個 signal，用
//     `LivebuyPreviewScrollSignalContext.Provider` 包住自己的 `ScrollView` 子樹，在 `onScroll`
//     （JS 端節流，`previewScrollSignalThrottleMs()` = 100 ms）、`onScrollEndDrag`、
//     `onMomentumScrollEnd`（結束時**一定** emit，不受節流）呼叫 `emit()`。**不靠 host**。
//   • 卡片（`LoopingVideoView`）以 `useContext` 訂閱，每次 emit 重新 `measureInWindow`。
//   • context 的 value 是穩定的 event source（`{ subscribe }`），不是會變的值——emit 不觸發
//     React re-render，只喚醒訂閱者；Provider 不是 host element、不進 `toJSON()`，既有結構快照不受影響。
//   • 預設值是**永不發**的 no-op source：沒有 Provider 的地方（windowed carousel、`FloatingWidget`、
//     `MinimizedWidget`、host 自組 design）行為與現況相同——只在 layout 時量一次。
//
// host-owned scroll（optional）：host 若把 windowed `Carousel` / `CarouselRowView`（plain Row，真正
// 的捲動由 host 的 `ScrollView` 負責，reference-ui 拿不到那些捲動事件）放進自己的 `ScrollView`，
// 可用同一個 context 把自己的捲動事件餵進來：
//
//     const signal = useRef(createPreviewScrollSignal()).current;
//     <LivebuyPreviewScrollSignalContext.Provider value={signal.source}>
//       <ScrollView onScroll={() => signal.emit()} onMomentumScrollEnd={() => signal.emit()} scrollEventThrottle={16}>
//         <Carousel … />
//       </ScrollView>
//     </LivebuyPreviewScrollSignalContext.Provider>
//
// **未餵時維持「只在 layout 時量」的既有行為**：離屏卡不會被釋放（與現況相同），這是誠實限制、
// 不宣稱涵蓋。

import { createContext, useRef } from 'react';

import { previewScrollSignalThrottleMs } from './previewDecoderPolicy';

/** 捲動訊號的訂閱端（event source）：`subscribe` 回傳取消訂閱函式。 */
export interface LivebuyPreviewScrollSignalSource {
  subscribe(listener: () => void): () => void;
}

/** 捲動訊號的發送端 + 訂閱端（`createPreviewScrollSignal()` 的回傳）。 */
export interface LivebuyPreviewScrollSignal {
  readonly source: LivebuyPreviewScrollSignalSource;
  /** 喚醒所有訂閱者（同步、以快照迭代，listener 內取消訂閱亦安全）。 */
  emit(): void;
}

/** 預設 context 值：永不發的 no-op source（`subscribe` 回傳的取消函式亦為 no-op）。 */
export const NOOP_PREVIEW_SCROLL_SIGNAL_SOURCE: LivebuyPreviewScrollSignalSource = Object.freeze({
  subscribe: (_listener: () => void): (() => void) => () => {},
});

/**
 * 建一個捲動訊號：`source.subscribe(listener)` 登記、回傳取消函式；`emit()` 同步喚醒當下所有
 * listener（以快照迭代，listener 內取消自己或別人不影響本輪）。純模組，可獨立單元測。
 */
export function createPreviewScrollSignal(): LivebuyPreviewScrollSignal {
  const listeners = new Set<() => void>();
  const source: LivebuyPreviewScrollSignalSource = {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };
  return {
    source,
    emit: (): void => {
      for (const listener of Array.from(listeners)) listener();
    },
  };
}

/**
 * per-subtree 捲動訊號 context。reference-ui 自己的 scroll 容器（`ScrollableVideoShopView`、
 * `Carousel` 的 `scrollable` 分支）提供；`LoopingVideoView` 訂閱後每次 emit 重新 `measureInWindow`。
 * 未提供 Provider 時為 {@link NOOP_PREVIEW_SCROLL_SIGNAL_SOURCE}（永不發）= 現況。
 */
export const LivebuyPreviewScrollSignalContext = createContext<LivebuyPreviewScrollSignalSource>(
  NOOP_PREVIEW_SCROLL_SIGNAL_SOURCE,
);
LivebuyPreviewScrollSignalContext.displayName = 'LivebuyPreviewScrollSignal';

/** scroll 容器端：signal + `ScrollView` 三個事件要呼叫的節流 / 強制 emit 對。 */
export interface PreviewScrollSignalEmitter {
  readonly source: LivebuyPreviewScrollSignalSource;
  /** `onScroll` → 距上次 emit（任一種）≥ 節流間隔才 emit；第一次一定 emit。 */
  emitThrottled(): void;
  /** `onScrollEndDrag` / `onMomentumScrollEnd` → 一定 emit（並重設節流時鐘）。 */
  emitNow(): void;
}

/**
 * 建 scroll 容器端的節流 emitter（純函式，`now` / `throttleMs` 可注入以便單測；預設
 * `Date.now` / {@link previewScrollSignalThrottleMs}）。時鐘倒退（`now()` 小於上次）視為已過節流期，
 * 不會把訊號卡死；`emitNow` 亦可自癒。
 */
export function createPreviewScrollSignalEmitter(opts?: {
  readonly now?: () => number;
  readonly throttleMs?: number;
}): PreviewScrollSignalEmitter {
  const now = opts?.now ?? ((): number => Date.now());
  const throttleMs = opts?.throttleMs ?? previewScrollSignalThrottleMs();
  const signal = createPreviewScrollSignal();
  let lastEmitAt: number | null = null;
  return {
    source: signal.source,
    emitThrottled: (): void => {
      const t = now();
      if (lastEmitAt != null) {
        const elapsed = t - lastEmitAt;
        if (elapsed >= 0 && elapsed < throttleMs) return;
      }
      lastEmitAt = t;
      signal.emit();
    },
    emitNow: (): void => {
      lastEmitAt = now();
      signal.emit();
    },
  };
}

/**
 * 元件版：每個 scroll 容器實例持有一個穩定的 emitter（`useRef` 懶建，跨 re-render 同一個物件，
 * 所以 Provider value 穩定、不會讓訂閱者重新訂閱）。
 */
export function usePreviewScrollSignalEmitter(): PreviewScrollSignalEmitter {
  const ref = useRef<PreviewScrollSignalEmitter | null>(null);
  if (ref.current == null) ref.current = createPreviewScrollSignalEmitter();
  return ref.current;
}
