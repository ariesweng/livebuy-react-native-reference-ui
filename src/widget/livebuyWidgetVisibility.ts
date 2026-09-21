// livebuyWidgetVisibility — opt-in host→SDK 橋接:讓 host 宣告承載 widget 預覽的畫面是否被覆蓋。
//
// RN parity of Android `LivebuyWidgetVisibility`（`android-refui-widget-host-visibility-pause`,
// commit e3fcfc39）。`rn-refui-widget-preview-lifecycle-pause` 已讓 widget 循環預覽
// `LoopingVideoView` 在兩種 SDK **能自足偵測**的情況暫停:(1) `AppState` 背景暫停、
// (2) `measureInWindow` 零重疊的滾出 viewport 離屏暫停。但它誠實留下一塊**無法自足偵測**
// 的殘餘漏洞——「被非 route 的 overlay 覆蓋」:host 把首頁 widget **仍 laid-out 但被非 route 的
// overlay 覆蓋**(最典型:collapsible presenter 以 overlay 疊在首頁上的全螢幕直播播放器)時——
//   • `measureInWindow` 看到的 window-relative frame **仍與 window 重疊**(z-order 覆蓋
//     偵測不到 → 判定 on-screen);
//   • App 仍 `active`(沒進背景 → `AppState` 收不到 `background`/`inactive`);
//   → 兩個自足 gate 都失效 → 首頁 N 支預覽仍全速硬解,疊加正在播的全螢幕 player。
//
// 這與 PiP 是**同性質的平台/架構限制**:RN `measureInWindow` 只反映 layout 座標,看不到
// **非 route 的** z-order 覆蓋;被同層 overlay 覆蓋時 App 仍 `active`。SDK widget 層沒有任何自足
// 管道能觀察到「host 用 overlay 把我蓋住了」——**只有 host 呈現層知道**。故由 host 明確轉發。
// (stack / route push 是**另一回事**,見下方 ROUTE COVER 段——它不走本橋接。)
//
// 誰呼叫 setWidgetsCovered — 兩條整合路徑(依你怎麼呈現播放器選一條):
//   • 主路徑(大多數 host):drop-in 收合 presenter `CollapsibleLivebuyPlayer` 已依相位自動
//     驅動,host **不需也不應**自己呼叫。契約 `covered ⟺ 全螢幕相位 full`(`hasVideo &&
//     !isMinimized`):全螢幕時宣告 covered(首頁預覽讓出解碼器),縮成浮卡 / 關閉時 un-cover。
//     若你又在 presenter 之上自己呼叫 setWidgetsCovered,只會與它打架(兩者寫同一個 level)。
//     見 `CollapsibleLivebuyPlayer` + `rn-refui-presenter-widget-cover-by-phase` /
//     `refui-widget-visibility-kdoc-presenter-owned`。
//   • 手動路徑(少數 host):**只有**用裸(非收合)`LivebuyPlayer`、或自製**非 route** 覆蓋
//     (不經收合 presenter;stack / route push 走下方 ROUTE COVER 段的 route 軸,不需也不應呼叫
//     本橋接)的 host 才自己呼叫:
//       import { LivebuyWidgetVisibility } from 'livebuy-react-native-reference-ui';
//       LivebuyWidgetVisibility.setWidgetsCovered(true);   // 全螢幕覆蓋首頁時
//       LivebuyWidgetVisibility.setWidgetsCovered(false);  // 關閉、首頁重新可見時
//     把 true/false 對映到「首頁**是否真的被全螢幕覆蓋**」。裸非收合播放器**沒有 floating 相位**,
//     故 `presentedVideo != null` 在該情境才恰好正確;但若 host 自製了 minimize/floating,**不要**
//     用 `presentedVideo != null`(浮卡期仍非 null → 會 OVER-pause 當時可見的首頁預覽),須自行
//     區分全螢幕 vs 收合。(收合 presenter 已以相位驅動避開此 over-pause。)
//
// ROUTE COVER(rb-rn-widget-preview-route-cover-release)——本橋接**不是**給 stack / route push 用的:
//   • host 用 react-navigation 把另一個畫面 push 到承載 widget 的畫面之上(最典型:首頁「查看更多」
//     push 進 Grid 頁,而 Grid 頁自己也承載 `LivebuyWidget`)時,MUST NOT 為此呼叫
//     `setWidgetsCovered(true)`:本橋接是 process-global 單一 level、`register` 立即 replay 當前值,
//     被 push 上去那頁自己的預覽一掛載就被 replay 成 covered → 結構上永遠不播(Flutter sibling
//     `rb-flutter-widget-preview-route-cover-release` 在實機證實同一機制)。
//   • route push 走 **per-subtree** 的 route 軸:host 在 screen 內以 `useIsFocused()` 餵
//     `<LivebuyRouteVisibilityContext.Provider value={focused}>`(或 `LivebuyWidget` 的 `routeVisible`
//     prop,見 `livebuyRouteVisibility.tsx`)→ play-gate 第四軸 `routeVisible`;只影響該 Provider 子樹,
//     被 push 上去那頁的卡不受影響。Android 上 route-hidden 更會卸載 `<Video>` 釋放硬體解碼器、
//     回來重建;本橋接的 `notCovered` 軸在所有平台維持只 pause、不卸載(release 只屬於 route 軸)。
//   • 本橋接只給**非 route** 的覆蓋:collapsible presenter 的全螢幕播放器(absolute overlay,由 presenter
//     自動驅動)、host 自製的 overlay。react-native core 沒有「被哪個畫面蓋住」的框架訊號(那是
//     react-navigation 的概念,本套件無任何 navigation 依賴),所以 route 軸只能由 host 餵入——但餵的
//     是 per-subtree 的 context,不是這個 process-global level。
//
// 向後相容:無人接(沒有 presenter、host 也不呼叫 `setWidgetsCovered`)時,`LoopingVideoView`
// 的 play-gate 第三維 `notCovered` 恆為 true,退化為既有 `foreground && onScreen`(host 亦未餵
// route 軸時),行為與現況**逐位元組相同**。此殘餘的非 route 覆蓋漏洞在無人接時**依然存在**——SDK
// 只提供入口,不宣稱已自足涵蓋(covered 判定為 presenter,或手動 host 的職責)。
//
// 與 Android 同構,但傳的是**有狀態的可見性 level**(covered 布林),非一次性 edge:一支在
// 「已覆蓋」期間才掛載的 widget 預覽,**必須立刻知道當前是 covered** 才不會播。故本橋接
// **保存 `covered`**,且 `register` 時**立即以當前值 replay** 給新掛載的 widget。這是與傳
// 一次性 edge、`register` 不 replay 的橋接(如 PiP 類)的唯一結構差異。
//
// 純模組:不 import `react-native` / `react-native-video`,可獨立單元測(注入閉包記錄呼叫
// 即可驗真值,不需 render)。JS listener 閉包有 identity,可放 `Set` 並以同一 reference 移除。
//
// 命名注意:本檔匯出 `LivebuyWidgetVisibility`,與同套件既有 `widgetVisibility.ts`(urlless-live
// 隱藏,**另一個功能**)刻意不撞名、不混用。

