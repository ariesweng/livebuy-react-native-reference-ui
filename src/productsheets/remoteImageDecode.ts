// remoteImageDecode — pure decode-size policy for `RemoteImage` (rb-rn-remote-image-resize-method).
//
// Parity target: Android `rb-android-remote-image-loader-library` (decode at the size of the
// frame the image fills, not at the source resolution). This file holds ONLY the decisions;
// `RemoteImage.tsx` applies them. No I/O, no React, no `react-native` import.
//
// WHAT THE PLATFORMS DO (read from react-native 0.85.3 — see the change's design.md for the
// file / line references):
//   • Android: `<Image>` with the default `resizeMethod="auto"` hands Fresco NO resize options
//     for a network URL, so the bitmap is decoded at the source resolution. `resizeMethod=
//     "resize"` hands Fresco `view size (px) × resizeMultiplier`, and Fresco picks a decode
//     sample size from that. The sample size is ROUNDED, so the decoded bitmap can come out up
//     to 25% SMALLER than the size asked for — hence the multiplier below.
//   • iOS: the renderer already decodes at the layout frame × screen scale and re-requests when
//     the frame changes. `resizeMethod` / `resizeMultiplier` are Android-only props and are
//     ignored there.

/** How a `RemoteImage` is decoded. */
export type RemoteImageDecode =
  /** Decode at the size of the frame the image fills (every surface except the lightbox). */
  | 'frame'
  /**
   * Decode at the source resolution — for a surface that draws the image LARGER than its
   * layout frame (the zoom lightbox scales its content with a `transform`, which the native
   * image view cannot see). Same decode as before this policy existed.
   */
  | 'source';

/**
 * Factor applied to the frame size when asking Android to decode at frame size. Fresco's
 * sample-size rounding can under-shoot the asked-for size by up to 25% (decoded ≥ 0.75 × asked);
 * asking for 4/3 of the frame makes the decoded bitmap cover the frame on both edges whenever
 * the source is large enough (`0.75 × 4/3 = 1`).
 */
export const FRAME_DECODE_MULTIPLIER = 4 / 3;

/** The `<Image>` props that carry the decode policy (both are Android-only RN props). */
export interface RemoteImageDecodeProps {
  readonly resizeMethod: 'resize' | 'auto';
  readonly resizeMultiplier?: number;
}

/** Resolve the `<Image>` decode props for a {@link RemoteImageDecode}. */
export function remoteImageDecodeProps(decode: RemoteImageDecode): RemoteImageDecodeProps {
  if (decode === 'source') return { resizeMethod: 'auto' };
  return { resizeMethod: 'resize', resizeMultiplier: FRAME_DECODE_MULTIPLIER };
}

/** A layout frame in logical px. */
export interface FrameSize {
  readonly width: number;
  readonly height: number;
}

/** Slack (logical px) so sub-pixel layout noise is never read as "the frame grew". */
const GROWTH_TOLERANCE = 1;

function hasArea(frame: FrameSize | null): frame is FrameSize {
  return frame != null && frame.width > 0 && frame.height > 0;
}

/**
 * Width the image is drawn at inside `frame`, given the image's `aspect` (width ÷ height).
 * `cover` fills the frame (the larger of the two fits); `contain` fits inside it.
 */
export function drawnWidth(frame: FrameSize, aspect: number, resizeMode: 'cover' | 'contain'): number {
  const widthFromHeight = frame.height * aspect;
  return resizeMode === 'contain' ? Math.min(frame.width, widthFromHeight) : Math.max(frame.width, widthFromHeight);
}

/** Inputs of {@link needsLargerDecode}. */
export interface LargerDecodeQuery {
  /** The frame the current decode was requested for (`null` → nothing requested yet). */
  readonly requested: FrameSize | null;
  /** The frame the image now occupies. */
  readonly next: FrameSize;
  /** The loaded image's aspect (width ÷ height); `null` while it has not loaded. */
  readonly aspect: number | null;
  /** How the image is drawn in `next`. */
  readonly resizeMode: 'cover' | 'contain';
}

/**
 * Whether the bitmap decoded for `requested` is too small for `next` — i.e. the frame grew
 * past what was asked for and a larger decode must be requested. A frame that shrinks, or
 * that changes shape without needing more pixels, never does.
 *
 * A decode always COVERS the frame it was requested for, so once the aspect is known the
 * comparison is exact: pixels needed to draw the image in `next` vs pixels a cover of
 * `requested` provides. Before the image has loaded the aspect is unknown, and any edge
 * growing counts.
 */
export function needsLargerDecode(query: LargerDecodeQuery): boolean {
  const { requested, next, aspect, resizeMode } = query;
  if (!hasArea(requested) || !hasArea(next)) return false;
  if (aspect == null || !(aspect > 0)) {
    return next.width > requested.width + GROWTH_TOLERANCE || next.height > requested.height + GROWTH_TOLERANCE;
  }
  return drawnWidth(next, aspect, resizeMode) > drawnWidth(requested, aspect, 'cover') + GROWTH_TOLERANCE;
}
