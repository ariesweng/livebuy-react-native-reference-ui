// CollapsibleLivebuyPlayer — collapsible player presenter (RN, rb-rn-collapsible-player).
//
// Parity: iOS `Container/LivebuyPlayerPresenter.swift` (`livebuyPlayer(video:)`), Flutter
// `CollapsibleLivebuyPlayer`, Android Compose `CollapsibleLivebuyPlayer` — the turnkey
// "full-screen player + minimize → bottom-right floating preview" container. Four-platform
// parity: RN previously had NO collapsible presenter (minimize→floating was host-owned and
// unimplemented in the sample); this builds it.
//
// COMPOSITION: an OVERLAY component the host stacks ABOVE its app shell (so the floating preview
// survives tab switches — issue 3). `video != null` → the turnkey `LivebuyPlayer` is composed
// FULL-SCREEN; the minimize seam (`config.onMinimize`, taken over here) COLLAPSES it to a
// bottom-right `FloatingWidget` preview card.
//
// KEEP-ALIVE (issue 5, iOS / Flutter / Android parity): the `LivebuyPlayer` stays MOUNTED the
// whole time a session exists — minimize only HIDES it (an outer `View` with `opacity: 0` +
// `pointerEvents="none"`), it is NOT torn down — so the same `videoId` keeps the native player
// alive (playback continues, no reload) and tapping the card to restore is an instant RESUME.
// `pointerEvents="none"` is the RN equivalent of iOS `allowsHitTesting(false)` / Flutter
// `IgnorePointer`: the hidden full player intercepts nothing and touches PASS THROUGH to the host
// shell below.
//
// DRAG/TAP (issue 4): the floating card is draggable (`Animated.ValueXY` + `PanResponder`),
// clamped on-screen via `clampFloatingOffset`; a TAP restores. The drag recognizer and the card's
// own tap / close (`FloatingWidget`'s separate front-most close `Pressable`) are separated. The
// pure phase / reopen / clamp helpers live in `./collapsibleLogic` (type-only imports → testable
// without the native bridge).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import type { LBVideoItem } from 'livebuy-react-native';

import type { ReferenceUITheme } from '../theme';

import { LivebuyPlayer } from './LivebuyPlayer';
import type { LivebuyPlayerConfig } from './LivebuyPlayerConfig';
import { resolveDesign } from './ReferenceUIDesign';
import { ProvideTightText } from '../TightText';
import {
  clampFloatingOffset,
  presenterWidgetCovered,
  shouldReopenOnVideoChange,
} from './collapsibleLogic';
import type { Point, Sizing } from './collapsibleLogic';
import { LivebuyWidgetVisibility } from '../widget/livebuyWidgetVisibility';

/** Resting bottom-right padding of the floating card (parity iOS `floatingInset`). */
const FLOATING_INSET: Point = { x: 12, y: 24 };

/** Props for the turnkey collapsible player {@link CollapsibleLivebuyPlayer}. */
export interface CollapsibleLivebuyPlayerProps {
  /** The host's session source of truth: non-null → present; null → fully closed. */
  readonly video: LBVideoItem | null;
  /** Called when the presenter clears the session (close / fatal dismiss) → host sets `video` null. */
  readonly onVideoChanged: (video: LBVideoItem | null) => void;
  /** Resolved reference-ui theme for the floating card. */
  readonly theme: ReferenceUITheme;
  /** The host's player config. The presenter OWNS `onMinimize` / `onDismiss`; the rest passes through. */
  readonly config?: LivebuyPlayerConfig;
}

/**
 * The turnkey collapsible player OVERLAY: full-screen {@link LivebuyPlayer} for the bound `video`,
 * with a built-in minimize → bottom-right floating preview. Place it ABOVE the host's app shell so
 * the floating preview survives navigation (issue 3). `video == null` → renders nothing.
 */
