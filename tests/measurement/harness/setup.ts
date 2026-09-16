/** Shared wiring: fake environment + inert tag + a fresh runtime instance. */

import { SAFE_ORIGIN, SAFE_REFERRER, SAFE_TITLE } from "../../../src/lib/measurement/policy.ts";
import { createMeasurementRuntime } from "../../../src/lib/measurement/runtime.ts";
import type { MeasurementRuntime } from "../../../src/lib/measurement/runtime.ts";
import { installFakeEnvironment } from "./fakeEnvironment.ts";
import type { FakeEnvironment } from "./fakeEnvironment.ts";
import { installFakeTag } from "./fakeTag.ts";
import type { FakeTag } from "./fakeTag.ts";

export const FIXTURE_MEASUREMENT_ID = "G-FIXTURE0000";

export const FIXTURE_ENV = {
  MODE: "measurement-fixture",
  VITE_MEASUREMENT_FIXTURE: "local-inert-fixture",
  VITE_GA4_MEASUREMENT_ID: FIXTURE_MEASUREMENT_ID,
};

export type Harness = {
  env: FakeEnvironment;
  tag: FakeTag;
  runtime: MeasurementRuntime;
  disableFlag: () => unknown;
  teardown: () => void;
};

export function setupHarness(
  options: {
    pathname?: string;
    search?: string;
    hostname?: string;
    startTime?: number;
    navigationType?: "navigate" | "reload" | "back_forward" | "prerender";
    autoLoad?: boolean;
    env?: Record<string, string>;
    init?: boolean;
    /** Installs fake `setTimeout`/`clearTimeout` driven by `env.advance()`. */
    fakeTimers?: boolean;
  } = {},
): Harness {
  const env = installFakeEnvironment({
    pathname: options.pathname,
    search: options.search,
    hostname: options.hostname,
    startTime: options.startTime,
    fakeTimers: options.fakeTimers,
  });
  if (options.navigationType) env.setNavigationType(options.navigationType);
  (globalThis as Record<string, unknown>).__FEMME_MEASUREMENT_ENV__ = {
    ...FIXTURE_ENV,
    ...(options.env ?? {}),
  };
  const tag = installFakeTag({ autoLoad: options.autoLoad });
  const runtime = createMeasurementRuntime();
  if (options.init !== false) runtime.init();
  return {
    env,
    tag,
    runtime,
    disableFlag: () => (globalThis as Record<string, unknown>)["ga-disable-" + FIXTURE_MEASUREMENT_ID],
    teardown: () => {
      runtime.destroy();
      tag.uninstall();
      env.restore();
    },
  };
}

/** Reads the raw stored consent record without going through the module. */
export function storedConsent(harness: Harness): unknown {
  const raw = harness.env.local.raw.get("femme.analytics.consent.v1");
  return raw === undefined ? null : JSON.parse(raw);
}

export function storedSource(harness: Harness): unknown {
  const raw = harness.env.session.raw.get("femme.analytics.source.v1");
  return raw === undefined ? null : JSON.parse(raw);
}

export function storedLedger(harness: Harness): unknown {
  const raw = harness.env.session.raw.get("femme.analytics.arrival.v1");
  return raw === undefined ? null : JSON.parse(raw);
}

/**
 * The controlled page context every payload carries: canonical origin plus a
 * static route label, a static title and an empty analytics referrer.
 */
export function safeContext(routeLabel: string): Record<string, string> {
  return {
    page_location: SAFE_ORIGIN + routeLabel,
    page_title: SAFE_TITLE,
    page_referrer: SAFE_REFERRER,
  };
}

/** Every payload the modelled tag actually emitted, in order. */
export function collectedNames(harness: Harness): string[] {
  return harness.tag.collected.map((entry) => entry.name);
}
