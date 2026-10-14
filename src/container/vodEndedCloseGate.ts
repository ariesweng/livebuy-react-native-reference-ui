// vodEndedCloseGate — debounced「VOD／回放播完、無下一支」自動關閉（rb-rn-vod-ended-no-next-close）
//
// core v4.28.0（`vod-end-loop-*-core`）之後：`loop`（預設）會短暫送出 `ended` 再 seek 0 重播；
// `advance` 有 next → core 直接 load 下一支；`advance` 無 next → 停在 `ended`，**不再**進
// `endScreenShown`。既有 `MomentsView.shouldCloseInsteadOfEndScreen` 只在 end moment
// （countdown / endScreenVisible）出現時才判斷，這條路徑兩者皆不出現 → RN drop-in 從不關閉。
// 本 gate 補上這個缺口。
//
// Parity：iOS `ios/Sources/LivebuyReferenceUI/Container/VodEndedCloseGate.swift`、Android
// `android/livebuy-reference-ui/.../container/VodEndedCloseGate.kt`（同一條件、400ms debounce、
// 進入 `ended` 當下一次鎖存）。
//
// PURE module：只有 type import（不載入 core 的 native bridge），排程器與 behavior 讀取皆注入，
// 測試不需真實等待、不需 native module。

import type { LBVodEndBehavior } from 'livebuy-react-native';

/** 與 iOS / Android / Flutter 相同的 debounce（ms）。 */
export const VOD_ENDED_CLOSE_DEBOUNCE_MS = 400;

/**
 * debounce 排程 seam（docs/unit-test-discipline.md §4：副作用注入）。正式實作為 `setTimeout`；
 * 測試注入 `Capturing*` fake，記錄 `(delayMs, callback)` 並自行決定何時呼叫 callback。
 */
export type VodEndedCloseScheduler = (delayMs: number, callback: () => void) => void;

/** 正式預設 {@link VodEndedCloseScheduler}：`setTimeout`。 */
export const defaultVodEndedCloseScheduler: VodEndedCloseScheduler = (delayMs, callback) => {
  setTimeout(callback, delayMs);
};

/** `ended` 到達當下的判斷輸入（與 iOS `shouldArmClose` / Android `shouldArmVodEndedClose` 同形）。 */
export interface VodEndedCloseInputs {
  /** core 播放狀態字串（`LBPlayerState`）。 */
  readonly state: string;
  /**
   * 目前這次載入是否已有 channel。容器在自己發起新載入前會清空（尚未收到新 channel 的 `ended` 為 `false`）；
   * 但 RN bridge 在 `unload()` 時不送「channel 已清空」事件，所以使用者手動走預設 `unload()` 關閉後，core 送出的
   * `ended` 仍帶舊 channel，可能讓本 gate 在 debounce 後再呼叫一次 `unload()`（重複 unload 無可見影響；
   * 與 iOS／Android 以 hasChannel 排除 unload 的做法不同，屬已知差距）。
   */
  readonly hasChannel: boolean;
  /** `channel.liveStatus === 1`。已結束直播的回放（`liveStatus === 3`）為 `false`。 */
  readonly isLive: boolean;
  /** `channel.next` 非空（不看 `hot`）。 */
  readonly hasNext: boolean;
  /** core 全域 `vodEndBehavior`。 */
  readonly behavior: LBVodEndBehavior;
}

/** PURE：`ended` 段開始當下是否排定關閉。 */
export function shouldArmVodEndedClose(inputs: VodEndedCloseInputs): boolean {
  return (
    inputs.state === 'ended' &&
    inputs.hasChannel &&
    !inputs.isLive &&
    !inputs.hasNext &&
    inputs.behavior === 'advance'
  );
}

