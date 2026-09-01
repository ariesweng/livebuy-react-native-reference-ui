// PlaybackProgressBarView — VOD / replay playback-progress transport bar (RN).
//
// Spec: `reference-ui-rendering/spec.md` "LivebuyReferenceUI 渲染 VOD/回放播放進度條
//   （PlaybackProgressBarView）" (rb-rn-vod-playback-progress-bar).
// Design: Claude Design「LiveBuy SDK Design Canvas」`screens.jsx` `LBPPlayerScreen`
//   "Playback progress bar — VOD and replay only" block — the SAME design source the DONE
//   iOS `PlaybackProgressBarView.swift` (`rb-ios-restore-vod-playback-progress-bar`) renders
//   pixel-for-pixel. This RN sibling reproduces the same two visual states with RN idioms
//   (`onLayout` measuring the track width instead of SwiftUI's synchronous `GeometryReader`,
//   `PanResponder` instead of `DragGesture`).
//
// Two visual states, ONE structurally-stable gesture-carrying track view:
//   - IDLE (not scrubbing): a 3px thin line pinned to the bottom edge, with an invisible ~20px
//     hit-area so a tap/press anywhere in that strip (not just exactly on the 3px line) starts
//     a scrub.
//   - EXPANDED (touch-down through the 2.8s post-release hold `PlayerShellView` owns): a full
//     transport bar — a play/pause button (a SEPARATE sibling, only present while expanded) +
//     the SAME track view, now taller with a white handle. While the finger is actually down
//     (`isScrubbing`) a centered `HH:MM:SS / HH:MM:SS` timestamp readout floats above the bar;
//     it disappears the instant the finger lifts even though the bar itself stays expanded for
//     the remainder of the hold (`PlayerShellView` owns that timer — see its `isScrubbing` vs
//     `scrubBarExpanded` state).
//
// GESTURE CONTINUITY: the track View is NEVER swapped for a different element when `isExpanded`
// flips — only its VISUAL styling (height / background opacity / handle presence) reacts. The
// play/pause button is a separate sibling that only APPEARS when expanded.
//
// TESTABILITY NOTE (see `sheetDragGesture.ts` / `PinnedCardCarousel`'s equivalent comments):
// this package's jest `react-native` mock stubs `PanResponder.create` to discard its config and
// return inert `panHandlers: {}` — no drag gesture can be SIMULATED through a renderer. All
// non-trivial arithmetic is therefore extracted into PURE, directly-unit-tested functions
// ({@link progressRatio}, {@link dragRatioFromOffset}, {@link formatTimestamp}); the component's
// OWN structural tests exercise the idle / expanded / scrubbing visual states by constructing it
// with `isScrubbing` / `isExpanded` / `position` / `duration` PROPS directly (this component
// never owns those two booleans itself — `PlayerShellView` does, exactly like iOS's
// `PlayerShellView` `@State`), not by simulating a touch.
//
// One-way data flow: this view reads ONLY its passed-in snapshot values and calls ONLY the
// action closures it is given (which `PlayerShellView` wires to `PlayerShellModel`'s EXISTING
// `togglePlayPause()` / `seek()` forwarders — no new core / view-model API).

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';

// MARK: - Design tokens (lifted from `screens.jsx` `LBPPlayerScreen`, parity iOS
// `PlaybackProgressBarView` static constants — same literal values).

const IDLE_LINE_HEIGHT = 3;
const HIT_AREA_HEIGHT = 20;
const TRACK_BACKGROUND_OPACITY = 0.28;

const TRANSPORT_SPACING = 10;
const TRANSPORT_HORIZONTAL_PADDING = 12;
const PLAY_PAUSE_BUTTON_SIZE = 28;
const PLAY_PAUSE_GLYPH_SIZE = 12;
const TRACK_HEIGHT = 3;
const EXPANDED_TRACK_BACKGROUND_OPACITY = 0.35;
const HANDLE_SIZE = 14;

const READOUT_SPACING = 6;
const READOUT_FONT_SIZE = 18;

