// EndScreenView — family-4 moments surface 2 (full-screen END moment).
//
// Spec: `component-contracts/spec.md` § EndScreen 元件契約 (rb-rn-endscreen-live-empty-state).
// Phase-4 RN sibling of iOS `EndScreenView.swift` (rb-ios-endscreen-live-empty-state, design R41),
// with the Android / Flutter siblings tracked as separate, independent follow-up changes (see this
// change's `## Platform Scope`).
//   Design source: `design/templates/minimal/moments.jsx` `LBPEndScreen`
//     (lines 158-257, commit `c480363ad` — design R41 / D7, `design/contract/claude-design-sync.md`).
//
// The full-screen END moment shown when the video finishes. It is the second of the three
// family-4 moment surfaces composed by `MomentsView`, and it implements the agreed SUB-VIEW
// INPUT PATTERN documented verbatim in `MomentsView.tsx`:
//
//   1. `theme` (ReferenceUITheme)                      — FIRST argument, always.
//   2. bound SNAPSHOT VALUES (read-only, BY VALUE from `MomentsModel` — never the
//      model, never the template):
//        • `countdown: EndScreenCountdown | null` — non-null ⇔ 倒數變體; `{ remain,
//          total }` drives the ring progress (`remain / total`). null (or an empty
//          `next`) ⇔ 空狀態.
//        • `next: readonly EndScreenNavRow[]`     — watch-next targets; `next[0]` is
//          the 倒數變體 preview card source (`cover` placeholder / `title`). Empty
//          `next` also forces the 空狀態.
//   3. action callbacks (LAST, each defaulting to a no-op):
//        • `onWatchNext` — 倒數變體「立即觀看」CTA → host-wired → host → core
//          load(next videoId). This layer NEVER loads / advances itself.
//        • `onCancel` — 倒數變體「取消」exit → host-wired → host. Now CLOSES the whole
//          EndScreen overlay outright (rb-rn-endscreen-live-empty-state — the retired 熱門變體
//          no longer exists as a fallback to retreat to).
//        • `onViewCart` — 空狀態「查看購物車」CTA → host-wired → host (open the product list /
//          cart). rb-rn-endscreen-live-empty-state.
//
// R41 REDESIGN (rb-rn-endscreen-live-empty-state): EndScreen is now LIVE-ONLY. The prior 熱門變體
// (「為你推薦」card wall, `HotVariant`/`HotCard`/`hotWindow`/`pageCount`/「換一批」) is RETIRED —
// design R41 removed it entirely. `next` empty now shows a new 空狀態 instead: a big「直播已結束」
// title + a「直播時長：…」line (fallback `"--:--:--"` — no reference-ui data source for a real
// duration exists yet) + a full-width accent「查看購物車」CTA. A VOD (非直播) channel that ends
// with no `next` has nothing to show at all (the 空狀態 fallback no longer exists for it either) —
// `MomentsView`'s `shouldCloseInsteadOfEndScreen` gate closes the player directly instead of
// entering this moment; that decision lives in the CONTAINER (`MomentsView.tsx`), not here — this
// surface itself has no notion of `isLive` and never decides to render nothing.
//
// VARIANT GATING (mirrors `LBPEndScreen`'s `isEmpty`, moments.jsx line 164):
//   • 倒數變體 — `countdown != null` AND `next` non-empty: a big `next[0]` preview
//     card with a centered countdown RING (auto-advance-to-next) + 立即觀看 / 取消.
//   • 空狀態   — `countdown == null` OR `next` empty: 直播已結束 title + 直播時長 line +
//     查看購物車 CTA.
//
// One-way data flow: this surface reads ONLY its passed-in values; it never reaches
// back into `MomentsModel` / `DefaultPlayerTemplate`, holds NO second copy of
// countdown / next, and NEVER drives the auto-next countdown itself (core owns
// the tick — the ring is PURE PRESENTATION of the snapshot `remain` / `total`). It
// renders correctly with all actions omitted (so demo / snapshot tests construct it
// action-free).
//
// VISUAL LANGUAGE: a full-bleed dark scrim (`rgba(50,50,50,0.64)`, R41 — was
// `rgba(8,8,12,0.8)`; no blur, unchanged — RN never implemented the design's blur) with white
// text / glyphs (the moment composites over the ended video — design §2). The literal dark scrim
// + white-on-dark decorative colors are FIXED design colors lifted verbatim from `LBPEndScreen`
// (consistent with the family-1/2/3 surfaces' surface-token approach); `theme.accent` paints the
// 「立即觀看」/「查看購物車」CTAs + the ring trim.
//
// RENDER DISCIPLINE (inherited from iOS / Android / Flutter / family-1/2/3): plain
// `View` / `Text` / `Pressable` only — NO ScrollView / FlatList / SectionList /
// VirtualizedList. ★ The auto-next countdown ring is a DETERMINISTIC View-based representation (a
// circular bordered View + a 12-segment progress track + the centered `remain` number) — NOT
// Canvas / react-native-svg / Animated (a DYNAMIC progress geometry, unlike a static icon, so it
// stays a hand-drawn View composition). The preview cover is a deterministic placeholder fill.
// ONE deliberate exception: the 空狀態「查看購物車」CTA reuses the SAME static `CartFillGlyph`
// (`react-native-svg`-backed, no animation / no randomness — structurally deterministic) already
// used by `ProductListView`'s cart-CTA footer elsewhere in this package, matching the design's
// `Icons.cartFill` glyph exactly rather than approximating it with a Text character.

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import { RemoteImage } from '../productsheets/RemoteImage';
import { CartFillGlyph } from '../productsheets/CartFillGlyph';
import type { EndScreenCountdown, EndScreenNavRow } from 'livebuy-react-native-ui';

