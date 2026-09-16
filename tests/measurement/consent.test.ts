/**
 * Consent preference record, fail-closed reads, and the withdrawal contract.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CONSENT_STORAGE_KEY, CONSENT_TTL_MS } from "../../src/lib/measurement/policy.ts";
import { readConsent } from "../../src/lib/measurement/consentStore.ts";
import { collectedNames, setupHarness, storedConsent, storedSource } from "./harness/setup.ts";

test("nothing is requested, stored or collected before a grant", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.trackEvent("cta_inquiry_click", { location: "hero" });
    h.runtime.trackEvent("phone_click", { location: "footer" });

    assert.equal(h.runtime.getStatus(), "undecided");
    assert.equal(h.tag.loadRequests.length, 0, "no tag load was requested");
    assert.equal(h.tag.collected.length, 0, "nothing was collected");
    assert.equal(h.env.scripts.length, 0, "no script element was created");
    assert.deepEqual(h.env.cookies(), {}, "no analytics cookie was set");
    assert.equal(h.env.local.raw.size, 0, "no preference was written without a choice");
  } finally {
    h.teardown();
  }
});

test("refusal stores only choice, version and expiry - and pings nothing", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    assert.equal(h.runtime.deny().ok, true);

    const record = storedConsent(h) as Record<string, unknown>;
    assert.deepEqual(Object.keys(record).sort(), ["choice", "exp", "policy", "v"]);
    assert.equal(record.choice, "denied");
    assert.equal(record.policy, "FEMME-GA4-v1");
    assert.equal(record.exp, h.env.now() + CONSENT_TTL_MS);

    h.runtime.trackEvent("cta_inquiry_click", { location: "hero" });
    h.runtime.recordNavigation("/about", "", "PUSH");
    // No denied-state cookieless ping: the tag is never even asked to load.
    assert.equal(h.tag.loadRequests.length, 0);
    assert.equal(h.tag.collected.length, 0);
    assert.equal(h.tag.suppressed.length, 0);
    assert.deepEqual(h.env.cookies(), {});
  } finally {
    h.teardown();
  }
});

test("the stored preference expires after six months and fails closed", () => {
  const h = setupHarness();
  try {
    h.runtime.grant();
    assert.equal(readConsent(h.env.now()).status, "granted");
    h.env.advance(CONSENT_TTL_MS - 1);
    assert.equal(readConsent(h.env.now()).status, "granted");
    h.env.advance(1);
    assert.equal(readConsent(h.env.now()).status, "undecided");
  } finally {
    h.teardown();
  }
});

test("unreadable, malformed, wrong-version and wrong-policy records are undecided", () => {
  const h = setupHarness();
  try {
    const bad = [
      "not json",
      "[]",
      "null",
      JSON.stringify({ v: 2, policy: "FEMME-GA4-v1", choice: "granted", exp: 9e15 }),
      JSON.stringify({ v: 1, policy: "OTHER-v9", choice: "granted", exp: 9e15 }),
      JSON.stringify({ v: 1, policy: "FEMME-GA4-v1", choice: "maybe", exp: 9e15 }),
      JSON.stringify({ v: 1, policy: "FEMME-GA4-v1", choice: "granted", exp: "soon" }),
      JSON.stringify({ v: 1, policy: "FEMME-GA4-v1", choice: "granted" }),
    ];
    for (const raw of bad) {
      h.env.local.raw.set(CONSENT_STORAGE_KEY, raw);
      assert.equal(readConsent(h.env.now()).status, "undecided", raw);
    }
    h.env.local.failReads = true;
    assert.equal(readConsent(h.env.now()).status, "undecided");
  } finally {
    h.teardown();
  }
});

test("a preference that cannot be saved is not treated as a decision", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.env.local.failWrites = true;
    assert.equal(h.runtime.grant().ok, false);
    assert.equal(h.runtime.getStatus(), "undecided");
    assert.equal(h.tag.loadRequests.length, 0);
    assert.equal(h.tag.collected.length, 0);
  } finally {
    h.teardown();
  }
});

test("grant loads once, counts the current page once, and replays nothing", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.trackEvent("cta_inquiry_click", { location: "hero" });
    h.runtime.trackEvent("phone_click", { location: "footer" });

    h.runtime.grant();
    assert.equal(h.tag.loadRequests.length, 1);
    assert.deepEqual(collectedNames(h), ["page_view"], "no pre-consent action is replayed");

    // Idempotent: a second init and a repeated grant do not load twice.
    h.runtime.init();
    h.runtime.grant();
    assert.equal(h.tag.loadRequests.length, 1);
    assert.deepEqual(collectedNames(h), ["page_view"]);
  } finally {
    h.teardown();
  }
});

test("withdrawal sets the documented opt-out, denies consent and clears GA cookies", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    assert.equal(h.disableFlag(), false);
    assert.deepEqual(Object.keys(h.env.cookies()).sort(), ["_ga", "_ga_FIXTURE0000"]);
    h.env.setCookie("unrelated_app_cookie", "keep-me");

    h.runtime.withdraw();

    assert.equal(h.disableFlag(), true, "ga-disable is set for the configured id");
    assert.deepEqual(Object.keys(h.env.cookies()), ["unrelated_app_cookie"]);
    const lastConsent = h.tag.consentStates.at(-1) as Record<string, string>;
    assert.equal(lastConsent.analytics_storage, "denied");
    assert.equal(lastConsent.ad_storage, "denied");
    assert.equal(lastConsent.ad_user_data, "denied");
    assert.equal(lastConsent.ad_personalization, "denied");

    // Provider-originated lifecycle traffic is suppressed, not merely unrouted.
    const before = h.tag.collected.length;
    h.tag.lifecycleTick();
    assert.equal(h.tag.collected.length, before);
    assert.equal(h.tag.suppressed.at(-1)?.name, "user_engagement");

    // And the wrapper itself emits nothing more.
    h.runtime.trackEvent("phone_click", { location: "footer" });
    h.runtime.recordNavigation("/about", "", "PUSH");
    assert.equal(h.tag.collected.length, before);
  } finally {
    h.teardown();
  }
});

test("withdrawal before the tag loads drops the queue and ignores the late load", () => {
  const h = setupHarness({ autoLoad: false });
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.runtime.trackEvent("cta_inquiry_click", { location: "hero" });
    assert.equal(h.tag.collected.length, 0, "nothing can have been sent before load");

    h.runtime.withdraw();
    // The script finally executes, from the invalidated load generation.
    h.tag.load();

    assert.equal(h.tag.collected.length, 0, "queued events did not revive on load");
    assert.equal(h.disableFlag(), true);
    const dataLayer = (globalThis as { dataLayer?: unknown[] }).dataLayer ?? [];
    const events = dataLayer.filter((entry) => Array.isArray(entry) && entry[0] === "event");
    assert.equal(events.length, 0, "no queued event entries were left behind");
  } finally {
    h.teardown();
  }
});

test("a withdrawal in another document tears this one down without a reload", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    const counted = h.tag.collected.length;

    // The peer document writes the denied preference; the browser fires
    // `storage` here. No reload happens, so an in-progress inquiry survives.
    h.env.local.raw.set(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        policy: "FEMME-GA4-v1",
        choice: "denied",
        exp: h.env.now() + CONSENT_TTL_MS,
      }),
    );
    h.env.emitStorageEvent(CONSENT_STORAGE_KEY, null);

    assert.equal(h.runtime.getStatus(), "denied");
    assert.equal(h.disableFlag(), true);
    assert.equal(storedSource(h), null);
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.equal(h.tag.collected.length, counted);
  } finally {
    h.teardown();
  }
});

test("clearing the preference elsewhere returns this document to undecided", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.env.local.raw.delete(CONSENT_STORAGE_KEY);
    h.env.emitStorageEvent(null, null);
    assert.equal(h.runtime.getStatus(), "undecided");
    assert.equal(h.disableFlag(), true);
  } finally {
    h.teardown();
  }
});

test("a returning granted visitor counts the page once on mount, not twice", () => {
  const first = setupHarness();
  let carried: Map<string, string>;
  try {
    first.runtime.recordNavigation("/", "", "PUSH");
    first.runtime.grant();
    carried = new Map(first.env.local.raw);
  } finally {
    first.teardown();
  }

  const revisit = setupHarness({ init: false });
  try {
    for (const [key, value] of carried) revisit.env.local.raw.set(key, value);
    revisit.runtime.init();
    // The tag starts before React mounts; the route effect then runs twice
    // under StrictMode.
    assert.equal(revisit.tag.loadRequests.length, 1);
    revisit.runtime.recordNavigation("/", "", "PUSH");
    revisit.runtime.recordNavigation("/", "", "PUSH");
    assert.deepEqual(collectedNames(revisit), ["page_view"]);
  } finally {
    revisit.teardown();
  }
});

test("a revisit after refusal stays inert", () => {
  const first = setupHarness();
  let carried: Map<string, string>;
  try {
    first.runtime.deny();
    carried = new Map(first.env.local.raw);
  } finally {
    first.teardown();
  }

  const revisit = setupHarness({ init: false });
  try {
    for (const [key, value] of carried) revisit.env.local.raw.set(key, value);
    revisit.runtime.init();
    revisit.runtime.recordNavigation("/", "", "PUSH");
    revisit.runtime.trackEvent("phone_click", { location: "footer" });
    assert.equal(revisit.tag.loadRequests.length, 0);
    assert.equal(revisit.tag.collected.length, 0);
  } finally {
    revisit.teardown();
  }
});

test("re-granting after a withdrawal resumes collection in the same document", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.runtime.withdraw();
    assert.equal(h.disableFlag(), true);

    h.runtime.grant();
    assert.equal(h.disableFlag(), false, "the opt-out is lifted again on a fresh grant");
    h.runtime.trackEvent("phone_click", { location: "footer" });
    const names = collectedNames(h);
    assert.equal(names.filter((name) => name === "phone_click").length, 1);
    // The pre-withdrawal pageview plus one fresh count for the current page.
    assert.equal(names.filter((name) => name === "page_view").length, 2);
  } finally {
    h.teardown();
  }
});

/* ── Ongoing consent validity in a document that stays open (finding F3) ───── */

