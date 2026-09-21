/**
 * Inquiry lifecycle in a real browser, against a locally intercepted endpoint.
 * No synthetic submission ever leaves the machine.
 */

import { SERVICE_OPTIONS } from "../../src/data/serviceOptions.ts";
import {
  GBP_QUERY,
  SAFE_CONTEXT,
  chooseConsent,
  expect,
  fillInquiry,
  tagState,
  test,
} from "./fixtures/measurement.ts";

test("each package carries its slug and the approved source through an accepted inquiry", async ({
  page,
  formspreeCalls,
}) => {
  for (const option of SERVICE_OPTIONS) {
    await page.goto(`/?${GBP_QUERY}&service=${option.slug}`);
    if (await page.getByTestId("consent-allow").isVisible()) await chooseConsent(page, "allow");

    await expect(page.locator("#interestedService")).toHaveValue(option.label);
    await fillInquiry(page);
    await page.getByRole("button", { name: "Send Inquiry" }).click();
    await expect(page.getByText("You're In!")).toBeVisible();

    const call = formspreeCalls.at(-1);
    expect(call?.body.interestedService).toBe(option.label);
    expect(call?.body.source).toBe("google");
    expect(call?.body.medium).toBe("organic");
    expect(call?.body.campaign).toBe("gbp");

    const state = await tagState(page);
    const successes = state.collected.filter((entry) => entry.name === "inquiry_submit");
    expect(successes).toHaveLength(1);
    expect(successes[0].params).toEqual({
      location: "inquiry_form",
      service: option.slug,
      source: "google",
      medium: "organic",
      campaign: "gbp",
      ...SAFE_CONTEXT,
    });
    // Nothing the visitor typed reaches the provider.
    const serialised = JSON.stringify(state.collected);
    expect(serialised).not.toContain("fixture.visitor@example.invalid");
    expect(serialised).not.toContain("555-0100");
    expect(serialised).not.toContain("Fixture");
  }
});

test("a rejected submission keeps every entry and emits no success event", async ({
  page,
  formspreeStatus,
}) => {
  await page.goto("/");
  await chooseConsent(page, "allow");
  formspreeStatus.value = 500;

  await fillInquiry(page);
  await page.selectOption("#interestedService", "In Your Corner");
  await page.getByRole("button", { name: "Send Inquiry" }).click();

  await expect(page.getByText(/Server responded with 500/)).toBeVisible();
  await expect(page.locator("#firstName")).toHaveValue("Fixture");
  await expect(page.locator("#email")).toHaveValue("fixture.visitor@example.invalid");
  await expect(page.locator("#message")).toHaveValue("Synthetic fixture inquiry. Please ignore.");
  await expect(page.locator("#interestedService")).toHaveValue("In Your Corner");
  const state = await tagState(page);
  expect(state.collected.filter((entry) => entry.name === "inquiry_submit")).toHaveLength(0);

  // Retrying after a settled failure succeeds exactly once.
  formspreeStatus.value = 200;
  await page.getByRole("button", { name: "Send Inquiry" }).click();
  await expect(page.getByText("You're In!")).toBeVisible();
  const after = await tagState(page);
  expect(after.collected.filter((entry) => entry.name === "inquiry_submit")).toHaveLength(1);
});

test("rapid double submission issues a single POST", async ({ page, formspreeCalls, formspreeDelayMs }) => {
  await page.goto("/");
  await chooseConsent(page, "allow");
  formspreeDelayMs.value = 700;
  await fillInquiry(page);

  const button = page.getByRole("button", { name: "Send Inquiry" });
  await button.click({ noWaitAfter: true });
  // The UI disables its own controls while submitting, so drive a second
  // submission straight at the form element: that is what the synchronous
  // in-flight latch exists for.
  await page.evaluate(() => {
    const form = document.querySelector("#inquiry form") as HTMLFormElement | null;
    form?.requestSubmit();
  });
  await expect(page.getByText("You're In!")).toBeVisible({ timeout: 15_000 });
  expect(formspreeCalls).toHaveLength(1);
});

test("a refused visitor can still submit an inquiry normally", async ({ page, formspreeCalls }) => {
  await page.goto(`/?${GBP_QUERY}`);
  await chooseConsent(page, "deny");
  await fillInquiry(page);
  await page.getByRole("button", { name: "Send Inquiry" }).click();
  await expect(page.getByText("You're In!")).toBeVisible();

  const call = formspreeCalls.at(-1);
  expect(call?.body.source).toBeUndefined();
  expect(call?.body.firstName).toBe("Fixture");
  const state = await tagState(page);
  expect(state.collected).toHaveLength(0);
});

test("withdrawing mid-flight keeps the inquiry and drops only the success event", async ({
  page,
  formspreeDelayMs,
}) => {
  await page.goto("/");
  await chooseConsent(page, "allow");
  formspreeDelayMs.value = 1500;
  await fillInquiry(page);
  await page.getByRole("button", { name: "Send Inquiry" }).click({ noWaitAfter: true });

  await page.getByTestId("footer-analytics-preferences").click();
  await chooseConsent(page, "deny");

  await expect(page.getByText("You're In!")).toBeVisible({ timeout: 15_000 });
  const state = await tagState(page);
  expect(state.collected.filter((entry) => entry.name === "inquiry_submit")).toHaveLength(0);
});

test("a revoked arrival is not resurrected by reloading the tagged URL", async ({ page, formspreeCalls }) => {
  await page.goto(`/?${GBP_QUERY}`);
  await chooseConsent(page, "allow");
  await page.getByTestId("footer-analytics-preferences").click();
  await chooseConsent(page, "deny");

  await page.reload();
  await page.getByTestId("footer-analytics-preferences").click();
  await chooseConsent(page, "allow");

  await fillInquiry(page);
  await page.getByRole("button", { name: "Send Inquiry" }).click();
  await expect(page.getByText("You're In!")).toBeVisible();
  expect(formspreeCalls.at(-1)?.body.source).toBeUndefined();
  const state = await tagState(page);
  const success = state.collected.find((entry) => entry.name === "inquiry_submit");
  expect(success?.params).toEqual({ location: "inquiry_form", service: "not-sure", ...SAFE_CONTEXT });
  // The reload started a fresh document, and the revoked arrival was not
  // recaptured, so no campaign was ever configured in it. The right assertion
  // is therefore absence, not an empty-string purge: there is nothing to purge
  // and nothing to inherit. (Same-document purge, where an empty string *is*
  // the correct evidence, is asserted in the focused tests.)
  expect(success?.effective.campaign_source).toBeUndefined();
  expect(success?.effective.campaign_medium).toBeUndefined();
  expect(success?.effective.campaign_name).toBeUndefined();
  expect(success?.params.source).toBeUndefined();
});
