// ActivityToastView — family-2 「炒氣氛提示」toast (RN, rb-rn-activity-toast).
//
// Spec: `reference-ui-rendering/spec.md` § "渲染 React Native 活動通知 toast，聊天列表不再顯示".
// Design: `design/templates/minimal/moments.jsx` `LBActivityToast` (2026-07-03 呈現位置改版).
// Contract: `design/contract/components.md` § ActivityNotification (`LBActivityToast`).
//
// The group-② activity rows (進場 / 選購 / 搶購 / 中獎) that `ChatFeedView` used to dispatch to
// `ActivityLineRow` inline (`kind === 'activity'`) no longer render in the chat feed at all
// (`isChatFeedRow` filters them out there). Instead this sibling surface, mounted by `FeedWinView`
// directly ABOVE the merged chat feed, shows ONLY the single latest activity item as a transient
// toast: it slides in, stays ~2.6s, then hides — never occupying feed layout space, keeping the
// feed itself for real conversation (`LBChatLine`) + the onsale card (`LBProductSaleCard`) +
// the event-join CTA (`LBEventJoinLine`). Mirrors `moments.jsx` `LBActivityToast` 1:1:
//
//   function LBActivityToast({ items, accent }) {
//     const activities = items.filter(m => m.kind === 'activity');
//     const latest = activities[activities.length - 1];
//     ...
//     useEffect(() => {
//       if (!latest) return;
//       const key = latest._k ?? latest.text;
//       if (key === lastKey.current) return;
//       lastKey.current = key;
//       setShown(latest); setVisible(true);
//       const t = setTimeout(() => setVisible(false), 2600);
//       return () => clearTimeout(t);
//     }, [latest]);
//   }
//
// RN's `ActivityFeedItem` carries no `_k` id (unlike the JSX demo model), so this surface dedupes
// "is this a NEW latest activity" by OBJECT IDENTITY instead of a key string: `MergedActivityFeed`
// (the template's merge buffer, `react-native-ui/src/ActivityFeed.ts`) never mutates an existing
// 'activity' item in place — `push()` always appends a freshly-built object, and `markJoined()` only
// ever replaces 'eventJoin' entries — so the SAME activity event keeps the SAME object reference
// across every `feedItems` snapshot re-read until it ages out of the tail-retain window. A genuinely
// NEW activity therefore always produces a NEW object reference, making `!==` a reliable, ID-free
// substitute for `moments.jsx`'s `_k` comparison.
//
// RENDER DISCIPLINE (parity with `CartToastView` / the family-2/3 reference-ui convention): NO
// `Animated` state — the react-test-renderer structural snapshot must stay deterministic, so the
// slide-in/out motion is represented as a plain visible/hidden toggle (mount / unmount), NOT an
// interpolated transform. True slide fidelity stays anchored to the iOS / Android / Flutter PNG
// baselines. The toast reuses `ActivityLineRow` (now `export`ed by `ChatFeedView`) VERBATIM — its
// tier styling (slot icon / bubble wash / weight) is UNCHANGED, only where it is mounted moved.

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { View } from 'react-native';

import type { ActivityFeedItem, FeedItem } from 'livebuy-react-native-ui';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import { ActivityLineRow } from './ChatFeedView';

/** Stay duration before auto-hide (design `setTimeout(…, 2600)`, `moments.jsx` `LBActivityToast`). */
const TOAST_VISIBLE_MS = 2600;

/** Reserved column height so a hidden toast does not shift the pinned-banner / feed below it
 *  (parity `moments.jsx` `LBActivityToast`'s `minHeight: 26`). */
const TOAST_RESERVED_HEIGHT = 26;

/** Props for the family-2 activity toast (SUB-VIEW INPUT PATTERN: theme first, bound snapshot
 *  value second — same shape as the sibling `ChatFeed`). */
export interface ActivityToastViewProps {
  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;
  /** The merged feed snapshot (`FeedWinModel.feedItems`) — this surface reads it BY VALUE and
   *  locally derives the latest 'activity' item; it MUST NOT reach back into the model/template. */
  readonly items: readonly FeedItem[];
}

/**
 * Pure: the latest (tail-most) `'activity'` item in a feed snapshot, or `null` when none is
 * present. The returned object's IDENTITY is stable across snapshots of the SAME underlying event
 * (see file header) — callers dedupe re-triggers with `!==` alone, no id/key field needed. Parity
 * `moments.jsx`'s `activities[activities.length - 1]`. Exported for unit testing.
 */
export function latestActivityItem(items: readonly FeedItem[]): ActivityFeedItem | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item != null && item.kind === 'activity') return item;
  }
  return null;
}

/**
 * The family-2 activity toast: flashes ONLY the latest 進場/選購/搶購/中獎 item above the chat
 * feed for ~2.6s on every genuinely NEW occurrence (object-identity dedup — a re-render carrying
 * the SAME latest item, e.g. triggered by an unrelated new chat message, does NOT re-trigger the
 * animation). Pure presentation + local transient timing — no core/template/bridge involvement;
 * `items` is the only input (parity with `ChatFeed`'s SUB-VIEW INPUT PATTERN).
 */
export function ActivityToastView(props: ActivityToastViewProps): ReactElement {
  const { theme, items } = props;
  const latest = latestActivityItem(items);

  const [shown, setShown] = useState<ActivityFeedItem | null>(null);
  const [visible, setVisible] = useState(false);
  const lastItemRef = useRef<ActivityFeedItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A genuinely NEW latest activity item (object-identity dedup, see file header) → (re)show it,
  // (re)arming the ~2.6s auto-hide timer. The SAME latest item across renders (or none) is a no-op.
  useEffect(() => {
    if (latest == null || latest === lastItemRef.current) return;
    lastItemRef.current = latest;
    setShown(latest);
    setVisible(true);
    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), TOAST_VISIBLE_MS);
  }, [latest]);

  // Unmount safety — clear any pending auto-hide timer.
  useEffect(
    () => () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <View style={{ minHeight: TOAST_RESERVED_HEIGHT, alignItems: 'flex-start' }}>
      {visible && shown != null ? (
        // `pointerEvents="none"` — a transient notice MUST NOT eat taps on the feed / player
        // gestures beneath it (parity `CartToastView`'s container wrapper / iOS `allowsHitTesting(false)`).
        <View testID={LBTestIDs.activityToast} pointerEvents="none">
          <ActivityLineRow theme={theme} text={shown.text} tier={shown.tier} />
        </View>
      ) : null}
    </View>
  );
}
