/**
 * Measurement runtime - the single place that decides whether anything is
 * loaded, counted or sent.
 *
 * Fail-closed by construction: with no approved mode, no grant, an expired or
 * unreadable preference, or a rejected payload, every entry point below is a
 * silent no-op. Nothing is queued for later replay, so a grant never resurrects
 * pre-consent activity.
 *
 * Consent validity is re-checked continuously, not just at init: before every
 * emission, on every navigation, at document lifecycle boundaries (resumed,
 * hidden, frozen, pagehide) and on a timer armed for the expiry instant -
 * chained across several hops when the remaining time exceeds what a single
 * `setTimeout` can represent, which a six-month preference always does. A timer
 * alone would not be enough for a throttled or restored document, and a cached
 * in-memory decision would let an expired or unreadable preference keep
 * collecting in a document that just stays open and idle. Every path converges
 * on the same fail-closed teardown.
 */

import { readConsent, subscribeToOtherDocuments, writeConsent } from "./consentStore.ts";
import type { ConsentStatus } from "./consentStore.ts";
import { resolveMeasurementConfig } from "./env.ts";
import type { MeasurementConfig } from "./env.ts";
import { createGa4Adapter } from "./ga4Adapter.ts";
import type { Ga4Adapter } from "./ga4Adapter.ts";
import { SOURCE_IDLE_TTL_MS } from "./policy.ts";
import { routeLabelFor } from "./routes.ts";
import { validateEvent } from "./schema.ts";
import type { EventParams } from "./schema.ts";
import { classifySearch } from "./sourceInput.ts";
import {
  APPROVED_TUPLE,
  clearStoredSource,
  createArrivalLedger,
  documentNavigationType,
  isCandidateAlive,
  readStoredSource,
  writeStoredSource,
} from "./sourceState.ts";
import type { SourceRecord, SourceTuple } from "./sourceState.ts";
import { resolveTagLoader } from "./transport.ts";

export type HistoryAction = "PUSH" | "REPLACE" | "POP";

/**
 * What the inquiry request was formed with. `arrival` identifies the attribution
 * instance so a source that expires or is replaced mid-request can be detected
 * rather than mislabelled. It is a tab-scoped ordinal, not a visitor identifier.
 */
export type SourceSnapshot = SourceTuple & { arrival: number };

export type MeasurementRuntime = {
  init: () => void;
  /** Releases lifecycle listeners and timers. Used by tests; the app runs for
   *  the lifetime of the document and never needs it. */
  destroy: () => void;
  isEligible: () => boolean;
  getConfig: () => MeasurementConfig;
  getStatus: () => ConsentStatus;
  subscribe: (listener: () => void) => () => void;
  grant: () => { ok: boolean };
  deny: () => { ok: boolean };
  withdraw: () => { ok: boolean };
  recordNavigation: (pathname: string, search: string, action: HistoryAction) => void;
  trackEvent: (name: string, params?: Record<string, string>) => void;
  snapshotSource: () => SourceSnapshot | null;
  trackInquirySuccess: (
    operationId: string,
    serviceSlug: string,
    snapshot: SourceSnapshot | null,
  ) => void;
};

function locationOf(): { pathname: string; search: string } {
  const loc = (globalThis as { location?: { pathname?: string; search?: string } }).location;
  return { pathname: loc?.pathname ?? "/", search: loc?.search ?? "" };
}

function navigationKey(pathname: string, search: string): string {
  return pathname + " " + search;
}

