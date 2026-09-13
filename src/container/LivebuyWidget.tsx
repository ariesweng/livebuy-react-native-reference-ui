// LivebuyWidget — turnkey drop-in widget-list container
// (introduce-dropin-widget-container-rn, reference-ui layer).
//
// Parity source: iOS `LivebuyWidget.swift` (the parent change). The SDK
// `LivebuyWidgetCore` is a HEADLESS data source; the RN reference-ui ships only
// loose widget surfaces (`WidgetOverlayView` + carousel/grid/floating/minimized)
// with NO live data consumer. To SEE a list a host had to attach a widget
// template, fetch each page via `LivebuySDK.fetchWidget`, feed `handleWidgetSnapshot`,
// and manage pagination + refresh. `LivebuyWidget` PROMOTES that assembly into the
// package so a host gets a working list in ONE line:
//
//     <LivebuyWidget shopId="Pw8PJ99J" />                       // turnkey carousel
//     <LivebuyWidget shopId="Pw8PJ99J" mode="grid" config={…} />
//
// `LivebuyWidget` is the GOLDEN NAME (D-0), freed by the prerequisite core change
// `rename-bare-widget-to-core-rn` (bare data source → `LivebuyWidgetCore`).
//
// RN vs iOS (drives this design): iOS drives data via the STATEFUL
// `LivebuyWidgetCore` + `template.reload()` / `requestLoadMore()`. RN's
// `WidgetTemplateAttachment` has NEITHER — widget data is HOST-WIRED (design D7),
// so this container plays the host: it fetches each page itself via
// `LivebuySDK.fetchWidget` (the prerequisite `fetch-widget-content-rn-core`) and
// feeds the result into `handleWidgetSnapshot` / `handleWidgetColors`, managing the
// page accumulation (grid load-more appends).
//
// PURE ASSEMBLY (governance): it only composes the existing `WidgetOverlayView`
// surface + the existing `attachWidgetTemplate` forwarders + core
// `LivebuySDK.fetchWidget` / `decodeWidgetSnapshot`. It adds NO view-model and NO
// pixels. Dependency stays one-way `reference-ui → template → core`.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Text, ProvideTightText } from '../TightText';

import { LivebuyPlayer } from './LivebuyPlayer';
import type { LivebuyPlayerConfig } from './LivebuyPlayerConfig';

import { LivebuySDK, registerListener } from 'livebuy-react-native';
import type { LBVideoItem, SDKConfig } from 'livebuy-react-native';
import { attachWidgetTemplate, LivebuyUI } from 'livebuy-react-native-ui';
import type { WidgetTemplateAttachment } from 'livebuy-react-native-ui';

import type { ReferenceUITheme } from '../theme';
import { ReferenceUIThemeResolver } from '../theme';

import { useContainerEventListener } from './containerEventListener';
import { resolveDesign } from './ReferenceUIDesign';
import type { LivebuyWidgetConfig } from './LivebuyWidgetConfig';
import type { WidgetContainerMode } from './widgetData';
import {
  lbWidgetDemoSnapshot,
  lbWidgetEffectiveTap,
  lbWidgetResolvedGoodsFor,
  lbWidgetShouldAutoRefreshTick,
  lbWidgetShouldUseDemoFallback,
  loadWidgetPage,
} from './widgetData';

export type { LivebuyWidgetConfig } from './LivebuyWidgetConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-hooks. `useSdkConfig` / `useResolvedTheme` are LOCAL parity copies of the
// player container's file-local hooks (NOT exported there) — kept here so this
// change stays self-contained and touches NO player-container code.
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve the SDKConfig once: prefer `config.sdkConfig`, else `LivebuySDK.getSdkConfig()`. */
function useSdkConfig(explicit: SDKConfig | null | undefined): SDKConfig | null {
  const [resolved, setResolved] = useState<SDKConfig | null>(explicit ?? null);
  useEffect(() => {
    if (explicit != null) {
      setResolved(explicit);
      return;
    }
    let cancelled = false;
    LivebuySDK.getSdkConfig()
      .then((c) => {
        if (!cancelled) setResolved(c);
      })
      .catch(() => {
        /* not configured yet — stay null; the host re-renders after configure() */
      });
    return () => {
      cancelled = true;
    };
  }, [explicit]);
  return resolved;
}

