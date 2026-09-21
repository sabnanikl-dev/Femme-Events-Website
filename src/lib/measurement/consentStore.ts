/**
 * The necessary consent preference record.
 *
 * Contents are exactly: the choice, the policy version and an expiry. No
 * marketing tuple, no identifier, no form data. Unreadable, invalid,
 * version-mismatched or expired storage reads as `undecided`, which is the
 * fail-closed state — nothing loads and nothing is collected.
 */

import {
  CONSENT_RECORD_VERSION,
  CONSENT_STORAGE_KEY,
  CONSENT_TTL_MS,
  MEASUREMENT_POLICY_VERSION,
} from "./policy.ts";
import { parseRecord, readItem, removeItem, writeItem } from "./storage.ts";

export type ConsentChoice = "granted" | "denied";
export type ConsentStatus = ConsentChoice | "undecided";

export type ConsentState = {
  status: ConsentStatus;
  /** Present only for a valid stored choice. */
  expiresAt: number | null;
};

const UNDECIDED: ConsentState = { status: "undecided", expiresAt: null };

export function readConsent(now: number): ConsentState {
  const record = parseRecord(readItem("local", CONSENT_STORAGE_KEY));
  if (!record) return UNDECIDED;
  if (record.v !== CONSENT_RECORD_VERSION) return UNDECIDED;
  if (record.policy !== MEASUREMENT_POLICY_VERSION) return UNDECIDED;
  if (record.choice !== "granted" && record.choice !== "denied") return UNDECIDED;
  const expiresAt = record.exp;
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return UNDECIDED;
  if (now >= expiresAt) return UNDECIDED;
  return { status: record.choice, expiresAt };
}

/**
 * Persists a choice.
 *
 * @returns `false` when the write did not happen. The caller must keep the
 *   preference UI open and must not treat a failed save as a grant.
 */
export function writeConsent(choice: ConsentChoice, now: number): boolean {
  const payload = JSON.stringify({
    v: CONSENT_RECORD_VERSION,
    policy: MEASUREMENT_POLICY_VERSION,
    choice,
    exp: now + CONSENT_TTL_MS,
  });
  return writeItem("local", CONSENT_STORAGE_KEY, payload);
}

export function clearConsent(): boolean {
  return removeItem("local", CONSENT_STORAGE_KEY);
}

/**
 * Notifies when the preference changes in *another* same-origin document. The
 * `storage` event is the approved record changing; no new storage mechanism and
 * no source attribution is shared between tabs by this.
 */
export function subscribeToOtherDocuments(listener: () => void): () => void {
  const target = globalThis as unknown as {
    addEventListener?: (type: string, fn: (event: StorageEvent) => void) => void;
    removeEventListener?: (type: string, fn: (event: StorageEvent) => void) => void;
  };
  if (typeof target.addEventListener !== "function") return () => {};
  const handler = (event: StorageEvent) => {
    // `key === null` is a whole-area clear, which also affects our record.
    if (event.key === null || event.key === CONSENT_STORAGE_KEY) listener();
  };
  target.addEventListener("storage", handler);
  return () => target.removeEventListener?.("storage", handler);
}
