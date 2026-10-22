// sdkConfigResolution — how the three Tier B containers obtain the SDKConfig
// (rb-rn-container-sdk-config-retry).
//
// A container that is mounted BEFORE the host's `LivebuySDK.configure()` has completed asks for the
// SDKConfig too early: `getSdkConfig()` rejects (NOT_CONFIGURED). The containers used to ask exactly
// once, so such a container stayed without a config — and therefore without a template attachment,
// rendering nothing — for as long as it lived. That is the ordinary shape of a host screen that
// calls `configure()` in the same `useEffect` pass that mounts `<LivebuyWidget>` (child effects run
// before the parent's), and it produced a permanently blank widget in a release build.
//
// The lookup now retries on rejection, on a bounded schedule, until it resolves or the container
// unmounts. An explicit `config.sdkConfig` still wins and issues no lookup at all.
//
// When every retry has failed (rb-rn-container-sdk-config-gave-up-fallback, parity Flutter
// `onGaveUp` / iOS / Android "skip first load, keep the periodic refresh"), the container no longer
// stays without a config: `useSdkConfig` settles on {@link LB_FALLBACK_SDK_CONFIG}, so the widget
// still builds its template, attempts its first load and arms its periodic refresh — a host that
// configures very late is then picked up by the next refresh tick. The theme stays the default.

import { useEffect, useState } from 'react';

import { LivebuySDK } from 'livebuy-react-native';
import type { SDKConfig } from 'livebuy-react-native';

/** Delay before retry #0, #1, #2, #3; every later retry waits {@link SDK_CONFIG_RETRY_STEADY_MS}. */
export const SDK_CONFIG_RETRY_RAMP_MS: readonly number[] = [100, 200, 400, 800];

/** Delay between retries once the ramp is exhausted. */
export const SDK_CONFIG_RETRY_STEADY_MS = 1000;

/**
 * Retries issued after the first failed lookup before giving up (≈ 31.5 s in total). `configure()`
 * itself blocks for at most ~5 s on a cold start, so this leaves ample room; a host that never
 * configures stops being polled instead of costing a bridge call per second forever.
 */
export const SDK_CONFIG_MAX_RETRIES = 34;

/**
 * PURE: the wait before retry number `attempt` (0-based, counted after the first failed lookup),
 * or `null` when no further retry should be issued.
 */
export function lbSdkConfigRetryDelayMs(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= SDK_CONFIG_MAX_RETRIES) return null;
  return SDK_CONFIG_RETRY_RAMP_MS[attempt] ?? SDK_CONFIG_RETRY_STEADY_MS;
}

/**
 * The SDKConfig a container settles on once every retry has failed: visibility / theme / behavior /
 * layout all `null`, no extensions — the same shape as the native cores' "no cache + fetch failed"
 * fallback default and Flutter's `SDKConfig.fallback` (`SDKConfig(schemaVersion: 1)`).
 * `livebuy-react-native` exports no such constant (only the `SDKConfig` type), so it is built here
 * from that type rather than adding one to the core. Frozen: shared by every container instance.
 */
export const LB_FALLBACK_SDK_CONFIG: SDKConfig = Object.freeze({
  schemaVersion: 1,
  visibility: null,
  theme: null,
  behavior: null,
  layout: null,
  extensions: Object.freeze({}) as Record<string, unknown>,
});

/** Side effects of {@link resolveSdkConfigWithRetry}, injected so the loop is testable. */
export interface SdkConfigResolutionDeps {
  readonly getSdkConfig: () => Promise<SDKConfig>;
  readonly schedule: (run: () => void, delayMs: number) => unknown;
  readonly cancelSchedule: (handle: unknown) => void;
  readonly onResolved: (config: SDKConfig) => void;
  /**
   * Called at most once, when the last retry in the budget has failed (never after cancel, never
   * after `onResolved`). Optional — omitting it keeps the original "simply stop" behaviour.
   */
  readonly onGaveUp?: () => void;
}

/**
 * Ask for the SDKConfig; on rejection retry per {@link lbSdkConfigRetryDelayMs}. Calls
 * `onResolved` at most once; when every retry failed, calls `onGaveUp` (if given) once. Returns a cancel function: after it runs nothing further is
 * scheduled and a lookup still in flight is ignored.
 */
export function resolveSdkConfigWithRetry(deps: SdkConfigResolutionDeps): () => void {
  let cancelled = false;
  let pending: unknown = null;

  const attemptLookup = (retriesIssued: number): void => {
    deps
      .getSdkConfig()
      .then((config) => {
        if (!cancelled) deps.onResolved(config);
      })
      .catch(() => {
        if (cancelled) return;
        const delay = lbSdkConfigRetryDelayMs(retriesIssued);
        if (delay == null) {
          deps.onGaveUp?.();
          return;
        }
        pending = deps.schedule(() => {
          pending = null;
          if (!cancelled) attemptLookup(retriesIssued + 1);
        }, delay);
      });
  };

  attemptLookup(0);

  return () => {
    cancelled = true;
    if (pending != null) deps.cancelSchedule(pending);
    pending = null;
  };
}

/**
 * The SDKConfig for a container: `explicit` when the host supplied one, else
 * `LivebuySDK.getSdkConfig()` — retried while the SDK is not configured yet. `null` until resolved;
 * {@link LB_FALLBACK_SDK_CONFIG} once every retry has failed (it is NOT replaced if the host
 * configures later — the widget's periodic refresh picks the list up; the theme stays default).
 */
export function useSdkConfig(explicit: SDKConfig | null | undefined): SDKConfig | null {
  const [resolved, setResolved] = useState<SDKConfig | null>(explicit ?? null);
  useEffect(() => {
    if (explicit != null) {
      setResolved(explicit);
      return;
    }
    return resolveSdkConfigWithRetry({
      getSdkConfig: () => LivebuySDK.getSdkConfig(),
      schedule: (run, delayMs) => setTimeout(run, delayMs),
      cancelSchedule: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      onResolved: setResolved,
      onGaveUp: () => setResolved(LB_FALLBACK_SDK_CONFIG),
    });
  }, [explicit]);
  return resolved;
}
