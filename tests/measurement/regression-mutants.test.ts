/**
 * Negative controls.
 *
 * Each shared assertion suite below is run twice: once against the real
 * implementation, where it must pass, and once against a deliberately weakened
 * mutant, where it must fail. Without this, a suite full of allowlist and
 * fail-closed assertions could be quietly vacuous.
 *
 * The first suite uses the actual pre-#161 analytics behaviour from
 * `af9a3be` as its mutant, so these tests demonstrably catch a regression back
 * to the code this issue replaces.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createGa4Adapter } from "../../src/lib/measurement/ga4Adapter.ts";
import type { Ga4Adapter, Ga4AdapterOptions } from "../../src/lib/measurement/ga4Adapter.ts";
import { writeConsent } from "../../src/lib/measurement/consentStore.ts";
import { decideSourceFields } from "../../src/lib/measurement/formSource.ts";
import type { MeasurementMode } from "../../src/lib/measurement/env.ts";
import { CONSENT_TTL_MS, SOURCE_STORAGE_KEY } from "../../src/lib/measurement/policy.ts";
import { classifySearch } from "../../src/lib/measurement/sourceInput.ts";
import type { SourceClassification } from "../../src/lib/measurement/sourceInput.ts";
import { validateEvent } from "../../src/lib/measurement/schema.ts";
import { readStoredSource, writeStoredSource } from "../../src/lib/measurement/sourceState.ts";
import type { SourceRecord } from "../../src/lib/measurement/sourceState.ts";
import { installFakeEnvironment } from "./harness/fakeEnvironment.ts";
import { installFakeTag } from "./harness/fakeTag.ts";
import { FIXTURE_MEASUREMENT_ID, setupHarness } from "./harness/setup.ts";
import type { Harness } from "./harness/setup.ts";

const GBP = "?utm_source=google&utm_medium=organic&utm_campaign=gbp";

function assertFails(name: string, run: () => void): void {
  let threw = false;
  try {
    run();
  } catch {
    threw = true;
  }
  assert.equal(threw, true, "the mutant '" + name + "' should have been caught but was not");
}

/* ── 1. The pre-#161 behaviour this issue replaces ─────────────────────────── */

type LegacyAnalytics = {
  init: (measurementId: string) => void;
  trackEvent: (name: string, props?: Record<string, unknown>) => void;
  trackPageview: (path: string) => void;
};

/** Faithful reproduction of `src/lib/analytics.ts` at af9a3be. */
function createLegacyAnalytics(): LegacyAnalytics {
  const target = globalThis as Record<string, unknown> & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  let id = "";
  return {
    init(measurementId: string) {
      id = measurementId;
      // Enabled purely by the env value being set. No consent guard at all.
      if (!id) return;
      target.dataLayer = target.dataLayer || [];
      target.gtag =
        target.gtag ||
        function (...args: unknown[]) {
          target.dataLayer?.push(args);
        };
      const doc = (globalThis as { document?: Document }).document;
      const script = doc?.createElement("script");
      if (script) {
        script.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
        doc?.head.appendChild(script);
      }
      target.gtag("js", new Date());
      target.gtag("config", id, { send_page_view: false });
    },
    trackEvent(name: string, props?: Record<string, unknown>) {
      if (!id) return;
      target.gtag?.("event", name, props ?? {});
    },
    trackPageview(path: string) {
      if (!id) return;
      const loc = (globalThis as { location?: { href?: string } }).location;
      const doc = (globalThis as { document?: { title?: string } }).document;
      target.gtag?.("event", "page_view", {
        page_path: path,
        page_location: loc?.href,
        page_title: doc?.title,
      });
    },
  };
}

type MeasurementLike = {
  visit: (search: string) => void;
  event: (name: string, props?: Record<string, unknown>) => void;
  pageview: (pathname: string, search: string) => void;
  collected: () => { name: string; params: Record<string, unknown> }[];
  scriptsCreated: () => number;
  teardown: () => void;
};