/** Props for the {@link PlaybackProgressBarView} surface. */
export interface PlaybackProgressBarProps {
  /** The resolved reference-ui theme (first positional argument, always). */
  readonly theme: ReferenceUITheme;
  /** Current playhead, seconds. Ignored for the fill/readout while dragging (the drag uses its
   *  own local live ratio instead — see the file header). */
  readonly position: number;
  /** Total duration, seconds. */
  readonly duration: number;
  /** Whether the stream is currently playing — drives the play/pause button's icon. */
  readonly isPlaying: boolean;
  /** `true` while the finger is actually down (touch-down…touch-up). Drives: the centered
   *  timestamp readout, and (via the caller) which other chrome is hidden. Distinct from
   *  `isExpanded` — the transport-bar visual stays expanded LONGER than this. Owned by
   *  `PlayerShellView`, NOT this component. */
  readonly isScrubbing: boolean;
  /** `true` from touch-down through the post-release hold window. Drives the thin-line vs
   *  full-transport-bar visual. `PlayerShellView` owns the hold timer. */
  readonly isExpanded: boolean;
  /** Play/pause button tap → host-wired `model.togglePlayPause()`. Omitted → inert (demo/snapshot). */
  readonly onTogglePlayPause?: () => void;
  /** Touch-down on the track → host reports scrub start. Omitted → inert. */
  readonly onScrubStarted?: () => void;
  /** Drag moved → the new ratio `[0, 1]`. Host forwards to `model.seek(ratio * duration)`.
   *  Omitted → inert (demo / snapshot; the visual still tracks locally via the local drag ratio). */
  readonly onScrub?: (ratio: number) => void;
  /** Finger lifted → host reports scrub end (starts the post-release hold timer). Omitted → inert. */
  readonly onScrubEnded?: () => void;
}

/**
 * The VOD / replay playback-progress transport bar. `PlayerShellView` composes this as a
 * top-level sibling (over BOTH the VOD chrome and the LIVE-chrome branch), gated on its own
 * pure display function (`showsPlaybackProgressBar`, defined in `PlayerShellView.tsx`).
 *
 * Renders correctly with every callback omitted (structural snapshot tests construct it
 * action-free, per the sub-view input pattern).
 */
