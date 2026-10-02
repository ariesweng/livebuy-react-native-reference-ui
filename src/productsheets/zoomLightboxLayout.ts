// zoomLightboxLayout — pure layout policy for the zoom lightbox photo
// (rb-rn-zoom-lightbox-ios-decode). No I/O, no React, no `react-native` import.
//
// WHY: RN iOS decodes a network image at its LAYOUT frame × screen scale (new architecture:
// the shadow node's content frame; legacy: the view's `bounds`). A `transform` is not part of
// layout, so a lightbox photo that is laid out at the card size and magnified with
// `transform: scale(2.4)` is a card-sized bitmap stretched 2.4× — soft. The lightbox therefore
// lays the photo out LARGER than the card (card × `layoutScale`) and scales it back down with
// the inverse transform: what is drawn is unchanged, but the platform decodes for the
// magnified size. Parity target: iOS native `RemoteStillImageView(zoomScale:)` (frame × 2.4,
// longest edge capped at 4096 px).
//
// Only RN iOS needs this. On Android the lightbox photo is decoded at the source resolution
// (`decode="source"`), independent of its frame, so its layout is left exactly as it was.

/** The lightbox's toggled zoom factor (design `ZOOMED = 2.4`) — also the largest magnification. */
export const ZOOM_MAX_SCALE = 2.4;

/** The lightbox card's width as a fraction of its container (`width: '84%'`). */
export const ZOOM_CARD_WIDTH_FRACTION = 0.84;

/**
 * Upper bound (px) for the edge of the frame the photo is laid out at — the same ceiling the
 * native lightboxes use for their decode request (iOS / Android / Flutter: 4096).
 */
export const ZOOM_DECODE_MAX_EDGE_PX = 4096;

/** Inputs of {@link zoomImageLayoutScale}. */
export interface ZoomImageLayoutQuery {
  /** `Platform.OS`. */
  readonly os: string;
  /** Window width in logical px — the card is never wider than this × the card fraction. */
  readonly windowWidth: number;
  /** Screen scale (px per logical px). */
  readonly pixelRatio: number;
}

/**
 * How many times larger than the card the lightbox photo is LAID OUT (≥ 1).
 *
 * `1` everywhere except iOS (the photo fills the card, as it always did). On iOS it is the
 * largest magnification, reduced only when the resulting frame edge would exceed
 * {@link ZOOM_DECODE_MAX_EDGE_PX}, and never below `1`. The card's pixel width is estimated
 * from the window (an upper bound — a container narrower than the window only makes the cap
 * more conservative). Unusable inputs fall back to the uncapped magnification.
 */
export function zoomImageLayoutScale(query: ZoomImageLayoutQuery): number {
  if (query.os !== 'ios') return 1;
  const cardEdgePx = query.windowWidth * ZOOM_CARD_WIDTH_FRACTION * query.pixelRatio;
  if (!Number.isFinite(cardEdgePx) || cardEdgePx <= 0) return ZOOM_MAX_SCALE;
  return Math.max(1, Math.min(ZOOM_MAX_SCALE, ZOOM_DECODE_MAX_EDGE_PX / cardEdgePx));
}

/** A percentage inset (`'-70%'`). */
export type PercentInset = `${number}%`;

/** The style that lays the photo out larger than the card and draws it at the card's size. */
export interface ZoomImageOversizeStyle {
  readonly top: PercentInset;
  readonly left: PercentInset;
  readonly right: PercentInset;
  readonly bottom: PercentInset;
  readonly transform: readonly [{ readonly scale: number }];
}

/**
 * Style overrides for the photo (applied over its absolute fill of the card): equal negative
 * insets on all four edges grow the layout box to `layoutScale` × the card, centred on the
 * card; the inverse scale (about the centre, RN's default transform origin) draws it back at
 * exactly the card's rect. `undefined` when no oversizing applies (`layoutScale` ≤ 1) — the
 * photo then keeps its plain absolute fill.
 */
export function zoomImageOversizeStyle(layoutScale: number): ZoomImageOversizeStyle | undefined {
  if (!(layoutScale > 1)) return undefined;
  const percent = Number((-(layoutScale - 1) * 50).toFixed(4));
  const inset: PercentInset = `${percent}%`;
  return { top: inset, left: inset, right: inset, bottom: inset, transform: [{ scale: 1 / layoutScale }] };
}

/**
 * Corner radius to give the photo so that, after the inverse scale, it is DRAWN with
 * `drawnRadius` (a radius is scaled along with the element it belongs to).
 */
export function zoomImageBorderRadius(drawnRadius: number, layoutScale: number): number {
  return layoutScale > 1 ? drawnRadius * layoutScale : drawnRadius;
}
