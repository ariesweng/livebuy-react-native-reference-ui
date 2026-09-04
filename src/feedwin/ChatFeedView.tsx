// ChatFeed — family-2 feed-win surface 1 (merged chat-feed stream) — RN .tsx.
//
// Spec: `reference-ui-rendering/spec.md` (family-2 feed-win, surface 1).
// Phase-4 RN sibling of the DONE iOS `ChatFeedView.swift` (rb-ios-feed-win, D-2),
// Android `ChatFeed.kt` (rb-android-feed-win), and Flutter `chat_feed.dart`
// (rb-flutter-feed-win) — translated 1:1 to RN.
//
//   Design source: `design/templates/minimal/moments.jsx`
//     · `LBLiveChatStream` (bottom-anchored merged stream, newest at the tail,
//        tail-retain N=7, top fade mask)
//     · `LBChatLine`       (name-colored avatar + translucent dark bubble)
//     · `LBEventJoinLine`  (accent-bordered card: sparkle chip + keyword copy +
//        加入活動 CTA / 已參加 — the ONLY interactive row)
//     · `LBActivityLine`   (tier-styled pill, ascending emphasis: join lowest-key
//        / purchase dark+accent border / win accent highlight)
//   And `live-chrome.jsx` `LBLiveChatOverlay` / `sdk-components.jsx`
//   `LBPChatOverlay` (the same avatar + bubble language).
//
// It binds the merged `feedItems` SNAPSHOT VALUE republished by `FeedWinModel`
// (`items: readonly FeedItem[]`, passed BY VALUE) and dispatches each row by
// `FeedItem.kind`:
//
//   • 'chat'      → ChatLineRow      — name-colored avatar (deterministic from
//                                      the prebuilt `text`) + translucent dark
//                                      bubble carrying the full prebuilt text.
//   • 'eventJoin' → EventJoinLineRow — accent-bordered card: sparkle chip +
//                                      keyword copy + 加入活動 CTA / 已參加.
//                                      The ONLY interactive row.
//
// rb-rn-activity-toast (2026-07-03 design re-sync, `LBActivityToast`) — 'activity' kind rows
// (進場 / 選購 / 搶購 / 中獎「炒氣氛提示」) are NO LONGER dispatched here. They are filtered out
// by `isChatFeedRow` before the map/switch below and surface exclusively via the sibling
// `ActivityToastView` mounted above this feed by `FeedWinView` (only the latest one, as a
// transient slide-in/out toast — see `moments.jsx` `LBLiveChatStream`'s
// `items.filter(m => m.kind !== 'activity')`). `ActivityLineRow` (the tier-styled pill renderer)
// is UNCHANGED and now `export`ed so `ActivityToastView` can reuse it verbatim.
//
// SUB-VIEW INPUT PATTERN (FeedWinView SKELETON contract):
//   1. `theme` (ReferenceUITheme)   — FIRST, always.
//   2. its bound SNAPSHOT VALUE     — `items` (read-only `FeedItem[]`), BY VALUE
//                                      from `FeedWinModel.feedItems`.
//   3. trailing optional `onJoin`   — default no-op. The container owns NO action;
//                                      the host wires the join exit. THIS LAYER
//                                      NEVER JOINS ITSELF: the only interactive row
//                                      (`eventJoin`) FORWARDS its tap via
//                                      `onJoin(eid, keyword)`.
//
// One-way data flow (D-1/D-4): this surface reads ONLY its passed-in `items` — it
// MUST NOT reach back into `FeedWinModel` / `DefaultPlayerTemplate`, MUST NOT hold
// a second copy of state, and MUST render correctly with `onJoin` omitted (so the
// structural snapshot test constructs it action-free). The data layer already
// merged / ordered / tail-retained (N=7); this surface renders the list VERBATIM
// (oldest → newest = top → bottom) and MUST NOT slice / merge / re-sort. `text` is
// the backend-prebuilt, i18n-complete full string — rows MUST NOT split it.
//
// rb-rn-feed-avatar-icon-hide (design re-sync R20, `design/contract/claude-design-sync.md`,
// 2026-08-21/22): the shared `ACT_SLOT` icon-rail style feeds ALL FOUR icon slots this file draws —
// `ChatLineRow`'s viewer avatar, `HostChatRow`'s host/AI rail, `EventJoinLineRow`'s crown slot, and
// `ActivityLineRow`'s tier icon (now only reached via the sibling `ActivityToastView`). The design
// flipped `ACT_SLOT.display` from `'flex'` to `'none'` (explicitly marked reversible in the design's
// own comment) — every one of those four icon slots is currently HIDDEN, with the row's bubble
// flush against the row's own start edge (no reserved icon width / gap, matching `display: 'none'`
// layout-collapse semantics, not just an invisible icon). See the `SHOW_FEED_ICON_SLOT` flag below
// (MARK: - Feed icon-slot visibility) — the render logic for every icon itself is kept intact for
// reversibility; only the assembly-site inclusion is gated.
//
// RENDER DISCIPLINE (iOS / Android / Flutter lessons baked in): plain
// `View` / `Text` / `Pressable` only — NO ScrollView / FlatList / SectionList /
// VirtualizedList (the merged feed is a FIXED SMALL tail-retain-7 set drawn as a
// plain column, mirroring Flutter `chat_feed`'s plain Column, NOT a list view), NO
// network-uri Image (deterministic placeholder Views + Text-glyph icons), NO
// animation / random state. The top-fade gradient mask the design draws is NOT
// reproducible without a native gradient dep, so the reference-ui layer renders the
// fixed column verbatim — true fade fidelity stays anchored to the iOS / Android /
// Flutter PNG baselines.
//
// jsx automatic runtime — no `import React`. Returns `ReactElement`.

import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';

import { ActivityTier } from 'livebuy-react-native-ui';
import type { FeedItem, PinnedMessage } from 'livebuy-react-native-ui';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs, chatLine } from '../testing/LBTestIDs';
import { BagGlyph } from '../playershell/BagGlyph';

// MARK: - Decorative design tokens (literal hex / rgba from moments.jsx)
//
// FIXED decorative colors from the design (on-glass white text / translucent
// bubble / card / pill fills). These are deliberately literal — they are NOT the
// theme accent / text / background (which feed the join CTA + win highlight +
// chips, pulled from `theme`).

/** On-glass primary text — white (chat / activity copy over the video). */
const ON_GLASS = '#FFFFFF';
/** Join-tier (進場) activity text — white@0.9 (lowest-key). */
const ON_GLASS_JOIN_TEXT = 'rgba(255,255,255,0.9)';
/** On-glass dim `rgba(255,255,255,0.72)` (已參加 chip text). */
const ON_GLASS_DIM = 'rgba(255,255,255,0.72)';
/** Chat avatar glyph — dark `#3a2e25` (reads on the pastel demo avatars; updated
 *  `LBChatLine` ACT_SLOT — was white). */
const AVATAR_GLYPH_COLOR = '#3a2e25';
/** Translucent dark chat bubble fill `rgba(0,0,0,0.42)` (updated `LBChatLine` ACT_BUBBLE
 *  — was 0.5). */
const BUBBLE_FILL = 'rgba(0,0,0,0.42)';
/** Activity bubble base `rgba(0,0,0,0.46)` — now backs ONLY the `.Intro` tier (rb-rn-chat-message-
 *  line-restyle, design R30: `.Join`/`.Purchase`/`.Win` moved to their own fixed semantic fills below;
 *  `.Intro` is an RN-only extra tier the R30 design canvas has no branch for, so it keeps this
 *  black-base + accent-wash formula unchanged). */
