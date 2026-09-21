/**
 * Regression cases for the six reviewed defects on this head (PR #163).
 *
 * Every test here was written against the unrepaired runtime first and fails
 * on it; none of them relaxes an existing expectation. They cover the two
 * things in-memory success cannot show on its own: what is actually written to
 * same-tab storage across the supported reload and re-grant transitions, and
 * what happens when reads, writes and removals fail *independently* of each
 * other rather than all at once.
 *
 * As everywhere in this suite, the tag is the local inert model. These tests
 * prove the application's own contract, never Google's behaviour.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CONSENT_RECORD_VERSION,
  CONSENT_STORAGE_KEY,
  CONSENT_TTL_MS,
  MEASUREMENT_POLICY_VERSION,
  SOURCE_IDLE_TTL_MS,
  SOURCE_STORAGE_KEY,
} from "../../src/lib/measurement/policy.ts";
import { classifySearch } from "../../src/lib/measurement/sourceInput.ts";
import { measurementSessionKeys, setupHarness, storedSource } from "./harness/setup.ts";
import type { Harness } from "./harness/setup.ts";

const GBP = "?utm_source=google&utm_medium=organic&utm_campaign=gbp";
const CONFLICTING = "?utm_source=instagram&utm_medium=social&utm_campaign=spring";

/** The campaign context a payload actually carried, as the modelled tag saw it. */
function effectiveCampaign(harness: Harness, index = -1): Record<string, unknown> {
  const entry = harness.tag.collected.at(index);
  assert.ok(entry, "expected a collected payload");
  return entry.effective;
}

function seedConsent(harness: Harness, record: Record<string, unknown>): void {
  harness.env.local.raw.set(CONSENT_STORAGE_KEY, JSON.stringify(record));
}

function seedSource(harness: Harness, consentEpoch: number, ageMs = 1_000): void {
  const stamp = harness.env.now() - ageMs;
  harness.env.session.raw.set(
    SOURCE_STORAGE_KEY,
    JSON.stringify({
      v: 1,
      s: "google",
      m: "organic",
      c: "gbp",
      t: stamp,
      a: stamp,
      n: 1,
      // Present so the seeded record is a fully valid one in both the
      // unrepaired and the repaired reading, and the case therefore fails for
      // the reviewed reason rather than on a schema technicality.
      g: consentEpoch,
    }),
  );
}

/* ── A1 — source-derived arrival bookkeeping before a choice ─────────────── */

test("A1 — a tagged undecided arrival writes no measurement session key at all", () => {
  const h = setupHarness({ search: GBP });
  try {
    assert.equal(h.runtime.getStatus(), "undecided");
    assert.deepEqual(
      measurementSessionKeys(h),
      [],
      "pre-choice source state, including its bookkeeping, stays volatile",
    );
    assert.equal(h.runtime.snapshotSource(), null, "and nothing is transmitted");

    // A further tagged in-app navigation before the choice is still volatile.
    h.runtime.recordNavigation("/about", GBP, "PUSH");
    assert.deepEqual(measurementSessionKeys(h), []);
  } finally {
    h.teardown();
  }
});

test("A1 — a refused visitor leaves no source-derived record behind", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.deny();
    assert.deepEqual(measurementSessionKeys(h), [], "refusal persists no source-derived state");

    h.runtime.recordNavigation("/", GBP, "PUSH");
    assert.deepEqual(measurementSessionKeys(h), [], "and a later tagged navigation still persists none");
    assert.equal(h.runtime.snapshotSource(), null);
  } finally {
    h.teardown();
  }
});

test("A1 — the approved grant path still persists exactly the one approved key", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    assert.deepEqual(measurementSessionKeys(h), [SOURCE_STORAGE_KEY]);
    assert.equal(h.runtime.snapshotSource()?.campaign, "gbp");

    h.runtime.withdraw();
    assert.deepEqual(measurementSessionKeys(h), [], "withdrawal takes it away again");
  } finally {
    h.teardown();
  }
});

/* ── A2 — history traversal to a conflicting campaign ────────────────────── */

test("A2 — a conflicting campaign reached through Back clears GBP attribution", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.equal(effectiveCampaign(h).campaign_source, "google", "baseline: GBP is attributed");

    h.runtime.recordNavigation("/", CONFLICTING, "POP");

    assert.equal(h.runtime.snapshotSource(), null, "another campaign is not relabelled as GBP");
    assert.equal(storedSource(h), null, "and the stored record is gone");

    h.runtime.trackEvent("phone_click", { location: "footer" });
    const after = effectiveCampaign(h);
    assert.equal(after.campaign_source, "", "the provider's stale campaign context is purged too");
    assert.equal(after.campaign_medium, "");
    assert.equal(after.campaign_name, "");
  } finally {
    h.teardown();
  }
});

