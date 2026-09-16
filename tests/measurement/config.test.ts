/**
 * Provider selection and the production activation gate.
 *
 * The headline case is the one the deployment actually faces: a real GA4
 * measurement id sitting in the production environment must still produce a
 * completely inert build.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  FORMSPREE_SOURCE_FIELDS_APPROVED,
  MEASUREMENT_ACTIVATION_APPROVED,
} from "../../src/lib/measurement/activation.ts";
import { decideSourceFields } from "../../src/lib/measurement/formSource.ts";
import { resolveMeasurementConfig } from "../../src/lib/measurement/env.ts";
import { installFakeEnvironment } from "./harness/fakeEnvironment.ts";
import { FIXTURE_ENV, setupHarness } from "./harness/setup.ts";

const PRODUCTION_ID = "G-EEJDWKYDLF";

test("production activation stays off in source, not in configuration", () => {
  assert.equal(MEASUREMENT_ACTIVATION_APPROVED, false);
  assert.equal(FORMSPREE_SOURCE_FIELDS_APPROVED, false);
});

test("an ambient production measurement id does not enable anything", () => {
  const env = installFakeEnvironment({ hostname: "femmeevents.com" });
  try {
    const config = resolveMeasurementConfig({
      MODE: "production",
      VITE_GA4_MEASUREMENT_ID: PRODUCTION_ID,
    });
    assert.equal(config.mode, "disabled");
    assert.equal(config.reason, "activation-not-approved");
  } finally {
    env.restore();
  }
});

test("the fixture opt-in alone cannot activate a production-mode build", () => {
  const env = installFakeEnvironment({ hostname: "femmeevents.com" });
  try {
    // Mode is production, so the opt-in token is not enough.
    assert.equal(
      resolveMeasurementConfig({
        MODE: "production",
        VITE_MEASUREMENT_FIXTURE: "local-inert-fixture",
        VITE_GA4_MEASUREMENT_ID: PRODUCTION_ID,
      }).mode,
      "disabled",
    );
    // Fixture mode plus token, but a public host, is still refused.
    assert.equal(
      resolveMeasurementConfig({ ...FIXTURE_ENV, VITE_GA4_MEASUREMENT_ID: PRODUCTION_ID }).mode,
      "disabled",
    );
  } finally {
    env.restore();
  }
});

test("all three fixture conditions together select the fixture path", () => {
  const env = installFakeEnvironment({ hostname: "127.0.0.1" });
  try {
    const config = resolveMeasurementConfig(FIXTURE_ENV);
    assert.equal(config.mode, "fixture");
    assert.equal(config.reason, "fixture-mode");
    assert.equal(config.measurementId, FIXTURE_ENV.VITE_GA4_MEASUREMENT_ID);
  } finally {
    env.restore();
  }
});

test("no id, malformed ids, Plausible-only and conflicting configs are inert", () => {
  const env = installFakeEnvironment({ hostname: "127.0.0.1" });
  try {
    const cases: [Record<string, string>, string][] = [
      [{ MODE: "measurement-fixture" }, "no-measurement-id"],
      [{ ...FIXTURE_ENV, VITE_GA4_MEASUREMENT_ID: "" }, "no-measurement-id"],
      [{ ...FIXTURE_ENV, VITE_GA4_MEASUREMENT_ID: "UA-12345-1" }, "malformed-measurement-id"],
      [{ ...FIXTURE_ENV, VITE_GA4_MEASUREMENT_ID: "g-lowercase1" }, "malformed-measurement-id"],
      [{ ...FIXTURE_ENV, VITE_GA4_MEASUREMENT_ID: "G-SHORT" }, "malformed-measurement-id"],
      [{ ...FIXTURE_ENV, VITE_GA4_MEASUREMENT_ID: "G-HAS SPACE00" }, "malformed-measurement-id"],
      [{ MODE: "production", VITE_PLAUSIBLE_DOMAIN: "femmeevents.com" }, "conflicting-provider-config"],
      [
        { ...FIXTURE_ENV, VITE_PLAUSIBLE_DOMAIN: "femmeevents.com" },
        "conflicting-provider-config",
      ],
      [
        { ...FIXTURE_ENV, VITE_PLAUSIBLE_API_HOST: "https://plausible.example" },
        "conflicting-provider-config",
      ],
    ];
    for (const [input, reason] of cases) {
      const config = resolveMeasurementConfig(input);
      assert.equal(config.mode, "disabled", JSON.stringify(input));
      assert.equal(config.reason, reason, JSON.stringify(input));
    }
  } finally {
    env.restore();
  }
});

test("a disabled runtime never loads, stores, counts or reports eligibility", () => {
  const harness = setupHarness({
    hostname: "femmeevents.com",
    env: { MODE: "production", VITE_GA4_MEASUREMENT_ID: PRODUCTION_ID },
    search: "?utm_source=google&utm_medium=organic&utm_campaign=gbp",
  });
  try {
    assert.equal(harness.runtime.isEligible(), false);
    assert.equal(harness.runtime.grant().ok, false);
    harness.runtime.recordNavigation("/", "", "PUSH");
    harness.runtime.trackEvent("cta_inquiry_click", { location: "hero" });
    assert.equal(harness.tag.loadRequests.length, 0);
    assert.equal(harness.tag.collected.length, 0);
    assert.equal(harness.env.scripts.length, 0);
    assert.equal(harness.env.local.raw.size, 0);
    assert.equal(harness.env.session.raw.size, 0);
    assert.deepEqual(harness.env.cookies(), {});
    assert.equal(harness.runtime.snapshotSource(), null);
  } finally {
    harness.teardown();
  }
});

/* ── Formspree source fields: production blocked, fixture inert (finding F1) ─ */