const ACTIVITY_BUBBLE_BASE = 'rgba(0,0,0,0.46)';
/** `.Browse` activity bubble fill `rgba(0,0,0,0.32)` — lowest-key, NO accent wash (rb-rn-chat-message-
 *  line-restyle, design R30: now backs ONLY `.Browse` — `.Join` moved to its own fixed coral fill
 *  below; `.Browse` (觀眾選購) has no R30 design branch, so it keeps this pre-R30 formula unchanged). */
const JOIN_BUBBLE_FILL = 'rgba(0,0,0,0.32)';
/** `.Join` icon-slot fill `rgba(255,255,255,0.16)` (lowest-key). Icon-slot fill/glyph derivation is
 *  UNCHANGED by rb-rn-chat-message-line-restyle (design R30 only re-colors the tier BUBBLE, not the
 *  icon slot itself) — kept for `renderIconSlot`'s reversible render logic (currently gated off by
 *  `SHOW_FEED_ICON_SLOT`). */
const JOIN_SLOT_FILL = 'rgba(255,255,255,0.16)';
/** .Join person-add icon tint `rgba(255,255,255,0.85)`. */
const JOIN_GLYPH_COLOR = 'rgba(255,255,255,0.85)';

// MARK: - Activity tier fixed semantic colors (rb-rn-chat-message-line-restyle, design R30)
//
// `design/contract/claude-design-sync.md` R30 (2026-09-03) replaced the `.Join` / `.Purchase` / `.Win`
// activity-tier bubble fills — previously a black base with a `theme.accent`-tinted wash overlay (so
// the visual differentiation between tiers rode on the MERCHANT's theme color) — with three FIXED
// semantic colors, independent of `theme.accent`: coral-red for join, teal for purchase, red for win.
// `.Browse` (觀眾選購, no R30 design branch) and `.Intro` (RN-only extra tier, no R30 design branch)
// are UNTOUCHED and keep their pre-R30 black-base(+wash) formula (see `JOIN_BUBBLE_FILL` /
// `ACTIVITY_BUBBLE_BASE` above). Win's existing 1px accent border + faint accent glow are UNCHANGED —
// only the tier's own base fill moved off `theme.accent`.

/** `.Join`（進場）activity bubble fill — R30 fixed coral-red, replacing the pre-R30 black 0.32
 *  (`JOIN_BUBBLE_FILL`, now `.Browse`-only). */
const ACTIVITY_JOIN_FILL = 'rgba(232, 108, 108, 0.72)';
/** `.Purchase`（購買）activity bubble fill — R30 fixed teal, replacing the pre-R30 black 0.46 +
 *  accent 0.13 wash. */
const ACTIVITY_PURCHASE_FILL = 'rgba(45, 212, 191, 0.72)';
/** `.Win`（中獎）activity bubble fill — R30 fixed red, replacing the pre-R30 black 0.46 + accent 0.23
 *  wash. The existing accent border/glow (see `renderBubbleBackground`) are UNCHANGED. */
const ACTIVITY_WIN_FILL = 'rgba(240, 50, 70, 0.72)';

/**
 * The R30 fixed semantic fill for a tier's activity bubble, or `null` when the tier is OUT of R30's
 * scope (`.Browse` / `.Intro` — the design canvas has no branch for either, so callers keep their
 * pre-R30 black-base(+wash) rendering unchanged). Pure lookup, `export`ed for unit testing
 * (`docs/unit-test-discipline.md`). Mirrors iOS/Android/Flutter's parallel `rb-{platform}-chat-message-
 * line-restyle` siblings.
 */
export function activityFixedFill(tier: ActivityTier): string | null {
  switch (tier) {
    case ActivityTier.Join:
      return ACTIVITY_JOIN_FILL;
    case ActivityTier.Purchase:
      return ACTIVITY_PURCHASE_FILL;
    case ActivityTier.Win:
      return ACTIVITY_WIN_FILL;
    case ActivityTier.Browse:
    case ActivityTier.Intro:
      return null;
  }
}

/** Deterministic pastel avatar palette (moments.jsx demo avatar colors). */
const AVATAR_PALETTE = ['#FFD7A8', '#C8E6C9', '#A8C7FA', '#FFB4A8', '#E1BEE7'];

// MARK: - Layout tokens (lifted from moments.jsx)

/** Inter-row gap (`LBLiveChatStream` gap: 5). */
const ROW_GAP = 5;
/** Chat avatar 24×24 (updated `LBChatLine` — shared rail with activity slots; was 22). */
const AVATAR_SIZE = 24;
/** Chat / activity / event-join bubble radius 12. */
const BUBBLE_RADIUS = 12;
/** Activity icon slot 24×24 (updated `LBActivityLine` — shared rail with chat avatar; was 18). */
const ACTIVITY_SLOT = 24;
/** Inter-element gap on the chat / activity rows (`gap: 8`). */
const ROW_INNER_GAP = 8;

// MARK: - Feed icon-slot visibility (rb-rn-feed-avatar-icon-hide)
//
// Design re-sync R20 (`design/contract/claude-design-sync.md`, 2026-08-21/22): `moments.jsx`'s
// shared `ACT_SLOT` style constant flipped `display: 'flex'` → `display: 'none'`, with an explicit
// design comment marking it a reversible, temporary decision ("先隱藏 — 改回顯示把 display 換成
// 'flex'"). `ACT_SLOT` feeds FOUR call sites in this file: `ChatLineRow`'s viewer avatar,
// `HostChatRow`'s host/AI rail, `EventJoinLineRow`'s crown slot, and `ActivityLineRow`'s tier icon
// (the latter now only reachable via the sibling `ActivityToastView`, which reuses `ActivityLineRow`
// verbatim). All four therefore hide together.
//
// Mirrors the design's own technique (toggle `display`, don't delete the JSX): this single flag
// gates each icon block'S render (icon View + its trailing `ROW_INNER_GAP` spacer) at its assembly
// site, WITHOUT deleting any of the render logic itself (avatar color/glyph derivation, the crown /
// sparkle glyph rendering, `renderIconSlot`'s tier switch) — flipping this back to `true` restores
// the icon rail exactly as it stood before this change, with no other edits needed. When hidden, the
// row's remaining child (the bubble) becomes flush against the row's own start edge (no reserved
// icon width, no gap) because the icon + spacer are simply absent from the tree — NOT rendered
// transparent / zero-sized, matching `display: 'none'` semantics (removed from layout flow, not
// merely invisible).
const SHOW_FEED_ICON_SLOT = false;

// MARK: - Chat message line-height (rb-rn-chat-message-line-height)
//
// The merged chat / activity / event / pinned MESSAGE texts carry NO explicit `lineHeight`, so RN
// `Text` falls back to the font's natural (loose) line height → multi-line messages read too airy.
// Pin them to the design's chat line-height target with a SINGLE shared ratio so every message row
// stays consistent (no per-row drift). Mirrors Android `rb-android-chat-message-line-height`
// (commit `aca3740b`: `lineHeight = 14` on 11.5sp → `14 / 11.5 ≈ 1.22×`) and iOS `ChatFeedView.swift`
// (SF Pro, no `.lineSpacing()`, natural ~1.19–1.20×). `1.22` sits in the design's chat target
// (1.2–1.3×) and is `> 1.0` (the glyph ink extent), so it TIGHTENS the leading WITHOUT clipping.

