/**
 * Accepted-inquiry lifecycle: the in-flight latch, timeout/abort, exactly-once
 * success, and the consent/source races that can happen while a request is out.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createInquirySubmitter } from "../../src/lib/measurement/inquirySubmit.ts";
import { SOURCE_IDLE_TTL_MS } from "../../src/lib/measurement/policy.ts";
import { createMeasurementRuntime } from "../../src/lib/measurement/runtime.ts";
import type { MeasurementRuntime } from "../../src/lib/measurement/runtime.ts";
import { collectedNames, safeContext, setupHarness, storedSource } from "./harness/setup.ts";
import type { Harness } from "./harness/setup.ts";

const GBP = "?utm_source=google&utm_medium=organic&utm_campaign=gbp";
const ENDPOINT = "https://formspree.invalid/f/local-inert-fixture";

type Deferred = { promise: Promise<Response>; resolve: (value: Response) => void; reject: (reason: unknown) => void };

function deferred(): Deferred {
  let resolve!: (value: Response) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

/** A fetch stub with manual timers, so no test depends on real wall-clock time. */
function createFakeFetch() {
  const calls: { url: string; body: Record<string, string>; signal?: AbortSignal }[] = [];
  const pending: Deferred[] = [];
  const timers: { handler: () => void; ms: number; cancelled: boolean }[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(String(init.body)) as Record<string, string>,
      signal: init.signal ?? undefined,
    });
    const d = deferred();
    pending.push(d);
    init.signal?.addEventListener("abort", () => d.reject(new Error("The operation was aborted.")));
    return d.promise;
  }) as unknown as typeof fetch;
  return {
    calls,
    pending,
    fetchImpl,
    setTimeoutImpl: (handler: () => void, ms: number) => {
      timers.push({ handler, ms, cancelled: false });
      return timers.length - 1;
    },
    clearTimeoutImpl: (handle: unknown) => {
      const timer = timers[handle as number];
      if (timer) timer.cancelled = true;
    },
    fireTimeout: (index = 0) => {
      const timer = timers[index];
      assert.ok(timer && !timer.cancelled, "expected a live timeout timer");
      timer.handler();
    },
    timerDelay: (index = 0) => timers[index]?.ms,
  };
}

function makeSubmitter(fake: ReturnType<typeof createFakeFetch>, timeoutMs?: number) {
  return createInquirySubmitter({
    endpoint: ENDPOINT,
    fetchImpl: fake.fetchImpl,
    timeoutMs,
    setTimeoutImpl: fake.setTimeoutImpl,
    clearTimeoutImpl: fake.clearTimeoutImpl,
  });
}

test("a second submit while one is in flight never issues a second POST", async () => {
  const fake = createFakeFetch();
  const submitter = makeSubmitter(fake);
  const first = submitter.submit({ firstName: "A" });
  // Synchronously, before any await resolves: rapid Enter, double click, a
  // re-render firing the handler again.
  const second = submitter.submit({ firstName: "A" });
  const third = submitter.submit({ firstName: "A" });
  assert.equal(fake.calls.length, 1);
  assert.equal((await second).status, "duplicate");
  assert.equal((await third).status, "duplicate");
  fake.pending[0].resolve(fakeResponse(200));
  assert.equal((await first).status, "accepted");
});

test("a timeout aborts, reports timeout, and ignores the late response", async () => {
  const fake = createFakeFetch();
  const submitter = makeSubmitter(fake);
  const result = submitter.submit({ firstName: "A" });
  assert.equal(fake.timerDelay(), 15_000);
  fake.fireTimeout();
  assert.equal(fake.calls[0].signal?.aborted, true);
  // The server answers anyway - an abandoned operation must not become success.
  fake.pending[0].resolve(fakeResponse(200));
  assert.equal((await result).status, "timeout");
  assert.equal(submitter.isInFlight(), false, "a retry is allowed after a settled failure");
});