test("A2 — Back to a valid historic GBP url is still not a new arrival", () => {
  const h = setupHarness();
  try {
    h.runtime.grant();
    h.runtime.recordNavigation("/", GBP, "POP");
    assert.equal(h.runtime.snapshotSource(), null, "a traversal never mints attribution");
    assert.equal(storedSource(h), null);
  } finally {
    h.teardown();
  }
});

test("A2 — Back over an untagged entry keeps a still-valid GBP arrival", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    h.runtime.recordNavigation("/about", "", "PUSH");
    h.runtime.recordNavigation("/", "?service=the-full-femme", "POP");
    assert.equal(h.runtime.snapshotSource()?.campaign, "gbp", "supported navigation preserves source");
  } finally {
    h.teardown();
  }
});

/* ── A3 — oversized, encoded source-bearing input ────────────────────────── */

test("A3 — oversized input with encoded campaign keys is unsupported, not ignored", () => {
  const padding = "&pad=" + "x".repeat(2100);
  assert.equal(
    classifySearch("?%75tm_source=instagram&%75tm_medium=social&%75tm_campaign=spring" + padding),
    "unsupported",
    "a key is source-bearing after exactly one decode",
  );
  assert.equal(classifySearch("?%67clid=abc123" + padding), "unsupported", "encoded click id");
  assert.equal(
    classifySearch("?%75tm_source=google&%75tm_medium=organic&%75tm_campaign=gbp" + padding),
    "unsupported",
    "oversized input never produces a candidate, even spelling the approved tuple",
  );
  assert.equal(classifySearch("?pad=" + "x".repeat(2100)), "none", "still no verdict without campaign input");
});

test("A3 — oversized encoded campaign input clears a previously recognised GBP state", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    assert.equal(h.runtime.snapshotSource()?.campaign, "gbp");

    const padding = "&pad=" + "x".repeat(2100);
    h.runtime.recordNavigation("/", "?%75tm_source=instagram&%75tm_medium=social" + padding, "PUSH");

    assert.equal(h.runtime.snapshotSource(), null, "fail-closed clearing is not bypassed by encoding");
    assert.equal(storedSource(h), null);
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.equal(effectiveCampaign(h).campaign_source, "");
  } finally {
    h.teardown();
  }
});

/*
 * A long *raw* key used to be skipped before it was ever decoded, so
 * `%75tm_` followed by 130 characters read as "no campaign input at all" on an
 * oversized query and quietly left an older GBP arrival in place. Whether a
 * key claims to be campaign input is decided by its first decoded characters,
 * not by how long it is — and a long key that decodes to something unrelated
 * stays unrelated.
 */
const LONG_ENCODED_UTM = "?%75tm_" + "x".repeat(130) + "=other";
const OVERSIZE_PAD = "&pad=" + "x".repeat(2100);

test("A3 — a long encoded unknown UTM key is unsupported at every input size", () => {
  assert.equal(
    classifySearch(LONG_ENCODED_UTM),
    "unsupported",
    "in-bound: an unknown, over-long utm_ field is campaign-shaped and not approved",
  );
  assert.equal(
    classifySearch(LONG_ENCODED_UTM + OVERSIZE_PAD),
    "unsupported",
    "oversized input reaches the same verdict; padding is not an escape hatch",
  );
  assert.equal(
    classifySearch("?%55TM_" + "x".repeat(130) + "=other" + OVERSIZE_PAD),
    "unsupported",
    "nor is case",
  );
  assert.equal(
    classifySearch("?utm_" + "x".repeat(130) + "=other" + OVERSIZE_PAD),
    "unsupported",
    "and the unencoded spelling is unchanged",
  );
});

test("A3 — long unrelated keys stay harmless, encoded or not", () => {
  assert.equal(
    classifySearch("?" + "x".repeat(140) + "=1" + OVERSIZE_PAD),
    "none",
    "length alone is not campaign input",
  );
  assert.equal(
    classifySearch("?%70ad" + "x".repeat(130) + "=1" + OVERSIZE_PAD),
    "none",
    "decoding a bounded prefix must not turn every long encoded key into marketing input",
  );
  assert.equal(
    classifySearch("?%67clid" + "x".repeat(130) + "=1" + OVERSIZE_PAD),
    "none",
    "a click id has to be the whole key: `gclidxxx…` is not `gclid`",
  );
});