/** Chat-feed message line-height ratio (relative to the text's own `fontSize`). See the section
 *  note above — the single source of truth so every message row derives a consistent line height. */
const CHAT_MESSAGE_LINE_HEIGHT_RATIO = 1.22;

/** Derive a chat-feed message `lineHeight` from its (already `theme.fontScale`-scaled) `fontSize`,
 *  so the line height tracks the font scale exactly like the fontSize and every wrapping message
 *  row (viewer / host / AI / pinned / event / activity) stays consistent — a single shared
 *  derivation, no per-row absolute-value drift. */
function chatMessageLineHeight(fontSize: number): number {
  return fontSize * CHAT_MESSAGE_LINE_HEIGHT_RATIO;
}

/** 立即參加 CTA label (rb-rn-chat-message-line-restyle, design R30 — was 加入活動). */
const JOIN_LABEL = '立即參加';
/** 已參加 joined-state label. */
const JOINED_LABEL = '已參加';
/** Fallback copy when an event-join `text` is empty (`LBEventJoinLine` default). */
const DEFAULT_EVENT_COPY = '🎉 抽獎開始！留言「抽獎」即可參加';

/** Props for the family-2 merged chat-feed (SUB-VIEW INPUT PATTERN). */
export interface ChatFeedProps {
  // -- 1. theme (FIRST, always) ----------------------------------------------
  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;

  // -- 2. bound snapshot value (BY VALUE from FeedWinModel) -------------------
  /** The merged, ordered, tail-retained (N=7) feed snapshot
   *  (`FeedWinModel.feedItems`). Already merged / ordered (oldest → newest = top →
   *  bottom) by the data layer — this surface renders it VERBATIM, never slicing /
   *  merging / re-sorting. `text` is backend-prebuilt — rows MUST NOT split it. */
  readonly items: readonly FeedItem[];

  // -- 3. optional action callback (LAST, defaulting to a no-op) -------------
  /** The「加入活動」intent for the (only) interactive `eventJoin` row. The container
   *  forwards this to the host (host → template `joinEvent(eid, keyword)` → core
   *  `requestEventJoin` + optimistic `feed.markJoined`). Omitted → the join CTA
   *  renders but is inert (demo / structural snapshot). THIS LAYER NEVER JOINS
   *  ITSELF — it only surfaces the tap. */
  readonly onJoin?: (eid: number, keyword: string) => void;

  // -- scroll-up-for-history variant (runtime, default false) ----------------
  /** `false` (demo / structural snapshot — DEFAULT) → the plain non-scrolling column
   *  (baseline byte-identical, no ScrollView). `true` (runtime) → a bounded-height
   *  `ScrollView` so the user can scroll UP to view history; the container then feeds
   *  the deeper `feedHistory`. Parity with iOS/Android `hostScrollable`. */
  readonly hostScrollable?: boolean;

  // -- pinned message (chat-message-taxonomy ⑤c) -----------------------------
  /** 置頂留言（`FeedWinModel.pinned` ← `template.pinnedMessage` ← `poll.top`）。非 null →
   *  feed 上緣渲染置頂橫幅；`null` / undefined（預設 / demo / snapshot）→ 不出像素（baseline
   *  byte-identical）。Parity iOS `ChatFeedView.pinned`. */
  readonly pinned?: PinnedMessage | null;

  // -- event-join host-bubble header (rb-rn-loading-announce-restyle) --------
  /** The host name shown in `EventJoinLineRow`'s host-bubble header (`FeedWinModel.hostName`
   *  ← `template.playerHeaderState.hostName`, the SAME single source `PlayerShellModel.hostName`
   *  reads). Omitted (component-level DEFAULT, e.g. a test constructing `ChatFeed` directly
   *  without routing through `FeedWinModel`) → falls back to an empty string (harmless — an
   *  empty `Text` node next to the 「主播」badge). Real usage always routes through
   *  `FeedWinView` → `FeedWinModel.hostName`. */
  readonly hostName?: string;
}

/** Fraction of the screen height the SCROLLABLE chat occupies (anchored bottom), so
 *  the upper area stays free for player gestures. Parity with iOS scrollableHeightFraction.
 *  Lowered 0.46 → 0.38 (rb-ios-chat-feed-lower-height / iOS bedf737 / Android 251513a) so the
 *  upper pass-through region grows ~54%→~62%, making swipe-to-switch-video easier to trigger.
 *  Scrollable variant only — the static / snapshot path is unaffected (baselines byte-identical). */
const SCROLLABLE_HEIGHT_FRACTION = 0.38;

/**
 * The family-2 merged chat-feed stream surface. Paints the bottom-anchored,
 * newest-at-bottom translucent feed over the video area as a plain non-scrolling
 * column, dispatching each {@link FeedItem} to its row renderer by `kind` and
 * themed by the resolved {@link ReferenceUITheme}.
 *
 * Follows the SUB-VIEW INPUT PATTERN: `theme` first, then the bound `items`
 * snapshot BY VALUE, then the optional host-wired `onJoin` (default no-op). Renders
 * correctly with `onJoin` omitted (the join CTA renders inert).
 */
export function ChatFeed(props: ChatFeedProps): ReactElement {
  const { theme, items, onJoin, hostScrollable, pinned, hostName = '' } = props;
  // `hostScrollable === true` (runtime) swaps in the scroll-up-for-history variant;
  // the default keeps the plain non-scrolling column so the structural snapshot has
  // NO ScrollView (baseline byte-identical). Parity with iOS/Android.
  return hostScrollable === true ? (
    <ScrollableChatFeed theme={theme} items={items} onJoin={onJoin} pinned={pinned} hostName={hostName} />
  ) : (
    <StaticChatFeed theme={theme} items={items} onJoin={onJoin} pinned={pinned} hostName={hostName} />
  );
}

/** The plain non-scrolling column (demo / snapshot baseline path — NO ScrollView). */
function StaticChatFeed(props: ChatFeedProps): ReactElement {
  const { theme, items, onJoin, pinned, hostName = '' } = props;
  const rows = items.filter(isChatFeedRow);
  return (
    <View testID={LBTestIDs.chatFeed} style={{ alignItems: 'flex-start' }}>
      {/* 置頂留言橫幅（chat-message-taxonomy ⑤c）覆於 feed 上緣。null → 不出像素（baseline 中性）。 */}
      {pinned != null ? <PinnedBanner theme={theme} pinned={pinned} /> : null}
      {rows.map((item, index) => (
        <View
          key={index}
          testID={chatLine(index)}
          style={{ marginTop: index === 0 ? 0 : ROW_GAP, alignSelf: 'flex-start', maxWidth: '100%' }}
        >
          {renderRow(theme, item, hostName, onJoin)}
        </View>
      ))}
    </View>
  );
}

/**
 * Scroll-up-for-history variant (runtime). Bounded to {@link SCROLLABLE_HEIGHT_FRACTION}
 * of the screen height (anchored bottom; content bottom-pinned via `justifyContent:
 * 'flex-end'`), sticks to the newest row unless the user scrolled up, with a
 * "↓ 最新訊息" pill to return. The container feeds the deeper `feedHistory` here.
 * Parity with iOS `scrollableBody` + `rb-ios-chat-feed-scroll-bounded-height`.
 */