test("an expired preference stops collection in an already-open document", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    assert.deepEqual(collectedNames(h), ["page_view"]);

    // The visitor never reloads; the six-month preference simply runs out while
    // this document is still open. Validity is re-checked before the emission,
    // so the click is not collected and teardown has already run.
    h.env.advance(CONSENT_TTL_MS);
    h.runtime.trackEvent("phone_click", { location: "footer" });

    assert.deepEqual(collectedNames(h), ["page_view"], "an expired grant collected again");
    assert.equal(h.runtime.getStatus(), "undecided");
    assert.equal(h.disableFlag(), true, "the documented opt-out is set on expiry");
    // Provider-originated traffic is suppressed too, not just wrapper calls.
    h.tag.lifecycleTick();
    assert.deepEqual(collectedNames(h), ["page_view"]);
  } finally {
    h.teardown();
  }
});

test("a preference that becomes unreadable fails closed mid-document", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.env.local.failReads = true;
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.deepEqual(collectedNames(h), ["page_view"]);
    assert.equal(h.runtime.getStatus(), "undecided");
    assert.equal(h.disableFlag(), true);
  } finally {
    h.teardown();
  }
});

test("a preference cleared elsewhere is caught on navigation and on resume", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();

    // Cleared without a `storage` event reaching us - for example while this
    // document was frozen in the background.
    h.env.local.raw.delete(CONSENT_STORAGE_KEY);
    h.runtime.recordNavigation("/about", "", "PUSH");
    assert.equal(h.runtime.getStatus(), "undecided");
    assert.deepEqual(collectedNames(h), ["page_view"], "no pageview after the grant vanished");

    // The same check runs when a backgrounded document is resumed.
    const resumed = setupHarness();
    try {
      resumed.runtime.recordNavigation("/", "", "PUSH");
      resumed.runtime.grant();
      resumed.env.local.raw.delete(CONSENT_STORAGE_KEY);
      resumed.env.emitLifecycleEvent("pageshow");
      assert.equal(resumed.runtime.getStatus(), "undecided");
      assert.equal(resumed.disableFlag(), true);
    } finally {
      resumed.teardown();
    }
  } finally {
    h.teardown();
  }
});