function realSubject(): MeasurementLike {
  let harness: Harness | null = null;
  return {
    visit(search) {
      harness = setupHarness({ search });
    },
    event(name, props) {
      harness?.runtime.trackEvent(name, props as Record<string, string>);
    },
    pageview(pathname, search) {
      harness?.runtime.recordNavigation(pathname, search, "PUSH");
    },
    collected: () => harness?.tag.collected ?? [],
    scriptsCreated: () => harness?.env.scripts.length ?? 0,
    teardown: () => harness?.teardown(),
  };
}

function legacySubject(): MeasurementLike {
  let env: ReturnType<typeof installFakeEnvironment> | null = null;
  let tag: ReturnType<typeof installFakeTag> | null = null;
  let legacy: LegacyAnalytics | null = null;
  return {
    visit(search) {
      env = installFakeEnvironment({ search });
      tag = installFakeTag();
      legacy = createLegacyAnalytics();
      // The legacy build enables itself from the environment value alone.
      legacy.init(FIXTURE_MEASUREMENT_ID);
      // Stand in for the real script executing after injection.
      (globalThis as Record<string, unknown>).__FEMME_MEASUREMENT_FIXTURE_TAG__ = undefined;
      tag.load();
    },
    event(name, props) {
      legacy?.trackEvent(name, props);
    },
    pageview(pathname, search) {
      legacy?.trackPageview(pathname + search);
    },
    collected: () => tag?.collected ?? [],
    scriptsCreated: () => env?.scripts.length ?? 0,
    teardown: () => {
      tag?.uninstall();
      env?.restore();
    },
  };
}

/** The consent, allowlist and raw-context contract, as executable assertions. */
function assertConsentAndMinimisationContract(makeSubject: () => MeasurementLike): void {
  const subject = makeSubject();
  try {
    subject.visit("?utm_source=google&utm_medium=organic&utm_campaign=gbp&email=bride@example.com");
    subject.pageview("/journal/a-real-post-slug", "?email=bride@example.com");
    subject.event("instagram_click", { location: "footer" });
    subject.event("phone_click", { location: "footer", phone: "+16786445257" });
    assert.equal(subject.scriptsCreated(), 0, "no tag script before an explicit grant");
    assert.equal(subject.collected().length, 0, "no collection before an explicit grant");
    const serialised = JSON.stringify(subject.collected());
    assert.equal(serialised.includes("bride@example.com"), false);
    assert.equal(serialised.includes("a-real-post-slug"), false);
    assert.equal(serialised.includes("Atlanta Wedding"), false);
  } finally {
    subject.teardown();
  }
}

test("the consent and minimisation contract holds for the current implementation", () => {
  assertConsentAndMinimisationContract(realSubject);
});

test("the same contract fails against the pre-#161 analytics behaviour", () => {
  assertFails("pre-#161 env-enabled analytics", () =>
    assertConsentAndMinimisationContract(legacySubject),
  );
});

/* ── 2. Strict source decoding ─────────────────────────────────────────────── */

/** Mutant: a tolerant parser that trims, lowercases and forgives duplicates. */
function lenientClassifySearch(search: string): SourceClassification {
  const params = new URLSearchParams(search);
  const get = (key: string) => (params.get(key) ?? "").trim().toLowerCase();
  if (get("utm_source") === "google" && get("utm_medium") === "organic" && get("utm_campaign") === "gbp") {
    return "gbp";
  }
  return params.has("utm_source") ? "unsupported" : "none";
}

function assertStrictSourceDecoding(classify: (search: string) => SourceClassification): void {
  assert.equal(classify(GBP), "gbp");
  assert.equal(classify("?utm_source=Google&utm_medium=organic&utm_campaign=gbp"), "unsupported");
  assert.equal(classify("?utm_source=google%20&utm_medium=organic&utm_campaign=gbp"), "unsupported");
  assert.equal(
    classify("?utm_source=google&utm_source=google&utm_medium=organic&utm_campaign=gbp"),
    "unsupported",
  );
  assert.equal(classify(GBP + "&gclid=abc"), "unsupported");
}

