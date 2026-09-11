// MinimizedWidget — family-5 widget surface 4 (LBPMinimizedWidget).
//
// Spec: `reference-ui-rendering/spec.md` (family-5 widget surfaces — carousel /
// video-shop grid / floating / minimized). Phase-4 RN sibling of the DONE iOS
// `MinimizedWidgetView.swift` (rb-ios-widget) + Android `MinimizedWidgetView.kt`
// (rb-android-widget) + Flutter `minimized_widget.dart` (rb-flutter-widget — the
// authoritative blueprint translated here 1:1). Design:
// `design/templates/minimal/sdk-components.jsx` `LBPMinimizedWidget` (lines 459-546).
//
// The MINIMIZED widget surface: a small ~96-wide 9:16 floating pill the SDK collapses
// to (the design's PiP-style corner widget). It maps to `LBWidgetContentMode.Minimized`
// (the template-derived floating `isClosed == true` state) and is the fourth of the
// four family-5 widget sub-views the container (`WidgetOverlayView`) switches on.
//
// SELF-CONTAINED (no WidgetModel, no LBVideoItem, no CarouselCardView): unlike the
// carousel / grid / floating surfaces — which render the shared `CarouselCardView` for
// a real `LBVideoItem` — the minimized pill takes NO video model. It is a tiny chrome
// affordance with ONLY a single derived bound field, `isLive` (the container/host
// derives it from `WidgetModel.minimizedIsLive`, i.e. `liveVideo?.liveStatus === 1`,
// the SAME source as the shared `CarouselCardView` kind badge — `LBWidgetContent` has
// no `isLive` field). So this view binds ONLY `isLive`; it reads no other view-model
// state and holds NO copy of model state (one-way data flow preserved). It does NOT
// import `CarouselCardView` because the pill carries no `LBVideoItem` to feed it
// (parity with iOS / Flutter, whose minimized views are likewise self-contained and
// do NOT reuse the card primitive — the skeleton's `MinimizedWidget` signature carries
// no `video` prop, confirming this).
//
// STRUCTURE (mirrors `LBPMinimizedWidget`, sdk-components.jsx 503-544):
//   • a 96-wide 9:16 rounded (12) pill with a soft drop shadow + a 1px white hairline
//     (`0 0 0 1px rgba(255,255,255,0.08)`),
//   • a deterministic dark cover placeholder (the design's `<VideoBG>` — NO
//     network-uri Image; a solid fill + play-glyph chip, mirroring
//     `CarouselCardView`'s deterministic cover),
//   • a top-left LIVE red tag (`#F03246`, static pulse dot) ONLY when `isLive`,
//   • a top-right round close affordance (`rgba(0,0,0,0.55)` + close glyph),
//   • a bottom centered drag-handle hint (24×3 pill, `rgba(255,255,255,0.4)`).
//
// HOST-WIRED EXITS (design §"守住的不變式": 互動一律 host-wired exit 轉發):
//   • BODY tap   → `onExpand` → host → core re-open the floating widget (the design
//                  restores the player to full screen on a no-drag tap, line 499).
//   • CLOSE tap  → `onClose`  → host → core floating-close.
//   The design's grip-DRAG-to-reposition (pointer math, lines 460-501) is a host /
//   PiP-window concern, NOT pixel rendering — this layer renders the pill at a fixed
//   position and forwards only tap / close (NO drag re-positioning, NO core
//   `simulate*` / template intents). Renders correctly with both actions omitted (so
//   demo / golden / structural-snapshot tests construct it action-free).
//
// EMBED COLORS — DELIBERATELY EXCLUDED (rb-rn-widget-embed-colors): `widget_color` /
// `widget_bgcolor` are NOT consulted here; this pill keeps the UNDERIVED
// `ReferenceUITheme`, matching its existing `product_card` exclusion. It reads ONLY
// `theme.fontScale`, so a leak from deriving upstream (`WidgetOverlayView` /
// `WidgetSurfaceContext.theme`) would be INVISIBLE in every structural snapshot — the
// guard is the test asserting this surface receives the caller's theme BY REFERENCE.
//
// NO ScrollView / FlatList, NO network-uri Image, NO animation / randomness.

import type { ReactElement } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import { CloseGlyph } from './CloseGlyph';

/** Pill width (logical px) — the design's fixed `width: 96` (LBPMinimizedWidget 512). */
export const MINIMIZED_PILL_WIDTH = 96;

/** Props for the family-5 MINIMIZED widget pill. */
export interface MinimizedWidgetProps {
  /**
   * The resolved reference-ui theme (FIRST — SUB-VIEW INPUT PATTERN). The minimized
   * pill is white-on-dark chrome (fixed design colors for the cover / LIVE tag /
   * close), so `theme` is consulted only for `fontScale` consistency. It is the
   * UNDERIVED resolver output — the embed colors are never applied to this surface.
   */
  readonly theme: ReferenceUITheme;
  /**
   * Whether a LIVE card sits behind the minimized pill — the SINGLE bound field (the
   * container/host derives it from `WidgetModel.minimizedIsLive`, i.e.
   * `liveVideo?.liveStatus === 1`). When true, the top-left LIVE red tag is drawn
   * (design `isLive` prop, line 519).
   */
  readonly isLive: boolean;
  /**
   * BODY tap → host-wired `onExpand` → host → core re-open the floating widget (the
   * design restores full screen on a no-drag tap). Omitted for demo / golden instances
   * — the pill is inert. This layer NEVER re-opens / calls core itself.
   */
  readonly onExpand?: () => void;
  /**
   * CLOSE tap → host-wired `onClose` → host → core floating-close. Omitted for demo /
   * golden instances. This layer NEVER closes / calls core itself.
   */
  readonly onClose?: () => void;
}

