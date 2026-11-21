// FlashSaleBid — flash-sale bid presentation helpers (rb-rn-flash-sale-bid).
//
// Spec: `reference-ui-rendering/spec.md` §「LivebuyReferenceUI 搶購場商品明細狀態（RN）」/
//       §「LivebuyReferenceUI 搶購下標結果提示（RN）」.
// Design: `design/templates/minimal/screens.jsx` `LBPBidWaitingBanner` / `LBPQtyHint`;
//         `design/contract/claude-design-sync.md` D10.
// Parity: iOS `ProductSheets/FlashSaleBid.swift` (`QtyHint` / `ProductSheetFooterSlots` /
//         `BidToastContent` / `BidWaitingBannerView`) and Android `productsheets/FlashSaleBid.kt`.
//
// Pure presentation over the view-model fields `LBProductDetailState.bidWaiting` / `limitNum` /
// `buyButtonHidden` and `DefaultPlayerTemplate.bidOutcome` (live-bid-rn-template). Every decision
// is a pure function so it is unit-testable without rendering (unit-test-discipline).

import type { ReactElement } from 'react';
import { View } from 'react-native';
import type { LBBidOutcome } from 'livebuy-react-native-ui';

import { Text } from '../TightText';
import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import { text, useReferenceUILanguage } from '../i18n';
import { HourglassGlyph } from './HourglassGlyph';
import { showsStockCaption } from './ProductDetailSheetView';

// MARK: - Qty-row hint (LBPQtyHint)

/**
 * What the qty row shows left of the stepper. Design `LBPQtyHint` order: sold out > 每人限購 >
 * 庫存. Sold out keeps the existing rule of drawing NO caption (the price row already reads
 * 「已售完」); the limit is drawn regardless of `showStock` (the design checks it first).
 */
export type QtyHint =
  | { readonly kind: 'none' }
  | { readonly kind: 'limit'; readonly num: number }
  | { readonly kind: 'stock' };

/** PURE (parity iOS `QtyHint.resolve` / Android `resolveQtyHint`). `showStock` is the normalized flag. */
export function resolveQtyHint(isSoldOut: boolean, showStock: boolean, limitNum: number): QtyHint {
  if (isSoldOut) return { kind: 'none' };
  if (limitNum > 0) return { kind: 'limit', num: limitNum };
  // The stock caption stays decided by THE single existing predicate.
  return showsStockCaption(showStock, isSoldOut) ? { kind: 'stock' } : { kind: 'none' };
}

// MARK: - Detail / add-to-cart footer slots

/** Which footer slots the product sheet draws. */
export interface ProductSheetFooterSlots {
  readonly share: boolean;
  readonly cta: boolean;
}

/**
 * PURE (parity iOS `ProductSheetFooterSlots.resolve` / Android `resolveFooterSlots`): 分享 only in
 * the `detail` presentation while not genuinely live; the CTA unless `buyButtonHidden` (直播管家
 * 搶購場、商品沒設搶購關鍵字 — no placeholder, no substitute copy).
 */
export function resolveFooterSlots(
  isDetailPresentation: boolean,
  isLive: boolean,
  buyButtonHidden: boolean,
): ProductSheetFooterSlots {
  return { share: isDetailPresentation && !isLive, cta: !buyButtonHidden };
}

/** PURE: neither slot remains → the whole footer (incl. its top separator) is not drawn. */
export function footerSlotsEmpty(slots: ProductSheetFooterSlots): boolean {
  return !slots.share && !slots.cta;
}

// MARK: - Bid outcome → toast copy

/** The toast shown for a flash-sale bid outcome. */
export interface BidToastContent {
  readonly key: string;
  readonly args: Readonly<Record<string, string>>;
  readonly isError: boolean;
}

/**
 * PURE (parity iOS `BidToastContent.failureKey` / Android `bidFailureKey`; rb-flash-sale-bid-strings
 * design.md §2): `purchase_limit_exceeded` → `bid_limit` (`limitNum <= 0` → `bid_failed`),
 * `out_of_stock` → `bid_failed_out_of_stock`, `keyword_missing` → `bid_failed_unavailable`,
 * anything else / null → `bid_failed`.
 */
export function bidFailureKey(code: string | null, limitNum: number): string {
  switch (code) {
    case 'purchase_limit_exceeded':
      return limitNum > 0 ? 'bid_limit' : 'bid_failed';
    case 'out_of_stock':
      return 'bid_failed_out_of_stock';
    case 'keyword_missing':
      return 'bid_failed_unavailable';
    default:
      return 'bid_failed';
  }
}

/** PURE: `placed` → success「已加入搶購」; `failed` → error copy from {@link bidFailureKey}. */
export function resolveBidToast(outcome: LBBidOutcome, limitNum: number): BidToastContent {
  if (outcome.type === 'placed') return { key: 'bid_placed_toast', args: {}, isError: false };
  const key = bidFailureKey(outcome.code, limitNum);
  return { key, args: key === 'bid_limit' ? { num: String(limitNum) } : {}, isError: true };
}

/** The toast copy in the current reference-ui language. */
export function bidToastText(content: BidToastContent): string {
  return text(content.key, content.args);
}

// MARK: - BidWaitingBanner (LBPBidWaitingBanner)

/** `#F03246` — design `LBPBidWaitingBanner` background (same literal as iOS / Android). */
export const BID_WAITING_RED = '#F03246';

export interface BidWaitingBannerProps {
  readonly theme: ReferenceUITheme;
}

/**
 * Full-width `#F03246` banner: hourglass +「正在等待結果...」on the left,「搶購中」on the right
 * (white, 12 bold, padding 16 / 8). Drawn at the top of the sheet body while `detail.bidWaiting`.
 */
export function BidWaitingBanner(props: BidWaitingBannerProps): ReactElement {
  useReferenceUILanguage();
  const { theme } = props;
  const labelStyle = { color: '#FFFFFF', fontSize: 12 * theme.fontScale, fontWeight: 'bold' as const };
  return (
    <View
      testID={LBTestIDs.bidWaitingBanner}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: BID_WAITING_RED,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
        <HourglassGlyph color="#FFFFFF" size={14} />
        <Text numberOfLines={1} style={{ ...labelStyle, marginLeft: 6, flexShrink: 1 }}>
          {text('bid_waiting')}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 10 }} />
      <Text numberOfLines={1} style={labelStyle}>
        {text('product_rush')}
      </Text>
    </View>
  );
}