test("non-2xx and network failures settle once, and a retry gets a new operation", async () => {
  const fake = createFakeFetch();
  const submitter = makeSubmitter(fake);
  const rejected = submitter.submit({ firstName: "A" });
  fake.pending[0].resolve(fakeResponse(500));
  const first = await rejected;
  assert.equal(first.status, "rejected");
  assert.equal(first.message, "Server responded with 500");

  const failed = submitter.submit({ firstName: "A" });
  fake.pending[1].reject(new Error("Failed to fetch"));
  assert.equal((await failed).status, "network");

  const retried = submitter.submit({ firstName: "A" });
  fake.pending[2].resolve(fakeResponse(200));
  const accepted = await retried;
  assert.equal(accepted.status, "accepted");
  assert.notEqual(accepted.operationId, first.operationId);
  assert.equal(fake.calls.length, 3);
});

test("exactly one success event follows one accepted operation", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();
    h.runtime.trackInquirySuccess("inquiry-1", "the-full-femme", snapshot);
    // A duplicated success callback for the same client operation is ignored.
    h.runtime.trackInquirySuccess("inquiry-1", "the-full-femme", snapshot);
    const successes = h.tag.collected.filter((entry) => entry.name === "inquiry_submit");
    assert.equal(successes.length, 1);
    assert.deepEqual(successes[0].params, {
      location: "inquiry_form",
      service: "the-full-femme",
      source: "google",
      medium: "organic",
      campaign: "gbp",
      ...safeContext("/"),
    });
  } finally {
    h.teardown();
  }
});

test("withdrawal during a request emits no success event", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();
    h.runtime.withdraw();
    h.runtime.trackInquirySuccess("inquiry-1", "the-full-femme", snapshot);
    assert.equal(collectedNames(h).includes("inquiry_submit"), false);
  } finally {
    h.teardown();
  }
});

test("source that expires during a request is omitted, not retained", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();
    assert.notEqual(snapshot, null);
    // The visitor leaves the form open past the idle window before it is accepted.
    h.env.advance(SOURCE_IDLE_TTL_MS);
    h.runtime.trackInquirySuccess("inquiry-1", "getting-it-together", snapshot);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.deepEqual(success?.params, {
      location: "inquiry_form",
      service: "getting-it-together",
      ...safeContext("/"),
    });
    const purge = h.tag.configs.at(-1);
    assert.equal(purge?.params.campaign_source, "", "stale campaign context is purged too");
  } finally {
    h.teardown();
  }
});

test("a campaign captured during a request is not substituted into the success", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();
    // Mid-request, another tagged navigation replaces the attribution.
    h.runtime.recordNavigation("/about", GBP, "PUSH");
    assert.equal(h.runtime.snapshotSource()?.arrival, 2);
    h.runtime.trackInquirySuccess("inquiry-1", "in-your-corner", snapshot);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.deepEqual(
      success?.params,
      {
        location: "inquiry_form",
        service: "in-your-corner",
        // The snapshot no longer matches, so no source is claimed - and the
        // campaign the *new* arrival put on the page is cleared for this one
        // payload, because omitting the wrapper's source fields would not stop
        // the event inheriting it.
        campaign_source: "",
        campaign_medium: "",
        campaign_name: "",
        ...safeContext("/about"),
      },
    );
    assert.equal(success?.effective.campaign_source, "");
    assert.equal(success?.effective.campaign_medium, "");
    assert.equal(success?.effective.campaign_name, "");
    // The page's own campaign context is untouched: this visitor really did
    // arrive through GBP, and the next ordinary event still says so.
    assert.equal(h.tag.configState().campaign_name, "gbp");
    h.runtime.trackEvent("phone_click", { location: "footer" });
    const nextEvent = h.tag.collected.at(-1);
    assert.equal(nextEvent?.name, "phone_click");
    assert.equal(nextEvent?.effective.campaign_source, "google");
    assert.equal(nextEvent?.effective.campaign_medium, "organic");
    assert.equal(nextEvent?.effective.campaign_name, "gbp");
  } finally {
    h.teardown();
  }
});

