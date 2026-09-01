// previewPlaybackController — widget 循環預覽的統一 play-gate 狀態機（RN，純模組）。
//
// RN parity of iOS `PreviewPlaybackController`（`CarouselCardView.swift`）/ Flutter
// `PreviewPlaybackController`（`looping_video_view.dart`）/ Android 的同名 controller
// （`android-refui-player-lifecycle-pause` 的「widget 預覽半」）。四端共用同一語意:
// widget live 預覽的正確播放條件是「App 前景 **且** 該卡在螢幕上」。
//
// 為何是**單一統一閘**（`foreground && onScreen`）而非兩個獨立 observer:若把「背景
// observer」與「離屏 observer」拆成兩套各自 play/pause,回前景時背景 observer 會誤
// resume 一張其實仍滾出螢幕的卡。摺成單一 `foreground && onScreen` 閘、edge-triggered
// 命令式套 `onPlay()` / `onPause()`,天然避免「回前景喚醒離屏卡」(對齊 iOS/Flutter/
// Android 決策)。
//
// 純模組(不 import react-native / react-native-video):可獨立單元測,注入 record 閉包
// 即可驗狀態機真值,不需 render / 不需 `<Video>`。命令式 edge 語意在 RN 端由呼叫端
// (`LoopingVideoView`)把 `onPlay` / `onPause` 綁到 `setPaused(false)` / `setPaused(true)`
// —— gate 是唯一決策來源,`<Video>` 的 `paused` 由它驅動,取代原先硬寫的 `paused={false}`。

/** window / 卡片座標矩形(window-relative,對齊 Android `boundsInWindow` window-based 語意)。 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * 統一 play-gate:`foreground && onScreen && notCovered` 才播。edge-triggered 命令式——
 * 只有**合成決策**（`shouldPlay`）真的改變時才呼叫一次 `onPlay()` / `onPause()`,避免 churn。
 *
 * 為何是**單一**三軸 gate 而非多個獨立 observer:若把「背景 / 離屏 / 被覆蓋」拆成各自
 * play/pause,回前景時背景 observer 會誤 resume 一張其實仍滾出螢幕、或其實仍被覆蓋的卡。
 * 摺成單一 `foreground && onScreen && notCovered` 閘、edge-triggered 命令式套 `onPlay()` /
 * `onPause()`,天然避免「回前景 / 滾回喚醒仍離屏 / 仍被覆蓋卡」(對齊 iOS/Flutter/Android)。
 *
 * - `setForeground` / `setOnScreen` / `setNotCovered`:三軸各自灌旗標,值改變才 `apply()`。
 *   `notCovered` 為 host opt-in 覆蓋信號軸(`rn-refui-widget-host-visibility-pause`),預設
 *   `true` = 未被覆蓋 = 現況(host 不接時 gate 退化為既有 `foreground && onScreen`)。
 * - `reapply()`:重置 edge latch 後以當下 `shouldPlay` **重套一次**——供播放器(re)configure
 *   完成後補套當下 desired(RN 端 `<Video>` 首次掛載 / URL 變更後,以當下三軸決策取代原
 *   無條件 `paused={false}`,使離屏 / 背景 / 已被覆蓋時掛載的卡不誤播)。
 */
export class PreviewPlaybackController {
  private readonly onPlay: () => void;
  private readonly onPause: () => void;
  private foreground: boolean;
  private onScreen: boolean;
  private notCovered: boolean;
  /** edge-trigger latch:null = 尚未套用過;true/false = 上次已套用的 desired。 */
  private applied: boolean | null = null;

  constructor(params: {
    onPlay: () => void;
    onPause: () => void;
    /** 種子前景軸(預設 true;RN 端以 `AppState.currentState === 'active'` 種)。 */
    foreground?: boolean;
    /** 種子離屏軸(預設 true;首次 `measureInWindow` 會即時校正)。 */
    onScreen?: boolean;
    /** 種子覆蓋軸(預設 true = 未被覆蓋;掛載時 `LivebuyWidgetVisibility.register` 會 replay 當前值)。 */
    notCovered?: boolean;
  }) {
    this.onPlay = params.onPlay;
    this.onPause = params.onPause;
    this.foreground = params.foreground ?? true;
    this.onScreen = params.onScreen ?? true;
    this.notCovered = params.notCovered ?? true;
  }

  /** 合成決策:App 前景 **且** 卡在螢幕上 **且** 未被 host 宣告覆蓋才播。 */
  get shouldPlay(): boolean {
    return this.foreground && this.onScreen && this.notCovered;
  }

  /** 背景軸:active → true;background / inactive → false。 */
  setForeground(value: boolean): void {
    if (this.foreground !== value) {
      this.foreground = value;
      this.apply();
    }
  }

  /** 離屏軸:卡 frame 與 window 重疊 → true;滾出 → false。 */
  setOnScreen(value: boolean): void {
    if (this.onScreen !== value) {
      this.onScreen = value;
      this.apply();
    }
  }

  /**
   * 覆蓋軸(host opt-in):host 宣告承載 widget 的畫面被覆蓋 → `notCovered = false` → 暫停;
   * 取消覆蓋 → true → 恢復(仍受 `foreground` / `onScreen` 兩軸節制)。值改變才 `apply()`。
   */
  setNotCovered(value: boolean): void {
    if (this.notCovered !== value) {
      this.notCovered = value;
      this.apply();
    }
  }

  /** 重置 edge latch 後以當下 desired 重套一次(供播放器 (re)configure 後補套)。 */
  reapply(): void {
    this.applied = null;
    this.apply();
  }

  private apply(): void {
    const desired = this.shouldPlay;
    if (desired !== this.applied) {
      this.applied = desired;
      if (desired) {
        this.onPlay();
      } else {
        this.onPause();
      }
    }
  }
}

/**
 * 純幾何:卡片 window-relative frame 是否與 window 矩形重疊 →「在螢幕上」。對應 iOS
 * `LoopingVideoView.isCardOnScreen`(`.frame(in: .global)` ∩ `UIScreen.main.bounds`)、
 * Android `boundsInWindow()` 與 window 求交、Flutter `visibleFraction > 0`。
 *
 * 零面積 frame(尚未量測 / 已被 clip 成 0)視為**離屏**(回 false),避免未就緒的卡誤播。
 */
export function isCardOnScreen(cardFrame: Rect, windowFrame: Rect): boolean {
  if (cardFrame.width <= 0 || cardFrame.height <= 0) return false;
  const cardRight = cardFrame.x + cardFrame.width;
  const cardBottom = cardFrame.y + cardFrame.height;
  const winRight = windowFrame.x + windowFrame.width;
  const winBottom = windowFrame.y + windowFrame.height;
  // 標準 AABB 交集:任一軸完全不重疊即離屏。
  return (
    cardFrame.x < winRight &&
    cardRight > windowFrame.x &&
    cardFrame.y < winBottom &&
    cardBottom > windowFrame.y
  );
}
