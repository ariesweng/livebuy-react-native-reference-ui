// EndScreenView — family-4 moments surface 2 (full-screen END moment).
//
// Spec: `reference-ui-rendering/spec.md` (family-4 moments, full-screen END moment).
// Phase-4 RN sibling of the DONE iOS `EndScreenView.swift` (rb-ios-moments §2,
// golden `end-screen-countdown-variant`), Android `EndScreenView.kt`
// (rb-android-moments), and Flutter `end_screen.dart` (rb-flutter-moments — the
// authoritative blueprint translated here 1:1).
//   Design source: `design/templates/minimal/moments.jsx` `LBPEndScreen`
//     (lines 266-364) + `LBPHotCard` (226-264).
//
// The full-screen END moment shown when the video finishes. It is the second of the
// three family-4 moment surfaces composed by `MomentsView`, and it implements the
// agreed SUB-VIEW INPUT PATTERN documented verbatim in `MomentsView.tsx`:
//
//   1. `theme` (ReferenceUITheme)                      — FIRST argument, always.
//   2. bound SNAPSHOT VALUES (read-only, BY VALUE from `MomentsModel` — never the
//      model, never the template):
//        • `countdown: EndScreenCountdown | null` — non-null ⇔ 倒數變體; `{ remain,
//          total }` drives the ring progress (`remain / total`). null ⇔ 熱門變體.
//        • `next: readonly EndScreenNavRow[]`     — watch-next targets; `next[0]` is
//          the 倒數變體 preview card source (`cover` placeholder / `title`). Empty
//          `next` also forces the 熱門變體.
//        • `hot: readonly HotRow[]`               — 熱門變體 set; rendered as
//          `LBPHotCard`s in a PLAIN `Row` FIXED SMALL set (first N). `duration` is a
//          number in SECONDS (reference-ui-local {@link HotRow} augmentation) —
//          formatted here to `mm:ss` (e.g. `28` → `"00:28"`), defaulting to `"00:00"`
//          when absent (the RN template `EndScreenHotRow` carries no `duration`).
//   3. action callbacks (LAST, each defaulting to a no-op):
//        • `onWatchNext` — 倒數變體「立即觀看」CTA → host-wired → host → core
//          load(next videoId). This layer NEVER loads / advances itself.
//        • `onPickHot(item)` — 熱門變體 card tap → host-wired → host → core
//          load(hot.id). This layer NEVER switches videos itself.
//        • `onCancel` — 倒數變體「取消」exit → host-wired → host (dismiss / stay).
//
// VARIANT GATING (mirrors `LBPEndScreen`'s `showCountdown`, moments.jsx line 268):
//   • 倒數變體 — `countdown != null` AND `next` non-empty: a big `next[0]` preview
//     card with a centered countdown RING (auto-advance-to-next) + 立即觀看 / 取消.
//   • 熱門變體 — `countdown == null` OR `next` empty: 為你推薦 header + a PLAIN `Row`
//     of `LBPHotCard`s, each tap → `onPickHot`.
//
// One-way data flow: this surface reads ONLY its passed-in values; it never reaches
// back into `MomentsModel` / `DefaultPlayerTemplate`, holds NO second copy of
// countdown / next / hot, and NEVER drives the auto-next countdown itself (core owns
// the tick — the ring is PURE PRESENTATION of the snapshot `remain` / `total`). It
// renders correctly with all actions omitted (so demo / snapshot tests construct it
// action-free).
//
// VISUAL LANGUAGE: a full-bleed dark scrim (`rgba(8,8,12,0.8)`) with white text /
// glyphs (the moment composites over the ended video — design §2). The literal dark
// scrim + white-on-dark decorative colors are FIXED design colors lifted verbatim
// from `LBPEndScreen` / `LBPHotCard` (consistent with the family-1/2/3 surfaces'
// surface-token approach); `theme.accent` paints the「立即觀看」CTA + the ring trim.
//
// RENDER DISCIPLINE (inherited from iOS / Android / Flutter / family-1/2/3): plain
// `View` / `Text` / `Pressable` only — NO ScrollView / FlatList / SectionList /
// VirtualizedList (the golden render path does NOT materialize scrollable / lazy
// content). The 熱門 list is a PLAIN `Row` FIXED SMALL set (first N). ★ The auto-next
// countdown ring is a DETERMINISTIC View-based representation (a circular bordered
// View + a 12-segment progress track + the centered `remain` number) — NOT Canvas /
// react-native-svg / Animated. The cover is a deterministic placeholder fill; icons
// are deterministic Text glyphs. No animation / no randomness so the structural
// snapshot is stable.

