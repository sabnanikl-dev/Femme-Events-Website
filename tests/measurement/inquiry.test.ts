/**
 * Accepted-inquiry lifecycle: the in-flight latch, timeout/abort, exactly-once
 * success, and the consent/source races that can happen while a request is out.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createInquirySubmitter } from "../../src/lib/measurement/inquirySubmit.ts";
import { SOURCE_IDLE_TTL_MS } from "../../src/lib/measurement/policy.ts";
import { collectedNames, safeContext, setupHarness } from "./harness/setup.ts";

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
