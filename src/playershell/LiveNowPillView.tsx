// LiveNowPillView — 「現正直播」right-edge half-pill (RN sibling of iOS
// `LiveNowPillView.swift` / Android `LiveNowPill.kt`, rb-rn-live-now-pill).
//
// Spec: `reference-ui-rendering/spec.md` "LivebuyReferenceUI 渲染現正直播中提示鈕
//   （LiveNowPillView）" (rb-rn-live-now-pill).
// Design: `design/contract/claude-design-sync.md` R28 / `design/contract/components.md`
//   `LBLiveNowPill` / `design/templates/minimal/{sdk-components.jsx,screens.jsx}`
//   `LBLiveNowPill` + `LBPPlayerScreen` mount block.
//
// PURE presentation, sub-view input pattern (theme first, `onTap` trailing optional callback):
// this component does NOT poll, does NOT know the currently-detected「another live」item, and does
// NOT decide whether it should be mounted at all — `PlayerShellView`'s `showsLiveNowPill` display
// gate and the `LivebuyPlayer` container's poll (`LivebuyPlayer.tsx`'s file-local
// `useLiveNowPoll`) own that.
//
// HALF-PILL SHAPE (`border-radius: 999px 0 0 999px` — only the LEFT two corners rounded, the right
// edge flush with the screen edge): unlike iOS (which had to hand-roll a custom
// `LeadingRoundedRectangle` `Shape` — SwiftUI's `RoundedRectangle` / `Capsule` only round all
// corners together) RN's plain style props already support PER-CORNER radii natively
// (`borderTopLeftRadius` / `borderBottomLeftRadius` independently of the right pair), so — like
// Android's `RoundedCornerShape` win — no custom Path/Shape is needed here either.
//
// PULSING DOT: `Animated.loop` + `Animated.timing`, this package's ESTABLISHED continuous-
// animation idiom (`MarqueeTitleView.tsx`'s `MarqueeLoop`, `HeartBurst.tsx`), 1.6s period. This
// package's jest mock (`test-support/react-native.mock.tsx`) stubs `Animated.loop` INERTLY (the
// wrapped `Animated.timing` never actually starts, `start()`/`stop()` are no-ops), so tests
// exercise the RESTING frame — a real, structurally distinguishable tree — the SAME testability
// contract `MarqueeLoop` already relies on. Deliberately NO new animation-throttle infrastructure
// is introduced here (unlike iOS's `continuousAnimationGate` / Android's
// `LocalContinuousAnimationGate` — this RN package has neither, and the jest mock already makes a
// per-component throttle unnecessary for test-safety; see design.md for why inventing one here
// would be out of scope for a single component).

import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';

// MARK: - Design tokens (design `LBLiveNowPill`). FIXED brand-red — does NOT follow
// `theme.accent`, parity `CarouselCardView.LIVE_RED` / `MinimizedWidgetView.LIVE_RED`'s existing
// precedent of a hardcoded LIVE-red regardless of theme.
//
// SIZE (fix-rn-live-now-pill-tap-and-size): the design's `LBLiveNowPill` (`design/templates/
// minimal/sdk-components.jsx`) was shrunk ~25-30% (commit `db49a30b`, real-device feedback that
// the pill took up too much screen). Every 1:1-mapped constant below is a literal copy of the
// design's new px value (see this change's design.md Decision 3 for the full old/new table).
// `ARROW_SIZE` is the one NON-1:1 exception — it never literally matched the design's raw svg box
// even before this shrink (design was 17, this was already 14) — its own established ratio
// (14/17 ≈ 0.8235) is applied to the new design value (13) and rounded (≈10.7 → 11), rather than
// copying 13 directly. `PILL_BACKGROUND` / `PILL_RADIUS` / `DOT_PULSE_DURATION_MS` are UNCHANGED
// (the design values themselves did not change).

const PILL_BACKGROUND = '#F03246';
const PILL_RADIUS = 999;
const DOT_SIZE = 11;
const DOT_INNER_SIZE = 4;
const DOT_PULSE_DURATION_MS = 1600;
const LABEL_TEXT = 'LIVE';
const LABEL_FONT_SIZE = 12;
const ARROW_SIZE = 11;
const CONTENT_GAP = 4;

/** Props for the {@link LiveNowPillView} surface. */
export interface LiveNowPillViewProps {
  /** The resolved reference-ui theme (first positional argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * Whole-pill tap. The view carries NO knowledge of which video it would switch to — the
   * container resolves that (parity iOS `LiveNowPillView.onTap: (() -> Void)?` / Android
   * `LiveNowPill.onTap: () -> Unit`, both no-arg for the exact same reason). Omitted → inert
   * (demo / snapshot).
   */
  readonly onTap?: () => void;
}

/**
 * The「現正直播」right-edge half-pill. `PlayerShellView` composes this as an independent
 * top-level sibling (parity iOS `HStack { Spacer(); LiveNowPillView(...) }` / Android
 * `Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterEnd)`), gated on its own pure
 * display function ({@link showsLiveNowPill} in `PlayerShellView.tsx`).
 *
 * Renders correctly with `onTap` omitted (structural snapshot tests construct it action-free, per
 * the sub-view input pattern).
 */