test("strict source decoding holds for the current implementation", () => {
  assertStrictSourceDecoding(classifySearch);
});

test("strict source decoding fails against a tolerant parser", () => {
  assertFails("tolerant UTM parser", () => assertStrictSourceDecoding(lenientClassifySearch));
});

/* ── 3. Whole-payload event rejection ──────────────────────────────────────── */

function permissiveValidateEvent(name: unknown, params: unknown) {
  return { name: String(name), params: (params ?? {}) as Record<string, string> };
}

function assertWholePayloadRejection(validate: typeof validateEvent): void {
  assert.equal(validate("phone_click", { location: "footer", phone: "+16786445257" }), null);
  assert.equal(validate("vendor_link_click", { type: "website", vendor: "A Vendor" }), null);
  assert.equal(validate("cta_inquiry_click", { location: "hero", service: "the-full-femme" }), null);
  assert.notEqual(validate("phone_click", { location: "footer" }), null);
}

test("whole-payload rejection holds for the current allowlist", () => {
  assertWholePayloadRejection(validateEvent);
});

test("whole-payload rejection fails against a pass-through validator", () => {
  assertFails("pass-through validator", () =>
    assertWholePayloadRejection(permissiveValidateEvent as typeof validateEvent),
  );
});

/* ── 4. Withdrawal actually suppresses tag-originated traffic ──────────────── */

/** Mutant: teardown that removes the script and stops the wrapper, but drops
 *  the documented `ga-disable` opt-out - the exact shortcut the policy warns is
 *  not proof that Google code stopped. */
function adapterWithoutDisableFlag(options: Ga4AdapterOptions): Ga4Adapter {
  const real = createGa4Adapter(options);
  return {
    ...real,
    stop: () => {
      real.stop();
      delete (globalThis as Record<string, unknown>)["ga-disable-" + options.measurementId];
    },
  };
}

function assertWithdrawalSuppressesLifecycleTraffic(
  make: (options: Ga4AdapterOptions) => Ga4Adapter,
): void {
  const env = installFakeEnvironment();
  const tag = installFakeTag();
  try {
    const adapter = make({
      measurementId: FIXTURE_MEASUREMENT_ID,
      loader: (request) => {
        const installer = (globalThis as Record<string, unknown>)
          .__FEMME_MEASUREMENT_FIXTURE_TAG__ as (r: typeof request) => void;
        installer(request);
        return { remove: () => {} };
      },
      now: () => env.now(),
      isPermitted: () => true,
    });
    adapter.start({ routeLabel: "/", source: null });
    adapter.sendPageview("/");
    assert.equal(tag.collected.length, 1);

    adapter.stop();
    // Provider-originated traffic that never passes through the wrapper.
    tag.lifecycleTick();
    assert.equal(tag.collected.length, 1, "nothing left the tag after withdrawal");
  } finally {
    tag.uninstall();
    env.restore();
  }
}

test("withdrawal suppresses modelled lifecycle traffic in the current adapter", () => {
  assertWithdrawalSuppressesLifecycleTraffic(createGa4Adapter);
});

test("withdrawal checks fail when the documented opt-out is dropped", () => {
  assertFails("teardown without ga-disable", () =>
    assertWithdrawalSuppressesLifecycleTraffic(adapterWithoutDisableFlag),
  );
});

/* ── 5. A revoked arrival stays dead ───────────────────────────────────────── */

function assertRevokedArrivalStaysDead(revoke: (harness: Harness) => void): void {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    assert.notEqual(h.runtime.snapshotSource(), null);
    revoke(h);
    h.runtime.grant();
    assert.equal(h.runtime.snapshotSource(), null, "a revoked arrival came back");
  } finally {
    h.teardown();
  }
}