// MARK: - Decorative design tokens (literal moments.jsx rgba via RN rgba strings)
//
// `theme.accent` comes from the resolved theme; these are FIXED decorative colors
// lifted verbatim from `LBPEndScreen` (the dark-scrim moment is white-on-dark regardless of the
// host theme background — design §2). Kept consistent with the family-1/2/3 surfaces'
// surface-token approach (literal hex / rgba), and they mirror the iOS `EndScreenView` static
// colors.

/** Full-bleed scrim base (`rgba(50,50,50,0.64)`, design R41 — was `rgba(8,8,12,0.8)`). Shared by
 *  BOTH variants (a single top-level layer), so the 倒數變體's background changed too. */
const SCRIM = 'rgba(50,50,50,0.64)';
/** Faint on-dark rule line (`rgba(255,255,255,0.3)`). */
const ON_DARK_FAINT = 'rgba(255,255,255,0.3)';
/** Dim on-dark caption (`rgba(255,255,255,0.6)`). */
const ON_DARK_DIM = 'rgba(255,255,255,0.6)';
/** Strong on-dark subtitle (`rgba(255,255,255,0.85)`) — 空狀態's「直播時長：…」line. */
const ON_DARK_STRONG = 'rgba(255,255,255,0.85)';
/** Translucent on-dark fill (button / pill `rgba(255,255,255,0.12)`). */
const ON_DARK_FILL = 'rgba(255,255,255,0.12)';
/** Translucent on-dark outline (`rgba(255,255,255,0.28)`). */
const ON_DARK_STROKE = 'rgba(255,255,255,0.28)';
/** Countdown ring faint track (`rgba(255,255,255,0.28)`). */
const RING_TRACK = 'rgba(255,255,255,0.28)';
/** Cover placeholder body (the 9:16 preview background — `#000`). */
const COVER_BG = '#000000';
/** Dark veil over the preview cover (`rgba(0,0,0,0.4)`). */
const COVER_VEIL = 'rgba(0,0,0,0.4)';

/** Number of segments in the deterministic View-based countdown ring track. */
const RING_SEGMENTS = 12;

// MARK: - Fixed localized copy (static presentation strings — parity to iOS/Android)

/**
 * The rule-flanked 倒數變體 caption AND the 空狀態's big title — BOTH now say「直播已結束」
 * (design R41 — EndScreen is LIVE-only, so the prior VOD-flavored「影片結束」countdown caption
 * is retired). Parity iOS / Android `liveEndedLabel`.
 */
const LIVE_ENDED_LABEL = '直播已結束';
const AUTO_PLAY_SUFFIX = '秒後自動播放下一支'; // "{remain} {秒後自動播放下一支}"
const UNTITLED_NEXT = '下一支影片';
const CANCEL_LABEL = '取消';
const WATCH_NEXT_LABEL = '立即觀看';
/** 空狀態's「直播時長：…」line prefix (design moments.jsx:241). */
const LIVE_DURATION_PREFIX = '直播時長：';
/** Fallback duration text when `liveDuration` is not fed (design-documented literal). */
const LIVE_DURATION_FALLBACK = '--:--:--';
/** 空狀態 CTA label — verbatim the SAME copy as `ProductListView`'s cart-CTA footer. */
const VIEW_CART_LABEL = '查看購物車';

