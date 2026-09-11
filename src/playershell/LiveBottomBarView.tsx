// LiveBottomBarView — family-1 player-shell LIVE bottom bar.
//
// Spec: `reference-ui-rendering/spec.md`
//   § "LivebuyReferenceUI 渲染 LIVE 底部 bar（LiveBottomBarView），綁 bagCount / isReplay"
// RN sibling of iOS `LiveBottomBarView.swift`, Android `LiveBottomBar.kt`, Flutter
// `live_bottom_bar_view.dart`.
//   Design source: `design/templates/minimal/live-chrome.jsx` → `LBLiveBottomBar` (161-237).
//
// The LIVE-mode bottom bar. `screens.jsx` mode-branches the player chrome on
// `isLive`: the LIVE screen renders this horizontal bottom bar while the side rail
// (`OperationRail`) is VOD-only (`!isLive`). The bar paints, left → right:
//
//   • a white shopping-bag button + cart badge (when `bagCount > 0`),
//   • a flex "留言..." TAP-TARGET pill (NOT an inline text input — design `onComment`
//     opens a sheet; the real composer is the host's),
//   • a nickname button,
//   • a share button,
//   • an accent like (heart) button.
//
// Comment entry ALWAYS available (prerecorded-live-bottom-bar-comment, RN parity to iOS): this
// bar renders for a live broadcast (`isLive == true`, i.e. `liveStatus == 1`) and, since
// `rb-rn-replay-live-chrome-parity`, ALSO for an already-finished live replay
// (`isFinishedLiveReplay == true` — see `chatClosed` below); pure VOD still uses the side rail.
// A live broadcast's chat is open regardless of playback position, so the "留言..." pill and
// nickname button are NEVER collapsed on `isReplay` (a DIFFERENT, narrower playback-position
// heuristic than `isFinishedLiveReplay` — see that prop's own doc). The prior "replay variant"
// (disabled "聊天室已關閉" + CC swap) driven by `isReplay` is removed: `isReplay` was a
// playback-position heuristic that mis-flags a 預錄直播 (finite-length HLS routed to IVS) and
// wrongly closed chat. `chatClosed` (below) is the CORRECT, unrelated flag that now drives that
// same visual variant for a genuinely-finished replay.
//
// SUB-VIEW INPUT PATTERN (D-1/D-4): theme FIRST → snapshot values BY VALUE →
// trailing optional callbacks (default no-op). Reads ONLY its passed-in values;
// never reaches back into the model / template; calls NO core `simulate*` (the
// shell maps bag / like / CC onto the existing `handleRailTap` rail wiring by kind — the
// container seam's default sends `Like` to core, rb-rn-like-tap-wire; share / nickname / 留言
// raise the dedicated `onShare` / `onNickname` / `onComment` intents). Plain
// `View` / `Text` / `Pressable` only (NO ScrollView / FlatList) so the structural
// snapshot is deterministic. Glyphs are a mix: nickname / share / CC / like are self-drawn
// vector components (`PersonEditGlyph` / `ShareGlyph` / `CcGlyph` / `HeartFillGlyph`); 更多
// (`⋯`) is still a stable Text glyph, parity with `OperationRailView.railGlyphFor`. The bar
// itself paints NO background
// (rb-rn-live-chrome-gradient-removal — the design's bottom scrim is removed, not
// approximated).
//
// The user-facing string ("留言...") is design-literal (the minimal design mockup is the
// source of truth); localization is a cross-layer follow-up.
//
// `chatClosed` / `ccOn` / `onMore` (element itself added by design R32,
// rb-rn-live-replay-more-menu-and-video-info-live-copy; call site wired by
// rb-rn-replay-live-chrome-parity):
//
// `chatClosed` mirrors iOS/Android's existing `chatClosed` prop (source: `PlayerShellModel
// .isFinishedLiveReplay`, "已結束直播回放") and drives the design's replay-mode bottom-bar
// variant: the comment area becomes a disabled "聊天室已關閉" (non-`Pressable`), the nickname
// button disappears, a "更多" (more, `⋯`) button takes the nickname's old slot, and a CC toggle
// takes the share button's old slot (share itself is folded into the `LiveMoreMenuView` sheet,
// NOT rendered by this bar directly).
//
// WIRED AT THE CALL SITE (since `rb-rn-replay-live-chrome-parity`, parity iOS/Android):
// `PlayerShellView.tsx`'s render gate for this component is now `((usesLiveChrome && !cleanMode)
// || model.introPlaying) && !composerPresented && !isScrubbing` (`usesLiveChrome = model.isLive
// || model.isFinishedLiveReplay`), and its `<LiveBottomBarView>` call site feeds
// `chatClosed={model.isFinishedLiveReplay}` directly — a finished-live replay now reaches this
// component (routing away from the VOD side rail `OperationRail`, which is PURE-VOD-ONLY as of
// the same change). `ccOn={model.subtitleEnabled}` (the same single source of truth the VOD
// caption overlay / side-rail `Subtitle` pill read) and `onMore={() =>
// setMoreMenuOpen(true)}` (bypassing the rail's `handleRailTap` dispatch chain entirely — a new,
// independent trigger) are wired at the same call site. This resolved a pre-existing, real
// user-facing bug: a finished-live replay had no chat, no LIVE pinned-card overlay, and no
// bottom-bar affordances at all, because every one of these gates independently used the
// narrower `model.isLive`. `isReplay` below remains a SEPARATE, unrelated concern (retained for
// source compat, see its own doc and `LiveBottomBarView`'s function-body comment for how
// `onToggleCC` fits in).
//
// `subtitleAvailable` (design R42, rb-rn-cc-icon-availability-redesign): the `chatClosed`
// variant's CC toggle is the SECOND of the two CC entry points R42 scopes its "unavailable"
// state + tooltip to (the first is the VOD side rail's `Subtitle` pill, `OperationRailView.tsx`'s
// `CcRailPill`). `PlayerShellView.tsx`'s call site feeds `subtitleAvailable={subtitleAvailableFrom
// (model.railItems)}` — the SAME `LBSideRailItem[]` snapshot the VOD side rail reads, so both
// entry points agree on availability even though only one of them is ever mounted at a time
// (this bar's `chatClosed` CC slot vs the side rail's `Subtitle` pill are mutually exclusive by
// construction — `usesLiveChrome` vs `!usesLiveChrome`). See `LiveCcButton` below for the
// three-state glyph + tap-intercept-to-tooltip logic (shared implementation shape with
// `CcRailPill`, via the same `useCcUnavailableTooltip` hook).

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { ShareGlyph } from './ShareGlyph';
import { PersonEditGlyph } from './PersonEditGlyph';
import { BagGlyph } from './BagGlyph';
import { CcGlyph } from './CcGlyph';
import { CcTooltip } from './CcTooltip';
import { useCcUnavailableTooltip } from './useCcUnavailableTooltip';
import { HeartFillGlyph } from './HeartFillGlyph';
import { railGlyphFor, CC_UNAVAILABLE_TOOLTIP_TEXT } from './OperationRailView';
import { LBTestIDs } from '../testing/LBTestIDs';
import { LBSideRailKind } from 'livebuy-react-native-ui';

