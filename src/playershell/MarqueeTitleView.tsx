// MarqueeTitle — the player-header title slot (design `LBPMarqueeText`) — RN .tsx.
//
// Spec: `reference-ui-rendering/spec.md`, requirements
//   • "RN PlayerHeaderBarView 標題文字新增 LBPMarqueeText 跑馬燈捲動"
//   • "RN LivebuyPlayerConfig.titleScroll 旗標 gate PlayerHeader 標題跑馬燈（RN）"
// (change `rb-rn-marquee-title-scroll`, which lands BOTH the marquee itself and the
// merchant capability gate in one go — deliberately, so RN never spends a window with a
// marquee the merchant cannot turn off; see that change's proposal.md).
//
// Design source: `design/templates/minimal/sdk-components.jsx` — `LBPMarqueeText`
// (measure `scrollWidth` vs `clientWidth`; on overflow duplicate the text with a fixed
// `gap` and loop `translateX` to -50% at `linear infinite`, `dur = Math.max(8,
// scrollWidthPx / speedPxPerSec)`, `speedPxPerSec = 32`, `gap = 36`), plus
// `normalizeTitleScroll(raw)` and `LBPHostBadge`'s `titleScroll` prop.
//
// BEHAVIOUR parity (NOT code parity) with the already-shipped iOS
// `PlayerHeaderBarView.titleView` / `MarqueeTitleLoopView` (`rb-ios-marquee-title-scroll`,
// `rb-ios-video-title-scroll`) and Android `MarqueeTitle` / `MarqueeLoop`
// (`rb-android-marquee-title-scroll`, `rb-android-video-title-scroll`): the same formulas,
// the same constants, the same two-gate split. HOW it is achieved is derived from React
// Native's own capabilities — the SwiftUI `GeometryReader`/`.overlay` argument and the
// Compose `TextMeasurer`/`BoxWithConstraints` argument do NOT transfer and are NOT restated
// here.
//
// RN-SPECIFIC DECISIONS (design.md D1-D4 of `rb-rn-marquee-title-scroll`):
//
//   D1 MEASUREMENT — RN's JS side has NO synchronous text measurement (no `scrollWidth` /
//      `clientWidth`, no sync `Text` measure), so both widths come from `onLayout`:
//        · container width ← the slot wrapper's own `onLayout` (the wrapper carries NO width
//          style, so its width IS the resolved width of the one layout-participating `Text`,
//          i.e. `min(intrinsic, available)`);
//        · intrinsic text width ← a MEASURE PROBE: an absolutely-positioned, invisible,
//          `flexDirection: 'row'` `View` with an explicit huge width, holding one
//          `numberOfLines={1}` copy of the title in the SAME style.
//      Overflow ⟺ probe width > wrapper width ⟺ the visible line really is truncated.
//      `onLayout` is ASYNC: the first commit measures `0 / 0` → static branch; the marquee
//      engages once the measurements land. That lag is a real RN property — it is NOT
//      equivalent to iOS's synchronous `GeometryReader`, and nothing here may claim it is.
//
//   D2 ANIMATION — RN's built-in `Animated` (this module's established idiom:
//      `SlideUpSheet.tsx`, `container/LivebuyLiveEntry.tsx`,
//      `container/CollapsibleLivebuyPlayer.tsx`, `HeartBurst.tsx`). `Animated.loop` +
//      `Animated.timing(..., { easing: Easing.linear, useNativeDriver: true })` drives
//      `transform: [{ translateX }]`. NO new dependency (no Reanimated, no third-party
//      marquee package) and NOT the `setInterval`-ticked idiom, which exists in this module
//      only for `moments/loading-mark`'s DISCRETE PNG frame stepping — this is CONTINUOUS
//      interpolated motion.
//
//   D3 LINE-HEIGHT INVARIANT — the marquee is an ABSOLUTELY-POSITIONED VISUAL OVERLAY, never
//      a mutually-exclusive branch against the static `Text`. Yoga excludes
//      `position: 'absolute'` children from the parent's content size, so the slot's height is
//      ALWAYS the static `Text`'s height, whatever `titleScroll` is and whether or not the
//      marquee is mounted. There is deliberately NO parallel static branch for
//      `titleScroll === false` — it simply does not attach the overlay.
//      ⚠️ This module CANNOT measure real heights: its tests run against
//      `test-support/react-native.mock.tsx`, which has no Yoga and no layout engine. So the
//      tests pin the STRUCTURAL PRECONDITIONS that make equal height necessary — they do NOT,
//      and must not claim to, measure it. (Android argues this differently BECAUSE it has two
//      exclusive subtrees; that argument is inapplicable here, not merely unused.)
//
//   D4 BASE-TEXT OPACITY — overlay and base `Text` both paint; once scrolling starts the
//      motionless truncated line underneath would show through the `gap`. So the base `Text`
//      is hidden with `opacity: 0` IF AND ONLY IF the marquee is actually drawn. `opacity` is
//      paint-only in Yoga (no measure / layout effect), so D3 is untouched; and it is bound to
//      `showsMarqueeTitle`'s RESULT, never to `titleScroll` itself — `titleScroll === false`
//      always renders a fully opaque title. This is an RN-local refinement; it makes no claim
//      about, and requires no change to, iOS / Android.
//
// jsx automatic runtime — no `import React`. Returns `ReactElement` (NOT JSX.Element, which
// is absent under @types/react 19).

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Animated, Easing, View } from 'react-native';
import type { LayoutChangeEvent, TextStyle } from 'react-native';

