// CcTooltip — small dark tooltip bubble + arrow, shown next to the CC pill while captions are
// unavailable (design R42, `design/templates/minimal/sdk-components.jsx` `LBPTooltip`).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-cc-icon-availability-redesign,
// rb-rn-cc-tooltip-position-fix, rb-rn-cc-tooltip-arrow-anchor-fix).
//
// Visual spec (design `LBPTooltip`): dark bubble `rgba(0,0,0,0.9)`, corner radius 5, padding
// ~5×9, white 600-weight ~12.5pt text, small triangular arrow pointing at the anchor pill.
// `placement="left"` (VOD side rail — bubble sits LEFT of the pill, arrow points right);
// `placement="top"` (LIVE-replay bottom bar — bubble sits ABOVE the pill, arrow points down).
//
// Pure presentation leaf: `visible` is caller-owned (see `useCcUnavailableTooltip.ts`) — this
// component does not manage its own show/hide timer. Renders `null` when `!visible` so the
// structural snapshot stays neutral at rest (same "render nothing at rest" contract as
// `HeartBurst.tsx`). `pointerEvents="none"` — the tooltip itself is never interactive.
//
// POSITIONING (rb-rn-cc-tooltip-position-fix): the design's web `LBPTooltip` centers itself with
// CSS `transform: translateX/Y(-50%)` — a SELF-RELATIVE offset that auto-adjusts to the bubble's
// own rendered size (font metrics, text length / locale). RN's `transform` does not support
// percentage offsets, so this component instead measures its own rendered size via `onLayout`
// and computes an equivalent `-size / 2` margin (`ccTooltipCenteringOffset`). Before the first
// `onLayout` lands (`measuredSize <= 0`), it falls back to a static estimate for the CURRENT
// design text so the tooltip isn't wildly mispositioned for one frame.
//
// `placement="top"` (LIVE bottom bar) additionally clamps its horizontal position to the
// viewport (`ccTooltipHorizontalClampDelta`, via `View.measureInWindow` — same window-relative
// measurement idiom as `LoopingVideoView.tsx`'s off-screen detection) — the CC button sits near
// the row's right edge, so an un-clamped centered bubble can overflow past the screen edge.
// `placement="left"` (VOD side rail) deliberately does NOT clamp — it has no known edge-overflow
// risk (see design.md Decision 3) and MUST NOT change its existing correct visual.
//
// State convergence: `clampDeltaX` accumulates (`prev => prev + delta`), NOT replaces
// (`=> delta`) — `measureInWindow`'s reported position already reflects whatever offset is
// currently applied, so each round's `delta` is an INCREMENTAL correction relative to the
// current state, not an absolute one. A replace-style update would oscillate forever between
// "apply correction" and "next onLayout overwrites it back to the un-corrected value". The
// accumulator converges to a fixed point in at most two extra layout passes (see design.md
// Decision 4 and Risks).
//
// ARROW ANCHORING (rb-rn-cc-tooltip-arrow-anchor-fix): `ccTooltipContainerStyle`'s `clampDeltaX`
// shifts the WHOLE container (bubble + arrow, sibling children of one `<View>`) as a rigid group.
// Left uncompensated, the arrow would drift away from the button by the same amount the bubble
// was nudged for the clamp, no longer pointing at it. `TooltipArrow` therefore receives an
// independent `compensationOffset` (`ccTooltipArrowCompensationOffset(clampDeltaX) = -clampDeltaX`)
// applied via its own `transform: translateX`, which cancels the container's shift in screen
// space (net `0` displacement on the arrow) while leaving the bubble's clamp behavior untouched.
// `clampDeltaX === 0` (the common case, and always true for `placement='left'`) makes the
// compensation a no-op — byte-identical to pre-fix rendering.

