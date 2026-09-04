// ProductImageZoomOverlay — family-3 product-image lightbox (rb-rn-product-image-zoom-lightbox).
//
// Spec: `reference-ui-rendering/spec.md` (family-3 product + sheets — 商品圖放大檢視燈箱).
// Design: `design/templates/minimal/screens.jsx` `ProductZoomOverlay` (31-95). Parity of iOS
// `ProductZoomOverlayView.swift` + Android `ProductImageZoomOverlay.kt` + Flutter
// `product_zoom_overlay.dart`.
//
// The full-frame product-image zoom viewer, mounted as the LAST child of the container's root
// `View` (ABOVE the `BottomSheetPresenter` → covers the open sheet) when a sheet's zoom badge is
// tapped. Reads ONE `LBProductDetailState` (`photos` + `name`) — purely a pixel-layer affordance,
// no view-model / template / core state. Behaviour mirrors the design's `ProductZoomOverlay`:
//
//   • dark backdrop (0.92); tap the backdrop to close.
//   • centered square product image (84% width, aspect 1:1, radius 16, shadow); tap-to-zoom
//     (1 ⇄ 2.4×); drag-to-pan when zoomed (clamped to ±110*(z-1)); a second tap resets.
//   • top-right circular close button (deterministic × glyph).
//   • bottom gradient-ish caption: product name + hint (changes when zoomed).
//
// Photo rendering reuses the same `PHOTO_FILL` placeholder + monogram + `RemoteImage`:
// `live === false` (snapshot / demo) draws the deterministic fill + monogram only; `live === true`
// overlays the real photo. No network-uri Image outside `RemoteImage`.
//
// The photo SOURCE is SPEC-AWARE (rn-product-sheet-spec-photo-reference-ui, parity iOS
// `ios-product-sheet-spec-photo-reference-ui`): this view is given the sheet's
// {@link ProductImageZoomOverlayProps.selectedSpec}, so the lightbox magnifies the same photo the
// sheet drew rather than always the product-level one. The resolution itself lives in the shared
// pure function `resolveProductPhoto` — this view RE-USES it, it does NOT re-derive the ladder.
// (Before this change it carried its own verbatim copy of `detail.photos[0]`, i.e. exactly the
// second-consumer duplication that resolvedProductPhoto.ts exists to collapse.)
//
// OVERRIDE (rb-rn-product-detail-image-gallery, design R34): the `.detail` presentation's main
// photo is now a swipeable multi-image gallery (`ProductDetailSheetView.tsx`) — the resolver's
// `primaryPhoto` is only ever the FIRST drawable entry, but the user may have swiped to a
// DIFFERENT photo before tapping the zoom badge. {@link ProductImageZoomOverlayProps.overridePhotoURL}
// lets the container hand over "the photo the gallery is CURRENTLY showing" without this view
// re-deriving any selection logic of its own — it is a single extra input layered on top of the
// EXISTING resolver call, not a second resolution path. Omitted / blank → unchanged behaviour
// (falls back to `resolveProductPhoto(...).primaryPhoto`, byte-identical to before this prop
// existed).

import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import { Text } from '../TightText';

import { RemoteImage } from './RemoteImage';
import { resolveProductPhoto } from './resolvedProductPhoto';
import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';

import type { LBProductDetailState } from 'livebuy-react-native-ui';
import type { LBSpec } from 'livebuy-react-native';

/** Product-photo placeholder fill (mirrors ProductDetailSheetView `PHOTO_FILL`). */
const PHOTO_FILL = '#E27D5A';
/** The design's toggled zoom factor (`ZOOMED = 2.4`). */
const ZOOMED = 2.4;
const HINT_IDLE = '點圖片放大';
const HINT_ZOOMED = '拖曳檢視細節 · 點一下還原';
/** Close affordance glyph (mirrors ProductDetailSheetView `GLYPH_CLOSE`). */
const GLYPH_CLOSE = '×';

/** Up-to-2-char monogram (deterministic, pure). Mirrors ProductDetailSheetView `monogram`. */
function monogram(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'LB';
  return trimmed.slice(0, trimmed.length < 2 ? trimmed.length : 2).toUpperCase();
}

function clamp(v: number, lim: number): number {
  return Math.max(-lim, Math.min(lim, v));
}

