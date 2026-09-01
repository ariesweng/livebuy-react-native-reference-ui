// NowIntroducingCarouselView — VOD「正在介紹中的商品」滿寬卡輪播（RN）。
//
// Spec: `reference-ui-rendering/spec.md` (family-1 player-shell, VOD now-introducing).
// RN parity of iOS `NowIntroducingCarouselView` / Android `NowIntroducingCarousel` /
// Flutter `now_introducing_carousel.dart`（rb-rn-now-introducing-real-image-carousel，
// 問題 9 真實圖+滿寬 / 問題 10 多商品輪播）—— Flutter blueprint 1:1 翻譯。
//
// Draws ONLY the current card (full-width `MiniCartPeek` with a「介紹中」tag + the real
// image when `live`) + page dots — NO FlatList / ScrollView (snapshot determinism, the
//「snapshot 綠 ≠ 畫對」discipline). A horizontal swipe flips to the prev / next card via a
// `PanResponder`. `peeks` empty → renders NOTHING (`null` → snapshot-neutral, mirrors
// `HeartBurst` at rest). Index is clamped (peeks may shrink as the playhead advances).

import type { ReactElement } from 'react';
import { useRef, useState } from 'react';
import { View, PanResponder } from 'react-native';

import { MiniCartPeek } from '../productsheets/MiniCartPeekView';
import type { ReferenceUITheme } from '../theme';
import type { LBMiniCartPeek } from 'livebuy-react-native-ui';
import { LBTestIDs, nowIntroducingDot, livePinnedDot } from '../testing/LBTestIDs';

// MARK: - Layout tokens (parity iOS / Android / Flutter)

/** Dim (non-current) page-dot fill (`rgba(255,255,255,0.45)`). */
const DOT_DIM = 'rgba(255,255,255,0.45)';
/** Cap the page dots so a long product list keeps a tidy indicator. */
const MAX_DOTS = 6;
/** Horizontal swipe distance (px) that commits a card flip. */
const SWIPE_DX = 40;
/** The carousel card's accent tag copy. */
const NOW_INTRODUCING_TAG = '介紹中';

/**
 * Clamp `index` into `[0, length - 1]` (or 0 when empty). Pure — exported for unit
 * tests (the playhead may shrink `peeks` below the current index between renders).
 * Mirrors iOS / Android / Flutter index clamping.
 */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index > length - 1) return length - 1;
  return index;
}

/** Props for the {@link NowIntroducingCarousel} surface. */
export interface NowIntroducingCarouselProps {
  /** The resolved reference-ui theme (FIRST, always). */
  readonly theme: ReferenceUITheme;
  /**
   * The in-flight now-introducing peeks (one per `vodActiveProducts` entry, `pic =
   * photos[0] ?? pic`), BY VALUE. Empty → nothing drawn. Read-only.
   */
  readonly peeks: readonly LBMiniCartPeek[];
  /**
   * Real image only over a live video surface (`true` → host runtime loads the photo;
   * `false` / default → the placeholder, snapshot byte-stable). Read-only.
   */
  readonly live?: boolean;
  /** Current card's close → host removes that productId locally. Default no-op. */
  readonly onDismiss?: (productId: string) => void;
  /** Current card body tap → host opens that product's detail. Default no-op. */
  readonly onOpenDetail?: (productId: string) => void;
  /**
   * Seed the shown card index (rb-rn-now-introducing；snapshot 測試用)。預設 0 → 既有
   * 結構不變；測試可 seed 指定卡。執行期由 swipe 更新。
   */
  readonly initialIndex?: number;
}

/**
 * The VOD now-introducing carousel. Renders the current full-width {@link MiniCartPeek}
 * (with the「介紹中」tag + the real image when `live`) and — when more than one product
 * is being introduced — a row of page dots. A horizontal swipe flips between products.
 * Renders nothing when `peeks` is empty (snapshot-neutral).
 */