export function createMeasurementRuntime(): MeasurementRuntime {
  const now = () => Date.now();

  let config: MeasurementConfig = {
    mode: "disabled",
    measurementId: null,
    reason: "no-measurement-id",
  };
  let adapter: Ga4Adapter | null = null;
  let initialised = false;
  let status: ConsentStatus = "undecided";

  /** Volatile pre-choice source. Never written down, never transmitted. */
  let candidate: SourceRecord | null = null;

  /**
   * Arrival bookkeeping for this document, in memory. Source-derived state
   * before a choice stays volatile, so this is not written to session storage
   * and a refusal leaves nothing behind either. It is kept ahead of any stored
   * record this document reads, so a new arrival never shares an ordinal with
   * attribution that an earlier document wrote.
   */
  const ledger = createArrivalLedger();

  /**
   * Set when a clear could not be verified — session removal refused and the
   * record not even overwritable. While it is set, stored source is not read
   * or trusted in this document at all. It is cleared only by successfully
   * writing a new record over the key, or by a later verified clear.
   */
  let storedSourceDistrusted = false;

  let currentPathname: string | null = null;
  let lastCountedPathname: string | null = null;
  let lastNavigationKey: string | null = null;

  let appliedSourceArrival = 0;
  let appliedRouteLabel: string | null = null;
  const emittedSuccessOperations = new Set<string>();
  const listeners = new Set<() => void>();

  /**
   * The status this document holds when a choice made here could not be
   * written: `"denied"` for an unpersisted refusal/withdrawal, `"undecided"`
   * for an unpersisted grant (which is not a decision at all, so the notice
   * stays open). While it is set, a still-readable stale `"granted"` record
   * cannot resurrect collection in this document - on an emission, a
   * navigation, a focus event or anything else - until a *new* explicit choice
   * is successfully saved. It is deliberately not persisted: we cannot claim to
   * have updated other documents.
   */
  let unpersistedChoice: ConsentStatus | null = null;

  /** Current hop of the chained teardown timer for the consent-expiry instant. */
  let expiryTimer: unknown = null;
  /** Teardown deadline for the 30-minute source idle window. */
  let sourceTimer: unknown = null;
  let releaseLifecycle: (() => void) | null = null;

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  function activeRouteLabel(): string {
    return routeLabelFor(currentPathname ?? locationOf().pathname);
  }

  /**
   * Re-applies or purges provider campaign context when source state changes,
   * and refreshes the provider's route context when the route category does.
   *
   * The two travel in one `config` but are tracked separately: every navigation
   * reaches this through the source checks, and provider-originated traffic
   * inherits its page context from `config` alone, so an unchanged campaign
   * must not leave the previous route's category configured.
   */
  function syncCampaign(record: SourceRecord | null): void {
    const arrival = record ? record.arrival : 0;
    const routeLabel = activeRouteLabel();
    if (arrival === appliedSourceArrival && routeLabel === appliedRouteLabel) return;
    appliedSourceArrival = arrival;
    appliedRouteLabel = routeLabel;
    adapter?.setCampaign(record ? APPROVED_TUPLE : null, routeLabel);
  }

  /**
   * Which grant is in force right now, identified by its expiry instant, or
   * `null` when there is not an effective one. Read from storage rather than
   * remembered, for the same reason consent itself is: a cached answer is the
   * one thing an expired or externally cleared preference cannot correct.
   */
  function grantIdentity(): number | null {
    const consent = readConsent(now());
    return consent.status === "granted" ? consent.expiresAt : null;
  }

  /** Reads stored source, clearing expired/corrupt state and purging campaign. */
  function currentSource(): SourceRecord | null {
    const record =
      status === "granted" && !storedSourceDistrusted
        ? readStoredSource(now(), grantIdentity())
        : null;
    // This is the read that snapshots are made from. A record this document
    // did not mint still occupies its ordinal.
    if (record) ledger.advancePast(record.arrival);
    syncCampaign(record);
    return record;
  }

  /**
   * Clears stored source and records whether the clear can be stood behind.
   *
   * A removal that was refused and could not even be overwritten leaves a
   * readable record this document must never use again — not on the next
   * navigation, and not if the visitor grants again.
   */
  function invalidateStoredSource(): void {
    storedSourceDistrusted = clearStoredSource() === "failed";
  }

  /** Writes a record and, on success, re-establishes trust in the key. */
  function persistSource(record: SourceRecord): boolean {
    const written = writeStoredSource(record);
    // The key now holds a record this document just wrote, so whatever it held
    // before is gone and there is nothing left to distrust.
    if (written) storedSourceDistrusted = false;
    return written;
  }

  /**
   * Only real navigation and user actions extend the 30-minute idle window.
   *
   * Stored source is neither read nor rewritten unless consent is currently a
   * grant: refreshing a persisted marketing record for an undecided, refused or
   * lapsed visitor would keep an arrival alive that is no longer allowed to
   * exist, and would let it come back at the next grant.
   */
  function refreshActivity(): void {
    const stamp = now();
    if (status === "granted" && !storedSourceDistrusted) {
      const record = readStoredSource(stamp, grantIdentity());
      if (record) {
        const refreshed = { ...record, lastActivity: stamp };
        const written = persistSource(refreshed);
        syncCampaign(record);
        // If the refresh could not be written, the record on disk still has its
        // old activity stamp, so the deadline follows that one rather than a
        // later window this document only wished it had.
        armSourceDeadline(written ? refreshed : record);
        return;
      }
    }
    syncCampaign(null);
    if (candidate) {
      candidate = isCandidateAlive(candidate, stamp) ? { ...candidate, lastActivity: stamp } : null;
    }
    armSourceDeadline(candidate);
  }

  function captureArrival(): void {
    const stamp = now();
    const arrival = ledger.register();
    const record: SourceRecord = {
      ...APPROVED_TUPLE,
      capturedAt: stamp,
      lastActivity: stamp,
      arrival,
      consentEpoch: null,
    };
    if (status === "granted") {
      const stored = { ...record, consentEpoch: grantIdentity() };
      persistSource(stored);
      ledger.consume(arrival);
      candidate = null;
      syncCampaign(stored);
      armSourceDeadline(stored);
      return;
    }
    if (status === "denied") {
      // A refused visitor captures nothing at all; burn the arrival immediately.
      ledger.consume(arrival);
      return;
    }
    candidate = record;
    armSourceDeadline(candidate);
  }

  function discardSourceForUnsupportedInput(): void {
    ledger.consumeAll();
    candidate = null;
    invalidateStoredSource();
    syncCampaign(null);
    clearSourceTimer();
  }

  function startAdapter(): void {
    if (!adapter || adapter.isStarted()) return;
    const record =
      status === "granted" && !storedSourceDistrusted
        ? readStoredSource(now(), grantIdentity())
        : null;
    appliedSourceArrival = record ? record.arrival : 0;
    appliedRouteLabel = activeRouteLabel();
    adapter.start({ routeLabel: appliedRouteLabel, source: record ? APPROVED_TUPLE : null });
  }

  function countCurrentPageOnce(): void {
    if (!adapter?.isStarted() || currentPathname === null) return;
    if (lastCountedPathname === currentPathname) return;
    lastCountedPathname = currentPathname;
    adapter.sendPageview(routeLabelFor(currentPathname));
  }

  /** Withdrawal/refusal teardown. Deliberately reload-free: no form is lost. */
  function applyRevoked(next: ConsentStatus): void {
    status = next;
    candidate = null;
    ledger.consumeAll();
    invalidateStoredSource();
    clearSourceTimer();
    appliedSourceArrival = 0;
    appliedRouteLabel = null;
    lastCountedPathname = null;
    // `emittedSuccessOperations` is deliberately *not* cleared. An operation
    // that was resolved while consent was gone stays resolved, so a later
    // re-grant cannot replay it - that would be exactly the pre-consent replay
    // the policy forbids. It holds only client-operation ids, never visitor data.
    clearExpiryTimer();
    adapter?.stop();
  }

  function applyGranted(): void {
    status = "granted";
    const stamp = now();
    const eligible =
      candidate !== null && isCandidateAlive(candidate, stamp) && ledger.isEligible(candidate.arrival);
    if (eligible && candidate) {
      const promoted: SourceRecord = {
        ...candidate,
        lastActivity: stamp,
        consentEpoch: grantIdentity(),
      };
      persistSource(promoted);
      ledger.consume(candidate.arrival);
      armSourceDeadline(promoted);
    } else {
      // A grant only ever adopts attribution it just wrote itself. Anything
      // already sitting in session storage belongs to some earlier grant — a
      // record left behind by a refused removal, or one this document was
      // never allowed to read — and a new choice is not the moment to start
      // trusting it.
      invalidateStoredSource();
      clearSourceTimer();
    }
    candidate = null;
    scheduleExpiryCheck(readConsent(stamp).expiresAt);
    startAdapter();
    countCurrentPageOnce();
  }

  /**
   * Re-reads the stored preference and applies any change. This is the single
   * fail-closed gate: an expired, unreadable, invalid or externally cleared
   * record resolves to `undecided` and tears this document down immediately.
   *
   * @returns the effective status after any transition.
   */
  function revalidateConsent(): ConsentStatus {
    if (!initialised || config.mode === "disabled") return status;
    let next = readConsent(now()).status;
    // A choice this document could not persist outranks whatever storage says.
    // Without this, the previous record - still perfectly readable - would
    // revive collection at the very next checkpoint.
    if (unpersistedChoice !== null && next === "granted") next = unpersistedChoice;
    if (next === status) return status;
    if (next === "granted") applyGranted();
    else applyRevoked(next);
    notify();
    return status;
  }

  /** The largest delay `setTimeout` can represent without wrapping to ~0ms. */
  const MAX_TIMER_DELAY = 2_147_483_647;

  function clearExpiryTimer(): void {
    if (expiryTimer === null) return;
    try {
      (globalThis as { clearTimeout?: (handle: unknown) => void }).clearTimeout?.(expiryTimer);
    } catch {
      // A missing timer implementation is not an error here.
    }
    expiryTimer = null;
  }

  /**
   * Arms the teardown timer for the expiry instant.
   *
   * A six-month preference is roughly seven times longer than `setTimeout` can
   * represent, and an out-of-range delay does not mean "later" - it wraps to
   * about 1ms. So the wait is chained in hops of at most the representable
   * maximum, each hop doing nothing but re-checking the deadline and arming the
   * next one. That is a teardown deadline, not a heartbeat: no hop sends,
   * refreshes or records anything, and an idle background document that is
   * never navigated, focused or interacted with still stops collecting when the
   * preference expires.
   *
   * The lifecycle and before-emission re-checks remain: a throttled, frozen or
   * restored document cannot be trusted to fire this timer on time, and this
   * timer cannot be trusted to have fired at all.
   */
  function scheduleExpiryCheck(expiresAt: number | null): void {
    clearExpiryTimer();
    if (expiresAt === null) return;
    armExpiryHop(expiresAt);
  }

  function armExpiryHop(expiresAt: number): void {
    const set = (globalThis as { setTimeout?: (fn: () => void, ms: number) => unknown }).setTimeout;
    if (typeof set !== "function") return;
    const remaining = expiresAt - now();
    if (remaining <= 0) return;
    const handle = set(() => {
      expiryTimer = null;
      // Re-read the clock rather than trusting the hop to have been punctual.
      if (now() >= expiresAt) revalidateConsent();
      else armExpiryHop(expiresAt);
    }, Math.min(remaining, MAX_TIMER_DELAY));
    // Never hold a Node test process (or a page) open just for this check.
    (handle as { unref?: () => void })?.unref?.();
    expiryTimer = handle;
  }

  function clearSourceTimer(): void {
    if (sourceTimer === null) return;
    try {
      (globalThis as { clearTimeout?: (handle: unknown) => void }).clearTimeout?.(sourceTimer);
    } catch {
      // A missing timer implementation is not an error here.
    }
    sourceTimer = null;
  }

  /**
   * Arms the teardown deadline for the 30-minute source idle window.
   *
   * Checking expiry only when something happens to read the record is not the
   * same as expiring it: a document that is granted, attributed and then simply
   * left alone keeps its provider campaign context, and any provider-originated
   * traffic goes on carrying it. So the boundary gets its own deadline.
   *
   * It is a deadline, not a heartbeat. No hop reads for the sake of reading,
   * sends anything, or extends the window; the only thing that can happen when
   * it fires is that attribution goes away. Activity re-arms it, which is why
   * the record it was armed from is carried through: a refresh replaces the
   * timer rather than stacking another one.
   */
  function armSourceDeadline(from: SourceRecord | null): void {
    clearSourceTimer();
    if (!from) return;
    const deadline = from.lastActivity + SOURCE_IDLE_TTL_MS;
    if (now() >= deadline) {
      expireSource();
      return;
    }
    const set = (globalThis as { setTimeout?: (fn: () => void, ms: number) => unknown }).setTimeout;
    if (typeof set !== "function") return;
    const handle = set(() => {
      sourceTimer = null;
      // Re-read the clock rather than trusting the hop to have been punctual.
      if (now() >= deadline) expireSource();
      else armSourceDeadline(from);
    }, deadline - now());
    // Never hold a Node test process (or a page) open just for this check.
    (handle as { unref?: () => void })?.unref?.();
    sourceTimer = handle;
  }

  /** The idle window closed: drop attribution and the provider's campaign. */
  function expireSource(): void {
    clearSourceTimer();
    candidate = null;
    invalidateStoredSource();
    syncCampaign(null);
  }

  /**
   * Re-checks the source deadline without refreshing it.
   *
   * A throttled, frozen or restored document cannot be trusted to have fired
   * its timer on time, or at all, so becoming visible or restored is its own
   * checkpoint — and it has to happen before anything reads the record, not
   * after.
   */
  function revalidateSource(): void {
    if (!initialised || config.mode === "disabled") return;
    const stamp = now();
    if (candidate && !isCandidateAlive(candidate, stamp)) candidate = null;
    const record = currentSource();
    armSourceDeadline(record ?? candidate);
  }

  /**
   * Re-checks at document lifecycle boundaries. A hidden or frozen document may
   * have had its timers throttled for hours, so becoming visible/restored is
   * itself a checkpoint; and going the other way - hidden, frozen, pagehide -
   * is the last moment this document is reliably running code, so an expired
   * preference is torn down there rather than left armed on a timer that the
   * browser may never deliver.
   */
  function subscribeToLifecycle(): void {
    const win = globalThis as unknown as {
      addEventListener?: (type: string, fn: () => void) => void;
      removeEventListener?: (type: string, fn: () => void) => void;
    };
    const doc = (globalThis as { document?: Document }).document;
    if (typeof win.addEventListener !== "function") return;
    const checkpoint = () => {
      revalidateConsent();
      revalidateSource();
    };
    const events: [string, () => void][] = [
      ["pageshow", checkpoint],
      ["focus", checkpoint],
      ["resume", checkpoint],
      ["pagehide", checkpoint],
      ["freeze", checkpoint],
    ];
    for (const [type, handler] of events) win.addEventListener?.(type, handler);
    const docTarget = doc as unknown as {
      addEventListener?: (type: string, fn: () => void) => void;
      removeEventListener?: (type: string, fn: () => void) => void;
    } | undefined;
    if (typeof docTarget?.addEventListener === "function") {
      // Both directions matter: becoming visible ends a throttled stretch, and
      // becoming hidden is the last reliable moment to tear down.
      docTarget.addEventListener("visibilitychange", checkpoint);
    }
    releaseLifecycle = () => {
      for (const [type, handler] of events) win.removeEventListener?.(type, handler);
      docTarget?.removeEventListener?.("visibilitychange", checkpoint);
    };
  }

  function onOtherDocumentChange(): void {
    revalidateConsent();
  }

  function init(): void {
    // Idempotent: React StrictMode double-invokes effects and module init may
    // be reached more than once during HMR.
    if (initialised) return;
    initialised = true;

    config = resolveMeasurementConfig();
    if (config.mode === "disabled" || !config.measurementId) return;

    const loader = resolveTagLoader(config.mode);
    if (!loader) return;
    adapter = createGa4Adapter({
      measurementId: config.measurementId,
      loader,
      now,
      // A tag that finishes loading long after it was requested must not become
      // live on the strength of a consent check made before the request. The
      // preference is re-validated at the load callback, and a lapsed or
      // withdrawn one tears the document down there instead.
      isPermitted: () => revalidateConsent() === "granted",
    });

    status = readConsent(now()).status;

    // Fail closed on arrival. A source record that outlived its grant - the
    // preference expired, was refused, was withdrawn in another document, or is
    // unreadable - is burnt here, before a navigation can refresh it or a later
    // grant can adopt it. Only a genuinely new arrival captured below survives
    // an undecided document, and it survives in memory.
    if (status !== "granted") invalidateStoredSource();

    const here = locationOf();
    currentPathname = here.pathname;
    lastNavigationKey = navigationKey(here.pathname, here.search);

    // Only a genuine forward navigation is an arrival. A reload or a history
    // traversal must never re-read the URL for attribution.
    if (documentNavigationType() === "navigate") {
      const classification = classifySearch(here.search);
      if (classification === "gbp") captureArrival();
      else if (classification === "unsupported") discardSourceForUnsupportedInput();
    }

    if (status === "granted") {
      scheduleExpiryCheck(readConsent(now()).expiresAt);
      startAdapter();
      // A restored same-tab record keeps whatever idle window it had left, and
      // the ordinal an earlier document gave it: the next arrival here must not
      // be handed the same one.
      const restored = storedSourceDistrusted ? null : readStoredSource(now(), grantIdentity());
      if (restored) ledger.advancePast(restored.arrival);
      armSourceDeadline(restored);
    }
    subscribeToOtherDocuments(onOtherDocumentChange);
    subscribeToLifecycle();
  }

  /**
   * Records a choice.
   *
   * Persistence and current-document effect are deliberately separate. A
   * refusal or withdrawal always stops this document, whether or not the
   * preference could be written - leaving a granted session collecting because
   * storage is blocked would be exactly the wrong failure direction. What a
   * failed write genuinely cannot do is update other documents or survive a
   * reload, so `ok: false` is returned and the caller must say so honestly.
   *
   * A grant that cannot be written is not a decision, and it must not leave a
   * previously granted session running either.
   */
  function setChoice(choice: "granted" | "denied"): { ok: boolean } {
    if (!initialised || config.mode === "disabled") return { ok: false };
    const persisted = writeConsent(choice, now());

    if (choice === "denied") {
      unpersistedChoice = persisted ? null : "denied";
      applyRevoked("denied");
      notify();
      return { ok: persisted };
    }

    if (!persisted) {
      // Fail closed, and *latch* it: stop anything this document was already
      // collecting, and keep it stopped. A previous grant is still sitting in
      // readable storage, so without the latch the next navigation, focus event
      // or tracked interaction would silently re-enable this document against a
      // choice the visitor was told had not been saved.
      unpersistedChoice = "undecided";
      if (status === "granted") applyRevoked("undecided");
      notify();
      return { ok: false };
    }

    unpersistedChoice = null;
    applyGranted();
    notify();
    return { ok: true };
  }

  function recordNavigation(pathname: string, search: string, action: HistoryAction): void {
    if (!initialised || config.mode === "disabled") return;
    // A navigation is a checkpoint: an expired or unreadable preference tears
    // this document down before anything else is considered.
    revalidateConsent();
    const key = navigationKey(pathname, search);
    const repeated = key === lastNavigationKey;
    lastNavigationKey = key;
    currentPathname = pathname;

    if (repeated) {
      // A StrictMode re-run of the same entry refreshes the idle window and
      // nothing else; this URL was already classified when it was first seen.
      refreshActivity();
    } else if (action === "POP") {
      // A history traversal is never an arrival, so a valid historic GBP entry
      // must not mint attribution again. Source-bearing input that is *not* the
      // approved tuple still has to fail closed though: without this, pressing
      // Back to a different campaign left the earlier GBP attribution in place
      // and went on labelling later events with it.
      if (classifySearch(search) === "unsupported") discardSourceForUnsupportedInput();
      else refreshActivity();
    } else {
      const classification = classifySearch(search);
      if (classification === "gbp") captureArrival();
      else if (classification === "unsupported") discardSourceForUnsupportedInput();
      else refreshActivity();
    }

    if (status !== "granted") return;
    countCurrentPageOnce();
  }

  function emit(name: string, params: EventParams): void {
    // Re-checked here, immediately before the send, rather than trusted from
    // init: this is the last point at which an expired or unreadable
    // preference can still stop the payload.
    if (revalidateConsent() !== "granted" || !adapter?.isStarted()) return;
    const record = currentSource();
    adapter.sendEvent(
      name,
      record ? { ...params, ...APPROVED_TUPLE } : params,
      activeRouteLabel(),
    );
  }

  function trackEvent(name: string, params?: Record<string, string>): void {
    if (!initialised || config.mode === "disabled") return;
    const validated = validateEvent(name, params);
    // Rejected payloads are dropped whole and never logged.
    if (!validated) return;
    if (revalidateConsent() !== "granted") return;
    refreshActivity();
    emit(validated.name, validated.params);
  }

  function snapshotSource(): SourceSnapshot | null {
    if (!initialised || config.mode === "disabled") return null;
    if (revalidateConsent() !== "granted") return null;
    const record = currentSource();
    if (!record) return null;
    return { ...APPROVED_TUPLE, arrival: record.arrival };
  }

  function trackInquirySuccess(
    operationId: string,
    serviceSlug: string,
    snapshot: SourceSnapshot | null,
  ): void {
    if (!initialised || config.mode === "disabled") return;
    // Exactly one success event per accepted client operation. The id is
    // recorded before the consent check, so an operation resolved during a
    // withdrawal is spent rather than queued for a later grant.
    if (emittedSuccessOperations.has(operationId)) return;
    emittedSuccessOperations.add(operationId);
    // Consent is rechecked against storage on the accepted response, not
    // assumed from whatever was true when the request was formed.
    if (revalidateConsent() !== "granted") return;
    refreshActivity();
    const validated = validateEvent("inquiry_submit", {
      location: "inquiry_form",
      service: serviceSlug,
    });
    if (!validated) return;
    if (status !== "granted" || !adapter?.isStarted()) return;
    const record = currentSource();
    // Source travels with the success event only when it is still the same,
    // still-valid attribution the request was formed with.
    const sameAttribution = Boolean(record && snapshot && record.arrival === snapshot.arrival);
    adapter.sendEvent(
      validated.name,
      sameAttribution ? { ...validated.params, ...APPROVED_TUPLE } : validated.params,
      activeRouteLabel(),
      // Dropping the wrapper's own source fields is not enough on its own: the
      // page's `config` campaign is inherited by every event, so a source that
      // expired - or worse, a *different* arrival captured while the request was
      // out - would still label this submission behind the event's back. When
      // the snapshot no longer matches, the campaign is cleared for this one
      // payload only. The page keeps its real campaign context, because the page
      // really was reached that way; it is this accepted submission that must
      // not claim it.
      sameAttribution ? "inherit" : "clear",
    );
  }

  return {
    init,
    destroy: () => {
      clearExpiryTimer();
      clearSourceTimer();
      releaseLifecycle?.();
      releaseLifecycle = null;
    },
    isEligible: () => initialised && config.mode !== "disabled",
    getConfig: () => config,
    getStatus: () => status,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    grant: () => setChoice("granted"),
    deny: () => setChoice("denied"),
    withdraw: () => setChoice("denied"),
    recordNavigation,
    trackEvent,
    snapshotSource,
    trackInquirySuccess,
  };
}

/** The application singleton. Tests build their own isolated runtimes. */
export const measurement = createMeasurementRuntime();
