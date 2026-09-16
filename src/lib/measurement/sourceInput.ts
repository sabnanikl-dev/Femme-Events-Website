/**
 * Strict decoding of arrival source input.
 *
 * Only the complete, exactly decoded GBP tuple
 * `utm_source=google&utm_medium=organic&utm_campaign=gbp` is recognised.
 * Everything else that looks like campaign input — a duplicate key, a
 * mixed-case key or value, a missing member, a stray `utm_*` field, a click
 * identifier, invalid percent encoding, an oversized value — is classified as
 * unsupported source input. Unsupported input never produces a candidate, and
 * it clears any previously recognised GBP state rather than being relabelled.
 *
 * Unrelated, non-campaign query fields (for example `?service=the-full-femme`)
 * are ignored: they coexist happily, and they are never persisted, logged or
 * sent to the provider.
 */

import { APPROVED_SOURCE, MAX_SEARCH_LENGTH, MAX_SOURCE_VALUE_LENGTH } from "./policy.ts";

/** Click identifiers. Their presence alone makes the input unsupported. */
const CLICK_ID_KEYS = [
  "gclid",
  "gclsrc",
  "gbraid",
  "wbraid",
  "dclid",
  "gad_source",
  "srsltid",
  "fbclid",
  "msclkid",
  "ttclid",
  "twclid",
  "li_fat_id",
  "irclickid",
  "epik",
  "mc_cid",
  "mc_eid",
  "_gl",
];

const CLICK_ID_SET = new Set(CLICK_ID_KEYS);

/** Case-insensitive test: does this key claim to be campaign input at all? */
function isSourceBearingKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith("utm_") || CLICK_ID_SET.has(lower);
}

/** Cheap raw scan used when the input is too malformed or too long to parse. */
function rawLooksSourceBearing(raw: string): boolean {
  const lower = raw.toLowerCase();
  if (lower.includes("utm_")) return true;
  return CLICK_ID_KEYS.some((key) => lower.includes(key));
}

export type SourceClassification = "none" | "gbp" | "unsupported";

/**
 * Classifies a raw `location.search` string.
 *
 * - `none` — no campaign input present; existing state is untouched.
 * - `gbp` — the exact approved tuple, and nothing else campaign-shaped.
 * - `unsupported` — campaign-shaped input that is not the approved tuple.
 */
export function classifySearch(search: string): SourceClassification {
  if (typeof search !== "string") return "none";
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (raw === "") return "none";

  // Oversized input produces no candidate. It still counts as unsupported when
  // it is campaign-shaped, so it cannot silently preserve older attribution.
  if (raw.length > MAX_SEARCH_LENGTH) {
    return rawLooksSourceBearing(raw) ? "unsupported" : "none";
  }

  const seen = new Map<string, string>();
  let duplicate = false;

  for (const segment of raw.split("&")) {
    if (segment === "") continue;
    const eq = segment.indexOf("=");
    const rawKey = eq === -1 ? segment : segment.slice(0, eq);
    const rawValue = eq === -1 ? null : segment.slice(eq + 1);

    let key: string;
    try {
      key = decodeURIComponent(rawKey);
    } catch {
      // Undecodable key: we cannot prove it is unrelated, so fail closed if the
      // query is campaign-shaped at all.
      return rawLooksSourceBearing(raw) ? "unsupported" : "none";
    }
    if (!isSourceBearingKey(key)) continue;

    // A campaign key with no value at all is malformed input, not a candidate.
    if (rawValue === null) return "unsupported";

    let value: string;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      return "unsupported";
    }
    // Decode exactly once. Never trim, lowercase or otherwise repair a value.
    if (value.length > MAX_SOURCE_VALUE_LENGTH) return "unsupported";
    if (seen.has(key)) duplicate = true;
    seen.set(key, value);
  }

  if (seen.size === 0) return "none";
  // A repeated campaign key is rejected even when both values are valid.
  if (duplicate) return "unsupported";
  if (seen.size !== 3) return "unsupported";
  if (seen.get("utm_source") !== APPROVED_SOURCE.source) return "unsupported";
  if (seen.get("utm_medium") !== APPROVED_SOURCE.medium) return "unsupported";
  if (seen.get("utm_campaign") !== APPROVED_SOURCE.campaign) return "unsupported";
  return "gbp";
}