import { Text } from '../TightText';
import { LBTestIDs } from '../testing/LBTestIDs';

// MARK: - Design constants (literal values from `LBPMarqueeText`)

/** Gap between the two duplicated title copies (design `gap = 36`; iOS `marqueeGap`,
 *  Android `MARQUEE_GAP_DP`). */
export const MARQUEE_GAP = 36;
/** Scroll speed (design `speedPxPerSec = 32`; iOS `marqueeSpeedPointsPerSecond`, Android
 *  `MARQUEE_SPEED_DP_PER_SEC`). */
export const MARQUEE_SPEED_PX_PER_SEC = 32;
/** Minimum loop duration in seconds (design `Math.max(8, …)`; iOS
 *  `marqueeMinDurationSeconds`, Android `MARQUEE_MIN_DURATION_SECONDS`). */
export const MARQUEE_MIN_DURATION_SECONDS = 8;

/**
 * Width handed to the measure probe (D1). Deliberately far wider than any plausible header
 * slot on any device, so the probe measures「how wide does this line WANT to be」rather than
 *「how much room is there」. It never becomes layout: the probe is `position: 'absolute'`, so
 * Yoga excludes it from the slot's content size, and the slot clips with `overflow: 'hidden'`.
 */
const MEASURE_PROBE_WIDTH = 10000;

// MARK: - The three pure gates + the duration formula
//
// All four are PURE (no React, no rendering, no IO) and directly unit-testable —
// `__tests__/MarqueeTitle.test.tsx` walks their full truth tables.