/** Resolve the reference-ui theme from the core theme + host options (existing resolver). */
function useResolvedTheme(
  sdkConfig: SDKConfig | null,
  hostOptions: LivebuyWidgetConfig['hostOptions'],
): ReferenceUITheme {
  return useMemo(
    () =>
      ReferenceUIThemeResolver.resolve({
        coreTheme: sdkConfig?.theme ?? null,
        hostOptions: hostOptions ?? LivebuyUI.hostOptions,
      }),
    [sdkConfig, hostOptions],
  );
}

/** Attach the Default widget template ONCE for the resolved `sdkConfig`; `detach()` on unmount. */
function useWidgetAttachment(
  sdkConfig: SDKConfig | null,
  hostOptions: LivebuyWidgetConfig['hostOptions'],
  shopId: string,
): WidgetTemplateAttachment | null {
  const [attachment, setAttachment] = useState<WidgetTemplateAttachment | null>(null);
  useEffect(() => {
    if (sdkConfig == null) return;
    const att = attachWidgetTemplate({
      sdkConfig,
      hostOptions: hostOptions ?? LivebuyUI.hostOptions,
      widgetKey: shopId,
    });
    setAttachment(att);
    return () => {
      att.detach();
      setAttachment(null);
    };
  }, [sdkConfig, hostOptions, shopId]);
  return attachment;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

/** Props for the turnkey drop-in {@link LivebuyWidget}. */
export interface LivebuyWidgetProps {
  /** Shop ID (base-62 short code) whose `/sdk/widget` list to fetch + render. */
  readonly shopId: string;
  /** Layout mode. Default `'carousel'`. */
  readonly mode?: WidgetContainerMode;
  /** Optional per-instance wiring. Omitting it gives a fully-defaulted list. */
  readonly config?: LivebuyWidgetConfig;
}

/**
 * Turnkey drop-in widget list. Attaches the Default widget template ONCE, resolves
 * the theme, fetches `/sdk/widget` content itself (host-wired, D7) and feeds it into
 * the template, then renders the existing `WidgetOverlayView`. Self-manages the load
 * lifecycle: first page → optional demo fallback → grid pagination → host-policy
 * 30s list refresh. Card taps / see-more forward via `config`.
 */
export function LivebuyWidget(props: LivebuyWidgetProps): ReactElement {
  const { shopId } = props;
  const config = props.config ?? {};
  const mode: WidgetContainerMode = props.mode ?? 'carousel';

  const sdkConfig = useSdkConfig(config.sdkConfig);
  const theme = useResolvedTheme(sdkConfig, config.hostOptions);
  const attachment = useWidgetAttachment(sdkConfig, config.hostOptions, shopId);

  // Mutable load state read by the interval / load-more closures (refs, not state).
  const accumulatedRef = useRef<readonly LBVideoItem[]>([]);
  const pageRef = useRef(1);
  const lastPageRef = useRef(1);
  const loadingRef = useRef(false);
  const usingDemoRef = useRef(false);
  const [usingDemo, setUsingDemo] = useState(false);

  // Default-open player presentation (dropin-widget-default-open-player-rn): a tap on a NON-external
  // card sets this ONLY when the host did NOT wire `config.onTapVideo`; the `<Modal>` in the render
  // then presents a full-screen `<LivebuyPlayer>`. `<Modal>` (top-level window) — not an in-tree view —
  // so the player is full-screen regardless of how small the widget is embedded (design D1). Stays
  // null when the host set `onTapVideo` (override) → the Modal never opens.
  const [presented, setPresented] = useState<LBVideoItem | null>(null);

  const fetchWidget = (id: string, page: number): Promise<Record<string, unknown>> =>
    LivebuySDK.fetchWidget(id, page);

  // First load + host-policy 30s refresh, re-armed only when the attachment / scope changes.
  useEffect(() => {
    if (attachment == null) return;
    let cancelled = false;

    const storePage1 = async (): Promise<readonly LBVideoItem[]> => {
      const r = await loadWidgetPage({ fetchWidget, attachment, shopId, mode, accumulated: [] }, 1, false);
      accumulatedRef.current = r.videos;
      pageRef.current = r.currentPage;
      lastPageRef.current = r.lastPage;
      return r.videos;
    };

    const firstLoad = async (): Promise<void> => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const videos = await storePage1();
        if (cancelled) return;
        if (lbWidgetShouldUseDemoFallback(videos.length === 0, config.showsDemoFallbackWhenEmpty ?? false)) {
          const demo = lbWidgetDemoSnapshot(mode);
          attachment.handleWidgetSnapshot(demo);
          accumulatedRef.current = demo.videos ?? [];
          usingDemoRef.current = true;
          setUsingDemo(true);
        }
        config.onVideosChanged?.(accumulatedRef.current);
      } catch (error) {
        // Keep the list empty on fetch failure (unchanged) — but a totally silent
        // catch here turned a real host-QA-reported failure into "nothing shows, no
        // error, nothing" for a full four-platform pass (rn-widget-live-entry-fetch-
        // error-visibility). __DEV__-gated so no console noise in release builds.
        if (__DEV__) {
          console.warn('[Livebuy] LivebuyWidget fetch failed; keeping list empty.', error);
        }
      } finally {
        loadingRef.current = false;
      }
    };

    void firstLoad();

    const interval = config.listRefreshInterval ?? 30;
    let timer: ReturnType<typeof setInterval> | null = null;
    if (interval > 0) {
      timer = setInterval(() => {
        if (loadingRef.current) return;
        if (!lbWidgetShouldAutoRefreshTick(usingDemoRef.current, pageRef.current)) return;
        loadingRef.current = true;
        void storePage1()
          .catch(() => undefined)
          .finally(() => {
            loadingRef.current = false;
          });
      }, interval * 1000);
    }

    return () => {
      cancelled = true;
      if (timer != null) clearInterval(timer);
    };
    // config fields are read at effect-run time; the container intentionally re-arms
    // only on attachment / shopId / mode (config is treated as stable per instance).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment, shopId, mode]);

  // Optional extra host listener (does NOT replace the widget template's routing), registered
  // through the shared single-slot multiplexer (rn-fold-host-listener-into-single-slot). core
  // `registerListener` keeps a SINGLE active handler, and this container's own default-open player
  // mounts `LivebuyPlayer` — which registers too. With a direct `registerListener` call the player
  // replaced this listener on open and, worse, its unmount cleanup wiped the slot entirely, so this
  // listener never came back (its `[config.eventListener]` effect does not re-run). The hook holds
  // the host listener in a ref (identity swaps never re-register) and ref-counts the ONE core slot,
  // so widget and player listeners now coexist and outlive each other's unmount.
  useContainerEventListener(registerListener, {
    host: config.eventListener,
    // rb-rn-dropin-container-event-forwarding — selective, opt-in defensive forward to a host-held
    // EXTERNAL PlayerTemplateAttachment (obtained outside this container, unrelated to this widget's
    // OWN WidgetTemplateAttachment content pipeline). `undefined` when omitted so this arm stays a
    // no-op and does not build a new closure each render for nothing.
    forward: config.externalTemplateAttachment
      ? (event) => config.externalTemplateAttachment?.handleEvent(event)
      : undefined,
  });

  // Grid load-more footer → fetch the next page + append (no-op for carousel / demo / past last page).
  const onLoadMore = (): void => {
    if (attachment == null || usingDemo || mode !== 'grid') return;
    if (pageRef.current >= lastPageRef.current || loadingRef.current) return;
    loadingRef.current = true;
    void loadWidgetPage(
      { fetchWidget, attachment, shopId, mode, accumulated: accumulatedRef.current },
      pageRef.current + 1,
      true,
    )
      .then((r) => {
        accumulatedRef.current = r.videos;
        pageRef.current = r.currentPage;
        lastPageRef.current = r.lastPage;
      })
      .catch(() => undefined)
      .finally(() => {
        loadingRef.current = false;
      });
  };

  // rb-rn-video-linked-goods-auto-render: host `config.goodsFor` (full override) >
  // opted-in demo seed overlays > (the common case) each card's own `item.goods`
  // (`video-linked-goods-core-rn`) — see `lbWidgetResolvedGoodsFor`.
  const goodsFor = lbWidgetResolvedGoodsFor(config.goodsFor, { usingDemo });

  // Config for the default-open player (dropin-widget-default-open-player-rn): inherits the widget's
  // design; dismiss / minimize close the Modal.
  const defaultPlayerConfig = makeDefaultPlayerConfig(config.design, () => setPresented(null));

  return (
    // rb-rn-refui-text-tighten-line-spacing: tighten line spacing (Android includeFontPadding=false)
    // for every card/caption Text in the widget surface (parity Android `ProvideTightText`).
    <ProvideTightText>
      <View style={[styles.container, config.style]}>
      {/* The embedded widget surface, composed by the resolved design
          (`config.design ?? MinimalDesign`). The default `MinimalDesign` returns the
          existing `WidgetOverlayView` dispatcher (carousel / grid / floating / minimized
          by `content.mode`) — composed exactly as before. */}
      {attachment != null
        ? resolveDesign(config.design).widgetSurface({
            widgetTemplate: attachment.template,
            theme,
            goodsFor,
            // The turnkey container is a host-runtime surface → load real card covers by
            // default (parity iOS `LivebuyWidgetConfig.live = true`). A host can opt out
            // (`config.live = false`) to keep the deterministic placeholder tiles.
            live: config.live ?? true,
            // Tap routing (dropin-widget-default-open-player-rn): host `onTapVideo` if wired, else the
            // DEFAULT that opens the in-app player full-screen via `<Modal>`. `WidgetOverlayView` wraps
            // this with `externalLiveAwareTap`, so external-platform lives still open their URL first.
            onTapVideo: lbWidgetEffectiveTap(config.onTapVideo, (item) => setPresented(item)),
            onSeeMore: config.onSeeMore,
            onLoadMore,
          })
        : null}
      {usingDemo ? (
        <Text style={[styles.demoCaption, { color: theme.text }]}>（示範資料 — 未取得 widget 列表）</Text>
      ) : null}
      {/* Default-open player (dropin-widget-default-open-player-rn). Inert while `presented == null`
          (host wired `onTapVideo`, or no tap yet) → at rest this renders nothing, so existing widget
          snapshots stay byte-identical. `<Modal>` is a top-level window → full-screen regardless of how
          small the widget is embedded (design D1). */}
      <Modal
        visible={presented != null}
        presentationStyle="fullScreen"
        animationType="slide"
        onRequestClose={() => setPresented(null)}
      >
        {presented != null ? (
          <LivebuyPlayer videoId={presented.id} config={defaultPlayerConfig} />
        ) : null}
      </Modal>
      </View>
    </ProvideTightText>
  );
}

/** Config for the default-open player. Inherits the widget's `design` (D4); `onDismiss` / `onMinimize`
 *  close the Modal (the default has no floating-preview target — the minimize→floating collapse is a
 *  host concern, design D1 tradeoff). */
function makeDefaultPlayerConfig(
  design: LivebuyWidgetConfig['design'],
  dismiss: () => void,
): LivebuyPlayerConfig {
  return { design, onDismiss: dismiss, onMinimize: dismiss };
}

const styles = StyleSheet.create({
  container: {},
  demoCaption: { fontSize: 11, opacity: 0.6, textAlign: 'center', paddingVertical: 6 },
});
