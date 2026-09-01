// BottomSheetPresenter — the shared bottom-sheet chrome (rb-rn-sheetkit-parity).
//
// Parity: iOS `BottomSheetPresenter.swift` `.lbBottomSheet` presenter (the cohesive
//          shared bottom-sheet presenter). One RN presenter for EVERY grab-handle
//          bottom sheet (ProductList / ProductDetail / NotifyRestock + VideoInfoPanel)
//          so each leaf carries ONLY its content (grab handle + SheetScaffold). The
//          presenter owns the MODAL CHROME the iOS one owns:
//
//   (1) full-bleed DIM SCRIM — a `<View style={{ position:'absolute', inset:0 }}>` at
//       `rgba(0,0,0,0.55)` (iOS `Color.black.opacity(0.55)`). It:
//         • DIMS the background (the 0.55 black fill);
//         • BLOCKS background interaction — it is a `<Pressable>` ABOVE the host
//           content, so taps below the sheet never reach the video gesture layer
//           (iOS: the scrim Button "sits above host content → blocks the video below");
//         • TAP-TO-DISMISS — a scrim tap forwards `onDismiss` (iOS scrim `Button(action:
//           onDismiss)`); a tap on the card itself does NOT dismiss (the card sits above
//           the scrim and absorbs its own taps).
//         • FADES in / out — an `Animated.Value` opacity drives `0 → 1` on present and
//           `1 → 0` on dismiss (iOS scrim `.transition(.opacity)`). The card slide stays
//           translate-only (`SlideUpSheet`, design `lbp-sheet-in`); the fade belongs to
//           the scrim, not the card (rb-sheet-card-slide-only).
//
//   (2) the bottom-anchored SLIDING CARD — `SlideUpSheet` drives the card's pure
//       translate (slide up on present / down on dismiss, staying MOUNTED through the
//       dismiss so the slide-out has content). The grab handle + top-rounded shell +
//       `SheetScaffold` (pinned header/footer + ½-screen cap) live INSIDE the leaf's
//       `children` — the presenter only frames the scrim + the slide.
//
// Presentation state stays with the CONTAINER (the `visible` prop / the open-detail
// truth on the template); the presenter only renders chrome + forwards `onDismiss`,
// EXACTLY like the iOS modifier (which keeps `isPresented` / `item` on the caller).
//
// STRUCTURAL-SNAPSHOT NOTE: the scrim lives at the PRESENTER level, so a LEAF surface's
// own snapshot (ProductList / ProductDetail / NotifyRestock / VideoInfoPanel rendered in
// isolation) is UNCHANGED — those tests render the leaf directly, never through this
// presenter. Only a snapshot that renders the PRESENTER (or a container that mounts it)
// gains the scrim node, which sits BELOW the sliding card in the tree. The mock's
// `Animated` stubs make the fade "instant" (opacity is invisible to the tree shape),
// keeping the structural tree byte-stable.
//
// UNIFIED DRAG GESTURE (rb-rn-sheetkit-resize-dismiss-unify, design `LBPBottomSheet` drag
// handle): the presenter ALWAYS wraps `children` in a measured hit-zone (no more opt-in — every
// grab-handle bottom sheet this presenter carries gets "drag up to resize, drag down to
// dismiss" as one continuous gesture). The gesture math + floor-latch mechanics live in the
// shared `useSheetDragGesture` hook (`sheetDragGesture.ts`) — this component only wires it to
// its own wrapper node and forwards `onHeightPctChange` / `onDismiss`, never applying the
// fraction to any layout itself (D-1 one-way data flow; the caller threads it back down into
// whichever leaf prop feeds that leaf's own `SheetScaffold` `capPct`).
//
// rb-rn-sheetkit-dismiss-after-resize-fix: the dismiss floor the hook feeds into its drag
// arithmetic is no longer pinned to the mount-time measurement for the whole presentation — it
// is re-derived at the start of every new gesture from whatever height the sheet is actually at
// (see `sheetDragGesture.ts`'s `gestureStartFloor`). This component's own wiring is unaffected
// (still just `visible` / `onDismiss` / `onHeightPctChange` passed through unchanged).
//
// rb-rn-sheetkit-drag-row-height: the hit-zone is now 44px tall (was 32) and insets `left` /
// `right` by `DRAG_HIT_SIDE_INSET` instead of going full-bleed — the taller zone would otherwise
// swallow taps on the leaf header's `SheetHeaderCloseButton` (it renders AFTER `children`, so it
// paints/hit-tests above it). See `sheetDragGesture.ts`'s `DRAG_HIT_SIDE_INSET` doc comment.

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { SlideUpSheet } from '../SlideUpSheet';
import { LBTestIDs } from '../testing/LBTestIDs';
import { DRAG_HIT_HEIGHT, DRAG_HIT_SIDE_INSET, useSheetDragGesture } from './sheetDragGesture';

/** Shared scrim fade duration (matches the sheet slide `lbp-sheet-in`, 0.32s). */
const SCRIM_FADE_DURATION = 320;
/** Full-bleed dim scrim color (parity iOS `Color.black.opacity(0.55)`). */
const SCRIM_COLOR = 'rgba(0,0,0,0.55)';