test("production source fields stay blocked whatever the endpoint is", () => {
  assert.equal(FORMSPREE_SOURCE_FIELDS_APPROVED, false);
  // The live path, with the real production endpoint: still refused.
  assert.deepEqual(decideSourceFields("live", "https://formspree.io/f/xpwazjvq"), {
    allowed: false,
    reason: "production-approval-pending",
  });
  // A disabled build never adds them either.
  assert.deepEqual(decideSourceFields("disabled", "https://formspree.io/f/xpwazjvq"), {
    allowed: false,
    reason: "not-fixture-mode",
  });
});

test("the fixture path adds source fields only to a provably inert endpoint", () => {
  assert.equal(
    decideSourceFields("fixture", "https://formspree.invalid/f/local-inert-fixture").allowed,
    true,
  );
  assert.equal(decideSourceFields("fixture", "http://127.0.0.1:4317/__inquiry").allowed, true);
  assert.equal(decideSourceFields("fixture", "/__inquiry").allowed, true);

  // A fixture build pointed at anything that could actually deliver is refused.
  for (const endpoint of [
    "https://formspree.io/f/xpwazjvq",
    "https://formspree.invalid.example.com/f/x",
    "//formspree.io/f/x",
    "https://127.0.0.1.attacker.example/f/x",
    "mailto:amanda@femmeevents.com",
    "",
  ]) {
    assert.equal(decideSourceFields("fixture", endpoint).allowed, false, endpoint);
  }
});

test("no environment value can turn the fixture source path on in production", () => {
  const env = installFakeEnvironment({ hostname: "femmeevents.com" });
  try {
    // Every fixture opt-in present at once, on the production host.
    const config = resolveMeasurementConfig({
      MODE: "measurement-fixture",
      VITE_MEASUREMENT_FIXTURE: "local-inert-fixture",
      VITE_GA4_MEASUREMENT_ID: PRODUCTION_ID,
    });
    assert.notEqual(config.mode, "fixture");
    assert.equal(decideSourceFields(config.mode, "https://formspree.io/f/xpwazjvq").allowed, false);
  } finally {
    env.restore();
  }
});