test("a revoked arrival stays dead with the current withdrawal path", () => {
  assertRevokedArrivalStaysDead((h) => h.runtime.withdraw());
});

/**
 * A withdrawal that left its stored record behind used to be enough on its own
 * to bring the arrival back, and this suite caught exactly that. It no longer
 * is: a grant now adopts only attribution it has just written itself, so the
 * leftover is cleared again before it can be read. That is the point of the
 * repair, so the case is kept as a positive assertion rather than pretended to
 * be a live mutant — the mutant for the mechanism that *is* now load-bearing
 * is `assertLeftoverRecordIsNotAdopted` below.
 */
test("restoring the withdrawn session bytes still does not resurrect the arrival", () => {
  assertRevokedArrivalStaysDead((h) => {
    const before = new Map(h.env.session.raw);
    h.runtime.withdraw();
    for (const [key, value] of before) h.env.session.raw.set(key, value);
  });
});

/**
 * The record-level guarantee behind that: a stored record names the grant it
 * was captured under, so one that outlived its grant is not this grant's
 * attribution. A reader that ignores which grant a record belongs to is the
 * mutant, and it must be caught.
 */
type SourceReader = (now: number, consentEpoch: number | null) => SourceRecord | null;

function readIgnoringGrant(now: number, _consentEpoch: number | null): SourceRecord | null {
  // Identical to the real reader except that it never asks whose grant this is.
  return readStoredSource(now, readStoredGrantEpoch());
}

/** The epoch the stored record itself claims — i.e. always a "match". */
function readStoredGrantEpoch(): number | null {
  const raw = (globalThis as { sessionStorage?: Storage }).sessionStorage?.getItem(
    SOURCE_STORAGE_KEY,
  );
  if (raw === null || raw === undefined) return null;
  const parsed: unknown = JSON.parse(raw);
  const epoch = (parsed as Record<string, unknown>).g;
  return typeof epoch === "number" ? epoch : null;
}

function assertLeftoverRecordIsNotAdopted(read: SourceReader): void {
  const env = installFakeEnvironment();
  try {
    const first = env.now();
    // Written under the grant that was in force then.
    writeStoredSource({
      source: "google",
      medium: "organic",
      campaign: "gbp",
      capturedAt: first,
      lastActivity: first,
      arrival: 1,
      consentEpoch: first + CONSENT_TTL_MS,
    });
    // The visitor withdrew and granted again a minute later, and session
    // removal had been refused, so the old record is still sitting there.
    env.advance(60_000);
    const currentGrant = env.now() + CONSENT_TTL_MS;

    assert.equal(
      read(env.now(), currentGrant),
      null,
      "a record from the previous grant was adopted by the new one",
    );
  } finally {
    env.restore();
  }
}

test("a stored record from an earlier grant is not adopted by the current one", () => {
  assertLeftoverRecordIsNotAdopted(readStoredSource);
});

test("the same check fails for a reader that ignores which grant a record belongs to", () => {
  assertFails("source reader without grant binding", () =>
    assertLeftoverRecordIsNotAdopted(readIgnoringGrant),
  );
});

/* ── 6. Consent validity is re-checked, not cached ─────────────────────────── */

type CollectionGate = {
  grant: () => void;
  /** A second grant, made while writes fail but reads still work. */
  grantWithBrokenWrites: () => void;
  /** Blocks the preference store, then withdraws. */
  withdrawWithBrokenStorage: () => void;
  expire: () => void;
  emit: () => void;
  emitted: () => number;
  teardown: () => void;
};

function realGate(): CollectionGate {
  const h = setupHarness();
  h.runtime.recordNavigation("/", "", "PUSH");
  return {
    grant: () => h.runtime.grant(),
    grantWithBrokenWrites: () => {
      h.env.local.failWrites = true;
      h.runtime.grant();
    },
    withdrawWithBrokenStorage: () => {
      h.env.local.failWrites = true;
      h.runtime.withdraw();
    },
    expire: () => h.env.advance(CONSENT_TTL_MS),
    emit: () => h.runtime.trackEvent("phone_click", { location: "footer" }),
    emitted: () => h.tag.collected.filter((entry) => entry.name === "phone_click").length,
    teardown: () => h.teardown(),
  };
}

