// sheetDragGesture — shared drag-to-resize + drag-to-dismiss gesture math and hook
// (rb-rn-sheetkit-resize-dismiss-unify).
//
// Parity: iOS `BottomSheetChrome.dragState(baseFraction:floorFraction:translationHeight:
//   screenHeight:)` (SheetKit/BottomSheetPresenter.swift, `rb-ios-sheetkit-resize-dismiss-unify`).
//   The RN mechanism differs (PanResponder + `onLayout` latch instead of SwiftUI
//   GeometryReader/PreferenceKey) — see this change's design.md Decision 1-2 for why RN's
//   onLayout-based floor measurement is architecturally sound without needing a SheetScaffold
//   context/prop-drilling change.
//
// This module is the ONE place the resize/dismiss gesture arithmetic lives. It is consumed by
// BOTH `BottomSheetPresenter` (VideoInfoPanel / ProductDetail / NotifyRestockSheet) AND
// `ProductSheetsView`'s local ProductList drawer wiring (which keeps its own pre-existing
// scrim + plain View presentation, unrelated to BottomSheetPresenter's scrim/slide chrome) —
// see design.md Decision 5.
//
// rb-rn-sheetkit-dismiss-after-resize-fix: the dismiss floor no longer stays pinned to the
// mount-time `onLayout` latch across separate gestures — `gestureStartFloor` (below) re-derives
// it from whatever height the sheet is ACTUALLY at when a NEW gesture begins, so dismissing a
// sheet that was previously dragged taller only ever costs `DISMISS_THRESHOLD_PX`, not "travel
// back down to the original floor, then the threshold on top" (which could exceed the screen's
// draggable range on a short screen and made the sheet feel impossible to close). See this
// change's design.md for the full root-cause analysis.
//
// rb-rn-sheetkit-resize-floor-not-reanchored: that fix's `gestureStartFloor` result used to be
// written BACK into `floorFractionRef` (via `setFloorFraction`) — the SAME ref `onPanResponderMove`
// reads as the resize clamp's lower bound. Once re-anchored to the current (already-resized)
// height, `minFraction === startFraction` algebraically, so `dragState`'s resize clamp could
// never move the card back down at all — any subsequent downward drag went 100% into dismiss
// budget, with no reachable "shrink back toward the natural size" outcome (real-hardware
// regression: a short-content sheet, resized up then down in two separate gestures, got stuck at
// the oversized height with a persistent blank area). Parity Android
// `rb-android-sheetkit-resize-floor-reanchor-fix` / iOS `rb-ios-sheetkit-resize-shrink-after-
// grow-fix` (both 2026-08-26) hit and fixed the identical tension by splitting one shared floor
// into two independent ones. This module now does the same: `floorFractionRef` (fed by
// `cardOnLayout`) is the STRUCTURAL resize floor and is NEVER re-anchored by a gesture — see
// `onPanResponderMove`'s unchanged use of it. A new `dismissFloorRef`, re-anchored every gesture
// via the SAME `gestureStartFloor` call, feeds ONLY the dismiss-excess calculation in
// `onPanResponderRelease` — so dismissing after a prior resize-up still costs only
// `DISMISS_THRESHOLD_PX` (this fix's own goal is preserved), while a downward drag first shrinks
// the card toward its true structural floor on ANY gesture, not just the presentation's first
// one.

import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  type PanResponderInstance,
} from 'react-native';

/** Shared height-resize CEILING across every bottom sheet — dragging the handle UP never grows
 *  the card past 80% of the screen, regardless of the sheet's own floor height
 *  (`rb-rn-sheetkit-resize-ceiling-eighty-percent` — product decision, lowered from 90%). */
export const RESIZE_CEILING_FRACTION = 0.8;

/** Drag-to-dismiss threshold, in px, once the drag has been pushed past the floor (see
 *  {@link dragState}). RN never had a drag-to-dismiss gesture before this change (dismiss was
 *  scrim-tap / close-button only) — this is a NEWLY INTRODUCED constant, not a value carried
 *  over from an existing RN behavior. Chosen to match iOS's own 100pt dismiss threshold
 *  (`rb-ios-sheet-drag-dismiss-jitter`) for cross-platform feel consistency. */
export const DISMISS_THRESHOLD_PX = 100;

