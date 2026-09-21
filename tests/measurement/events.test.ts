/**
 * Event allowlist, controlled provider context, and pageview counting.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SOURCE_IDLE_TTL_MS } from "../../src/lib/measurement/policy.ts";
import { validateEvent } from "../../src/lib/measurement/schema.ts";
import { routeLabelFor } from "../../src/lib/measurement/routes.ts";
import { SERVICE_OPTIONS } from "../../src/data/serviceOptions.ts";
import { createGa4Adapter } from "../../src/lib/measurement/ga4Adapter.ts";
import { FIXTURE_MEASUREMENT_ID, collectedNames, safeContext, setupHarness } from "./harness/setup.ts";

const GBP = "?utm_source=google&utm_medium=organic&utm_campaign=gbp";

test("the allowlist accepts exactly the approved events and values", () => {
  assert.deepEqual(validateEvent("phone_click", { location: "footer" }), {
    name: "phone_click",
    params: { location: "footer" },
  });
  assert.deepEqual(validateEvent("email_click", { location: "footer" }), {
    name: "email_click",
    params: { location: "footer" },
  });
  for (const location of ["hero", "process", "vendors", "faq"]) {
    assert.deepEqual(validateEvent("cta_inquiry_click", { location }), {
      name: "cta_inquiry_click",
      params: { location },
    });
  }
  for (const option of [...SERVICE_OPTIONS.map((o) => o.slug), "not-sure"]) {
    assert.deepEqual(validateEvent("inquiry_submit", { location: "inquiry_form", service: option }), {
      name: "inquiry_submit",
      params: { location: "inquiry_form", service: option },
    });
    assert.notEqual(
      validateEvent("cta_inquiry_click", { location: "service_card", service: option }),
      null,
    );
  }
});

test("unknown names, extra keys, bad values and injected source are rejected whole", () => {
  const rejected: [string, unknown][] = [
    ["nav_inquiry_click", { location: "nav_desktop" }],
    ["instagram_click", { location: "footer" }],
    ["vendor_link_click", { type: "website", vendor: "Some Vendor" }],
    ["page_view", { location: "hero" }],
    ["phone_click", { location: "footer", phone: "+16786445257" }],
    ["phone_click", { location: "hero" }],
    ["phone_click", {}],
    ["email_click", { location: "footer", email: "amanda@femmeevents.com" }],
    ["cta_inquiry_click", { location: "hero", service: "the-full-femme" }],
    ["cta_inquiry_click", { location: "service_card", service: "The Full Femme" }],
    ["cta_inquiry_click", { location: "nav_desktop" }],
    ["inquiry_submit", { location: "inquiry_form" }],
    ["inquiry_submit", { location: "inquiry_form", service: "the-full-femme", email: "a@b.co" }],
    ["inquiry_submit", { location: "inquiry_form", service: "custom-package" }],
    ["inquiry_submit", { location: "inquiry_form", service: 7 }],
    ["phone_click", { location: "footer", source: "google", medium: "organic", campaign: "gbp" }],
    ["phone_click", "footer"],
    ["phone_click", ["footer"]],
  ];
  for (const [name, params] of rejected) {
    assert.equal(validateEvent(name, params), null, name + " " + JSON.stringify(params));
  }
});

test("route labels never leak a slug, query or unknown path", () => {
  assert.equal(routeLabelFor("/"), "/");
  assert.equal(routeLabelFor("/about"), "/about");
  assert.equal(routeLabelFor("/about/"), "/about");
  assert.equal(routeLabelFor("/what-happens-next"), "/what-happens-next");
  assert.equal(routeLabelFor("/journal"), "/journal");
  assert.equal(routeLabelFor("/journal/a-real-wedding-story"), "/journal/post");
  assert.equal(routeLabelFor("/journal/a/b"), "/other");
  assert.equal(routeLabelFor("/anything-else"), "/other");
  assert.equal(routeLabelFor(""), "/other");
});

test("provider context is canonical, static and referrer-free", () => {
  const h = setupHarness({ pathname: "/journal/some-real-post-slug" });
  try {
    h.env.setLocation({ pathname: "/journal/some-real-post-slug" });
    h.runtime.recordNavigation("/journal/some-real-post-slug", "?utm_x=1", "PUSH");
    h.runtime.grant();

    const config = h.tag.configs[0];
    assert.equal(config.params.send_page_view, false);
    assert.equal(config.params.cookie_expires, 0);
    assert.equal(config.params.allow_google_signals, false);
    assert.equal(config.params.allow_ad_personalization_signals, false);
    assert.equal(config.params.page_location, "https://femmeevents.com/journal/post");
    assert.equal(config.params.page_title, "Femme Events");
    assert.equal(config.params.page_referrer, "");

    const pageview = h.tag.collected.find((entry) => entry.name === "page_view");
    assert.equal(pageview?.params.page_location, "https://femmeevents.com/journal/post");
    assert.equal(pageview?.params.page_title, "Femme Events");
    assert.equal(pageview?.params.page_referrer, "");
    const serialised = JSON.stringify([h.tag.collected, h.tag.configs]);
    assert.equal(serialised.includes("some-real-post-slug"), false);
    assert.equal(serialised.includes("Atlanta Wedding"), false, "document.title is never sent");
  } finally {
    h.teardown();
  }
});

test("ads signals are denied in the default and the granted consent state", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    const [defaultState, grantedState] = h.tag.consentStates;
    assert.equal(defaultState.mode, "default");
    assert.equal(defaultState.analytics_storage, "denied");
    assert.equal(grantedState.mode, "update");
    assert.equal(grantedState.analytics_storage, "granted");
    for (const state of h.tag.consentStates) {
      assert.equal(state.ad_storage, "denied");
      assert.equal(state.ad_user_data, "denied");
      assert.equal(state.ad_personalization, "denied");
    }
  } finally {
    h.teardown();
  }
});

test("pathname navigation counts once; query and hash changes do not", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    assert.equal(collectedNames(h).filter((n) => n === "page_view").length, 1);

    // Switching package is a search-only change.
    h.runtime.recordNavigation("/", "?service=in-your-corner", "PUSH");
    h.runtime.recordNavigation("/", "?service=the-full-femme", "PUSH");
    assert.equal(collectedNames(h).filter((n) => n === "page_view").length, 1);

    h.runtime.recordNavigation("/about", "", "PUSH");
    h.runtime.recordNavigation("/journal", "", "PUSH");
    // Back to /about is a new navigation, not deduplicated forever.
    h.runtime.recordNavigation("/about", "", "POP");
    const labels = h.tag.collected
      .filter((entry) => entry.name === "page_view")
      .map((entry) => entry.params.page_location);
    assert.deepEqual(labels, [
      "https://femmeevents.com/",
      "https://femmeevents.com/about",
      "https://femmeevents.com/journal",
      "https://femmeevents.com/about",
    ]);
  } finally {
    h.teardown();
  }
});

test("a StrictMode double effect does not double count or duplicate events", () => {
  const h = setupHarness();
  try {
    // React StrictMode runs the route effect twice with identical arguments.
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.runtime.recordNavigation("/about", "", "PUSH");
    h.runtime.recordNavigation("/about", "", "PUSH");
    assert.equal(collectedNames(h).filter((n) => n === "page_view").length, 2);
  } finally {
    h.teardown();
  }
});

test("StrictMode double arrival does not create two arrivals", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    assert.equal(h.runtime.snapshotSource()?.arrival, 1);
  } finally {
    h.teardown();
  }
});

test("valid source rides eligible events; synthetic PII never appears anywhere", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    h.runtime.trackEvent("cta_inquiry_click", { location: "service_card", service: "the-full-femme" });
    const event = h.tag.collected.at(-1);
    // Safe provider context travels with custom events too, not just pageviews.
    assert.deepEqual(event?.params, {
      location: "service_card",
      service: "the-full-femme",
      source: "google",
      medium: "organic",
      campaign: "gbp",
      ...safeContext("/"),
    });

    // Attempts to smuggle personal data through the wrapper are dropped whole.
    const before = h.tag.collected.length;
    h.runtime.trackEvent("phone_click", { location: "footer", note: "Amanda Smith" });
    h.runtime.trackEvent("email_click", { location: "footer", email: "bride@example.com" });
    h.runtime.trackEvent("inquiry_submit", {
      location: "inquiry_form",
      service: "the-full-femme",
      message: "we want 120 guests on 2027-05-01",
    });
    assert.equal(h.tag.collected.length, before, "rejected payloads emit nothing");
    const serialised = JSON.stringify(h.tag.collected);
    for (const secret of ["Amanda Smith", "bride@example.com", "2027-05-01", "120 guests"]) {
      assert.equal(serialised.includes(secret), false, secret);
    }
  } finally {
    h.teardown();
  }
});

test("campaign context is configured before the first eligible event", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    const config = h.tag.configs[0];
    assert.equal(config.params.campaign_source, "google");
    assert.equal(config.params.campaign_medium, "organic");
    assert.equal(config.params.campaign_name, "gbp");
  } finally {
    h.teardown();
  }
});

/* ── Safe provider context on every event, not only pageviews (finding F5) ─── */