/**
 * Format a number of SECONDS → `mm:ss` (for the 倒數變體's `next[0]` meta line — `duration` IS
 * seconds, e.g. `28` → `"00:28"`, `2316` → `"38:36"`). Pure / deterministic. Negative /
 * non-finite values clamp to `0` (`"00:00"`). Mirrors iOS `EndScreenView.formatSeconds` /
 * Android `formatNavDuration` / Flutter `_formatSeconds`.
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
 * 「{shopName} · {mm:ss}」preview meta (LBPEndScreen moments.jsx:217). Joins the two
 * host-fed `EndScreenNavRow` fields with「 · 」, omitting an absent side. Returns ''
 * when neither is present (caller draws nothing). Pure / deterministic.
 */
export function metaLine(n0: EndScreenNavRow): string {
  const parts: string[] = [];
  if (n0.shopName != null && n0.shopName.length > 0) parts.push(n0.shopName);
  if (n0.duration != null && n0.duration > 0) parts.push(formatSeconds(n0.duration));
  return parts.join(' · ');
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
   * card source. Empty also forces the 空狀態. Read-only.
   */
  readonly next: readonly EndScreenNavRow[];
  /**
   * 倒數變體「立即觀看」CTA → host-wired → host → core load(next). Default no-op for
   * demo / snapshot instances — the CTA is inert. This layer NEVER loads / advances.
   */
  readonly onWatchNext?: () => void;
  /**
   * 倒數變體「取消」exit → host-wired → host. Now CLOSES the whole EndScreen overlay
   * (rb-rn-endscreen-live-empty-state — no more 熱門變體 to retreat to). Default no-op for demo /
   * snapshot instances.
   */
  readonly onCancel?: () => void;
  /**
   * 空狀態「查看購物車」CTA → host-wired → host (open the product list / cart). Default no-op
   * for demo / snapshot instances. rb-rn-endscreen-live-empty-state.
   */
  readonly onViewCart?: () => void;
  /**
   * Formatted live-duration string (e.g. `"1:24:30"`) for the 空狀態's「直播時長：…」line
   * (rb-rn-endscreen-live-empty-state). Default `''` — no reference-ui / view-model data source
   * for a real duration exists today, so this renders the design-documented fallback
   * `"--:--:--"` (parity iOS `liveDuration`'s own Non-Goal — not invented by this change).
   */
  readonly liveDuration?: string;
  /**
   * Live-flag gate (parity `CarouselCardView.live` — rb-rn-endscreen-recommended-video-cover).
   * `false` (snapshot / demo — the DEFAULT) → the 倒數變體大預覽卡 draws ONLY the deterministic
   * black cover placeholder ({@link RemoteImage} renders NOTHING → no network `<Image>` in the
   * tree → structural snapshots unchanged). `true` (host runtime, real video surface) + a
   * non-empty card `cover` → the real cover photo loads OVER the placeholder via
   * {@link RemoteImage} (self-hides to the placeholder on a load error). Threaded down from the
   * turnkey container.
   */
  readonly live?: boolean;
}

/**
 * The family-4 full-screen END moment. In the 倒數變體 (`countdown != null` &&
 * `next` non-empty) it draws a big `next[0]` preview card with a centered countdown
 * RING (`remain / total`) representing the auto-advance-to-next countdown, plus 立即
 * 觀看 ({@link EndScreenProps.onWatchNext}) / 取消 ({@link EndScreenProps.onCancel}).
 * In the 空狀態 (`countdown == null` || `next` empty) it draws a「直播已結束」title +
 * a「直播時長：…」line + a「查看購物車」CTA ({@link EndScreenProps.onViewCart}). All actions
 * are host-wired forwarders; this layer never loads / advances / closes itself.
 *
 * Renders correctly with all callbacks omitted (demo / snapshot safe).
 */
export function EndScreen(props: EndScreenProps): ReactElement {
  const {
    theme,
    countdown,
    next,
    onWatchNext,
    onCancel,
    onViewCart,
    liveDuration = '',
    live = false,
  } = props;

  // 倒數變體 active — `countdown != null` AND a preview target exists (mirrors
  // `LBPEndScreen`'s `isEmpty`, moments.jsx line 164).
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
        <EmptyVariant theme={theme} liveDuration={liveDuration} onViewCart={onViewCart} />
      )}
    </View>
  );
}