test("a grant that arrives mid-request does not backfill attribution", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    const snapshot = h.runtime.snapshotSource();
    assert.equal(snapshot, null, "an undecided visitor sends no source with the request");
    h.runtime.grant();
    h.runtime.trackInquirySuccess("inquiry-1", "not-sure", snapshot);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.deepEqual(success?.params, {
      location: "inquiry_form",
      service: "not-sure",
      // The grant promoted the held candidate, so the page now carries a
      // campaign. The request was formed before any of that, and a null
      // snapshot must not be quietly upgraded by inheritance.
      campaign_source: "",
      campaign_medium: "",
      campaign_name: "",
      ...safeContext("/"),
    });
    assert.equal(success?.effective.campaign_name, "");
  } finally {
    h.teardown();
  }
});

test("a matching snapshot keeps the campaign the submission was made under", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();
    h.runtime.trackInquirySuccess("inquiry-1", "in-your-corner", snapshot);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    // Nothing is cleared here: the attribution the request was formed with is
    // still the current one, so the event reports it and the inherited campaign
    // is the right campaign.
    assert.equal(success?.params.source, "google");
    assert.equal(success?.params.campaign_source, undefined, "no event-scoped override needed");
    assert.equal(success?.effective.campaign_source, "google");
    assert.equal(success?.effective.campaign_medium, "organic");
    assert.equal(success?.effective.campaign_name, "gbp");
  } finally {
    h.teardown();
  }
});

test("a success with no campaign anywhere carries no campaign fields at all", () => {
  // No GBP arrival: there is nothing to inherit, so the event must not gain
  // three empty campaign fields just to say so.
  const h = setupHarness();
  try {
    h.runtime.grant();
    h.runtime.trackInquirySuccess("inquiry-1", "not-sure", null);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.deepEqual(success?.params, {
      location: "inquiry_form",
      service: "not-sure",
      ...safeContext("/"),
    });
    assert.equal(success?.effective.campaign_source, undefined);
    assert.equal(success?.effective.campaign_medium, undefined);
    assert.equal(success?.effective.campaign_name, undefined);
  } finally {
    h.teardown();
  }
});

test("a refused visitor still gets a normal accepted submission, with no analytics", async () => {
  const fake = createFakeFetch();
  const submitter = makeSubmitter(fake);
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.deny();
    const snapshot = h.runtime.snapshotSource();
    const pending = submitter.submit({ firstName: "A", email: "a@b.co", phone: "1", message: "hi" });
    fake.pending[0].resolve(fakeResponse(200));
    const outcome = await pending;
    assert.equal(outcome.status, "accepted");
    h.runtime.trackInquirySuccess(outcome.operationId, "the-full-femme", snapshot);
    assert.equal(h.tag.collected.length, 0);
    assert.deepEqual(Object.keys(fake.calls[0].body).sort(), ["email", "firstName", "message", "phone"]);
  } finally {
    h.teardown();
  }
});

/* ── Campaign context cannot leak through provider config (finding F5) ─────── */

test("an expired source is not reinstated through inherited campaign config", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();
    assert.notEqual(snapshot, null);
    // The tag has already inherited the campaign from the initial config.
    assert.equal(h.tag.configState().campaign_source, "google");

    h.env.advance(SOURCE_IDLE_TTL_MS);
    h.runtime.trackInquirySuccess("inquiry-1", "getting-it-together", snapshot);

    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.equal(success?.params.source, undefined, "no source on the event itself");
    // And the modelled provider view agrees: the inherited campaign was purged,
    // so the success is not silently attributed to GBP behind the event.
    assert.equal(success?.effective.campaign_source, "");
    assert.equal(success?.effective.campaign_medium, "");
    assert.equal(success?.effective.campaign_name, "");
    assert.equal(h.tag.configState().campaign_source, "");
  } finally {
    h.teardown();
  }
});

