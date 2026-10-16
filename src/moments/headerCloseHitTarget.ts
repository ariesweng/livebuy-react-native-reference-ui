// fix-rn-error-screen-close-button-blocked (livebuy-flutter-sdk issue #2): the error moment's
// full-bleed scrim is the topmost view, so the header's top-right ✕ underneath never receives a
// touch. The header button reports its window rect here (`measureInWindow`); the error scrim
// forwards a release that lands inside that rect to `onClose` (the container's close exit), so the
// ✕ works while every other control stays blocked. A plain mutable object (not React state): read
// only at touch time, never drives rendering.
import { createContext } from 'react';

export interface HeaderCloseRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HeaderCloseHitTarget {
  rect: HeaderCloseRect | null;
  onClose: (() => void) | null;
}

/** Provided by `LivebuyPlayerOverlays`; `null` (previews / tests without a container) → no forwarding. */
export const HeaderCloseHitTargetContext = createContext<HeaderCloseHitTarget | null>(null);

/** PURE: whether a release at window point (`pageX`, `pageY`) hits the header close `rect`. */
export function headerCloseHit(pageX: number, pageY: number, rect: HeaderCloseRect | null): boolean {
  if (rect == null) return false;
  return pageX >= rect.x && pageX <= rect.x + rect.width && pageY >= rect.y && pageY <= rect.y + rect.height;
}