// MARK: - 倒數變體 (preview card + ring + 立即觀看 / 取消)
//
// Mirrors `LBPEndScreen`'s countdown branch (moments.jsx 180-235):
//   • 「— 直播已結束 —」rule-flanked label.
//   • a 150×(9:16) preview card of `next[0]` with a centered countdown ring.
//   • 「{remain} 秒後自動播放下一支」+ the next title (2-line clamp) + the design's
//     「{shopName} · {duration}」meta line.
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
        {/* 「{shopName} · {mm:ss}」meta line (LBPEndScreen moments.jsx:217) — drawn only when at
            least one field is host-fed. */}
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
 * 「— 直播已結束 —」rule-flanked caption (LBPEndScreen moments.jsx 183-187). Design R41 —
 * BOTH variants now say「直播已結束」(EndScreen is LIVE-only), so this no longer takes a
 * variable `label`. Parity iOS / Android `EndedRule`.
 */
function EndedRule(props: { theme: ReferenceUITheme }): ReactElement {
  const { theme } = props;
  const rule = <View style={{ width: 18, height: 1, backgroundColor: ON_DARK_FAINT }} />;
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
        {LIVE_ENDED_LABEL}
      </Text>
      <View style={{ width: 8 }} />
      {rule}
    </View>
  );
}

/**
 * The 150×(9:16) preview card with the centered countdown ring (LBPEndScreen
 * moments.jsx 191-210). The black `COVER_BG` fill is the deterministic placeholder; at RUNTIME
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
 * The auto-advance-to-next countdown RING (LBPEndScreen moments.jsx 194-209), rendered as a
 * DETERMINISTIC View-based representation (NOT Canvas / react-native-svg / Animated —
 * the RN render path has no SVG for this DYNAMIC geometry): a faint full-circle track (a bordered
 * round View) overlaid with {@link RING_SEGMENTS} small radial ticks whose first
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

// MARK: - 空狀態 (直播已結束 title + 直播時長 line + 查看購物車 CTA)
//
// Mirrors `LBPEndScreen`'s empty branch (moments.jsx 237-252, design R41): replaces the retired
// 熱門變體「為你推薦」card wall entirely. rb-rn-endscreen-live-empty-state.

/**
 * The LIVE-ended 空狀態 (`next` empty — `LBPEndScreen`'s `variant === 'liveEmpty'`, moments.jsx
 * 237-252, R41): a big「直播已結束」title + a「直播時長：…」line (fallback `"--:--:--"` when
 * `liveDuration` is empty) + a full-width accent「查看購物車」CTA (reusing the SAME button
 * language as `ProductListView`'s cart-CTA footer — `CartFillGlyph` + `theme.cornerRadius` +
 * `theme.accent`). Replaces the retired 熱門變體 (design R41 removed the「為你推薦」card wall
 * entirely — EndScreen is now LIVE-only).
 */
function EmptyVariant(props: {
  theme: ReferenceUITheme;
  liveDuration: string;
  onViewCart?: () => void;
}): ReactElement {
  const { theme, liveDuration, onViewCart } = props;
  const durationText = liveDuration.length > 0 ? liveDuration : LIVE_DURATION_FALLBACK;
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 30 * theme.fontScale, fontWeight: '800' }}>
          {LIVE_ENDED_LABEL}
        </Text>
        <View style={{ height: 14 }} />
        <Text style={{ color: ON_DARK_STRONG, fontSize: 15.5 * theme.fontScale }}>
          {`${LIVE_DURATION_PREFIX}${durationText}`}
        </Text>
      </View>
      <View style={{ height: 36 }} />
      <Pressable
        testID={LBTestIDs.momentEndViewCart}
        onPress={() => onViewCart?.()}
        style={{
          alignSelf: 'stretch',
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: theme.cornerRadius,
          backgroundColor: theme.accent,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Verbatim the SAME glyph `ProductListView`'s cart-CTA footer uses (design
            `Icons.cartFill`) — see this file's header RENDER DISCIPLINE note for why a static
            `CartFillGlyph` is the one deliberate react-native-svg exception in this family. */}
        <CartFillGlyph color="#FFFFFF" size={20 * theme.fontScale} />
        <View style={{ width: 10 }} />
        <Text style={{ color: '#FFFFFF', fontSize: 16 * theme.fontScale, fontWeight: '700' }}>
          {VIEW_CART_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}
