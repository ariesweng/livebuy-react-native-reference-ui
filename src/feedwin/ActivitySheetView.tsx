// ActivitySheetView — family-2 feed-win surface (抽獎活動彈窗, RN, rb-rn-live-activity-sheet).
//
// Spec: `reference-ui-rendering/spec.md` § "渲染 RN ActivitySheet 抽獎活動彈窗"
// Design: `design/templates/minimal/moments.jsx` `LBActivitySheet` — a SINGLE-STAGE centered
//   modal card (no email input, no confirm alert, no submitting/done/fail state machine — unlike
//   this package's own four-stage `WinClaimSheetView.tsx`, the design mock is one page): scrim +
//   centered card (`width:'84%'`, `maxWidth:320`, `borderRadius:20`) + a badge floated above the
//   card's top edge (white circle, `accent`-tinted gift glyph, `top:-30`, 4px surface-bg border) +
//   title (`activity.title`) + prize name (`activity.award[0]?.name`, design.md D2) + a
//   keyword-CTA copy line + a「立即參加」/「已參加」primary button + a static footer.
// Parity: mirrors this package's own `WinClaimSheetView.tsx` centered-card SHELL (scrim +
//   `borderRadius:20` + `width:'84%'` + `maxWidth:320` + a badge floated above the card) — see that
//   file's header for the shared conventions this shell inherits — but is deliberately SIMPLER: no
//   alert overlay, no `KeyboardAvoidingView` / `TextInput` (nothing to type here), no
//   `submitInFlight` / `resultState` view-model binding (this CTA has nothing to await).
//
// ─────────────────────────────────────────────────────────────────────────────
// SUB-VIEW INPUT PATTERN (mirrors family-2 siblings)
// ─────────────────────────────────────────────────────────────────────────────
//   1. `theme` (ReferenceUITheme, required)   — FIRST, always.
//   2. `activity` (LBActiveEvent, REQUIRED, non-nullable): the container only mounts this
//      component once it already has a value (`activitySheetOpen && model.currentActivity !=
//      null`, `FeedWinView.tsx`), so this sub-view never needs a "nothing to show" fallback
//      (one-way data flow — it reads ONLY this passed value, never reaches back into the model /
//      template).
//   3. optional trailing action callbacks (`onClose` / `onJoin`), each defaulting to a no-op, so a
//      demo / structural-snapshot instance constructs action-free.
//
// This layer holds ONE piece of local UI state — `joined` (a fire-and-forget visual flip on CTA
// tap; parity the design's own `React.useState(false)`). This is NOT a second copy of
// authoritative state: unlike the win-claim sheet's `submitInFlight` / `resultState` (bound to a
// real view-model in-flight/result machine), `joinEvent` has no result to await, so there is
// nothing for a view-model to own here — the tap's ENTIRE lifecycle is "did the user tap the
// button", which is exactly what `joined` records.
//
// Scrim tap ALWAYS dismisses (`onPress={onClose}` unconditionally) — unlike `WinClaimSheetView`,
// which only allows scrim-dismiss on its `done` stage (protecting the claim flow's deliberate
// close friction), this single-stage sheet has no alert layer / submit flow to protect.
//
// RENDER DISCIPLINE (inherited from the rest of this layer): plain `View` / `Text` / `Pressable` +
// `react-native-svg`'s `Svg`/`Path` for the shared two-tone gift glyph (`GiftGlyphPaths.ts`) — NO
// ScrollView/FlatList/SectionList/VirtualizedList, NO network-uri Image, NO animation / randomness
// (deterministic structural tree — this sheet's design mock has no confetti, unlike `LBWinSheet`).
//
// ─────────────────────────────────────────────────────────────────────────────
// 分頁（rb-rn-activity-sheet-pagination / `activity-sheet-pagination-reference-ui-rn`）
// ─────────────────────────────────────────────────────────────────────────────
// Optional `pageCount?` / `pageIndex?` / `onPage?` props (parity `WinClaimSheetView`'s own
// `rb-rn-win-claim-pagination`, and the SAME design source's `pageCount`/`pageIndex`/`onPage` on
// `LBActivitySheet`). `pageCount > 1` draws a row of pagination dots below the CTA and enables
// horizontal swipe paging via `swipePageDelta` — REUSED directly from `WinClaimSheetView.tsx`
// (a plain numeric judgement with no win-claim-specific typing), not re-implemented here. The page
// index itself is NOT a second local copy of state: the container (`FeedWinView`) forwards
// `DefaultPlayerTemplate.activities.length` / `.currentActivityPageIndex` /
// `.setActivityPageIndex` straight through — the template is the single authoritative source, this
// component only presents whatever `pageIndex` it is handed. `pageCount <= 1` (the pre-pagination
// default) draws no dots and makes swipe a no-op — a single-activity sheet's structure and
// behavior are byte-identical to before this capability existed.