// MARK: - Secondary design colors (lifted from live-chrome.jsx `LBLiveBottomBar`)

/** `rgba(20,20,24,0.6)` — translucent dark icon-button fill (iconBtn). */
const ICON_BUTTON_BACKGROUND = 'rgba(20,20,24,0.6)';
/** `rgba(20,20,24,0.55)` — comment pill fill. */
const COMMENT_BACKGROUND = 'rgba(20,20,24,0.55)';

// MARK: - Layout tokens (lifted from live-chrome.jsx)

const BAR_GAP = 8; // flex gap
const BAR_H_PADDING = 10; // padding 8px 10px 16px (horizontal value)
/** Top inset (rb-rn-live-bottom-bar-16pt-align). Unchanged. */
const BAR_TOP_PADDING = 8;
/** Bottom inset (rb-rn-live-bottom-bar-16pt-align): design `LBLiveBottomBar` `padding: 8px 10px
 *  16px` (2026-08-31, bottom value raised from the prior symmetric 8 to 16), aligning with the VOD
 *  floating bag button's `bottom: 16`. Deliberately its own constant (not folded back into a
 *  symmetric `BAR_V_PADDING`) so top/bottom can differ. */
const BAR_BOTTOM_PADDING = 16;
const ICON_SIZE = 36; // 36×36 round iconBtn
/** This bar's real rendered height (rb-rn-caption-overlay-bottom-bar-clearance-fix) — the SINGLE
 *  SOURCE OF TRUTH for other family-1 surfaces that need to position themselves relative to this
 *  bar (e.g. `LiveOverlayChromeView`'s bottom row, `PlayerShellView`'s VOD/replay caption
 *  overlay), taking the place of independently-guessed / hard-coded literals that could silently
 *  drift out of sync with this bar's actual three padding/size constants above. Parity iOS
 *  `LiveBottomBarView.barHeight` / Flutter `LiveBottomBarView.barHeight`. `export`ed for direct
 *  unit testing and cross-file import. */