/** 目前是否被覆蓋(有狀態 level;module 單例保存,`register` 時 replay 給新掛載卡)。 */
let covered = false;

/** 掛載中的 `LoopingVideoView` 的覆蓋 listener 集合(閉包 identity → 可移除)。 */
const listeners = new Set<(covered: boolean) => void>();

/**
 * opt-in 覆蓋橋接模組單例。**大多數 host 不需直接碰它**:drop-in 收合 presenter
 * `CollapsibleLivebuyPlayer` 已擁有 {@link setWidgetsCovered} 並依相位驅動(`covered ⟺ full`);
 * 只有裸(非收合)`LivebuyPlayer` / 自製非 route 覆蓋的 host 才自己呼叫(見檔頭兩路徑與 `presentedVideo
 * != null` caveat;stack / route push 走 `LivebuyRouteVisibilityContext`,不經本橋接,見檔頭 ROUTE COVER
 * 段)。每支 `LoopingVideoView` 掛載時 `register`、卸載時 `unregister`。與 Android
 * `LivebuyWidgetVisibility` 同構,但傳有狀態 level → `register` 立即 replay 當前 covered。
 */
export const LivebuyWidgetVisibility = {
  /**
   * Host: 宣告承載 Livebuy widget 預覽的畫面**目前是否被覆蓋**(true = 被非 route 的全螢幕
   * overlay 蓋住、對使用者不可見;stack / route push **不走這裡**,走 `LivebuyRouteVisibilityContext`)。
   * **有狀態**:單例保存當前 `covered` level;值改變時才 fan-out(edge-triggered,不 churn),
   * 在任何狀態呼叫皆為安全操作。
   */
  setWidgetsCovered(next: boolean): void {
    if (covered !== next) {
      covered = next;
      // 快照 fan-out:避免 listener 在回呼內 register/unregister 造成迭代期間變動。
      for (const listener of Array.from(listeners)) {
        listener(next);
      }
    }
  },

  /**
   * @internal `LoopingVideoView` 掛載時呼叫:加入 listener 集合並**立即以當前 `covered` 值
   * replay 一次**(★ 與無狀態 edge 橋接的關鍵差異;在「已覆蓋」期間才掛載的卡立即套用暫停)。
   */
  register(listener: (covered: boolean) => void): void {
    listeners.add(listener);
    listener(covered);
  },

  /** @internal `LoopingVideoView` 卸載時呼叫:安全移除 listener(未知 listener 為 no-op)。 */
  unregister(listener: (covered: boolean) => void): void {
    listeners.delete(listener);
  },

  /** @internal 測試重設:清 listeners + 重設 `covered = false`。 */
  resetForTesting(): void {
    listeners.clear();
    covered = false;
  },
};
