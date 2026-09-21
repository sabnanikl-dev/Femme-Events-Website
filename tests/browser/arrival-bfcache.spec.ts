/**
 * Cross-document arrival identity through a real back/forward-cache restore
 * (issue #161, finding A-R1).
 *
 * The compiled fixture-mode app — the React inquiry form, the measurement
 * runtime and the inquiry submitter, exactly as built — is driven through:
 *
 *   1. document A: a granted GBP arrival, and an inquiry whose POST is out;
 *   2. a full same-tab forward navigation to document B, itself a GBP arrival,
 *      while A sits in the cache with its runtime and its request intact;
 *   3. Back, restoring A, where the original operation is accepted.
 *
 * The accepted operation must not pick up B's attribution, by its own fields or
 * through `config` inheritance; B's arrival must survive A settling; and the
 * endpoint must have seen the request exactly once. Every test first proves the
 * restore really happened from the `persisted` flags the documents recorded. A
 * run in which the browser did not cache the document fails — it is not
 * skipped, because without the restore none of this is evidence.
 *
 * This file brings its own loopback server, build and launch flags; it uses
 * nothing from the shared configuration's dev servers or base URL:
 *
 *   npx playwright test --config=tests/browser/playwright.config.ts arrival-bfcache
 */

import { GBP_QUERY, SAFE_CONTEXT, chooseConsent, fillInquiry, tagState } from "./fixtures/measurement.ts";
import type { TagPayload } from "./fixtures/measurement.ts";
import {
  BFCACHE_LAUNCH,
  documentRecord,
  expect,
  followLinkToNewDocument,
  goBackTo,
  notRestoredReasons,
  storedSource,
  test,
} from "./fixtures/arrival-bfcache.ts";
import type { BfcacheApp, DocumentRecord, StoredSource } from "./fixtures/arrival-bfcache.ts";
import type { Page } from "@playwright/test";

test.use(BFCACHE_LAUNCH);

const DOCUMENT_A = `/?${GBP_QUERY}`;
const TAGGED_DOCUMENT_B = `/about?${GBP_QUERY}`;
const UNTAGGED_DOCUMENT_B = "/about";

type InFlight = { token: string; source: StoredSource };

/** Document A: granted GBP arrival, inquiry submitted through the real form, POST held. */
async function submitFromDocumentA(page: Page, app: BfcacheApp): Promise<InFlight> {
  await page.goto(app.origin + DOCUMENT_A);
  await chooseConsent(page, "allow");
  const source = await storedSource(page);
  expect(source, "document A holds a granted GBP arrival").not.toBeNull();

  await fillInquiry(page);
  await page.selectOption("#interestedService", "In Your Corner");
  await page.getByRole("button", { name: "Send Inquiry" }).click({ noWaitAfter: true });
  await app.waitForExchanges(1);
  await expect(page.getByRole("button", { name: "Sending..." })).toBeDisabled();
  // The request was formed with A's attribution, so there is something to mislabel.
  expect(app.exchanges[0].body.campaign).toBe("gbp");
  expect(app.exchanges[0].respondedAt).toBeNull();

  const record = await documentRecord(page);
  expect(record).not.toBeNull();
  return { token: (record as DocumentRecord).token, source: source as StoredSource };
}

/** The restored document is the same one that left, and both lifecycle events say `persisted`. */
async function expectRestoredFromCache(page: Page, inFlight: InFlight): Promise<DocumentRecord> {
  const record = (await documentRecord(page)) as DocumentRecord;
  const why = await notRestoredReasons(page);
  expect(record.token, "the document was loaded again instead of restored: " + why).toBe(inFlight.token);
  expect(
    record.events.map((event) => [event.type, event.persisted]),
    "lifecycle events seen by document A: " + why,
  ).toEqual([
    ["pageshow", false],
    ["pagehide", true],
    ["pageshow", true],
  ]);
  // A restored document keeps the navigation type it was created with.
  expect(record.events.at(-1)?.navigationType).toBe("navigate");
  return record;
}

function successes(collected: TagPayload[]): TagPayload[] {
  return collected.filter((entry) => entry.name === "inquiry_submit");
}

async function expectAcceptedOnce(page: Page, app: BfcacheApp): Promise<TagPayload> {
  await expect(page.getByText("You're In!")).toBeVisible({ timeout: 10_000 });
  expect(app.exchanges, "the endpoint saw the inquiry exactly once").toHaveLength(1);
  expect(app.exchanges[0].respondedAt).not.toBeNull();
  const found = successes((await tagState(page)).collected);
  expect(found, "exactly one success event for the accepted operation").toHaveLength(1);
  return found[0];
}