/**
 * THE ONLY place a raw `extensions.video_title_scroll` value becomes a boolean.
 *
 * The merchant decides in the back office (setting `video_title_display` — ⚠️ the wire key
 * and the back-office setting are NOT the same name); the value ships on `POST /sdk/config`
 * as `data.extensions.video_title_scroll` (Int `0`/`1`, and the backend contract explicitly
 * documents「未設定時為 1」). `extensions` is an OPAQUE RAW BAG — the SDK does not interpret
 * it (`sdk-config` capability), so the HOST reads the value out and injects it into
 * `LivebuyPlayerConfig.titleScroll`; reference-ui NEVER reads
 * `LivebuySDK.getSdkConfig().extensions` itself.
 *
 * The parameter is `unknown` ON PURPOSE — RN core types `SDKConfig.extensions` as
 * `Record<string, unknown>`, so a host assigns the value in ONE line with no cast and no
 * default branch of its own. Same shape as this layer's existing `normalizeShowStock` /
 * `normalizeProductCardMode` / `normalizeFloatingPosition`.
 *
 * NAMING: a module-level free function re-exported from `src/index.ts`, matching
 * `normalizeShowStock` — deliberately NOT a namespace object mirroring iOS
 * `LBVideoTitleScroll.normalized(_:)` / Android `LBVideoTitleScroll.normalized(raw:)`. Those
 * are each language's own convention; copying the SHAPE would leave RN with two styles for
 * one job.
 *
 * Mirrors the design's `normalizeTitleScroll(raw)` VERBATIM (`!(raw === 0 || raw === '0' ||
 * raw === false)`): the comparison is STRICT — NO trimming and NO case folding — so `' 0 '` /
 * `'0 '` / `'00'` / `'0.0'` / `'false'` / `'FALSE'` all fall back to "may scroll", exactly
 * like any other unrecognized value. Being as strict as the design keeps the four platforms'
 * fallback boundary identical precisely when the backend emits something malformed, which is
 * when a divergence would be hardest to spot.
 *
 * FALLBACK LANDS ON `true` (may scroll) for `undefined` / a missing key / `null` / anything
 * unrecognized — matching the backend's own documented default of `1`.
 *
 * ⚠️ `false` means「do not SCROLL」, NOT「do not SHOW」. The backend contract
 * (`openspec/specs/backend/sdk-config.md`) says so in as many words. A disabled title still
 * renders, single-line, tail-ellipsized, fully opaque, at the same height.
 *
 * The normalized value MUST NOT be written back into any view-model.
 */
export function normalizeTitleScroll(raw: unknown): boolean {
  return !(raw === 0 || raw === '0' || raw === false);
}

/**
 * Marquee overflow decision — 「is there anything TO scroll?」 and nothing else.
 *
 * Parity JSX `LBPMarqueeText`'s `i.scrollWidth <= w.clientWidth`, iOS
 * `marqueeTitleOverflows(textWidth:containerWidth:)`, Android
 * `marqueeTitleOverflows(textWidthPx, containerWidthPx)`. `textWidth` is the title's measured
 * intrinsic single-line width (the probe, D1); `containerWidth` is the slot's actual resolved
 * width. Overflow ⟺ the text is STRICTLY wider than the container.
 *
 * Strict `>` — deliberately NOT the JSX's own `+ 1` CSS tolerance, matching what iOS and
 * Android both chose: three platforms agreeing beats each re-deriving from the JSX.
 *
 * 100% content-driven, and it MUST stay that way: no caller preference may stand in for this
 * measurement (main spec: the overflow decision MUST NOT gain a manual override). Whether the
 * marquee is actually attached is {@link showsMarqueeTitle}, which ANDs this with the
 * `titleScroll` capability gate. Component bodies MUST call `showsMarqueeTitle`, never this.
 */
export function marqueeTitleOverflows(textWidth: number, containerWidth: number): boolean {
  return textWidth > containerWidth;
}

/**
 * THE single decision of whether {@link MarqueeTitle} attaches its marquee overlay. Pure.
 *
 * Two orthogonal gates, ANDed — the division of labour is normative, not stylistic:
 *  • `titleScroll` — 「is scrolling ALLOWED?」 A backend / merchant capability gate, sourced
 *    from `extensions.video_title_scroll` and injected by the host. NOT a caller's ad-hoc
 *    preference, and it MUST NOT influence the measurement.
 *  • {@link marqueeTitleOverflows} — 「is there anything TO scroll?」 Content measurement,
 *    100% automatic.
 *
 * STRUCTURAL COUPLING (do not "improve"): `MarqueeTitle`'s branch condition MUST be expressed
 * AS this function's return value, and the component body MUST NOT restate
 * `titleScroll && marqueeTitleOverflows(...)` inline nor call `marqueeTitleOverflows`
 * directly. Once the decision and the drawing are implemented separately the two inevitably
 * diverge, and this function's unit tests would stop saying anything about what is rendered.
 */