test("a custom event carries the current safe route context, not the landing one", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.runtime.recordNavigation("/about", "", "PUSH");
    h.runtime.trackEvent("phone_click", { location: "footer" });

    const event = h.tag.collected.at(-1);
    assert.equal(event?.name, "phone_click");
    assert.deepEqual(event?.params, { location: "footer", ...safeContext("/about") });
    // The provider's inherited view agrees: no stale page context is inherited.
    assert.equal(event?.effective.page_location, "https://femmeevents.com/about");
    assert.equal(event?.effective.page_title, "Femme Events");
    assert.equal(event?.effective.page_referrer, "");
  } finally {
    h.teardown();
  }
});

test("a journal detail route reports its category, never the slug", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    h.runtime.recordNavigation("/journal/a-real-post-slug", "", "PUSH");
    h.runtime.trackEvent("cta_inquiry_click", { location: "faq" });
    const serialised = JSON.stringify(h.tag.collected);
    assert.equal(serialised.includes("a-real-post-slug"), false);
    assert.equal(h.tag.collected.at(-1)?.params.page_location, "https://femmeevents.com/journal/post");
  } finally {
    h.teardown();
  }
});

test("raw context handed to the adapter cannot override the safe context", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    // Straight at the adapter seam, bypassing the allowlist that would already
    // have rejected these keys: the safe values must still win.
    const adapter = createGa4Adapter({
      measurementId: FIXTURE_MEASUREMENT_ID,
      loader: (request) => {
        const installer = (globalThis as Record<string, unknown>)
          .__FEMME_MEASUREMENT_FIXTURE_TAG__ as (r: typeof request) => void;
        installer(request);
        return { remove: () => {} };
      },
      now: () => h.env.now(),
      isPermitted: () => true,
    });
    adapter.start({ routeLabel: "/about", source: null });
    adapter.sendEvent(
      "phone_click",
      {
        location: "footer",
        page_location: "https://femmeevents.com/journal/a-real-post-slug?email=bride@example.com",
        page_title: "Femme Events - Atlanta Wedding & Event Planning",
        page_referrer: "https://www.google.com/search?q=wedding+planner",
      } as unknown as Record<string, string>,
      "/about",
    );
    const event = h.tag.collected.at(-1);
    assert.deepEqual(event?.params, { location: "footer", ...safeContext("/about") });
    const serialised = JSON.stringify(h.tag.collected);
    assert.equal(serialised.includes("bride@example.com"), false);
    assert.equal(serialised.includes("google.com/search"), false);
  } finally {
    h.teardown();
  }
});