/** Invisible hit-zone height — roughly the leaf's own grab-handle band, so a drag started near
 *  the visible handle is captured without this presenter drawing a second handle graphic. Sized
 *  to the widely-recommended 44pt minimum touch target (rb-rn-sheetkit-drag-row-height — raised
 *  from the prior 32, in the same change family as Android's grab-handle band going from 16dp to
 *  44dp). See {@link DRAG_HIT_SIDE_INSET} for why the hit-zone is NOT full-bleed horizontally. */
export const DRAG_HIT_HEIGHT = 44;

/**
 * Horizontal inset applied to EACH side of the invisible drag hit-zone (rb-rn-sheetkit-drag-row-
 * height). Every leaf header in this package (`ProductListView` / `ProductDetailSheetView` /
 * `NotifyRestockSheetView` / `VideoInfoPanelView`) places its `SheetHeaderCloseButton` at
 * `right: 12` (a 32×32 tap target — see `SheetHeaderCloseButton.tsx`), and `ProductListView`'s
 * collapsed header additionally places a 32×32 search-toggle button flush against its leading
 * `paddingHorizontal: 16` edge — both fall within `DRAG_HIT_HEIGHT`'s vertical band, right below
 * the grab handle.
 *
 * The hit-zone is a SIBLING rendered AFTER `children` (see `BottomSheetPresenter` /
 * `ProductSheetsView`'s ProductList wiring), so it paints — and hit-tests — ABOVE those buttons:
 * React Native's touch hit-test, given two overlapping siblings, always resolves to whichever one
 * paints on top, and does NOT fall back to trying the other sibling once it has picked one. A
 * full-bleed `left: 0, right: 0` hit-zone would therefore swallow taps on those buttons within the
 * overlap — this is a structural consequence of sibling stacking order, not something `zIndex` or
 * `pointerEvents` can fix from the button's side (the button's parent is several levels removed
 * from the hit-zone's parent, outside `zIndex`'s same-parent-siblings scope).
 *
 * Insetting BOTH sides by this amount keeps every header's close / search button fully outside
 * the hit-zone's horizontal bounds (56 comfortably clears each button's worst-case footprint —
 * the close button's `right: 12` + 32 width = 44, the search button's `paddingHorizontal: 16` +
 * 32 width = 48 — see `sheetDragGesture.test.tsx`'s invariant assertions), while leaving the
 * CENTERED grab-handle band (36pt wide) — where a drag is actually expected to start — untouched.
 *
 * Does NOT fully cover `ProductListView`'s expanded `SearchHeader` (its `TextInput` spans
 * near-full-width, centered, not near either edge) — that overlap pre-dates this change (present,
 * just smaller, even at the old 32px height) and is out of this change's scope; see this change's
 * design.md "Known limitation".
 */
export const DRAG_HIT_SIDE_INSET = 56;

/**
 * PURE drag arithmetic — exported so it is directly unit-testable regardless of the
 * `PanResponder` jest-mock limitation (see the file-header note on testability below).
 *
 * `baseFraction` is the height fraction in effect when the CURRENT gesture began
 * (`onPanResponderGrant` captures it); `floorFraction` is the floor in effect for the CURRENT
 * gesture — the mount-time `onLayout` latch for a presentation's very first gesture, or
 * whatever height a PRIOR gesture already committed for every gesture after that (see
 * {@link gestureStartFloor}, rb-rn-sheetkit-dismiss-after-resize-fix — this function's own
 * signature and arithmetic are unchanged by that fix, only WHERE its caller sources
 * `floorFraction` from); `translationHeight` is the gesture's cumulative vertical translation
 * (negative = up = taller), matching RN `PanResponderGestureState.dy` semantics (measured from
 * the gesture's start, not the previous move event).
 *
 * The card's fraction tracks `baseFraction - translationHeight/screenHeightPx`, clamped to
 * `[floorFraction, RESIZE_CEILING_FRACTION]`; only once dragging DOWN would push the
 * fraction BELOW `floorFraction` does the excess (in px) show up as `dragOffset` instead —
 * the two are mutually exclusive at every instant (`dragOffset > 0` implies
 * `heightFraction === floorFraction`).
 */
export function dragState(
  baseFraction: number,
  floorFraction: number,
  translationHeight: number,
  screenHeightPx: number,
): { heightFraction: number; dragOffset: number } {
  if (screenHeightPx <= 0) return { heightFraction: baseFraction, dragOffset: 0 };
  const candidate = baseFraction + -translationHeight / screenHeightPx;
  const heightFraction = Math.min(RESIZE_CEILING_FRACTION, Math.max(floorFraction, candidate));
  const dragOffset = Math.max(0, floorFraction - candidate) * screenHeightPx;
  return { heightFraction, dragOffset };
}

