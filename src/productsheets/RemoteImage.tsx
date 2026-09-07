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

import { useEffect, useState, type ReactElement } from 'react';
import { Image, StyleSheet, type StyleProp, type ImageStyle, type ImageLoadEvent } from 'react-native';
import { referenceUiHttpsUpgraded } from '../referenceUiImageUrl';

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
 * The real-product-image overlay. Renders an absolutely-filled network `<Image>` over
 * the caller's deterministic placeholder ONLY when `live === true` and `uri` is a
 * non-empty string; otherwise renders `null` (the placeholder shows through). On a load
 * error the Image self-hides (fall back to the placeholder). Gated so the default
 * (snapshot / demo) path adds NO `<Image>` to the structural tree.
 */
export function RemoteImage(props: RemoteImageProps): ReactElement | null {
  const { live = false, uri, borderRadius = 0, style, resizeMode = 'cover', intrinsicSize, onLoad } = props;
  const [failed, setFailed] = useState(false);
  const trimmed = typeof uri === 'string' ? uri.trim() : '';
  // Reset the failure latch whenever the bound uri changes — a single `onError` on one URL
  // must NOT permanently blank out a later, valid URL fed to the SAME (non-remounted)
  // instance (PlayerHeaderBarView shopLogo across in-place switches, MiniCartPeekView
  // peek.pic as the cart changes, position-keyed CarouselCardView covers). Parity with iOS
  // `RemoteStillImageView` (per-URL `loadedURL` reload, no failure latch) + Android
  // `RemoteStillImage` (reload on URL change). A new URL that also fails re-latches via onError.
  useEffect(() => {
    setFailed(false);
  }, [trimmed]);
  if (!live || trimmed.length === 0 || failed) return null;
  // Upgrade a cleartext http:// pic to https:// before handing it to <Image> — RN iOS ATS
  // blocks cleartext so the image would never load → placeholder. https / non-http unchanged.
  return (
    <Image
      source={{ uri: referenceUiHttpsUpgraded(trimmed) }}
      onError={() => setFailed(true)}
      onLoad={
        onLoad == null
          ? undefined
          : (e: ImageLoadEvent) =>
              onLoad({ width: e.nativeEvent.source.width, height: e.nativeEvent.source.height })
      }
      resizeMode={resizeMode}
      style={
        intrinsicSize == null
          ? [StyleSheet.absoluteFill, { borderRadius }, style]
          : [{ width: intrinsicSize.width, height: intrinsicSize.height, borderRadius }, style]
      }
    />
  );
}
