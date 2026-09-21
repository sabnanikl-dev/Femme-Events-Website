/**
 * Consent UI acceptance: composition, keyboard behaviour, control geometry and
 * exact-head screenshots at 1440, 390 and 320.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { MEASUREMENT_ID, chooseConsent, contactAttempts, expect, tagState, test } from "./fixtures/measurement.ts";

const MIN_TARGET = 44;

// Resolved from this file, so the committed spec carries no machine-specific
// absolute path and does not depend on the working directory.
const SHOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../test-results/measurement-screenshots",
);

function shotName(project: string, name: string): string {
  return path.join(SHOT_DIR, `${project}-${name}.png`);
}

/** Every control that must stay usable, whatever the notice is showing. */
const CONTROL_IDS = ["consent-allow", "consent-deny", "consent-details-toggle"] as const;

/**
 * Waits until a reveal animation has actually finished: fully opaque and back
 * at its resting offset. Screenshots taken before this show a half-faded,
 * displaced element and are not usable as visual evidence.
 */
async function expectMotionSettled(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((target) => {
    const element = document.querySelector(target);
    if (!element) return false;
    const style = getComputedStyle(element);
    if (Number(style.opacity) < 0.999) return false;
    if (style.transform === "none" || style.transform === "") return true;
    const matrix = new DOMMatrixReadOnly(style.transform);
    return Math.abs(matrix.m41) < 0.5 && Math.abs(matrix.m42) < 0.5;
  }, selector);
}

