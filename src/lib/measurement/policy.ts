/**
 * Approved measurement policy constants — FEMME-GA4-v1 (issue #161).
 *
 * Every number and key here traces to the approved policy. Nothing in this file
 * may be widened by an environment variable at runtime: activation is a
 * separately approved code change (see `activation.ts` and website #83).
 */

/** Policy version stamped into the stored consent record. */
export const MEASUREMENT_POLICY_VERSION = "FEMME-GA4-v1";

/* ── Consent preference (necessary storage: choice + version + expiry only) ── */

export const CONSENT_STORAGE_KEY = "femme.analytics.consent.v1";
export const CONSENT_RECORD_VERSION = 1;
/** Six months. Kept as an explicit day count so the value is auditable. */
export const CONSENT_TTL_DAYS = 183;
export const CONSENT_TTL_MS = CONSENT_TTL_DAYS * 24 * 60 * 60 * 1000;

/* ── Website source attribution (same-tab only, never a marketing identifier) ─ */

export const SOURCE_STORAGE_KEY = "femme.analytics.source.v1";
export const SOURCE_RECORD_VERSION = 1;
/** 30-minute idle expiry, checked before every use and every activity refresh. */
export const SOURCE_IDLE_TTL_MS = 30 * 60 * 1000;

/**
 * Same-tab arrival ledger. Holds two integers and no marketing values: how many
 * source-bearing arrivals this tab has seen, and how many have been consumed
 * (promoted, refused or revoked). It is what stops a reload, a history
 * traversal or a later re-grant from resurrecting an already-revoked arrival.
 */
export const ARRIVAL_LEDGER_KEY = "femme.analytics.arrival.v1";
export const ARRIVAL_LEDGER_VERSION = 1;

/* ── Strict source-input bounds (approved proposals) ── */

export const MAX_SEARCH_LENGTH = 2048;
export const MAX_SOURCE_VALUE_LENGTH = 64;

/** The only recognised arrival tuple. Exact, decoded, case-sensitive. */
export const APPROVED_SOURCE = {
  source: "google",
  medium: "organic",
  campaign: "gbp",
} as const;

/* ── Inquiry request lifecycle ── */

export const INQUIRY_TIMEOUT_MS = 15_000;

/* ── Safe provider context ── */

/** Canonical origin reported to the provider instead of the real URL. */
export const SAFE_ORIGIN = "https://femmeevents.com";
/** Single static title. CMS titles and document.title are never sent. */
export const SAFE_TITLE = "Femme Events";
/** Analytics referrer is always empty; the raw referrer is never forwarded. */
export const SAFE_REFERRER = "";

/** GA4 cookie names in scope for selective cleanup, by measurement id. */
export function ga4CookieNames(measurementId: string): string[] {
  const container = measurementId.replace(/^G-/, "");
  return ["_ga", `_ga_${container}`];
}

/** The documented per-measurement-id opt-out property on `window`. */
export function gaDisableFlagName(measurementId: string): string {
  return `ga-disable-${measurementId}`;
}