export function showsMarqueeTitle(
  titleScroll: boolean,
  textWidth: number,
  containerWidth: number,
): boolean {
  return titleScroll && marqueeTitleOverflows(textWidth, containerWidth);
}

/**
 * Marquee loop duration in seconds — parity JSX `dur = Math.max(8, scrollWidthPx /
 * speedPxPerSec)`, iOS `marqueeDurationSeconds`, Android `marqueeDurationMillis`. Pure.
 *
 * RN density-independent points map 1:1 onto iOS points / Android dp here, so the constants
 * port directly with no unit adjustment.
 */
export function marqueeDurationSeconds(
  textWidth: number,
  speedPxPerSec: number = MARQUEE_SPEED_PX_PER_SEC,
  minSeconds: number = MARQUEE_MIN_DURATION_SECONDS,
): number {
  return Math.max(minSeconds, textWidth / speedPxPerSec);
}

// MARK: - MarqueeTitle (the title slot)

/** Props for the player-header title slot. */
export interface MarqueeTitleProps {
  /** The title copy (`playerHeaderState.title`), by value. */
  readonly title: string;
  /** Text color — the header passes its on-glass white. */
  readonly color: string;
  /** Resolved font size (the header passes `12 * theme.fontScale`). */
  readonly fontSize: number;
  /**
   * Merchant capability gate, RAW (`extensions.video_title_scroll` as the host read it —
   * see {@link normalizeTitleScroll}, the ONE place it becomes a boolean, called exactly
   * once in this component's body). Omitted → `undefined` → normalizes to `true` (may
   * scroll), which is both the backend's documented default and the behaviour every existing
   * caller gets for free.
   *
   * ⚠️ It answers「MAY the title scroll」only. Whether it DOES is ANDed with the measurement
   * in {@link showsMarqueeTitle}; a `false` here NEVER hides the title.
   */
  readonly titleScroll?: unknown;
}

/**
 * The player-header title slot: a single-line title that marquee-scrolls when (and only when)
 * it overflows AND the merchant allows scrolling.
 *
 * Structure (see the file header for why each piece is shaped this way):
 * ```
 * <View slot  overflow:hidden  onLayout→containerWidth>
 *   <Text numberOfLines={1}/>            ← the ONLY layout-participating node
 *   <View probe position:absolute/>      ← measures intrinsic width, layout-inert
 *   {shows && <View overlay position:absolute/>}  ← the marquee, layout-inert
 * </View>
 * ```
 */
