/**
 * Analytics facade (issues #15, #161).
 *
 * This file is now a thin, consent-gated front door onto `lib/measurement`.
 * Google Analytics 4 is the only eligible provider, there is no Plausible
 * fallback, and no environment variable can switch collection on: production is
 * hard-disabled in `lib/measurement/activation.ts` and stays that way until the
 * separately approved activation change under website #83.
 *
 * `trackEvent` is allowlisted. A call with an unknown event name, an unexpected
 * key or an unlisted value is dropped whole and never logged, so a new callsite
 * cannot widen collection by accident. See `docs/analytics.md`.
 */

import { measurement } from "./measurement/index.ts";

/** Called once from `main.tsx`, before React mounts. Idempotent. */
export function initAnalytics(): void {
  measurement.init();
}

/** Fires an allowlisted event. Silently ignored in every other case. */
export function trackEvent(name: string, props?: Record<string, string>): void {
  measurement.trackEvent(name, props);
}