/**
 * The family-5 MINIMIZED widget pill (`LBPMinimizedWidget`): a small ~96-wide 9:16
 * floating placeholder pill with an optional LIVE tag, a close affordance, and a
 * drag-handle hint. Body tap → `onExpand`; close → `onClose`. Self-contained (no
 * `WidgetModel`, no `LBVideoItem`, no `CarouselCardView`) — it binds only the derived
 * `isLive` flag and never reaches back into the model / template. Renders correctly
 * with both callbacks omitted (demo / golden).
 */
export function MinimizedWidget(props: MinimizedWidgetProps): ReactElement {
  const { theme, isLive, onExpand, onClose } = props;
  const height = (MINIMIZED_PILL_WIDTH * 16) / 9;

  return (
    // BODY tap restores the player (no-drag tap → onExpand, design line 499). The inner
    // close Pressable swallows its own press so only one exit fires.
    <Pressable
      testID={LBTestIDs.minimizedWidget}
      onPress={() => onExpand?.()}
      style={[styles.pill, { width: MINIMIZED_PILL_WIDTH, height }]}
    >
      {/* deterministic dark cover placeholder (`<VideoBG>`) — solid fill + play glyph,
          NO network-uri Image (consistent with CarouselCardView). */}
      <View style={styles.cover}>
        <Text style={[styles.playGlyph, { fontSize: 18 * theme.fontScale }]}>▶</Text>
      </View>

      {/* 1px white hairline overlay (`0 0 0 1px rgba(255,255,255,0.08)`, line 514). */}
      <View style={styles.hairline} pointerEvents="none" />

      {/* LIVE red tag top-left (only when a live card is behind the pill). */}
      {isLive ? (
        <View style={styles.liveTagSlot}>
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveLabel, { fontSize: 9 * theme.fontScale }]}>
              {LIVE_LABEL}
            </Text>
          </View>
        </View>
      ) : null}

      {/* close affordance top-right → onClose (its own Pressable). */}
      <View style={styles.closeSlot}>
        <Pressable testID={LBTestIDs.minimizedClose} onPress={() => onClose?.()} style={styles.closeButton}>
          <CloseGlyph color={WHITE} size={14} />
        </Pressable>
      </View>

      {/* centered drag-handle hint at the bottom (pure decoration — the real grip-drag
          reposition is a host / PiP-window concern, not rendered here). */}
      <View style={styles.dragHandleSlot} pointerEvents="none">
        <View style={styles.dragHandle} />
      </View>
    </Pressable>
  );
}

// Fixed presentation strings.
const LIVE_LABEL = 'LIVE';

// Decorative design tokens (literal sdk-components.jsx values — FIXED, NOT
// theme-derived; the dark-glass treatment composites over the dark cover).
const LIVE_RED = '#F03246'; // LBPMinimizedWidget brand-red LIVE tag surface (line 521).
const COVER_TOP = '#3A3A44'; // dark cover gradient top (approximated as a solid fill).
const CLOSE_DARK = 'rgba(0,0,0,0.55)'; // top-right close circle (line 532).
const HAIRLINE = 'rgba(255,255,255,0.08)'; // 1px white hairline (line 514).
const HANDLE = 'rgba(255,255,255,0.4)'; // bottom drag-handle hint (line 541).
const WHITE = '#FFFFFF';

const styles = StyleSheet.create({
  pill: {
    overflow: 'hidden',
    borderRadius: 12,
    position: 'relative',
    // Soft drop shadow (`0 8px 24px rgba(0,0,0,0.35)`, line 514). RN composites these
    // structurally; the visual fidelity is anchored to the iOS / Android / Flutter
    // baselines.
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COVER_TOP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    fontWeight: '900',
    color: 'rgba(255,255,255,0.85)',
  },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  liveTagSlot: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: LIVE_RED,
  },
  liveDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: WHITE,
    marginRight: 3,
  },
  liveLabel: {
    fontWeight: '900',
    color: WHITE,
    letterSpacing: 0.5,
  },
  closeSlot: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  closeButton: {
    // 28×28 round (rb-rn-live-replay-more-menu-and-video-info-live-copy, design R32 — enlarged
    // from the prior 20×20, parity with the sibling `FloatingWidgetView.styles.closeButton`;
    // `FloatingCloseButtonLayout.test.tsx` asserts the two stay identical).
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CLOSE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    alignItems: 'center',
  },
  dragHandle: {
    width: 24,
    height: 3,
    borderRadius: 99,
    backgroundColor: HANDLE,
  },
});