export const LIVE_BOTTOM_BAR_HEIGHT = BAR_TOP_PADDING + ICON_SIZE + BAR_BOTTOM_PADDING; // 60
const ICON_GLYPH_SIZE = 18; // glyph size 18 (nickname / share; NOT the bag — see BAG_ICON_GLYPH_SIZE)
/** Bag-only glyph size (rb-rn-live-bottom-bar-bag-icon-enlarge): the design deliberately draws
 *  the bag glyph LARGER than the other iconBtn glyphs — `Icons.bag size={25}` vs the shared
 *  `size={18}` used by nickname / share (live-chrome.jsx `LBLiveBottomBar`, 36×36 iconBtn,
 *  25/36 ≈ 70%). Kept as its own constant (NOT folded into `ICON_GLYPH_SIZE`) so nickname / share
 *  stay at their original size. */
const BAG_ICON_GLYPH_SIZE = 25;
const BADGE_MIN_SIZE = 16; // cart badge minWidth / height
const BADGE_FONT_SIZE = 10; // fontSize 10, weight 800
const BADGE_BORDER_WIDTH = 1.5; // 1.5px solid #fff border
const COMMENT_FONT_SIZE = 13; // 留言... 13px left

// Glyphs (Text, parity with OperationRailView.railGlyphFor — deterministic).
// 設定暱稱 改用自繪 PersonEditGlyph（人頭 + 鉛筆 badge，View 拼），不再用 emoji '👤'
// （rb-align-nickname-icon-person-edit）。
// `LIKE_GLYPH` (`'♥'` literal, `<Text>`-rendered) is REMOVED (rb-rn-heart-burst-icon-parity,
// parity-debt-ledger.md #20): the LIKE button below now draws the self-drawn `HeartFillGlyph`
// (same vector component `HeartBurst.tsx` uses for the flying burst) — a literal Unicode
// character renders in an emoji style on some devices/fonts and ignores the caller's `color`
// tint, the same class of bug Android fixed (`rb-android-heart-burst-deemoji`) and Flutter fixed
// (`rb-flutter-heart-burst-icon-parity`).
const COMMENT_PLACEHOLDER = '留言...';
/** `chatClosed` variant placeholder (design-literal, same pattern as `COMMENT_PLACEHOLDER`). */
const CHAT_CLOSED_PLACEHOLDER = '聊天室已關閉';
/** "更多" (more) button glyph — REUSES `OperationRailView.railGlyphFor(LBSideRailKind.More)`
 *  (`'⋯'`) rather than a second literal, so the two surfaces can never drift on this glyph. */