/* ── Provider route context follows navigation (finding B-CTX-01) ──────────── */

/** `page_location` of every `config` the modelled tag has processed, in order. */
function configuredLocations(h: ReturnType<typeof setupHarness>): unknown[] {
  return h.tag.configs.map((config) => config.params.page_location);
}

test("untagged navigation refreshes the provider route context without a campaign", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.grant();
    assert.deepEqual(configuredLocations(h), ["https://femmeevents.com/"]);

    h.runtime.recordNavigation("/about", "", "PUSH");
    assert.deepEqual(configuredLocations(h), [
      "https://femmeevents.com/",
      "https://femmeevents.com/about",
    ]);
    // The refresh is context only: it cannot re-enable the automatic pageview,
    // and with no campaign held it neither sets nor clears one.
    assert.deepEqual(h.tag.configs.at(-1)?.params, { send_page_view: false, ...safeContext("/about") });

    // Provider-originated traffic never passes through the wrapper, so the
    // config scope is the only route context it has.
    h.tag.lifecycleTick();
    const lifecycle = h.tag.collected.at(-1);
    assert.equal(lifecycle?.name, "user_engagement");
    assert.equal(lifecycle?.effective.page_location, "https://femmeevents.com/about");
    assert.equal(lifecycle?.effective.page_title, "Femme Events");
    assert.equal(lifecycle?.effective.page_referrer, "");
    assert.equal("campaign_name" in (lifecycle?.effective ?? {}), false);

    // Exactly one pageview per route, and the config is set before it.
    assert.deepEqual(collectedNames(h), ["page_view", "page_view", "user_engagement"]);
  } finally {
    h.teardown();
  }
});