test("an invalid source arriving during a request purges the provider campaign", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();
    assert.equal(h.tag.configState().campaign_name, "gbp");

    // Mid-request the visitor follows a link carrying campaign-shaped input
    // that is not the approved tuple. That clears the attribution rather than
    // being relabelled as GBP.
    h.runtime.recordNavigation("/about", "?utm_source=google&utm_medium=cpc&utm_campaign=gbp", "PUSH");
    assert.equal(h.runtime.snapshotSource(), null);

    h.runtime.trackInquirySuccess("inquiry-1", "in-your-corner", snapshot);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.equal(success?.params.source, undefined, "no source on the event itself");
    // The inherited campaign is gone too, so the provider cannot attribute this
    // submission to GBP behind the event's back.
    assert.equal(success?.effective.campaign_name, "");
    assert.equal(h.tag.configState().campaign_name, "");
  } finally {
    h.teardown();
  }
});

test("a replacing arrival does not put its own attribution on an older submission", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();

    // A second tagged arrival replaces the attribution the request was formed
    // with. GBP is the only recognised tuple, so the replacement necessarily
    // carries the same campaign values - what must not happen is the *event*
    // claiming a source it no longer owns.
    h.runtime.recordNavigation("/about", GBP, "PUSH");
    assert.equal(h.runtime.snapshotSource()?.arrival, 2);

    h.runtime.trackInquirySuccess("inquiry-1", "in-your-corner", snapshot);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.equal(success?.params.source, undefined);
    assert.equal(success?.params.medium, undefined);
    assert.equal(success?.params.campaign, undefined);

    // Dropping the wrapper's source fields is not sufficient on its own: the
    // page's campaign is inherited by every event, so the replacing arrival
    // would still have labelled this submission. The campaign is therefore
    // cleared at event scope, and the modelled provider view agrees.
    assert.equal(success?.effective.campaign_source, "");
    assert.equal(success?.effective.campaign_medium, "");
    assert.equal(success?.effective.campaign_name, "");

    // The *page-level* context is deliberately left alone: the visitor really
    // is on a page reached through a GBP link, and purging that would mislabel
    // a real arrival as having no campaign. Only this one payload abstains.
    assert.equal(h.tag.configState().campaign_name, "gbp");
  } finally {
    h.teardown();
  }
});

test("a success withdrawn mid-request is not replayed by a later re-grant", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.runtime.withdraw();

    // The backend accepts after the withdrawal: no success event.
    h.runtime.trackInquirySuccess("inquiry-1", "the-full-femme", null);
    assert.equal(collectedNames(h).includes("inquiry_submit"), false);

    // The visitor changes their mind. The already-resolved operation must not
    // be replayed, but a genuinely new submission still counts.
    h.runtime.grant();
    h.runtime.trackInquirySuccess("inquiry-1", "the-full-femme", null);
    assert.equal(collectedNames(h).includes("inquiry_submit"), false, "a withdrawn success replayed");

    h.runtime.trackInquirySuccess("inquiry-2", "the-full-femme", null);
    assert.equal(
      h.tag.collected.filter((entry) => entry.name === "inquiry_submit").length,
      1,
      "a new operation after re-granting still counts once",
    );
  } finally {
    h.teardown();
  }
});

/* ── Attribution instances across a same-tab reload (finding A-R1) ─────────── */

/**
 * A granted GBP visitor reloads the tab: consent and the stored source record
 * carry over, the URL is not re-read, and the new document starts with a fresh
 * in-memory arrival ledger.
 */
function reloadedWithRestoredSource(): Harness {
  const first = setupHarness({ search: GBP });
  let carriedSession: Map<string, string>;
  let carriedLocal: Map<string, string>;
  try {
    first.runtime.grant();
    assert.equal((storedSource(first) as Record<string, unknown>).n, 1);
    carriedSession = new Map(first.env.session.raw);
    carriedLocal = new Map(first.env.local.raw);
  } finally {
    first.teardown();
  }
  const reloaded = setupHarness({ search: GBP, navigationType: "reload", init: false });
  for (const [key, value] of carriedSession) reloaded.env.session.raw.set(key, value);
  for (const [key, value] of carriedLocal) reloaded.env.local.raw.set(key, value);
  reloaded.runtime.init();
  return reloaded;
}