function ScrollableChatFeed(props: ChatFeedProps): ReactElement {
  const { theme, items, onJoin, pinned, hostName = '' } = props;
  const rows = items.filter(isChatFeedRow);
  const ref = useRef<ScrollView>(null);
  const atBottomRef = useRef(true);
  const [showPill, setShowPill] = useState(false);
  const maxHeight = Dimensions.get('window').height * SCROLLABLE_HEIGHT_FRACTION;

  // New rows: stick to newest UNLESS the user scrolled up. Depends on the RENDERED row count
  // (`rows.length`, activity-excluded) — an activity-only push (now toast-only) MUST NOT trigger
  // a no-op scroll here.
  useEffect(() => {
    if (atBottomRef.current) ref.current?.scrollToEnd({ animated: true });
  }, [rows.length]);

  // Feed cleared (VIDEO_SWITCH empties the merged feed → rows non-empty → empty): reset
  // auto-stick so the NEXT video starts pinned to newest and the "↓ 最新訊息" pill hides — the
  // ScrollView / showPill state is NOT recreated across switches. Parity iOS rb-ios-chat-feed-
  // pill-reset-on-switch. Guarded on empty so normal playback is undisturbed.
  useEffect(() => {
    if (rows.length === 0) {
      atBottomRef.current = true;
      setShowPill(false);
      ref.current?.scrollToEnd({ animated: false });
    }
  }, [rows.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const atBottom = distanceFromBottom <= 4;
    atBottomRef.current = atBottom;
    setShowPill(!atBottom);
  };

  const returnToLatest = (): void => {
    atBottomRef.current = true;
    setShowPill(false);
    ref.current?.scrollToEnd({ animated: true });
  };

  return (
    <View style={{ maxHeight }}>
      {/* 置頂留言橫幅（chat-message-taxonomy ⑤c）固定於可捲動 feed 上緣。null → 不出像素。 */}
      {pinned != null ? <PinnedBanner theme={theme} pinned={pinned} /> : null}
      <ScrollView
        ref={ref}
        testID={LBTestIDs.chatFeed}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', alignItems: 'flex-start' }}
      >
        {rows.map((item, index) => (
          <View
            key={index}
            testID={chatLine(index)}
            style={{ marginTop: index === 0 ? 0 : ROW_GAP, alignSelf: 'flex-start', maxWidth: '100%' }}
          >
            {renderRow(theme, item, hostName, onJoin)}
          </View>
        ))}
      </ScrollView>
      {showPill ? (
        <Pressable
          onPress={returnToLatest}
          testID={LBTestIDs.chatScrollToBottom}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 6,
            backgroundColor: theme.accent,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: ON_GLASS, fontSize: 11.5 * theme.fontScale, fontWeight: '600' }}>
            ↓ 最新訊息
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// MARK: - Row dispatch by FeedItem.kind (D-2)

/** A feed row this chat feed still renders — everything EXCEPT `'activity'` (rb-rn-activity-toast:
 *  those surface exclusively via the sibling `ActivityToastView`, see the file-header note). Pure
 *  type-guard predicate — exported for unit testing (`docs/unit-test-discipline.md`). Parity
 *  moments.jsx `LBLiveChatStream`'s `items.filter(m => m.kind !== 'activity')`. */
export function isChatFeedRow(item: FeedItem): item is Exclude<FeedItem, { kind: 'activity' }> {
  return item.kind !== 'activity';
}

/** Dispatch a (non-activity) feed item to its row renderer by `kind`. */
function renderRow(
  theme: ReferenceUITheme,
  item: Exclude<FeedItem, { kind: 'activity' }>,
  hostName: string,
  onJoin?: (eid: number, keyword: string) => void,
): ReactElement | null {
  switch (item.kind) {
    case 'chat':
      return (
        <ChatLineRow
          theme={theme}
          text={item.text}
          userName={item.userName}
          isHost={item.isHost}
          isAI={item.isAI}
          replyText={item.replyText}
        />
      );
    case 'eventJoin':
      return (
        <EventJoinLineRow
          theme={theme}
          text={item.text}
          joined={item.joined}
          hostName={hostName}
          // 後端「ek isset 才顯示 CTA」契約：keyword 非空 → 畫加入活動 CTA；空（活動結束 / 純公告）→
          // 只留 header + 文案（event-join-cta gating，對齊 iOS/Android hasCTA）。
          hasCTA={item.keyword.length > 0}
          // Surface the tap; forward via the container's `onJoin`. Omitted → inert.
          // This layer NEVER joins itself.
          onTap={() => onJoin?.(item.eid, item.keyword)}
        />
      );
    case 'productSale':
      // onsale（商品開賣）已改走 host 主播聊天氣泡（DefaultTemplate `appendChat(isHost:true)`），
      // `productSale` feed item 零 production 產生，商品開賣卡（`ProductSaleCardRow`）為死碼、已移除。
      // 保留此顯式 no-op case 維持 switch 對 `FeedItem` union 的窮盡涵蓋（型別本體仍在 template，
      // 完整移除需跨層 change）。MUST NOT 加 `default:`。
      return null;
  }
}

// MARK: - ChatLineRow — single chat row (LBChatLine)
//
// Mirrors `moments.jsx` `LBChatLine`: a 22px round name-colored avatar + a
// translucent dark bubble (radius 12). The REAL RN `'chat'` feed item carries only
// a single backend-prebuilt `text` string (no separate user / avatar fields exist
// on `ChatFeedItem` — those live only in the design's web demo). We therefore put
// the whole `text` in the bubble (NOT split) and derive a DETERMINISTIC avatar fill
// + glyph from the text so the row keeps the design's name-colored avatar language
// without parsing fields (parity with iOS `LBChatLineRow`).

function ChatLineRow(props: {
  theme: ReferenceUITheme;
  text: string;
  /** The chat author's nickname (chat-nickname-render). Empty / undefined → text-only row,
   *  BYTE-IDENTICAL to the pre-nickname layout (avatar keyed by `text`, no inline prefix).
   *  Non-empty → a dimmed inline prefix INSIDE the bubble + the avatar keyed by the nickname
   *  (so one author = one stable avatar). Parity iOS `LBChatLineRow.userName`. */
  userName?: string;
  // chat-message-taxonomy ⑤c — 角色版型（皆預設 → 走既有觀眾留言路徑，byte-identical）。
  isHost?: boolean;
  isAI?: boolean;
  replyText?: string;
}): ReactElement {
  const { theme, text, userName, isHost = false, isAI = false, replyText } = props;
  // 群組① 真正的聊天：有角色 metadata → 角色版型（主播標 / 引用框 / AI 標）；皆 false → 觀眾留言
  // （以下既有路徑，byte-identical）。Parity iOS `LBChatLineRow.hasRole`.
  const hasRole = isHost || isAI || (typeof replyText === 'string' && replyText.length > 0);
  if (hasRole) {
    return (
      <HostChatRow
        theme={theme}
        text={text}
        userName={userName}
        isHost={isHost}
        isAI={isAI}
        replyText={replyText}
      />
    );
  }
  // Avatar derivation key: the nickname when present, else `text` (legacy). Parity iOS `avatarKey`.
  const hasName = typeof userName === 'string' && userName.length > 0;
  const avatarKey = hasName ? userName! : text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {/* Name-colored avatar (24×24 round — shared rail with activity slots) —
          deterministic from the nickname (or `text` when none). Dark glyph (`#3a2e25`)
          reads on the pastel demo avatars, matching the updated `LBChatLine` ACT_SLOT.
          rb-rn-feed-avatar-icon-hide: gated by SHOW_FEED_ICON_SLOT (design ACT_SLOT
          display:none) — render logic kept intact for reversibility, just not assembled
          into the row while hidden. */}
      {SHOW_FEED_ICON_SLOT ? (
        <>
          <View
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: AVATAR_SIZE / 2,
              backgroundColor: avatarColor(avatarKey),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: AVATAR_GLYPH_COLOR, fontSize: 10 * theme.fontScale, fontWeight: 'bold' }}>
              {avatarGlyph(avatarKey)}
            </Text>
          </View>
          <View style={{ width: ROW_INNER_GAP }} />
        </>
      ) : null}
      {/* Translucent dark bubble carrying the FULL backend-prebuilt text (NOT split). When a
          nickname is present it leads with a dimmed INLINE prefix INSIDE the bubble (design
          `LBChatLine` viewer path, rb-rn-chat-message-colon-separator:
          `<span opacity .66 weight 600>{user}：</span><span>{text}</span>` — nickname + a
          full-width colon separator, same line, one bubble). No nickname → just the message
          (byte-identical legacy bubble). ACT_BUBBLE: radius 12, black 0.42, padding h11/v5. */}
      <View
        style={{
          flexShrink: 1,
          backgroundColor: BUBBLE_FILL,
          borderRadius: BUBBLE_RADIUS,
          paddingHorizontal: 11,
          paddingVertical: 5,
        }}
      >
        <Text
          numberOfLines={2}
          style={{
            color: ON_GLASS,
            fontSize: 11.5 * theme.fontScale,
            lineHeight: chatMessageLineHeight(11.5 * theme.fontScale),
            fontWeight: 'normal',
          }}
        >
          {hasName ? (
            // Dimmed inline nickname prefix + a full-width colon separator (rb-rn-chat-message-
            // colon-separator, design `LBChatLine` viewer path: `{m.user}{!isHost && '：'}`,
            // marginRight now 0 — the colon itself is the visual separator, no trailing-space
            // gap), then the message body (backend-prebuilt text, NOT name-embedded). No
            // nickname → the bare `text` string is the SOLE child, so the pre-nickname bubble
            // stays byte-identical. Role rows (HostChatRow) are a separate function and are NOT
            // affected by this separator.
            <>
              <Text style={{ color: ON_GLASS_DIM, fontWeight: '600' }}>{`${userName!}：`}</Text>
              {text}
            </>
          ) : (
            text
          )}
        </Text>
      </View>
    </View>
  );
}