export function PlaybackProgressBarView(props: PlaybackProgressBarProps): ReactElement {
  const {
    theme,
    position,
    duration,
    isPlaying,
    isScrubbing,
    isExpanded,
    onTogglePlayPause,
    onScrubStarted,
    onScrub,
    onScrubEnded,
  } = props;

  // Local, optimistic drag ratio `[0, 1]` — non-nil only while a live drag gesture is being
  // tracked by THIS view. Used for both the track fill and the timestamp readout so both track
  // the finger with zero jitter, independent of the async `position` round-trip through core's
  // progress pump (mirrors the design's own local `progress * TOTAL_DURATION_SEC` formula and
  // iOS `PlaybackProgressBarView.dragRatio`).
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  // Track width, measured via `onLayout` (RN has no synchronous `GeometryReader`) — `0` until
  // the first layout pass; `dragRatioFromOffset` treats `<= 0` as "nothing to divide by" so the
  // very first frame is defensively inert rather than throwing/NaN.
  const [trackWidth, setTrackWidth] = useState(0);

  // Refs so the once-created PanResponder always reads current props/state without stale
  // closures (mirrors the established "refs so the once-created PanResponder reads current
  // state" pattern in this package — `PlayerShellView`'s swipe responder,
  // `LiveOverlayChromeView.PinnedCardCarousel`, `NowIntroducingCarouselView`).
  const trackWidthRef = useRef(trackWidth);
  trackWidthRef.current = trackWidth;
  const onScrubStartedRef = useRef(onScrubStarted);
  onScrubStartedRef.current = onScrubStarted;
  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;
  const onScrubEndedRef = useRef(onScrubEnded);
  onScrubEndedRef.current = onScrubEnded;

  // Reset the local drag ratio once the bar is fully back to idle so the NEXT scrub starts clean
  // rather than briefly flashing a stale ratio before the first touch lands (parity iOS
  // `.onChange(of: isExpanded)`).
  useEffect(() => {
    if (!isExpanded) setDragRatio(null);
  }, [isExpanded]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        // Touch-down claims the responder immediately (RN analogue of SwiftUI
        // `DragGesture(minimumDistance: 0)` — even a stationary touch-down fires the first
        // change). The touch's own location seeds BOTH the visual jump-to-touch AND the first
        // `onScrub` call, exactly like iOS's `beginScrub()` followed immediately by the first
        // `dragRatio(offsetX:trackWidth:)` computation in the same gesture callback.
        const ratio = dragRatioFromOffset(evt.nativeEvent.locationX, trackWidthRef.current);
        setDragRatio(ratio);
        onScrubStartedRef.current?.();
        onScrubRef.current?.(ratio);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const ratio = dragRatioFromOffset(evt.nativeEvent.locationX, trackWidthRef.current);
        setDragRatio(ratio);
        onScrubRef.current?.(ratio);
      },
      onPanResponderRelease: () => {
        onScrubEndedRef.current?.();
      },
      // Defensive: a terminated gesture (e.g. an OS-level interruption) is still a "finger lifted"
      // from this view's perspective — the caller's 2.8s hold timer must still fire, mirroring
      // `onPanResponderRelease`.
      onPanResponderTerminate: () => {
        onScrubEndedRef.current?.();
      },
    }),
  ).current;

  const ratio = dragRatio ?? progressRatio(position, duration);
  const lineHeight = isExpanded ? TRACK_HEIGHT : IDLE_LINE_HEIGHT;
  const containerHeight = isExpanded ? Math.max(TRACK_HEIGHT, HANDLE_SIZE) : HIT_AREA_HEIGHT;
  const fillWidth = trackWidth * ratio;

  return (
    <View testID={LBTestIDs.playbackProgressBar}>
      {/* Drag-time centered timestamp readout — ONLY while `isScrubbing` (NOT the whole
          `isExpanded` hold window; disappears the instant the finger lifts even though the bar
          itself stays expanded). Non-interactive so it never steals the drag from the track
          beneath it. */}
      {isScrubbing ? (
        <View
          pointerEvents="none"
          style={{ alignItems: 'center', paddingBottom: READOUT_SPACING }}
        >
          <Text
            testID={LBTestIDs.playbackProgressReadout}
            style={{
              fontSize: READOUT_FONT_SIZE * theme.fontScale,
              fontWeight: '700',
              color: '#FFFFFF',
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {`${formatTimestamp(ratio * Math.max(duration, 0))} / ${formatTimestamp(duration)}`}
          </Text>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: isExpanded ? TRANSPORT_HORIZONTAL_PADDING : 0,
        }}
      >
        {isExpanded ? (
          <>
            <PlayPauseButton
              isPlaying={isPlaying}
              onTap={onTogglePlayPause}
            />
            <View style={{ width: TRANSPORT_SPACING }} />
          </>
        ) : null}

        {/* The track: a structurally-stable View that exists in BOTH the idle and expanded
            states (never swapped away) so an in-flight touch survives the idle → expanded
            transition. Only its height / background opacity / handle presence react to
            `isExpanded`. */}
        <View
          testID={LBTestIDs.playbackProgressTrack}
          onLayout={(e): void => setTrackWidth(e.nativeEvent.layout.width)}
          {...responder.panHandlers}
          style={{
            flex: 1,
            height: containerHeight,
            // rb-rn-playback-progress-bar-bottom-flush-fix: idle (`!isExpanded`) pins the 3px
            // line to the bottom of the 20px invisible hit-area (`HIT_AREA_HEIGHT`) instead of
            // centering it — expanded keeps 'center' UNCHANGED (its 3px line sits inside the
            // 14px handle-driven container, `HANDLE_SIZE`, which must stay centered against the
            // handle; only the idle branch had the gap).
            justifyContent: isExpanded ? 'center' : 'flex-end',
          }}
        >
          <View
            style={{
              height: lineHeight,
              borderRadius: lineHeight / 2,
              backgroundColor: `rgba(255,255,255,${isExpanded ? EXPANDED_TRACK_BACKGROUND_OPACITY : TRACK_BACKGROUND_OPACITY})`,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: fillWidth,
                backgroundColor: '#FFFFFF',
              }}
            />
          </View>
          {isExpanded ? (
            <View
              style={{
                position: 'absolute',
                top: (containerHeight - HANDLE_SIZE) / 2,
                left: fillWidth - HANDLE_SIZE / 2,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                borderRadius: HANDLE_SIZE / 2,
                backgroundColor: '#FFFFFF',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.4,
                shadowRadius: 3,
                elevation: 3,
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

// MARK: - Play/pause button (separate sibling — only present while expanded)

function PlayPauseButton(props: { isPlaying: boolean; onTap?: () => void }): ReactElement {
  const { isPlaying, onTap } = props;
  return (
    <Pressable
      testID={LBTestIDs.playbackProgressPlayPause}
      onPress={() => onTap?.()}
      style={{
        width: PLAY_PAUSE_BUTTON_SIZE,
        height: PLAY_PAUSE_BUTTON_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PlayPauseGlyph isPlaying={isPlaying} size={PLAY_PAUSE_GLYPH_SIZE} />
    </Pressable>
  );
}

/** Self-drawn play (triangle, CSS border-trick) / pause (two bars) glyph — white, matches the
 *  established "draw a glyph via plain Views" convention in this package (`ShareGlyph` /
 *  `PersonEditGlyph` / `BagGlyph`) rather than an inconsistently-rendered Unicode pause glyph. */
function PlayPauseGlyph(props: { isPlaying: boolean; size: number }): ReactElement {
  const { isPlaying, size } = props;
  if (isPlaying) {
    const barWidth = size * 0.32;
    const gap = size * 0.24;
    return (
      <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
        <View style={{ width: barWidth, height: size, backgroundColor: '#FFFFFF' }} />
        <View style={{ width: gap }} />
        <View style={{ width: barWidth, height: size, backgroundColor: '#FFFFFF' }} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: size * 0.12,
          borderTopWidth: size / 2,
          borderBottomWidth: size / 2,
          borderLeftWidth: size,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: '#FFFFFF',
        }}
      />
    </View>
  );
}

// MARK: - Pure functions (unit-testable, docs/unit-test-discipline.md)

/**
 * The idle-line / track fill ratio `[0, 1]`. `duration` non-finite or `<= 0` → `0` (no timeline
 * to show a ratio of). Pure. Parity iOS `PlaybackProgressBarView.progressRatio(position:duration:)`.
 */
export function progressRatio(position: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return 0;
  return Math.min(Math.max(position / duration, 0), 1);
}

/**
 * The live drag ratio `[0, 1]` from a horizontal touch offset within a track of the given width.
 * `trackWidth <= 0` → `0` (nothing to divide by). Pure. Parity iOS
 * `PlaybackProgressBarView.dragRatio(offsetX:trackWidth:)`.
 */
export function dragRatioFromOffset(offsetX: number, trackWidth: number): number {
  if (trackWidth <= 0) return 0;
  return Math.min(Math.max(offsetX / trackWidth, 0), 1);
}

/**
 * Format a seconds count as a FIXED 3-segment, zero-padded `HH:MM:SS` — the hour segment is
 * ALWAYS shown, even when it is `00` (unlike a typical player's "drop the hour under 1h"
 * convention). Negative / non-finite input clamps to `0`. Pure. Parity iOS
 * `PlaybackProgressBarView.formatTimestamp(_:)`.
 */
export function formatTimestamp(totalSeconds: number): string {
  const clamped = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const total = Math.round(clamped);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

export default PlaybackProgressBarView;