/**
 * The outcome of a gesture RELEASE (rb-rn-sheetkit-resize-floor-not-reanchored) — exported, like
 * {@link dragState} and {@link gestureStartFloor}, so the ACTUAL fix (which floor feeds the
 * dismiss decision vs. the resize outcome, and that dismiss is checked FIRST) is directly
 * unit-testable despite the `PanResponder` jest-mock limitation: `onPanResponderRelease` itself
 * can never be simulated through a renderer, but this is the pure decision it delegates to.
 *
 * Checks the DISMISS decision first, against `dismissFloorFraction` (this gesture's own
 * re-anchored floor — see {@link gestureStartFloor}); only when that does NOT cross
 * {@link DISMISS_THRESHOLD_PX} does it compute the RESIZE outcome, against
 * `resizeFloorFraction` (the presentation's fixed STRUCTURAL floor, never re-anchored — see the
 * file-header doc). A regression that swaps which floor feeds which decision, or that checks the
 * resize outcome before dismiss, changes this function's return value for a resized-up
 * presentation's later, separate gesture — see `sheetDragGesture.test.tsx` for the pinning
 * tests this enables.
 */
export function releaseOutcome(
  gestureBaseFraction: number,
  resizeFloorFraction: number,
  dismissFloorFraction: number,
  translationHeight: number,
  screenHeightPx: number,
): { readonly dismiss: true } | { readonly dismiss: false; readonly heightFraction: number } {
  const { dragOffset: dismissExcess } = dragState(
    gestureBaseFraction,
    dismissFloorFraction,
    translationHeight,
    screenHeightPx,
  );
  if (dismissExcess > DISMISS_THRESHOLD_PX) {
    return { dismiss: true };
  }
  const { heightFraction } = dragState(gestureBaseFraction, resizeFloorFraction, translationHeight, screenHeightPx);
  return { dismiss: false, heightFraction };
}

/**
 * The floor to use for a NEW gesture's dismiss budget AND its resize accumulator's starting
 * point (rb-rn-sheetkit-dismiss-after-resize-fix; as of rb-rn-sheetkit-resize-floor-not-
 * reanchored this feeds `dismissFloorRef` / `gestureBaseRef` ONLY — see the file-header doc for
 * why the resize CLAMP's own floor, `floorFractionRef`, is deliberately no longer derived from
 * this function's result). Exported — like {@link dragState} — so this fix is directly
 * unit-testable despite the `PanResponder` jest-mock limitation (see the file-header
 * testability note): `onPanResponderGrant` itself can never be simulated through a renderer,
 * but the value it computes can be asserted directly.
 *
 * A gesture's floor is whatever height is ACTUALLY in effect right now: the height a PRIOR
 * gesture in this same presentation cycle already committed (`committedHeightFraction`), or —
 * for the presentation's very first gesture, when nothing has been committed yet — the
 * mount-time `onLayout` latch (`mountFloorFraction`, see {@link useSheetDragGesture}'s
 * `cardOnLayout`).
 *
 * This is what makes the dismiss threshold relative to the sheet's CURRENT height instead of
 * forever the (often much smaller) content-sized floor first measured on mount: once the user
 * has dragged a sheet up to e.g. `RESIZE_CEILING_FRACTION`, dismissing it in a SUBSEQUENT
 * gesture only ever costs {@link DISMISS_THRESHOLD_PX} of downward drag — never "travel all the
 * way back down to the original floor, then another `DISMISS_THRESHOLD_PX`", which can exceed a
 * short screen's draggable range and made the sheet feel impossible to close.
 */
export function gestureStartFloor(
  committedHeightFraction: number | null,
  mountFloorFraction: number,
): number {
  return committedHeightFraction ?? mountFloorFraction;
}