import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { Text } from '../TightText';
import Svg, { Path } from 'react-native-svg';

import type { ReferenceUITheme } from '../theme';
import type { LBActiveEvent } from 'livebuy-react-native';
import { LBTestIDs } from '../testing/LBTestIDs';
import { GIFT_OUTER_D, GIFT_INNER_D, GLYPH_INNER_COLOR } from './GiftGlyphPaths';
// rb-rn-activity-sheet-pagination (activity-sheet-pagination-reference-ui-rn) — reuse the SAME
// swipe-threshold pure function `WinClaimSheetView.tsx` already exports for its own R27 pagination
// (`rb-rn-win-claim-pagination`). The function is a plain numeric judgement with no win-claim-
// specific typing, so importing it here avoids porting a second literal copy of the design
// source's `onSwipeEnd` logic (design.md D1).
import { swipePageDelta } from './WinClaimSheetView';

// MARK: - Decorative design tokens (literal minimal hex, lifted from moments.jsx · LBActivitySheet)
//
// Parity `WinClaimSheetView.tsx`'s own "decorative design tokens" section — these are the same
// resolved [ReferenceUITheme] `theme.surface.*` (light mode) hex literals that file already pins,
// reused here rather than re-derived so the two sheets read as siblings.

/** `theme.surface.textDim` (secondary / caption text — parity `WinClaimSheetView.TEXT_DIM`). */
const TEXT_DIM = '#6B6775';
/** Modal scrim (`rgba(0,0,0,0.6)` — parity `WinClaimSheetView.SCRIM`). Tap ALWAYS dismisses (no
 *  alert layer to protect, unlike the four-stage win-claim sheet). */
const SCRIM = 'rgba(0,0,0,0.6)';
/** CTA disabled ("已參加") background (design `#C9CDD3`). */
const CTA_DISABLED_BACKGROUND = '#C9CDD3';
/**
 * Pagination dot inactive color — design `LBActivitySheet`'s `S.border || '#D8DBE0'` fallback
 * (this design token set never defines `surface.border`, so the literal fallback is what actually
 * renders). Literal-copied from `WinClaimSheetView.PAGE_DOT_INACTIVE` (same value, same rationale
 * — that constant is module-private, not exported) rather than a shared cross-file export,
 * following this package's existing per-file "decorative design token" convention (parity
 * `TEXT_DIM` / `SCRIM` above, design.md D4).
 */
const PAGE_DOT_INACTIVE = '#D8DBE0';

// MARK: - Layout tokens (lifted from moments.jsx · LBActivitySheet)

/** Centered card corner radius (`borderRadius: 20`). */
const CARD_RADIUS = 20;
/** Centered card width (`width: '84%'`). */
const CARD_WIDTH = '84%';
/** Centered card max width (`maxWidth: 320`). */
const CARD_MAX_WIDTH = 320;
/** Badge diameter (`width:60, height:60, borderRadius:999`). */
const BADGE_SIZE = 60;
/** Badge glyph render box (`giftSvg(30, accent)`). */
const BADGE_GLYPH_SIZE = 30;
/** Badge background — literal white (design `background:'#fff'`; NOT a theme token — the border
 *  around it, not the fill, is the theme-aware `theme.background` — parity `WinClaimSheetView`'s
 *  `GiftBadge` border convention). */
