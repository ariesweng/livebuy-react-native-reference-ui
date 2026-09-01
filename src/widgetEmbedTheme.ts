// ReferenceUIWidgetEmbedTheme — widget-scope embed-color derivation (PURE TypeScript).
//
// Spec: `widget-embed-colors/spec.md`
// Design: rb-rn-widget-embed-colors design.md RD1–RD6.
// RN sibling of iOS `ReferenceUIWidgetEmbedTheme.swift` (rb-ios-widget-embed-colors,
// a5736fc1) and Android `ReferenceUIWidgetEmbedTheme.kt` (rb-android-widget-embed-colors,
// a75ee327).
//
// A SECOND, NARROWER step that runs AFTER `ReferenceUIThemeResolver` and ONLY on the
// widget surfaces (`Carousel` — both its windowed and `scrollable` branches — and
// `VideoShopGrid`). It takes the already-resolved theme and overlays the two web-embed
// colors from `POST /sdk/widget`:
//
//     ReferenceUIThemeResolver.resolve(...)   →  ReferenceUITheme   (global)
//                                                      │
//              widgetColor / widgetBgcolor  ──▶  derive(...)        (widget only)
//                                                      │
//                                                      ▼
//                             Carousel  /  VideoShopGrid
//
// WHY NOT FEED THE RESOLVER: `background` / `text` are GLOBAL tokens — the player shell,
// the product sheets, `WinClaimSheet`, the auth gate and dozens of other surfaces read
// them. Injecting a merchant's widget colors into the resolver would tint all of them.
// The resolver stays UNTOUCHED and still MUST NOT see these two values
// (`reference-ui-rendering` § 解析器輸出不受 widget 顏色影響).
//
// WHY NOT DERIVE ON A SHARED THEME EITHER (the RN-specific trap, design RD2): RN's
// `WidgetOverlayView` is the SINGLE dispatcher for all four widget surfaces
// (carousel / grid / floating / minimized) and hands the SAME `theme` prop to each
// branch. Deriving at the top of its body — or one level up on
// `WidgetSurfaceContext.theme`, which is the very object fed to it — would be one tidy
// line and would tint the floating card and the minimized pill. Android has the same
// trap one level higher (its design seam); iOS has none (its floating card takes a
// video, not a shared context). The derivation therefore lives INSIDE the two surface
// components.
//
// Effective priority (high → low):
//
//     sdkConfig.theme  >  widget colors (here)  >  LBUIOptions  >  minimal palette
//
// Pure — no global reads, NO react / react-native import, runnable in plain node.

import type { ReferenceUITheme } from './theme';
import { colorFromHex } from './theme';

/** `widget_color === 2`（色彩反轉）的文字色，對齊 web embed 渲染端的 `#ffffff`. */
export const INVERTED_TEXT_HEX = '#FFFFFF';

/** The wire value of `widget_color` meaning「色彩反轉」(inverted text). */
export const INVERTED_COLOR_MODE = 2;

/**
 * Overlay the `/sdk/widget` embed colors onto an already-resolved theme.
 *
 * Shaped like the sibling `ReferenceUIThemeResolver` (an object literal with one
 * method), and named / parameterised exactly like iOS `ReferenceUIWidgetEmbedTheme
 * .derive(from:widgetColor:widgetBgcolor:)` and Android `ReferenceUIWidgetEmbedTheme
 * .derive(theme, widgetColor, widgetBgcolor)`.
 */
export const ReferenceUIWidgetEmbedTheme = {
  /**
   * - `widgetColor` `2`（色彩反轉）→ `text` becomes `#FFFFFF`. `1`（預設色彩）and every
   *   other value leave `text` UNTOUCHED. Web's `1` means "emit no color override" — its
   *   native equivalent is keeping the resolved `text`, NOT adopting the third-party
   *   page's `#3C3C3C` body default (design D1).
   * - `widgetBgcolor` overrides `background` ONLY when it parses as a hex color. The
   *   empty string `''`（後端的「透明」表示法）, `null`, `undefined` and any unparseable
   *   string all mean "leave it alone" (design D2) — `colorFromHex` rejects every one of
   *   them, so they land on the same branch without a special case. `''` in particular
   *   MUST NOT become a transparent background: web's transparency has a third-party page
   *   underneath it, native has no equivalent backing surface.
   *
   * Value-domain tolerance (numeric string `"2"` → `2`, unparseable → `1`) is core's job
   * per `widget-decode-robustness`; this function does NOT redo it.
   *
   * @returns a theme where at most `text` / `background` differ. When nothing is
   *          configured it returns **the very same object** it was handed (design RD4):
   *          RN's `ReferenceUITheme` is an object, so "unconfigured is an identity"
   *          strengthens from value equality to REFERENCE equality — which both makes D6
   *          provable with `toBe` and keeps any downstream `React.memo` / `useMemo` keyed
   *          on the theme from churning. The input is never mutated.
   */
  derive(
    theme: ReferenceUITheme,
    widgetColor: number,
    widgetBgcolor: string | null | undefined,
  ): ReferenceUITheme {
    const text = widgetColor === INVERTED_COLOR_MODE ? INVERTED_TEXT_HEX : theme.text;
    const background = colorFromHex(widgetBgcolor) ?? theme.background;

    // Unconfigured (or configured to exactly what is already resolved) → hand back the
    // same reference, so existing snapshots and existing render identity are untouched.
    if (text === theme.text && background === theme.background) return theme;

    // Spread (not a field-by-field rebuild) so a future token added to `ReferenceUITheme`
    // is carried through untouched by construction.
    return { ...theme, text, background };
  },
};
