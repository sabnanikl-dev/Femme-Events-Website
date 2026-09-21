/**
 * Same-tab source attribution state.
 *
 * Two pieces of state, and no durable marketing identifier anywhere:
 *
 * 1. **Candidate** — volatile, in-memory only, held while the visitor has not
 *    yet chosen. It has the same 30-minute idle lifetime as stored state and is
 *    never written down or transmitted.
 * 2. **Granted record** — same-tab `sessionStorage`, written only after an
 *    explicit grant, with a 30-minute idle expiry checked before every use and
 *    before every activity refresh.
 *
 * ## The arrival ledger is memory, not storage
 *
 * Arrival bookkeeping — how many source-bearing arrivals this document has
 * seen and how many are already resolved — lives in the runtime's own memory
 * for the lifetime of the document. It used to be written to `sessionStorage`,
 * which meant a tagged landing wrote a key before the visitor had chosen
 * anything; that is source-derived state, and the policy says pre-choice source
 * state stays volatile. Nothing is written to session storage now until an
 * explicit grant, and a refusal writes nothing at all.
 *
 * The guarantee the persisted ledger was there for — a revoked landing never
 * comes back — is carried by two other things that survive a document boundary:
 *
 * - a reload or a history traversal is not an arrival at all
 *   (`documentNavigationType()`), so a revoked landing is never re-read from
 *   the URL in the first place; and
 * - a stored record names the grant it belongs to (`consentEpoch`), so a
 *   record that outlived its grant cannot be adopted by the next one.
 *
 * What a per-document ledger does lose is continuity of the ordinal, and the
 * ordinal has a second job: it is how an in-flight inquiry tells the
 * attribution it was formed with from one that replaced it. A granted record
 * restored after a reload still carries the ordinal an earlier document gave
 * it, and a ledger starting from zero would hand that same number to the next
 * arrival. So the ledger is advanced past the ordinal of any stored record
 * this document reads (`advancePast`). That stays in memory too: only a record
 * that an explicit grant already allowed to be written is ever read, and
 * nothing new is written down.
 *
 * ## Which grant a stored record belongs to
 *
 * `consentEpoch` is the expiry instant of the consent record that was in force
 * when the source was written. It is a value the necessary preference already
 * holds, so the approved consent record is not widened and nothing new is
 * learned about the visitor; a withdrawal followed by a re-grant simply
 * produces a different expiry. That is what makes cleanup verifiable across a
 * reload even when `removeItem` was refused and a readable record was left
 * behind: the new grant does not recognise it.
 */

import {
  APPROVED_SOURCE,
  SOURCE_IDLE_TTL_MS,
  SOURCE_RECORD_VERSION,
  SOURCE_STORAGE_KEY,
} from "./policy.ts";
import { parseRecord, probeItem, readItem, removeItem, writeItem } from "./storage.ts";

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
  /**
   * The expiry instant of the grant this attribution belongs to, or `null` on
   * a pre-choice candidate (which is never written down). A record whose epoch
   * is not the current grant's is not this grant's attribution and is dropped.
   */
  consentEpoch: number | null;
};

export const APPROVED_TUPLE: SourceTuple = {
  source: APPROVED_SOURCE.source,
  medium: APPROVED_SOURCE.medium,
  campaign: APPROVED_SOURCE.campaign,
};

/* ── Arrival ledger (in-memory, per document) ── */

/**
 * Arrival bookkeeping for one document. Two counters and nothing else: `seq`
 * is the highest arrival ordinal taken so far — minted by this document, or
 * carried by a stored record it read — and `consumed` is the highest one
 * already resolved by being promoted, refused or revoked.
 *
 * It is created per runtime and never written anywhere, so a tagged landing
 * leaves no trace before the visitor chooses and none after a refusal.
 */