const MORE_GLYPH = railGlyphFor(LBSideRailKind.More);
// `CC_GLYPH` (`railGlyphFor(LBSideRailKind.Subtitle)`'s `'CC'` literal) is REMOVED
// (rb-rn-live-bottom-bar-cc-icon-align): the `chatClosed` CC toggle below draws the self-drawn
// `CcGlyph` instead (three states as of R42, rb-rn-cc-icon-availability-redesign — see
// `LiveCcButton`), so this file no longer has any use for the literal. The
// `railGlyphFor(LBSideRailKind.Subtitle) === 'CC'` kind→glyph parity test
// (`OperationRail.test.tsx`) reads `railGlyphFor` directly and does not import this
// constant, so removing it is not a source-compat break for that test.

/** Props for the {@link LiveBottomBarView} surface. */
export interface LiveBottomBarProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /** Cart badge count; `> 0` → draw the badge on the bag button. */
  readonly bagCount: number;
  /** Replay (behind-live-edge) flag. RETAINED for source compatibility; NO LONGER alters this
   *  bar's comment / nickname rendering (a live broadcast's chat is open regardless of playback
   *  position — prerecorded-live-bottom-bar-comment). Header LIVE-pill handling is a separate surface. */
  readonly isReplay: boolean;
  /**
   * Upcoming (直播預告) SLIM variant flag (RN parity iOS 320d543 / Android / Flutter
   * `LiveBottomBar(isUpcoming)`): the comment area collapses to a flex spacer and the
   * nickname / CC button is dropped — only bag + share + like remain (the stream
   * hasn't started, so there is no chat). Takes precedence over {@link isReplay}.
   * Mirrors `LBLiveBottomBar({ upcoming: true })` (live-chrome.jsx). Default `false`.
   */
  readonly isUpcoming?: boolean;
  /**
   * Bag-only variant flag (直播預告開場片頭 `introPlaying`): the bar collapses to JUST the
   * shopping-bag + a trailing flex spacer — comment / nickname / CC / share / like are ALL
   * dropped. The minimal intro-MP4 chrome (RN parity to iOS `LiveBottomBarView(bagOnly:)`).
   * Takes PRECEDENCE over {@link isUpcoming} / {@link isReplay}. Default `false`.
   */
  readonly bagOnly?: boolean;
  /**
   * "已結束直播回放" (finished-live-replay) chat-closed variant flag (design R32, source:
   * `PlayerShellModel.isFinishedLiveReplay`). `true` → the comment area becomes a disabled
   * "聊天室已關閉" (NOT a `Pressable`), the nickname button disappears, a "更多" button takes
   * its old slot, and a CC toggle takes the share button's old slot (share itself moves into
   * the separate `LiveMoreMenuView` sheet — NOT rendered by this bar). Takes precedence over
   * neither {@link bagOnly} nor {@link isUpcoming} (both still win over it — see
   * {@link commentAreaKind}'s precedence). Default `false`.
   *
   * WIRED AT THE CALL SITE (`rb-rn-replay-live-chrome-parity`): `PlayerShellView.tsx`'s
   * `<LiveBottomBarView>` call site feeds `chatClosed={model.isFinishedLiveReplay}`, and this
   * component's own render gate now includes `model.isFinishedLiveReplay` (via the caller-
   * computed `usesLiveChrome = model.isLive || model.isFinishedLiveReplay` — see the file-header
   * comment above). A finished-live replay therefore reaches this component and this variant in
   * real playback, not just in direct unit construction.
   */
  readonly chatClosed?: boolean;
  /**
   * CC (subtitle) toggle visual state — mirrors design `LBLiveBottomBar`'s `ccOn` prop. Only
   * consulted when {@link chatClosed} is `true` (the CC button only renders in that variant) AND
   * captions are AVAILABLE (see {@link subtitleAvailable}) — `true` → the button inverts to a
   * white fill + accent glyph (matches an "active" pill elsewhere in this package); `false`
   * (default) → the shared translucent-dark `iconBtn` fill + white glyph.
   */
  readonly ccOn?: boolean;
  /**
   * Whether captions are available for this video (design R42, rb-rn-cc-icon-availability-
   * redesign — same source + semantics as `OperationRailView`'s `subtitleAvailableFrom(items)`,
   * the SECOND of R42's two CC entry points; only meaningful when {@link chatClosed} is `true`).
   * `false` → the CC button draws {@link CcGlyph}'s `'unavailable'` state (fixed grey,
   * non-square) regardless of {@link ccOn}, stays in the base inactive fill, and a tap does NOT
   * forward {@link onToggleCC} — it shows a local "未提供字幕" tooltip instead
   * (`useCcUnavailableTooltip`), auto-dismissing after ~1.8s. **Default `true`** (available) —
   * every existing call site that never passes this prop keeps the pre-R42 on/off behavior,
   * byte-identical.
   */
  readonly subtitleAvailable?: boolean;
  readonly onBag?: () => void;
  readonly onComment?: () => void;
  readonly onNickname?: () => void;
  readonly onShare?: () => void;
  readonly onLike?: () => void;
  readonly onToggleCC?: () => void;
  /**
   * "更多" (more) button tap intent — only rendered when {@link chatClosed} is `true`. Host-wired
   * to open the `LiveMoreMenuView` sheet (分享 / 客服) — `PlayerShellView.tsx` feeds
   * `onMore={() => setMoreMenuOpen(true)}` directly (bypassing the side rail's `handleRailTap`
   * dispatch chain, see the file-header comment). Defaults to a no-op.
   */
  readonly onMore?: () => void;
  /**
   * Like-button "lit up" state (design R37, `LBLiveBottomBar`'s `liked` prop,
   * rb-rn-live-like-burst-restyle). `true` → the heart glyph tints {@link ReferenceUITheme.accent};
   * `false` (default) → white. Replaces the prior unconditional `theme.accent` fill — the design
   * now only lights the icon up WHILE the like burst plays (see `PlayerShellView.tsx`'s
   * `triggerLikeBurst`, which flips this true immediately on tap and back to false after the
   * burst's hold duration).
   */
  readonly liked?: boolean;
}

