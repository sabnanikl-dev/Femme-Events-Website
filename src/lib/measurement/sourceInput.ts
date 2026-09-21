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

/** The prefix every campaign field shares, recognised case-insensitively. */
const UTM_PREFIX = "utm_";

/** Case-insensitive test: does this key claim to be campaign input at all? */
function isSourceBearingKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith(UTM_PREFIX) || CLICK_ID_SET.has(lower);
}

/**
 * The longest raw key worth decoding whole.
 *
 * Every *complete* recognised key is short ASCII (`utm_campaign` is the longest
 * at 12 characters, `gad_source` the longest click id at 10). Percent-encoding
 * costs at least one raw character per decoded ASCII character and at most
 * three, so a raw key longer than this cannot decode to one of them exactly.
 * Longer keys are not dismissed: their `utm_` prefix is still read, below.
 * Reusing the approved value bound keeps the number of input bounds in this
 * file at the two the policy fixes.
 */
const MAX_SOURCE_KEY_LENGTH = MAX_SOURCE_VALUE_LENGTH;

/**
 * Does this raw key start with the four ASCII characters of `utm_`?
 *
 * The prefix is settled by four decoded characters, so the walk reads at most
 * four raw units — a literal character, or a whole `%XX` escape — and stops at
 * the first one that is not the character `utm_` needs there. Nothing beyond
 * those units is looked at, which is what keeps the answer bounded for a key
 * of any length; it is not a policy bound and nothing in the approved policy
 * depends on it.
 *
 * Every character of the prefix is ASCII, so an escape carrying a byte outside
 * ASCII answers "no" outright and its continuation bytes are never read. A
 * valid multi-byte character after the prefix — `%75tm_%F0%9F%98%80…` — is
 * therefore just a suffix, where decoding a fixed slice of raw characters used
 * to split it, throw, and discard the `utm_` that had already been read.
 */
function hasEncodedUtmPrefix(rawKey: string): boolean {
  let at = 0;
  for (const expected of UTM_PREFIX) {
    if (at >= rawKey.length) return false;
    let char: string;
    if (rawKey[at] === "%") {
      const hex = rawKey.slice(at + 1, at + 3);
      // An invalid or non-ASCII escape cannot be this character. Saying so is
      // not a verdict on the key: the whole-key check below still runs.
      if (!/^[0-9a-f]{2}$/i.test(hex)) return false;
      const byte = Number.parseInt(hex, 16);
      if (byte > 0x7f) return false;
      char = String.fromCharCode(byte);
      at += 3;
    } else {
      char = rawKey[at];
      at += 1;
    }
    if (char.toLowerCase() !== expected) return false;
  }
  return true;
}

/**
 * Does this query contain a key that is campaign input once decoded?
 *
 * Used for input that is too long or too malformed to parse normally. Only
 * keys are read. Campaign input is a matter of what a field is called, so text
 * inside an unrelated value — `?note=…utm_source`, `?note=…gclid` — is ignored
 * here exactly as it is in a query of ordinary length, and cannot clear
 * attribution that is still valid. Keys are read decoded, though: a raw
 * substring scan would miss `%75tm_source`, which contains no `utm_`, and
 * quietly preserve whatever attribution was already held.
 *
 * Two bounded questions are asked of each key, and nothing is decoded twice:
 *
 * - Is it `utm_`-prefixed? Only the first few characters can answer that, so
 *   the answer holds for a key of any length — `%75tm_` + 130 characters is an
 *   unknown campaign field, not an unrelated one, however long it runs on.
 * - Is it a click id? That has to match a whole short key, and no key longer
 *   than the bound below can decode to one, so those keys are left alone.
 *
 * A key that will not decode is treated as campaign-shaped rather than assumed
 * harmless, on the same terms as before: within the whole-key bound. Length on
 * its own never makes a key campaign input — `%70ad` + 130 characters decodes
 * to `padxxx…` and stays unrelated.
 */
function looksSourceBearing(raw: string): boolean {
  for (const segment of raw.split("&")) {
    if (segment === "") continue;
    const eq = segment.indexOf("=");
    const rawKey = eq === -1 ? segment : segment.slice(0, eq);
    if (rawKey === "") continue;
    if (isSourceBearingKey(rawKey)) return true;

    if (hasEncodedUtmPrefix(rawKey)) return true;

    if (rawKey.length > MAX_SOURCE_KEY_LENGTH || !rawKey.includes("%")) continue;
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawKey);
    } catch {
      // An undecodable key inside campaign-shaped input fails closed.
      return true;
    }
    if (isSourceBearingKey(decoded)) return true;
  }
  return false;
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
    return looksSourceBearing(raw) ? "unsupported" : "none";
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
      return looksSourceBearing(raw) ? "unsupported" : "none";
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
