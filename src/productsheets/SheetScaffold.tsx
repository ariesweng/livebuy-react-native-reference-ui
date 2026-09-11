// SheetScaffold — pinned header + scrollable body + pinned footer (rb-rn-sheet-pinned-
// header-footer).
//
// Parity: iOS `LBSheetScaffold` (BottomSheetPresenter.swift) + Android / Flutter sheet
// scaffolds. A bottom sheet is laid out as THREE regions inside a top-rounded shell:
//   • header  — PINNED at the top (grab handle + title + close), NEVER scrolls.
//   • body    — a `<ScrollView>` that scrolls when its content exceeds the cap.
//   • footer  — PINNED at the bottom (CTA / toggle row), NEVER scrolls.
// The whole shell is capped to HALF the screen height (`Dimensions.get('window').height
// / 2`) so a tall sheet never covers the video; the body absorbs the overflow by
// scrolling between the pinned header and footer.
//
// Structural-snapshot note: the cap is a `maxHeight` STYLE value (invisible to the tree
// shape); the `Dimensions` read is mocked to a fixed 852pt in jest so the value is
// byte-stable. The body `<ScrollView>` IS in the tree (the four sheets' snapshots are
// regenerated to show header-outside / body-inside / footer-outside). Plain View / Text /
// ScrollView only — no animation / randomness. jsx automatic runtime (no React import).

import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { View, ScrollView, Dimensions } from 'react-native';

import type { ReferenceUITheme } from '../theme';

/** Sheet cap height: `fillToCap` uses 0.4 screen (固定同高，產品指定、覆蓋設計 `min(drawerH, 70%)`;
 *  rb-rn-compact-sheet-cap-and-footer); otherwise ½ screen (content-sized cap). Parity iOS / Android / Flutter.
 *  `capPct` OVERRIDES the fraction number. `undefined` (leaf rendered outside a
 *  `BottomSheetPresenter` / drag-gesture wiring, e.g. isolated demo / structural snapshot tests)
 *  → the two constants above, unchanged. */
function sheetCapHeight(fillToCap: boolean, capPct?: number): number {
  return Dimensions.get('window').height * (capPct ?? (fillToCap ? 0.4 : 0.5));
}

/**
 * Whether the shell uses a FIXED `height` (vs a content-sized `maxHeight` ceiling).
 *
 * `fillToCap` sheets (`AddToCart` / `NotifyRestock`) always fill fixed (unchanged). Any
 * NON-`fillToCap` sheet ALSO switches to fixed `height` the moment it receives an explicit
 * `capPct` (rb-rn-sheetkit-resize-dismiss-unify) — without this, dragging the handle UP would
 * only raise the `maxHeight` ceiling, which has NO visible effect on a content-sized sheet
 * whose content is already shorter than that ceiling (a `maxHeight` only caps, it never force-
 * fills). The first `capPct` ever fed to a content-sized sheet is always the presenter's
 * latched FLOOR fraction — i.e. the fraction that reproduces this sheet's own just-rendered
 * `maxHeight` height exactly — so this mode switch is a same-pixel no-op the instant it first
 * happens (see this change's design.md Decision 3 for the full argument); only a SUBSEQUENT
 * user drag actually changes the rendered height, which is the intended, visible feedback.
 *
 * `capPct === undefined` (a leaf rendered outside any drag-gesture wiring, e.g. an isolated
 * demo / structural snapshot construction) falls back to the pre-existing `fillToCap`-only
 * rule, byte-identical to before this capability existed.
 */
function usesFixedHeight(fillToCap: boolean, capPct: number | undefined): boolean {
  return fillToCap || capPct != null;
}