test("an arrival after a reload is a different attribution instance from the restored one", () => {
  const h = reloadedWithRestoredSource();
  try {
    const snapshot = h.runtime.snapshotSource();
    assert.equal(snapshot?.arrival, 1, "the restored record keeps the ordinal it was written with");

    // Mid-request, a second later, a genuine tagged navigation replaces the
    // attribution. This document's ledger has never minted anything, so without
    // knowing about the restored ordinal it would mint the same one again.
    h.env.advance(1_000);
    h.runtime.recordNavigation("/about", GBP, "PUSH");
    const replacement = h.runtime.snapshotSource();
    assert.notEqual(replacement, null);
    assert.notEqual(replacement?.arrival, snapshot?.arrival, "two instances, two ordinals");
    assert.equal((storedSource(h) as Record<string, unknown>).n, 2, "minted past the restored ordinal");

    h.runtime.trackInquirySuccess("inquiry-1", "in-your-corner", snapshot);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.deepEqual(success?.params, {
      location: "inquiry_form",
      service: "in-your-corner",
      campaign_source: "",
      campaign_medium: "",
      campaign_name: "",
      ...safeContext("/about"),
    });
    assert.equal(success?.effective.campaign_name, "");

    // The page really was reached through GBP again, and ordinary events say so.
    h.runtime.trackEvent("phone_click", { location: "footer" });
    const nextEvent = h.tag.collected.at(-1);
    assert.equal(nextEvent?.name, "phone_click");
    assert.equal(nextEvent?.params.campaign, "gbp");
    assert.equal(nextEvent?.effective.campaign_name, "gbp");
  } finally {
    h.teardown();
  }
});

test("a restored source still labels a submission when nothing replaced it", () => {
  const h = reloadedWithRestoredSource();
  try {
    const snapshot = h.runtime.snapshotSource();
    h.env.advance(1_000);
    // Ordinary navigation is not an arrival and must not look like one.
    h.runtime.recordNavigation("/about", "", "PUSH");
    h.runtime.trackInquirySuccess("inquiry-1", "in-your-corner", snapshot);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.deepEqual(success?.params, {
      location: "inquiry_form",
      service: "in-your-corner",
      source: "google",
      medium: "organic",
      campaign: "gbp",
      ...safeContext("/about"),
    });
    assert.equal(success?.effective.campaign_name, "gbp");
    assert.equal((storedSource(h) as Record<string, unknown>).n, 1, "restoration mints nothing");
  } finally {
    h.teardown();
  }
});

test("a restored source that idles out before a new arrival is not revived by it", () => {
  const h = reloadedWithRestoredSource();
  try {
    const snapshot = h.runtime.snapshotSource();
    // The restored attribution expires, and only then does a new arrival land.
    h.env.advance(SOURCE_IDLE_TTL_MS);
    h.runtime.recordNavigation("/about", GBP, "PUSH");
    assert.notEqual(h.runtime.snapshotSource()?.arrival, snapshot?.arrival);
    h.runtime.trackInquirySuccess("inquiry-1", "in-your-corner", snapshot);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.equal(success?.params.campaign, undefined);
    assert.equal(success?.effective.campaign_name, "");
  } finally {
    h.teardown();
  }
});

test("the ledger is seeded from the restored record before anything reads it", () => {
  const h = reloadedWithRestoredSource();
  try {
    // No snapshot, event or navigation has touched the restored record yet:
    // the very first thing this document does is take a new tagged arrival.
    h.runtime.recordNavigation("/about", GBP, "PUSH");
    assert.equal((storedSource(h) as Record<string, unknown>).n, 2, "not the restored ordinal again");
    assert.equal(h.runtime.snapshotSource()?.arrival, 2);
  } finally {
    h.teardown();
  }
});

