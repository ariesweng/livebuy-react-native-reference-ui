// UpcomingCountdownView — 直播預告 (upcoming / awaitingLive) full-bleed surface.
//
// Spec: `reference-ui-rendering/spec.md` (RN upcoming / intro chrome parity).
// RN sibling of iOS `UpcomingCountdownView.swift` (rb-ios-upcoming-align-design,
// commit 77505c6) + Android `UpcomingCountdownView.kt` (rb-android-upcoming-intro-chrome)
// + Flutter `upcoming_countdown_view.dart` (rb-flutter-upcoming-intro-chrome — the
// authoritative blueprint translated here 1:1). Design source:
// `design/templates/minimal/live-chrome.jsx` `LBLiveUpcomingOverlay` — the
// cover/thumbnail + a dark mask + a centered "scheduled DATE + big scheduled TIME",
// with NO "即將開播" label and NO ticking "距開播 HH:MM:SS" countdown.
//
// The full-bleed background shown while the player is in `awaitingLive`
// (`live_status == 0`, 直播預告). Promoted from a top-most moment to the player-shell
// background (see PlayerShellView's upcoming branch). Binds the template
// `upcomingState` (republished onto PlayerShellModel.upcomingStartAt / upcomingCover):
//   - live === true  -> cover placeholder background (NO network-uri Image — uses a
//                       deterministic dark fill) + a black @ 0.35 dark mask (so the
//                       text reads),
//   - live === false -> solid theme.background (golden-deterministic, no cover load).
//   - centered: scheduled DATE (small ~14/600) + scheduled TIME (big ~56/800).
//
// GOLDEN-DETERMINISM (iOS / Android / Flutter lessons baked in): plain View / Text
// only — NO ScrollView/FlatList, NO ring/Canvas, NO ticking countdown / timer, NO
// `Date.now()` dependency. Date / time are pure string reformats of the backend
// publish_at (see scheduledDate / scheduledTime), so the `live === false` baseline is
// byte-stable.
//
// SUB-VIEW INPUT PATTERN (mirrors the family-1 surfaces): `theme` first → bound
// SNAPSHOT VALUE(s) by value (`scheduledStartAt` / `coverUrl`) → `live` opt-in.

import type { ReactElement } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';

// MARK: - Cover placeholder + mask tokens (live === true runtime background)

/** Deterministic dark cover-placeholder fill (no network cover fetched in this layer). */
const COVER_FILL = '#26262E';
/** `rgba(0,0,0,0.35)` dark mask over the cover (live === true). */
const DARK_MASK = 'rgba(0,0,0,0.35)';
const WHITE = '#FFFFFF';

/** Props for the {@link UpcomingCountdownView} surface. */
export interface UpcomingCountdownViewProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * The backend `publish_at` (`"yyyy-MM-dd HH:mm:ss"`, UTC+8), parsed for the
   * centered date + time display.
   */
  readonly scheduledStartAt: string;
  /**
   * Runtime opt-in. `false` (default — demo / snapshot) → solid `theme.background`,
   * no cover (deterministic). `true` (host runtime) → cover placeholder + 0.35 mask.
   */
  readonly live?: boolean;
  /**
   * The video cover URL (`PlayerShellModel.upcomingCover` ← `channel.cover`).
   * Retained for host-supplied wiring; this layer paints a deterministic
   * placeholder, NEVER a network image.
   */
  readonly coverUrl?: string;
}

/**
 * The 直播預告 (upcoming / awaitingLive) full-bleed surface. Renders a centered
 * scheduled DATE (small) + scheduled TIME (big) over either the cover placeholder +
 * dark mask (runtime, `live === true`) or the solid theme background (demo / snapshot,
 * `live === false`).
 */
export function UpcomingCountdownView(props: UpcomingCountdownViewProps): ReactElement {
  const { theme, scheduledStartAt, live = false } = props;
  const date = scheduledDate(scheduledStartAt);
  return (
    <View testID={LBTestIDs.momentCountdownRoot} style={[styles.fill, { backgroundColor: live ? COVER_FILL : theme.background }]}>
      {/* Dark mask over the cover placeholder (live === true) so the text reads. */}
      {live ? <View style={[styles.fill, styles.mask]} /> : null}

      {/* Centered content: scheduled DATE (small) + scheduled TIME (big). */}
      <View style={styles.center}>
        {date.length > 0 ? (
          <Text style={[styles.date, { fontSize: 14 * theme.fontScale }]} numberOfLines={1}>
            {date}
          </Text>
        ) : null}
        {date.length > 0 ? <View style={{ height: 12 }} /> : null}
        <Text style={[styles.time, { fontSize: 56 * theme.fontScale }]} numberOfLines={1}>
          {scheduledTime(scheduledStartAt)}
        </Text>
      </View>
    </View>
  );
}

// MARK: - Pure display helpers (shared with CarouselCardView's upcoming card)

/**
 * Reformat a backend `publish_at` (`"2026-06-20 20:00:00"`) → `"6月20日"` (M月D日,
 * leading zeros stripped) by pure string components (no Date round-trip →
 * timezone-independent + deterministic). Empty / unexpected shape → `""`.
 * Mirrors iOS / Android / Flutter `scheduledDate`.
 */
export function scheduledDate(publishAt: string): string {
  const parts = publishAt.split(' ');
  if (parts.length === 0 || parts[0] === undefined) return '';
  const date = parts[0].split('-');
  if (date.length !== 3) return '';
  const month = Number.parseInt(date[1]!, 10);
  const day = Number.parseInt(date[2]!, 10);
  if (Number.isNaN(month) || Number.isNaN(day)) return '';
  return `${month}月${day}日`;
}

/**
 * Reformat a backend `publish_at` (`"2026-06-20 20:00:00"`) → `"20:00"` (HH:MM) by
 * pure string components. Empty / unexpected shape → `""`.
 * Mirrors iOS / Android / Flutter `scheduledTime`.
 */
export function scheduledTime(publishAt: string): string {
  const parts = publishAt.split(' ');
  if (parts.length !== 2 || parts[1] === undefined) return '';
  const time = parts[1].split(':');
  if (time.length < 2) return '';
  return `${time[0]}:${time[1]}`;
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mask: {
    backgroundColor: DARK_MASK,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  date: {
    color: WHITE,
    fontWeight: '600',
    textAlign: 'center',
  },
  time: {
    color: WHITE,
    fontWeight: '900',
    textAlign: 'center',
    // Tabular (monospaced) digits so the HH:MM digit spacing matches iOS `.monospacedDigit()`.
    fontVariant: ['tabular-nums'],
  },
});