export function CollapsibleLivebuyPlayer(props: CollapsibleLivebuyPlayerProps): ReactElement | null {
  const { video, onVideoChanged, theme } = props;
  const config = props.config ?? {};

  const [isMinimized, setMinimized] = useState(false);
  // Mirror the latest `isMinimized` into a ref so the reopen effect reads it without re-running.
  const isMinimizedRef = useRef(false);
  isMinimizedRef.current = isMinimized;

  // The video the floating preview card SHOWS (rb-rn-collapsible-player-track-switch). Init to the
  // entry `video`; an IN-PLACE switch (swipe / hot-pick / watch-next) is reported via
  // `config.onVideoSwitchedItem` (consumed in `composedConfig` below), which updates this to the
  // switched video's item (REAL cover / title for hot-pick / watch-next; cover-empty + right id for
  // swipe). Distinct from the host's `video` (which drives the keep-alive `videoId` prop + the
  // auto-restore trigger): an in-place switch updates ONLY `shownVideo`, NOT the keep-alive prop —
  // the switch already loaded in the native player, so re-driving the prop would force a redundant
  // reload (same as Android; no latch needed — auto-restore keys on the host `video.id`).
  const [shownVideo, setShownVideo] = useState<LBVideoItem | null>(video);
  const shownVideoIdRef = useRef<string | null>(video?.id ?? null);
  shownVideoIdRef.current = shownVideo?.id ?? null;

  // Drag state: `pan` is the live Animated offset; `committedRef` is the resting (clamped) offset;
  // the size refs feed the clamp. All bottom-right-anchored → resting offset is {0,0}.
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const containerSizeRef = useRef<Sizing>({ width: 0, height: 0 });
  const cardSizeRef = useRef<Sizing>({ width: 0, height: 0 });
  const committedRef = useRef<Point>({ x: 0, y: 0 });

  const resetFloating = (): void => {
    committedRef.current = { x: 0, y: 0 };
    pan.setOffset({ x: 0, y: 0 });
    pan.setValue({ x: 0, y: 0 });
    setMinimized(false);
  };

  const close = (): void => {
    onVideoChanged(null);
    resetFloating();
  };

  // A newly-bound video (different id) while minimized → close the floating preview and re-present
  // full-screen for the new video (e.g. tapping another carousel card). Tapping the card to RESTORE
  // keeps the same id, so it never trips this (no id change).
  const videoId = video?.id ?? null;
  useEffect(() => {
    // A HOST swap re-seeds the floating card's shown video to the new host video (an in-place
    // switch never changes `video.id`, so this only fires for genuine host-driven swaps).
    setShownVideo(video);
    if (shouldReopenOnVideoChange(videoId, isMinimizedRef.current)) {
      resetFloating();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Drive the opt-in cover bridge by collapsible PHASE — this presenter is the SINGLE OWNER of
  // `LivebuyWidgetVisibility.setWidgetsCovered` (rn-refui-presenter-widget-cover-by-phase, RN parity of
  // iOS `LivebuyPlayerPresenter.syncWidgetCover`). Contract: `covered ⟺ phase === 'full' ⟺
  // (video != null && !isMinimized)` (via `presenterWidgetCovered`). ONE effect keyed
  // `[videoId, isMinimized]` covers every phase flip: open (null→id) / minimize / restore / close
  // (id→null) / host-swap auto-restore (the `[videoId]` effect above already set `isMinimized=false`,
  // so this effect — running after render with the latest state — reads the restored phase) / internal
  // switch. It also fires on the FIRST render (mount), covering "host mounts already holding a non-null
  // video → straight to full-screen" (iOS `onAppear`). `setWidgetsCovered` is edge-triggered (same-value
  // no-op), so repeated calls across re-renders are safe. CLEANUP (unmount) resets covered=false so the
  // home previews are never left permanently stuck in cover-pause (iOS `onDisappear` — important edge
  // case). This drives the EXISTING bridge only: no change to the bridge / gate / `LoopingVideoView` /
  // phase machine / keep-alive overlay / floating card / drag / view-model / core / native bridge.
  useEffect(() => {
    LivebuyWidgetVisibility.setWidgetsCovered(presenterWidgetCovered(video != null, isMinimized));
    return () => {
      LivebuyWidgetVisibility.setWidgetsCovered(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, isMinimized]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
        onPanResponderGrant: () => {
          pan.setOffset({ x: committedRef.current.x, y: committedRef.current.y });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_e, g) => {
          const clamped = clampFloatingOffset({
            committed: committedRef.current,
            translation: { x: g.dx, y: g.dy },
            cardSize: cardSizeRef.current,
            containerSize: containerSizeRef.current,
            inset: FLOATING_INSET,
          });
          committedRef.current = clamped;
          pan.setOffset({ x: 0, y: 0 });
          pan.setValue(clamped);
        },
      }),
    [pan],
  );

  if (video == null) return null;

  // Presenter-owned seams: minimize collapses to the floating preview (keep the session alive); a
  // fatal-moment dismiss (end-screen close / unrecoverable error close) closes everything. Every
  // OTHER seam passes through unchanged via spread.
  const composedConfig: LivebuyPlayerConfig = {
    ...config,
    onMinimize: () => setMinimized(true),
    onDismiss: () => close(),
    // In-place switch (swipe / hot-pick / watch-next) → re-bind the FLOATING card's shown video to
    // the switched video's item so the minimized preview shows the switched video, NOT the entry
    // `video` (rb-rn-collapsible-player-track-switch). Guard same-id (via the ref, no stale closure)
    // so a no-op switch neither re-binds nor churns. Does NOT touch the keep-alive prop (`video.id`)
    // → no redundant reload + no auto-restore misfire. Any host-supplied `onVideoSwitchedItem` is
    // preserved by chaining (the host still gets the switched item).
    onVideoSwitchedItem: (item) => {
      config.onVideoSwitchedItem?.(item);
      if (item.id !== shownVideoIdRef.current) setShownVideo(item);
    },
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e: LayoutChangeEvent): void => {
        const { width, height } = e.nativeEvent.layout;
        containerSizeRef.current = { width, height };
      }}
    >
      {/* KEEP-ALIVE full player: mounted the whole time `video != null`. Minimize only HIDES it
          (opacity 0 + pointerEvents none) → playback continues, same id → no reload, touches pass
          through to the host. */}
      <View
        style={[StyleSheet.absoluteFill, isMinimized ? styles.hidden : null]}
        pointerEvents={isMinimized ? 'none' : 'auto'}
      >
        <LivebuyPlayer videoId={video.id} config={composedConfig} />
      </View>

      {/* Bottom-right floating preview while minimized. Draggable (clamped on release); a tap on
          the card restores, the close button clears. */}
      {isMinimized ? (
        <Animated.View
          style={[styles.floating, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
          onLayout={(e: LayoutChangeEvent): void => {
            const { width, height } = e.nativeEvent.layout;
            cardSizeRef.current = { width, height };
          }}
          {...panResponder.panHandlers}
        >
          {/* The floating preview card, composed by the resolved design
              (`config.design ?? MinimalDesign`). The default `MinimalDesign` returns the
              existing family-5 `FloatingWidget`. rb-rn-refui-text-tighten-line-spacing:
              tighten the floating card's caption/title line spacing (the expanded
              `LivebuyPlayer` above already self-wraps in ProvideTightText). */}
          <ProvideTightText>
            {resolveDesign(config.design).floatingPlayerCard({
              theme,
              // The SWITCHED video (rb-rn-collapsible-player-track-switch): an in-place switch
              // updates `shownVideo` so the card shows the switched video, not the entry `video`.
              liveVideo: shownVideo ?? video,
              onTap: (): void => resetFloating(),
              onClose: (): void => close(),
            })}
          </ProvideTightText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  floating: {
    position: 'absolute',
    right: FLOATING_INSET.x,
    bottom: FLOATING_INSET.y,
  },
});
