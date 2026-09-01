// NotifyRestockSheetView — family-3 product sheet-stack surface 4 (restock-notify, RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-3 product + sheets, surface 4).
// Blueprint (primary): flutter-reference-ui/lib/src/productsheets/notify_restock_sheet.dart.
//   iOS parity: ios/Sources/LivebuyReferenceUI/ProductSheets/NotifyRestockSheetView.swift
//   (rb-ios-product-sheets D-5). Android parity:
//   android/livebuy-reference-ui/.../productsheets/NotifyRestockSheet.kt.
// Design: `design/templates/minimal/screens.jsx` `NotifyRestockSheet` +
//          `design/templates/minimal/sdk-components.jsx` `LBPBottomSheet` /
//          `LBPSheetHeader` / `LBPQtyStepper` (disabled).
// Phase-4 RN sibling of the DONE iOS / Android / Flutter family-3 surface 4.
// Golden parity name: `notify-restock-sheet-not-subscribed` (`restockSubscribed == false`).
//
// The SOLD-OUT restock-notify sheet for ONE sold-out `LBProductDetailState`
// (`detail.soldOut === 1`). It is the fourth of the four family-3 surface
// components composed by `ProductSheetsView`, and it implements the agreed RN
// SUB-VIEW INPUT PATTERN documented in `ProductSheetsView.tsx`:
//
//   1. `theme` (ReferenceUITheme)              — FIRST, always.
//   2. bound SNAPSHOT VALUES (read-only, BY VALUE):
//        `detail: LBProductDetailState` (a sold-out product) +
//        `restockSubscribed: boolean` — passed BY VALUE from `ProductSheetsModel`
//        (never the model, never the template).
//   3. action callbacks (LAST, each defaulting to a no-op):
//        `onToggleNotice?: () => void` (the container funnels it to
//        `model.toggleRestock(goodsGpn)` → `template.toggleNotice(goodsGpn)`, the
//        type=2 restock subscription) + `onDismiss?: () => void` (close affordance).
//
// This sub-view reads ONLY its passed-in values; it never reaches back into
// `ProductSheetsModel` / `DefaultPlayerTemplate` (one-way data flow, D-1 / D-5). It
// also renders correctly with all callbacks omitted (so demo / structural-snapshot
// tests construct it action-free), and it NEVER calls core `addToCart` (the restock
// sheet has no add affordance at all — the product is sold-out).
//
// FAMILY-3 BOUNDARY (D-5): this is the RESTOCK-NOTIFY subscription ONLY. The
// 「通知我補貨」toggle reflects `restockSubscribed` and forwards `onToggleNotice`
// (→ `template.toggleNotice(goodsGpn)`, the NOTICE flag only — the container
// resolves `goodsGpn` from the products snapshot). It MUST NOT render the
// goods-tracking AWAIT switch (`toggleAwait` / `awaitEnabled`, 到貨追蹤 type=1 —
// that is the product-detail 收藏鈕) or a notice-tab open-state (family-6
// gap-surfaces).
//
// RENDER DISCIPLINE (inherited from family-1/2 / iOS / Android / Flutter): plain
// View / Text / Pressable only — NO ScrollView / FlatList / SectionList and NO
// network-uri Image (the photo is a deterministic placeholder View + Text glyph).
// The restock「通知我補貨」toggle is a CUSTOM PILL SWITCH (a capsule track View + a
// circle knob View pinned to one edge via flex alignment) — NOT a platform
// `Switch`. Glyphs are deterministic Text glyphs. No animation / no randomness so
// the structural tree is byte-stable. `theme` FIRST; jsx automatic runtime (no React
// import).

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import { ZoomBadge } from './ZoomBadge';
import { RemoteImage } from './RemoteImage';
import { SheetHeaderCloseButton } from './SheetHeaderCloseButton';
import { SheetScaffold } from './SheetScaffold';
import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';
import type { LBProductDetailState } from 'livebuy-react-native-ui';

