/**
 * The production gate, in a real browser.
 *
 * What this project actually runs: the repository's Vite **dev server** with
 * `--mode production` and an ambient `VITE_GA4_MEASUREMENT_ID` in the
 * environment. It is not a compiled artifact - `production-artifact.spec.ts`
 * covers that - and it is not the live Vercel project, whose environment
 * variables this build has never read. The claim it supports is narrow and
 * exact: with a syntactically valid measurement id present in the environment
 * and no fixture opt-in, nothing loads, stores, collects, or even offers a
 * consent choice.
 */

import { GBP_QUERY, expect, tagState, test } from "./fixtures/measurement.ts";

test("an ambient measurement id activates nothing in production mode", async ({
  page,
  googleRequests,
}) => {
  await page.goto(`/?${GBP_QUERY}`);
  await expect(page.locator("#firstName")).toBeVisible();

  await expect(page.getByTestId("consent-panel")).toHaveCount(0);
  await expect(page.getByTestId("footer-analytics-preferences")).toHaveCount(0);

  const state = await tagState(page);
  expect(state.loadRequests).toHaveLength(0);
  expect(state.collected).toHaveLength(0);
  expect(googleRequests).toHaveLength(0);

  const storage = await page.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
    dataLayer: (window as { dataLayer?: unknown[] }).dataLayer ?? null,
  }));
  expect(storage.local.filter((key) => key.startsWith("femme.analytics"))).toHaveLength(0);
  expect(storage.session.filter((key) => key.startsWith("femme.analytics"))).toHaveLength(0);
  expect(storage.dataLayer).toBeNull();

  const cookies = await page.context().cookies();
  expect(cookies.filter((cookie) => cookie.name.startsWith("_ga"))).toHaveLength(0);
});

test("package selection and the inquiry form work with measurement disabled", async ({ page }) => {
  await page.goto("/?service=in-your-corner#inquiry-form");
  await expect(page.locator("#interestedService")).toHaveValue("In Your Corner");
  await page.fill("#firstName", "Production");
  await expect(page.locator("#firstName")).toHaveValue("Production");
});
