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

  /** Optional style merged onto the container's outer (absolutely-positioned) view. */
  style?: ViewStyle;
}
