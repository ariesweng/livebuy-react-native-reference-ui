// LivebuyLiveEntryConfig — per-instance wiring for the drop-in `LivebuyLiveEntry`
// container (introduce-dropin-live-entry-container-rn).
//
// Parity source: iOS `LivebuyLiveEntryConfig` (struct) / Android `LivebuyLiveEntryConfig`
// (data class). EVERY interaction callback is OPTIONAL with a documented sensible default
// — a host that passes nothing still gets a working「現正直播」entry; passing a callback
// REPLACES that one default.
//
// PURE TypeScript (type-only react-native imports) so it stays reliably testable in a
// plain node environment without dragging the RN runtime into jest.

import type { ViewStyle } from 'react-native';
import type { LBVideoItem, SDKConfig } from 'livebuy-react-native';
import type { LBUIOptions } from 'livebuy-react-native-ui';
import type { LBSafeAreaInsets } from '../safearea/LBSafeArea';

/**
 * Per-instance wiring for {@link LivebuyLiveEntry}. All fields optional; each has a
 * documented built-in default the container supplies when omitted. Mirrors the iOS
 * `LivebuyLiveEntryConfig` / Android `LivebuyLiveEntryConfig`.
 *
 * RN divergence: the RN `FloatingWidget` surface does NOT expose a width (fixed
 * `DEFAULT_CARD_WIDTH`), so this config OMITS `width` (iOS / Android have it).
 */
export interface LivebuyLiveEntryConfig {
  // -- theme resolution (turnkey defaults if omitted) --------------------------

  /**
   * The merchant SDKConfig used to resolve the theme. Omitted → the container fetches it
   * via `LivebuySDK.getSdkConfig()` (the host has already `configure()`d). Provide it to
   * skip the async fetch (e.g. tests).
   */
  sdkConfig?: SDKConfig | null;
  /** Host UI options forwarded into the theme resolver. Default: `LivebuyUI.hostOptions`. */
  hostOptions?: LBUIOptions | null;

  // -- interaction callbacks (all optional, each defaulted) --------------------

  /**
   * Whole-entry tap. Default: `undefined` → the container DEFAULT-opens a full-screen in-app
   * `<LivebuyPlayer>` via `<Modal>` (dropin-live-entry-default-open-player-rn, mirrors `LivebuyWidget`).
   * A host wires this to fully override (the default Modal then never opens); `onTapVideo = () => {}` is
   * a true no-op. For an external-platform live (`externalLiveWatchURL(item) != null`) the container
   * DEFAULT-opens the platform URL (`externalLiveAwareTap`, highest precedence); a host wanting to manage
   * external itself wires `onTapVideo`.
   */
  onTapVideo?: (item: LBVideoItem) => void;
  /**
   * Close button. Default: `undefined`. Default behaviour = hide until the「next」live
   * (a new `video.id` re-surfaces it) — this now genuinely survives the host unmounting and
   * remounting this container (e.g. opening then closing a player), not just staying dismissed
   * while this exact component instance is alive (`rb-rn-live-entry-dismiss-survives-remount`;
   * previously this promise only held within a single mount). A host wanting permanent dismissal
   * still records its own flag in `onClose` and conditionally mounts the container.
   */
  onClose?: () => void;

  // -- behaviour flags (production-safe defaults) ------------------------------

  /** Poll interval in SECONDS. Default: `30` (`fetchLatestLive` failure → 3s fast retry). */
  pollInterval?: number;
  /**
   * Draggable + on-screen clamp. Default: `true`. The resting corner itself comes from
   * {@link LivebuyLiveEntryConfig.position} and applies in BOTH modes — turning dragging off only
   * removes the pan gesture, it does not hand positioning back to the host (the container keeps its
   * absolute resting style either way).
   */
  draggable?: boolean;

  /**
   * Host-provided「直播已結束」immediate-hide subscription (RN idiomatic observable shape,
   * parity Android `liveEndedSignal: Flow<Unit>` / iOS ambient `NotificationCenter`).
   * The container calls it with an `onLiveEnded` callback and (optionally) gets an
   * unsubscribe back; the host invokes `onLiveEnded` from its own `POLL_RECEIVED` +
   * `live_end === 1` handling. Needed because RN core `registerListener` is a SINGLE slot (a later
   * registration replaces the prior handler), so a host subscribing to core events directly and a
   * container subscribing on its own would kick each other. Default: `undefined` → the
   * 30s poll + `liveStatus === 1` gate still absorbs an ended live within one interval.
   */
  liveEndedSignal?: (onLiveEnded: () => void) => (() => void) | void;

  // -- floating_setting (raw wire values injected by the host) -----------------
  //
  // The backend ships the merchant's floating-entry settings in the `POST /sdk/config` response
  // under `data.extensions.floating_setting`. `extensions` is an OPAQUE raw bag (`sdk-config`
  // capability): the SDK does not interpret it, so the HOST reads the values out and injects them
  // here. The container NEVER reads `sdkConfig.extensions` itself.
  //
  // Out of scope for this container: `enable` (whether to mount it at all — a host decision) and
  // the app-scope `live` / `video` / `video_source` / `video_id` fields (video-selection logic).