const BADGE_BACKGROUND = '#fff';

// MARK: - Fixed localized copy (static presentation strings — parity to iOS/Android)

const PRIZE_NAME_FALLBACK = '';
const KEYWORD_PREFIX = '留言關鍵字【';
const KEYWORD_SUFFIX = '】即可參加抽獎！';
const CTA_JOIN = '立即參加';
const CTA_JOINED = '已參加';
const FOOTER_TERMS = '使用條款';
const FOOTER_SEPARATOR = ' | ';
const FOOTER_PRIVACY = '隱私政策';

/** Props for the {@link ActivitySheet} surface. */
export interface ActivitySheetProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * The activity this sheet presents. REQUIRED (non-nullable) — the container only mounts this
   * component once `model.currentActivity != null` (`FeedWinView.tsx`), so there is no "nothing to
   * show" fallback to render here.
   */
  readonly activity: LBActiveEvent;
  /**
   * Dismiss intent (scrim tap). Default no-op so demo / snapshot instances construct action-free.
   * Presentation only — does NOT touch `currentActivity` (the activity keeps running; closing this
   * sheet is not the same as the activity ending).
   */
  readonly onClose?: () => void;
  /**
   * 「立即參加」CTA intent. The container forwards this to
   * `model.joinEvent(activity.id, activity.keyword)` — the SAME forwarder the merged feed's
   * `LBEventJoinLine`「加入活動」CTA already uses (no second join path, per design.md D4).
   * Fire-and-forget: `joinEvent` has nothing to await, so this sheet flips its own local `joined`
   * flag immediately on tap and does not wait for a result. Default no-op so demo / snapshot
   * instances construct action-free.
   */
  readonly onJoin?: () => void;
  /**
   * Footer「使用條款」text tapped. Parity `WinClaimSheetView`'s `onOpenTermsOfUse` convention —
   * the container forwards this to `openLegalLink(LBLegalLinks.termsOfUse)` (`FeedWinView.tsx`),
   * which routes through core `LBURLOpenPolicy.decide` (in-app browser / system router / safe
   * no-op). This layer only forwards「使用者點了哪一段」— it MUST NOT judge domains or call any
   * opener itself (one-way data flow). Default `undefined` — tap-safe inert.
   */
  readonly onOpenTermsOfUse?: () => void;
  /** Footer「隱私政策」text tapped. Same contract as {@link onOpenTermsOfUse}, routed to
   *  `LBLegalLinks.privacyPolicy`. Default `undefined` — tap-safe inert. */
  readonly onOpenPrivacyPolicy?: () => void;
  /**
   * Total number of simultaneously running activities (rb-rn-activity-sheet-pagination, parity RN
   * `WinClaimSheetProps.pageCount`). The container forwards `model.activities.length`. `> 1` draws
   * a row of pagination dots below the CTA and enables horizontal swipe paging; `<= 1` (default)
   * draws no dots and makes swipe a no-op — the pre-pagination render / behavior is unchanged.
   * Appended at the END of the prop list (not reordered alongside `activity` above) — same
   * convention `WinClaimSheetProps` used when R27 added its own pagination props.
   */
  readonly pageCount?: number;
  /** The currently displayed page index (0-based, aligned to {@link pageCount}). Default `0`. */
  readonly pageIndex?: number;
  /**
   * Page switch intent — called with the target page index on a dot tap or a qualifying swipe.
   * The container (`FeedWinView.handlePageActivity`) forwards this straight to
   * `model.setActivityPageIndex(index)`; the template is the single authoritative source for the
   * page index (design.md D2), so this component does not need to know whether the call
   * "succeeded" — the next re-render simply reflects whatever `currentActivityPageIndex` the
   * template now reports. `undefined` (demo / structural snapshot / `pageCount <= 1`) — dot taps
   * / swipes are then safe inert (no dots are drawn and swipe is already a no-op in that case).
   */
  readonly onPage?: (index: number) => void;
}

