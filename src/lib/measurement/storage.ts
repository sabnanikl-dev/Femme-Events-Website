/**
 * Fail-closed Web Storage access. Every operation can throw (disabled storage,
 * quota, privacy mode); a failure is reported, never swallowed into a pretend
 * success, and never treated as consent.
 */

export type StorageKind = "local" | "session";

function area(kind: StorageKind): Storage | null {
  try {
    const win = globalThis as unknown as { localStorage?: Storage; sessionStorage?: Storage };
    const store = kind === "local" ? win.localStorage : win.sessionStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

export function readItem(kind: StorageKind, key: string): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** @returns `true` only when the value was actually written. */
export function writeItem(kind: StorageKind, key: string, value: string): boolean {
  try {
    const store = area(kind);
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** @returns `true` only when the key was actually removed (or already absent). */
export function removeItem(kind: StorageKind, key: string): boolean {
  try {
    const store = area(kind);
    if (!store) return false;
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Parses stored JSON into a plain object, or `null` for anything unreadable. */
export function parseRecord(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
