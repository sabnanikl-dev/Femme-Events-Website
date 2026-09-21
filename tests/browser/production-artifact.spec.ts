/**
 * The production gate against a real compiled artifact.
 *
 * This project serves the output of an actual `vite build --mode production`
 * carrying an ambient `VITE_GA4_MEASUREMENT_ID`, through `vite preview`. The id
 * genuinely is baked into the bundle, so this is the strongest local evidence
 * available that the activation gate survives bundling, minification and
 * dead-code elimination rather than only holding in the dev pipeline.
 *
 * Still not covered, and not claimed: the live Vercel environment, its build
 * settings, and anything about real Google tag behaviour. Those remain website
 * #83 activation gates. This is a build artifact served locally; it is not a
 * deployment and nothing here is published anywhere.
 */

import { GBP_QUERY, expect, tagState, test } from "./fixtures/measurement.ts";

test("a compiled production bundle with an ambient measurement id stays inert", async ({
  page,
  googleRequests,
  blockedRequests,
}) => {
  await page.goto(`/?${GBP_QUERY}&service=the-full-femme`);
  await expect(page.locator("#firstName")).toBeVisible();

  // No consent surface at all: the build is not eligible to measure.
  await expect(page.getByTestId("consent-panel")).toHaveCount(0);
  await expect(page.getByTestId("footer-analytics-preferences")).toHaveCount(0);

  const state = await tagState(page);
  expect(state.loadRequests).toHaveLength(0);
  expect(state.collected).toHaveLength(0);
  expect(state.configs).toHaveLength(0);
  expect(googleRequests).toHaveLength(0);

  const storage = await page.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
    dataLayer: (window as { dataLayer?: unknown[] }).dataLayer ?? null,
    disableFlags: Object.keys(window).filter((key) => key.startsWith("ga-disable-")),
  }));
  expect(storage.local.filter((key) => key.startsWith("femme.analytics"))).toHaveLength(0);
  expect(storage.session.filter((key) => key.startsWith("femme.analytics"))).toHaveLength(0);
  expect(storage.dataLayer).toBeNull();
  expect(storage.disableFlags).toHaveLength(0);

  const cookies = await page.context().cookies();
  expect(cookies.filter((cookie) => cookie.name.startsWith("_ga"))).toHaveLength(0);

  // Negative control for the interception itself: the fixtures are in force, so
  // no remote host was silently reached instead of being blocked or recorded.
  expect(blockedRequests.filter((url) => /googletagmanager|google-analytics/.test(url))).toHaveLength(0);
});

test("the site still works normally in the compiled build", async ({ page }) => {
  await page.goto("/?service=in-your-corner#inquiry-form");
  await expect(page.locator("#interestedService")).toHaveValue("In Your Corner");
  // Every inquiry field the site had before this issue is still present.
  for (const id of ["firstName", "lastName", "email", "phone", "eventDate", "guestCount", "message"]) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
  await page.fill("#firstName", "Production");
  await expect(page.locator("#firstName")).toHaveValue("Production");
});
