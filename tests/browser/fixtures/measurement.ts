/**
 * Browser fixture wiring.
 *
 * Every route is installed on the context *before* any navigation:
 *   - same-origin loopback requests are served by the local fixture dev server;
 *   - Google tag and collection endpoints are fulfilled with an inert local
 *     body and recorded, so a request that should never happen is visible
 *     rather than silently succeeding;
 *   - the fixture Formspree endpoint is fulfilled locally;
 *   - every other remote request fails closed.
 */

import { test as base, expect, type Page, type Route } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const INERT_TAG_SCRIPT = path.join(here, "inert-tag.js");

export const MEASUREMENT_ID = "G-FIXTURE0000";
export const GBP_QUERY = "utm_source=google&utm_medium=organic&utm_campaign=gbp";

/** The controlled context every payload carries, for the home route label. */
export const SAFE_CONTEXT = {
  page_location: "https://femmeevents.com/",
  page_title: "Femme Events",
  page_referrer: "",
} as const;

export type FormspreeCall = { url: string; body: Record<string, string> };

export type MeasurementFixtures = {
  /** Requests that reached a Google host. Must stay empty in every test. */
  googleRequests: string[];
  /** Remote requests that were refused outright. */
  blockedRequests: string[];
  formspreeCalls: FormspreeCall[];
  formspreeStatus: { value: number };
  formspreeDelayMs: { value: number };
};

const LOCAL_HOSTS = ["127.0.0.1", "localhost", "[::1]"];

function isLocal(url: string): boolean {
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isGoogle(url: string): boolean {
  return /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|\.google\.com/i.test(url);
}

export const test = base.extend<MeasurementFixtures>({
  googleRequests: async ({}, use) => {
    await use([]);
  },
  blockedRequests: async ({}, use) => {
    await use([]);
  },
  formspreeCalls: async ({}, use) => {
    await use([]);
  },
  formspreeStatus: async ({}, use) => {
    await use({ value: 200 });
  },
  formspreeDelayMs: async ({}, use) => {
    await use({ value: 0 });
  },
  context: async (
    { context, googleRequests, blockedRequests, formspreeCalls, formspreeStatus, formspreeDelayMs },
    use,
  ) => {
    await context.addInitScript({ path: INERT_TAG_SCRIPT });
    await context.route("**/*", async (route: Route) => {
      const url = route.request().url();
      if (isLocal(url) || url.startsWith("data:") || url.startsWith("blob:")) {
        await route.continue();
        return;
      }
      if (isGoogle(url)) {
        // Recorded, and answered with an inert local body so nothing loads.
        googleRequests.push(url);
        await route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "/* inert fixture stand-in: the real tag is never loaded */",
        });
        return;
      }
      if (url.includes("formspree.invalid")) {
        const body = route.request().postDataJSON() as Record<string, string>;
        formspreeCalls.push({ url, body });
        if (formspreeDelayMs.value > 0) {
          await new Promise((resolve) => setTimeout(resolve, formspreeDelayMs.value));
        }
        await route.fulfill({
          status: formspreeStatus.value,
          contentType: "application/json",
          body: JSON.stringify({ ok: formspreeStatus.value < 400 }),
        });
        return;
      }
      // Unknown remote endpoint: fail closed.
      blockedRequests.push(url);
      await route.abort("blockedbyclient");
    });
    await use(context);
  },
});

export { expect };

/** A modelled collection attempt. `effective` adds inherited config parameters. */
export type TagPayload = {
  name: string;
  params: Record<string, unknown>;
  effective: Record<string, unknown>;
};

export type TagState = {
  loadRequests: { src: string; generation: number }[];
  collected: TagPayload[];
  suppressed: TagPayload[];
  consentStates: Record<string, string>[];
  configs: { id: string; params: Record<string, unknown> }[];
  configState: Record<string, unknown>;
  loaded: boolean;
};

export async function tagState(page: Page): Promise<TagState> {
  return page.evaluate(() => {
    const state = (window as unknown as { __FEMME_MEASUREMENT_FIXTURE_STATE__?: TagState })
      .__FEMME_MEASUREMENT_FIXTURE_STATE__;
    return (
      state ?? {
        loadRequests: [],
        collected: [],
        suppressed: [],
        consentStates: [],
        configs: [],
        configState: {},
        loaded: false,
      }
    );
  }) as Promise<TagState>;
}

export async function collectedNames(page: Page): Promise<string[]> {
  return (await tagState(page)).collected.map((entry) => entry.name);
}

export async function contactAttempts(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __FEMME_FIXTURE_CONTACT_ATTEMPTS__?: string[] }).__FEMME_FIXTURE_CONTACT_ATTEMPTS__ ?? [],
  );
}

/**
 * Makes a choice and closes the saved confirmation, so the fixed bottom panel
 * cannot intercept a later click. Closing the confirmation is not a decision.
 */
export async function chooseConsent(page: Page, choice: "allow" | "deny"): Promise<void> {
  await page.getByTestId(choice === "allow" ? "consent-allow" : "consent-deny").click();
  const close = page.getByTestId("consent-close");
  if (await close.isVisible()) await close.click();
  await expect(page.getByTestId("consent-panel")).toHaveCount(0);
}

export async function fillInquiry(page: Page): Promise<void> {
  await page.fill("#firstName", "Fixture");
  await page.fill("#lastName", "Visitor");
  await page.fill("#email", "fixture.visitor@example.invalid");
  await page.fill("#phone", "555-0100");
  await page.fill("#message", "Synthetic fixture inquiry. Please ignore.");
}