/** Fails if any part of the element sits outside the visible viewport. */
async function expectWithinViewport(page: Page, testId: string): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  const viewport = page.viewportSize();
  expect(box, `${testId} has no box`).not.toBeNull();
  expect(box!.y, `${testId} is above the viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.x, `${testId} is left of the viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${testId} is below the viewport`).toBeLessThanOrEqual(
    (viewport?.height ?? 0) + 1,
  );
  expect(box!.x + box!.width, `${testId} is right of the viewport`).toBeLessThanOrEqual(
    (viewport?.width ?? 0) + 1,
  );
}

test("default, details, reopened and storage-error states render and are captured", async ({
  page,
}, testInfo) => {
  const project = testInfo.project.name;
  const viewport = page.viewportSize();
  await page.goto("/");

  const panel = page.getByTestId("consent-panel");
  await expect(panel).toBeVisible();
  await page.screenshot({ path: shotName(project, "01-first-visit"), fullPage: false });

  // The normal notice is compact: it never scrolls inside itself.
  const compactOverflow = await panel.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(compactOverflow).toBeLessThanOrEqual(1);

  await page.getByTestId("consent-details-toggle").click();
  await expect(page.getByTestId("consent-details")).toBeVisible();
  await expect(page.getByTestId("consent-details")).toHaveAttribute(
    "data-disclosure-state",
    "draft-pending-owner-review",
  );
  await page.screenshot({ path: shotName(project, "02-privacy-details") });

  // With the disclosure expanded, the panel must stay inside the viewport
  // instead of growing off the top of a short screen, every action target keeps
  // its 44px minimum, and the page gains no horizontal scroll.
  const panelBox = await panel.boundingBox();
  expect(panelBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual(
    (viewport?.height ?? 0) + 1,
  );
  expect(panelBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(panelBox?.width ?? 0).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);

  for (const testId of CONTROL_IDS) {
    await expectWithinViewport(page, testId);
    const box = await page.getByTestId(testId).boundingBox();
    expect(box?.height ?? 0, `${testId} is under 44px`).toBeGreaterThanOrEqual(MIN_TARGET);
  }
  const dismiss = page.getByRole("button", { name: /Dismiss the analytics notice/i });
  const dismissBox = await dismiss.boundingBox();
  expect(dismissBox?.height ?? 0).toBeGreaterThanOrEqual(MIN_TARGET);
  expect(dismissBox?.width ?? 0).toBeGreaterThanOrEqual(MIN_TARGET);
  expect(dismissBox?.y ?? -1).toBeGreaterThanOrEqual(0);

  // Collapsing and re-expanding the disclosure must not strand the controls.
  await page.getByTestId("consent-details-toggle").click();
  await expect(page.getByTestId("consent-details")).toHaveCount(0);
  await page.getByTestId("consent-details-toggle").click();
  await expect(page.getByTestId("consent-details")).toBeVisible();

  // The real proof that nothing is clipped: the controls actually take a click
  // with the disclosure open. No forced clicks anywhere in this file.
  await page.getByTestId("consent-allow").click();
  await expect(page.getByTestId("consent-status")).toContainText("Analytics is on");
  await page.screenshot({ path: shotName(project, "03-saved") });

  await page.getByTestId("consent-close").click();
  await page.getByTestId("footer-analytics-preferences").click();
  await expect(panel).toHaveAttribute("data-consent-view", "preferences");
  await expectWithinViewport(page, "consent-allow");
  await page.screenshot({ path: shotName(project, "04-reopened-preferences") });

  // Storage error on a *grant*: the panel stays open, says so, and stays off.
  await page.evaluate(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("storage blocked");
        },
        removeItem: () => {
          throw new Error("storage blocked");
        },
      },
    });
  });
  await page.getByTestId("consent-allow").click();
  await expect(page.getByTestId("consent-status")).toContainText("could not save");
  await expect(panel).toBeVisible();
  await expectWithinViewport(page, "consent-allow");
  await page.screenshot({ path: shotName(project, "05-storage-error") });
});

test("a withdrawal that cannot be saved still stops collection in this tab", async ({ page }) => {
  await page.goto("/");
  await chooseConsent(page, "allow");
  const granted = await tagState(page);
  expect(granted.collected.filter((entry) => entry.name === "page_view")).toHaveLength(1);

  await page.getByTestId("footer-analytics-preferences").click();

  // Writes start failing while reads still report the stored grant - the case
  // where "the save failed, so nothing happened" would leave analytics running.
  await page.evaluate(() => {
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) snapshot[key] = window.localStorage.getItem(key) ?? "";
    }
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        get length() {
          return Object.keys(snapshot).length;
        },
        key: (index: number) => Object.keys(snapshot)[index] ?? null,
        getItem: (key: string) => snapshot[key] ?? null,
        setItem: () => {
          throw new Error("storage blocked");
        },
        removeItem: () => {
          throw new Error("storage blocked");
        },
        clear: () => {
          throw new Error("storage blocked");
        },
      },
    });
  });

  await page.getByTestId("consent-deny").click();
  // Honest wording: off here, not saved, other tabs not updated.
  await expect(page.getByTestId("consent-status")).toContainText("switched off in this tab");
  await expect(page.getByTestId("consent-status")).toContainText("could not save");

  // The documented opt-out is set, and nothing further is collected.
  const flag = await page.evaluate(
    (id) => (window as unknown as Record<string, unknown>)[`ga-disable-${id}`],
    MEASUREMENT_ID,
  );
  expect(flag).toBe(true);

  // Close the still-open panel first - dismissing is not a decision, and it
  // keeps the fixed bottom panel from covering the footer link.
  await page.getByRole("button", { name: /Dismiss the analytics notice/i }).click();
  await page.getByRole("link", { name: "(678) 644-5257" }).click();
  expect(await contactAttempts(page)).toContain("tel:6786445257");
  await page.evaluate(() => {
    (window as unknown as { __FEMME_FIXTURE_LIFECYCLE_TICK__: () => void }).__FEMME_FIXTURE_LIFECYCLE_TICK__();
  });

  const after = await tagState(page);
  expect(after.collected.filter((entry) => entry.name === "phone_click")).toHaveLength(0);
  expect(after.collected.filter((entry) => entry.name === "user_engagement")).toHaveLength(0);
  expect(after.suppressed.length).toBeGreaterThan(0);

  // The inquiry form is untouched by any of this.
  await page.fill("#firstName", "Still Here");
  await expect(page.locator("#firstName")).toHaveValue("Still Here");
});

test("a grant that cannot be saved stays off, and says so", async ({ page }) => {
  await page.goto("/");
  await chooseConsent(page, "allow");
  const granted = await tagState(page);
  expect(granted.collected.filter((entry) => entry.name === "page_view")).toHaveLength(1);

  await page.getByTestId("footer-analytics-preferences").click();

  // Writes fail while reads keep returning the earlier, still valid "granted"
  // record. That is the dangerous shape: every later consent re-check would
  // find a perfectly good grant to restore.
  await page.evaluate(() => {
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) snapshot[key] = window.localStorage.getItem(key) ?? "";
    }
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        get length() {
          return Object.keys(snapshot).length;
        },
        key: (index: number) => Object.keys(snapshot)[index] ?? null,
        getItem: (key: string) => snapshot[key] ?? null,
        setItem: () => {
          throw new Error("storage blocked");
        },
        removeItem: () => {
          throw new Error("storage blocked");
        },
        clear: () => {
          throw new Error("storage blocked");
        },
      },
    });
  });

  await page.getByTestId("consent-allow").click();
  // The panel stays open and makes the claim: nothing was saved, analytics is off.
  await expect(page.getByTestId("consent-status")).toContainText("could not save");
  await expect(page.getByTestId("consent-status")).toContainText("analytics stays off");
  await expect(page.getByTestId("consent-panel")).toBeVisible();

  const flag = await page.evaluate(
    (id) => (window as unknown as Record<string, unknown>)[`ga-disable-${id}`],
    MEASUREMENT_ID,
  );
  expect(flag).toBe(true);

  // And the claim has to survive the checkpoints that re-read the preference:
  // a dismiss, a focus round-trip, a footer interaction and a route change.
  const before = (await tagState(page)).collected.length;
  await page.getByRole("button", { name: /Dismiss the analytics notice/i }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("link", { name: "(678) 644-5257" }).click();
  expect(await contactAttempts(page)).toContain("tel:6786445257");
  await page.evaluate(() => {
    (window as unknown as { __FEMME_FIXTURE_LIFECYCLE_TICK__: () => void }).__FEMME_FIXTURE_LIFECYCLE_TICK__();
  });

  const after = await tagState(page);
  expect(after.collected.length).toBe(before);
  expect(after.collected.filter((entry) => entry.name === "phone_click")).toHaveLength(0);
  expect(after.suppressed.length).toBeGreaterThan(0);

  // The inquiry is untouched throughout.
  await page.fill("#firstName", "Still Here");
  await expect(page.locator("#firstName")).toHaveValue("Still Here");
});

test("the notice is keyboard reachable and returns focus, and the form stays usable", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Dismiss the analytics notice/i }).click();

  const trigger = page.getByTestId("footer-analytics-preferences");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("consent-panel")).toBeFocused();

  // Tab moves through the panel's own controls; focus is not trapped.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /Dismiss the analytics notice/i })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  // The underlying inquiry form is still fully usable afterwards.
  await page.fill("#firstName", "Keyboard");
  await expect(page.locator("#firstName")).toHaveValue("Keyboard");
  await page.screenshot({
    path: shotName(testInfo.project.name, "06-inquiry-usable"),
    fullPage: false,
  });
});

test("package selection and the inquiry form are captured with the notice open", async ({
  page,
}, testInfo) => {
  await page.goto("/?service=the-full-femme#inquiry-form");
  await expect(page.locator("#interestedService")).toHaveValue("The Full Femme");
  await expect(page.getByTestId("consent-panel")).toBeVisible();

  // The form reveals itself with a `whileInView` transition, and the fragment
  // scroll races it. A screenshot taken straight after `goto` therefore caught
  // the form mid-fade and, at some widths, not even in frame - which is what
  // made the earlier committed capture unusable as evidence. Scroll to the
  // real form first, then wait for the reveal to settle.
  //
  // `#inquiry-form` is the heading block, and the form is its next sibling
  // rather than a descendant (see `src/components/Inquiry.tsx`), so a
  // descendant selector matches nothing and waits until the test times out.
  const FORM = "#inquiry-form + form";
  const form = page.locator(FORM);
  await expect(form).toBeVisible();
  await form.scrollIntoViewIfNeeded();
  await expect(form).toBeInViewport();
  await expectMotionSettled(page, FORM);

  await page.screenshot({
    path: shotName(testInfo.project.name, "07-package-and-notice"),
    fullPage: false,
  });
});
