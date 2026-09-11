// LiveMoreMenuView — family-1 player-shell "更多" (more) collapsed menu (RN, design R32).
//
// Spec: `reference-ui-rendering/spec.md` (RN "LivebuyReferenceUI（RN）渲染 side rail 並把
//   LiveBottomBarView 底部 bar / 側欄依模式互斥" Requirement's `OperationRail.isFinishedLiveReplay`
//   / `LiveMoreMenuView` paragraph). Design: `design/templates/minimal/screens.jsx`
//   `LBPPlayerScreen`'s `effectiveState === 'live_more'` block (a 30%-height `LBPBottomSheet`).
// Change: rb-rn-live-replay-more-menu-and-video-info-live-copy.
//
// A small collapsed action menu: two available actions — 「分享」(share) and 「客服」(contact
// merchant) — plus 2 reserved-but-invisible placeholder slots (the design draws 4 equal-width
// cells but only wires 2 handlers; the trailing two keep the row's spacing symmetric without
// being interactive — CSS `visibility: hidden` in the design source, approximated here with
// `opacity: 0` on a non-`Pressable` `View` of the same footprint, since RN has no `visibility`
// style).
//
// TRIGGER (RESOLVED — via the VOD side rail, NOT `LiveBottomBarView`): the design's "更多"
// button lives on `LBLiveBottomBar`, but `LiveBottomBarView.tsx` never renders for a
// finished-live-replay in RN (see that file's header comment — a documented, pre-existing
// RN-only divergence from iOS/Android). The actual RN trigger is `OperationRailView`'s new
// `isFinishedLiveReplay` prop (`OperationRailProps.isFinishedLiveReplay`): when `true`, the VOD
// side rail — which IS what finished-live-replay renders in RN — appends a `LBSideRailKind.More`
// pill (`'⋯'`) to its presentation order, reusing a `More` rail kind the TEMPLATE layer
// (`react-native-ui/src/OperationRail.ts`) already modeled (`RAIL_ORDER` + `isEnabled` always
// `true` for it) but reference-ui had never drawn. Tapping it opens THIS component via
// `PlayerShellView.tsx`'s `handleRailTap` → `moreMenuOpen` state → `BottomSheetPresenter`. See
// `design.md` D1 for the full trigger analysis (including why wiring through
// `LiveBottomBarView` directly was rejected).
//
// SHEET SHELL (owned by THIS leaf, not the presenter — mirrors `VideoInfoPanelView` /
// `ContactMerchantModalView`): `BottomSheetPresenter` only frames the scrim + slide: the grab
// handle + top-rounded shell live inside this component's own render, so it can be composed
// directly as `BottomSheetPresenter`'s `children`.
//
// SUB-VIEW INPUT PATTERN (family convention, mirrors `ContactMerchantModalView.tsx`): `theme`
// FIRST; then action callbacks (LAST, each optional, default no-op). No bound snapshot value —
// the copy is fixed. Reads NOTHING back from the model (one-way data flow) and renders correctly
// with callbacks omitted (snapshot safe).
//
// RENDER DISCIPLINE (family lessons): plain `View` / `Text` / `Pressable` only — NO ScrollView /
// FlatList, NO network-uri `Image`, no animation / randomness.

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { ShareFillGlyph } from './ShareFillGlyph';
import { ContactGlyph } from './ContactGlyph';
import { LBTestIDs } from '../testing/LBTestIDs';

/** Grab-handle stroke (`STROKE_STRONG`, matches `VideoInfoPanelView`'s identically-named
 *  constant — the same design token, kept as a local literal rather than a cross-file import
 *  since neither file exports its decorative tokens). */
const STROKE_STRONG = '#D8D5DE';
/** Top-rounded shell corner radius (matches `SheetScaffold`'s identically-valued constant). */
const SHELL_RADIUS = 20;
/** `rgba(204,204,204,0.8)` — the design's icon-chip fill (`sdk-components.jsx` `live_more` row). */
const ICON_CHIP_BACKGROUND = 'rgba(204,204,204,0.8)';
/** Icon chip diameter (design 40). */
const ICON_CHIP_SIZE = 40;
/** Icon glyph size inside the chip (design `size={20}`). */
const ICON_GLYPH_SIZE = 20;
/** Per-item column width (design `width: 64`). */
const ITEM_WIDTH = 64;
/** Horizontal gap between the 4 cells (design `gap: 20`). */
const ROW_GAP = 20;

const SHARE_LABEL = '分享';
const CONTACT_LABEL = '客服';

