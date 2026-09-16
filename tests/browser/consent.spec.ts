/**
 * Consent lifecycle in a real browser, against the inert local tag.
 */

import {
  GBP_QUERY,
  chooseConsent,
  collectedNames,
  contactAttempts,
  expect,
  tagState,
  test,
} from "./fixtures/measurement.ts";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("first visit shows a non-modal notice and collects nothing", async ({ page, googleRequests }) => {
  const panel = page.getByTestId("consent-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("role", "dialog");
  expect(await panel.getAttribute("aria-modal")).toBeNull();

  // Focus is not stolen, and the page underneath stays usable.
  await expect(page.locator("#firstName")).toBeVisible();
  await page.fill("#firstName", "Still usable");
  await expect(page.locator("#firstName")).toHaveValue("Still usable");

  const state = await tagState(page);
  expect(state.loadRequests).toHaveLength(0);
  expect(state.collected).toHaveLength(0);
  expect(googleRequests).toHaveLength(0);
  const cookies = await page.context().cookies();
  expect(cookies.filter((cookie) => cookie.name.startsWith("_ga"))).toHaveLength(0);
});

test("dismiss and Escape close the notice without granting", async ({ page }) => {
  await page.getByRole("button", { name: /Dismiss the analytics notice/i }).click();
  await expect(page.getByTestId("consent-panel")).toHaveCount(0);
  expect(await collectedNames(page)).toHaveLength(0);

  // Reopened from the footer, Escape also closes without granting.
  await page.getByTestId("footer-analytics-preferences").click();
  await expect(page.getByTestId("consent-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("consent-panel")).toHaveCount(0);
  expect(await collectedNames(page)).toHaveLength(0);
  // Focus returns to the control that opened it.
  await expect(page.getByTestId("footer-analytics-preferences")).toBeFocused();
});

test("refusal leaves the site fully usable and pings nothing", async ({ page, googleRequests }) => {
  await page.getByTestId("consent-deny").click();
  await expect(page.getByTestId("consent-status")).toContainText("Analytics stays off");
  await page.getByTestId("consent-close").click();

  await page.getByRole("link", { name: /Book The Full Femme/i }).click();
  await expect(page.locator("#interestedService")).toHaveValue("The Full Femme");

  const state = await tagState(page);
  expect(state.loadRequests).toHaveLength(0);
  expect(state.collected).toHaveLength(0);
  expect(state.suppressed).toHaveLength(0);
  expect(googleRequests).toHaveLength(0);
});

test("grant counts the current page once and never replays earlier clicks", async ({ page }) => {
  await page.getByRole("link", { name: /Let's Chat/i }).first().click();
  await chooseConsent(page, "allow");

  const state = await tagState(page);
  expect(state.loadRequests).toHaveLength(1);
  expect(state.collected.map((entry) => entry.name)).toEqual(["page_view"]);
  expect(state.collected[0].params.page_location).toBe("https://femmeevents.com/");
  expect(state.collected[0].params.page_title).toBe("Femme Events");
  expect(state.collected[0].params.page_referrer).toBe("");
});

test("withdrawal stops collection without reloading or losing the form", async ({ page }) => {
  await chooseConsent(page, "allow");
  await page.fill("#firstName", "Half");
  await page.fill("#lastName", "Filled");
  await page.fill("#message", "A message the visitor is still writing.");
  await page.selectOption("#interestedService", "Getting It Together");

  await page.getByTestId("footer-analytics-preferences").click();
  await chooseConsent(page, "deny");

  // Every entry survives: withdrawal is in-place, never a reload.
  await expect(page.locator("#firstName")).toHaveValue("Half");
  await expect(page.locator("#lastName")).toHaveValue("Filled");
  await expect(page.locator("#message")).toHaveValue("A message the visitor is still writing.");
  await expect(page.locator("#interestedService")).toHaveValue("Getting It Together");

  const disabled = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)["ga-disable-G-FIXTURE0000"],
  );
  expect(disabled).toBe(true);

  const before = (await tagState(page)).collected.length;
  await page.evaluate(() => (window as unknown as { __FEMME_FIXTURE_LIFECYCLE_TICK__: () => void }).__FEMME_FIXTURE_LIFECYCLE_TICK__());
  await page.getByRole("link", { name: /Let's Chat/i }).first().click();
  const after = await tagState(page);
  expect(after.collected).toHaveLength(before);
  expect(after.suppressed.map((entry) => entry.name)).toContain("user_engagement");

  const cookies = await page.context().cookies();
  expect(cookies.filter((cookie) => cookie.name.startsWith("_ga"))).toHaveLength(0);
});

test("a withdrawal in another tab tears this one down without a reload", async ({ page, context }) => {
  await chooseConsent(page, "allow");
  await page.fill("#firstName", "Peer");
  await page.fill("#message", "Still typing in the first tab.");

  const peer = await context.newPage();
  await peer.goto("/");
  await peer.getByTestId("footer-analytics-preferences").click();
  await chooseConsent(peer, "deny");

  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as Record<string, unknown>)["ga-disable-G-FIXTURE0000"]),
    )
    .toBe(true);
  // The first tab never reloaded, so the half-written inquiry is intact.
  await expect(page.locator("#firstName")).toHaveValue("Peer");
  await expect(page.locator("#message")).toHaveValue("Still typing in the first tab.");
  await peer.close();
});

test("footer contact links stay navigable but are never collected or dialled", async ({ page }) => {
  await chooseConsent(page, "deny");
  await page.getByRole("link", { name: "amanda@femmeevents.com" }).click();
  await page.getByRole("link", { name: "(678) 644-5257" }).click();
  expect(await contactAttempts(page)).toEqual([
    "mailto:amanda@femmeevents.com",
    "tel:6786445257",
  ]);
  expect(await collectedNames(page)).toHaveLength(0);
});

test("secondary hooks navigate without collecting", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 768, "the desktop navbar link is hidden on narrow viewports");
  await chooseConsent(page, "allow");
  const before = await collectedNames(page);
  await page.getByRole("link", { name: "Inquiry" }).first().click();
  const after = await collectedNames(page);
  expect(after).toEqual(before);
});

test("an arrival on the tagged URL only attributes after a grant", async ({ page }) => {
  await page.goto(`/?${GBP_QUERY}`);
  const sessionBefore = await page.evaluate(() => window.sessionStorage.getItem("femme.analytics.source.v1"));
  expect(sessionBefore).toBeNull();

  await chooseConsent(page, "allow");
  const stored = await page.evaluate(() => window.sessionStorage.getItem("femme.analytics.source.v1"));
  expect(stored).toContain("google");
  const state = await tagState(page);
  expect(state.configs[0].params.campaign_source).toBe("google");
  expect(state.configs[0].params.campaign_medium).toBe("organic");
  expect(state.configs[0].params.campaign_name).toBe("gbp");
});