export interface ProductImageZoomOverlayProps {
  /** The resolved reference-ui theme (FIRST, always). */
  readonly theme: ReferenceUITheme;
  /** The product whose image is zoomed (reads `photos` + `name`). */
  readonly detail: LBProductDetailState;
  /**
   * The currently selected variant spec (`LBVariantState.selectedSpec`), so the lightbox
   * magnifies THE SAME photo the sheet is showing
   * (rn-product-sheet-spec-photo-reference-ui). The container passes
   * `model.variant.selectedSpec`; defaults to `null` = "no selected-spec context" → the
   * product level, keeping existing call sites / demo / existing tests source-compatible
   * and behaviourally unchanged.
   *
   * Read LIVE rather than captured alongside `zoomedDetail`: the lightbox covers the
   * sheet, so the selection cannot change while it is open (parity iOS
   * `ProductSheetsOverlayView.swift`).
   *
   * Without this the sheet would show the 玫瑰棕 photo and tapping zoom would show 珊瑚橘 —
   * a NEW cross-surface inconsistency of exactly the kind this change removes. Read-only.
   */
  readonly selectedSpec?: LBSpec | null;
  /**
   * The photo the caller's gallery is CURRENTLY showing (rb-rn-product-detail-image-gallery,
   * design R34), overriding `resolveProductPhoto(detail, selectedSpec).primaryPhoto`. The
   * container (`ProductSheetsView`) passes the `.detail` presentation's currently-selected
   * gallery photo URL — captured at the moment the zoom badge is tapped — so the lightbox
   * magnifies the EXACT photo the user was looking at, not always the resolver's first
   * drawable entry.
   *
   * A `undefined` OR blank (empty / whitespace-only after trim) value is treated as "no
   * override": the resolver's `primaryPhoto` is used, exactly as before this prop existed —
   * existing call sites / demo / tests that omit it are source- and behaviour-compatible.
   * Read-only, by value; this view does NOT re-derive which photo is "current" — that
   * decision belongs entirely to the caller's gallery selection.
   */
  readonly overridePhotoURL?: string;
  /** `false` (snapshot / demo) → fill + monogram placeholder; `true` → real photo. */
  readonly live?: boolean;
  /** Backdrop / close-button tap → container clears `zoomedDetail`. */
  readonly onClose?: () => void;
}

/**
 * The family-3 full-frame product-image zoom viewer for one
 * {@link ProductImageZoomOverlayProps.detail}.
 */
export function ProductImageZoomOverlay(
  props: ProductImageZoomOverlayProps,
): ReactElement {
  const { theme, detail, selectedSpec = null, overridePhotoURL, live = false, onClose } = props;
  const [z, setZ] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Refs so the (once-created) PanResponder reads current z / pan without stale closures.
  const zRef = useRef(1);
  zRef.current = z;
  const panRef = useRef({ x: 0, y: 0 });
  panRef.current = pan;
  const panStart = useRef({ x: 0, y: 0 });

  const toggleZoom = (): void => {
    if (zRef.current > 1) {
      setZ(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZ(ZOOMED);
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        panStart.current = panRef.current;
      },
      onPanResponderMove: (_e, g) => {
        if (zRef.current <= 1) return;
        const lim = 110 * (zRef.current - 1);
        setPan({
          x: clamp(panStart.current.x + g.dx, lim),
          y: clamp(panStart.current.y + g.dy, lim),
        });
      },
      onPanResponderRelease: (_e, g) => {
        // A release with negligible movement is a TAP → toggle the zoom.
        if (Math.abs(g.dx) < 5 && Math.abs(g.dy) < 5) toggleZoom();
      },
    }),
  ).current;

  // WHICH photo is magnified is resolved by the SAME pure function the sheet uses, fed the
  // SAME `selectedSpec`, so the lightbox always shows the image the user just tapped. This
  // view MUST NOT re-derive the degradation ladder (rn-product-sheet-spec-photo-reference-ui).
  //
  // `overridePhotoURL` (rb-rn-product-detail-image-gallery, design R34) takes priority over the
  // resolver's `primaryPhoto` when it is a non-blank string — the gallery's CURRENT selection
  // wins over "the first drawable photo". A blank / omitted override is NOT a valid override
  // (mirrors `resolveProductPhoto`'s own "blank means unusable" judgement, applied here only to
  // the override value itself — this is NOT a second source-selection ladder).
  const hasOverride = overridePhotoURL != null && overridePhotoURL.trim().length > 0;
  const photoUri = hasOverride
    ? overridePhotoURL
    : resolveProductPhoto(detail, selectedSpec).primaryPhoto ?? undefined;
  const zoomed = z > 1;

  return (
    <View testID={LBTestIDs.zoomOverlay} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Full-bleed dark backdrop — tap to close. */}
      <Pressable
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.92)',
        }}
      />

      {/* Centered square image card — tap to zoom, drag to pan (when zoomed). */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="box-none"
      >
        <View
          testID={LBTestIDs.imageZoomImage}
          {...responder.panHandlers}
          style={{
            width: '84%',
            aspectRatio: 1,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: PHOTO_FILL,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: z },
            ],
            shadowColor: '#000000',
            shadowOpacity: 0.5,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 24 },
            elevation: 24,
          }}
        >
          <Text
            style={{
              color: 'rgba(255,255,255,0.92)',
              fontSize: 64 * theme.fontScale,
              fontWeight: '900',
            }}
          >
            {monogram(detail.name)}
          </Text>
          <RemoteImage live={live} uri={photoUri} borderRadius={16} />
        </View>
      </View>

      {/* Top-right circular close button. */}
      <Pressable
        testID={LBTestIDs.zoomClose}
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(255,255,255,0.14)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 18 * theme.fontScale, fontWeight: '700' }}>
          {GLYPH_CLOSE}
        </Text>
      </Pressable>

      {/* Bottom caption: product name + hint (changes when zoomed). */}
      <View
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22 }}
        pointerEvents="none"
      >
        <Text style={{ color: '#FFFFFF', fontSize: 15 * theme.fontScale, fontWeight: '700' }}>
          {detail.name}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 * theme.fontScale, marginTop: 4 }}>
          {zoomed ? HINT_ZOOMED : HINT_IDLE}
        </Text>
      </View>
    </View>
  );
}
