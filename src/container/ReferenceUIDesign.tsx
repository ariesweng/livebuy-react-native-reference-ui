// ReferenceUIDesign — the design seam (RN parity with iOS
// `ReferenceUIDesign.swift` / `MinimalDesign.swift`).
//
// The three turnkey containers (`LivebuyPlayer` / `LivebuyWidget` /
// `CollapsibleLivebuyPlayer`) used to hard-code the concrete `minimal` surfaces at
// the assembly point: the player overlay composed `PlayerShellView` + `FeedWinView` +
// `ProductSheetsView` + `GapSurfacesOverlayView` + `ChatComposerBar` + `MomentsView`;
// the widget container `new`ed `WidgetOverlayView`; the collapsible presenter drew
// `FloatingWidget`.
//
// The containers are already decoupled from THEME (`ReferenceUIThemeResolver` resolves
// a `ReferenceUITheme` 5-token palette and passes it down), but they were hard-bound to
// the `minimal` DESIGN (which surfaces, in what layout). A whole different design —
// different component shapes + layout structure + color system, beyond what the thin
// `ReferenceUITheme` palette can express — had no seam to plug into.
//
// `ReferenceUIDesign` is that seam (iOS decision D1: granularity A — the WHOLE overlay /
// widget surface / floating card is ONE builder, so a design can change the LAYOUT, not
// just swap surfaces). It is an INTERFACE, not an enum switch (iOS D2): the container
// holds the abstraction and knows NOTHING about any concrete design — no
// `switch design { … }`. That forward-fits an externally-hosted design (the container
// MUST NOT import any concrete design). Builders return `ReactElement` (the RN analogue
// of iOS's type-erased `AnyView`); each container has exactly one overlay root.
//
// This is a PURE DECOUPLING seam: `MinimalDesign` (below) wraps the existing minimal
// composition VERBATIM and is the default conformer; behaviour is identical (the
// per-surface family structural snapshots stay zero-diff). The container does NOT read
// backend `sdkConfig.design` here — backend-selectable design is a follow-up.
//
// RN vs iOS shape notes (drives this file):
//   • PLAYER OVERLAY — iOS composes the whole ZStack inside `PlayerOverlayRootView`; RN
//     composes it inside the file-local `LivebuyPlayerOverlays` function component. The
//     `PlayerOverlayContext` therefore bundles the SAME inputs `LivebuyPlayerOverlays`
//     already takes (the bound `attachment` + theme + config + composer + playerRef +
//     in-place-switch closures). `MinimalDesign.playerOverlay` returns that component.
//   • WIDGET SURFACE — iOS exposes TWO builders (`widgetCarousel` / `widgetGrid`)
//     because the iOS container picks the layout per mode. RN's container instead
//     renders the SINGLE `WidgetOverlayView` dispatcher (it switches on `content.mode`
//     internally), so the RN seam exposes ONE `widgetSurface(context)` builder — the
//     existing single widget assembly point — to stay behaviour-neutral (pure extract,
//     no re-plumb). The carousel-vs-grid layout choice stays where it already lives
//     (inside `WidgetOverlayView`).
//   • FLOATING CARD — iOS / RN both draw the family-5 `FloatingWidget`; the seam is
//     `floatingPlayerCard(context)`.

import type { ReactElement, RefObject } from 'react';

import type { LivebuyPlayerCoreRef, LBVideoItem } from 'livebuy-react-native';
import type { PlayerTemplateAttachment, DefaultWidgetTemplate } from 'livebuy-react-native-ui';

import type { ReferenceUITheme } from '../theme';
import type { VTTCue } from '../playershell/VTTSubtitleParser';
import type {
  ChatComposerController,
  NicknamePromptController,
  LoginPromptController,
} from './ChatComposerBar';
import type { LivebuyPlayerConfig } from './LivebuyPlayerConfig';
import type { WidgetGoods } from '../widget/WidgetModel';

import { LivebuyPlayerOverlays } from './LivebuyPlayerOverlays';
import { WidgetOverlayView } from '../widget/WidgetOverlayView';
import { FloatingWidget } from '../widget/FloatingWidgetView';

// ─────────────────────────────────────────────────────────────────────────────
// Per-surface context value types
//
// Each builder receives a context value type that bundles the bound template /
// attachment + the resolved `ReferenceUITheme` + the host-wired interaction inputs the
// surface needs. The context holds NO state of its own — only references to the
// existing attachment / models / closures — so a design reads it and returns pixels.
// All fields are public so a host-supplied `ReferenceUIDesign` (via `config.design`) can
// read them.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inputs for the WHOLE player overlay (granularity A: the entire overlay tree is one
 * seam). Mirror of the props the minimal `LivebuyPlayerOverlays` composes; a design
 * decides how to lay them out. (RN composes the overlay from the bound `attachment` +
 * the container's seam closures, NOT from individual SwiftUI view-models like iOS — the
 * RN family overlays take `attachment.template` directly.)
 */