test("a record written by a later document in the same tab keeps its own ordinal too", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    // This document minted arrival 1. It is then restored from the back/forward
    // cache after a later document in the same tab stored arrival 2 under the
    // same grant, so the record it reads is one it never minted.
    const record = storedSource(h) as Record<string, unknown>;
    h.env.session.raw.set("femme.analytics.source.v1", JSON.stringify({ ...record, n: 2 }));
    const snapshot = h.runtime.snapshotSource();
    assert.equal(snapshot?.arrival, 2);

    h.runtime.recordNavigation("/about", GBP, "PUSH");
    assert.notEqual(h.runtime.snapshotSource()?.arrival, snapshot?.arrival);
    h.runtime.trackInquirySuccess("inquiry-1", "in-your-corner", snapshot);
    const success = h.tag.collected.find((entry) => entry.name === "inquiry_submit");
    assert.equal(success?.params.campaign, undefined);
    assert.equal(success?.effective.campaign_name, "");
  } finally {
    h.teardown();
  }
});

/* ── Attribution instances across same-tab documents (finding A-R1) ────────── */

/**
 * A full forward navigation in the same tab. The earlier document goes into the
 * back/forward cache with its runtime, ledger and any in-flight inquiry intact;
 * the new document shares its consent and session storage and starts a runtime
 * and a ledger of its own.
 */
function openForwardDocument(h: Harness, pathname: string, search: string): MeasurementRuntime {
  h.env.emitLifecycleEvent("pagehide");
  h.env.advance(60_000);
  h.env.setLocation({ pathname, search });
  h.env.setNavigationType("navigate");
  const next = createMeasurementRuntime();
  next.init();
  return next;
}

/**
 * Back, restoring the earlier document from the cache. The later document's
 * listeners go quiet with it. `announce: false` leaves out the `pageshow`
 * checkpoint, because nothing may depend on a lifecycle event having been
 * delivered before the restored document does something.
 */
function restoreEarlierDocument(
  h: Harness,
  later: MeasurementRuntime,
  pathname: string,
  search: string,
  options: { announce?: boolean } = {},
): void {
  later.destroy();
  h.env.advance(1_000);
  h.env.setLocation({ pathname, search });
  if (options.announce !== false) h.env.emitLifecycleEvent("pageshow");
}

function successEvents(h: Harness) {
  return h.tag.collected.filter((entry) => entry.name === "inquiry_submit");
}

test("a tagged forward document does not reissue the ordinal an in-flight inquiry holds", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();
    assert.equal(snapshot?.arrival, 1);

    // The request is out. The visitor follows another GBP link: a whole new
    // document, whose ledger has minted nothing and would start again at one.
    const forward = openForwardDocument(h, "/", GBP);
    const replacement = forward.snapshotSource();
    assert.notEqual(replacement, null);
    assert.notEqual(replacement?.arrival, snapshot?.arrival, "two instances, two ordinals");
    assert.notEqual(replacement?.capturedAt, snapshot?.capturedAt);
    assert.equal((storedSource(h) as Record<string, unknown>).n, 2, "minted past the carried ordinal");

    // Back. The original operation is accepted in the restored document.
    restoreEarlierDocument(h, forward, "/", GBP);
    h.runtime.trackInquirySuccess("inquiry-1-1", "in-your-corner", snapshot);
    assert.equal(successEvents(h).length, 1);
    const success = successEvents(h)[0];
    assert.deepEqual(success.params, {
      location: "inquiry_form",
      service: "in-your-corner",
      campaign_source: "",
      campaign_medium: "",
      campaign_name: "",
      ...safeContext("/"),
    });
    assert.equal(success.effective.campaign_name, "", "config inheritance cannot relabel it either");

    // The replacement arrival is untouched by the old operation settling.
    const stored = storedSource(h) as Record<string, unknown>;
    assert.equal(stored.n, replacement?.arrival);
    assert.equal(stored.t, replacement?.capturedAt);
    h.runtime.trackEvent("phone_click", { location: "footer" });
    assert.equal(h.tag.collected.at(-1)?.params.campaign, "gbp");
    assert.equal(h.tag.collected.at(-1)?.effective.campaign_name, "gbp");
  } finally {
    h.teardown();
  }
});