export type ArrivalLedger = {
  /** Records a new source-bearing arrival and returns its ordinal. */
  register: () => number;
  /** Burns arrivals up to and including `arrival`. */
  consume: (arrival: number) => void;
  /** Burns every arrival this document currently knows about. */
  consumeAll: () => void;
  /**
   * Accounts for a stored record this document did not mint: its ordinal is
   * taken and already resolved, so `register` never hands it out again.
   */
  advancePast: (arrival: number) => void;
  isEligible: (arrival: number) => boolean;
};

export function createArrivalLedger(): ArrivalLedger {
  let seq = 0;
  let consumed = 0;
  return {
    register: () => {
      seq += 1;
      return seq;
    },
    consume: (arrival) => {
      if (arrival <= consumed) return;
      consumed = Math.min(arrival, seq);
    },
    consumeAll: () => {
      consumed = seq;
    },
    advancePast: (arrival) => {
      seq = Math.max(seq, arrival);
      consumed = Math.max(consumed, arrival);
    },
    isEligible: (arrival) => arrival > consumed && arrival <= seq,
  };
}

/* ── Granted record ── */

/**
 * What actually happened to the stored record.
 *
 * - `removed` — the key is provably gone.
 * - `neutralised` — removal was refused, but the record was overwritten with a
 *   value that can never read back as attribution. No campaign values remain.
 * - `failed` — neither worked, or the result could not be verified. The caller
 *   must distrust stored source for the rest of this document rather than
 *   report a cleanup it cannot stand behind.
 */
export type SourceClearResult = "removed" | "neutralised" | "failed";

/**
 * A value that occupies the key while saying nothing. It parses, and then
 * fails the version check, so every reader treats it as corrupt state.
 */
const SOURCE_TOMBSTONE = JSON.stringify({ v: 0 });

/**
 * Clears the stored source, and reports honestly when it could not.
 *
 * `removeItem` can be refused on its own while reads and writes still work, so
 * the removal is verified rather than assumed. When the record is still there,
 * overwriting it is the next best thing: it is the same approved key holding
 * strictly less than it did, which is cleanup, not new persistence.
 */
export function clearStoredSource(): SourceClearResult {
  removeItem("session", SOURCE_STORAGE_KEY);
  const afterRemoval = probeItem("session", SOURCE_STORAGE_KEY);
  if (afterRemoval === "absent") return "removed";
  // "unreadable" means we cannot prove anything about the key, which is a
  // failure, not a success.
  if (afterRemoval === "unreadable") return "failed";
  if (!writeItem("session", SOURCE_STORAGE_KEY, SOURCE_TOMBSTONE)) return "failed";
  return readItem("session", SOURCE_STORAGE_KEY) === SOURCE_TOMBSTONE ? "neutralised" : "failed";
}

export function writeStoredSource(record: SourceRecord): boolean {
  // A record that cannot name its grant is not writable attribution.
  if (record.consentEpoch === null) return false;
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
      g: record.consentEpoch,
    }),
  );
}

/**
 * Reads the stored record, clearing it when it is unreadable, malformed, from
 * the future, idle-expired, or left over from a different grant. Expiry is
 * inclusive: at exactly the boundary the record is already gone.
 *
 * @param consentEpoch the current grant's expiry instant, or `null` when there
 *   is no effective grant — in which case there is no readable source at all.
 */
export function readStoredSource(now: number, consentEpoch: number | null): SourceRecord | null {
  const raw = readItem("session", SOURCE_STORAGE_KEY);
  // Absent is simply "no source". Present-but-unreadable is corrupt state, which
  // fails closed *and* gets cleared rather than lingering.
  if (raw === null) return null;
  const invalid = () => {
    clearStoredSource();
    return null;
  };
  // No effective grant means no attribution, and the leftover goes now.
  if (consentEpoch === null) return invalid();
  const record = parseRecord(raw);
  if (!record) return invalid();
  if (record.v !== SOURCE_RECORD_VERSION) return invalid();
  // Attribution belongs to the grant it was captured under. A record that
  // survived a refused removal cannot be adopted by the next grant.
  if (record.g !== consentEpoch) return invalid();
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
  return { ...APPROVED_TUPLE, capturedAt, lastActivity, arrival, consentEpoch };
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