import type { ReactElement } from 'react';
import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs, momentHotCard } from '../testing/LBTestIDs';
import { RemoteImage } from '../productsheets/RemoteImage';
import type { HotRow } from './MomentsModel';
import type { EndScreenCountdown, EndScreenNavRow } from 'livebuy-react-native-ui';

// MARK: - Decorative design tokens (literal moments.jsx rgba via RN rgba strings)
//
// `theme.accent` comes from the resolved theme; these are FIXED decorative colors
// lifted verbatim from `LBPEndScreen` / `LBPHotCard` (the dark-scrim moment is
// white-on-dark regardless of the host theme background — design §2). Kept consistent
// with the family-1/2/3 surfaces' surface-token approach (literal hex / rgba), and
// they mirror the iOS `EndScreenView` static colors + Android `EndScreenView` +
// Flutter `end_screen.dart`.

/** Full-bleed scrim base (`rgba(8,8,12,0.8)`). */
const SCRIM = 'rgba(8,8,12,0.8)';
/** Faint on-dark rule line (`rgba(255,255,255,0.3)`). */
const ON_DARK_FAINT = 'rgba(255,255,255,0.3)';
/** Dim on-dark caption (`rgba(255,255,255,0.6)`). */
const ON_DARK_DIM = 'rgba(255,255,255,0.6)';
/** Fainter on-dark meta / empty text (`rgba(255,255,255,0.5)`). */
const ON_DARK_FAINT_TEXT = 'rgba(255,255,255,0.5)';
/** Translucent on-dark fill (button / pill `rgba(255,255,255,0.12)`). */
const ON_DARK_FILL = 'rgba(255,255,255,0.12)';
/** Translucent on-dark outline (`rgba(255,255,255,0.28)`). */
const ON_DARK_STROKE = 'rgba(255,255,255,0.28)';
/** Countdown ring faint track (`rgba(255,255,255,0.28)`). */
const RING_TRACK = 'rgba(255,255,255,0.28)';
/** Cover placeholder body (the 9:16 preview / hot card background — `#000`). */
const COVER_BG = '#000000';
/** Dark veil over the preview cover (`rgba(0,0,0,0.4)`). */
const COVER_VEIL = 'rgba(0,0,0,0.4)';
/** Center play affordance circle on a cover (`rgba(0,0,0,0.5)`). */
const PLAY_CIRCLE = 'rgba(0,0,0,0.5)';
/** Duration pill capsule on a cover (`rgba(0,0,0,0.55)`). */
const DURATION_PILL = 'rgba(0,0,0,0.55)';

/** FIXED SMALL hot set cap — a PLAIN `Row` of a bounded N (NEVER lazy / scroll). */
const MAX_HOT_CARDS = 3;

/** Number of segments in the deterministic View-based countdown ring track. */
const RING_SEGMENTS = 12;

// MARK: - Fixed localized copy (static presentation strings — parity to iOS/Android)

const ENDED_LABEL = '影片結束';
/** No-countdown LIVE-ENDED title (end-screen-no-countdown). Parity iOS / Android `liveEndedLabel`. */
const LIVE_ENDED_LABEL = '直播已結束';
const AUTO_PLAY_SUFFIX = '秒後自動播放下一支'; // "{remain} {秒後自動播放下一支}"
const UNTITLED_NEXT = '下一支影片';
const CANCEL_LABEL = '取消';
const WATCH_NEXT_LABEL = '立即觀看';
const RECOMMEND_TITLE = '為你推薦';
const SHUFFLE_LABEL = '換一批';
const EMPTY_HOT_LABEL = '目前沒有推薦影片';