export function MarqueeTitle(props: MarqueeTitleProps): ReactElement {
  const { title, color, fontSize, titleScroll } = props;

  // Measurements (D1). Both start at 0 → `showsMarqueeTitle` is false on the first commit →
  // the static branch renders until `onLayout` lands. `containerWidth` is the slot's OWN
  // resolved width, which (the wrapper carrying no width style) is the resolved width of the
  // static `Text` below.
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  // The base text style. Byte-identical to what `PlayerHeaderBarView` rendered before this
  // component existed — `opacity` is appended ONLY in the scrolling state (D4), so every
  // non-scrolling render (including `titleScroll === false`) keeps the pre-existing object.
  const textStyle: TextStyle = { color, fontSize, fontWeight: 'bold' };

  // THE one call of each gate. `normalizeTitleScroll` exactly once (the single fallback entry
  // point); `showsMarqueeTitle` exactly once, and the JSX below expresses its branches AS this
  // value — it MUST NOT re-derive the condition or reach for `marqueeTitleOverflows`.
  const shows = showsMarqueeTitle(normalizeTitleScroll(titleScroll), textWidth, containerWidth);

  return (
    <View
      testID={LBTestIDs.playerHeaderTitle}
      // NO `width` / `flex` / `alignSelf` here, ON PURPOSE (D3): inside the header's column
      // (`alignItems: 'flex-start'`) the horizontal axis is the CROSS axis, so this wrapper
      // takes its width from its content — the static `Text` — exactly as that `Text` did on
      // its own before. `alignSelf: 'stretch'` would re-source the width from the hostName row
      // below, and `flexShrink` does nothing on a column's cross axis; both would be wrong.
      // `overflow: 'hidden'` clips the marquee AND the (already invisible) measure probe.
      style={{ overflow: 'hidden' }}
      onLayout={(e: LayoutChangeEvent): void => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* The ONE layout-participating node — present in EVERY state, identical in every
          state save the scrolling-only `opacity`. This is what makes the slot's height
          independent of `titleScroll` (D3), and it IS the design's non-scrolling branch
          (`nowrap` + `overflow:hidden` + tail ellipsis). MUST NOT be duplicated into a
          parallel `titleScroll === false` branch. */}
      <Text numberOfLines={1} style={shows ? { ...textStyle, opacity: 0 } : textStyle}>
        {title}
      </Text>

      {/* MEASURE PROBE (D1) — invisible, untouchable, layout-inert. `flexDirection: 'row'` is
          load-bearing: in a row the horizontal axis is the MAIN axis, so the `Text` takes its
          own content width (RN's default `flexShrink` is 0). With the default `column` the
          horizontal axis would be the CROSS axis and the default `alignItems: 'stretch'` would
          blow the `Text` up to MEASURE_PROBE_WIDTH — measuring the probe, not the text. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          opacity: 0,
          flexDirection: 'row',
          width: MEASURE_PROBE_WIDTH,
        }}
      >
        <Text
          numberOfLines={1}
          style={textStyle}
          onLayout={(e: LayoutChangeEvent): void => setTextWidth(e.nativeEvent.layout.width)}
        >
          {title}
        </Text>
      </View>

      {shows ? (
        <MarqueeLoop title={title} textStyle={textStyle} textWidth={textWidth} />
      ) : null}
    </View>
  );
}

// MARK: - MarqueeLoop (the overflow branch of `LBPMarqueeText`)

/**
 * The continuously-looping overlay: two copies of the title, `MARQUEE_GAP` apart, translated
 * left by exactly `-(textWidth + MARQUEE_GAP)` so the second copy lands where the first
 * started — a seamless wrap, equivalent to the design's `-50%` of the doubled content and to
 * Android `MarqueeLoop`'s identical `targetValue`.
 *
 * Absolutely positioned over the slot and `pointerEvents="none"`: it paints, it does not
 * negotiate layout and does not eat the host pill's taps.
 *
 * Only ever mounted when {@link showsMarqueeTitle} holds, so it never needs to re-ask that
 * question. Under `test-support/react-native.mock.tsx` `Animated.loop` is an inert stub, so
 * this renders its resting frame (both copies side by side at offset 0) — a real, structurally
 * distinguishable tree, which is what the tests assert on rather than any animation frame.
 */
function MarqueeLoop(props: {
  readonly title: string;
  readonly textStyle: TextStyle;
  readonly textWidth: number;
}): ReactElement {
  const { title, textStyle, textWidth } = props;
  const progress = useRef(new Animated.Value(0)).current;
  const durationMs = marqueeDurationSeconds(textWidth) * 1000;

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return (): void => animation.stop();
  }, [progress, durationMs, title]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(textWidth + MARQUEE_GAP)],
  });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
      }}
    >
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
        {/* Explicit `width` on both copies (from the probe) rather than relying on intrinsic
            sizing inside a constrained row — it makes the -(textWidth + gap) translation and
            the visible layout come from the SAME number, so the wrap cannot drift. */}
        <Text numberOfLines={1} style={{ ...textStyle, width: textWidth }}>
          {title}
        </Text>
        <Text numberOfLines={1} style={{ ...textStyle, width: textWidth, marginLeft: MARQUEE_GAP }}>
          {title}
        </Text>
      </Animated.View>
    </View>
  );
}