export interface UseSheetDragGestureOptions {
  /** Whether the sheet is currently presented — a `false → true` transition resets the
   *  latched floor (fresh measurement for the new presentation, "關閉重開回預設"). */
  readonly visible: boolean;
  /** Dismiss intent — fired when a downward drag past the floor clears
   *  {@link DISMISS_THRESHOLD_PX}. The hook NEVER flips `visible` itself; the caller owns that
   *  (D-1 one-way data flow), exactly like `BottomSheetPresenter`'s pre-existing scrim tap. */
  readonly onDismiss?: () => void;
  /**
   * Fires with the current (clamped) height fraction — ONLY once an actual drag gesture has
   * happened (a move, or the release-settle after one); NEVER on the initial floor-latch itself
   * (mount-time `onLayout` measurement is gesture-independent — see {@link cardOnLayout} on
   * {@link UseSheetDragGestureResult}). This mirrors iOS's separation of `floorFraction`
   * (auto-latched, feeds `dragState` as the resize floor) from `heightFraction` (the `@State`
   * that actually drives fixed-height mode, written ONLY inside `dragGesture.onChanged`) — a
   * content-sized sheet the user has never touched MUST stay content-sized (`maxHeight`,
   * `SheetScaffold.usesFixedHeight`), tracking whatever it naturally renders (tab switches,
   * search filtering, conditional banners, …), not frozen at whatever height it happened to
   * measure on its first layout pass. The hook OWNS the gesture + fraction state; it never
   * applies the fraction to any layout itself.
   */
  readonly onHeightPctChange?: (pct: number) => void;
}

export interface UseSheetDragGestureResult {
  /**
   * Attach to the `onLayout` of the View wrapping the card content — latches the floor
   * fraction once per presentation from the FIRST non-zero measured height. This latch feeds
   * `dragState` as the RESIZE floor for EVERY gesture (rb-rn-sheetkit-resize-floor-not-
   * reanchored — this value is deliberately never re-anchored to a later, resized-up height; see
   * the file-header doc for why). A separate, per-gesture-re-anchored floor (see
   * {@link gestureStartFloor}) is used only for the DISMISS decision. It deliberately does
   * NOT call `onHeightPctChange` (see that prop's doc) — a mount-time layout pass is not a
   * drag gesture, so a content-sized sheet the user hasn't touched yet stays content-sized.
   */
  readonly cardOnLayout: (e: LayoutChangeEvent) => void;
  /** Spread onto the invisible drag hit-zone View. */
  readonly dragHandlers: PanResponderInstance['panHandlers'];
}

/**
 * The shared resize + dismiss gesture: floor-latch via `onLayout` (design.md Decision 2) +
 * `PanResponder`-driven drag (design.md Decision 6). Used by BOTH `BottomSheetPresenter` and
 * `ProductSheetsView`'s local `ProductList` drawer wiring — see the file header.
 */