/**
 * Mutant: the pre-repair shape of this runtime. It reads the preference at init
 * and when a choice is written, then trusts that cached value forever, and it
 * treats a failed write as "nothing happened". Both are the exact defects the
 * repair removes.
 */
function cachedStatusGate(): CollectionGate {
  const h = setupHarness();
  h.runtime.recordNavigation("/", "", "PUSH");
  let cached: "granted" | "denied" | "undecided" = "undecided";
  const emitted: string[] = [];
  return {
    grant: () => {
      if (!writeConsent("granted", h.env.now())) return;
      cached = "granted";
    },
    grantWithBrokenWrites: () => {
      h.env.local.failWrites = true;
      // A failed save is treated as no decision at all, so the previous grant
      // - still sitting readable in storage - simply carries on.
      if (!writeConsent("granted", h.env.now())) return;
      cached = "granted";
    },
    withdrawWithBrokenStorage: () => {
      h.env.local.failWrites = true;
      // A failed save is treated as no decision at all: the cached grant stands.
      if (!writeConsent("denied", h.env.now())) return;
      cached = "denied";
    },
    expire: () => h.env.advance(CONSENT_TTL_MS),
    emit: () => {
      if (cached === "granted") emitted.push("phone_click");
    },
    emitted: () => emitted.length,
    teardown: () => h.teardown(),
  };
}

function assertConsentIsRecheckedAtEmission(makeGate: () => CollectionGate): void {
  const expired = makeGate();
  try {
    expired.grant();
    expired.expire();
    expired.emit();
    assert.equal(expired.emitted(), 0, "an expired preference kept collecting");
  } finally {
    expired.teardown();
  }

  const blocked = makeGate();
  try {
    blocked.grant();
    blocked.withdrawWithBrokenStorage();
    blocked.emit();
    assert.equal(blocked.emitted(), 0, "an unsaveable withdrawal kept collecting");
  } finally {
    blocked.teardown();
  }

  const unsavedGrant = makeGate();
  try {
    unsavedGrant.grant();
    // Writes start failing; reads still return the earlier, perfectly valid
    // "granted" record. A grant that cannot be written is not a decision, and
    // it must not leave the old one quietly in force either.
    unsavedGrant.grantWithBrokenWrites();
    unsavedGrant.emit();
    assert.equal(unsavedGrant.emitted(), 0, "an unsaveable grant re-enabled collection");
  } finally {
    unsavedGrant.teardown();
  }
}

test("consent validity is re-checked at emission in the current runtime", () => {
  assertConsentIsRecheckedAtEmission(realGate);
});

test("the same check fails against a runtime that caches its consent decision", () => {
  assertFails("cached consent status", () => assertConsentIsRecheckedAtEmission(cachedStatusGate));
});

/* ── 7. Safe context on every event ────────────────────────────────────────── */

/** Mutant: the pre-repair adapter, which set context on pageviews only. */
function adapterWithoutEventContext(options: Ga4AdapterOptions): Ga4Adapter {
  const real = createGa4Adapter(options);
  return { ...real, sendEvent: (name, params) => real.sendEvent(name, params, "") };
}

function assertEventsCarrySafeContext(make: (options: Ga4AdapterOptions) => Ga4Adapter): void {
  const env = installFakeEnvironment();
  const tag = installFakeTag();
  try {
    const adapter = make({
      measurementId: FIXTURE_MEASUREMENT_ID,
      loader: (request) => {
        const installer = (globalThis as Record<string, unknown>)
          .__FEMME_MEASUREMENT_FIXTURE_TAG__ as (r: typeof request) => void;
        installer(request);
        return { remove: () => {} };
      },
      now: () => env.now(),
      isPermitted: () => true,
    });
    adapter.start({ routeLabel: "/", source: null });
    adapter.sendEvent("phone_click", { location: "footer" }, "/about");
    const event = tag.collected.at(-1);
    assert.equal(event?.params.page_location, "https://femmeevents.com/about");
    assert.equal(event?.params.page_title, "Femme Events");
    assert.equal(event?.params.page_referrer, "");
  } finally {
    tag.uninstall();
    env.restore();
  }
}