/**
 * The family-2 抽獎活動彈窗 (single-stage — `LBActivitySheet`). Presents the current activity's
 * title / prize name / join keyword with a single「立即參加」CTA that flips to「已參加」(disabled)
 * on tap. Scrim tap ALWAYS dismisses (no alert layer, unlike the four-stage win-claim sheet).
 */
export function ActivitySheet(props: ActivitySheetProps): ReactElement {
  const {
    theme,
    activity,
    onClose,
    onJoin,
    onOpenTermsOfUse,
    onOpenPrivacyPolicy,
    pageCount = 1,
    pageIndex = 0,
    onPage,
  } = props;
  const [joined, setJoined] = useState(false);
  /** Pagination swipe — touch start `pageX` (design.md D1, parity `WinClaimSheetView`'s own ref). */
  const touchStartXRef = useRef<number | null>(null);

  const prizeName = activity.award[0]?.name ?? PRIZE_NAME_FALLBACK;

  const handleJoinPress = (): void => {
    setJoined(true);
    onJoin?.();
  };

  /** Pagination swipe — touch start: record the starting `pageX`. */
  const handleTouchStart = (e: GestureResponderEvent): void => {
    touchStartXRef.current = e.nativeEvent.pageX;
  };

  /** Pagination swipe — touch end: derive the next page (via the imported {@link swipePageDelta})
   *  and forward it. `null` (sub-threshold / `pageCount <= 1` / out-of-bounds) is a no-op. */
  const handleTouchEnd = (e: GestureResponderEvent): void => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX == null) return;
    const next = swipePageDelta(startX, e.nativeEvent.pageX, pageCount, pageIndex);
    if (next != null) onPage?.(next);
  };

  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 全幅 scrim — tap ALWAYS dismisses (no stage machine to protect). Wrapped in a local
          closure (rather than passing `onClose` straight through) so `onPress` is ALWAYS a real
          function — parity `ActivityEntryView`'s `onPress={(): void => onOpen?.()}` — so an
          action-free demo / snapshot instance (no `onClose` wired) still renders a tappable,
          crash-safe Pressable rather than one whose `onPress` prop is literally `undefined`. */}
      <Pressable
        accessibilityRole="button"
        testID={LBTestIDs.activitySheetScrim}
        onPress={(): void => onClose?.()}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: SCRIM,
        }}
      />

      {/* Card outer wrapper — unclipped, so the badge below can float above the card's top edge
          (parity `WinClaimSheetView`'s "outer doesn't clip, inner does" badge-overflow pattern). */}
      <View style={{ width: CARD_WIDTH, maxWidth: CARD_MAX_WIDTH }}>
        <View
          testID={LBTestIDs.activitySheet}
          style={{
            backgroundColor: theme.background,
            borderRadius: CARD_RADIUS,
            overflow: 'hidden',
            alignItems: 'center',
            paddingTop: 46,
            paddingHorizontal: 24,
            paddingBottom: 24,
          }}
        >
          <Text
            style={{
              color: theme.text,
              fontSize: 22 * theme.fontScale,
              fontWeight: '500',
              textAlign: 'center',
            }}
          >
            {activity.title}
          </Text>
          <Text
            style={{
              marginTop: 14,
              color: TEXT_DIM,
              fontSize: 14.5 * theme.fontScale,
              fontWeight: '500',
              textAlign: 'center',
            }}
          >
            {prizeName}
          </Text>
          <Text
            style={{
              marginTop: 14,
              color: theme.accent,
              fontSize: 14 * theme.fontScale,
              fontWeight: 'bold',
              lineHeight: 21 * theme.fontScale,
              textAlign: 'center',
            }}
          >
            {`${KEYWORD_PREFIX}${activity.keyword ?? ''}${KEYWORD_SUFFIX}`}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: joined }}
            testID={LBTestIDs.activitySheetPrimary}
            disabled={joined}
            onPress={joined ? undefined : handleJoinPress}
            style={{
              marginTop: 18,
              width: '100%',
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: joined ? CTA_DISABLED_BACKGROUND : theme.accent,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16 * theme.fontScale, fontWeight: '900' }}>
              {joined ? CTA_JOINED : CTA_JOIN}
            </Text>
          </Pressable>

          {/* Pagination dots (rb-rn-activity-sheet-pagination) — drawn ONLY when `pageCount > 1`
              (multiple simultaneously-running activities); `pageCount <= 1` (the pre-pagination
              default) draws nothing here, so a single-activity sheet is byte-identical to before
              this change. Each dot forwards its own index directly to `onPage` (mirrors the design
              source's own bare `<button key={i}>` dot and `WinClaimSheetView.ClaimCardBody`'s
              equivalent block — parity styling: 6×6, `borderRadius: 999`, 5px `gap`). Horizontal
              swipe paging is handled by the root `View`'s `onTouchStart`/`onTouchEnd` above, not
              here. */}
          {pageCount > 1 ? (
            <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
              {Array.from({ length: pageCount }, (_unused, i) => (
                <Pressable
                  key={`activity-sheet-page-dot-${i}`}
                  accessibilityRole="button"
                  onPress={(): void => onPage?.(i)}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: i === pageIndex ? theme.accent : PAGE_DOT_INACTIVE,
                  }}
                />
              ))}
            </View>
          ) : null}

          {/* Footer — 使用條款 / 隱私政策, each independently tappable (parity `WinClaimSheetView`'s
              `FooterRow`: two spans each wrapped in `Pressable`, forwarding「使用者點了哪一段」to
              `onOpenTermsOfUse` / `onOpenPrivacyPolicy` — this layer MUST NOT judge domains or call
              any opener itself; the container's `openLegalLink` is the actual action). The
              separator stays a plain, non-pressable `Text`. Both callbacks default `undefined` —
              `Pressable.onPress` calling `undefined?.()` is tap-safe inert. */}
          <View style={{ marginTop: 14, flexDirection: 'row' }}>
            <Pressable accessibilityRole="button" onPress={(): void => onOpenTermsOfUse?.()}>
              <Text style={{ color: TEXT_DIM, fontSize: 12.5 * theme.fontScale, fontWeight: '500' }}>
                {FOOTER_TERMS}
              </Text>
            </Pressable>
            <Text
              style={{
                color: TEXT_DIM,
                fontSize: 12.5 * theme.fontScale,
                fontWeight: '500',
                opacity: 0.5,
              }}
            >
              {FOOTER_SEPARATOR}
            </Text>
            <Pressable accessibilityRole="button" onPress={(): void => onOpenPrivacyPolicy?.()}>
              <Text style={{ color: TEXT_DIM, fontSize: 12.5 * theme.fontScale, fontWeight: '500' }}>
                {FOOTER_PRIVACY}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Badge — floats above the card top edge (`top:-30`), so lives OUTSIDE the clipped card
            view (parity `WinClaimSheetView`'s badge placement). White circle + `theme.accent`-tinted
            gift glyph (design.md D2 area — the badge glyph is accent-tinted, UNLIKE the two floating
            entry buttons' fixed-color glyph). */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: -30, left: 0, right: 0, alignItems: 'center' }}
        >
          <View
            style={{
              width: BADGE_SIZE,
              height: BADGE_SIZE,
              borderRadius: BADGE_SIZE / 2,
              borderWidth: 4,
              borderColor: theme.background,
              backgroundColor: BADGE_BACKGROUND,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={BADGE_GLYPH_SIZE} height={BADGE_GLYPH_SIZE} viewBox="0 0 200 200">
              <Path fillRule="evenodd" fill={theme.accent} d={GIFT_OUTER_D} />
              <Path fillRule="evenodd" fill={GLYPH_INNER_COLOR} d={GIFT_INNER_D} />
            </Svg>
          </View>
        </View>
      </View>
    </View>
  );
}