// MARK: - HostChatRow — 角色版型聊天列 (chat-message-taxonomy ⑤c)
//
// 群組① 真正的聊天：主播留言 / 主播回覆 / AI 回覆，以**版型**而非顏色區分（parity iOS
// `LBChatLineRow` hasRole 分支）。24px accent 圖示軌（host = 👑 crown、AI = ✨ sparkles）+
// 中性深色氣泡（header 名牌 + 回覆引用框 + 訊息本文）。RN 沿用本檔 emoji-glyph 慣例（同 activity
// 軌 🛍/📣/🏆、event ✨）。引用框只顯引用文字（後端無引用者名稱）。
//
// rb-rn-chat-message-line-restyle (design R30, `design/contract/claude-design-sync.md`,
// 2026-09-03) restyled the header: the bubble no longer染整片 `theme.accent`（改用與觀眾留言
// 相同的中性深色 `BUBBLE_FILL`）；主播暱稱本身改成 accent 色底名牌（`roleTag(theme, userName,
// true)`，內容＝暱稱本人），**取代**原本「名字文字 + 獨立『主播』實心標」兩個並排元素與固定字串
// 「主播」；AI 外框標（`roleTag(theme, 'AI', false)`）不變、與 host 名牌並存；非主播的角色列
// （`hasRole===true && isHost===false`，例如僅帶 `replyText` 的少見組合）暱稱顏色改固定
// `#FBB0B7`（粉色，取代原 `ON_GLASS`）；名字 / 名牌後方統一補一個冒號「：」（不論 `isHost`，只要
// `hasName` 即渲染——R30 把冒號從「只有觀眾留言有」擴大成「所有訊息都有」，parity `ChatLineRow`
// 觀眾路徑既有的冒號慣例，但走獨立的 `<Text>` 節點而非同一個字串內聯拼接）。

/** 非主播角色列（`hasRole===true && isHost===false`）暱稱顏色 — R30 固定粉色，取代原 `ON_GLASS`
 *  （中性深色氣泡上仍可辨識）。 */
const HOST_ROW_NON_HOST_NAME_COLOR = '#FBB0B7';
/** 回覆引用框底 `rgba(0,0,0,0.30)` + 左側 accent 直條。 */
const QUOTE_FILL = 'rgba(0,0,0,0.30)';

function HostChatRow(props: {
  theme: ReferenceUITheme;
  text: string;
  userName?: string;
  isHost: boolean;
  isAI: boolean;
  replyText?: string;
}): ReactElement {
  const { theme, text, userName, isHost, isAI, replyText } = props;
  const hasName = typeof userName === 'string' && userName.length > 0;
  const hasReply = typeof replyText === 'string' && replyText.length > 0;
  // AI glyph 優先（AI 回覆疊在主播回覆版型上）；否則 host crown。
  const railGlyph = isAI ? '✨' : '👑';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {/* 24px accent 圖示軌（主播 crown / AI sparkles），取代觀眾的名字色頭像。
          rb-rn-feed-avatar-icon-hide: gated by SHOW_FEED_ICON_SLOT — render logic kept
          intact for reversibility, just not assembled while hidden. */}
      {SHOW_FEED_ICON_SLOT ? (
        <>
          <View
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: AVATAR_SIZE / 2,
              backgroundColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: ON_GLASS, fontSize: 12 }}>{railGlyph}</Text>
          </View>
          <View style={{ width: ROW_INNER_GAP }} />
        </>
      ) : null}
      {/* 中性深色氣泡（rb-rn-chat-message-line-restyle, R30 — 不再整片染 theme.accent，改用與觀眾
          留言相同的 BUBBLE_FILL）。 */}
      <View style={{ flexShrink: 1 }}>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: BUBBLE_RADIUS, backgroundColor: BUBBLE_FILL }}
        />
        <View style={{ paddingHorizontal: 11, paddingVertical: 6 }}>
          {/* header：主播＝accent 色底名牌（暱稱本人，取代固定字串「主播」）／非主播＝固定粉色暱稱
              文字，AI 外框標獨立並存；名字 / 名牌後統一補冒號「：」（R30）。 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: hasReply ? 4 : 2 }}>
            {hasName ? (
              isHost ? (
                roleTag(theme, userName!, true)
              ) : (
                <Text style={{ color: HOST_ROW_NON_HOST_NAME_COLOR, fontSize: 10.5 * theme.fontScale, fontWeight: '600' }}>
                  {userName!}
                </Text>
              )
            ) : null}
            {hasName && isAI ? <View style={{ width: 5 }} /> : null}
            {isAI ? roleTag(theme, 'AI', false) : null}
            {hasName ? (
              <Text style={{ color: ON_GLASS, fontSize: 10.5 * theme.fontScale, fontWeight: '600' }}>
                ：
              </Text>
            ) : null}
          </View>
          {/* 引用框（主播回覆 / AI 回覆）：左側 accent 直條 + 暗底，只顯引用文字。 */}
          {hasReply ? (
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: QUOTE_FILL,
                borderRadius: 6,
                marginBottom: 4,
                overflow: 'hidden',
              }}
            >
              <View style={{ width: 3, backgroundColor: theme.accent }} />
              <Text
                numberOfLines={2}
                style={{ color: ON_GLASS_DIM, fontSize: 10.5 * theme.fontScale, paddingHorizontal: 6, paddingVertical: 3, flexShrink: 1 }}
              >
                {replyText}
              </Text>
            </View>
          ) : null}
          {/* 訊息本文（backend-prebuilt，NOT split）。 */}
          <Text
            numberOfLines={3}
            style={{
              color: ON_GLASS,
              fontSize: 11.5 * theme.fontScale,
              lineHeight: chatMessageLineHeight(11.5 * theme.fontScale),
            }}
          >
            {text}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** 角色標：`主播`（accent 實心 + 白字）/ `AI`（accent 外框 + accent 字）。Parity iOS `roleTag`. */
