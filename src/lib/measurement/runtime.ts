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
import { routeLabelFor } from "./routes.ts";
import { validateEvent } from "./schema.ts";
import type { EventParams } from "./schema.ts";
import { classifySearch } from "./sourceInput.ts";
import {
  APPROVED_TUPLE,
  clearStoredSource,
  consumeAllArrivals,
  consumeArrival,
  documentNavigationType,
  isArrivalEligible,
  isCandidateAlive,
  readStoredSource,
  registerArrival,
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

  let currentPathname: string | null = null;
  let lastCountedPathname: string | null = null;
  let lastNavigationKey: string | null = null;

  let appliedSourceArrival = 0;
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
  let releaseLifecycle: (() => void) | null = null;

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  function activeRouteLabel(): string {
    return routeLabelFor(currentPathname ?? locationOf().pathname);
  }

  /** Re-applies or purges provider campaign context when source state changes. */
  function syncCampaign(record: SourceRecord | null): void {
    const arrival = record ? record.arrival : 0;
    if (arrival === appliedSourceArrival) return;
    appliedSourceArrival = arrival;
    adapter?.setCampaign(record ? APPROVED_TUPLE : null, activeRouteLabel());
  }

  /** Reads stored source, clearing expired/corrupt state and purging campaign. */
  function currentSource(): SourceRecord | null {
    const record = status === "granted" ? readStoredSource(now()) : null;
    syncCampaign(record);
    return record;
  }

  /** Only real navigation and user actions extend the 30-minute idle window. */
  function refreshActivity(): void {
    const stamp = now();
    const record = readStoredSource(stamp);
    if (record) {
      writeStoredSource({ ...record, lastActivity: stamp });
      syncCampaign(record);
      return;
    }
    syncCampaign(null);
    if (candidate) {
      candidate = isCandidateAlive(candidate, stamp) ? { ...candidate, lastActivity: stamp } : null;
    }
  }

  function captureArrival(): void {
    const stamp = now();
    const arrival = registerArrival();
    const record: SourceRecord = {
      ...APPROVED_TUPLE,
      capturedAt: stamp,
      lastActivity: stamp,
      arrival,
    };
    if (status === "granted") {
      writeStoredSource(record);
      consumeArrival(arrival);
      candidate = null;
      syncCampaign(record);
      return;
    }
    if (status === "denied") {
      // A refused visitor captures nothing at all; burn the arrival immediately.
      consumeArrival(arrival);
      return;
    }
    candidate = record;
  }

  function discardSourceForUnsupportedInput(): void {
    registerArrival();
    consumeAllArrivals();
    candidate = null;
    clearStoredSource();
    syncCampaign(null);
  }

  function startAdapter(): void {
    if (!adapter || adapter.isStarted()) return;
    const record = status === "granted" ? readStoredSource(now()) : null;
    appliedSourceArrival = record ? record.arrival : 0;
    adapter.start({ routeLabel: activeRouteLabel(), source: record ? APPROVED_TUPLE : null });
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
    consumeAllArrivals();
    clearStoredSource();
    appliedSourceArrival = 0;
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
    if (candidate && isCandidateAlive(candidate, stamp) && isArrivalEligible(candidate.arrival)) {
      writeStoredSource({ ...candidate, lastActivity: stamp });
      consumeArrival(candidate.arrival);
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

    if (repeated || action === "POP") {
      // StrictMode re-runs and history traversals refresh the idle window but
      // never create a new arrival and never clear existing state.
      refreshActivity();
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