export interface PlayerOverlayContext {
  /** The attached Default player template every family overlay binds. */
  readonly attachment: PlayerTemplateAttachment;
  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;
  /** The per-instance container config (each seam is `config.onX ?? default`). */
  readonly config: LivebuyPlayerConfig;
  /** The on-demand chat-composer controller (LIVE「留言...」pill input panel). */
  readonly composer: ChatComposerController;
  /** The on-demand 設定暱稱 modal controller (LIVE 暱稱 button + 留言 gating). */
  readonly nickname: NicknamePromptController;
  /** The on-demand「請先登入」modal controller (LIVE 留言 login gate; rb-rn-live-comment-login-gate). */
  readonly login: LoginPromptController;
  /** The native core player ref the player-bound seams drive. */
  readonly playerRef: RefObject<LivebuyPlayerCoreRef | null>;
  /** Reads the currently-shown video id (cover loads + in-place switches). */
  readonly currentVideoId: () => string;
  /** Records an in-place video switch and notifies the host. */
  readonly switchVideo: (id: string) => void;
  /**
   * Reads the most recently received `LBPlayerChannelInfo.serviceLink` (from the container's
   * `<LivebuyPlayerCore onChannelChange>` subscription; dropin-service-link-default-browser-rn).
   */
  readonly serviceLink: () => string;
  /**
   * VOD CC 字幕 cue 清單（rb-react-native-subtitle-vtt-caption-display）——container-held React
   * state, fetched + parsed from `channel.subtitle_url` after `onChannelChange`; threaded down to
   * `PlayerShellView.subtitleCues` (design.md D1). Default `[]`.
   */
  readonly subtitleCues?: readonly VTTCue[];
  /**
   * The container's「現正直播」poll result (rb-rn-live-now-pill) — container-held React state
   * from `LivebuyPlayer.tsx`'s file-local `useLiveNowPoll(config.shopId)`, already gated through
   * the existing pure `liveEntryGate` (only `liveStatus === 1` counts). `null` (no `config.shopId`
   * wired, or no live currently detected) → `LiveNowPillView` never mounts. Threaded down through
   * `LivebuyPlayerOverlays`, which derives `hasLiveNow` from it and builds the tap handler
   * (`seams.ts` `buildGoLiveHandler`) — this context field carries the RAW value, not a boolean,
   * so the design layer's `onGoLive` closure can resolve the FULL `LBVideoItem` at tap time (the
   * single source of truth, parity iOS `coordinator.liveNowController.liveNow` / Android
   * `liveNowController?.liveNow`). Default `undefined`.
   */
  readonly liveNow?: LBVideoItem | null;
  /**
   * The EndScreen 空狀態's「直播時長：…」line, ALREADY FORMATTED (`HH:MM:SS` or `''`) —
   * container-held React state from `LivebuyPlayer.tsx`'s `onChannelChange` handler, which
   * derives it from `LBPlayerChannelInfo.liveDurationSeconds` (moment-state-sourced raw seconds)
   * via the pure `deriveLiveDuration` fold (`channelChrome.ts`, rb-rn-endscreen-live-duration).
   * Threaded straight down to `MomentsView.liveDuration` — bypasses the `react-native-ui`
   * template package entirely, mirroring this context's own `live`/`cleanMode` precedent.
   * Default `''` (renders `MomentsView`/`EndScreenView`'s existing `"--:--:--"` fallback).
   */
  readonly liveDuration?: string;
}

/**
 * Inputs for the embedded widget surface. RN renders the SINGLE `WidgetOverlayView`
 * dispatcher (carousel / grid / floating / minimized by `content.mode`), so this drives
 * that one surface (unlike iOS's split carousel/grid builders).
 */
export interface WidgetSurfaceContext {
  /**
   * Live WIDGET template (host-supplied); `null` → deterministic demo seeds.
   *
   * This is also how a host-supplied design reaches the widget's `/sdk/widget` root
   * settings: `new WidgetModel(context.widgetTemplate)` exposes `widgetColor` /
   * `widgetBgcolor` / `productCard`. That is why this context carries NO separate
   * `productCard` field — the default `MinimalDesign` hands the template to
   * `WidgetOverlayView`, which builds the model and forwards `model.productCard` down to
   * the cards, so a second copy of the same fact would only be able to disagree
   * (rb-rn-widget-product-card-modes D7).
   */
  readonly widgetTemplate: DefaultWidgetTemplate | null;
  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;
  /** Per-card product overlay resolver (RN core `LBVideoItem` has no `goods` field). */
  readonly goodsFor: (item: LBVideoItem) => WidgetGoods | null;
  /**
   * Real-cover flag (parity iOS `WidgetSurfaceContext.live`). `false` (the DEFAULT —
   * snapshot / demo) → widget cards draw ONLY the deterministic placeholder (structural
   * snapshots unchanged); `true` (host runtime) → real `video.cover` photos load over
   * the placeholders. The container (`LivebuyWidget`) sets this from
   * `LivebuyWidgetConfig.live`.
   */
  readonly live?: boolean;
  /** Card tap (carousel / grid) → host. */
  readonly onTapVideo?: (item: LBVideoItem) => void;
  /** Carousel header「查看更多 ›」→ host. */
  readonly onSeeMore?: () => void;
  /** Grid load-more footer → host fetch + append. */
  readonly onLoadMore: () => void;
}