function roleTag(theme: ReferenceUITheme, label: string, solid: boolean): ReactElement {
  return (
    <View
      style={{
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 1,
        backgroundColor: solid ? theme.accent : 'transparent',
        borderWidth: solid ? 0 : 1,
        borderColor: theme.accent,
      }}
    >
      <Text style={{ color: solid ? ON_GLASS : theme.accent, fontSize: 9 * theme.fontScale, fontWeight: 'bold' }}>
        {label}
      </Text>
    </View>
  );
}

// MARK: - PinnedBanner — 置頂留言橫幅 (chat-pinned-message-render ⑤c)
//
// Parity iOS `PinnedMessageBanner`：pin 標 + 名前綴（comment 且 name 非空 →「{name}：」、host →
// 無前綴）+ 置頂文字，圓角暗底橫幅，固定於 feed 上緣。RN 沿用 emoji-glyph 慣例（📌）。

/** 置頂橫幅底 `rgba(0,0,0,0.55)`（parity iOS black 0.55）。 */
const PINNED_FILL = 'rgba(0,0,0,0.55)';

function PinnedBanner(props: { theme: ReferenceUITheme; pinned: PinnedMessage }): ReactElement {
  const { theme, pinned } = props;
  const namePrefix = pinned.kind === 'comment' && pinned.name.length > 0 ? `${pinned.name}：` : '';
  return (
    <View
      testID={LBTestIDs.pinnedBanner}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: PINNED_FILL,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: ROW_GAP,
        maxWidth: '100%',
      }}
    >
      <Text style={{ color: theme.accent, fontSize: 10, fontWeight: 'bold', marginTop: 1 }}>📌</Text>
      <View style={{ width: 6 }} />
      <Text
        numberOfLines={2}
        style={{
          color: ON_GLASS,
          fontSize: 12 * theme.fontScale,
          lineHeight: chatMessageLineHeight(12 * theme.fontScale),
          fontWeight: '500',
          flexShrink: 1,
        }}
      >
        <Text style={{ fontWeight: 'bold' }}>{namePrefix}</Text>
        {pinned.text}
      </Text>
    </View>
  );
}

// MARK: - EventJoinLineRow — event-join row (LBEventJoinLine, host-bubble restyle)
//
// Mirrors the UPDATED `moments.jsx` `LBEventJoinLine` (design re-sync `c3c98733`,
// rb-rn-loading-announce-restyle): 版型與「主播留言」一致 (a 24×24 round accent SLOT OUTSIDE the
// bubble — crown icon, SAME icon as `HostChatRow`'s non-AI rail glyph, NOT sparkle — then an
// accent SOLID-FILL bubble, radius 12, no wash / no border) wrapping a host-bubble HEADER
// (`hostName` name badge + colon) + the 2-line keyword copy + a 立即參加 CTA / 已參加 chip that now
// sits on ITS OWN ROW BELOW the copy (was: trailing, same row). The ONLY interactive row — its
// tap is FORWARDED via `onTap` (host-wired); this layer never joins itself.
//
// rb-rn-chat-message-line-restyle (design R30, `design/contract/claude-design-sync.md`,
// 2026-09-03): the header's `hostName` text + separate white-pill 「主播」badge MERGE into a
// single `roleTag(theme, hostName, true)` accent-solid name badge (same treatment as
// `HostChatRow`'s host name). The bubble fill ITSELF also changes: verified against the
// authoritative source `design/templates/minimal/moments.jsx:634` —
// `<span style={{ ...ACT_BUBBLE, display: 'inline-block', maxWidth: '100%' }}>` carries NO
// `background: accent` override, so `ACT_BUBBLE`'s neutral `rgba(0,0,0,0.42)` fill applies, matching
// `HostChatRow`/`ChatLineRow`'s post-restyle neutral bubble exactly. (Earlier revisions of this
// change kept the bubble accent-solid, reasoning it mirrored a sibling iOS decision — that premise
// was wrong: the iOS ambiguity was an unresolved open question in the iOS agent's own report, not a
// ratified decision, and has since been corrected to neutral too.) The accent name badge now sits on
// a neutral bubble — same contrast as `HostChatRow`'s name badge, no more badge-blends-into-bubble
// concern. Followed by a colon `：`. The un-joined CTA swaps back to an accent-fill / white-text
// FULL-WIDTH pill reading 立即參加 (was a white-fill / accent-text, content-width pill reading
// 加入活動) — see `renderEventJoinCTA`.

/** 「已參加」chip's bumped opacities (design re-sync `c3c98733`: 白 0.16→0.2 / 白 0.72→0.82).
 *  Locally-scoped to this row — deliberately NOT reusing the file's shared `ON_GLASS_DIM`
 *  (used elsewhere by `ChatLineRow` / `HostChatRow` at the older 0.72) so this bump can never
 *  leak into those other call sites. */
const EVENT_JOINED_CHIP_FILL = 'rgba(255,255,255,0.2)';
const EVENT_JOINED_CHIP_TEXT = 'rgba(255,255,255,0.82)';