/** Props for the {@link SheetScaffold}. */
export interface SheetScaffoldProps {
  /** The resolved reference-ui theme (drives the shell background). */
  readonly theme: ReferenceUITheme;
  /** PINNED header region (grab handle + title + close) — never scrolls. */
  readonly header: ReactNode;
  /** Scrollable body region — scrolls when its content exceeds the ½-screen cap. */
  readonly body: ReactNode;
  /** PINNED footer region (CTA / toggle row) — never scrolls. `undefined` → no footer. */
  readonly footer?: ReactNode;
  /** `true` → 固定高度填滿到 cap（內容頂部、footer 釘底、不足處留白、超出捲動），cap 採 0.4 螢幕
   *  （rb-rn-compact-sheet-cap-and-footer，parity iOS/Android/Flutter）。`false`（預設）→
   *  content-sized + 0.5 cap（既有行為）。 */
  readonly fillToCap?: boolean;
  /**
   * Explicit cap-fraction override (design `LBPBottomSheet.heightPct`, fed by the shared drag
   * gesture — rb-rn-sheetkit-resize-dismiss-unify) — a fraction of screen height (e.g. `0.6`).
   * `undefined` (a leaf rendered outside any drag-gesture wiring) → falls back to the
   * `fillToCap`-selected constant (0.4 / 0.5) exactly as before. A NON-`undefined` value ALSO
   * forces the fixed-`height` style mode regardless of `fillToCap` — see {@link usesFixedHeight}.
   */
  readonly capPct?: number;
  /** E2E test id forwarded onto the scaffold root (rb-rn-e2e-test-ids). Inert — lets a
   *  sheet surface (`productList` / `notifyRestockSheet` / `infoPanel`) carry its registry
   *  id WITHOUT a wrapper node, so the structural snapshot stays a pure testID add. */
  readonly testID?: string;
  /**
   * An IDENTITY value (e.g. `detail.productId` — NOT a fresh object/array constructed every
   * render) that, when it CHANGES, resets the scrollable {@link SheetScaffoldProps.body body}
   * back to the top (`scrollTo({ y: 0, animated: false })`). `undefined` (DEFAULT — every sheet
   * built on this scaffold that does not pass this prop: product list / `.addToCart` / notify-
   * restock / video-info panel) → the reset effect never runs, byte-identical to before this
   * prop existed.
   *
   * Exists for `rb-rn-recommendation-switch-scroll-reset`: the product-detail sheet SWAPS its
   * `detail` in place on the SAME mounted `<ProductDetail>` instance when the user taps a
   * "更多商品" recommendation card (see `ProductDetailSheetView.tsx`'s own `detail.productId`-keyed
   * photo-gallery reset `useEffect` for the identical "why this key" reasoning) — without an
   * explicit reset, the `<ScrollView>`'s scroll offset from the PREVIOUS product would otherwise
   * survive the swap. `SheetScaffold` itself has no concept of "product id"; it only compares this
   * opaque value across renders via `useEffect`'s dependency-array semantics.
   */
  readonly scrollResetKey?: string | number;
}

/**
 * The shared bottom-sheet scaffold: a top-rounded shell capped to ½ the screen height,
 * with a PINNED {@link SheetScaffoldProps.header header}, a scrollable
 * {@link SheetScaffoldProps.body body} (`<ScrollView>`), and a PINNED
 * {@link SheetScaffoldProps.footer footer}. The body absorbs overflow by scrolling
 * between the two pinned chrome regions (parity iOS `LBSheetScaffold`).
 */
export function SheetScaffold(props: SheetScaffoldProps): ReactElement {
  const { theme, header, body, footer, fillToCap = false, capPct, testID, scrollResetKey } = props;
  const cap = sheetCapHeight(fillToCap, capPct);
  const fixedHeight = usesFixedHeight(fillToCap, capPct);

  // Scroll-position reset on content swap (rb-rn-recommendation-switch-scroll-reset). `undefined`
  // (every caller that doesn't pass `scrollResetKey`) → early return, `scrollTo` is never called —
  // byte-identical to before this capability existed. A DEFINED value that CHANGES (e.g. the
  // product-detail sheet's `detail.productId` swapping to a different product on the SAME mounted
  // instance) → snap the body back to the top; `animated: false` because this reads as "a new
  // sheet of content just opened", not a smooth in-place scroll (parity with this component
  // family's other product-switch resets — the gallery photo index, the variant/qty defaults —
  // which are likewise instant, not animated).
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (scrollResetKey === undefined) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollResetKey]);

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: theme.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        // 固定 height = cap（body 填滿、下方留白 / 捲動）；否則 maxHeight 上限、content-sized。
        // `fillToCap` sheets are always fixed; a non-fillToCap sheet ALSO goes fixed once it
        // receives a live `capPct` from the drag gesture (usesFixedHeight, see above).
        ...(fixedHeight ? { height: cap } : { maxHeight: cap }),
      }}
    >
      {/* Pinned header (never scrolls). */}
      {header}
      {/* Scrollable body — `flex: 1`（固定填滿）填滿剩餘空間（內容頂部、下方留白）；否則
          `flexShrink: 1` content-sized（短 sheet 取內容高、長 sheet 捲動，footer 恆可見）。 */}
      <ScrollView ref={scrollRef} style={fixedHeight ? { flex: 1 } : { flexShrink: 1 }}>{body}</ScrollView>
      {/* Pinned footer (never scrolls). */}
      {footer ?? null}
    </View>
  );
}