/**
 * Format a number of SECONDS → `mm:ss` (for {@link HotRow.duration}, which IS seconds
 * — reference-ui formats it, e.g. `28` → `"00:28"`, `2316` → `"38:36"`). Pure /
 * deterministic. Negative / non-finite values clamp to `0` (`"00:00"`). Mirrors iOS
 * `EndScreenView.formatSeconds` / Android `formatNavDuration` / Flutter
 * `_formatSeconds`.
 */
export function formatSeconds(seconds: number | null | undefined): string {
  const raw = seconds == null || !Number.isFinite(seconds) ? 0 : Math.floor(seconds);
  const s = raw < 0 ? 0 : raw;
  const m = Math.floor(s / 60);
  const r = s % 60;
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(m)}:${pad(r)}`;
}

/**
 * 「{shopName} · {mm:ss}」preview meta (LBPEndScreen moments.jsx:321). Joins the two
 * host-fed `EndScreenNavRow` fields with「 · 」, omitting an absent side. Returns ''
 * when neither is present (caller draws nothing). Pure / deterministic.
 */
export function metaLine(n0: EndScreenNavRow): string {
  const parts: string[] = [];
  if (n0.shopName != null && n0.shopName.length > 0) parts.push(n0.shopName);
  if (n0.duration != null && n0.duration > 0) parts.push(formatSeconds(n0.duration));
  return parts.join(' · ');
}

/**
 * Number of local recommendation pages for `len` hot items, `MAX_HOT_CARDS` (=3) per
 * page (ceil). `len <= 0 → 0`. Pure / deterministic — drives the「換一批」pill's local
 * window carousel (rb-rn-endscreen-reshuffle-local-window). Mirrors iOS
 * `EndScreenView.pageCount(forHotCount:)` / Android `pageCount(hotCount)`.
 */
export function pageCount(len: number): number {
  return len <= 0 ? 0 : Math.ceil(len / MAX_HOT_CARDS);
}

/**
 * The `page`-th local recommendation window (`size` = `MAX_HOT_CARDS` = 3 per page) of
 * `hot`. `page === 0` (or a negative / out-of-range `page`) SAFELY falls back to the
 * first page (`hot.slice(0, size)` = the pre-reshuffle behavior) so the default render
 * is byte-identical and a stale `page` can never crash. Pure / deterministic. Mirrors
 * iOS `EndScreenView.hotWindow(_:page:)` / Android `hotWindow(hot, page, size)`.
 */
export function hotWindow(
  hot: readonly HotRow[],
  page: number,
  size = MAX_HOT_CARDS,
): readonly HotRow[] {
  const start = page * size;
  if (page < 0 || start >= hot.length) return hot.slice(0, size);
  return hot.slice(start, start + size);
}

/** Props for the {@link EndScreen} surface. */
export interface EndScreenProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * Auto-next countdown snapshot (`endScreenState.countdown`). Non-null ⇔ 倒數變體;
   * `{ remain, total }` drives the ring progress. Read-only.
   */
  readonly countdown: EndScreenCountdown | null;
  /**
   * Watch-next targets (`endScreenState.next`). `next[0]` is the 倒數變體 preview
   * card source. Empty also forces the 熱門變體. Read-only.
   */
  readonly next: readonly EndScreenNavRow[];
  /**
   * 熱門推薦 set (`endScreenState.hot`, widened to {@link HotRow}). Rendered as a
   * FIXED SMALL PLAIN `Row` of `LBPHotCard`s. `duration` is a number in SECONDS —
   * formatted to `mm:ss` (defaulting to `"00:00"` when absent). Read-only.
   */
  readonly hot: readonly HotRow[];
  /**
   * 倒數變體「立即觀看」CTA → host-wired → host → core load(next). Default no-op for
   * demo / snapshot instances — the CTA is inert. This layer NEVER loads / advances.
   */
  readonly onWatchNext?: () => void;
  /**
   * 熱門變體 card tap → host-wired `onPickHot(item)` → host → core load(hot.id).
   * Default no-op for demo / snapshot instances. NEVER switches videos itself.
   */
  readonly onPickHot?: (item: HotRow) => void;
  /**
   * 倒數變體「取消」exit → host-wired → host (dismiss / stay). Default no-op for
   * demo / snapshot instances.
   */
  readonly onCancel?: () => void;
  /**
   * No-countdown LIVE-ENDED state (`endScreenVisible && countdown == null`, i.e. live
   * ended with no next). The 熱門變體 then prepends a「直播已結束」rule-flanked title
   * (end-screen-no-countdown). Default `false` → existing 熱門變體 demo / snapshot
   * unchanged. No ring, no auto-advance. Parity iOS / Android `liveEnded`.
   */
  readonly liveEnded?: boolean;
  /**
   * Live-flag gate (parity `CarouselCardView.live` — rb-rn-endscreen-recommended-video-cover).
   * `false` (snapshot / demo — the DEFAULT) → the two video cards (熱門卡 / 倒數變體大預覽卡)
   * draw ONLY the deterministic black cover placeholder ({@link RemoteImage} renders NOTHING →
   * no network `<Image>` in the tree → structural snapshots unchanged). `true` (host runtime, real
   * video surface) + a non-empty card `cover` → the real cover photo loads OVER the placeholder via
   * {@link RemoteImage} (self-hides to the placeholder on a load error). Threaded down from the
   * turnkey container. NOTE: RN 僅 cover 靜圖 — the RN template rows (`EndScreenNavRow` /
   * `EndScreenHotRow`) carry NO `preview` field, so there is NO loop-preview path (unlike iOS /
   * Android which also loop `preview`); loop 待 template 加欄位另案.
   */
  readonly live?: boolean;
}

/**
 * The family-4 full-screen END moment. In the 倒數變體 (`countdown != null` &&
 * `next` non-empty) it draws a big `next[0]` preview card with a centered countdown
 * RING (`remain / total`) representing the auto-advance-to-next countdown, plus 立即
 * 觀看 ({@link EndScreenProps.onWatchNext}) / 取消 ({@link EndScreenProps.onCancel}).
 * In the 熱門變體 (`countdown == null` || `next` empty) it draws a 為你推薦 header +
 * a PLAIN `Row` of `LBPHotCard`s ({@link EndScreenProps.onPickHot}). All actions are
 * host-wired forwarders; this layer never loads / advances / picks itself.
 *
 * Renders correctly with all callbacks omitted (demo / snapshot safe).
 */
export function EndScreen(props: EndScreenProps): ReactElement {
  const { theme, countdown, next, hot, onWatchNext, onPickHot, onCancel, liveEnded = false, live = false } = props;

  // 倒數變體 active — `countdown != null` AND a preview target exists (mirrors
  // `LBPEndScreen`'s `showCountdown`, moments.jsx line 268).
  const showCountdown = countdown != null && next.length > 0;

  return (
    // Full-bleed dark-scrim base (`absolute inset:0`). The moment composites over the
    // ended video — a fixed design color, not the theme background.
    <View
      testID={LBTestIDs.momentEnd}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: SCRIM,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showCountdown ? (
        <CountdownVariant
          theme={theme}
          countdown={countdown}
          n0={next[0]!}
          live={live}
          onWatchNext={onWatchNext}
          onCancel={onCancel}
        />
      ) : (
        <HotVariant theme={theme} hot={hot} liveEnded={liveEnded} live={live} onPickHot={onPickHot} />
      )}
    </View>
  );
}

// MARK: - 倒數變體 (preview card + ring + 立即觀看 / 取消)
//
// Mirrors `LBPEndScreen`'s `showCountdown` branch (moments.jsx 284-339):
//   • 「— 影片結束 —」rule-flanked label.
//   • a 150×(9:16) preview card of `next[0]` with a centered countdown ring.
//   • 「{remain} 秒後自動播放下一支」+ the next title (2-line clamp) + the design's
//     「{shopName} · {duration}」meta line (now renderable since
//     align-endscreen-nav-meta-template added shopName / duration to EndScreenNavRow;
//     drawn only when a field is host-fed).
//   • 取消 (outline) / 立即觀看 (accent, play glyph) buttons.

function CountdownVariant(props: {
  theme: ReferenceUITheme;
  countdown: EndScreenCountdown | null;
  n0: EndScreenNavRow;
  live: boolean;
  onWatchNext?: () => void;
  onCancel?: () => void;
}): ReactElement {
  const { theme, countdown, n0, live, onWatchNext, onCancel } = props;
  const remain = countdown?.remain ?? 0;
  const total = countdown?.total ?? 0;
  const title = n0.title.length === 0 ? UNTITLED_NEXT : n0.title;

  return (
    <View
      style={{
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <EndedRule theme={theme} />
      <View style={{ height: 20 }} />
      <PreviewCard theme={theme} remain={remain} total={total} cover={n0.cover} live={live} />
      <View style={{ height: 14 }} />
      {/* Preview caption block: auto-play line + next title (2-line clamp). */}
      <View style={{ maxWidth: 280, alignItems: 'center' }}>
        <Text style={{ color: ON_DARK_DIM, fontSize: 12 * theme.fontScale }}>
          {`${remain} ${AUTO_PLAY_SUFFIX}`}
        </Text>
        <View style={{ height: 5 }} />
        <Text
          numberOfLines={2}
          style={{
            color: '#FFFFFF',
            fontSize: 15 * theme.fontScale,
            fontWeight: '700',
            textAlign: 'center',
            lineHeight: 21 * theme.fontScale,
          }}
        >
          {title}
        </Text>
        {/* 「{shopName} · {mm:ss}」meta line (LBPEndScreen moments.jsx:321) — renderable
            since align-endscreen-nav-meta-template added shopName / duration to
            EndScreenNavRow; drawn only when at least one field is host-fed. */}
        {metaLine(n0).length > 0 ? (
          <>
            <View style={{ height: 4 }} />
            <Text
              numberOfLines={1}
              style={{ color: ON_DARK_DIM, fontSize: 12 * theme.fontScale }}
            >
              {metaLine(n0)}
            </Text>
          </>
        ) : null}
      </View>
      <View style={{ height: 20 }} />
      {/* 取消 (outline) / 立即觀看 (accent + play glyph) action row. */}
      <View style={{ maxWidth: 320, flexDirection: 'row', alignSelf: 'stretch' }}>
        <View style={{ flex: 1 }}>
          <DarkButton
            theme={theme}
            label={CANCEL_LABEL}
            fill={ON_DARK_FILL}
            borderColor={ON_DARK_STROKE}
            testID={LBTestIDs.momentEndCancel}
            onTap={onCancel}
          />
        </View>
        <View style={{ width: 10 }} />
        <View style={{ flex: 1 }}>
          <DarkButton
            theme={theme}
            label={WATCH_NEXT_LABEL}
            fill={theme.accent}
            leadingGlyph="▶"
            testID={LBTestIDs.momentEndWatch}
            onTap={onWatchNext}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * 「— {label} —」rule-flanked caption (LBPEndScreen 287-291). `label` defaults to
 *「影片結束」for the countdown variant; the no-countdown LIVE-ENDED hot variant passes
 * {@link LIVE_ENDED_LABEL} (end-screen-no-countdown). Same rendering → existing
 * baselines byte-identical. Parity iOS / Android `EndedRule(label)`.
 */
function EndedRule(props: { theme: ReferenceUITheme; label?: string }): ReactElement {
  const { theme, label = ENDED_LABEL } = props;
  const rule = (
    <View style={{ width: 18, height: 1, backgroundColor: ON_DARK_FAINT }} />
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {rule}
      <View style={{ width: 8 }} />
      <Text
        style={{
          color: ON_DARK_DIM,
          fontSize: 12 * theme.fontScale,
          fontWeight: '600',
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
      <View style={{ width: 8 }} />
      {rule}
    </View>
  );
}

/**
 * The 150×(9:16) preview card with the centered countdown ring (LBPEndScreen
 * 295-314). The black `COVER_BG` fill is the deterministic placeholder; at RUNTIME
 * (`live === true` + a non-empty `cover` = `next[0].cover`) the real cover photo loads
 * OVER it via {@link RemoteImage} (rb-rn-endscreen-recommended-video-cover, mirroring
 * `CarouselCardView`'s cover branch). The existing dark veil + ring + remaining seconds
 * stay drawn OVER the cover. `live === false` (snapshot / demo) → RemoteImage renders
 * NOTHING (placeholder shows through; structural snapshot unchanged).
 */
function PreviewCard(props: {
  theme: ReferenceUITheme;
  remain: number;
  total: number;
  cover: string;
  live: boolean;
}): ReactElement {
  const { theme, remain, total, cover, live } = props;
  const w = 150;
  const h = (w * 16) / 9;
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: COVER_BG,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Real cover photo (host runtime only) OVER the black placeholder, BELOW the
          veil + ring. `live === false` (snapshot / demo — the DEFAULT) → RemoteImage
          renders NOTHING (no `<Image>` in the tree → structural snapshot unchanged);
          `live === true` + non-empty `cover` → the real photo (self-hides to the
          placeholder on error). Mirrors `CarouselCardView.tsx` cover branch. */}
      <RemoteImage live={live} uri={cover} borderRadius={16} resizeMode="cover" />
      {/* Dark veil over the cover (`rgba(0,0,0,0.4)`). */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: COVER_VEIL,
        }}
      />
      {/* Centered countdown ring + remaining seconds. */}
      <CountdownRing theme={theme} remain={remain} total={total} />
    </View>
  );
}

/**
 * The auto-advance-to-next countdown RING (LBPEndScreen 298-313), rendered as a
 * DETERMINISTIC View-based representation (NOT Canvas / react-native-svg / Animated —
 * the RN render path has no SVG): a faint full-circle track (a bordered round View)
 * overlaid with {@link RING_SEGMENTS} small radial ticks whose first
 * `round(progress * RING_SEGMENTS)` are painted in the accent color (the "remaining"
 * arc), with `remain` centered. The ring is PURE PRESENTATION of the snapshot — this
 * layer NEVER ticks it. Progress = `remain / total`, clamped to `[0, 1]`.
 */
function CountdownRing(props: {
  theme: ReferenceUITheme;
  remain: number;
  total: number;
}): ReactElement {
  const { theme, remain, total } = props;
  const raw = total > 0 ? remain / total : 0;
  const progress = Math.max(0, Math.min(1, raw));
  // How many of the RING_SEGMENTS ticks are painted accent (the remaining arc).
  const filled = Math.round(progress * RING_SEGMENTS);
  const size = 72;
  const radius = size / 2;
  const tickLen = 7;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        borderWidth: 4,
        borderColor: RING_TRACK,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Deterministic accent progress ticks (first `filled` of RING_SEGMENTS),
          starting from 12 o'clock and going clockwise. No SVG / Canvas. */}
      {Array.from({ length: RING_SEGMENTS }, (_unused, i) => {
        const lit = i < filled;
        // -90° start (12 o'clock); each tick steps 360 / RING_SEGMENTS clockwise.
        const angle = (-90 + (360 / RING_SEGMENTS) * i) * (Math.PI / 180);
        const cx = radius + (radius - tickLen / 2) * Math.cos(angle) - 1.5;
        const cy = radius + (radius - tickLen / 2) * Math.sin(angle) - tickLen / 2;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: cx,
              top: cy,
              width: 3,
              height: tickLen,
              borderRadius: 1.5,
              backgroundColor: lit ? theme.accent : 'transparent',
            }}
          />
        );
      })}
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 26 * theme.fontScale,
          fontWeight: '800',
        }}
      >
        {`${remain}`}
      </Text>
    </View>
  );
}

/**
 * A dark-scrim action button (取消 outline / 立即觀看 accent). Forwards `onTap`
 * (default no-op → inert). Drawn as a plain padded capsule with an optional leading
 * Text glyph.
 */
function DarkButton(props: {
  theme: ReferenceUITheme;
  label: string;
  fill: string;
  borderColor?: string;
  leadingGlyph?: string;
  testID?: string;
  onTap?: () => void;
}): ReactElement {
  const { theme, label, fill, borderColor, leadingGlyph, testID, onTap } = props;
  return (
    <Pressable
      onPress={() => onTap?.()}
      testID={testID}
      style={{
        backgroundColor: fill,
        borderRadius: 12,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: borderColor != null ? 1 : 0,
        borderColor: borderColor ?? 'transparent',
      }}
    >
      {leadingGlyph != null ? (
        <>
          <Text style={{ color: '#FFFFFF', fontSize: 14 * theme.fontScale }}>
            {leadingGlyph}
          </Text>
          <View style={{ width: 6 }} />
        </>
      ) : null}
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 15 * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// MARK: - 熱門變體 (為你推薦 header + PLAIN Row of LBPHotCards)
//
// Mirrors `LBPEndScreen`'s 熱門 branch (moments.jsx 340-361): a「為你推薦」title +
// a「換一批」pill, then the `hot` cards. The design uses a 2-col grid in a scroll;
// the reference-ui surface renders a FIXED SMALL set (one page of `MAX_HOT_CARDS` = 3)
// in a PLAIN `Row` (NEVER lazy / scroll — the verified family lesson).
//
// ★ 換一批 = LOCAL recommendation-window carousel (rb-rn-endscreen-reshuffle-local-window,
//   the RN parity of iOS `860cd5b9` / Android `3bab95f7`). The `hot` list from the
//   backend is often > 3 (no upper bound) and is fetched ONCE at channel load — core
//   has NO re-fetch API and the backend has NO reshuffle endpoint. So「換一批」pages
//   through a LOCAL window of the already-loaded `hot` (`hotWindow(hot, page)`) via a
//   local `page` state; it does NOT open / switch videos. This corrects the four-platform
//   proxy bug where 換一批 was mis-forwarded to `onPickHot(hot.first)` (open video). The
//   design's 換一批 pill is a refresh-semantic no-op stub (demo wires onPickHot={() => {}}),
//   never an open-video. The hot CARD tap keeps `onPickHot(item)` (open that video) —
//   decoupled from the pill. `hot.length <= 3` (one page) → pill inert (no dim; a dimmed
//   pill would break the snapshot baseline).

function HotVariant(props: {
  theme: ReferenceUITheme;
  hot: readonly HotRow[];
  liveEnded?: boolean;
  live: boolean;
  onPickHot?: (item: HotRow) => void;
}): ReactElement {
  const { theme, hot, liveEnded = false, live, onPickHot } = props;
  // Local recommendation window index (pure presentation state — NEVER pushed back to
  // the view-model / core, NOT part of EndScreenProps). Drives the「換一批」pill's local
  // carousel (rb-rn-endscreen-reshuffle-local-window). `page === 0` (the default) →
  // hotWindow returns hot.slice(0, 3) = the pre-reshuffle behavior → structural snapshot
  // byte-identical. Mirrors iOS `@State hotPage` / Android `remember { mutableStateOf(0) }`.
  const [page, setPage] = useState(0);
  const pages = pageCount(hot.length);
  const cards = hotWindow(hot, page);

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 18,
        paddingTop: 16,
      }}
    >
      {/* end-screen-no-countdown: live ended with no next →「直播已結束」rule-flanked title
          (same rendering as the countdown variant's「影片結束」) above 為你推薦. */}
      {liveEnded ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <EndedRule theme={theme} label={LIVE_ENDED_LABEL} />
          </View>
          <View style={{ height: 14 }} />
        </>
      ) : null}
      {/* 為你推薦 title + 換一批 pill. The pill is a LOCAL recommendation-window carousel:
          onPress ONLY advances the local `page` (next 3 of the already-loaded `hot`) — it
          does NOT open / switch videos and NEVER calls `onPickHot` (that stays wired to the
          hot CARD tap → seams.ts → playerRef.load → open video). When `hot.length <= 3`
          (pages <= 1, only one page) the action is inert (guard short-circuit), keeping the
          pill pixels UNCHANGED (no disabled styling — a dimmed pill would break the snapshot
          baseline, per the iOS finding). Fixes the four-platform proxy bug where 換一批 was
          mis-forwarded to onPickHot(hot.first); the design's 換一批 is a refresh no-op stub
          (moments.jsx demo wires onPickHot={() => {}}), never an open-video. */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 18 * theme.fontScale,
            fontWeight: '800',
            letterSpacing: -0.2,
          }}
        >
          {RECOMMEND_TITLE}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => {
            if (pages > 1) setPage((p) => (p + 1) % pages);
          }}
          testID={LBTestIDs.momentEndReshuffle}
          style={{
            backgroundColor: ON_DARK_FILL,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13 * theme.fontScale }}>↻</Text>
          <View style={{ width: 5 }} />
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 12 * theme.fontScale,
              fontWeight: '600',
            }}
          >
            {SHUFFLE_LABEL}
          </Text>
        </Pressable>
      </View>
      <View style={{ height: 12 }} />
      {/* A PLAIN `Row` of `LBPHotCard`s — a FIXED SMALL set (first N), NEVER a lazy /
          scroll container. Each card taps to `onPickHot(item)`. */}
      {hot.length === 0 ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <Text style={{ color: ON_DARK_FAINT_TEXT, fontSize: 13 * theme.fontScale }}>
            {EMPTY_HOT_LABEL}
          </Text>
        </View>
      ) : (
        <View
          testID={LBTestIDs.momentEndHotRow}
          style={{ flexDirection: 'row', alignItems: 'flex-start' }}
        >
          {cards.map((item, i) => (
            <View
              key={item.id}
              style={{ flex: 1, marginLeft: i > 0 ? 12 : 0 }}
            >
              <HotCard theme={theme} item={item} index={i} live={live} onPickHot={onPickHot} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * One 熱門卡 (LBPHotCard, moments.jsx 226-264): a 9:16 cover with a duration pill
 * (top-left, rendered ONLY when the optional `duration` is present) + a centered play
 * affordance, then a 2-line title. `duration` is a number in SECONDS formatted to
 * `mm:ss`. The RN template `EndScreenHotRow` carries NO duration, so live hot cards
 * omit the pill (no fabricated "00:00"); demo/golden seeds with a duration show it,
 * aligning to the `LBPHotCard` design.
 */
function HotCard(props: {
  theme: ReferenceUITheme;
  item: HotRow;
  index: number;
  live: boolean;
  onPickHot?: (item: HotRow) => void;
}): ReactElement {
  const { theme, item, index, live, onPickHot } = props;
  // 9:16 cover: a fixed-aspect black placeholder. At RUNTIME (`live === true` + a non-empty
  // `item.cover`) the real cover photo loads OVER it via RemoteImage (rb-rn-endscreen-recommended-
  // video-cover, mirroring `CarouselCardView.tsx` cover branch); `live === false` (snapshot / demo
  // — the DEFAULT) → RemoteImage renders NOTHING (no network `<Image>` in the tree → structural
  // snapshot unchanged). The play affordance + duration pill stay OVER the cover.
  return (
    <Pressable testID={momentHotCard(index)} onPress={() => onPickHot?.(item)}>
      <View
        style={{
          aspectRatio: 9 / 16,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: COVER_BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Real cover photo (host runtime only) OVER the black placeholder, BELOW the play
            affordance + duration pill. `live === false` → renders NOTHING (placeholder shows
            through; structural snapshot unchanged). Mirrors `CarouselCardView.tsx` cover branch. */}
        <RemoteImage live={live} uri={item.cover} borderRadius={12} resizeMode="cover" />
        {/* Centered play affordance (`rgba(0,0,0,0.5)` circle + play glyph). */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: PLAY_CIRCLE,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13 * theme.fontScale }}>▶</Text>
        </View>
        {/* Duration pill (top-left, `rgba(0,0,0,0.55)`) — rendered ONLY when the
            optional `duration` is present. The RN template `EndScreenHotRow` carries
            no `duration`, so LIVE hot cards omit the pill (we never fabricate a
            placeholder "00:00"); demo / golden seeds that carry a duration show
            `mm:ss`, aligning to the `LBPHotCard` design. A future core change adding
            duration to the RN bridge would populate it with no surface change. */}
        {item.duration != null && (
          <View
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              backgroundColor: DURATION_PILL,
              borderRadius: 999,
              paddingTop: 2,
              paddingBottom: 2,
              paddingLeft: 4,
              paddingRight: 6,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 10 * theme.fontScale }}>▶</Text>
            <View style={{ width: 4 }} />
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 10 * theme.fontScale,
                fontWeight: '600',
              }}
            >
              {formatSeconds(item.duration)}
            </Text>
          </View>
        )}
      </View>
      <View style={{ height: 7 }} />
      <Text
        numberOfLines={2}
        style={{
          color: '#FFFFFF',
          fontSize: 12 * theme.fontScale,
          fontWeight: '600',
          lineHeight: 15.6 * theme.fontScale,
        }}
      >
        {item.title}
      </Text>
    </Pressable>
  );
}