function EventJoinLineRow(props: {
  theme: ReferenceUITheme;
  text: string;
  joined: boolean;
  hasCTA: boolean;
  /** Host-bubble header name (`FeedWinModel.hostName`). Empty → header renders an empty-content
   *  accent name badge + colon (harmless, only reachable via a direct `ChatFeed` test construction
   *  that omits `hostName`; real usage always supplies it). */
  hostName: string;
  onTap: () => void;
}): ReactElement {
  const { theme, text, joined, hasCTA, hostName, onTap } = props;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {/* 24×24 round accent slot — OUTSIDE the bubble, crown icon (same as HostChatRow's host
          rail glyph — the design's own slot SVG path is byte-identical to the host crown path,
          confirming this is the host avatar-circle language, not a standalone sparkle icon).
          rb-rn-feed-avatar-icon-hide: gated by SHOW_FEED_ICON_SLOT — render logic kept intact
          for reversibility, just not assembled while hidden. */}
      {SHOW_FEED_ICON_SLOT ? (
        <>
          <View
            style={{
              width: ACTIVITY_SLOT,
              height: ACTIVITY_SLOT,
              borderRadius: ACTIVITY_SLOT / 2,
              backgroundColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: ON_GLASS, fontSize: 12 }}>👑</Text>
          </View>
          <View style={{ width: ROW_INNER_GAP }} />
        </>
      ) : null}
      {/* Neutral-fill bubble (radius 12, no wash layers, no border — matches HostChatRow /
          ChatLineRow's post-R30 neutral bubble; rb-rn-chat-message-line-restyle, R30, verified
          against `design/templates/minimal/moments.jsx:634`'s `ACT_BUBBLE` with no accent
          override) wrapping the header + copy + CTA (CTA now below, own row). */}
      <View
        style={{
          flexShrink: 1,
          backgroundColor: BUBBLE_FILL,
          borderRadius: BUBBLE_RADIUS,
          paddingHorizontal: 11,
          paddingVertical: 5,
        }}
      >
        {/* Header: hostName accent name badge + colon — mirrors HostChatRow's header row language
            (rb-rn-chat-message-line-restyle, R30 — merges the old hostName text + separate 「主播」
            badge into one `roleTag()` name badge). */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          {roleTag(theme, hostName, true)}
          <Text style={{ color: ON_GLASS, fontSize: 10.5 * theme.fontScale, fontWeight: '600' }}>
            ：
          </Text>
        </View>
        {/* 2-line keyword copy (full prebuilt text, NOT split). No width cap (the CTA moved below,
            so the copy can use the bubble's full available width — was maxWidth 132). */}
        <Text
          numberOfLines={2}
          style={{
            color: ON_GLASS,
            fontSize: 11.5 * theme.fontScale,
            lineHeight: chatMessageLineHeight(11.5 * theme.fontScale),
            fontWeight: '600',
          }}
        >
          {text.length === 0 ? DEFAULT_EVENT_COPY : text}
        </Text>
        {/* event-join-cta gating (UNCHANGED logic): keyword 空（hasCTA === false）→ 不畫 CTA /
            已參加 chip（純活動公告，只留 header + 文案）。 */}
        {!hasCTA ? null : renderEventJoinCTA(theme, joined, onTap)}
      </View>
    </View>
  );
}

/** Trailing CTA — now its OWN ROW below the copy (`marginTop: 7`, was: trailing on the same row).
 *  立即參加 (rb-rn-chat-message-line-restyle, R30 — was 加入活動): accent fill + white text,
 *  full-width pill (colors swapped back from the pre-R30 white-fill/accent-text, content-width
 *  pill; see `rb-rn-loading-announce-restyle` for that older state).
 *  已參加: translucent white chip at the bumped {@link EVENT_JOINED_CHIP_FILL} /
 *  {@link EVENT_JOINED_CHIP_TEXT} opacities (unchanged by R30). */
