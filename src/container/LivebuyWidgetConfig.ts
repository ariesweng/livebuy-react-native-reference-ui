// LivebuyWidgetConfig — per-instance wiring for the drop-in `LivebuyWidget`
// container (introduce-dropin-widget-container-rn).
//
// Parity source: iOS `LivebuyWidgetConfig` (struct). EVERY interaction callback is
// OPTIONAL with a documented sensible default — a host that passes nothing still
// gets a working, scrolling widget list ("不 wire 也能顯示"); passing a callback
// REPLACES that one default.
//
// PURE TypeScript (type-only react-native imports) so it stays reliably testable in
// a plain node environment without dragging the RN runtime into jest.

import type { ViewStyle } from 'react-native';
import type { LBSdkEvent, LBVideoItem, SDKConfig } from 'livebuy-react-native';
import type { LBUIOptions } from 'livebuy-react-native-ui';

import type { WidgetGoods } from '../widget/WidgetModel';
import type { ReferenceUIDesign } from './ReferenceUIDesign';

/**
 * Per-instance wiring for {@link LivebuyWidget}. All callbacks optional; each has a
 * documented built-in default the container supplies when omitted. Mirrors the iOS
 * `LivebuyWidgetConfig`.
 */
export interface LivebuyWidgetConfig {
  // -- Optional explicit data overrides (turnkey defaults if omitted) ----------

  /**
   * The merchant SDKConfig used to attach the widget template + resolve the theme.
   * Omitted → the container fetches it via `LivebuySDK.getSdkConfig()` (the host
   * has already `configure()`d). Provide it to skip the async fetch (e.g. tests).
   */
  sdkConfig?: SDKConfig | null;
  /** Host UI options forwarded into the theme resolver. Default: `LivebuyUI.hostOptions`. */
  hostOptions?: LBUIOptions | null;

  /**
   * The design that composes the embedded widget surface (the design seam — parity with
   * iOS `LivebuyWidgetConfig.design`). Default: `MinimalDesign` (the existing
   * `WidgetOverlayView` dispatcher). The container delegates to
   * `resolveDesign(config.design).widgetSurface(context)`.
   */
  design?: ReferenceUIDesign;

  // -- Interaction callbacks (all optional, each defaulted) --------------------

  /**
   * An extra unified-event listener registered for the host (via core
   * `registerListener`). Does NOT replace the widget template's routing. Default: none.
   *
   * Delivery contract (rn-fold-host-listener-into-single-slot): every reference-ui container shares
   * ONE core registration through an internal ref-counted multiplexer, so this listener keeps
   * working while the widget's default-open `LivebuyPlayer` is on screen and survives that player's
   * unmount. Swapping the listener identity between renders never re-registers. A throw from this
   * listener is isolated — it cannot stop other containers' listeners from receiving the event.
   *
   * PREFER this over calling core `registerListener` yourself: core keeps a SINGLE active handler,
   * so a direct host registration and the reference-ui containers still replace each other.
   */
  eventListener?: (event: LBSdkEvent) => void;

  /**
   * Card tap (carousel / grid). Default: `undefined` → inert (the container NEVER
   * opens the player — a host wires this to open its own full-screen player for
   * `item.id`). The list still renders correctly; only the tap is inert until wired.
   */
  onTapVideo?: (item: LBVideoItem) => void;
  /** Carousel「查看更多 ›」header link. Default: `undefined` → inert. */
  onSeeMore?: () => void;
  /**
   * Called after the first load with the ordered video feed, so a host can keep its own
   * list state in sync (e.g. a floating live-entry preview). Default: none.
   */
  onVideosChanged?: (videos: readonly LBVideoItem[]) => void;

  /**
   * Per-card product overlay resolver. The RN core `LBVideoItem` has NO `goods`
   * field (the bridge omits it), so a real product overlay can only come from the
   * host here. Default: live cards show NO overlay; the opted-in demo fixtures use
   * the deterministic seed overlays.
   */
  goodsFor?: (item: LBVideoItem) => WidgetGoods | null;

  /**
   * When the live `/sdk/widget` fetch returns nothing, show demo fixtures + a
   * 「示範資料」caption. Default: `false` (PRODUCTION-SAFE — never show fake data to
   * real users). QA / example hosts opt-in `true`.
   */
  showsDemoFallbackWhenEmpty?: boolean;
  /**
   * Host-policy list auto-refresh interval in SECONDS. Default: `30` (`0` = disabled).
   * Distinct from `PollManager`'s 5s comment polling — this re-fetches page 1 of the
   * list. Skipped while showing demo fixtures and once a grid has paged forward.
   */
  listRefreshInterval?: number;

  /**
   * Real-cover flag (parity iOS `LivebuyWidgetConfig.live`). When `true` (the DEFAULT,
   * since the turnkey container is a host-runtime surface) widget cards load each
   * `video.cover` real photo OVER the deterministic placeholder (via the cards'
   * `RemoteImage` — on a load error it falls back to the placeholder). Set `false` to
   * keep the deterministic placeholder-only look (e.g. a host that prefers the monogram
   * tiles, or a demo). The reference-ui SURFACE default stays `false` (snapshot / golden
   * safe — `WidgetSurfaceContext.live` defaults `false`), so the per-card structural
   * snapshots are unchanged; only the turnkey container opts in to `true`.
   */
  live?: boolean;

  // -- container styling ------------------------------------------------------

  /** Optional style for the container's outer `View`. */
  style?: ViewStyle;
}