test("A3 — a long encoded unknown UTM key clears a recognised GBP state", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    assert.equal(h.runtime.snapshotSource()?.campaign, "gbp");

    h.runtime.recordNavigation("/about", LONG_ENCODED_UTM + OVERSIZE_PAD, "PUSH");

    assert.equal(h.runtime.snapshotSource(), null, "prior attribution does not survive it");
    assert.equal(storedSource(h), null);
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.equal(effectiveCampaign(h).campaign_source, "");
  } finally {
    h.teardown();
  }
});

test("A3 — an oversized unrelated query leaves a valid GBP arrival alone", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    h.runtime.recordNavigation("/about", "?" + "x".repeat(140) + "=1" + OVERSIZE_PAD, "PUSH");
    assert.equal(
      h.runtime.snapshotSource()?.campaign,
      "gbp",
      "unrelated input is not a campaign change",
    );
  } finally {
    h.teardown();
  }
});

/*
 * A percent-escape boundary is not a UTF-8 character boundary. Reading a fixed
 * number of raw characters and decoding them as a unit used to split a valid
 * multi-byte character that followed an encoded prefix: the decode threw, the
 * known `utm_` prefix was thrown away with it, and an oversized query spelled
 * `%75tm_😀…` read as "no campaign input at all". The prefix is four ASCII
 * characters, so it is now settled one raw unit at a time and nothing past it
 * is ever decoded — the suffix can be any valid text at all.
 */
const EMOJI_ENCODED_UTM = "?%75tm_%F0%9F%98%80" + "x".repeat(130) + "=other";

test("A3 — a valid multi-byte suffix cannot hide an encoded utm_ prefix", () => {
  assert.equal(
    classifySearch(EMOJI_ENCODED_UTM),
    "unsupported",
    "in-bound: the four-character prefix decides it, whatever follows",
  );
  assert.equal(
    classifySearch(EMOJI_ENCODED_UTM + OVERSIZE_PAD),
    "unsupported",
    "oversized: a four-byte character straddling the old cut is not an escape hatch",
  );
  assert.equal(
    classifySearch("?%75tm_%E2%9C%93" + "x".repeat(130) + "=other" + OVERSIZE_PAD),
    "unsupported",
    "nor is a three-byte one",
  );
  assert.equal(
    classifySearch("?%75tm_%C3%A9" + "x".repeat(130) + "=other" + OVERSIZE_PAD),
    "unsupported",
    "and a two-byte suffix, which already fit, still reaches the same verdict",
  );
  assert.equal(
    classifySearch("?%55TM_%F0%9F%98%80" + "x".repeat(130) + "=other" + OVERSIZE_PAD),
    "unsupported",
    "case is no more of an escape hatch here than anywhere else",
  );
  assert.equal(
    classifySearch("?%75%74%6D%5F%F0%9F%98%80" + "x".repeat(130) + "=other" + OVERSIZE_PAD),
    "unsupported",
    "a fully escaped prefix is read the same way",
  );
  assert.equal(
    classifySearch("?%75tm_%25F0%259F%2598%2580" + "x".repeat(130) + "=other" + OVERSIZE_PAD),
    "unsupported",
    "a double-encoded suffix does not change what the prefix says either",
  );
});

test("A3 — a multi-byte suffix does not make an unrelated key campaign input", () => {
  for (const size of ["", OVERSIZE_PAD]) {
    assert.equal(
      classifySearch("?%70ad%F0%9F%98%80" + "x".repeat(130) + "=1" + size),
      "none",
      "`pad😀xxx…` is unrelated at every input size",
    );
    assert.equal(
      classifySearch("?%67clid%F0%9F%98%80" + "x".repeat(130) + "=1" + size),
      "none",
      "and a click id still has to be the whole key",
    );
    assert.equal(
      classifySearch("?%2575tm_%25F0%259F%2598%2580" + "x".repeat(130) + "=1" + size),
      "none",
      "input is decoded exactly once: `%75tm_…` is not `utm_…`",
    );
  }
});