// MARK: - Decorative design tokens (literal minimal hex)
//
// accent / text / background come from the resolved [ReferenceUITheme]. These are
// FIXED decorative colors lifted verbatim from the design `theme.surface.*` /
// `theme.soldOut` (light mode, `design/brands/livebuy/tokens.jsx`). They mirror the
// iOS / Android / Flutter `NotifyRestockSheet` static colors byte-for-byte so the
// four platforms read as one family.

/** `theme.surface.textFaint` (faint / disabled text — disabled stepper / 尚無庫存). */
const TEXT_FAINT = '#9A9BA5';
/** `theme.surface.stroke` (hairline border / divider). */
const STROKE = '#ECEAF0';
/** `theme.surface.strokeStrong` (grab handle / pill-switch off track). */
const STROKE_STRONG = '#D8D5DE';
/** `theme.surface.bgSunken` (sunken card / photo placeholder / close-circle fill). */
const BG_SUNKEN = '#F4F4F6';
/** `theme.soldOut` (sold-out caption — design `#9A9BA5`). */
const SOLD_OUT = '#9A9BA5';

// MARK: - Fixed localized copy (static presentation strings — parity to iOS/Android)

const SOLD_OUT_LABEL = '已售完';
const QTY_LABEL = '數量';
const NO_STOCK_LABEL = '尚無庫存';
// 補貨 CTA 文案（對齊 design `screens.jsx` `NotifyRestockSheet` + iOS/Android）。
const NOTICE_OFF_LABEL = '補貨通知我';
const NOTICE_ON_LABEL = '已開啟補貨通知';
/** White foreground over the accent-filled (subscribed) CTA. */
const ON_ACCENT_TEXT = '#FFFFFF';

// MARK: - Deterministic glyphs (Text glyphs — parity to iOS SF Symbols / Flutter Icons)
/** Photo-placeholder glyph (`Icons.image_outlined` / `photo`). */
const GLYPH_PHOTO = '\u{1F5BC}'; // 🖼 framed picture
/** Disabled qty stepper minus / plus glyphs (`Icons.remove` / `Icons.add`). */
const GLYPH_MINUS = '−'; // − minus sign
const GLYPH_PLUS = '+'; // + plus sign
/** Restock CTA bell glyph (state conveyed by outline vs filled CTA + label). */
const GLYPH_BELL = '\u{1F514}'; // 🔔 bell

/** Props for the family-3 SOLD-OUT restock-notify sheet (surface 4). */
export interface NotifyRestockSheetProps {
  /** The resolved reference-ui theme (FIRST, always). */
  readonly theme: ReferenceUITheme;
  /**
   * The sold-out product-detail this sheet subscribes restock-notify for
   * (`detail.soldOut === 1`). Read-only.
   */
  readonly detail: LBProductDetailState;
  /**
   * Whether restock-notify (type=2) is currently subscribed for this product
   * (`template.noticeEnabled(goodsGpn)`, resolved by the container). Drives the
   * pill-switch on/off state. Read-only.
   */
  readonly restockSubscribed: boolean;
  /**
   * rb-rn-product-real-images (parity iOS `live`): `false` (snapshot / demo — the
   * DEFAULT) → the 96×96 photo draws the placeholder only (baselines + the existing
   * `findAllByType('Image') === 0` assertion hold); `true` (host runtime) → the real
   * `detail.photos[0]` loads over the placeholder (fall back on error). Read-only.
   */
  readonly live?: boolean;
  /**
   * Host-wired restock-notify toggle. The container forwards
   * `model.toggleRestock(goodsGpn)` → `template.toggleNotice(goodsGpn)` (optimistic
   * flip of the NOTICE flag only — type=2; corrected by `NOTICE_GOODS_CHANGED`).
   * Default no-op (demo / snapshot) — the sheet renders correctly action-free.
   */
  readonly onToggleNotice?: () => void;
  /** Host-wired close / dismiss. Default no-op (demo / snapshot). */
  readonly onDismiss?: () => void;
  /**
   * Host-wired zoom badge tap → container opens the full-frame `ProductImageZoomOverlay`
   * (rb-rn-product-image-zoom-lightbox). Omitted (demo / snapshot) → the badge renders
   * byte-identical to the prior decorative badge (no `Pressable`; tap inert).
   */
  readonly onZoomImage?: () => void;
  /**
   * The sheet's cap height, a fraction of screen height, forwarded VERBATIM to
   * `SheetScaffold`'s `capPct` (rb-rn-sheetkit-resize-dismiss-unify — fed by the shared
   * `BottomSheetPresenter` drag gesture). `undefined` (demo / snapshot, or ANY presentation
   * the user has not yet dragged the handle on — the floor measurement alone never reports)
   * → `SheetScaffold` falls back to its own fixed 0.4 (`fillToCap`) default, unchanged from
   * before this prop existed.
   */
  readonly heightPct?: number;
}