test("custom events carry the safe context in the current adapter", () => {
  assertEventsCarrySafeContext(createGa4Adapter);
});

test("the same check fails against an adapter that sets context on pageviews only", () => {
  assertFails("event without safe context", () =>
    assertEventsCarrySafeContext(adapterWithoutEventContext),
  );
});

/* ── 8. The Formspree source-field gate ────────────────────────────────────── */

/** Mutant: a gate that trusts the fixture mode and ignores the endpoint. */
function modeOnlySourceFields(mode: MeasurementMode, _endpoint: string) {
  return { allowed: mode === "fixture", reason: "fixture-inert-endpoint" as const };
}

function assertSourceFieldGate(decide: typeof decideSourceFields): void {
  assert.equal(decide("live", "https://formspree.io/f/xpwazjvq").allowed, false);
  assert.equal(decide("disabled", "https://formspree.io/f/xpwazjvq").allowed, false);
  // A fixture build must not be able to post attribution to a real endpoint.
  assert.equal(decide("fixture", "https://formspree.io/f/xpwazjvq").allowed, false);
  assert.equal(decide("fixture", "https://formspree.invalid/f/local-inert-fixture").allowed, true);
}

test("the source-field gate holds for the current implementation", () => {
  assertSourceFieldGate(decideSourceFields);
});

test("the same gate fails when only the build mode is checked", () => {
  assertFails("mode-only source-field gate", () =>
    assertSourceFieldGate(modeOnlySourceFields as typeof decideSourceFields),
  );
});

/* ── 8. Idle expiry tears down on a timer, not only on activity ────────────── */

/** The largest delay a single `setTimeout` can represent. */
const MAX_TIMER_DELAY = 2_147_483_647;

type IdleGate = {
  grant: () => void;
  /** Time passes with no navigation, focus or interaction whatsoever. */
  idle: (ms: number) => void;
  /** Whether provider-originated traffic still leaves the modelled tag. */
  collecting: () => boolean;
  teardown: () => void;
};

function realIdleGate(): IdleGate {
  const h = setupHarness({ fakeTimers: true });
  return {
    grant: () => {
      h.runtime.grant();
    },
    idle: (ms) => h.env.advance(ms),
    collecting: () => {
      const before = h.tag.collected.length;
      h.tag.lifecycleTick();
      return h.tag.collected.length > before;
    },
    teardown: () => h.teardown(),
  };
}

/**
 * Mutant: the pre-repair scheduler. One timer, armed only when the delay fits
 * in a single `setTimeout` - which a six-month preference never does, so in
 * practice nothing was ever armed and teardown waited for the visitor to do
 * something. An idle tab therefore kept collecting indefinitely past expiry.
 */
function unscheduledExpiryGate(): IdleGate {
  const env = installFakeEnvironment({ fakeTimers: true });
  const tag = installFakeTag();
  const adapter = createGa4Adapter({
    measurementId: FIXTURE_MEASUREMENT_ID,
    loader: (request) => {
      const installer = (globalThis as Record<string, unknown>)
        .__FEMME_MEASUREMENT_FIXTURE_TAG__ as (r: typeof request) => void;
      installer(request);
      return { remove: () => {} };
    },
    now: () => env.now(),
    isPermitted: () => true,
  });
  const expiresAt = env.now() + CONSENT_TTL_MS;
  return {
    grant: () => {
      adapter.start({ routeLabel: "/", source: null });
      const delay = expiresAt - env.now();
      if (delay > 0 && delay <= MAX_TIMER_DELAY) {
        (globalThis as { setTimeout: (fn: () => void, ms: number) => unknown }).setTimeout(
          () => adapter.stop(),
          delay,
        );
      }
    },
    idle: (ms) => env.advance(ms),
    collecting: () => {
      const before = tag.collected.length;
      tag.lifecycleTick();
      return tag.collected.length > before;
    },
    teardown: () => {
      adapter.stop();
      tag.uninstall();
      env.restore();
    },
  };
}