/* ── Withdrawal when the preference cannot be persisted (finding F4) ───────── */

test("a withdrawal that cannot be saved still stops this document", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    assert.deepEqual(collectedNames(h), ["page_view"]);

    // Storage goes away entirely: the write fails and the stored record still
    // says "granted". The refusal must still take effect here and now.
    h.env.local.failWrites = true;
    const result = h.runtime.withdraw();
    assert.equal(result.ok, false, "the caller is told the preference was not saved");

    assert.equal(h.runtime.getStatus(), "denied");
    assert.equal(h.disableFlag(), true);
    h.runtime.trackEvent("phone_click", { location: "footer" });
    h.tag.lifecycleTick();
    assert.deepEqual(collectedNames(h), ["page_view"], "collection continued after withdrawal");

    // And a stale "granted" record left behind by the failed write must not
    // resurrect collection on the next check.
    h.env.local.failWrites = false;
    h.runtime.recordNavigation("/about", "", "PUSH");
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.equal(h.runtime.getStatus(), "denied");
    assert.deepEqual(collectedNames(h), ["page_view"]);
  } finally {
    h.teardown();
  }
});

test("a grant that cannot be saved does not keep a previous session collecting", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.env.local.failWrites = true;
    h.env.local.failReads = true;

    assert.equal(h.runtime.grant().ok, false);
    assert.notEqual(h.runtime.getStatus(), "granted");
    assert.equal(h.disableFlag(), true);
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.deepEqual(collectedNames(h), ["page_view"]);
  } finally {
    h.teardown();
  }
});

