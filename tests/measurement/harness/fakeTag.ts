/**
 * Inert local tag used at the transport seam.
 *
 * It models the parts of gtag.js the adapter's contract depends on, and nothing
 * else: a backlog of `dataLayer` entries drained on load, `push` taken over
 * afterwards, a check of `window['ga-disable-<ID>']` immediately before any
 * send, consent state tracking, session-scoped cookie writes, a
 * provider-originated lifecycle ping that does not pass through the wrapper,
 * and - the one piece of real tag semantics that matters for campaign state -
 * *config inheritance*: parameters set by `config` persist and are inherited by
 * later events unless the event overrides them. Without that, a test could not
 * see a stale or newly-captured campaign riding along on an event that omits
 * the fields itself.
 *
 * The inheritance model is a simplification (real gtag.js has richer parameter
 * scoping rules), and it is not evidence about Google's behaviour.
 *
 * It sends nothing anywhere. Everything it "collects" stays in memory, so these
 * tests prove the application's contract with a modelled tag - never that the
 * real gtag.js behaves this way. That remains a website #83 activation gate.
 */

import type { TagLoadRequest } from "../../../src/lib/measurement/transport.ts";

export type Collected = {
  name: string;
  /** Exactly what the wrapper passed to `event`. */
  params: Record<string, unknown>;
  /** Modelled provider view: inherited `config` parameters plus the event's own. */
  effective: Record<string, unknown>;
};

export type FakeTag = {
  /** Load requests handed to the transport, including stale generations. */
  loadRequests: TagLoadRequest[];
  /** Payloads that actually left the modelled tag. */
  collected: Collected[];
  /** Sends the tag suppressed because the documented opt-out was set. */
  suppressed: Collected[];
  consentStates: Record<string, string>[];
  configs: { id: string; params: Record<string, unknown> }[];
  /** Accumulated, still-active `config` parameters for the measurement id. */
  configState: () => Record<string, unknown>;
  loaded: boolean;
  /** Runs the modelled script: drains the backlog and takes over `push`. */
  load: (request?: TagLoadRequest) => void;
  /** Provider-originated traffic that never passes through the wrapper. */
  lifecycleTick: () => void;
  uninstall: () => void;
};

type Target = Record<string, unknown> & { dataLayer?: unknown[] };

export function installFakeTag(options: { autoLoad?: boolean } = {}): FakeTag {
  const target = globalThis as unknown as Target;
  const autoLoad = options.autoLoad ?? true;

  const tag: FakeTag = {
    loadRequests: [],
    collected: [],
    suppressed: [],
    consentStates: [],
    configs: [],
    configState: () => ({ ...configState }),
    loaded: false,
    load: () => {},
    lifecycleTick: () => {},
    uninstall: () => {
      delete target.__FEMME_MEASUREMENT_FIXTURE_TAG__;
    },
  };

  let measurementId = "";
  let analyticsGranted = false;
  /** Inherited config parameters, as a real tag would retain them. */
  let configState: Record<string, unknown> = {};

  const disabled = () => target["ga-disable-" + measurementId] === true;

  const send = (name: string, params: Record<string, unknown>) => {
    // Event parameters win over inherited config parameters of the same name.
    const effective = { ...configState, ...params };
    // The documented opt-out is consulted before every send and every cookie.
    if (disabled()) {
      tag.suppressed.push({ name, params, effective });
      return;
    }
    tag.collected.push({ name, params, effective });
  };

  const writeCookies = () => {
    if (disabled() || !analyticsGranted) return;
    const container = measurementId.replace(/^G-/, "");
    const doc = (globalThis as { document?: { cookie: string } }).document;
    if (!doc) return;
    doc.cookie = "_ga=GA1.1.fake.session";
    doc.cookie = "_ga_" + container + "=GS1.1.fake.session";
  };

  const process = (entry: unknown) => {
    if (!Array.isArray(entry)) return;
    const [command, a, b] = entry as [string, unknown, unknown];
    if (command === "consent") {
      const state = (b ?? {}) as Record<string, string>;
      tag.consentStates.push({ mode: String(a), ...state });
      if (typeof state.analytics_storage === "string") {
        analyticsGranted = state.analytics_storage === "granted";
      }
      return;
    }
    if (command === "config") {
      const params = (b ?? {}) as Record<string, unknown>;
      tag.configs.push({ id: String(a), params });
      if (String(a) === measurementId) configState = { ...configState, ...params };
      writeCookies();
      return;
    }
    if (command === "event") {
      send(String(a), (b ?? {}) as Record<string, unknown>);
    }
  };

  const load = (request?: TagLoadRequest) => {
    if (tag.loaded) return;
    tag.loaded = true;
    const backlog = Array.isArray(target.dataLayer) ? [...target.dataLayer] : [];
    // gtag.js owns `push` from here on, so entries can no longer be un-queued.
    if (Array.isArray(target.dataLayer)) {
      target.dataLayer.push = ((...items: unknown[]) => {
        for (const item of items) process(item);
        return 0;
      }) as unknown as typeof target.dataLayer.push;
    }
    for (const entry of backlog) process(entry);
    request?.onLoad();
  };

  target.__FEMME_MEASUREMENT_FIXTURE_TAG__ = (request: TagLoadRequest) => {
    tag.loadRequests.push(request);
    measurementId = request.measurementId;
    tag.load = () => (tag.loaded ? request.onLoad() : load(request));
    // An already-executed script resolves immediately on a repeat request,
    // which is what a re-grant in the same document looks like.
    if (autoLoad) tag.load();
    return () => {
      // Script removal on its own proves nothing: already-loaded provider code
      // keeps its own timers. The modelled lifecycle tick below shows that.
    };
  };

  tag.lifecycleTick = () => {
    if (!tag.loaded) return;
    send("user_engagement", { engagement_time_msec: 1000 });
  };

  return tag;
}