test("A3 — an encoded utm_ prefix with a multi-byte suffix clears a recognised GBP state", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    assert.equal(h.runtime.snapshotSource()?.campaign, "gbp");

    h.runtime.recordNavigation("/about", EMOJI_ENCODED_UTM + OVERSIZE_PAD, "PUSH");

    assert.equal(h.runtime.snapshotSource(), null, "in-memory attribution does not survive it");
    assert.equal(storedSource(h), null, "and neither does the stored record");
    h.runtime.trackEvent("phone_click", { location: "footer" });
    const campaign = effectiveCampaign(h);
    assert.equal(campaign.campaign_source, "");
    assert.equal(campaign.campaign_medium, "");
    assert.equal(campaign.campaign_name, "");
  } finally {
    h.teardown();
  }
});

test("A3 — an unrelated multi-byte key leaves a valid GBP arrival alone", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    h.runtime.recordNavigation("/about", "?%70ad%F0%9F%98%80" + "x".repeat(130) + "=1" + OVERSIZE_PAD, "PUSH");
    assert.equal(
      h.runtime.snapshotSource()?.campaign,
      "gbp",
      "reading the prefix more carefully does not start clearing unrelated navigation",
    );
  } finally {
    h.teardown();
  }
});


/* ── B-01 — initialisation without an effective grant ────────────────────── */

const NON_GRANTED_SEEDS = [
  {
    label: "expired grant",
    consent: (now: number) => ({
      v: CONSENT_RECORD_VERSION,
      policy: MEASUREMENT_POLICY_VERSION,
      choice: "granted",
      exp: now - 1,
    }),
  },
  {
    label: "invalid policy version",
    consent: (now: number) => ({
      v: CONSENT_RECORD_VERSION,
      policy: "FEMME-GA4-v0",
      choice: "granted",
      exp: now + CONSENT_TTL_MS,
    }),
  },
  {
    label: "denied",
    consent: (now: number) => ({
      v: CONSENT_RECORD_VERSION,
      policy: MEASUREMENT_POLICY_VERSION,
      choice: "denied",
      exp: now + CONSENT_TTL_MS,
    }),
  },
] as const;

for (const seed of NON_GRANTED_SEEDS) {
  test(`B-01 — ${seed.label} consent burns leftover source at initialisation`, () => {
    const h = setupHarness({ navigationType: "reload", init: false });
    try {
      const record = seed.consent(h.env.now());
      seedConsent(h, record);
      seedSource(h, record.exp);

      h.runtime.init();
      assert.notEqual(h.runtime.getStatus(), "granted", "effective consent is not a grant");
      assert.deepEqual(
        measurementSessionKeys(h),
        [],
        "a source that outlived its grant is cleared, not preserved",
      );

      // The reviewed reproduction: the first history event refreshed the record.
      h.runtime.recordNavigation("/", "", "POP");
      assert.deepEqual(measurementSessionKeys(h), [], "and a traversal does not rewrite it either");

      // A genuinely new choice must start from nothing.
      h.runtime.grant();
      assert.equal(h.runtime.snapshotSource(), null, "the old arrival does not return on re-grant");
      assert.equal(storedSource(h), null);

      h.runtime.recordNavigation("/journal", "", "PUSH");
      const pageviews = h.tag.collected.filter((entry) => entry.name === "page_view");
      assert.ok(pageviews.length > 0, "the new grant does count pages");
      for (const view of pageviews) {
        assert.notEqual(view.effective.campaign_source, "google", "and none of them is attributed");
      }
    } finally {
      h.teardown();
    }
  });
}

/* ── B-02 — the source idle deadline ─────────────────────────────────────── */

test("B-02 — source expiry purges provider campaign state on its own deadline", () => {
  const h = setupHarness({ search: GBP, fakeTimers: true });
  try {
    h.runtime.grant();
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.equal(effectiveCampaign(h).campaign_source, "google", "baseline");

    // Exactly the 30-minute boundary, with no activity of any kind in between.
    h.env.advance(SOURCE_IDLE_TTL_MS);

    assert.equal(storedSource(h), null, "the stored record is gone at the boundary");

    // Provider-originated traffic never passes through the wrapper, so dropping
    // the wrapper's own fields would not have shown this.
    h.tag.lifecycleTick();
    const tick = effectiveCampaign(h);
    assert.equal(tick.campaign_source, "", "stale GBP campaign context does not ride along");
    assert.equal(tick.campaign_medium, "");
    assert.equal(tick.campaign_name, "");
  } finally {
    h.teardown();
  }
});