test("withdrawal preserves the inquiry: no form field is read, written or cleared", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.env.local.failWrites = true;
    h.runtime.withdraw();
    // Nothing the runtime touches is form state; the only storage keys it ever
    // uses are the three approved ones, and none of them survive a withdrawal.
    const keys = [...h.env.local.raw.keys(), ...h.env.session.raw.keys()];
    for (const key of keys) assert.match(key, /^femme\.analytics\./);
  } finally {
    h.teardown();
  }
});

/* ── Idle expiry: teardown that does not wait for the visitor to do something ─ */

/** The largest delay a single `setTimeout` can represent. */
const MAX_TIMER_DELAY = 2_147_483_647;

test("an idle document tears itself down when the preference expires", () => {
  // Fake timers, not just a fake clock: the point of this test is that code
  // *waiting* on a timer runs. A six-month preference is about seven times
  // longer than one `setTimeout` can represent, so the wait has to be chained.
  const h = setupHarness({ fakeTimers: true });
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    assert.equal(h.env.pendingTimers(), 1, "no teardown timer was armed at all");

    // Past the single-timer ceiling, still far inside the six months. A delay
    // handed to `setTimeout` out of range does not mean "later", it means
    // "almost immediately", so a valid grant must survive this.
    h.env.advance(MAX_TIMER_DELAY + 1);
    assert.equal(h.runtime.getStatus(), "granted", "a valid grant was torn down early");
    assert.equal(h.env.pendingTimers(), 1, "the wait was not chained onwards");
    assert.notEqual(h.disableFlag(), true);

    // Nothing happens in this tab in the meantime: no navigation, no focus, no
    // click. The preference simply runs out.
    h.env.advance(CONSENT_TTL_MS);

    assert.equal(h.runtime.getStatus(), "undecided");
    assert.equal(h.disableFlag(), true, "the documented opt-out was not set on expiry");
    assert.equal(h.env.pendingTimers(), 0, "the teardown timer kept rearming after expiry");

    // Provider-originated traffic that never passes through the wrapper is
    // suppressed too - a stopped wrapper alone would not show this.
    h.tag.lifecycleTick();
    assert.deepEqual(collectedNames(h), ["page_view"], "the tag kept sending after expiry");
    assert.equal(h.tag.suppressed.length, 1, "the lifecycle ping was not suppressed");
  } finally {
    h.teardown();
  }
});

test("an event queued before the tag loads does not survive a timed expiry", () => {
  const h = setupHarness({ fakeTimers: true, autoLoad: false });
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.runtime.trackEvent("cta_inquiry_click", { location: "hero" });
    assert.equal(h.tag.collected.length, 0, "nothing can have been sent before load");

    // The document sits idle until the preference expires, and only then does
    // the long-pending script finally execute.
    h.env.advance(CONSENT_TTL_MS);
    h.tag.load();

    assert.equal(h.tag.collected.length, 0, "the queue revived when the tag loaded");
    assert.equal(h.disableFlag(), true);
    h.tag.lifecycleTick();
    assert.equal(h.tag.collected.length, 0, "the loaded tag kept its own timers running");
  } finally {
    h.teardown();
  }
});