/** Inputs for the minimize floating-preview card. */
export interface FloatingCardContext {
  /** The single live preview video (`null` → the card renders nothing). */
  readonly liveVideo: LBVideoItem | null;
  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;
  /** Whole-card tap → restore full-screen. */
  readonly onTap: (item: LBVideoItem) => void;
  /** Top-right close → clear the session. */
  readonly onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// The design seam
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A `ReferenceUIDesign` composes a WHOLE container surface from the bound
 * attachment / template + theme + host inputs it is handed (granularity A). The turnkey
 * containers delegate to it and know nothing about any concrete design (interface, not
 * enum). {@link MinimalDesign} is the default conformer; a host overrides via
 * `LivebuyPlayerConfig.design` / `LivebuyWidgetConfig.design` /
 * `CollapsibleLivebuyPlayerProps.design`.
 */
export interface ReferenceUIDesign {
  /**
   * The whole player overlay (chrome + feed/win + product sheets + gap surfaces +
   * on-demand chat composer + moments), composed however this design lays it out.
   */
  playerOverlay(context: PlayerOverlayContext): ReactElement;

  /**
   * The embedded widget surface (the single `WidgetOverlayView` dispatcher —
   * carousel / grid / floating / minimized by `content.mode`).
   */
  widgetSurface(context: WidgetSurfaceContext): ReactElement;

  /** The minimize floating-preview card. */
  floatingPlayerCard(context: FloatingCardContext): ReactElement | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MinimalDesign — the default ReferenceUIDesign conformer
//
// `MinimalDesign` wraps the existing `minimal` surface composition VERBATIM: the same
// surfaces, the same `LivebuyPlayerOverlays` overlay tree / z-order / passthrough
// hit-test, the same `WidgetOverlayView` / `FloatingWidget`. It is the default design
// for all three containers (`resolveDesign()` returns it when the host does not
// override). Because the composition is unchanged, behaviour is identical and the
// existing family structural snapshots stay zero-diff.
//
// This is the ONLY place the concrete minimal surface components are instantiated by the
// containers; the containers themselves only see the `ReferenceUIDesign` abstraction.
// ─────────────────────────────────────────────────────────────────────────────

/** The default {@link ReferenceUIDesign} — wraps the existing minimal composition verbatim. */
export const MinimalDesign: ReferenceUIDesign = {
  /**
   * The whole player overlay: the existing `LivebuyPlayerOverlays` tree (player-shell
   * chrome + feed/win + product sheets + gap surfaces + on-demand composer + moments),
   * composed exactly as before — only the inputs now arrive bundled in a
   * {@link PlayerOverlayContext}.
   */
  playerOverlay(context: PlayerOverlayContext): ReactElement {
    return (
      <LivebuyPlayerOverlays
        attachment={context.attachment}
        theme={context.theme}
        config={context.config}
        composer={context.composer}
        nickname={context.nickname}
        login={context.login}
        playerRef={context.playerRef}
        currentVideoId={context.currentVideoId}
        switchVideo={context.switchVideo}
        serviceLink={context.serviceLink}
        subtitleCues={context.subtitleCues}
        liveNow={context.liveNow}
        liveDuration={context.liveDuration}
      />
    );
  },

  /** The embedded widget surface — the existing `WidgetOverlayView` dispatcher. */
  widgetSurface(context: WidgetSurfaceContext): ReactElement {
    return (
      <WidgetOverlayView
        widgetTemplate={context.widgetTemplate}
        theme={context.theme}
        goodsFor={context.goodsFor}
        live={context.live ?? false}
        onTapVideo={context.onTapVideo}
        onSeeMore={context.onSeeMore}
        onLoadMore={context.onLoadMore}
      />
    );
  },

  /** The minimize floating-preview card — the existing family-5 `FloatingWidget`. */
  floatingPlayerCard(context: FloatingCardContext): ReactElement | null {
    return (
      <FloatingWidget
        theme={context.theme}
        liveVideo={context.liveVideo}
        onTap={context.onTap}
        onClose={context.onClose}
      />
    );
  },
};

/**
 * Resolve the {@link ReferenceUIDesign} a container should use: the host-supplied
 * `config.design` if present, else the default {@link MinimalDesign}. The container
 * delegates to the resolved design and knows nothing about any concrete design.
 */
export function resolveDesign(design: ReferenceUIDesign | null | undefined): ReferenceUIDesign {
  return design ?? MinimalDesign;
}