/** Props for the {@link LiveMoreMenuView} surface. */
export interface LiveMoreMenuProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /** 「分享」tap → host-wired share exit (the container would forward this to the SAME channel
   *  share the LIVE bottom bar's `onShare` uses). Defaults to a no-op (demo / snapshot). */
  readonly onShare?: () => void;
  /** 「客服」tap → host-wired contact-merchant exit (the container would forward this to the
   *  existing side-rail `serviceLink` host path, same as `VideoInfoPanel`'s
   *  `onContactMerchant`). Defaults to a no-op (demo / snapshot). */
  readonly onContactMerchant?: () => void;
}

/**
 * The "更多" (more) collapsed menu (design `live_more` state, `LBPBottomSheet` 30% height) — a
 * top-rounded shell (grab handle + `theme.background` + `SHELL_RADIUS` corners, matching the
 * other family-1 sheet leaves) around 4 equal-width cells: 「分享」+「客服」(both tappable)
 * followed by 2 reserved-but-invisible placeholders (design-literal: the design itself only
 * wires 2 of the 4 cells it draws). Composable directly as `BottomSheetPresenter`'s `children`
 * (see the file-header comment). Renders correctly with both callbacks omitted (snapshot /
 * preview safe).
 */
export function LiveMoreMenuView(props: LiveMoreMenuProps): ReactElement {
  const { theme, onShare, onContactMerchant } = props;

  return (
    <View
      style={{
        backgroundColor: theme.background,
        borderTopLeftRadius: SHELL_RADIUS,
        borderTopRightRadius: SHELL_RADIUS,
      }}
    >
      {/* Grab handle (mirrors `VideoInfoPanelView`'s identically-styled handle). */}
      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
        <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: STROKE_STRONG }} />
      </View>

      <View
        testID={LBTestIDs.liveMoreMenu}
        style={{
          flexDirection: 'row',
          paddingHorizontal: 18,
          paddingVertical: 20,
        }}
      >
        <MenuItem
          testID={LBTestIDs.liveMoreMenuShare}
          theme={theme}
          label={SHARE_LABEL}
          onTap={onShare}
        >
          {/* Design draws `Icons.shareFill` (a solid-fill variant introduced specifically for
              R32's `live_more` menu, `theme.surface.text`-colored on the light chip). RN draws
              this via a dedicated `ShareFillGlyph` (`react-native-svg`, rb-rn-live-more-sheet-
              share-fill-icon) — matching iOS's own `ShareFillGlyph.swift` — rather than the
              outline `ShareGlyph` used elsewhere (`LiveBottomBarView` / `OperationRailView` /
              `ProductListView` / `ProductDetailSheetView`, all of which correctly render
              `Icons.share`, a different design token). */}
          <ShareFillGlyph color={theme.text} size={ICON_GLYPH_SIZE} />
        </MenuItem>
        <View style={{ width: ROW_GAP }} />
        <MenuItem
          testID={LBTestIDs.liveMoreMenuContact}
          theme={theme}
          label={CONTACT_LABEL}
          onTap={onContactMerchant}
        >
          {/* 客服 (customer service / contact merchant) 改設計稿自繪雙泡泡+問號 ContactGlyph
              （rb-rn-icon-parity-contact-glyph），parity iOS/Android/Flutter ContactGlyph——不再
              與 Chat 共用 railGlyphFor 的 '💬' 字面文字。 */}
          <ContactGlyph color={theme.text} size={ICON_GLYPH_SIZE} />
        </MenuItem>
        <View style={{ width: ROW_GAP }} />
        {/* Reserved-but-invisible placeholders (design-literal: 4 cells drawn, only 2 wired).
            `opacity: 0` on a non-`Pressable` `View` of the SAME footprint approximates the
            design's `visibility: hidden` (RN has no `visibility` style) — occupies the row's
            spacing without painting or accepting touches. */}
        <View style={{ width: ITEM_WIDTH, opacity: 0 }} pointerEvents="none" />
        <View style={{ width: ROW_GAP }} />
        <View style={{ width: ITEM_WIDTH, opacity: 0 }} pointerEvents="none" />
      </View>
    </View>
  );
}

// MARK: - One tappable cell (icon chip + label)

function MenuItem(props: {
  testID: string;
  theme: ReferenceUITheme;
  label: string;
  onTap?: () => void;
  children: ReactElement;
}): ReactElement {
  const { testID, theme, label, onTap, children } = props;
  return (
    <Pressable
      testID={testID}
      onPress={() => onTap?.()}
      style={{ width: ITEM_WIDTH, alignItems: 'center' }}
    >
      <View
        style={{
          width: ICON_CHIP_SIZE,
          height: ICON_CHIP_SIZE,
          borderRadius: ICON_CHIP_SIZE / 2,
          backgroundColor: ICON_CHIP_BACKGROUND,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
      <View style={{ height: 8 }} />
      <Text style={{ fontSize: 12 * theme.fontScale, color: theme.text }}>{label}</Text>
    </Pressable>
  );
}