test("B-02 — a throttled document whose timer never fired revalidates on restore", () => {
  // No fake timers installed at all: this models the document that was frozen
  // or throttled and simply never got its callback.
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    h.runtime.trackEvent("phone_click", { location: "footer" });
    h.env.advance(SOURCE_IDLE_TTL_MS);

    h.env.emitLifecycleEvent("pageshow");

    h.tag.lifecycleTick();
    assert.equal(effectiveCampaign(h).campaign_source, "", "revalidated before anything could use it");
    assert.equal(storedSource(h), null);
  } finally {
    h.teardown();
  }
});

test("B-02 — the source deadline does not collect, refresh or extend itself", () => {
  const h = setupHarness({ search: GBP, fakeTimers: true });
  try {
    h.runtime.grant();
    const countAfterGrant = h.tag.collected.length;

    h.env.advance(SOURCE_IDLE_TTL_MS - 1);
    assert.equal(h.runtime.snapshotSource()?.campaign, "gbp", "still alive one millisecond early");
    assert.equal(
      h.tag.collected.length,
      countAfterGrant,
      "no heartbeat: the deadline sends nothing while it waits",
    );

    h.env.advance(1);
    assert.equal(h.runtime.snapshotSource(), null, "expired exactly at the boundary");
    assert.equal(
      h.tag.collected.length,
      countAfterGrant,
      "and the teardown itself is not collection either",
    );
  } finally {
    h.teardown();
  }
});

test("source expiry and consent expiry are independent deadlines", () => {
  const h = setupHarness({ search: GBP, fakeTimers: true });
  try {
    h.runtime.grant();
    h.env.advance(SOURCE_IDLE_TTL_MS);

    assert.equal(h.runtime.getStatus(), "granted", "the six-month preference is untouched");
    h.runtime.trackEvent("phone_click", { location: "footer" });
    const unattributed = h.tag.collected.at(-1);
    assert.equal(unattributed?.name, "phone_click", "measurement continues without attribution");
    assert.equal(unattributed?.effective.campaign_source, "");

    // Now the other deadline.
    h.env.advance(CONSENT_TTL_MS);
    assert.equal(h.runtime.getStatus(), "undecided", "the preference expired on its own schedule");
    const before = h.tag.collected.length;
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.equal(h.tag.collected.length, before, "and collection stopped");
  } finally {
    h.teardown();
  }
});

/* ── H-01 — cleanup that could not be verified ───────────────────────────── */

test("H-01 — a source whose removal failed is not trusted by a later re-grant", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    assert.notEqual(storedSource(h), null, "baseline: the arrival was stored");

    // Removal alone fails. Reads and writes keep working, which is exactly the
    // case where a silent `removeItem` failure leaves a readable record.
    h.env.session.failRemovals = true;
    const withdrawal = h.runtime.withdraw();
    assert.equal(withdrawal.ok, true, "the necessary preference itself was still writable");
    assert.equal(h.runtime.getStatus(), "denied");

    // Storage recovers, and the visitor changes their mind. No new arrival.
    h.env.session.failRemovals = false;
    assert.equal(h.runtime.grant().ok, true);

    assert.equal(h.runtime.snapshotSource(), null, "a revoked arrival cannot return on re-grant");
    assert.equal(storedSource(h), null);
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.notEqual(effectiveCampaign(h).campaign_source, "google");
  } finally {
    h.teardown();
  }
});

test("H-01 — when neither removal nor overwrite works, source stays distrusted", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    assert.notEqual(storedSource(h), null);

    h.env.session.failRemovals = true;
    h.env.session.failWrites = true;
    h.runtime.withdraw();

    // Still blocked: the record is provably still there, and must not be used.
    assert.equal(h.runtime.grant().ok, true);
    assert.equal(h.runtime.snapshotSource(), null, "unverified cleanup fails closed");

    h.env.session.failRemovals = false;
    h.env.session.failWrites = false;
    assert.equal(h.runtime.snapshotSource(), null, "and recovery does not un-revoke it");
  } finally {
    h.teardown();
  }
});

