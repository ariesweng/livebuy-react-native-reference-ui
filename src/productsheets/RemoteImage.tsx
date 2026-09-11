// RemoteImage — family-3 real-product-image overlay (rb-rn-product-real-images).
//
// Parity: iOS `RemoteStillImageView` (rb-ios-product-real-images) + Android / Flutter
// real-image gating. The reference-ui product surfaces draw a deterministic
// placeholder (a filled View + glyph) so the STRUCTURAL snapshot path never depends on
// a network image (the「snapshot 綠 ≠ 畫對」trap). At RUNTIME (host `live === true`) the
// real product photo loads OVER that placeholder via a network-uri `<Image>`; on a load
// error it falls back to the placeholder (the Image unmounts itself).
//
// LIVE-FLAG GATING (the four-platform contract):
//   • `live === false` (snapshot / demo — the DEFAULT) → renders NOTHING (the caller's
//     placeholder shows through). The structural snapshot is unchanged — no `<Image>` in
//     the tree (existing「no network-uri Image」discipline + the NotifyRestock test's
//     `findAllByType('Image') === 0` assertion hold for the default-false path).
//   • `live === true` (host runtime) + a non-empty `uri` → an absolutely-filled
//     `<Image source={{ uri }}>` over the placeholder; `onError` hides it (fall back).
//
// Pure presentation — no animation / randomness. jsx automatic runtime (no React import).

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Animated, StyleSheet, type StyleProp, type ImageStyle, type ImageLoadEvent } from 'react-native';
import { referenceUiHttpsUpgraded } from '../referenceUiImageUrl';

/**
 * Fade-in duration (ms) applied once a loaded image is ready to show
 * (rb-rn-product-image-loading-polish) — replaces the prior hard cut. RN cannot reliably
 * distinguish a real network load from a framework-cache hit on `onLoad`, so this fade applies
 * on EVERY `onLoad` (a cache-hit still gets a brief 180ms fade-in; deliberately relaxed vs.
 * iOS / Android / Flutter, which can tell the two apart).
 */
const FADE_IN_DURATION_MS = 180;

/** Props for the {@link RemoteImage} overlay. */
export interface RemoteImageProps {
  /** Live-flag gate. `false` (default) → renders nothing (placeholder shows through). */
  readonly live?: boolean;
  /** The first product photo URL (`photos[0]`); empty / missing → nothing renders. */
  readonly uri?: string;
  /** Border radius to clip the loaded image to (matches the placeholder's radius). */
  readonly borderRadius?: number;
  /** Optional extra positioning style (the caller fills the placeholder bounds). */
  readonly style?: StyleProp<ImageStyle>;
  /**
   * How the loaded image fills the frame. Default `'cover'` (most callers, including the
   * widget card cover / product chip, rely on this default or pass it explicitly —
   * `rb-rn-widget-carousel-card-image-cover` retired the earlier `'contain'` override that
   * used to make the WHOLE image show for those three call sites).
   */
  readonly resizeMode?: 'cover' | 'contain';
  /**
   * Opt-in explicit display size (rb-rn-product-detail-main-image-scale-down-letterbox). When
   * provided, the loaded `<Image>` renders at this EXACT `width`/`height` as a normal
   * (non-absolute) flow child instead of the default `StyleSheet.absoluteFill` overlay — the
   * caller's own container is expected to center it (`alignItems`/`justifyContent`) and size
   * itself to match. Omitted (default, every OTHER existing call site) → behavior is byte-
   * identical to before this prop existed — the absolute-fill overlay is untouched.
   */
  readonly intrinsicSize?: { readonly width: number; readonly height: number };
  /**
   * Opt-in load callback (rb-rn-product-detail-main-image-scale-down-letterbox) — fires the
   * loaded image's NATIVE pixel size (`nativeEvent.source.width` / `.height`) once the
   * underlying `<Image>` finishes loading, letting the caller compute a scale-down-letterbox
   * layout (see `resolveScaleDownLetterbox` in `ProductDetailSheetView.tsx`). Omitted
   * (default) → no behavior change; the underlying `<Image onLoad>` handler is simply absent.
   */
  readonly onLoad?: (size: { width: number; height: number }) => void;
}

/**
 * The real-product-image overlay. Renders an absolutely-filled network `<Animated.Image>` over
 * the caller's deterministic placeholder ONLY when `live === true` and `uri` is a
 * non-empty string; otherwise renders `null` (the placeholder shows through). On a load
 * error the Image self-hides (fall back to the placeholder). A successful load fades in over
 * {@link FADE_IN_DURATION_MS} (rb-rn-product-image-loading-polish) rather than cutting in
 * instantly. Gated so the default (snapshot / demo) path adds NO `<Animated.Image>` to the
 * structural tree.
 */
export function RemoteImage(props: RemoteImageProps): ReactElement | null {
  const { live = false, uri, borderRadius = 0, style, resizeMode = 'cover', intrinsicSize, onLoad } = props;
  const [failed, setFailed] = useState(false);
  // Stable across renders (not re-created), so the SAME Animated.Value drives every fade-in for
  // this component instance's lifetime — a fresh `Animated.Value` on every render would reset
  // mid-animation and never settle.
  const opacity = useRef(new Animated.Value(0)).current;
  const trimmed = typeof uri === 'string' ? uri.trim() : '';
  // Reset the failure latch AND the fade-in opacity whenever the bound uri changes — a single
  // `onError` on one URL must NOT permanently blank out a later, valid URL fed to the SAME
  // (non-remounted) instance (PlayerHeaderBarView shopLogo across in-place switches,
  // MiniCartPeekView peek.pic as the cart changes, position-keyed CarouselCardView covers).
  // Parity with iOS `RemoteStillImageView` (per-URL `loadedURL` reload, no failure latch) +
  // Android `RemoteStillImage` (reload on URL change). A new URL that also fails re-latches via
  // onError. The opacity reset (rb-rn-product-image-loading-polish) rides the SAME effect —
  // a newly-bound URL always starts invisible and fades in on its own `onLoad`, it never
  // inherits the previous URL's already-settled opacity of 1.
  useEffect(() => {
    setFailed(false);
    opacity.setValue(0);
  }, [trimmed, opacity]);
  if (!live || trimmed.length === 0 || failed) return null;
  // Fade opacity 0 → 1 on every load completion (rb-rn-product-image-loading-polish). RN cannot
  // reliably tell a real network load apart from a framework-cache hit here, so this fires on
  // EVERY `onLoad` — see FADE_IN_DURATION_MS's doc comment.
  const handleLoad = (e: ImageLoadEvent): void => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_DURATION_MS,
      useNativeDriver: true,
    }).start();
    onLoad?.({ width: e.nativeEvent.source.width, height: e.nativeEvent.source.height });
  };
  // Upgrade a cleartext http:// pic to https:// before handing it to <Image> — RN iOS ATS
  // blocks cleartext so the image would never load → placeholder. https / non-http unchanged.
  return (
    <Animated.Image
      source={{ uri: referenceUiHttpsUpgraded(trimmed) }}
      onError={() => setFailed(true)}
      onLoad={handleLoad}
      resizeMode={resizeMode}
      style={
        intrinsicSize == null
          ? [StyleSheet.absoluteFill, { borderRadius, opacity }, style]
          : [{ width: intrinsicSize.width, height: intrinsicSize.height, borderRadius, opacity }, style]
      }
    />
  );
}