test("an untagged forward document leaves the original attribution with its inquiry", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();
    const forward = openForwardDocument(h, "/about", "");
    assert.deepEqual(forward.snapshotSource(), snapshot, "the same instance, read by another document");

    restoreEarlierDocument(h, forward, "/", GBP);
    h.runtime.trackInquirySuccess("inquiry-1-1", "in-your-corner", snapshot);
    assert.equal(successEvents(h).length, 1);
    assert.deepEqual(successEvents(h)[0].params, {
      location: "inquiry_form",
      service: "in-your-corner",
      source: "google",
      medium: "organic",
      campaign: "gbp",
      ...safeContext("/"),
    });
    assert.equal(successEvents(h)[0].effective.campaign_name, "gbp");
    assert.equal((storedSource(h) as Record<string, unknown>).n, 1, "reading a record mints nothing");
  } finally {
    h.teardown();
  }
});

test("a restored document mints past arrivals a later document took while it was cached", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    // The later document arrives untagged, then takes a tagged in-app arrival
    // and forms an inquiry of its own with it.
    const forward = openForwardDocument(h, "/about", "");
    forward.recordNavigation("/", GBP, "PUSH");
    const laterSnapshot = forward.snapshotSource();
    assert.equal(laterSnapshot?.arrival, 2);

    // Back, and the very first thing the restored document does is take a
    // tagged arrival. Its own ledger last saw ordinal 1, and no lifecycle
    // checkpoint has run to tell it otherwise.
    restoreEarlierDocument(h, forward, "/", GBP, { announce: false });
    h.runtime.recordNavigation("/about", GBP, "PUSH");
    assert.equal((storedSource(h) as Record<string, unknown>).n, 3, "not the later document's ordinal");

    // Forward again: the later document's inquiry settles against a record
    // that replaced the one it was formed with.
    h.env.setLocation({ pathname: "/", search: GBP });
    forward.trackInquirySuccess("inquiry-1-1", "not-sure", laterSnapshot);
    assert.equal(successEvents(h).length, 1);
    assert.equal(successEvents(h)[0].params.campaign, undefined);
    assert.equal(successEvents(h)[0].effective.campaign_name, "");
  } finally {
    h.teardown();
  }
});

test("a reissued ordinal is still not the attribution the inquiry was formed with", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.grant();
    const snapshot = h.runtime.snapshotSource();
    assert.equal(snapshot?.arrival, 1);
    // Mid-request the attribution is cleared outright, so the next document has
    // no stored ordinal to continue from and nothing is kept that could tell it.
    h.runtime.recordNavigation("/about", "?utm_source=newsletter", "PUSH");
    assert.equal(storedSource(h), null);

    const forward = openForwardDocument(h, "/", GBP);
    const replacement = forward.snapshotSource();
    assert.equal(replacement?.arrival, snapshot?.arrival, "ordinal continuity ends with the record");
    assert.notEqual(replacement?.capturedAt, snapshot?.capturedAt);

    restoreEarlierDocument(h, forward, "/about", "?utm_source=newsletter");
    h.runtime.trackInquirySuccess("inquiry-1-1", "in-your-corner", snapshot);
    assert.equal(successEvents(h).length, 1);
    assert.equal(successEvents(h)[0].params.campaign, undefined, "an equal ordinal is not the same arrival");
    assert.equal(successEvents(h)[0].effective.campaign_name, "");
    assert.equal((storedSource(h) as Record<string, unknown>).t, replacement?.capturedAt);
  } finally {
    h.teardown();
  }
});