export function NowIntroducingCarousel(props: NowIntroducingCarouselProps): ReactElement | null {
  const { theme, peeks, live = false, onDismiss, onOpenDetail, initialIndex = 0 } = props;
  const [index, setIndex] = useState(initialIndex);

  // Refs so the once-created PanResponder reads the current index / length without
  // stale closures (parity with `ProductImageZoomOverlay`'s pan refs).
  const indexRef = useRef(index);
  indexRef.current = index;
  const lenRef = useRef(peeks.length);
  lenRef.current = peeks.length;

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 6,
      onPanResponderRelease: (_e, g) => {
        const cur = clampIndex(indexRef.current, lenRef.current);
        if (g.dx < -SWIPE_DX) setIndex(clampIndex(cur + 1, lenRef.current));
        else if (g.dx > SWIPE_DX) setIndex(clampIndex(cur - 1, lenRef.current));
      },
    }),
  ).current;

  // Empty → draw nothing (snapshot-neutral; the container also gates).
  if (peeks.length === 0) return null;

  const i = clampIndex(index, peeks.length);
  const cur = peeks[i]!;

  return (
    <View testID={LBTestIDs.nowIntroCarousel} {...responder.panHandlers}>
      <MiniCartPeek
        theme={theme}
        peek={cur}
        live={live}
        fullWidth
        tag={NOW_INTRODUCING_TAG}
        testID={LBTestIDs.nowIntroducingCard}
        onDismiss={() => onDismiss?.(cur.productId)}
        onOpenDetail={() => onOpenDetail?.(cur.productId)}
      />
      {peeks.length > 1 ? (
        <>
          <View style={{ height: 6 }} />
          <PageDots theme={theme} count={peeks.length} current={i} onSelect={setIndex} />
        </>
      ) : null}
    </View>
  );
}

/** Page dots — current = accent solid, others dim; capped at {@link MAX_DOTS}. Each dot is
 *  TAPPABLE: it switches the carousel to that page (vod-now-introducing-switchable). The tap
 *  is attached via the View's own responder + `hitSlop` (NO wrapping `Pressable`) so the 6px
 *  dot keeps its exact pixels and the carousel's existing Pressable order (card body / close)
 *  is unaffected — parity iOS `contentShape(Rectangle().inset(by: -7)).onTapGesture` / Android
 *  `clickable(indication = null)` (no extra node). */
export function PageDots(props: {
  theme: ReferenceUITheme;
  count: number;
  current: number;
  onSelect?: (idx: number) => void;
  /** testID prefix for each dot (rb-rn-live-now-introducing-carousel reuse) — the LIVE pinned-card
   *  carousel passes its own prefix so its dots don't share the VOD carousel's testIDs. Defaults to
   *  `'now-introducing-dot'` (既有 VOD 用法不變). */
  testIDPrefix?: string;
}): ReactElement {
  const { theme, count, current, onSelect, testIDPrefix = 'now-introducing-dot' } = props;
  const shown = count > MAX_DOTS ? MAX_DOTS : count;
  const cur = current > shown - 1 ? shown - 1 : current;
  // Map the dot family (prefix) → the matching registry per-item helper so each dot's
  // testID comes from `LBTestIDs` (live pinned-card carousel vs VOD now-introducing carousel).
  const dotTestID = testIDPrefix === 'live-pinned-dot' ? livePinnedDot : nowIntroducingDot;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
      {Array.from({ length: shown }, (_unused, idx) => (
        <View
          key={idx}
          testID={dotTestID(idx)}
          // Expand the hit area (parity iOS contentShape inset -7) and claim the touch on
          // START (a clean tap — never on move, so a swipe still falls through to the
          // carousel's PanResponder). Release → switch to this page.
          hitSlop={{ top: 7, bottom: 7, left: 7, right: 7 }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => onSelect?.(idx)}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            marginLeft: idx > 0 ? 5 : 0,
            backgroundColor: idx === cur ? theme.accent : DOT_DIM,
          }}
        />
      ))}
    </View>
  );
}