export interface VodEndedCloseGate {
  /**
   * 餵入一次狀態變化。`inputs` 以 thunk 傳入：只有在「新的 `ended` 段開始」那一刻才會被讀取，
   * 其他狀態與同段重複的 `ended` 都不讀。
   */
  handleStateChange(state: string, inputs: () => Omit<VodEndedCloseInputs, 'state'>): void;
  /**
   * 作廢待執行的關閉並結束目前的 ended 段（容器 unmount）。冪等。刻意**不**永久停用 gate：React
   * StrictMode 在開發模式會對同一個 instance 執行 effect → cleanup → effect，永久停用會讓 gate 在
   * 開發模式下失效；「unmount 後不關閉」由容器的 mounted 旗標負責（見 `LivebuyPlayer.tsx`）。
   */
  cancel(): void;
  /** Test-only 讀取窗（`*ForTesting` 命名）。 */
  hasPendingCloseForTesting(): boolean;
}

export interface VodEndedCloseGateOptions {
  /** debounce 到期且仍在同一段 `ended` 時呼叫一次。 */
  readonly onClose: () => void;
  readonly scheduler?: VodEndedCloseScheduler;
  readonly debounceMs?: number;
}

/**
 * 建立 gate。
 *
 * **ended 段鎖存**：任何非 `ended` 之後的第一個 `ended` 開啟一段「ended 期間」，排不排關閉只在那一刻
 * 判斷一次；同段之後重複的 `ended` 不重判、不取消、不延後。任何非 `ended` 狀態結束該段並作廢待執行
 * 的關閉；`cancel()` 作廢待執行的關閉。
 */
export function createVodEndedCloseGate(options: VodEndedCloseGateOptions): VodEndedCloseGate {
  const scheduler = options.scheduler ?? defaultVodEndedCloseScheduler;
  const debounceMs = options.debounceMs ?? VOD_ENDED_CLOSE_DEBOUNCE_MS;
  let pending: object | null = null;
  let inEndedEpisode = false;

  return {
    handleStateChange(state, inputs): void {
      if (state !== 'ended') {
        inEndedEpisode = false;
        pending = null;
        return;
      }
      if (inEndedEpisode) return; // 同一段：判斷已鎖存
      inEndedEpisode = true;
      if (!shouldArmVodEndedClose({ state, ...inputs() })) return;
      const token = {};
      pending = token;
      scheduler(debounceMs, () => {
        if (pending !== token) return;
        pending = null;
        options.onClose();
      });
    },
    cancel(): void {
      pending = null;
      inEndedEpisode = false;
    },
    hasPendingCloseForTesting(): boolean {
      return pending != null;
    },
  };
}

/** 容器記住的 channel 最小形狀（`LBPlayerChannelInfo` 的子集；該型別未從 core index 匯出）。 */
export interface VodEndedChannelSnapshot {
  readonly liveStatus: number;
  readonly next: readonly unknown[];
}

/** PURE：由容器記住的 channel 與 behavior 組出 gate 輸入。`channel == null` → `hasChannel: false`。 */
export function vodEndedInputsOf(
  channel: VodEndedChannelSnapshot | null,
  behavior: LBVodEndBehavior,
): Omit<VodEndedCloseInputs, 'state'> {
  return {
    hasChannel: channel != null,
    isLive: channel != null && channel.liveStatus === 1,
    hasNext: channel != null && channel.next.length > 0,
    behavior,
  };
}

/**
 * PURE：安全讀取 core 的 `getVodEndBehavior()`。host 若裝的是尚未提供此方法的舊版 core（或讀取丟錯），
 * 回 `'loop'`——`loop` 永遠不關閉，是安全的預設。
 */
export function readVodEndBehavior(sdk: {
  readonly getVodEndBehavior?: () => LBVodEndBehavior;
}): LBVodEndBehavior {
  try {
    return typeof sdk.getVodEndBehavior === 'function' && sdk.getVodEndBehavior() === 'advance'
      ? 'advance'
      : 'loop';
  } catch {
    return 'loop';
  }
}
