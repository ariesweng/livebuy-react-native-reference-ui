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
//
// DRAG-SEEK THROTTLE (rb-rn-progress-bar-drag-seek-throttle): the `onScrub` prop's default wiring
// (`PlayerShellView.handleScrub`) forwards straight to `model.seek(...)`, which ultimately calls
// `UIManager.dispatchViewManagerCommand` — a REAL cross JS/native bridge dispatch, not a cheap
// local call (parity with the same root cause already fixed on Flutter's `MethodChannel`
// equivalent, `rb-flutter-progress-bar-drag-seek-throttle`). Calling `onScrub` on every single
// `onPanResponderMove` therefore means one bridge dispatch per dragged pixel, which is what causes
// visible jank. The VISUAL drag ratio (`dragRatio` state, driving the handle position / fill)
// still updates on every move — only the actual `onScrub` CALL is throttled to at most once per
// {@link DRAG_SEEK_THROTTLE_MS} via the pure {@link shouldEmitDragSeek}. Touch-down
// (`onPanResponderGrant`) and release/cancel (`onPanResponderRelease` /
// `onPanResponderTerminate`) are exempt from the throttle — they always force-emit, so the
// gesture's start and end are never dropped (see `emitSeek` below).

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
const PLAY_PAUSE_GLYPH_SIZE = 14;
const TRACK_HEIGHT = 3;
const EXPANDED_TRACK_BACKGROUND_OPACITY = 0.35;
const HANDLE_SIZE = 14;

