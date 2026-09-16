/**
 * Same-tab source attribution state.
 *
 * Three pieces of state, and no durable marketing identifier anywhere:
 *
 * 1. **Candidate** — volatile, in-memory only, held while the visitor has not
 *    yet chosen. It has the same 30-minute idle lifetime as stored state and is
 *    never written down or transmitted.
 * 2. **Granted record** — same-tab `sessionStorage`, written only after an
 *    explicit grant, with a 30-minute idle expiry checked before every use and
 *    before every activity refresh.
 * 3. **Arrival ledger** — same-tab `sessionStorage`, two integers, no campaign
 *    values. `seq` counts source-bearing arrivals this tab has seen; `consumed`
 *    is the highest arrival already resolved (promoted, refused or revoked).
 *
 * The ledger is the arrival-consumption mechanism. A reload or a history
 * traversal is not an arrival, so it never increments `seq`; after a refusal or
 * a withdrawal `consumed` is set to `seq`, which burns every arrival the tab
 * currently knows about. A later re-grant therefore finds nothing eligible, and
 * an old revoked landing cannot come back through reload, Back/Forward or the
 * preferences panel. Only a genuinely new forward navigation carrying the
 * approved tuple raises `seq` again.
 */

import {
  APPROVED_SOURCE,
  ARRIVAL_LEDGER_KEY,
  ARRIVAL_LEDGER_VERSION,
  SOURCE_IDLE_TTL_MS,
  SOURCE_RECORD_VERSION,
  SOURCE_STORAGE_KEY,
} from "./policy.ts";
import { parseRecord, readItem, removeItem, writeItem } from "./storage.ts";

export type SourceTuple = {
  source: typeof APPROVED_SOURCE.source;
  medium: typeof APPROVED_SOURCE.medium;
  campaign: typeof APPROVED_SOURCE.campaign;
};

export type SourceRecord = SourceTuple & {
  capturedAt: number;
  lastActivity: number;
  /** The arrival ordinal this record came from. Tab-scoped counter, not an id. */
  arrival: number;
};

export const APPROVED_TUPLE: SourceTuple = {
  source: APPROVED_SOURCE.source,
  medium: APPROVED_SOURCE.medium,
  campaign: APPROVED_SOURCE.campaign,
};

/* ── Arrival ledger ── */

export type ArrivalLedger = { seq: number; consumed: number };

const EMPTY_LEDGER: ArrivalLedger = { seq: 0, consumed: 0 };

export function readLedger(): ArrivalLedger {
  const record = parseRecord(readItem("session", ARRIVAL_LEDGER_KEY));
  if (!record || record.v !== ARRIVAL_LEDGER_VERSION) return { ...EMPTY_LEDGER };
  const seq = record.seq;
  const consumed = record.consumed;
  if (typeof seq !== "number" || typeof consumed !== "number") return { ...EMPTY_LEDGER };
  if (!Number.isInteger(seq) || !Number.isInteger(consumed)) return { ...EMPTY_LEDGER };
  if (seq < 0 || consumed < 0 || consumed > seq) return { ...EMPTY_LEDGER };
  return { seq, consumed };
}

export function writeLedger(ledger: ArrivalLedger): boolean {
  return writeItem(
    "session",
    ARRIVAL_LEDGER_KEY,
    JSON.stringify({ v: ARRIVAL_LEDGER_VERSION, seq: ledger.seq, consumed: ledger.consumed }),
  );
}

/** Records a new source-bearing arrival and returns its ordinal. */
export function registerArrival(): number {
  const ledger = readLedger();
  const next = { seq: ledger.seq + 1, consumed: ledger.consumed };
  writeLedger(next);
  return next.seq;
}

/** Burns every arrival this tab currently knows about. */
export function consumeAllArrivals(): void {
  const ledger = readLedger();
  writeLedger({ seq: ledger.seq, consumed: ledger.seq });
}

/** Burns arrivals up to and including `arrival`. */
export function consumeArrival(arrival: number): void {
  const ledger = readLedger();
  if (arrival <= ledger.consumed) return;
  writeLedger({ seq: ledger.seq, consumed: Math.min(arrival, ledger.seq) });
}

export function isArrivalEligible(arrival: number): boolean {
  const ledger = readLedger();
  return arrival > ledger.consumed && arrival <= ledger.seq;
}

/* ── Granted record ── */

export function clearStoredSource(): void {
  removeItem("session", SOURCE_STORAGE_KEY);
}

export function writeStoredSource(record: SourceRecord): boolean {
  return writeItem(
    "session",
    SOURCE_STORAGE_KEY,
    JSON.stringify({
      v: SOURCE_RECORD_VERSION,
      s: record.source,
      m: record.medium,
      c: record.campaign,
      t: record.capturedAt,
      a: record.lastActivity,
      n: record.arrival,
    }),
  );
}

/**
 * Reads the stored record, clearing it when it is unreadable, malformed, from
 * the future, or idle-expired. Expiry is inclusive: at exactly the boundary the
 * record is already gone.
 */
export function readStoredSource(now: number): SourceRecord | null {
  const raw = readItem("session", SOURCE_STORAGE_KEY);
  // Absent is simply "no source". Present-but-unreadable is corrupt state, which
  // fails closed *and* gets cleared rather than lingering.
  if (raw === null) return null;
  const invalid = () => {
    clearStoredSource();
    return null;
  };
  const record = parseRecord(raw);
  if (!record) return invalid();
  if (record.v !== SOURCE_RECORD_VERSION) return invalid();
  if (record.s !== APPROVED_SOURCE.source) return invalid();
  if (record.m !== APPROVED_SOURCE.medium) return invalid();
  if (record.c !== APPROVED_SOURCE.campaign) return invalid();
  const capturedAt = record.t;
  const lastActivity = record.a;
  const arrival = record.n;
  if (typeof capturedAt !== "number" || !Number.isFinite(capturedAt)) return invalid();
  if (typeof lastActivity !== "number" || !Number.isFinite(lastActivity)) return invalid();
  if (typeof arrival !== "number" || !Number.isInteger(arrival) || arrival <= 0) return invalid();
  // Future timestamps cannot be aged, so they fail closed.
  if (capturedAt > now || lastActivity > now) return invalid();
  if (now - lastActivity >= SOURCE_IDLE_TTL_MS) return invalid();
  return { ...APPROVED_TUPLE, capturedAt, lastActivity, arrival };
}

/** Idle-expiry check for the volatile candidate. */
export function isCandidateAlive(candidate: SourceRecord, now: number): boolean {
  if (candidate.lastActivity > now || candidate.capturedAt > now) return false;
  return now - candidate.lastActivity < SOURCE_IDLE_TTL_MS;
}

/* ── Navigation type ── */

export type DocumentNavigationType = "navigate" | "reload" | "back_forward" | "unknown";

/**
 * How this document was reached. Reloads and history traversals are explicitly
 * not arrivals: they must never re-read the URL for attribution.
 */
export function documentNavigationType(): DocumentNavigationType {
  try {
    const perf = (globalThis as { performance?: Performance }).performance;
    const entries = perf?.getEntriesByType?.("navigation") as PerformanceNavigationTiming[] | undefined;
    const type = entries && entries.length > 0 ? entries[0].type : undefined;
    if (type === "navigate" || type === "reload" || type === "back_forward") return type;
    return "unknown";
  } catch {
    return "unknown";
  }
}
