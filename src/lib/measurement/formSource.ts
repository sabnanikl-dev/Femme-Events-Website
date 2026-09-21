/**
 * Whether the approved source tuple may accompany the inquiry request.
 *
 * Two independent gates, and the production one is hard-false in source:
 *
 * 1. `FORMSPREE_SOURCE_FIELDS_APPROVED` — the production answer. It stays
 *    `false` until the Formspree/forwarded-email/export retention decision is
 *    recorded under website #83. No environment value can reach it.
 * 2. The local fixture path — measurement mode `fixture` (which already needs
 *    the reserved Vite mode, the opt-in token *and* a loopback host) plus an
 *    endpoint that is provably inert: same-origin, loopback, or a reserved
 *    `.invalid` host (RFC 6761: never resolvable). The browser fixtures
 *    intercept that endpoint before navigation, so a synthetic inquiry carrying
 *    source fields cannot leave the machine.
 *
 * Anything else — production mode, an unapproved mode, or a fixture build
 * pointed at a real endpoint — is refused, so source fields can never reach a
 * live backend by configuration alone.
 */

import { FIXTURE_ALLOWED_HOSTS, FORMSPREE_SOURCE_FIELDS_APPROVED } from "./activation.ts";
import type { MeasurementMode } from "./env.ts";

export type SourceFieldDecision = {
  allowed: boolean;
  /** Machine-readable, for docs and tests. Never contains the endpoint value. */
  reason:
    | "production-approved"
    | "production-approval-pending"
    | "not-fixture-mode"
    | "no-endpoint"
    | "endpoint-not-inert"
    | "fixture-inert-endpoint";
};

/**
 * An endpoint that cannot reach a real backend from a fixture run: a
 * same-origin relative path, a loopback host, or the reserved `.invalid` TLD.
 */
export function isInertFixtureEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint === "") return false;
  // Same-origin relative path. The fixture origin is already loopback-only.
  if (endpoint.startsWith("/") && !endpoint.startsWith("//")) return true;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (FIXTURE_ALLOWED_HOSTS.includes(host)) return true;
  return host === "invalid" || host.endsWith(".invalid");
}

export function decideSourceFields(mode: MeasurementMode, endpoint: string): SourceFieldDecision {
  if (FORMSPREE_SOURCE_FIELDS_APPROVED) {
    return { allowed: true, reason: "production-approved" };
  }
  if (mode !== "fixture") {
    return {
      allowed: false,
      reason: mode === "live" ? "production-approval-pending" : "not-fixture-mode",
    };
  }
  if (!endpoint) return { allowed: false, reason: "no-endpoint" };
  if (!isInertFixtureEndpoint(endpoint)) return { allowed: false, reason: "endpoint-not-inert" };
  return { allowed: true, reason: "fixture-inert-endpoint" };
}
