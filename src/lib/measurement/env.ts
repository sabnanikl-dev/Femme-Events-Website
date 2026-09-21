/**
 * Environment reading and provider selection.
 *
 * `import.meta.env` is statically replaced by Vite in every browser build, so
 * the `globalThis` fallback below only ever resolves outside Vite — i.e. in the
 * `node --test` measurement suite, which needs to drive the same resolver
 * through production and fixture configurations. It is not a runtime switch:
 * in a built bundle the fallback branch is unreachable.
 */

import {
  FIXTURE_ALLOWED_HOSTS,
  FIXTURE_MODE_NAME,
  FIXTURE_OPT_IN_TOKEN,
  MEASUREMENT_ACTIVATION_APPROVED,
} from "./activation.ts";

export type MeasurementEnv = {
  MODE?: string;
  VITE_GA4_MEASUREMENT_ID?: string;
  VITE_PLAUSIBLE_DOMAIN?: string;
  VITE_PLAUSIBLE_API_HOST?: string;
  VITE_MEASUREMENT_FIXTURE?: string;
  VITE_FORMSPREE_ENDPOINT?: string;
};

/**
 * GA4 measurement ids are `G-` followed by uppercase alphanumerics; Google
 * documents a ten-character suffix, and the bounds below leave a little room
 * without accepting obvious rubbish. Syntactic validity is never proof that the
 * id points at the intended destination - that is a website #83 check.
 */
const GA4_ID_PATTERN = /^G-[A-Z0-9]{8,12}$/;

export function readEnv(): MeasurementEnv {
  const viteEnv = import.meta.env as MeasurementEnv | undefined;
  if (viteEnv) return viteEnv;
  const override = (globalThis as { __FEMME_MEASUREMENT_ENV__?: MeasurementEnv }).__FEMME_MEASUREMENT_ENV__;
  return override ?? {};
}

export type MeasurementMode = "disabled" | "fixture" | "live";

export type MeasurementConfig = {
  mode: MeasurementMode;
  /** Present only when a syntactically valid GA4 id was configured. */
  measurementId: string | null;
  /** Machine-readable reason, for docs/tests. Never contains env values. */
  reason:
    | "no-measurement-id"
    | "malformed-measurement-id"
    | "conflicting-provider-config"
    | "activation-not-approved"
    | "fixture-mode"
    | "activation-approved";
};

function currentHostname(): string {
  const loc = (globalThis as { location?: { hostname?: string } }).location;
  return typeof loc?.hostname === "string" ? loc.hostname : "";
}

/**
 * Selects the measurement mode. Fail-closed by construction: every branch that
 * is not an explicit, fully-satisfied approval returns `disabled`.
 */
export function resolveMeasurementConfig(env: MeasurementEnv = readEnv()): MeasurementConfig {
  // A Plausible configuration is never honoured and never falls back to GA4.
  // Any Plausible value present at all makes the whole configuration inert.
  if (env.VITE_PLAUSIBLE_DOMAIN || env.VITE_PLAUSIBLE_API_HOST) {
    return { mode: "disabled", measurementId: null, reason: "conflicting-provider-config" };
  }

  const rawId = env.VITE_GA4_MEASUREMENT_ID ?? "";
  if (!rawId) return { mode: "disabled", measurementId: null, reason: "no-measurement-id" };
  if (!GA4_ID_PATTERN.test(rawId)) {
    return { mode: "disabled", measurementId: null, reason: "malformed-measurement-id" };
  }

  // Local fixture path. All three conditions are required, and none of them can
  // be produced by a production Vercel environment variable on its own.
  const fixtureRequested =
    env.MODE === FIXTURE_MODE_NAME && env.VITE_MEASUREMENT_FIXTURE === FIXTURE_OPT_IN_TOKEN;
  if (fixtureRequested && FIXTURE_ALLOWED_HOSTS.includes(currentHostname())) {
    return { mode: "fixture", measurementId: rawId, reason: "fixture-mode" };
  }

  if (MEASUREMENT_ACTIVATION_APPROVED) {
    return { mode: "live", measurementId: rawId, reason: "activation-approved" };
  }
  return { mode: "disabled", measurementId: rawId, reason: "activation-not-approved" };
}