async function arriveInTaggedDocumentB(page: Page, inFlight: InFlight): Promise<StoredSource> {
  await followLinkToNewDocument(page, TAGGED_DOCUMENT_B, inFlight.token);
  const record = (await documentRecord(page)) as DocumentRecord;
  expect(record.events.map((event) => [event.type, event.persisted, event.navigationType])).toEqual([
    ["pageshow", false, "navigate"],
  ]);

  // B is a genuine, valid arrival under the carried grant: a new record, and
  // the provider context B's own traffic inherits says GBP.
  const replacement = (await storedSource(page)) as StoredSource;
  expect(replacement).not.toBeNull();
  expect(replacement.c).toBe("gbp");
  expect(replacement.t, "a new capture, not A's record read back").toBeGreaterThan(inFlight.source.t);
  // Soft, so a collision here still goes on to show what it does to A's inquiry.
  expect
    .soft(replacement.n, "B must not reissue the ordinal A's in-flight inquiry holds")
    .not.toBe(inFlight.source.n);
  const state = await tagState(page);
  expect(state.configState.campaign_name).toBe("gbp");
  expect(successes(state.collected)).toHaveLength(0);
  return replacement;
}

async function expectReplacementUntouched(
  page: Page,
  replacement: StoredSource,
  success: TagPayload,
): Promise<void> {
  // The old operation neither claims the replacement attribution...
  expect(success.params).toEqual({
    location: "inquiry_form",
    service: "in-your-corner",
    campaign_source: "",
    campaign_medium: "",
    campaign_name: "",
    ...SAFE_CONTEXT,
  });
  // ...nor inherits it from the campaign this document's `config` still holds.
  expect((await tagState(page)).configState.campaign_name).toBe("gbp");
  expect(success.effective.campaign_source).toBe("");
  expect(success.effective.campaign_medium).toBe("");
  expect(success.effective.campaign_name).toBe("");
  expect(success.effective.source).toBeUndefined();
  expect(success.effective.campaign).toBeUndefined();

  // And B's arrival is still the tab's attribution, the instance B captured.
  const after = (await storedSource(page)) as StoredSource;
  expect(after).not.toBeNull();
  expect({ n: after.n, t: after.t, g: after.g, c: after.c }).toEqual({
    n: replacement.n,
    t: replacement.t,
    g: replacement.g,
    c: "gbp",
  });
}

test("Back before the response: the restored inquiry does not take the forward document's arrival", async ({
  page,
  bfcacheApp,
  remoteRequestsFinished,
}) => {
  const inFlight = await submitFromDocumentA(page, bfcacheApp);
  const replacement = await arriveInTaggedDocumentB(page, inFlight);

  await goBackTo(page, DOCUMENT_A);
  const restored = await expectRestoredFromCache(page, inFlight);
  // Still out: the restored form is mid-submission and nothing has been emitted.
  expect(bfcacheApp.exchanges[0].respondedAt).toBeNull();
  await expect(page.getByRole("button", { name: "Sending..." })).toBeDisabled();
  expect(successes((await tagState(page)).collected)).toHaveLength(0);

  await bfcacheApp.releaseHeld();
  const success = await expectAcceptedOnce(page, bfcacheApp);
  expect(bfcacheApp.exchanges[0].respondedAt as number).toBeGreaterThan(restored.events.at(-1)?.at as number);
  await expectReplacementUntouched(page, replacement, success);
  expect(remoteRequestsFinished).toEqual([]);
});

test("Response while away: the inquiry accepted during the forward document stays unattributed to it", async ({
  page,
  bfcacheApp,
  remoteRequestsFinished,
}) => {
  const inFlight = await submitFromDocumentA(page, bfcacheApp);
  const replacement = await arriveInTaggedDocumentB(page, inFlight);

  // The endpoint accepts while A is cached; B sees nothing of it.
  await bfcacheApp.releaseHeld();
  await page.waitForTimeout(500);
  expect(successes((await tagState(page)).collected)).toHaveLength(0);

  await goBackTo(page, DOCUMENT_A);
  const restored = await expectRestoredFromCache(page, inFlight);
  const success = await expectAcceptedOnce(page, bfcacheApp);
  expect(bfcacheApp.exchanges[0].respondedAt as number).toBeLessThan(restored.events.at(-1)?.at as number);
  await expectReplacementUntouched(page, replacement, success);
  expect(remoteRequestsFinished).toEqual([]);
});

test("Same arrival: an untagged forward document and Back keep the inquiry's own attribution", async ({
  page,
  bfcacheApp,
  remoteRequestsFinished,
}) => {
  const inFlight = await submitFromDocumentA(page, bfcacheApp);
  await followLinkToNewDocument(page, UNTAGGED_DOCUMENT_B, inFlight.token);
  // B reads A's record under the carried grant; it is not a new arrival.
  const carried = (await storedSource(page)) as StoredSource;
  expect({ n: carried.n, t: carried.t }).toEqual({ n: inFlight.source.n, t: inFlight.source.t });

  await goBackTo(page, DOCUMENT_A);
  await expectRestoredFromCache(page, inFlight);
  await bfcacheApp.releaseHeld();
  const success = await expectAcceptedOnce(page, bfcacheApp);
  expect(success.params).toEqual({
    location: "inquiry_form",
    service: "in-your-corner",
    source: "google",
    medium: "organic",
    campaign: "gbp",
    ...SAFE_CONTEXT,
  });
  expect(success.effective.campaign_name).toBe("gbp");
  expect(remoteRequestsFinished).toEqual([]);
});