/** Which thing the flex comment area draws (`chatClosed` variant, design R32) — pure,
 *  unit-testable, no rendering. Mirrors iOS/Android's identically-named `commentAreaKind`.
 *  Precedence: `bagOnly` > `isUpcoming` (upcoming spacer) > `chatClosed` (聊天室已關閉) >
 *  normal 留言 pill. `export`ed for direct unit testing. */
export type CommentAreaKind = 'bagOnlySpacer' | 'upcomingSpacer' | 'chatClosed' | 'comment';

export function commentAreaKind(
  bagOnly: boolean,
  isUpcoming: boolean,
  chatClosed: boolean,
): CommentAreaKind {
  if (bagOnly) return 'bagOnlySpacer';
  if (isUpcoming) return 'upcomingSpacer';
  if (chatClosed) return 'chatClosed';
  return 'comment';
}

/** Whether the nickname (person-edit) button shows — pure, unit-testable. Mirrors iOS/Android's
 *  identically-named `showsNickname`. Dropped in `bagOnly` / `isUpcoming` / `chatClosed` (the
 *  replay variant hides it — renaming only serves commenting, useless once chat is closed). */
export function showsNickname(bagOnly: boolean, isUpcoming: boolean, chatClosed: boolean): boolean {
  return !bagOnly && !isUpcoming && !chatClosed;
}

/**
 * The family-1 LIVE bottom bar surface. Renders the horizontal bag / comment /
 * nickname / share / like row from `LBLiveBottomBar`. The comment entry is always
 * available for a live broadcast (prerecorded-live-bottom-bar-comment).
 *
 * Renders correctly with the default no-op callbacks (snapshot / preview safe).
 */
