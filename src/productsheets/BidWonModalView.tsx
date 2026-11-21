// BidWonModalView — flash-sale「恭喜搶購成功」centered popup (rb-rn-flash-sale-bid).
//
// Spec: `reference-ui-rendering/spec.md` §「LivebuyReferenceUI 搶購得標視窗（RN）」.
// Design: `design/templates/minimal/moments.jsx` `LBBidWonModal` (claude-design-sync.md D10).
// Parity: iOS `ProductSheets/BidWonModalView.swift` and Android `productsheets/BidWonModalView.kt`
//         — every number below is the same as theirs.
//
// Binds `DefaultPlayerTemplate.bidWon` (`DefaultBidWon`, live-bid-rn-template) through
// `ProductSheetsModel.bidWonItems` / `bidWonPresented`; the container (`ProductSheetsView`) mounts
// it at its overlay root while `bidWonPresented` and wires「確定」→ `confirmBidWin()`、「取消」→
// `dismissBidWon()`. PURE presentation: the only local state is the visible page index.
//
// Layout: black 0.6 scrim (swallows taps, does NOT close — and, being the responder for the whole
// touch, keeps the player's vertical swipe-to-switch from seeing it), white card 84% / max 320
// wide, radius 20, padding 44/20/20, 16 gaps; a 60 white circular logo with a 4 white border, half
// above the card's top edge — the filled storefront glyph (accent) always sits underneath and the
// real logo is layered on top only when one resolves; title (accent 20/800), product name (15/700,
// wraps, never truncated),「數量 x{num}」(13.5/500 textDim); one item → no dots, several →
// horizontal swipe (FULL displacement ≥ 40, no wrap) + 6 dots; bottom「取消」outline /「確定」
// filled, equal width. No close button.

import { useRef, useState, type ReactElement } from 'react';
import { PanResponder, Pressable, View, type LayoutChangeEvent } from 'react-native';
import type { LBBidWonItem } from 'livebuy-react-native-ui';

import { Text } from '../TightText';
import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import { text, useReferenceUILanguage } from '../i18n';
import { RemoteImage } from './RemoteImage';
import { StorefrontFillGlyph } from './StorefrontFillGlyph';

const SCRIM = 'rgba(0,0,0,0.6)';
const TEXT_DIM = '#6B6775';
const DOT_INACTIVE = '#D8DBE0';
const LOGO_SIZE = 60;
const LOGO_BORDER = 4;

/** Pure helpers (parity iOS `BidWonModalView` statics / Android `BidWonModal`). */
export const BidWonModal = {
  /** Horizontal swipe distance that turns the page (design `onSwipeEnd` `Math.abs(dx) < 40`). */
  swipeThreshold: 40,
  logoSize: LOGO_SIZE,
  logoBorder: LOGO_BORDER,

  /** Card width: 84% of the container, capped at 320. */
  cardWidth(containerWidth: number): number {
    return Math.min(containerWidth * 0.84, 320);
  },

  clampPage(page: number, count: number): number {
    if (count <= 0) return 0;
    return Math.min(Math.max(page, 0), count - 1);
  },

  /**
   * Next page after a horizontal swipe of `dx` (full displacement): `< 40` or a single item →
   * unchanged; left swipe → +1, right → −1, never past either end.
   */
  pageAfterSwipe(current: number, dx: number, count: number): number {
    if (count <= 1 || Math.abs(dx) < BidWonModal.swipeThreshold) return current;
    const next = dx < 0 ? current + 1 : current - 1;
    return next >= 0 && next < count ? next : current;
  },

  showsDots(count: number): boolean {
    return count > 1;
  },
};

export interface BidWonModalProps {
  readonly theme: ReferenceUITheme;
  readonly items: readonly LBBidWonItem[];
  /**
   * The resolved merchant logo URI, or `undefined` → glyph only. The container resolves it through
   * the header logo gate (`resolveShopLogoUri(live, shopLogo)`), so demo / snapshot (`live ===
   * false`) never mounts an image.
   */
  readonly shopLogoUri?: string;
  /** Runtime image gate forwarded to `RemoteImage` (second tier of the logo gate). */
  readonly live?: boolean;
  readonly initialPage?: number;
  /** 「確定」→ confirm every listed win once (container: `model.confirmBidWin()`). */
  readonly onConfirm?: () => void;
  /** 「取消」→ close only (container: `model.dismissBidWon()`). */
  readonly onCancel?: () => void;
}