  /**
   * Raw `floating_setting.position`. Accepted values `'left_bottom'` / `'right_bottom'`; ANYTHING
   * else (omitted, `''`, `' left_bottom '`, `'LEFT_BOTTOM'`, an unknown string) falls back to
   * `'right_bottom'` — the corner RN used before this setting existed. Normalization happens in the
   * one pure `normalizeFloatingPosition` (`liveEntryLogic.ts`) with STRICT equality: no trimming,
   * no case folding, so all four platforms land in the same place on a malformed backend value.
   *
   * Applies in BOTH `draggable` modes: the two render branches already share one absolute resting
   * style, so switching sides adds no node and no layout container.
   */
  position?: string;
  /**
   * Raw `floating_setting.timing`. Accepted values `'immediate'` / `'delay'`; anything else falls
   * back to `'immediate'` (same strict-equality contract as {@link position}). `'delay'` waits
   * {@link delaySeconds} after the entry FIRST becomes showable (a live is detected and the user
   * has not closed it — not container mount, which would silently degrade to `'immediate'` for a
   * live that starts long after the host screen opened) and then plays an entrance animation.
   *
   * Applies in BOTH `draggable` modes — it decides whether the entry exists, not where it is drawn.
   */
  timing?: string;
  /**
   * Wait in SECONDS for `timing === 'delay'`, carrying the backend's Int-seconds
   * `floating_setting.delay`. Default `3` (constant `LIVE_ENTRY_DEFAULT_DELAY_SECONDS`). Negative
   * and non-finite values collapse to `0`; the value is completely inert when the timing resolves
   * to `'immediate'`.
   *
   * Named with the `Seconds` suffix on purpose: a bare `delay` reads as MILLISECONDS to a JS
   * audience (`setTimeout`'s second argument), and this one is seconds.
   */
  delaySeconds?: number;

  // -- container styling -------------------------------------------------------

  /**
   * Resting-corner inset: `x` = the distance from the OWNED horizontal edge (`right` when
   * {@link position} resolves to `'right_bottom'`, `left` when it resolves to `'left_bottom'`),
   * `y` = bottom. Default `{ x: 12, y: 24 }` (constant `LIVE_ENTRY_DEFAULT_INSET`; same as the
   * prior hardcoded value → existing hosts unchanged). SINGLE source driving BOTH the resting
   * position (`styles.floatingLive` + the one `lbLiveEntryRestingInset` helper, shared by the
   * non-draggable and draggable render branches) AND the drag-clamp bound, so the resting corner
   * and the drag bound stay consistent at either corner. A host with bottom chrome (TabBar) sets
   * `{ x: 12, y: 70 }` to clear it without a `config.style` override. Parity iOS `inset: CGSize` /
   * Android `inset: DpOffset`.
   */
  inset?: { x: number; y: number };

  // -- safe area (rb-rn-edge-to-edge-safe-area) --------------------------------

  /**
   * 浮動入口要避開的系統邊距，以**入口所在的 host 容器四邊**為基準（缺的邊視為零）。入口的靜止位置
   * 是「safe rect 的角落再內縮 {@link inset}」，拖曳邊界也以 safe rect 為準。**Default（省略）＝ 由
   * SDK 自行判斷**（`LivebuySafeAreaInsetsProvider` 注入的值 → host 已安裝的
   * `react-native-safe-area-context`，並依 host 容器在視窗中的實際位置只補還沒被處理的那一段 →
   * 皆無則為零，與本欄位存在前相同）。明確傳值時原樣採用；傳全零即「host 已自行處理」。
   */
  safeAreaInsets?: Partial<LBSafeAreaInsets>;

  /**
   * 預設點擊開啟的全螢幕播放器（未接 {@link onTapVideo} 時由 SDK 以自己的 `<Modal>` 呈現）的 chrome
   * 內縮量，原樣轉給該播放器的 `LivebuyPlayerConfig.safeAreaInsets`。與 {@link safeAreaInsets}（浮動入口自己的值）分開。
   *
   * Modal 是獨立視窗，host 主視窗的 inset 不一定適用，所以規則是「拿得到 Modal 視窗自己的 inset 才
   * 讓 Modal 延伸到系統列後方」：
   * - **省略**：host 有安裝 `react-native-safe-area-context` 時，SDK 在 Modal 內重新量測並讓 Modal
   *   延伸到系統列後方；沒有安裝時 Modal 維持原樣（Android 上 `LivebuySafeAreaInsetsProvider` 注入的
   *   主視窗值不會被套用到 Modal 內；iOS 的全螢幕 Modal 與主視窗佔同一塊螢幕，直向且 provider 未帶
   *   `frame` 時會沿用，橫向或帶 `frame` 時不沿用）。
   * - **有任一邊非零**：這個值就是「Modal 延伸到系統列後方時」的內縮量，Modal 會延伸。
   * - **四邊皆零**：明確關閉——Modal 不延伸、chrome 不內縮。
   *
   * host 的 Android app 若已啟用 React Native 的 edge-to-edge（該設定會強制所有 Modal 延伸到系統列
   * 後方）而又沒有安裝 `react-native-safe-area-context`，必須傳這個值，否則 chrome 會被系統列蓋住
   * （本欄位存在前就是如此）。
   */
  playerSafeAreaInsets?: Partial<LBSafeAreaInsets>;

  /** Optional style merged onto the container's outer (absolutely-positioned) view. */
  style?: ViewStyle;
}