// rb-rn-intro-progress-bar-followup-fix: play/pause tap target enlargement. The button's visual
// size (`PLAY_PAUSE_BUTTON_SIZE`, unchanged) is separate `<View style={{ width: TRANSPORT_SPACING
// }} />` spacer AWAY from the progress track — `PLAY_PAUSE_HIT_SLOP` extends the TOUCHABLE area
// into part of that spacer via `hitSlop`, without touching the button's own visual style. MUST
// stay strictly less than `TRANSPORT_SPACING` on the side facing the track (right) so the
// enlarged hit area never reaches, let alone overlaps, the track's own `PanResponder` touch area
// — deliberately leaves a buffer (5 of the 10px gap) rather than using the whole gap, so a future
// tweak to either constant doesn't silently introduce an overlap. Applied uniformly on all four
// sides for a single, easy-to-reason-about value (there is no other touchable neighbor above,
// below, or to the left within `TRANSPORT_HORIZONTAL_PADDING` that this needs to avoid).
const PLAY_PAUSE_HIT_SLOP = 5;

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
  /** Touch-down on the track, called right alongside {@link onScrubStarted} — SYNCHRONOUS
   *  drag-boundary hint for host state that must complete BEFORE the drag's own seek calls
   *  (e.g. the engine seek-precision toggle, `rn-vod-scrub-seek-tolerance-reference-ui`).
   *  Deliberately separate from `onScrubStarted` (a different, longer-standing concern) rather
   *  than folded into it, so the two call sites stay independently readable. Omitted → inert
   *  (the natural state on iOS, which has no matching core capability). */
  readonly onScrubBegin?: () => void;
  /** Drag moved → the new ratio `[0, 1]`. Host forwards to `model.seek(ratio * duration)`.
   *  Omitted → inert (demo / snapshot; the visual still tracks locally via the local drag ratio). */
  readonly onScrub?: (ratio: number) => void;
  /** Finger lifted → host reports scrub end (starts the post-release hold timer). Omitted → inert. */
  readonly onScrubEnded?: () => void;
  /** Finger lifted or gesture cancelled, called right alongside {@link onScrubEnded} but BEFORE
   *  the gesture's final forced `onScrub` call (`rn-vod-scrub-seek-tolerance-reference-ui`) — so
   *  a precision-toggle-style subscriber can complete before that last, position-determining seek
   *  is dispatched. See {@link emitScrubEnd} for the exact ordering guarantee. Omitted → inert. */
  readonly onScrubEnd?: () => void;
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
    onScrubBegin,
    onScrub,
    onScrubEnded,
    onScrubEnd,
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
  const onScrubBeginRef = useRef(onScrubBegin);
  onScrubBeginRef.current = onScrubBegin;
  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;
  const onScrubEndedRef = useRef(onScrubEnded);
  onScrubEndedRef.current = onScrubEnded;
  const onScrubEndRef = useRef(onScrubEnd);
  onScrubEndRef.current = onScrubEnd;

  // Timestamp (ms) of the last `onScrub` call THIS view actually emitted — `null` before the first
  // one. Feeds {@link shouldEmitDragSeek} (see the DRAG-SEEK THROTTLE file-header note).
  const lastSeekEmitMsRef = useRef<number | null>(null);

  // Gates the actual `onScrub` call through {@link shouldEmitDragSeek}. `force: true` (touch-down /
  // release / terminate) always emits and always updates `lastSeekEmitMsRef`; `force: false` (move)
  // only emits — and only advances the throttle clock — when enough time has passed since the last
  // REAL emission (a dropped move does NOT reset the window).
  const emitSeek = (ratio: number, options: { force: boolean }): void => {
    const nowMs = Date.now();
    if (!shouldEmitDragSeek(lastSeekEmitMsRef.current, nowMs, options)) return;
    lastSeekEmitMsRef.current = nowMs;
    onScrubRef.current?.(ratio);
  };

  // SECONDARY / DEFENSIVE reset only (rb-rn-intro-progress-bar-followup-fix): the PRIMARY reset
  // now happens directly inside `onPanResponderRelease` / `onPanResponderTerminate` below (see
  // their comments). This effect used to be the ONLY reset mechanism, gated on `isExpanded`
  // flipping to `false` — that broke the intro clean-mode call site (`PlayerShellView.tsx`'s
  // `showsIntroProgress` branch), which passes a LITERAL `isExpanded={true}` that never changes:
  // this effect's dependency never re-fires there, so `dragRatio` stayed frozen at whatever ratio
  // the user last dragged to, forever — the progress bar looked "stuck", no longer tracking real
  // playback. For the VOD/replay call site (`isExpanded` really does flip to `false` once the
  // post-release hold window elapses) the release/terminate handlers below already reset
  // `dragRatio` well before that happens, so by the time this effect's condition becomes true,
  // `dragRatio` is already `null` and this is a no-op — kept only as a defensive fallback for any
  // gesture-termination path that doesn't route through those two handlers.
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
        // `dragRatio(offsetX:trackWidth:)` computation in the same gesture callback. Touch-down
        // always force-emits (exempt from the drag-seek throttle) — see file-header note.
        const ratio = dragRatioFromOffset(evt.nativeEvent.locationX, trackWidthRef.current);
        setDragRatio(ratio);
        onScrubStartedRef.current?.();
        onScrubBeginRef.current?.();
        emitSeek(ratio, { force: true });
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        // Visual feedback (handle position / fill) updates on EVERY move, unthrottled — only the
        // actual `onScrub` call (→ real cross-bridge seek dispatch) is throttled via `emitSeek`.
        const ratio = dragRatioFromOffset(evt.nativeEvent.locationX, trackWidthRef.current);
        setDragRatio(ratio);
        emitSeek(ratio, { force: false });
      },
      onPanResponderRelease: (evt: GestureResponderEvent) => {
        // Read the release event's OWN position (previously never read — the final ratio came
        // from whatever move preceded release, not release itself; rn-vod-scrub-seek-tolerance-
        // reference-ui, same gap fixed on Android's PlaybackProgressBar.kt). Force-emit the final
        // ratio even if the last move was throttled away — the throttle must never cause the
        // actually-released position to diverge from what native ends up seeked to. See
        // {@link emitScrubEnd} for why `onScrubEnded`/`onScrubEnd` MUST both run before this.
        const ratio = dragRatioFromOffset(evt.nativeEvent.locationX, trackWidthRef.current);
        emitScrubEnd(ratio, onScrubEndedRef.current, onScrubEndRef.current, (r) => emitSeek(r, { force: true }));
        // rb-rn-intro-progress-bar-followup-fix: reset the local drag ratio directly HERE, at the
        // gesture-end callback itself, rather than relying on the `isExpanded`-watching effect
        // above — the intro clean-mode call site passes a LITERAL `isExpanded={true}` that never
        // changes (see `PlayerShellView.tsx`'s `showsIntroProgress` comment), so that effect never
        // fires there and the bar previously froze at the release ratio forever. Parity Flutter's
        // `_handleUp()`, which resets its own drag state at the gesture-end callback, not via an
        // external state watch. No intermediate `setDragRatio(ratio)` here — React batches all
        // `setState` calls within this synchronous handler into a single re-render, so an
        // intermediate assignment immediately overwritten by this `null` would never actually
        // paint; skipping it avoids dead code, not a behavior change.
        setDragRatio(null);
      },
      // Defensive: a terminated gesture (e.g. an OS-level interruption) is still a "finger lifted"
      // from this view's perspective — the caller's 2.8s hold timer must still fire, mirroring
      // `onPanResponderRelease` (including reading the event's own position and the same ordering,
      // and the same immediate `setDragRatio(null)` reset — rb-rn-intro-progress-bar-followup-fix).
      onPanResponderTerminate: (evt: GestureResponderEvent) => {
        const ratio = dragRatioFromOffset(evt.nativeEvent.locationX, trackWidthRef.current);
        emitScrubEnd(ratio, onScrubEndedRef.current, onScrubEndRef.current, (r) => emitSeek(r, { force: true }));
        setDragRatio(null);
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
      hitSlop={{
        top: PLAY_PAUSE_HIT_SLOP,
        bottom: PLAY_PAUSE_HIT_SLOP,
        left: PLAY_PAUSE_HIT_SLOP,
        right: PLAY_PAUSE_HIT_SLOP,
      }}
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

/** Default minimum spacing (ms) between two THROTTLED (non-`force`) `onScrub` emissions — see the
 *  DRAG-SEEK THROTTLE file-header note and {@link shouldEmitDragSeek}. Named so a future tune
 *  doesn't require touching the decision logic itself. Parity Flutter `_dragSeekThrottleMs`
 *  (`rb-flutter-progress-bar-drag-seek-throttle`). */
export const DRAG_SEEK_THROTTLE_MS = 120;

/**
 * Decides whether THIS `onScrub` call should actually be emitted (rb-rn-progress-bar-drag-seek-
 * throttle). `force` (touch-down / release / terminate) ALWAYS emits, regardless of timing.
 * Otherwise (a plain `onPanResponderMove`): `lastEmitMs == null` (nothing emitted yet this drag)
 * ALWAYS emits; else emits only once at least `minIntervalMs` has elapsed since `lastEmitMs`. Pure
 * — takes plain millisecond timestamps, no clock/timer dependency, so every branch is directly
 * `expect()`-able. Parity Flutter `shouldEmitDragSeek(lastEmitMs, nowMs, {force, minIntervalMs})`.
 */
export function shouldEmitDragSeek(
  lastEmitMs: number | null,
  nowMs: number,
  options: { force: boolean; minIntervalMs?: number },
): boolean {
  if (options.force) return true;
  if (lastEmitMs == null) return true;
  const minIntervalMs = options.minIntervalMs ?? DRAG_SEEK_THROTTLE_MS;
  return nowMs - lastEmitMs >= minIntervalMs;
}

/**
 * The end-of-gesture dispatch order (rn-vod-scrub-seek-tolerance-reference-ui): calls
 * `onScrubEnded`, then `onScrubEnd`, then `onScrub` (with `finalRatio`), in exactly that order.
 * `onScrubEnded`/`onScrubEnd` MUST both complete before `onScrub`'s call — the last,
 * position-determining seek of the gesture — reaches the host, so a precision-toggle-style
 * subscriber wired to `onScrubEnd` (e.g. the container's `endScrub()`) has already taken effect
 * by then (mirrors the ordering bug fixed on Flutter by
 * `fix-flutter-scrub-end-before-final-seek-reference-ui` and on Android by
 * `android-vod-scrub-seek-tolerance-reference-ui`'s own `emitScrubEnd`).
 *
 * Pulled out as a standalone, side-effecting-but-order-pure function (not inlined in the gesture
 * handlers) specifically so this ordering guarantee has a unit test: this package's jest
 * `react-native` mock stubs `PanResponder.create` to discard its config, so no drag gesture can
 * be SIMULATED through a renderer (see the file-header TESTABILITY NOTE) — the gesture handlers
 * themselves never run under test.
 */
export function emitScrubEnd(
  finalRatio: number,
  onScrubEnded: (() => void) | undefined,
  onScrubEnd: (() => void) | undefined,
  onScrub: (ratio: number) => void,
): void {
  onScrubEnded?.();
  onScrubEnd?.();
  onScrub(finalRatio);
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