export function LiveBottomBarView(props: LiveBottomBarProps): ReactElement {
  // `isReplay` is RETAINED on the props (source compat) but NOT consumed by the comment /
  // nickname decision (which reads `chatClosed` instead — see the file-header comment): the
  // LIVE bottom bar's comment / nickname affordances stay available for a live broadcast
  // (prerecorded-live-bottom-bar-comment). `onToggleCC` IS consumed by the `chatClosed` variant's
  // CC button below (wired at the real call site since `rb-rn-replay-live-chrome-parity`).
  const {
    theme,
    bagCount,
    isUpcoming = false,
    bagOnly = false,
    chatClosed = false,
    ccOn = false,
    subtitleAvailable = true,
    liked = false,
    onBag,
    onComment,
    onNickname,
    onShare,
    onLike,
    onToggleCC,
    onMore,
  } = props;
  const kind = commentAreaKind(bagOnly, isUpcoming, chatClosed);

  return (
    // rb-rn-live-chrome-gradient-removal: no decorative background here (design
    // dropped the bottom-up scrim entirely).
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: BAR_H_PADDING,
        paddingTop: BAR_TOP_PADDING,
        paddingBottom: BAR_BOTTOM_PADDING,
      }}
    >
      <BagButton theme={theme} bagCount={bagCount} onTap={onBag} />
      <View style={{ width: BAR_GAP }} />

      {bagOnly ? (
        /* bag-only variant (introPlaying intro MP4) — JUST the bag + a trailing flex spacer.
           Takes precedence over every other variant: comment / nickname / CC / share / like
           are all dropped. */
        <View style={{ flex: 1 }} />
      ) : (
        <>
          {/* Flex comment area, dispatched by the pure `commentAreaKind` (bagOnly is handled
              above, so only 3 of its 4 cases are reachable here): `upcomingSpacer` → just a flex
              spacer (no chat before the stream starts); `chatClosed` → disabled "聊天室已關閉"
              (design R32 replay variant — see the file-header comment: currently unreachable from
              this component's real call site, but correct + unit-tested here); `comment`
              (LIVE — INCLUDING 預錄直播 where isReplay is mis-flagged true) → tap-target "留言...".
              The LIVE bottom bar only renders for a live broadcast (liveStatus == 1), whose chat is
              open regardless of playback position, so the comment entry is ALWAYS available and
              MUST NOT collapse to "聊天室已關閉" on isReplay (prerecorded-live-bottom-bar-comment).
              True 回放/VOD uses the side rail. */}
          {kind === 'upcomingSpacer' ? (
            <View style={{ flex: 1 }} />
          ) : kind === 'chatClosed' ? (
            <View style={{ flex: 1 }}>
              <ChatClosedPill />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <CommentPill onTap={onComment} />
            </View>
          )}
          <View style={{ width: BAR_GAP }} />

          {/* Nickname-or-更多 slot. Both branches read `kind` (the ALREADY precedence-resolved
              value from `commentAreaKind`), NOT the raw `chatClosed` prop — `isUpcoming` MUST
              win over `chatClosed` when both happen to be true (same precedence the comment
              area itself follows), so this slot MUST NOT independently re-derive its own
              (wrong) precedence from the raw props. `kind === 'chatClosed'` → "更多" button
              (design R32: takes the nickname's old slot; renaming only serves commenting,
              useless once chat is closed — see `showsNickname`). `kind === 'comment'` (LIVE
              normal) → nickname, ALWAYS shows — no longer swapped for a CC toggle on isReplay
              (a live broadcast's chat is open — prerecorded-live-bottom-bar-comment).
              `kind === 'upcomingSpacer'` → neither. */}
          {kind === 'chatClosed' ? (
            <>
              <IconButton testID={LBTestIDs.liveMore} tint="#FFFFFF" glyph={MORE_GLYPH} onTap={onMore} />
              <View style={{ width: BAR_GAP }} />
            </>
          ) : kind === 'comment' ? (
            <>
              {/* 設定暱稱 改設計稿自繪 person-edit（人頭 + 鉛筆 badge），鏡像 share 的寫法。 */}
              <IconButton testID={LBTestIDs.livePersonEdit} tint="#FFFFFF" onTap={onNickname}>
                <PersonEditGlyph color="#FFFFFF" size={ICON_GLYPH_SIZE} />
              </IconButton>
              <View style={{ width: BAR_GAP }} />
            </>
          ) : null}

          {/* 分享-or-CC slot. Same precedence discipline as above — reads `kind`, not the raw
              `chatClosed` prop. `kind === 'chatClosed'` → CC toggle (design R32: takes the share
              button's old slot; share itself moves into the separate `LiveMoreMenuView` sheet,
              NOT rendered here). Otherwise (`upcomingSpacer` OR `comment`) → 分享 改設計稿自繪
              三節點 ShareGlyph (rb-rn-share-icon-design-align，問題 8)。 */}
          {kind === 'chatClosed' ? (
            <LiveCcButton
              theme={theme}
              ccOn={ccOn}
              subtitleAvailable={subtitleAvailable}
              onToggleCC={onToggleCC}
            />
          ) : (
            <IconButton testID={LBTestIDs.liveShare} tint="#FFFFFF" onTap={onShare}>
              <ShareGlyph color="#FFFFFF" size={ICON_GLYPH_SIZE} />
            </IconButton>
          )}
          <View style={{ width: BAR_GAP }} />
          {/* liked ? accent : white (design R37) — replaces the prior unconditional accent fill;
              see the `liked` prop's own doc-comment above. */}
          <IconButton testID={LBTestIDs.liveHeart} tint={liked ? theme.accent : '#FFFFFF'} onTap={onLike}>
            <HeartFillGlyph color={liked ? theme.accent : '#FFFFFF'} size={ICON_GLYPH_SIZE} />
          </IconButton>
        </>
      )}
    </View>
  );
}