/** Props for the {@link BottomSheetPresenter}. */
export interface BottomSheetPresenterProps {
  /**
   * Whether the sheet is shown. `true` → fade the scrim in + slide the card up;
   * `false` → fade the scrim out + slide the card down (then unmount the card via
   * `SlideUpSheet`). Presentation truth lives on the CONTAINER — the presenter only
   * renders chrome (parity iOS `isPresented` / `item` bindings on the caller).
   */
  readonly visible: boolean;
  /**
   * Tap-the-scrim / dismiss intent (parity iOS scrim `Button(action: onDismiss)`). ALSO fires
   * when the shared drag gesture is pulled past the floor and past the dismiss threshold
   * (rb-rn-sheetkit-resize-dismiss-unify) — the presenter NEVER owns the presentation flag
   * either way; it forwards this so the container can flip `visible` false + run its own
   * close side effect. Optional (demo / snapshot).
   */
  readonly onDismiss?: () => void;
  /**
   * The positioning style for the SLIDING sheet card (e.g. `{ position: 'absolute',
   * left: 0, right: 0, bottom: 0 }`). Forwarded to {@link SlideUpSheet}.
   */
  readonly sheetStyle?: StyleProp<ViewStyle>;
  /**
   * The sheet content (the leaf's own grab handle + top-rounded `SheetScaffold`). KEEP
   * it stable through dismiss (pass the last content) so the slide-out has content —
   * `SlideUpSheet` stays mounted through the dismiss animation.
   */
  readonly children: ReactNode;
  /**
   * Fires with the live (clamped) height fraction — ONLY once the user has actually dragged
   * the handle (a move, or the release-settle after one). NEVER fires from the mount-time
   * floor measurement alone (`sheetDragGesture.ts`'s `cardOnLayout`) — a sheet the user has
   * never touched stays on its own leaf's content-sized / fixed default, tracking real content
   * changes, exactly as before this capability existed. The presenter NEVER applies this to
   * any layout of its own — it has no idea which leaf is mounted (D-1 one-way data flow); the
   * caller threads it down into whichever leaf prop feeds that leaf's own `SheetScaffold`
   * `capPct`.
   */
  readonly onHeightPctChange?: (pct: number) => void;
}

/**
 * The shared bottom-sheet presenter: a full-bleed DIM SCRIM (tap-to-dismiss +
 * background-interaction block + fade) BELOW a bottom-anchored SLIDING card
 * ({@link SlideUpSheet}, translate-only), with a unified drag-to-resize / drag-to-dismiss
 * gesture (`useSheetDragGesture`) laid over the card's content. Renders `null` while hidden
 * AND the card has fully slid away (the scrim unmounts as soon as `visible` flips false; the
 * card stays mounted through its slide-out via `SlideUpSheet`). Mirrors the iOS
 * `BottomSheetPresenter` chrome (scrim + slide + handle/scaffold inside the leaf).
 */
export function BottomSheetPresenter(props: BottomSheetPresenterProps): ReactElement | null {
  const { visible, onDismiss, sheetStyle, children, onHeightPctChange } = props;

  // Scrim fade opacity (parity iOS scrim `.transition(.opacity)`). 0 (hidden) → 1
  // (shown). Computed lazily — the mocked jest env never animates (opacity is invisible
  // to the structural tree).
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;
  // The scrim is mounted while presenting; it unmounts the instant `visible` flips
  // false (the card keeps sliding out below it via SlideUpSheet's own mount lifecycle).
  const [scrimMounted, setScrimMounted] = useState(visible);

  useEffect(() => {
    if (visible) setScrimMounted(true);
    const animation = Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: SCRIM_FADE_DURATION,
      easing: Easing.bezier(0.32, 0.72, 0.18, 1),
      // Opacity-only — keep it on the UI thread.
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setScrimMounted(false);
    });
    return () => animation.stop();
  }, [visible, fade]);

  // Unified resize + dismiss gesture (rb-rn-sheetkit-resize-dismiss-unify) — ALWAYS wired, no
  // more opt-in. See `sheetDragGesture.ts` for the floor-latch + PanResponder mechanics.
  const { cardOnLayout, dragHandlers } = useSheetDragGesture({ visible, onDismiss, onHeightPctChange });

  return (
    <>
      {/* (1) Full-bleed dim scrim — BELOW the sliding card. Blocks background
          interaction (a Pressable above the host content) + dims (0.55 black) + taps
          dismiss (parity iOS scrim Button). Fades via the Animated opacity. Mounted
          while presenting; unmounts when fully faded out. */}
      {scrimMounted ? (
        <Animated.View
          // Full-bleed absolute overlay — sits above the host content so it intercepts
          // every touch that would otherwise reach the video gesture layer below.
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fade }}
          pointerEvents="auto"
        >
          <Pressable
            testID={LBTestIDs.bottomSheetScrim}
            accessibilityRole="button"
            onPress={() => onDismiss?.()}
            style={{ flex: 1, backgroundColor: SCRIM_COLOR }}
          />
        </Animated.View>
      ) : null}

      {/* (2) Bottom-anchored sliding card (translate-only, design `lbp-sheet-in`). The
          grab handle + top-rounded SheetScaffold live INSIDE `children`. SlideUpSheet
          stays mounted through the dismiss so the slide-down has content. The card sits
          ABOVE the scrim, so a tap on the card never reaches the scrim's dismiss.

          The wrapper below is ALWAYS present (rb-rn-sheetkit-resize-dismiss-unify — no more
          `resizable` opt-in): `onLayout` latches this presentation's floor height, and an
          invisible drag hit-zone is laid OVER the top of `children` (roughly the leaf's own
          grab-handle band). */}
      <SlideUpSheet visible={visible} style={sheetStyle}>
        <View style={{ position: 'relative' }} onLayout={cardOnLayout}>
          {children}
          <View
            testID={LBTestIDs.bottomSheetDragHandle}
            {...dragHandlers}
            style={{
              position: 'absolute',
              top: 0,
              left: DRAG_HIT_SIDE_INSET,
              right: DRAG_HIT_SIDE_INSET,
              height: DRAG_HIT_HEIGHT,
            }}
          />
        </View>
      </SlideUpSheet>
    </>
  );
}