import { useCallback, useRef, useState } from 'react';
import type { ComponentRef, ReactElement } from 'react';
import { Dimensions, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { Text } from '../TightText';

export type CcTooltipPlacement = 'left' | 'top';

export interface CcTooltipProps {
  readonly visible: boolean;
  readonly text: string;
  readonly placement: CcTooltipPlacement;
  readonly testID?: string;
}

const TOOLTIP_BACKGROUND = 'rgba(0,0,0,0.9)';
const TOOLTIP_RADIUS = 5;
const TOOLTIP_FONT_SIZE = 12.5;
const ARROW_SIZE = 6;

/**
 * Explicit text width (rb-rn-cc-tooltip-text-wrap-fix) — WITHOUT this, the bubble's `Text` wraps
 * one CJK character per line. Root cause: Yoga measures an absolutely-positioned node's intrinsic
 * (shrink-to-fit) content using an "at most" bound equal to the nearest `position: 'relative'`
 * ancestor's OWN resolved width — even though only one inset (`right`/`left`) is set here, not
 * both, so per CSS semantics this node should shrink-wrap to ITS OWN content instead. The anchor
 * pill this tooltip attaches to is a `PILL_SIZE` (40px) circle (`OperationRailView.tsx` /
 * `LiveBottomBarView.tsx`), so Yoga's (incorrect) cap collapses the text's available width to
 * ~40px — or less for `placement='left'`, whose `flexDirection: 'row'` container further splits
 * that budget between the bubble and the arrow flex siblings — leaving only enough room for a
 * single glyph per line. An explicit numeric `width` puts Yoga in "exactly" measure mode for this
 * node, which is independent of the small ancestor's box, bypassing the bug entirely. Sized with
 * headroom over the current (hardcoded, non-i18n — reference-ui copy has no locale variants, see
 * `docs/reference-ui/`) design string's natural width (~175px at this font) so minor cross-device
 * font-metric variance can't tip it back into wrapping. Exported for tests (`CcTooltip.test.tsx`
 * asserts the bubble's `Text` node carries this style — a direct regression guard against the
 * fix being dropped, since the jest `react-native` mock cannot itself reproduce the real Yoga
 * text-measurement bug this exists to bypass).
 */
export const TOOLTIP_TEXT_WIDTH = 200;

/** Pre-measurement fallback offsets — best-effort static estimates for the current design text,
 *  used only for the single frame before `onLayout` reports the bubble's real rendered size (see
 *  {@link ccTooltipCenteringOffset}). Named constants (not magic numbers scattered at call sites)
 *  so their provenance ("this is a FALLBACK, not the real positioning logic") stays visible. */
const FALLBACK_VERTICAL_OFFSET = -14; // 'left' placement, pre-measurement
const FALLBACK_HORIZONTAL_OFFSET = -60; // 'top' placement, pre-measurement

/** Minimum gap to keep between the tooltip bubble and either screen edge — `top` placement's
 *  horizontal viewport clamp only (see {@link ccTooltipHorizontalClampDelta}). */
const MIN_EDGE_MARGIN = 8;

/**
 * Self-relative centering offset — pure, unit-testable. Replicates CSS `transform:
 * translateX/Y(-50%)` (which RN does not support as a percentage): given the bubble's OWN
 * rendered size along the centering axis (`measuredSize` — width for `'top'`, height for
 * `'left'`, from `onLayout`), returns the negative margin that centers it on the anchor.
 * `measuredSize <= 0` (nothing measured yet, i.e. the very first render before layout) falls
 * back to `fallback`, a static estimate for the current design text.
 */
export function ccTooltipCenteringOffset(measuredSize: number, fallback: number): number {
  return measuredSize > 0 ? -measuredSize / 2 : fallback;
}

export interface CcTooltipClampInput {
  /** The bubble's left edge in window coordinates, reflecting whatever centering/clamp offset is
   *  currently applied (i.e. NOT a "pre-any-offset" origin — see the module doc comment on
   *  accumulation). */
  readonly idealLeft: number;
  /** The bubble's own rendered width. */
  readonly bubbleWidth: number;
  /** Available viewport width (`Dimensions.get('window').width`). */
  readonly viewportWidth: number;
  /** Minimum gap to keep from either screen edge. Defaults to {@link MIN_EDGE_MARGIN}. */
  readonly minEdgeMargin?: number;
}

/**
 * Pure, unit-testable: how much (px) to shift the current horizontal position so the bubble
 * stays within `[minEdgeMargin, viewportWidth - minEdgeMargin]`. Returns `0` when no clamp is
 * needed (this is the fixed point the accumulator in {@link CcTooltip} converges to). A bubble
 * wider than the clampable range pins to the left margin rather than overflowing both edges.
 */
export function ccTooltipHorizontalClampDelta(input: CcTooltipClampInput): number {
  const { idealLeft, bubbleWidth, viewportWidth, minEdgeMargin = MIN_EDGE_MARGIN } = input;
  const minLeft = minEdgeMargin;
  const maxLeft = Math.max(minLeft, viewportWidth - minEdgeMargin - bubbleWidth);
  if (idealLeft < minLeft) return minLeft - idealLeft;
  if (idealLeft > maxLeft) return maxLeft - idealLeft;
  return 0;
}

/**
 * Pure, unit-testable: the equal-and-opposite offset to apply to the ARROW (not the bubble) so
 * its absolute screen position stays pinned to the anchor button's true center, independent of
 * how far the container (bubble + arrow) was shifted for the viewport clamp (see
 * {@link ccTooltipHorizontalClampDelta}). The container's `marginLeft` already carries
 * `clampDeltaX` (see {@link ccTooltipContainerStyle}); the arrow cancels that shift RELATIVE to
 * the already-shifted container via a `transform: translateX`, so the two offsets sum to `0` net
 * screen-space displacement on the arrow while the bubble keeps its (correct) clamped position.
 * Mirrors the Flutter `cc_tooltip_layout.dart` `arrowCompensationOffset` naming/shape. `0` input
 * (the common case, and always for `placement='left'`, whose `clampDeltaX` never leaves `0`)
 * returns `0` — byte-identical to pre-fix rendering. (Guards against `-clampDeltaX` producing
 * JS's negative-zero `-0` for a `0` input — `-0` and `0` are visually/behaviorally identical in a
 * `translateX`, but normalizing avoids surprising `Object.is`/`toBe`-style equality checks.)
 */
export function ccTooltipArrowCompensationOffset(clampDeltaX: number): number {
  return clampDeltaX === 0 ? 0 : -clampDeltaX;
}

/** Positions the tooltip's root container relative to its (assumed `position: relative`) anchor
 *  — pure, unit-testable. `measuredSize` / `clampDeltaX` default to `0`, which (via
 *  {@link ccTooltipCenteringOffset}'s fallback) reproduces the ORIGINAL static-constant style —
 *  existing single-arg call shapes keep producing the pre-measurement estimate. */
export function ccTooltipContainerStyle(
  placement: CcTooltipPlacement,
  measuredSize = 0,
  clampDeltaX = 0,
): Record<string, unknown> {
  if (placement === 'left') {
    return {
      position: 'absolute',
      right: '100%',
      top: '50%',
      marginTop: ccTooltipCenteringOffset(measuredSize, FALLBACK_VERTICAL_OFFSET),
      marginRight: 8,
      flexDirection: 'row',
      alignItems: 'center',
    };
  }
  return {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    marginLeft: ccTooltipCenteringOffset(measuredSize, FALLBACK_HORIZONTAL_OFFSET) + clampDeltaX,
    marginBottom: 8,
    alignItems: 'center',
  };
}

/** The small dark bubble the arrow attaches to. */
function TooltipBubble(props: { text: string }): ReactElement {
  return (
    <View
      style={{
        backgroundColor: TOOLTIP_BACKGROUND,
        borderRadius: TOOLTIP_RADIUS,
        paddingVertical: 5,
        paddingHorizontal: 9,
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontWeight: '600',
          fontSize: TOOLTIP_FONT_SIZE,
          width: TOOLTIP_TEXT_WIDTH,
        }}
      >
        {props.text}
      </Text>
    </View>
  );
}

/** A 6×6 square rotated 45° to read as a small triangular arrow. `edgeStyle` pulls it flush
 *  against whichever bubble edge it points from (negative margin = half its own size).
 *  `compensationOffset` (see {@link ccTooltipArrowCompensationOffset}) is an ADDITIONAL
 *  `translateX` applied on top of the rotation — paint-only, does not affect the arrow's layout
 *  slot inside the shared bubble+arrow container — that cancels out the container's viewport-clamp
 *  shift so the arrow keeps pointing at the anchor button's true center even when the bubble
 *  itself has been nudged for the clamp. Defaults to `0` (no-op, byte-identical pre-fix). */
function TooltipArrow(props: {
  edgeStyle: Record<string, unknown>;
  compensationOffset?: number;
}): ReactElement {
  const { compensationOffset = 0 } = props;
  return (
    <View
      style={{
        width: ARROW_SIZE,
        height: ARROW_SIZE,
        backgroundColor: TOOLTIP_BACKGROUND,
        // translateX MUST precede rotate in this array: RN/CSS transforms compose so each later
        // function operates in the coordinate frame established by the earlier ones — putting
        // translateX first keeps it a pure screen-space horizontal shift (rotation then spins the
        // already-shifted square around its own, now-shifted, center); the reverse order would
        // translate along the ROTATED local axis, moving the arrow diagonally instead.
        transform: [{ translateX: compensationOffset }, { rotate: '45deg' }],
        ...props.edgeStyle,
      }}
    />
  );
}

/** The R42 "未提供字幕" tooltip. Renders `null` when `!visible`. */
export function CcTooltip(props: CcTooltipProps): ReactElement | null {
  const { visible, text, placement, testID } = props;

  // Own rendered size along the centering axis (width for 'top', height for 'left') — `0` until
  // the first `onLayout` lands (see `ccTooltipCenteringOffset`'s fallback).
  const [measuredSize, setMeasuredSize] = useState(0);
  // Horizontal viewport-edge clamp ADJUSTMENT, accumulated round over round ('top' placement
  // only — see the module doc comment on why this MUST be additive, not a replace). `0` until
  // the first `measureInWindow` callback lands, and `0` forever for 'left' placement.
  const [clampDeltaX, setClampDeltaX] = useState(0);
  const containerRef = useRef<ComponentRef<typeof View> | null>(null);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent): void => {
      const { width, height } = e.nativeEvent.layout;
      setMeasuredSize(placement === 'left' ? height : width);

      // 'left' placement (VOD side rail) never measures window position / clamps — no known
      // edge-overflow risk, and this keeps its code path byte-identical to pre-fix behavior
      // (design.md Decision 3).
      if (placement !== 'top') return;
      const node = containerRef.current;
      if (node == null) return;
      node.measureInWindow((x) => {
        const delta = ccTooltipHorizontalClampDelta({
          idealLeft: x,
          bubbleWidth: width,
          viewportWidth: Dimensions.get('window').width,
        });
        setClampDeltaX((prev) => prev + delta);
      });
    },
    [placement],
  );

  if (!visible) return null;

  const isLeft = placement === 'left';
  // See ccTooltipArrowCompensationOffset: cancels the container's clampDeltaX shift so the arrow
  // stays pinned to the button's true center. `clampDeltaX` is structurally always `0` for
  // `placement='left'` (handleLayout never measures/clamps that path), so this resolves to `0`
  // there — byte-identical to pre-fix rendering.
  const arrowCompensation = ccTooltipArrowCompensationOffset(clampDeltaX);
  return (
    <View
      ref={containerRef}
      testID={testID}
      style={ccTooltipContainerStyle(placement, measuredSize, clampDeltaX)}
      onLayout={handleLayout}
      pointerEvents="none"
    >
      {!isLeft ? (
        <TooltipArrow
          edgeStyle={{ marginBottom: -ARROW_SIZE / 2 }}
          compensationOffset={arrowCompensation}
        />
      ) : null}
      <TooltipBubble text={text} />
      {isLeft ? (
        <TooltipArrow
          edgeStyle={{ marginLeft: -ARROW_SIZE / 2 }}
          compensationOffset={arrowCompensation}
        />
      ) : null}
    </View>
  );
}