function assertIdleExpiryTearsDown(makeGate: () => IdleGate): void {
  const gate = makeGate();
  try {
    gate.grant();
    // Well inside the six months, but past the point where a single timer can
    // represent the remaining wait. An out-of-range delay fires almost at once,
    // so this also catches a scheduler that tears a valid grant down early.
    gate.idle(MAX_TIMER_DELAY + 1);
    assert.equal(gate.collecting(), true, "a valid grant was torn down early");

    gate.idle(CONSENT_TTL_MS);
    assert.equal(gate.collecting(), false, "an idle document kept collecting past expiry");
  } finally {
    gate.teardown();
  }
}

test("an idle document stops collecting at expiry in the current runtime", () => {
  assertIdleExpiryTearsDown(realIdleGate);
});

test("the same check fails against a scheduler that skips out-of-range delays", () => {
  assertFails("unscheduled six-month expiry", () => assertIdleExpiryTearsDown(unscheduledExpiryGate));
});

/* ── 9. A success event does not inherit a campaign it does not own ────────── */

/** Mutant: the pre-repair adapter, with no event-scoped campaign control. An
 *  event that omitted the wrapper's source fields still inherited whatever
 *  campaign the page's `config` carried, so a mismatched or expired snapshot
 *  was silently relabelled behind the event's back. */
function adapterWithoutEventCampaignScope(options: Ga4AdapterOptions): Ga4Adapter {
  const real = createGa4Adapter(options);
  return {
    ...real,
    sendEvent: (name, params, routeLabel) => real.sendEvent(name, params, routeLabel),
  };
}

function assertSuccessDoesNotInheritPageCampaign(
  make: (options: Ga4AdapterOptions) => Ga4Adapter,
): void {
  const env = installFakeEnvironment();
  const tag = installFakeTag();
  try {
    const adapter = make({
      measurementId: FIXTURE_MEASUREMENT_ID,
      loader: (request) => {
        const installer = (globalThis as Record<string, unknown>)
          .__FEMME_MEASUREMENT_FIXTURE_TAG__ as (r: typeof request) => void;
        installer(request);
        return { remove: () => {} };
      },
      now: () => env.now(),
      isPermitted: () => true,
    });
    // The page carries a GBP campaign. The submission being reported does not.
    adapter.start({
      routeLabel: "/",
      source: { source: "google", medium: "organic", campaign: "gbp" },
    });
    adapter.sendEvent(
      "inquiry_submit",
      { location: "inquiry_form", service: "not-sure" },
      "/",
      "clear",
    );
    const success = tag.collected.at(-1);
    assert.equal(success?.effective.campaign_source, "", "the event inherited the page campaign");
    assert.equal(success?.effective.campaign_medium, "");
    assert.equal(success?.effective.campaign_name, "");

    // And the page keeps its own campaign for everything else.
    adapter.sendEvent("phone_click", { location: "footer" }, "/");
    assert.equal(tag.collected.at(-1)?.effective.campaign_name, "gbp");
  } finally {
    tag.uninstall();
    env.restore();
  }
}

test("an event-scoped campaign clear works in the current adapter", () => {
  assertSuccessDoesNotInheritPageCampaign(createGa4Adapter);
});

test("the same check fails against an adapter with no event-scoped campaign", () => {
  assertFails("inherited page campaign", () =>
    assertSuccessDoesNotInheritPageCampaign(adapterWithoutEventCampaignScope),
  );
});