/**
 * The family-3 SOLD-OUT restock-notify sheet for one sold-out
 * {@link LBProductDetailState}. Renders the bottom-sheet shell (grab handle +
 * centered title「補貨通知」+ trailing close) over a deterministic product photo
 * placeholder + name + 已售完, a divider, a DISABLED qty row (visual-only `−  0  +`),
 * and a bottom「通知我補貨」row with a CUSTOM PILL SWITCH bound to
 * {@link NotifyRestockSheetProps.restockSubscribed}. The toggle forwards
 * `onToggleNotice`; RESTOCK-NOTIFY ONLY — no AWAIT switch (family-6).
 */
export function NotifyRestockSheet(props: NotifyRestockSheetProps): ReactElement {
  const { theme, detail, restockSubscribed, live = false, onToggleNotice, onDismiss, onZoomImage, heightPct } =
    props;
  const photoUri = detail.photos.length > 0 ? detail.photos[0] : undefined;

  // Top-rounded sheet shell via the shared SheetScaffold (pinned header + scrollable
  // body + pinned footer + ½-screen cap, rb-rn-sheet-pinned-header-footer). The
  // container shadow is host-handled; reference-ui keeps this deterministic (shadows
  // are excluded from the structural snapshot anyway).
  const header = (
    <View>
      {/* Grab handle (LBPBottomSheet handle — shared across the sheet-stack). */}
      <View style={{ paddingTop: 8, paddingBottom: 4, alignItems: 'center' }}>
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 99,
            backgroundColor: STROKE_STRONG,
          }}
        />
      </View>

      {/* Sheet header — NO title (對齊設計 NotifyRestockSheet 的 flex-end close-only，
          rb-rn-product-sheet-detail-polish 問題 3——還原先前為「四張 sheet 一致」刻意加上的
          置中「補貨通知」標題 deviation). 只右上角關閉鈕。 */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 8,
          alignItems: 'center',
          justifyContent: 'center',
          // 無標題（flex-end close-only）→ 給 header 穩定高度（避免只剩絕對定位的關閉鈕而塌縮）；
          // 44 與 iOS/Android/Flutter close-only header 等高。
          minHeight: 44,
        }}
      >
        {/* Trailing close — shared transparent close button (rb-rn-sheet-header-close-unify):
            replaces the prior deep `bgSunken` circle. A no-op when `onDismiss` is omitted. */}
        <View style={{ position: 'absolute', right: 12 }}>
          <SheetHeaderCloseButton theme={theme} onPress={onDismiss} />
        </View>
      </View>
    </View>
  );

  const body = (
    <View>
      {/* Product block (photo placeholder + name + 已售完). */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingHorizontal: 16,
          paddingTop: 6,
        }}
      >
        {/* Square photo placeholder (design 96×96 / radius 12). Decorative — no
            network image; deterministic for the snapshot. */}
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 12,
            backgroundColor: BG_SUNKEN,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Text style={{ color: TEXT_FAINT, fontSize: 28 }}>{GLYPH_PHOTO}</Text>
          {/* Real product image over the placeholder when live (snapshot-safe off). */}
          <RemoteImage live={live} uri={photoUri} borderRadius={12} />
          {/* Tappable zoom badge (design screens.jsx ZoomBadge): 24 black@0.55 disc +
              white magnifier glyph, bottom-trailing inset 6. Tap → onZoomImage opens the lightbox. */}
          <ZoomBadge
            diameter={24}
            discColor="rgba(0,0,0,0.55)"
            glyphColor="#FFFFFF"
            style={{ position: 'absolute', right: 6, bottom: 6 }}
            onPress={onZoomImage}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={{
              color: theme.text,
              fontSize: 15 * theme.fontScale,
              fontWeight: 'bold',
            }}
          >
            {detail.name}
          </Text>
          {/* 已售完 — design `color: theme.soldOut`. */}
          <Text
            style={{
              marginTop: 6,
              color: SOLD_OUT,
              fontSize: 13 * theme.fontScale,
            }}
          >
            {SOLD_OUT_LABEL}
          </Text>
        </View>
      </View>

      {/* Hairline divider (design `margin: '18px 0'`). */}
      <View
        style={{
          height: 1,
          backgroundColor: STROKE,
          marginHorizontal: 16,
          marginVertical: 18,
        }}
      />

      {/* Qty row (數量 + 尚無庫存 + DISABLED stepper). Sold-out → no stock; the
          stepper is a purely presentational dimmed affordance (no qty intent is
          forwarded from this sheet — the restock sheet has no add affordance). */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 14 * theme.fontScale,
            fontWeight: '600',
          }}
        >
          {QTY_LABEL}
        </Text>
        <View style={{ flex: 1 }} />
        <Text
          style={{
            color: TEXT_FAINT,
            fontSize: 12 * theme.fontScale,
          }}
        >
          {NO_STOCK_LABEL}
        </Text>
        {/* Disabled qty stepper affordance (`−  0  +`, dimmed / non-tappable). */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: STROKE,
            opacity: 0.6,
          }}
        >
          <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: TEXT_FAINT, fontSize: 16, fontWeight: 'bold' }}>
              {GLYPH_MINUS}
            </Text>
          </View>
          <View style={{ width: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Text
              style={{
                color: TEXT_FAINT,
                fontSize: 14 * theme.fontScale,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {'0'}
            </Text>
          </View>
          <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: TEXT_FAINT, fontSize: 16, fontWeight: 'bold' }}>
              {GLYPH_PLUS}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const footer = (
    // Notice footer (補貨 CTA — design LBPButton kind="outline"). PINNED at the bottom of the
    // scaffold, above a top hairline (design `borderTop`). A SINGLE full-width outline/filled
    // accent CTA (parity iOS/Android): off = transparent fill + 1.5pt accent border + bell +
    // 「補貨通知我」(accent); on = accent fill + bell + 「已開啟補貨通知」(white). Tapping forwards
    // `onToggleNotice` (a no-op when omitted). RESTOCK-NOTIFY ONLY — no AWAIT switch.
    <View
      style={{
        // 頂部分隔線改用容器 borderTop（全寬、貼頂緣），鏡像 ProductDetailSheetView footer
        // （parity iOS rb-ios-compact-sheet-cap-and-footer）。
        borderTopWidth: 1,
        borderTopColor: STROKE,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 18,
      }}
    >
        <Pressable
          testID={LBTestIDs.restockNoticeCta}
          accessibilityRole="button"
          onPress={onToggleNotice}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: theme.accent,
            backgroundColor: restockSubscribed ? theme.accent : 'transparent',
          }}
        >
          <Text style={{ fontSize: 18, color: restockSubscribed ? ON_ACCENT_TEXT : theme.accent }}>
            {GLYPH_BELL}
          </Text>
          <Text
            style={{
              marginLeft: 8,
              color: restockSubscribed ? ON_ACCENT_TEXT : theme.accent,
              fontSize: 15 * theme.fontScale,
              fontWeight: 'bold',
            }}
          >
            {restockSubscribed ? NOTICE_ON_LABEL : NOTICE_OFF_LABEL}
          </Text>
        </Pressable>
    </View>
  );

  // 固定高度填滿到 cap，與 AddToCart 同高（rb-rn-addtocart-sheet-height-align-restock）。`heightPct`
  // 轉發給 `capPct`（rb-rn-sheetkit-resize-dismiss-unify）——省略時落回既有固定 0.4。
  return (
    <SheetScaffold
      testID={LBTestIDs.notifyRestockSheet}
      theme={theme}
      header={header}
      body={body}
      footer={footer}
      fillToCap
      capPct={heightPct}
    />
  );
}