test("GBP-attributed navigation refreshes the route context and keeps the campaign", () => {
  const h = setupHarness({ search: GBP });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    h.runtime.recordNavigation("/about", "", "PUSH");

    assert.deepEqual(configuredLocations(h), [
      "https://femmeevents.com/",
      "https://femmeevents.com/about",
    ]);
    assert.deepEqual(h.tag.configs.at(-1)?.params, {
      send_page_view: false,
      ...safeContext("/about"),
      campaign_source: "google",
      campaign_medium: "organic",
      campaign_name: "gbp",
    });

    h.tag.lifecycleTick();
    const lifecycle = h.tag.collected.at(-1);
    assert.equal(lifecycle?.effective.page_location, "https://femmeevents.com/about");
    assert.equal(lifecycle?.effective.campaign_source, "google");
    assert.equal(lifecycle?.effective.campaign_medium, "organic");
    assert.equal(lifecycle?.effective.campaign_name, "gbp");
    assert.equal(collectedNames(h).filter((n) => n === "page_view").length, 2);
    assert.equal(h.runtime.snapshotSource()?.arrival, 1, "a route change is not an arrival");
  } finally {
    h.teardown();
  }
});

test("only a change of route category reconfigures the provider", () => {
  const h = setupHarness({ pathname: "/journal/first-post" });
  try {
    h.runtime.recordNavigation("/journal/first-post", "", "PUSH");
    h.runtime.grant();
    assert.equal(h.tag.configs.length, 1);

    // A StrictMode repeat, a query-only change, an event and another post in
    // the same category all leave the configured context as it is.
    h.runtime.recordNavigation("/journal/first-post", "", "PUSH");
    h.runtime.recordNavigation("/journal/first-post", "?service=in-your-corner", "PUSH");
    h.runtime.trackEvent("phone_click", { location: "footer" });
    h.runtime.recordNavigation("/journal/second-post", "", "PUSH");
    assert.equal(h.tag.configs.length, 1);

    // History traversal to another category is a navigation like any other.
    h.runtime.recordNavigation("/", "", "POP");
    h.runtime.recordNavigation("/", "", "POP");
    assert.deepEqual(configuredLocations(h), [
      "https://femmeevents.com/journal/post",
      "https://femmeevents.com/",
    ]);
    h.tag.lifecycleTick();
    assert.equal(h.tag.collected.at(-1)?.effective.page_location, "https://femmeevents.com/");
    const serialised = JSON.stringify([h.tag.configs, h.tag.collected]);
    assert.equal(serialised.includes("first-post"), false, "never the slug");
    assert.equal(serialised.includes("second-post"), false, "never the slug");
  } finally {
    h.teardown();
  }
});

test("a route refresh neither skips nor repeats a campaign purge", () => {
  const h = setupHarness({ search: GBP, fakeTimers: true });
  try {
    h.runtime.recordNavigation("/", GBP, "PUSH");
    h.runtime.grant();
    // The source idles out on `/`, which purges the provider campaign there.
    h.env.advance(SOURCE_IDLE_TTL_MS);
    assert.equal(h.tag.configs.at(-1)?.params.campaign_name, "");
    assert.equal(h.tag.configs.at(-1)?.params.page_location, "https://femmeevents.com/");
    const afterPurge = h.tag.configs.length;

    h.runtime.recordNavigation("/about", "", "PUSH");
    assert.equal(h.tag.configs.length, afterPurge + 1);
    assert.deepEqual(h.tag.configs.at(-1)?.params, { send_page_view: false, ...safeContext("/about") });
    h.tag.lifecycleTick();
    const lifecycle = h.tag.collected.at(-1);
    assert.equal(lifecycle?.effective.page_location, "https://femmeevents.com/about");
    assert.equal(lifecycle?.effective.campaign_name, "", "the purge still stands");
  } finally {
    h.teardown();
  }
});

test("a refused, undecided or withdrawn visitor's navigation configures nothing", () => {
  const h = setupHarness();
  try {
    h.runtime.recordNavigation("/", "", "PUSH");
    h.runtime.recordNavigation("/about", "", "PUSH");
    assert.equal(h.tag.configs.length, 0, "undecided");
    h.runtime.grant();
    // A grant configures the route the visitor is on now, not the landing one.
    assert.deepEqual(configuredLocations(h), ["https://femmeevents.com/about"]);
    h.runtime.withdraw();
    const afterWithdrawal = h.tag.configs.length;
    h.runtime.recordNavigation("/journal", "", "PUSH");
    assert.equal(h.tag.configs.length, afterWithdrawal, "withdrawn");
    // Re-granting starts from the current route, with no stale sync state.
    h.runtime.grant();
    assert.equal(h.tag.configs.at(-1)?.params.page_location, "https://femmeevents.com/journal");
    h.runtime.recordNavigation("/about", "", "PUSH");
    assert.equal(h.tag.configs.at(-1)?.params.page_location, "https://femmeevents.com/about");
  } finally {
    h.teardown();
  }
});
