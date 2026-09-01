// widgetVisibility — hide in-app-unplayable lives from the family-5 widget (RN).
//
// Spec: `widget-hide-urlless-live/spec.md` (iOS canonical). RN parity of iOS
// `WidgetVisibility.swift` / Android `WidgetVisibility.kt`.
//
// `/sdk/widget` occasionally returns a live whose `type === 2` (直播) and
// `liveStatus === 1` (直播中) but whose `liveurl` is empty ('') — a live with NO
// playable stream URL on the widget layer. No SDK playback engine can play it, so
// the reference-ui drop-in HIDES it (carousel / grid card list + floating preview)
// rather than render a dead card.
//
// The predicate is a PURE, POSITIVE three-condition AND — NEVER a negative rule
// such as "the `liveurl` is not `.m3u8`": the backend may legitimately return a
// non-`.m3u8` MP4/VOD `liveurl` for a normal in-app video, so a negative rule would
// misclassify those.

import type { LBVideoItem } from 'livebuy-react-native';

/**
 * Whether `video` is an in-app-unplayable live — a live (`type === 2`) that is
 * currently live (`liveStatus === 1`) but carries NO playable stream URL on the
 * widget layer (`liveurl === ''`). PURE — unit-testable in isolation; returns
 * `false` the moment ANY one of the three conditions is false.
 */
export function isUrllessLive(video: LBVideoItem): boolean {
  return video.type === 2 && video.liveStatus === 1 && video.liveurl === '';
}

/**
 * `videos` with every {@link isUrllessLive} item removed, preserving the relative
 * order of the remaining (displayed) videos. Non-matching videos are untouched.
 */
export function visibleVideos(videos: readonly LBVideoItem[]): readonly LBVideoItem[] {
  return videos.filter((v) => !isUrllessLive(v));
}

/**
 * `video`, or `null` when it is an {@link isUrllessLive} live (so the floating
 * surface renders nothing and the minimized pill reports not-live). A normal live —
 * or a `null` input — passes through unchanged.
 */
export function visibleLive(video: LBVideoItem | null): LBVideoItem | null {
  return video != null && isUrllessLive(video) ? null : video;
}
