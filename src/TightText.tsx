import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { Text as RNText } from 'react-native';
import type { TextProps } from 'react-native';

// MARK: - Tight text (rb-rn-refui-text-tighten-line-spacing)
//
// RN `<Text>` on Android renders through an Android `TextView` whose default
// `includeFontPadding = true` adds the font's ascent/descent padding, making line spacing
// LOOSER than the design (`design/templates/minimal/*.jsx`, line-height 1.0–1.4) and looser
// than iOS (the `UILabel` backend adds no such padding). This is the RN parity of the Android
// `rb-android-refui-text-tighten-line-spacing` fix (Compose `includeFontPadding`).
//
// Mechanism (parity of Android's `ProvideTightText` CompositionLocal): a context-gated drop-in
// `Text`. The drop-in 容器 (`LivebuyPlayer` / `LivebuyWidget` / `CollapsibleLivebuyPlayer`) wrap
// their content in <ProvideTightText>, flipping the context true → every descendant `Text` (which
// imports THIS `Text`, not react-native's) renders with `includeFontPadding: false` (Android-only;
// a no-op on iOS). OUTSIDE a provider the context stays false → this `Text` is a TRANSPARENT
// passthrough of react-native `Text` (identical props), so unit-test sub-view snapshots — which
// render surfaces directly, NOT through a container — keep their existing baselines byte-for-byte.

const TightTextContext = createContext<boolean>(false);

/** Wrap drop-in container content so every descendant {@link Text} tightens its line spacing. */
export function ProvideTightText(props: { children: ReactNode }): ReactElement {
  return <TightTextContext.Provider value={true}>{props.children}</TightTextContext.Provider>;
}

/**
 * Drop-in replacement for react-native `Text`. Transparent passthrough by default; under
 * {@link ProvideTightText} it appends `includeFontPadding: false` (Android line-spacing tighten,
 * no-op on iOS). Import THIS instead of react-native's `Text` in reference-ui surfaces.
 */
export function Text(props: TextProps): ReactElement {
  const tight = useContext(TightTextContext);
  if (!tight) {
    return <RNText {...props} />;
  }
  const { style, ...rest } = props;
  return <RNText style={[style, { includeFontPadding: false }]} {...rest} />;
}