// MARK: - Bag button (`LBLiveBottomBar` bag)

function BagButton(props: {
  theme: ReferenceUITheme;
  bagCount: number;
  onTap?: () => void;
}): ReactElement {
  const { theme, bagCount, onTap } = props;
  return (
    <Pressable testID={LBTestIDs.liveBagButton} onPress={() => onTap?.()}>
      <View>
        <View
          style={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: ICON_SIZE / 2,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BagGlyph color={theme.accent} size={BAG_ICON_GLYPH_SIZE * theme.fontScale} />
        </View>
        {bagCount > 0 ? (
          <View style={{ position: 'absolute', top: -2, right: -2 }}>
            <CartBadge theme={theme} count={bagCount} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function CartBadge(props: { theme: ReferenceUITheme; count: number }): ReactElement {
  const { theme, count } = props;
  return (
    <View
      style={{
        minWidth: BADGE_MIN_SIZE,
        minHeight: BADGE_MIN_SIZE,
        paddingHorizontal: 4,
        borderRadius: 999,
        backgroundColor: theme.accent,
        borderWidth: BADGE_BORDER_WIDTH,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: BADGE_FONT_SIZE * theme.fontScale, fontWeight: '800', textAlign: 'center' }}>
        {count > 99 ? '99+' : `${count}`}
      </Text>
    </View>
  );
}

// MARK: - Comment area

/** Flex tap-target "留言..." pill (NOT an inline TextInput); tap forwards `onTap`. */
function CommentPill(props: { onTap?: () => void }): ReactElement {
  return (
    <Pressable
      testID={LBTestIDs.liveCommentPill}
      onPress={() => props.onTap?.()}
      style={{
        height: ICON_SIZE,
        borderRadius: 999,
        backgroundColor: COMMENT_BACKGROUND,
        justifyContent: 'center',
        paddingHorizontal: 14,
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: COMMENT_FONT_SIZE }}>{COMMENT_PLACEHOLDER}</Text>
    </Pressable>
  );
}

/** Non-interactive "聊天室已關閉" pill (design R32 `chatClosed` variant, mirrors iOS's
 *  `chatClosedPill`) — a plain `View` (NOT a `Pressable`), so a tap does nothing (no
 *  `onComment` fires). Dimmer than the active `CommentPill` (0.5 text opacity vs 0.78, a fainter
 *  capsule fill) to read as disabled. `testID` is shared with `CommentPill`
 *  (`LBTestIDs.liveCommentPill`) — the two are mutually exclusive variants of the SAME slot. */
function ChatClosedPill(): ReactElement {
  return (
    <View
      testID={LBTestIDs.liveCommentPill}
      style={{
        height: ICON_SIZE,
        borderRadius: 999,
        backgroundColor: COMMENT_BACKGROUND,
        opacity: 0.6,
        justifyContent: 'center',
        paddingHorizontal: 14,
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: COMMENT_FONT_SIZE }}>
        {CHAT_CLOSED_PLACEHOLDER}
      </Text>
    </View>
  );
}

// MARK: - Icon button (`LBLiveBottomBar` iconBtn)

function IconButton(props: {
  glyph?: string;
  tint: string;
  onTap?: () => void;
  children?: ReactElement;
  testID?: string;
  /** `true` → inverts the fill to white (design R32 `ccOn` "active" pill — mirrors
   *  `LBLiveBottomBar`'s `ccOn ? { background: '#fff', color: accent } : ...`). Default `false`
   *  (the shared translucent-dark `iconBtn` fill). `tint` is expected to already be the correct
   *  glyph color for either state — this prop only swaps the BACKGROUND. */
  active?: boolean;
}): ReactElement {
  const { glyph, tint, onTap, children, testID, active = false } = props;
  return (
    <Pressable
      testID={testID}
      onPress={() => onTap?.()}
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_SIZE / 2,
        backgroundColor: active ? '#FFFFFF' : ICON_BUTTON_BACKGROUND,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children ?? (
        <Text style={{ fontSize: ICON_GLYPH_SIZE, color: tint, fontWeight: '600' }}>{glyph}</Text>
      )}
    </Pressable>
  );
}

// MARK: - CC (chatClosed) button — R42 three-state redesign (rb-rn-cc-icon-availability-redesign)

/**
 * The `chatClosed` variant's CC toggle — wraps {@link IconButton} with `subtitleAvailable`-aware
 * glyph/tap logic (design R42), mirroring `OperationRailView.tsx`'s `CcRailPill` (SAME shared
 * `useCcUnavailableTooltip` hook + `CcTooltip` component, the other of R42's two CC entry
 * points — `placement="top"` here vs that pill's `placement="left"`):
 *
 *   - `subtitleAvailable === false` → `CcGlyph` `'unavailable'` state (fixed grey, non-square
 *     18×16), stays in the base inactive `IconButton` fill, and a tap does NOT forward
 *     `onToggleCC` — it shows the tooltip instead, auto-dismissing after ~1.8s.
 *   - `subtitleAvailable === true` → `CcGlyph` `'on'` (white fill + `theme.accent`) or `'off'`
 *     (translucent-dark fill + white glyph) per `ccOn`, and a tap forwards `onToggleCC` as before.
 */
function LiveCcButton(props: {
  theme: ReferenceUITheme;
  ccOn: boolean;
  subtitleAvailable: boolean;
  onToggleCC?: () => void;
}): ReactElement {
  const { theme, ccOn, subtitleAvailable, onToggleCC } = props;
  const tooltip = useCcUnavailableTooltip();
  const active = subtitleAvailable && ccOn;

  const handlePress = (): void => {
    if (!subtitleAvailable) {
      tooltip.show();
      return;
    }
    onToggleCC?.();
  };

  return (
    <View style={{ position: 'relative' }}>
      <IconButton testID={LBTestIDs.liveCC} tint={active ? theme.accent : '#FFFFFF'} active={active} onTap={handlePress}>
        <CcGlyph
          state={!subtitleAvailable ? 'unavailable' : ccOn ? 'on' : 'off'}
          color={active ? theme.accent : '#FFFFFF'}
          size={ICON_GLYPH_SIZE}
          width={!subtitleAvailable ? 18 : undefined}
          height={!subtitleAvailable ? 16 : undefined}
        />
      </IconButton>
      <CcTooltip
        testID={LBTestIDs.liveCcTooltip}
        visible={tooltip.visible}
        text={CC_UNAVAILABLE_TOOLTIP_TEXT}
        placement="top"
      />
    </View>
  );
}