export function useSheetDragGesture(options: UseSheetDragGestureOptions): UseSheetDragGestureResult {
  const { visible, onDismiss, onHeightPctChange } = options;

  // Latest callback refs — so the once-created PanResponder always reads the current callback
  // without needing to be recreated (mirrors the existing PlayerShellView / NowIntroducingCarousel
  // "refs so the once-created PanResponder reads current state" pattern in this package).
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const onHeightPctChangeRef = useRef(onHeightPctChange);
  onHeightPctChangeRef.current = onHeightPctChange;

  // The latched floor fraction for THIS presentation cycle. `null` until the first non-zero
  // `onLayout` measurement lands.
  const [floorFraction, setFloorFraction] = useState<number | null>(null);
  const floorFractionRef = useRef<number | null>(null);
  floorFractionRef.current = floorFraction;

  // The height fraction currently in effect (mirrors `floorFraction` until the user drags).
  const heightPctRef = useRef<number | null>(null);
  // The fraction at the CURRENT gesture's start — `onPanResponderMove` deltas accumulate from
  // this, never from the previous move's result (gestureState.dy is measured from the gesture
  // start, not the last event).
  const gestureBaseRef = useRef(0);
  // This GESTURE's own dismiss reference floor (rb-rn-sheetkit-resize-floor-not-reanchored,
  // parity Android `rb-android-sheetkit-resize-floor-reanchor-fix` / iOS `rb-ios-sheetkit-
  // resize-shrink-after-grow-fix`) — re-anchored at the start of every gesture
  // (`onPanResponderGrant`) via `gestureStartFloor`, same as `gestureBaseRef`. Read ONLY by
  // `onPanResponderRelease`'s dismiss decision — completely separate from `floorFractionRef`
  // (the STRUCTURAL floor fed to `onPanResponderMove`'s resize clamp, which this fix stops
  // re-anchoring). See the file-header doc for the full two-floor rationale.
  const dismissFloorRef = useRef<number | null>(null);

  // Reset per presentation cycle ("關閉重開回預設") — `visible` transitioning to `true` clears
  // the latch so the NEXT `onLayout` re-measures this presentation's own resting height.
  useEffect(() => {
    if (visible) {
      setFloorFraction(null);
      heightPctRef.current = null;
    }
  }, [visible]);

  const cardOnLayout = (e: LayoutChangeEvent): void => {
    // Latch ONCE per presentation cycle — later layout passes (e.g. triggered by SheetScaffold
    // switching from `maxHeight` to a fixed `height` once a drag starts feeding `capPct` back
    // down) are deliberately ignored so this never becomes a measure → setState → re-render →
    // re-measure feedback loop (design.md Decision 2).
    if (floorFractionRef.current != null) return;
    const screenHeight = Dimensions.get('window').height;
    const measured = e.nativeEvent.layout.height;
    if (screenHeight <= 0 || measured <= 0) return;
    const fraction = Math.min(RESIZE_CEILING_FRACTION, measured / screenHeight);
    setFloorFraction(fraction);
    heightPctRef.current = fraction;
    gestureBaseRef.current = fraction;
    // Deliberately NOT calling `onHeightPctChangeRef` here — see the doc comment on
    // `onHeightPctChange` / `cardOnLayout`. This is a gesture-INDEPENDENT measurement that
    // only feeds `dragState`'s floor input; reporting it here would force every content-sized
    // sheet into fixed-height mode (`SheetScaffold.usesFixedHeight`) the instant it mounts,
    // before the user has touched the handle, freezing it at whatever it happened to measure
    // on the FIRST layout pass — never tracking later content changes (tab switches, search
    // filtering, conditional banners, …) the way `maxHeight` naturally would.
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // rb-rn-sheetkit-resize-floor-not-reanchored: re-derive this GESTURE's own accumulator
        // start / dismiss reference from whatever height is actually in effect right now — but,
        // unlike the superseded rb-rn-sheetkit-dismiss-after-resize-fix design, do NOT write this
        // back into `floorFractionRef` any more. `floorFractionRef` (fed exclusively by
        // `cardOnLayout`) stays the presentation's fixed STRUCTURAL floor for the resize clamp
        // (`onPanResponderMove`) across every gesture — see the file-header doc for why sharing
        // one ref for both purposes made the resize clamp degenerate (`minFraction ===
        // startFraction`) on any gesture after the first resize-up.
        const mountFloor = floorFractionRef.current;
        const startFraction = gestureStartFloor(heightPctRef.current, mountFloor ?? 0);
        gestureBaseRef.current = startFraction;
        dismissFloorRef.current = startFraction;
      },
      onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        const floor = floorFractionRef.current;
        if (floor == null) return; // Defensive: no layout measured yet — should not happen in
        // practice (layout runs well before a user can touch the hit-zone), see design.md Risks.
        const screenHeight = Dimensions.get('window').height;
        const { heightFraction } = dragState(gestureBaseRef.current, floor, gesture.dy, screenHeight);
        heightPctRef.current = heightFraction;
        onHeightPctChangeRef.current?.(heightFraction);
      },
      onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        const resizeFloor = floorFractionRef.current;
        if (resizeFloor == null) return;
        const dismissFloor = dismissFloorRef.current ?? resizeFloor;
        const screenHeight = Dimensions.get('window').height;

        // rb-rn-sheetkit-resize-floor-not-reanchored: delegate to the pure `releaseOutcome` —
        // dismiss decision FIRST (against THIS gesture's own dismiss floor), resize outcome only
        // if not dismissing (against the STRUCTURAL floor). See that function's own doc.
        const outcome = releaseOutcome(gestureBaseRef.current, resizeFloor, dismissFloor, gesture.dy, screenHeight);
        if (outcome.dismiss) {
          // Past the dismiss threshold — forward the intent; the caller flips `visible` false
          // and the existing SlideUpSheet 0.32s slide-out animation takes over. The height
          // state is NOT committed (the sheet is going away).
          onDismissRef.current?.();
          return;
        }
        heightPctRef.current = outcome.heightFraction;
        onHeightPctChangeRef.current?.(outcome.heightFraction);
      },
    }),
  ).current;

  return { cardOnLayout, dragHandlers: panResponder.panHandlers };
}
