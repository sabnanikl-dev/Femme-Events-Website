/**
 * Minimal fake browser environment for the focused measurement tests.
 *
 * Deliberately small: a clock, two storage areas, a cookie jar, a location, a
 * navigation-timing entry, a script-element recorder and event targets for
 * `storage`, window lifecycle and `visibilitychange`. That is the entire
 * surface the measurement modules touch, so the modules under test are the real
 * ones - only the environment is faked.
 *
 * Timers are opt-in (`fakeTimers: true`). With them installed, `advance()` both
 * moves the clock and *runs* the timers that come due, including ones armed by
 * a timer that already fired. That is what lets a six-month expiry be tested as
 * an idle document rather than as a bare `Date.now()` jump: moving the clock
 * alone proves nothing about code that is waiting on `setTimeout`. They are
 * opt-in because replacing the global timers for the whole process would reach
 * well beyond the module under test.
 */

export type FakeStorage = Storage & {
  failWrites: boolean;
  failReads: boolean;
  /**
   * Removal fails on its own. Real areas do fail asymmetrically - a policy or
   * quota condition can refuse `removeItem` while `getItem` and `setItem` still
   * work - and cleanup that cannot be verified is exactly the case that must
   * not be reported as a successful clear.
   */
  failRemovals: boolean;
  raw: Map<string, string>;
};

export function createFakeStorage(): FakeStorage {
  const raw = new Map<string, string>();
  const store = {
    raw,
    failWrites: false,
    failReads: false,
    failRemovals: false,
    get length() {
      return raw.size;
    },
    key(index: number) {
      return [...raw.keys()][index] ?? null;
    },
    getItem(key: string) {
      if (store.failReads) throw new Error("storage read blocked");
      return raw.has(key) ? (raw.get(key) as string) : null;
    },
    setItem(key: string, value: string) {
      if (store.failWrites) throw new Error("storage write blocked");
      raw.set(key, String(value));
    },
    removeItem(key: string) {
      if (store.failWrites || store.failRemovals) throw new Error("storage removal blocked");
      raw.delete(key);
    },
    clear() {
      raw.clear();
    },
  };
  return store as unknown as FakeStorage;
}

export type ScriptRecord = { src: string; async: boolean; removed: boolean };

export type FakeEnvironment = {
  now: () => number;
  setNow: (value: number) => void;
  /** Moves the clock and, when fake timers are installed, fires what comes due. */
  advance: (ms: number) => void;
  /** Timers still armed and not yet fired. */
  pendingTimers: () => number;
  local: FakeStorage;
  session: FakeStorage;
  location: { pathname: string; search: string; hash: string; hostname: string; href: string };
  setLocation: (next: { pathname?: string; search?: string; hostname?: string }) => void;
  setNavigationType: (type: "navigate" | "reload" | "back_forward" | "prerender") => void;
  cookies: () => Record<string, string>;
  setCookie: (name: string, value: string) => void;
  /** Sets `document.visibilityState` without firing the event. */
  setVisibility: (state: "visible" | "hidden") => void;
  scripts: ScriptRecord[];
  /** Simulates the browser firing `storage` in *other* same-origin documents. */
  emitStorageEvent: (key: string | null, newValue: string | null) => void;
  /** Simulates a document lifecycle event (`pageshow`, `focus`, `resume`). */
  emitLifecycleEvent: (type: string) => void;
  restore: () => void;
};

type Saved = { key: string; had: boolean; value: unknown };

