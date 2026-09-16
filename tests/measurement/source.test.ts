/**
 * The GBP source state machine: strict decoding, volatile candidates, idle
 * expiry, and the arrival-consumption ledger that stops a revoked landing from
 * coming back through reload, history or a later re-grant.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SOURCE_IDLE_TTL_MS, SOURCE_STORAGE_KEY } from "../../src/lib/measurement/policy.ts";
import { classifySearch } from "../../src/lib/measurement/sourceInput.ts";
import { SERVICE_OPTIONS } from "../../src/data/serviceOptions.ts";
import { setupHarness, storedLedger, storedSource } from "./harness/setup.ts";

const GBP = "?utm_source=google&utm_medium=organic&utm_campaign=gbp";

test("only the complete exact decoded tuple is recognised", () => {
  assert.equal(classifySearch(GBP), "gbp");
  assert.equal(classifySearch(GBP + "&service=the-full-femme"), "gbp");
  assert.equal(classifySearch("?service=in-your-corner"), "none");
  assert.equal(classifySearch(""), "none");
});

test("malformed, duplicate, partial and conflicting input is unsupported", () => {
  const unsupported = [
    "?utm_source=google&utm_medium=organic",
    "?utm_medium=organic&utm_campaign=gbp",
    "?utm_source=google&utm_campaign=gbp",
    "?utm_source=Google&utm_medium=organic&utm_campaign=gbp",
    "?UTM_SOURCE=google&utm_medium=organic&utm_campaign=gbp",
    "?utm_source=google&utm_source=google&utm_medium=organic&utm_campaign=gbp",
    "?utm_source=google&utm_medium=organic&utm_campaign=gbp&utm_campaign=gbp",
    "?utm_source=google&utm_medium=organic&utm_campaign=GBP",
    "?utm_source=google&utm_medium=cpc&utm_campaign=gbp",
    "?utm_source=google&utm_medium=organic&utm_campaign=gbp&utm_term=wedding",
    "?utm_source=google&utm_medium=organic&utm_campaign=gbp&utm_content=a",
    "?utm_source=google&utm_medium=organic&utm_campaign=gbp&utm_id=7",
    "?utm_source=google&utm_medium=organic&utm_campaign=gbp&gclid=abc123",
    "?utm_source=google&utm_medium=organic&utm_campaign=gbp&gbraid=x",
    "?utm_source=google&utm_medium=organic&utm_campaign=gbp&fbclid=x",
    "?utm_source=google&utm_medium=organic&utm_campaign=gbp&_gl=1",
    "?utm_source=%ZZ&utm_medium=organic&utm_campaign=gbp",
    "?utm_source=google&utm_medium=organic&utm_campaign",
    "?utm_source=+google&utm_medium=organic&utm_campaign=gbp",
    "?utm_source=google%20&utm_medium=organic&utm_campaign=gbp",
    "?utm_source=%67oogle&utm_medium=organic&utm_campaign=gbp&utm_source=google",
  ];
  for (const search of unsupported) {
    assert.equal(classifySearch(search), "unsupported", search);
  }
});

test("percent-decoding happens exactly once and is never repaired", () => {
  // `%2567` decodes once to `%67`, which is not `google`. A second decode would
  // wrongly turn it into `google`.
  assert.equal(classifySearch("?utm_source=%2567oogle&utm_medium=organic&utm_campaign=gbp"), "unsupported");
  // A correctly single-encoded value is accepted.
  assert.equal(classifySearch("?utm_source=%67oogle&utm_medium=organic&utm_campaign=gbp"), "gbp");
});

test("oversized input produces no candidate", () => {
  const padding = "&pad=" + "x".repeat(2100);
  assert.equal(classifySearch(GBP + padding), "unsupported");
  const longValue = "?utm_source=" + "g".repeat(65) + "&utm_medium=organic&utm_campaign=gbp";
  assert.equal(classifySearch(longValue), "unsupported");
  assert.equal(classifySearch("?pad=" + "x".repeat(2100)), "none", "no campaign input, no verdict");
});

test("an undecided arrival is held only in memory", () => {
  const h = setupHarness({ search: GBP });
  try {
    assert.equal(h.env.session.raw.has(SOURCE_STORAGE_KEY), false, "nothing persisted before a choice");
    assert.equal(h.runtime.snapshotSource(), null, "nothing transmitted before a choice");
    h.runtime.grant();
    assert.deepEqual(h.runtime.snapshotSource(), {
      source: "google",
      medium: "organic",
      campaign: "gbp",
      arrival: 1,
    });
    const record = storedSource(h) as Record<string, unknown>;
    assert.equal(record.s, "google");
    assert.equal(record.m, "organic");
    assert.equal(record.c, "gbp");
  } finally {
    h.teardown();
  }
});

test("a refused arrival is never captured, even if the visitor changes their mind", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.deny();
    h.runtime.grant();
    assert.equal(storedSource(h), null, "the refused arrival cannot be promoted later");
    assert.equal(h.runtime.snapshotSource(), null);
  } finally {
    h.teardown();
  }
});

test("a revoked arrival does not come back through reload or re-grant", () => {
  const first = setupHarness({ search: GBP });
  let carriedSession: Map<string, string>;
  try {
    first.runtime.grant();
    assert.notEqual(storedSource(first), null);
    first.runtime.withdraw();
    assert.equal(storedSource(first), null);

    // Re-granting in the same document must not resurrect it.
    first.runtime.grant();
    assert.equal(storedSource(first), null);
    carriedSession = new Map(first.env.session.raw);
  } finally {
    first.teardown();
  }

  // Same tab, same tagged URL, reloaded: session storage survives a reload, and
  // the ledger says every arrival it knows about is already consumed.
  const reloaded = setupHarness({ search: GBP, navigationType: "reload", init: false });
  try {
    for (const [key, value] of carriedSession) reloaded.env.session.raw.set(key, value);
    reloaded.runtime.init();
    reloaded.runtime.grant();
    assert.equal(storedSource(reloaded), null, "a reload is not a new arrival");
  } finally {
    reloaded.teardown();
  }
});

test("a back/forward document navigation is not an arrival either", () => {
  const h = setupHarness({ search: GBP, navigationType: "back_forward" });
  try {
    h.runtime.grant();
    assert.equal(storedSource(h), null);
    assert.equal(storedLedger(h), null, "no arrival was even registered");
  } finally {
    h.teardown();
  }
});

test("history traversal back to a tagged URL never recaptures it", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    h.runtime.withdraw();
    // Visitor navigates on, then presses Back to the original tagged entry.
    h.runtime.recordNavigation("/about", "", "PUSH");
    h.runtime.recordNavigation("/", GBP, "POP");
    assert.equal(storedSource(h), null);
    h.runtime.grant();
    assert.equal(storedSource(h), null);
  } finally {
    h.teardown();
  }
});

test("a genuinely new tagged arrival after a withdrawal is captured again", () => {
  const first = setupHarness({ search: GBP });
  let carriedSession: Map<string, string>;
  let carriedLocal: Map<string, string>;
  try {
    first.runtime.grant();
    first.runtime.withdraw();
    first.runtime.grant();
    assert.equal(storedSource(first), null, "the revoked arrival is still gone");
    carriedSession = new Map(first.env.session.raw);
    carriedLocal = new Map(first.env.local.raw);
  } finally {
    first.teardown();
  }

  // Same tab, consent granted, and the visitor clicks the GBP listing again:
  // a real forward document navigation, so a new arrival ordinal is issued.
  const next = setupHarness({ search: GBP, navigationType: "navigate", init: false });
  try {
    for (const [key, value] of carriedSession) next.env.session.raw.set(key, value);
    for (const [key, value] of carriedLocal) next.env.local.raw.set(key, value);
    next.runtime.init();
    const snapshot = next.runtime.snapshotSource();
    assert.equal(snapshot?.campaign, "gbp");
    assert.equal(snapshot?.arrival, 2, "a new arrival ordinal, not the revoked one");
  } finally {
    next.teardown();
  }
});

test("source survives package selection and ordinary internal navigation", () => {
  for (const option of SERVICE_OPTIONS) {
    const h = setupHarness({ search: GBP });
    try {
      h.runtime.grant();
      h.runtime.recordNavigation("/", "?service=" + option.slug, "PUSH");
      h.runtime.recordNavigation("/about", "", "PUSH");
      h.runtime.recordNavigation("/", "?service=" + option.slug, "PUSH");
      assert.equal(h.runtime.snapshotSource()?.campaign, "gbp", option.slug);
    } finally {
      h.teardown();
    }
  }
});

test("explicit unsupported new source input clears prior GBP state", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    assert.notEqual(h.runtime.snapshotSource(), null);
    h.runtime.recordNavigation("/", "?utm_source=instagram&utm_medium=social&utm_campaign=spring", "PUSH");
    assert.equal(h.runtime.snapshotSource(), null, "another campaign is not relabelled as GBP");
    const purge = h.tag.configs.at(-1);
    assert.equal(purge?.params.campaign_source, "", "stale provider campaign context is purged");
    assert.equal(purge?.params.campaign_medium, "");
    assert.equal(purge?.params.campaign_name, "");
  } finally {
    h.teardown();
  }
});

test("idle expiry is inclusive at the boundary and refreshed only by activity", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    h.env.advance(SOURCE_IDLE_TTL_MS - 1);
    assert.notEqual(h.runtime.snapshotSource(), null, "still alive one millisecond early");

    h.runtime.recordNavigation("/about", "", "PUSH");
    h.env.advance(SOURCE_IDLE_TTL_MS - 1);
    assert.notEqual(h.runtime.snapshotSource(), null, "real navigation refreshed the window");

    h.env.advance(1);
    assert.equal(h.runtime.snapshotSource(), null, "expired exactly at the boundary");
    assert.equal(storedSource(h), null, "and cleared before use");
  } finally {
    h.teardown();
  }
});

test("corrupt, future-dated and wrong-version stored source fails closed", () => {
  const cases = [
    "not json",
    JSON.stringify({ v: 9, s: "google", m: "organic", c: "gbp", t: 1, a: 1, n: 1 }),
    JSON.stringify({ v: 1, s: "bing", m: "organic", c: "gbp", t: 1, a: 1, n: 1 }),
    JSON.stringify({ v: 1, s: "google", m: "organic", c: "gbp", t: 1, a: 1, n: 0 }),
    JSON.stringify({ v: 1, s: "google", m: "organic", c: "gbp", t: "x", a: 1, n: 1 }),
  ];
  for (const raw of cases) {
    const h = setupHarness();
    try {
      h.runtime.grant();
      h.env.session.raw.set(SOURCE_STORAGE_KEY, raw);
      assert.equal(h.runtime.snapshotSource(), null, raw);
      assert.equal(h.env.session.raw.has(SOURCE_STORAGE_KEY), false, "cleared: " + raw);
    } finally {
      h.teardown();
    }
  }

  const future = setupHarness();
  try {
    future.runtime.grant();
    future.env.session.raw.set(
      SOURCE_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        s: "google",
        m: "organic",
        c: "gbp",
        t: future.env.now() + 60_000,
        a: future.env.now() + 60_000,
        n: 1,
      }),
    );
    assert.equal(future.runtime.snapshotSource(), null, "a future timestamp cannot be aged");
  } finally {
    future.teardown();
  }
});

test("unrelated query fields are ignored, never persisted and never transmitted", () => {
  const h = setupHarness({ search: GBP + "&ref=newsletter&session_hint=abc123" });
  try {
    h.runtime.grant();
    h.runtime.trackEvent("cta_inquiry_click", { location: "hero" });
    const serialised = JSON.stringify([
      [...h.env.session.raw.entries()],
      [...h.env.local.raw.entries()],
      h.tag.collected,
      h.tag.configs,
    ]);
    assert.equal(serialised.includes("newsletter"), false);
    assert.equal(serialised.includes("abc123"), false);
  } finally {
    h.teardown();
  }
});