export function LiveNowPillView(props: LiveNowPillViewProps): ReactElement {
  const { theme, onTap } = props;

  // Pulsing outer ring (1.6s loop, scale 1 → 1.8 + fade 0.7 → 0), parity iOS/Android's outward-
  // pulsing-fade-ring spec. `Animated.loop` is stubbed inertly under this package's jest mock —
  // see file header; the resting frame (progress == 0) is what structural tests observe.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pulse.setValue(0);
    const animation = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: DOT_PULSE_DURATION_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return (): void => animation.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });

  return (
    <Pressable
      testID={LBTestIDs.liveNowPill}
      onPress={() => onTap?.()}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: PILL_BACKGROUND,
        borderTopLeftRadius: PILL_RADIUS,
        borderBottomLeftRadius: PILL_RADIUS,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        // design `padding: 6px 9px 6px 7px` (top / right / bottom / left; fix-rn-live-now-pill-
        // tap-and-size shrink, was `9px 12px 9px 10px`).
        paddingTop: 6,
        paddingRight: 9,
        paddingBottom: 6,
        paddingLeft: 7,
        // design `box-shadow: -1px 3px 10px rgba(0,0,0,0.25)` (fix-rn-live-now-pill-tap-and-size
        // shrink, was `-2px 4px 14px rgba(0,0,0,0.28)`). `elevation` (Android) has no directional
        // control — approximated, parity Android's own `Modifier.shadow(elevation)` approximation
        // of the same directional shadow (see design.md). `elevation` itself is a fixed Android-
        // only approximation with no design counterpart (parity Android's own
        // `shadowElevation = 8.dp`) — NOT scaled down with the blur radius.
        shadowColor: '#000000',
        shadowOffset: { width: -1, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
      }}
    >
      {/* Pulsing white dot: solid inner dot + outward-fading pulsing ring (1.6s period). The ring's
          own `borderWidth` (below) and this animation's scale/opacity range are UNCHANGED by the
          fix-rn-live-now-pill-tap-and-size shrink — see design.md Decision 3: this single ring was
          already a simplification that never literally matched either of the design's two separate
          ring-width constants, so there is no established ratio to carry forward. */}
      <View
        style={{ width: DOT_SIZE, height: DOT_SIZE, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            borderWidth: 1,
            borderColor: '#FFFFFF',
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
        <View
          style={{
            width: DOT_INNER_SIZE,
            height: DOT_INNER_SIZE,
            borderRadius: DOT_INNER_SIZE / 2,
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>

      <View style={{ width: CONTENT_GAP }} />

      <Text
        style={{
          fontSize: LABEL_FONT_SIZE * theme.fontScale,
          fontWeight: '900',
          color: '#FFFFFF',
          letterSpacing: 0.5,
        }}
      >
        {LABEL_TEXT}
      </Text>

      <View style={{ width: CONTENT_GAP }} />

      <RightArrowGlyph color="#FFFFFF" size={ARROW_SIZE} />
    </Pressable>
  );
}

// MARK: - Self-drawn right-arrow glyph (design path `M9 6l6 6-6 6` — a single open chevron ›)
//
// Same "two positioned + rotated View lines" convention as `moments/ChevronForwardGlyph.tsx`
// (double chevron »)  / `PlaybackProgressBarView.PlayPauseGlyph` — this package has no Canvas /
// react-native-svg. A SEPARATE, single-arm glyph (NOT a reuse of `ChevronForwardGlyph`, which
// draws TWO chevrons for a different design path) — parity iOS SF Symbol `chevron.right` /
// Android hand-drawn `Path` arrow stroke (non-literal approximations on both platforms; see
// design.md Risks).
function RightArrowGlyph(props: { color: string; size: number }): ReactElement {
  const { color, size } = props;
  const s = size / 24; // design path is authored in a 24-unit box
  // `2.2` is the stroke width IN THE 24-unit design coordinate space — it already equals the
  // design's post-shrink `strokeWidth="2.2"` (fix-rn-live-now-pill-tap-and-size; the pre-shrink
  // design value was `2.6`, which this constant never literally matched either — see this
  // change's design.md Decision 3), so no change is needed here. Because `stroke` is a function
  // of `size`, shrinking `ARROW_SIZE` (the caller's `size` argument) already scales this
  // proportionally — no separate adjustment required.
  const stroke = 2.2 * s;

  function arm(x1: number, y1: number, x2: number, y2: number, key: string): ReactElement {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    return (
      <View
        key={key}
        style={{
          position: 'absolute',
          left: (mx - len / 2) * s,
          top: my * s - stroke / 2,
          width: len * s,
          height: stroke,
          backgroundColor: color,
          borderRadius: stroke / 2,
          transform: [{ rotate: `${deg}deg` }],
        }}
      />
    );
  }

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {arm(9, 6, 15, 12, 'a')}
      {arm(15, 12, 9, 18, 'b')}
    </View>
  );
}

export default LiveNowPillView;