export function installFakeEnvironment(
  options: {
    startTime?: number;
    hostname?: string;
    pathname?: string;
    search?: string;
    fakeTimers?: boolean;
  } = {},
): FakeEnvironment {
  const target = globalThis as unknown as Record<string, unknown>;
  const saved: Saved[] = [];
  const define = (key: string, value: unknown) => {
    saved.push({ key, had: key in target, value: target[key] });
    Object.defineProperty(target, key, { value, configurable: true, writable: true });
  };

  let clock = options.startTime ?? 1_600_000_000_000;
  const realDateNow = Date.now;
  Date.now = () => clock;

  const local = createFakeStorage();
  const session = createFakeStorage();

  const location = {
    pathname: options.pathname ?? "/",
    search: options.search ?? "",
    hash: "",
    hostname: options.hostname ?? "127.0.0.1",
    href: "",
  };
  const syncHref = () => {
    location.href = "http://" + location.hostname + location.pathname + location.search + location.hash;
  };
  syncHref();

  let navigationType: string = "navigate";
  let visibilityState: "visible" | "hidden" = "visible";
  const jar = new Map<string, string>();
  const scripts: ScriptRecord[] = [];
  const listeners = new Map<string, Set<(event: unknown) => void>>();

  const documentListeners = new Map<string, Set<(event: unknown) => void>>();

  const documentStub = {
    title: "Femme Events - Atlanta Wedding & Event Planning",
    get visibilityState() {
      return visibilityState;
    },
    addEventListener(type: string, handler: (event: unknown) => void) {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set());
      documentListeners.get(type)?.add(handler);
    },
    removeEventListener(type: string, handler: (event: unknown) => void) {
      documentListeners.get(type)?.delete(handler);
    },
    get cookie() {
      return [...jar.entries()].map(([name, value]) => name + "=" + value).join("; ");
    },
    set cookie(input: string) {
      const [pair, ...attributes] = input.split(";").map((part) => part.trim());
      const eq = pair.indexOf("=");
      const name = eq === -1 ? pair : pair.slice(0, eq);
      const value = eq === -1 ? "" : pair.slice(eq + 1);
      const expired = attributes.some((attribute) => {
        const lower = attribute.toLowerCase();
        if (lower.startsWith("max-age=")) return Number(lower.slice(8)) <= 0;
        if (lower.startsWith("expires=")) return Date.parse(attribute.slice(8)) <= clock;
        return false;
      });
      if (expired) jar.delete(name);
      else jar.set(name, value);
    },
    createElement(tag: string) {
      if (tag !== "script") return {} as unknown;
      const record: ScriptRecord = { src: "", async: false, removed: false };
      const handlers = new Map<string, () => void>();
      const element = {
        set src(value: string) {
          record.src = value;
        },
        get src() {
          return record.src;
        },
        set async(value: boolean) {
          record.async = value;
        },
        get async() {
          return record.async;
        },
        addEventListener(type: string, handler: () => void) {
          handlers.set(type, handler);
        },
        parentNode: {
          removeChild() {
            record.removed = true;
          },
        },
      };
      scripts.push(record);
      return element;
    },
    head: { appendChild: () => {} },
  };

  /* ── Opt-in fake timers ─────────────────────────────────────────────────── */

  type PendingTimer = { id: number; due: number; fn: () => void };
  const timers: PendingTimer[] = [];
  let nextTimerId = 1;
  const useFakeTimers = options.fakeTimers === true;

  if (useFakeTimers) {
    define("setTimeout", (fn: () => void, ms?: number) => {
      const id = nextTimerId;
      nextTimerId += 1;
      timers.push({ id, due: clock + Math.max(0, Number(ms) || 0), fn });
      return id;
    });
    define("clearTimeout", (handle: unknown) => {
      const index = timers.findIndex((timer) => timer.id === handle);
      if (index !== -1) timers.splice(index, 1);
    });
  }

  /** Fires everything due at or before `limit`, in due order, re-entrantly. */
  const runTimersUntil = (limit: number) => {
    for (let guard = 0; guard < 10_000; guard += 1) {
      let next: PendingTimer | null = null;
      for (const timer of timers) {
        if (timer.due > limit) continue;
        if (next === null || timer.due < next.due || (timer.due === next.due && timer.id < next.id)) {
          next = timer;
        }
      }
      if (next === null) return;
      timers.splice(timers.indexOf(next), 1);
      clock = Math.max(clock, next.due);
      next.fn();
    }
    throw new Error("fake timers did not settle: a timer keeps rescheduling inside the window");
  };

  define("window", target);
  define("document", documentStub);
  define("localStorage", local);
  define("sessionStorage", session);
  define("location", location);
  define("performance", {
    getEntriesByType: (type: string) => (type === "navigation" ? [{ type: navigationType }] : []),
  });
  define("addEventListener", (type: string, handler: (event: unknown) => void) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)?.add(handler);
  });
  define("removeEventListener", (type: string, handler: (event: unknown) => void) => {
    listeners.get(type)?.delete(handler);
  });

  return {
    now: () => clock,
    setNow: (value) => {
      clock = value;
    },
    advance: (ms) => {
      const limit = clock + ms;
      if (useFakeTimers) runTimersUntil(limit);
      clock = limit;
    },
    pendingTimers: () => timers.length,
    local,
    session,
    location,
    setLocation: (next) => {
      if (next.pathname !== undefined) location.pathname = next.pathname;
      if (next.search !== undefined) location.search = next.search;
      if (next.hostname !== undefined) location.hostname = next.hostname;
      syncHref();
    },
    setNavigationType: (type) => {
      navigationType = type;
    },
    cookies: () => Object.fromEntries(jar.entries()),
    setCookie: (name, value) => {
      jar.set(name, value);
    },
    setVisibility: (state) => {
      visibilityState = state;
    },
    scripts,
    emitStorageEvent: (key, newValue) => {
      for (const handler of listeners.get("storage") ?? []) handler({ key, newValue });
    },
    emitLifecycleEvent: (type) => {
      for (const handler of listeners.get(type) ?? []) handler({ type });
      for (const handler of documentListeners.get(type) ?? []) handler({ type });
    },
    restore: () => {
      Date.now = realDateNow;
      timers.length = 0;
      for (const entry of saved.reverse()) {
        if (entry.had) Object.defineProperty(target, entry.key, { value: entry.value, configurable: true, writable: true });
        else delete target[entry.key];
      }
      delete target.dataLayer;
      delete target.gtag;
      for (const key of Object.keys(target)) {
        if (key.startsWith("ga-disable-")) delete target[key];
      }
      delete target.__FEMME_MEASUREMENT_ENV__;
      delete target.__FEMME_MEASUREMENT_FIXTURE_TAG__;
    },
  };
}