test("H-01 — a leftover source is not adopted by a grant made after a reload", () => {
  const first = setupHarness({ search: GBP });
  let carriedSession: Map<string, string>;
  let carriedLocal: Map<string, string>;
  try {
    first.runtime.grant();
    // Nothing can be taken out of session storage from here on.
    first.env.session.failRemovals = true;
    first.env.session.failWrites = true;
    first.runtime.withdraw();
    assert.notEqual(storedSource(first), null, "precondition: the record really did survive");
    carriedSession = new Map(first.env.session.raw);
    carriedLocal = new Map(first.env.local.raw);
  } finally {
    first.teardown();
  }

  // Same tab, reloaded, storage healthy again, consent currently refused.
  const reloaded = setupHarness({ search: GBP, navigationType: "reload", init: false });
  try {
    for (const [key, value] of carriedSession) reloaded.env.session.raw.set(key, value);
    for (const [key, value] of carriedLocal) reloaded.env.local.raw.set(key, value);

    reloaded.runtime.init();
    assert.deepEqual(measurementSessionKeys(reloaded), [], "burnt at initialisation");

    reloaded.runtime.grant();
    assert.equal(reloaded.runtime.snapshotSource(), null, "the revoked arrival is still revoked");
    assert.equal(storedSource(reloaded), null);
  } finally {
    reloaded.teardown();
  }
});

test("H-01 — an unreadable session area yields no attribution and no false cleanup", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();

    // Reads fail on their own; writes and removals still work.
    h.env.session.failReads = true;
    assert.equal(h.runtime.snapshotSource(), null, "unreadable storage fails closed");
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.notEqual(effectiveCampaign(h).campaign_source, "google");

    h.runtime.withdraw();
    h.env.session.failReads = false;
    h.runtime.grant();
    assert.equal(h.runtime.snapshotSource(), null, "nothing survives the withdrawal");
    assert.equal(storedSource(h), null);
  } finally {
    h.teardown();
  }
});

test("H-01 — a grant that cannot persist source reports no attribution", () => {
  const h = setupHarness({ search: GBP });
  try {
    // Session writes fail, so the promoted candidate cannot be written down.
    h.env.session.failWrites = true;
    assert.equal(h.runtime.grant().ok, true, "the necessary preference is a different area");

    assert.equal(h.runtime.snapshotSource(), null, "no unwritten source is reported as stored");
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.notEqual(effectiveCampaign(h).campaign_source, "google");
    assert.deepEqual(measurementSessionKeys(h), []);
  } finally {
    h.teardown();
  }
});

/* ── Storage policy across the supported reload / re-grant transitions ───── */

test("storage policy holds across the supported reload and re-grant transitions", () => {
  const first = setupHarness({ search: GBP });
  let carriedSession: Map<string, string>;
  let carriedLocal: Map<string, string>;
  try {
    assert.deepEqual(measurementSessionKeys(first), [], "undecided: nothing written");
    first.runtime.grant();
    assert.deepEqual(measurementSessionKeys(first), [SOURCE_STORAGE_KEY], "granted: one approved key");
    carriedSession = new Map(first.env.session.raw);
    carriedLocal = new Map(first.env.local.raw);
  } finally {
    first.teardown();
  }

  // Supported transition 1: same-tab reload with a valid grant restores source.
  const reloaded = setupHarness({ search: GBP, navigationType: "reload", init: false });
  let afterReloadSession: Map<string, string>;
  let afterReloadLocal: Map<string, string>;
  try {
    for (const [key, value] of carriedSession) reloaded.env.session.raw.set(key, value);
    for (const [key, value] of carriedLocal) reloaded.env.local.raw.set(key, value);
    reloaded.runtime.init();

    assert.equal(reloaded.runtime.snapshotSource()?.campaign, "gbp", "reload restores valid source");
    assert.deepEqual(measurementSessionKeys(reloaded), [SOURCE_STORAGE_KEY], "and writes nothing extra");

    // Supported transition 2: withdrawal empties same-tab source storage.
    reloaded.runtime.withdraw();
    assert.deepEqual(measurementSessionKeys(reloaded), [], "withdrawal leaves no source-derived key");
    afterReloadSession = new Map(reloaded.env.session.raw);
    afterReloadLocal = new Map(reloaded.env.local.raw);
  } finally {
    reloaded.teardown();
  }

  // Supported transition 3: reload after withdrawal, then re-grant.
  const regranted = setupHarness({ search: GBP, navigationType: "reload", init: false });
  try {
    for (const [key, value] of afterReloadSession) regranted.env.session.raw.set(key, value);
    for (const [key, value] of afterReloadLocal) regranted.env.local.raw.set(key, value);
    regranted.runtime.init();
    regranted.runtime.grant();

    assert.equal(regranted.runtime.snapshotSource(), null, "re-grant does not resurrect the arrival");
    assert.deepEqual(measurementSessionKeys(regranted), []);
  } finally {
    regranted.teardown();
  }
});