test("a tag that finishes loading after the grant lapsed never goes live", () => {
  // No fake timers here: this isolates the adapter's own load-callback check
  // from the runtime's teardown timer, so neither one can hide the other. It is
  // also the weaker of the two paths, and the test says so rather than hiding
  // it - a script executes, drains whatever is already queued and only *then*
  // fires its load event, so the callback cannot un-send the backlog. Dropping
  // the queue before load is the teardown timer's job, and the test above is
  // what proves that happens. What the callback owns is everything after.
  const h = setupHarness({ autoLoad: false });
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.env.advance(CONSENT_TTL_MS);

    h.tag.load();

    assert.equal(h.runtime.getStatus(), "undecided", "the lapsed preference was not caught at load");
    assert.equal(h.disableFlag(), true, "the late tag was left live under an expired grant");
    assert.deepEqual(
      collectedNames(h),
      ["page_view"],
      "the backlog queued under a then-valid grant is drained at load and cannot be recalled",
    );

    // From the load callback onwards nothing else gets out: not the wrapper,
    // and not the tag's own lifecycle traffic.
    h.runtime.trackEvent("phone_click", { location: "footer" });
    h.tag.lifecycleTick();
    assert.deepEqual(collectedNames(h), ["page_view"]);
    assert.equal(h.tag.suppressed.length, 1, "the lifecycle ping was not suppressed");
  } finally {
    h.teardown();
  }
});

test("a hidden document is re-checked when it is hidden, not only when it comes back", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.env.advance(CONSENT_TTL_MS);

    h.env.setVisibility("hidden");
    h.env.emitLifecycleEvent("visibilitychange");
    assert.equal(h.runtime.getStatus(), "undecided");
    assert.equal(h.disableFlag(), true);

    // And `pagehide` is a checkpoint too, for the same reason: it is the last
    // moment this document is reliably running code.
    const later = setupHarness();
    try {
      later.runtime.recordNavigation("/", "", "PUSH");
      later.runtime.grant();
      later.env.advance(CONSENT_TTL_MS);
      later.env.emitLifecycleEvent("pagehide");
      assert.equal(later.runtime.getStatus(), "undecided");
    } finally {
      later.teardown();
    }
  } finally {
    h.teardown();
  }
});

/* ── A grant that could not be saved stays off ─────────────────────────────── */

test("a grant that cannot be saved cannot re-enable against its own old record", () => {
  // Only *writes* fail. Reads keep returning the previous, still perfectly
  // valid "granted" record - which is exactly what makes this dangerous: every
  // consent re-check would happily restore it.
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    const before = collectedNames(h).length;

    h.env.local.failWrites = true;
    assert.equal(h.runtime.grant().ok, false);
    assert.equal(h.runtime.getStatus(), "undecided", "an unsaved grant is not a decision");
    assert.equal(h.disableFlag(), true);

    // None of the consent checkpoints may bring it back.
    h.runtime.trackEvent("phone_click", { location: "footer" });
    h.runtime.recordNavigation("/about", "", "PUSH");
    h.env.emitLifecycleEvent("focus");
    h.env.emitLifecycleEvent("pageshow");
    h.env.emitStorageEvent("femme.analytics.consent.v1", "changed-elsewhere");
    h.runtime.trackEvent("cta_inquiry_click", { location: "hero" });

    assert.equal(h.runtime.getStatus(), "undecided");
    assert.equal(collectedNames(h).length, before, "collection was revived by a stale record");
    assert.equal(h.disableFlag(), true);
  } finally {
    h.teardown();
  }
});

test("a later grant that does save clears the latch and resumes collection", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.env.local.failWrites = true;
    assert.equal(h.runtime.grant().ok, false);
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.deepEqual(collectedNames(h), [], "an unsaved grant collected anyway");

    // The visitor fixes their browser storage settings and chooses again. A
    // fresh, successfully saved choice is a decision, and it is honoured.
    h.env.local.failWrites = false;
    assert.equal(h.runtime.grant().ok, true);
    assert.equal(h.runtime.getStatus(), "granted");
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.deepEqual(collectedNames(h), ["page_view", "phone_click"]);
  } finally {
    h.teardown();
  }
});

test("an unsaved refusal is latched off without being mistaken for a decision", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.env.local.failWrites = true;

    assert.equal(h.runtime.withdraw().ok, false);
    // A refusal *is* a decision about this tab, so unlike an unsaved grant it
    // reads as denied here - it just cannot claim to have been remembered.
    assert.equal(h.runtime.getStatus(), "denied");
    h.env.emitLifecycleEvent("focus");
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.equal(h.runtime.getStatus(), "denied");
    assert.deepEqual(collectedNames(h), ["page_view"]);
  } finally {
    h.teardown();
  }
});