export function BidWonModalView(props: BidWonModalProps): ReactElement {
  useReferenceUILanguage();
  const { theme, items, shopLogoUri, live = false, initialPage = 0, onConfirm, onCancel } = props;
  const [page, setPage] = useState(() => BidWonModal.clampPage(initialPage, items.length));
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  // Refs so the once-created PanResponder reads the current page / count.
  const pageRef = useRef(page);
  pageRef.current = page;
  const countRef = useRef(items.length);
  countRef.current = items.length;
  const [swipe] = useState(() =>
    PanResponder.create({
      // The item text block holds no tappable child, so it can claim the touch at once.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // `gesture.dx` = full displacement from the down point (iOS `translation.width`).
      onPanResponderRelease: (_e, gesture) => {
        setPage(BidWonModal.pageAfterSwipe(pageRef.current, gesture.dx, countRef.current));
      },
    }),
  );

  const current = items.length > 0 ? items[BidWonModal.clampPage(page, items.length)] : undefined;
  const cardWidth = BidWonModal.cardWidth(containerWidth ?? 320 / 0.84);

  return (
    // Scrim swallows taps but does NOT close (design: no backdrop dismiss).
    <Pressable
      onPress={() => {}}
      onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
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
      {current != null ? (
        <View
          testID={LBTestIDs.bidWonModal}
          style={{
            width: cardWidth,
            paddingTop: 44,
            paddingHorizontal: 20,
            paddingBottom: 20,
            borderRadius: 20,
            backgroundColor: theme.background,
            alignItems: 'stretch',
            shadowColor: '#000000',
            shadowOpacity: 0.35,
            shadowRadius: 32,
            shadowOffset: { width: 0, height: 24 },
            elevation: 24,
          }}
        >
          {renderLogo(theme, shopLogoUri, live)}
          <View {...swipe.panHandlers} style={{ alignItems: 'center' }}>
            <Text
              style={{
                color: theme.accent,
                fontSize: 20 * theme.fontScale,
                fontWeight: '800',
                textAlign: 'center',
              }}
            >
              {text('bid_won_title')}
            </Text>
            <Text
              style={{
                marginTop: 10,
                alignSelf: 'stretch',
                color: theme.text,
                fontSize: 15 * theme.fontScale,
                fontWeight: 'bold',
                lineHeight: 15 * 1.45 * theme.fontScale,
                textAlign: 'center',
              }}
            >
              {current.name}
            </Text>
            <Text
              style={{
                marginTop: 6,
                color: TEXT_DIM,
                fontSize: 13.5 * theme.fontScale,
                fontWeight: '500',
                textAlign: 'center',
              }}
            >
              {text('bid_won_qty', { num: String(current.num) })}
            </Text>
          </View>
          {BidWonModal.showsDots(items.length) ? (
            <View
              testID={LBTestIDs.bidWonPaginationDots}
              style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'center' }}
            >
              {items.map((item, i) => (
                <Pressable
                  key={item.buyingId}
                  onPress={() => setPage(i)}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    marginLeft: i === 0 ? 0 : 5,
                    backgroundColor: i === page ? theme.accent : DOT_INACTIVE,
                  }}
                />
              ))}
            </View>
          ) : null}
          {renderButtons(theme, onConfirm, onCancel)}
        </View>
      ) : null}
    </Pressable>
  );
}

/** 60 white circle + 4 white border, half above the card: glyph floor + optional real logo. */
function renderLogo(theme: ReferenceUITheme, uri: string | undefined, live: boolean): ReactElement {
  const inner = LOGO_SIZE - LOGO_BORDER * 2;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: -LOGO_SIZE / 2, left: 0, right: 0, alignItems: 'center' }}
    >
      <View
        style={{
          width: LOGO_SIZE,
          height: LOGO_SIZE,
          borderRadius: LOGO_SIZE / 2,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000000',
          shadowOpacity: 0.2,
          shadowRadius: 11,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <StorefrontFillGlyph color={theme.accent} size={30} />
        {uri != null ? (
          <View
            style={{
              position: 'absolute',
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              overflow: 'hidden',
            }}
          >
            <RemoteImage live={live} uri={uri} borderRadius={inner / 2} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** 「取消」(accent 1.5 outline) /「確定」(accent fill), equal width, 12 apart. */
function renderButtons(
  theme: ReferenceUITheme,
  onConfirm: (() => void) | undefined,
  onCancel: (() => void) | undefined,
): ReactElement {
  const label = { fontSize: 15 * theme.fontScale, fontWeight: '800' as const };
  return (
    <View style={{ marginTop: 16, flexDirection: 'row' }}>
      <Pressable
        testID={LBTestIDs.bidWonCancel}
        accessibilityRole="button"
        onPress={() => onCancel?.()}
        style={{
          flex: 1,
          alignItems: 'center',
          paddingVertical: 13,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: theme.accent,
        }}
      >
        <Text style={{ ...label, color: theme.accent }}>{text('common_cancel')}</Text>
      </Pressable>
      <View style={{ width: 12 }} />
      <Pressable
        testID={LBTestIDs.bidWonConfirm}
        accessibilityRole="button"
        onPress={() => onConfirm?.()}
        style={{
          flex: 1,
          alignItems: 'center',
          paddingVertical: 13,
          borderRadius: 12,
          // Same 1.5 border as「取消」(same color as the fill) so both buttons are equally tall.
          borderWidth: 1.5,
          borderColor: theme.accent,
          backgroundColor: theme.accent,
          shadowColor: theme.accent,
          shadowOpacity: 0.27,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Text style={{ ...label, color: '#FFFFFF' }}>{text('common_confirm')}</Text>
      </Pressable>
    </View>
  );
}