function renderEventJoinCTA(theme: ReferenceUITheme, joined: boolean, onTap: () => void): ReactElement {
  return (
    <View style={{ marginTop: 7, flexDirection: 'row' }}>
      {joined ? (
        <View
          testID={LBTestIDs.eventJoinJoined}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: EVENT_JOINED_CHIP_FILL,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <Text style={{ color: EVENT_JOINED_CHIP_TEXT, fontSize: 11 * theme.fontScale, fontWeight: '900' }}>
            ✓
          </Text>
          <View style={{ width: 4 }} />
          <Text style={{ color: EVENT_JOINED_CHIP_TEXT, fontSize: 11.5 * theme.fontScale, fontWeight: 'bold' }}>
            {JOINED_LABEL}
          </Text>
        </View>
      ) : (
        <Pressable onPress={onTap} testID={LBTestIDs.eventJoinCta} style={{ width: '100%' }}>
          <View
            style={{
              backgroundColor: theme.accent,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 6,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: ON_GLASS, fontSize: 12 * theme.fontScale, fontWeight: '800' }}>
              {JOIN_LABEL}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

// MARK: - ActivityLineRow — tier-styled activity row (LBActivityLine)
//
// Mirrors the UPDATED `moments.jsx` `LBActivityLine`: every row shares ONE unified
// language — a 24×24 round icon SLOT + a rounded-12 bubble — and tiers differ by icon + weight
// (emphasis ASCENDING) + bubble fill:
//   • Join     — 進場: lowest-key. slot 白 0.16 / person-add icon 白 0.85; bubble FIXED coral-red
//                `rgba(232, 108, 108, 0.72)` (rb-rn-chat-message-line-restyle, design R30 — was
//                black 0.32, no accent), text 白 0.9, medium (500).
//   • Purchase — 購買: slot accent / white bag icon; bubble FIXED teal `rgba(45, 212, 191, 0.72)`
//                (design R30 — was black 0.46 + accent 0.13 wash), medium (500).
//   • Intro    — 介紹: slot accent / white megaphone icon; bubble 黑 0.46 + accent 0.18
//                wash (UNCHANGED by R30 — RN-only extra tier, no design canvas branch), medium
//                (500) (商品開始介紹 — 強調介於購買與中獎之間).
//   • Win      — 中獎: slot accent / white trophy icon; bubble FIXED red `rgba(240, 50, 70, 0.72)`
//                (design R30 — was black 0.46 + accent 0.23 wash) + 1px accent 0.4 border + faint
//                accent 0.2 glow (border/glow UNCHANGED by R30, still accent-derived), bold (700).
//                NO 🎉.
//   • Browse   — 觀眾選購: slot 白 0.16 (same as join) / magnifier icon; bubble 黑 0.3, no accent
//                (UNCHANGED by R30 — the design canvas has no browse branch), text 白 0.9,
//                medium (500).
//
// R30 (rb-rn-chat-message-line-restyle, `design/contract/claude-design-sync.md`, 2026-09-03)
// replaced the join/purchase/win bubble fills with FIXED semantic colors — see `activityFixedFill()`
// and the constants above — independent of `theme.accent`, so merchant theming no longer changes
// these three tiers' visual differentiation. Intro/browse's PRE-R30 accent wash formula
// (`linear-gradient(accentXX,accentXX)` over `rgba(0,0,0,0.46)` = a flat accent overlay (alpha XX)
// on a 0.46 black base) is UNCHANGED and still modelled here as a black-base bubble with a second
// absolutely-filled accent overlay View at the wash alpha. RN has no gradient / shadow primitive
// without a native dep — the faint win glow is approximated with a same-shape accent-0.2 backing
// View; true fidelity stays anchored to the iOS / Android / Flutter PNG baselines.
//
// `export`ed (rb-rn-activity-toast) so the sibling `ActivityToastView` can reuse this exact row
// renderer for the single latest activity item it flashes above the feed — the pill's own visual
// (slot / bubble / tier styling) is UNCHANGED, only WHERE it is mounted moved.

export function ActivityLineRow(props: {
  theme: ReferenceUITheme;
  text: string;
  tier: ActivityTier;
}): ReactElement {
  const { theme, text, tier } = props;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* rb-rn-feed-avatar-icon-hide: gated by SHOW_FEED_ICON_SLOT — render logic
          (`renderIconSlot`) kept intact for reversibility, just not assembled while hidden.
          This row is now only reachable via the sibling ActivityToastView (see file header). */}
      {SHOW_FEED_ICON_SLOT ? (
        <>
          {renderIconSlot(theme, tier)}
          <View style={{ width: ROW_INNER_GAP }} />
        </>
      ) : null}
      {/* Rounded-12 bubble carrying the prebuilt text, accent-washed by tier. */}
      <View style={{ flexShrink: 1 }}>
        {renderBubbleBackground(theme, tier)}
        <Text
          numberOfLines={2}
          style={{
            color:
              tier === ActivityTier.Join || tier === ActivityTier.Browse
                ? ON_GLASS_JOIN_TEXT
                : ON_GLASS,
            fontSize: 11.5 * theme.fontScale,
            lineHeight: chatMessageLineHeight(11.5 * theme.fontScale),
            fontWeight: textWeight(tier),
            paddingHorizontal: 11,
            paddingVertical: 5,
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

/** 24×24 round icon slot (shared rail with the chat avatar). Slot fill + icon tint by
 *  tier: Join = white 0.16 slot / white 0.85 person-add; purchase/intro/win = accent slot
 *  / white bag / megaphone / trophy. RN has no svg — the icon is a deterministic Text glyph
 *  (parity to iOS SF Symbols / Android vector glyphs / Flutter Icons). */
function renderIconSlot(theme: ReferenceUITheme, tier: ActivityTier): ReactElement {
  let fill: string;
  let glyph: string;
  let glyphColor: string;
  switch (tier) {
    case ActivityTier.Join:
      fill = JOIN_SLOT_FILL;
      glyph = '👤'; // person.fill.badge.plus
      glyphColor = JOIN_GLYPH_COLOR;
      break;
    case ActivityTier.Browse:
      // 觀眾選購（chat-message-taxonomy ⑤）— 最低調，同 join 的 slot；放大鏡圖示（mirror iOS
      // `magnifyingglass`）。
      fill = JOIN_SLOT_FILL;
      glyph = '🔍'; // magnifyingglass
      glyphColor = JOIN_GLYPH_COLOR;
      break;
    case ActivityTier.Purchase:
      fill = theme.accent;
      glyph = '🛍'; // bag.fill
      glyphColor = ON_GLASS;
      break;
    case ActivityTier.Intro:
      fill = theme.accent;
      glyph = '📣'; // megaphone.fill / loudspeaker
      glyphColor = ON_GLASS;
      break;
    case ActivityTier.Win:
      fill = theme.accent;
      glyph = '🏆'; // trophy.fill
      glyphColor = ON_GLASS;
      break;
  }
  return (
    <View
      style={{
        width: ACTIVITY_SLOT,
        height: ACTIVITY_SLOT,
        borderRadius: ACTIVITY_SLOT / 2,
        backgroundColor: fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {tier === ActivityTier.Purchase ? (
        <BagGlyph color={glyphColor} size={14} />
      ) : (
        <Text style={{ color: glyphColor, fontSize: 12 }}>{glyph}</Text>
      )}
    </View>
  );
}

/** The rounded-12 activity bubble background, drawn as absolutely-filled layer(s) behind the text.
 *  R30 (rb-rn-chat-message-line-restyle) split this into two families:
 *  - **`.Join` / `.Purchase` / `.Win`** (`activityFixedFill(tier)` non-null) — a single FIXED semantic
 *    color fill (see the constants above), independent of `theme.accent`. `.Win` additionally keeps
 *    its pre-R30 1px accent 0.4 border + faint accent 0.2 backing glow (still derived from
 *    `theme.accent` — only the tier's own base fill moved off it).
 *  - **`.Browse` / `.Intro`** (`activityFixedFill(tier) === null`, out of R30's scope — the design
 *    canvas has no branch for either) — UNCHANGED pre-R30 formula: `.Browse` = black 0.32 (no wash);
 *    `.Intro` = black 0.46 base + an accent 0.18 overlay wash (accent alphas encoded as 8-digit hex
 *    suffixes, the reference-ui convention, e.g. `theme.accent + '2E'`). */
function renderBubbleBackground(theme: ReferenceUITheme, tier: ActivityTier): ReactElement {
  const fill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
  const shape = { borderRadius: BUBBLE_RADIUS };
  const fixedFill = activityFixedFill(tier);
  if (fixedFill !== null) {
    // R30 fixed semantic color (join/purchase/win) — solid, no accent-derived base/wash layers.
    return (
      <>
        {tier === ActivityTier.Win ? (
          // Faint accent 0.2 glow halo behind the bubble (approximates the iOS accent 0.2 shadow) —
          // UNCHANGED by R30, still derived from theme.accent.
          <View pointerEvents="none" style={{ ...fill, ...shape, backgroundColor: theme.accent + '33' }} />
        ) : null}
        <View pointerEvents="none" style={{ ...fill, ...shape, backgroundColor: fixedFill }} />
        {tier === ActivityTier.Win ? (
          // 1px accent 0.4 ('66') hairline border — UNCHANGED by R30, still derived from theme.accent.
          <View
            pointerEvents="none"
            style={{ ...fill, ...shape, borderWidth: 1, borderColor: theme.accent + '66' }}
          />
        ) : null}
      </>
    );
  }
  if (tier === ActivityTier.Browse) {
    // 觀眾選購（browse，chat-message-taxonomy ⑤）— black 0.32, no accent wash (最低調). Not in R30's
    // scope (the design canvas has no browse branch) — pre-R30 formula unchanged.
    return <View pointerEvents="none" style={{ ...fill, ...shape, backgroundColor: JOIN_BUBBLE_FILL }} />;
  }
  // .Intro (RN-only extra tier, no R30 design branch) — black 0.46 base + accent 0.18 wash ('2E').
  // Not in R30's scope — pre-R30 formula unchanged.
  return (
    <>
      <View pointerEvents="none" style={{ ...fill, ...shape, backgroundColor: ACTIVITY_BUBBLE_BASE }} />
      <View pointerEvents="none" style={{ ...fill, ...shape, backgroundColor: theme.accent + '2E' }} />
    </>
  );
}

/** Tier-ascending font weight (join / purchase / intro = medium (500); win = bold (700)). */
function textWeight(tier: ActivityTier): '500' | '700' {
  return tier === ActivityTier.Win ? '700' : '500';
}

// MARK: - Pure helpers (deterministic avatar)

/**
 * Deterministic avatar fill from the chat `text` (one of the design's pastel demo
 * avatar colors, `moments.jsx`), chosen by a stable FNV-1a hash so the same string
 * always maps to the same color (no field parsing, no per-process seed → stable
 * structural baseline). Mirrors iOS `LBChatLineRow.avatarColor` / Android /
 * Flutter `avatarColor`.
 */
export function avatarColor(text: string): string {
  // Mask off the sign bit (never `Math.abs` of an arbitrary int) so the index is
  // always non-negative for any host string.
  const idx = (stableHash(text) & 0x7fffffff) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx]!;
}

/** First grapheme of the text as the avatar glyph (presentation-only). Mirrors iOS
 *  `avatarGlyph` / Android / Flutter `avatarGlyph`. */
export function avatarGlyph(text: string): string {
  if (text.length === 0) return '·';
  return text.slice(0, 1).toUpperCase();
}

/**
 * A small, stable, platform-independent hash (FNV-1a over the UTF-8-ish code units)
 * so the avatar color is deterministic across runs / architectures (JS string
 * hashing is not built-in; this mirrors the iOS / Android / Flutter FNV-1a so the
 * SAME string maps to the SAME palette index on all four platforms). Computed in
 * 32-bit space (`Math.imul`) — the masked low bits match the other platforms' low
 * bits for the small palette index.
 */
export function stableHash(s: string): number {
  // FNV-1a 32-bit (offset 2166136261, prime 16777619) via `Math.imul` so the
  // multiply stays in 32-bit two's-complement, matching the low bits the other
  // platforms' 64-bit FNV-1a truncates to for `% 5`.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
