// LivebuyReferenceUISmoke — minimal chain-proof `.tsx` component.
//
// Spec: `reference-ui-rendering/spec.md`
//   § "RN Reference-UI 像素只在 livebuy-react-native-reference-ui 層
//      (template / core 零像素外洩)"
// Design: rb-rn-scaffold design.md D4.
//
// RN parity of iOS `ReferenceUISmokeView`, Android `LivebuyReferenceUISmoke`,
// and Flutter `LivebuyReferenceUISmoke`. This is the scaffold's sole pixel
// artifact: it proves the chain
//   livebuy-react-native-reference-ui -> livebuy-react-native-ui -> livebuy-react-native
//   (reference-ui                        template                   core)
// compiles AND renders a tiny tree. It does NOT render any family's full pixels
// (player-shell / feed-win / product-sheets / moments / widget / gap-surfaces) —
// that is each family change's job.
//
// === iOS / Android / Flutter lessons baked in for future families ===
//
//  1. DETERMINISM > convenience. AVOID scrollable RN containers
//     (ScrollView / FlatList / SectionList) for content that must appear in a
//     structural baseline — use plain View / Text and have the host forward
//     scroll (parity to the iOS "pure VStack/HStack + host forwards" rule).
//  2. A GREEN snapshot != correct pixels. The RN snapshot guards the component
//     TREE structure / props / text; true visual fidelity stays anchored to the
//     iOS / Android / Flutter PNG baselines + design/templates/minimal/*.jsx.
//  3. Short latin displayName for deterministic text; CJK deferred to families.

import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from './TightText';

import type { ReferenceUITheme } from './theme';
import type { DefaultPlayerTemplate } from 'livebuy-react-native-ui';

/** Props for the smoke component. */
export interface LivebuyReferenceUISmokeProps {
  /** The resolved reference-ui theme (from `ReferenceUIThemeResolver.resolve`). */
  readonly theme: ReferenceUITheme;
  /**
   * A label drawn into the smoke surface (e.g. an identity name). null /
   * undefined falls back to a stable placeholder so the tree stays deterministic.
   */
  readonly displayName?: string | null;
}

/**
 * A minimal, deterministic themed component that applies the resolved
 * [ReferenceUITheme] (background / accent / text / cornerRadius / fontScale all
 * applied) plus a label — proving the RN pixel chain works end-to-end.
 *
 * Uses only plain `View` / `Text` (NO ScrollView / FlatList / SectionList) so
 * it renders deterministically under the structural snapshot (see lesson 1).
 */
export function LivebuyReferenceUISmoke(
  props: LivebuyReferenceUISmokeProps,
): ReactElement {
  const { theme, displayName } = props;
  const name = displayName ?? 'Guest';
  return (
    <View
      style={{
        // Themed surface — the resolved background + cornerRadius tokens.
        backgroundColor: theme.background,
        borderRadius: theme.cornerRadius,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Accent swatch — the resolved accent token, drawn as a rounded chip. */}
      <View
        style={{
          width: 120,
          height: 48,
          backgroundColor: theme.accent,
          borderRadius: theme.cornerRadius,
        }}
      />
      {/* A themed label — applies the text color + font scale tokens. */}
      <Text
        style={{
          color: theme.text,
          fontSize: 14 * theme.fontScale,
          fontWeight: '600',
          marginTop: 12,
        }}
      >
        {`reference-ui · ${name}`}
      </Text>
    </View>
  );
}

/**
 * Read the host-bindable identity-label display name off the Default player
 * template, proving the dependency chain compiles against template + core
 * (`livebuy-react-native-ui` → `livebuy-react-native`). Returns null when the
 * template is null/undefined or no `AUTH_STATE_CHANGED` has arrived yet (the
 * view-model's `identityLabelState` is null until then).
 *
 * Pure read — it does NOT mutate the template or feed it events (the host owns
 * that wiring). reference-ui only READS existing host-bindable view-models.
 */
export function smokeIdentityName(
  template: DefaultPlayerTemplate | null | undefined,
): string | null {
  return template?.identityLabelState?.displayName ?? null;
}
