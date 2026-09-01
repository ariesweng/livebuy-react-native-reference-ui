// rb-rn-scaffold — reference-ui theme model + resolver (PURE TypeScript).
//
// Parity source: flutter-reference-ui/lib/src/reference_ui_theme.dart
// (ReferenceUITheme + ReferenceUIThemeResolver, merge precedence core > host >
// minimal) and iOS/Android `ReferenceUIThemeResolver`. RN consumes hex strings
// directly (unlike Flutter's `Color` objects), so colors are kept as `#RRGGBB`
// strings.
//
// NO react / react-native imports — this is platform-agnostic theme logic,
// reliably testable in a plain node environment.
//
// Layer rule: reference-ui (this package) -> template (livebuy-react-native-ui)
//   -> core (livebuy-react-native). Type-only imports keep the one-way dep
//   purely structural.

import type { LBSdkTheme } from 'livebuy-react-native';
import type { LBUIOptions } from 'livebuy-react-native-ui';

/**
 * Resolved theme consumed by reference-ui surfaces. Colors are `#RRGGBB`
 * hex strings (RN style props accept hex directly).
 */
export interface ReferenceUITheme {
  accent: string;
  background: string;
  text: string;
  cornerRadius: number;
  fontScale: number;
}

/**
 * The minimal-palette default (source `design/templates/minimal/*.jsx`).
 * Same values as the iOS / Android / Flutter reference-ui scaffolds.
 */
export const MINIMAL_PALETTE: ReferenceUITheme = {
  accent: '#F03246',
  text: '#15131A',
  background: '#FFFFFF',
  cornerRadius: 12,
  fontScale: 1.0,
};

/**
 * Validate + normalize a hex color string to `#RRGGBB` (uppercase).
 * Accepts `#RRGGBB` or `RRGGBB`. Malformed / empty / nullish → `null`
 * (so the resolver falls through to the next precedence source).
 *
 * Mirrors the iOS / Android / Flutter `colorFromHex` contract.
 */
export function colorFromHex(hex: string | null | undefined): string | null {
  if (hex == null) return null;
  const trimmed = hex.trim();
  if (trimmed.length === 0) return null;
  const body = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(body)) return null;
  return `#${body.toUpperCase()}`;
}

/**
 * Pure, side-effect-free theme resolver.
 *
 * Field-wise merge with precedence **core > host > minimal**, mirroring
 * `ConfigMerger` (`sdkConfig.theme?.X ?? hostOptions?.theme?.X ?? templateDefault`).
 *
 * Core `LBSdkTheme` only carries `primaryColor` (→ accent) and `fontScale`;
 * `background` / `text` / `cornerRadius` are not overridable by core/host
 * (same as the other platforms) and always come from the minimal palette.
 */
export const ReferenceUIThemeResolver = {
  resolve(args: {
    coreTheme?: LBSdkTheme | null;
    hostOptions?: LBUIOptions | null;
  }): ReferenceUITheme {
    const { coreTheme, hostOptions } = args;
    const accent =
      colorFromHex(coreTheme?.primaryColor) ??
      colorFromHex(hostOptions?.theme?.primaryColor) ??
      MINIMAL_PALETTE.accent;
    const fontScale =
      coreTheme?.fontScale ?? hostOptions?.theme?.fontScale ?? MINIMAL_PALETTE.fontScale;
    return {
      accent,
      background: MINIMAL_PALETTE.background,
      text: MINIMAL_PALETTE.text,
      cornerRadius: MINIMAL_PALETTE.cornerRadius,
      fontScale,
    };
  },
};
