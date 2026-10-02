// optionalSafeAreaContext — the ONE place this package touches `react-native-safe-area-context`
// (rb-rn-edge-to-edge-safe-area).
//
// `react-native-safe-area-context` is an OPTIONAL peer dependency: a host that already has it gets
// its insets picked up automatically; a host that does not must not crash, and its bundle must
// still build. Both are guaranteed by the shape of the `require` below:
//
//   - Metro marks a `require()` whose statement sits DIRECTLY inside a `try { … }` block as an
//     optional dependency (`transformer.allowOptionalDependencies`, on by default). An unresolved
//     optional dependency does not fail the bundle; it compiles to a `require` that throws at run
//     time, which the `catch` below turns into `null`. Do not move the `require` out of the `try`
//     block, wrap it in a helper call, or build the module name dynamically — any of those stops
//     Metro from recognising it.
//   - Under jest (no such module installed) `require` throws `Cannot find module`, same path.
//
// WHEN the `require` runs matters as much as its shape (rb-rn-optional-safe-area-require-at-init):
// it MUST execute while this module is being initialised — i.e. at module top level — and never
// later from inside a function. Metro's runtime (`metro-runtime/src/polyfills/require.js`,
// `guardedLoadModule`) only lets a failing `require` throw to its caller while some module load is
// already in progress. A `require` issued outside any module load — from a render, an effect, an
// event handler — becomes the guarded entry point itself: the "unknown module" error is handed
// straight to `ErrorUtils.reportFatalError` and the surrounding `try / catch` never sees it. In a
// release build that is a crash at the first render for every host WITHOUT the optional module
// (`Error: Requiring unknown module "undefined"`). Loading this module always happens inside a
// guarded load (whether eagerly at start-up or lazily through inline requires), so a top-level
// `require` reliably lands in the `catch`.
//
// The lookup runs once, at module initialisation; its validated result is cached on first read.

import { createContext } from 'react';
import type { ComponentType, Context, ReactNode } from 'react';

/** The subset of `react-native-safe-area-context`'s `EdgeInsets` this package reads. */
export interface OptionalEdgeInsets {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

/** The subset of `react-native-safe-area-context`'s `Rect` this package reads. */
export interface OptionalRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The exports of `react-native-safe-area-context` this package uses. */
export interface OptionalSafeAreaContextModule {
  readonly SafeAreaInsetsContext: Context<OptionalEdgeInsets | null>;
  readonly SafeAreaFrameContext: Context<OptionalRect | null>;
  readonly SafeAreaProvider: ComponentType<{ style?: unknown; children?: ReactNode }> | null;
}

// CommonJS `require` — the package ships untranspiled TypeScript and is compiled by the host's
// Metro / by ts-jest; neither environment declares it for this tsconfig (no `@types/node`).
declare const require: (id: string) => unknown;

/** Stand-in contexts for a host without the module: never provided, so always `null`. */
const ABSENT_INSETS_CONTEXT = createContext<OptionalEdgeInsets | null>(null);
const ABSENT_FRAME_CONTEXT = createContext<OptionalRect | null>(null);

// The module-initialisation-time lookup (see the header: this MUST stay at module top level).
let loaded: unknown = null;
try {
  loaded = require('react-native-safe-area-context');
} catch {
  loaded = null;
}

let cached: OptionalSafeAreaContextModule | null | undefined;

function isContext(value: unknown): boolean {
  return value != null && typeof value === 'object' && 'Provider' in (value as object);
}

/**
 * PURE: validate a loaded module object. Returns `null` unless it carries both contexts this
 * package reads — an unexpectedly old or stubbed module is treated exactly like a missing one.
 */
export function readSafeAreaContextModule(loaded: unknown): OptionalSafeAreaContextModule | null {
  if (loaded == null || typeof loaded !== 'object') return null;
  const mod = loaded as Record<string, unknown>;
  if (!isContext(mod.SafeAreaInsetsContext) || !isContext(mod.SafeAreaFrameContext)) return null;
  const provider = mod.SafeAreaProvider;
  return {
    SafeAreaInsetsContext: mod.SafeAreaInsetsContext as Context<OptionalEdgeInsets | null>,
    SafeAreaFrameContext: mod.SafeAreaFrameContext as Context<OptionalRect | null>,
    SafeAreaProvider:
      typeof provider === 'function' || (provider != null && typeof provider === 'object')
        ? (provider as ComponentType<{ style?: unknown; children?: ReactNode }>)
        : null,
  };
}

/** The host's `react-native-safe-area-context`, or `null` when it is not installed. Cached. */
export function loadOptionalSafeAreaContext(): OptionalSafeAreaContextModule | null {
  if (cached !== undefined) return cached;
  cached = readSafeAreaContextModule(loaded);
  return cached;
}

/**
 * The two contexts to read with `useContext`. Always returns real context objects so the calling
 * hook's order never depends on whether the module is installed.
 */
export function optionalSafeAreaContexts(): {
  readonly insets: Context<OptionalEdgeInsets | null>;
  readonly frame: Context<OptionalRect | null>;
} {
  const mod = loadOptionalSafeAreaContext();
  return {
    insets: mod?.SafeAreaInsetsContext ?? ABSENT_INSETS_CONTEXT,
    frame: mod?.SafeAreaFrameContext ?? ABSENT_FRAME_CONTEXT,
  };
}

/**
 * Test-only: drop the cached VALIDATION result. The raw module is captured once at module
 * initialisation, so a test that needs a different module must mock it before this file is first
 * required (`jest.mock(…, { virtual: true })`) or re-require this file (`jest.isolateModules`).
 */
export function _resetOptionalSafeAreaContextForTesting(): void {
  cached = undefined;
}
