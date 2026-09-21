/**
 * The real GA4 adapter. Only the tag transport is seamed (see `transport.ts`).
 *
 * Withdrawal is layered and reload-free, so an in-progress inquiry survives it:
 *
 *   1. the wrapper stops emitting and drops its own queued `dataLayer` entries;
 *   2. `window['ga-disable-<MEASUREMENT_ID>']` is set to `true` — the property
 *      documented by Google as checked before the tag sets a cookie or sends
 *      data (tag-platform privacy guide, page last updated 2026-07-30);
 *   3. `consent` is updated to denied for analytics and every ads signal.
 *
 * Layer 3 is a complement, never a substitute. Denied consent does not by
 * itself mean silence: in *advanced* consent mode the tag is loaded before a
 * choice and still sends cookieless pings while consent is denied, which the
 * approved policy forbids. This build is *basic*-shaped instead - the tag is
 * never requested before an explicit grant, so a refusal pings nothing because
 * nothing was loaded - but once the tag has loaded, a later `consent update`
 * to denied is not a stop signal. Layer 2 is what carries the no-collection
 * requirement after load; layers 1 and 3 alone would not be proof that Google
 * code stopped.
 *
 * What this file cannot prove locally: that the shipped `gtag.js` honours the
 * flag comprehensively, that no residual lifecycle traffic escapes, and that
 * provider-console settings are set. Those are website #83 activation gates.
 */

import {
  SAFE_ORIGIN,
  SAFE_REFERRER,
  SAFE_TITLE,
  ga4CookieNames,
  gaDisableFlagName,
} from "./policy.ts";
import type { SourceTuple } from "./sourceState.ts";
import type { TagLoader } from "./transport.ts";
import type { EventParams } from "./schema.ts";

type GtagWindow = Record<string, unknown> & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

/** Every storage signal we ever request, all denied. */
const ALL_DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
} as const;

/** Grant analytics storage only. Ads signals stay denied in every state. */
const ANALYTICS_GRANTED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "granted",
} as const;

export type Ga4AdapterOptions = {
  measurementId: string;
  loader: TagLoader;
  now: () => number;
  /**
   * Re-validated at the load callback. A tag requested under a valid grant can
   * arrive minutes later - from a slow network, a throttled background tab or a
   * restored document - by which time the preference may have expired or been
   * withdrawn. Returning `false` tears the tag down instead of marking it live.
   */
  isPermitted: () => boolean;
};

/**
 * Campaign treatment for a single event.
 *
 * `"inherit"` is the ordinary case: the page's `config` campaign describes the
 * page, and events inherit it. `"clear"` is for a payload whose own attribution
 * is known *not* to be the page's - it carries empty campaign fields at event
 * scope, which per Google's gtag.js reference take precedence over `config`
 * parameters without modifying them. The page keeps its campaign; this one
 * payload does not claim it.
 */
export type EventCampaignScope = "inherit" | "clear";

export type Ga4Adapter = {
  start: (context: { routeLabel: string; source: SourceTuple | null }) => void;
  stop: () => void;
  setCampaign: (source: SourceTuple | null, routeLabel: string) => void;
  sendPageview: (routeLabel: string) => void;
  sendEvent: (
    name: string,
    params: EventParams,
    routeLabel: string,
    campaignScope?: EventCampaignScope,
  ) => void;
  isStarted: () => boolean;
};

function win(): GtagWindow | null {
  const target = globalThis as unknown as GtagWindow;
  return target ? target : null;
}

/**
 * Candidate cookie domains for selective cleanup: the host and each parent down
 * to a two-label domain, with and without a leading dot. Only the inventoried
 * GA4 cookie names are ever deleted; unrelated cookies are left alone.
 */
function cookieDomains(hostname: string): string[] {
  const domains: string[] = [""];
  if (!hostname || /^[\d.]+$/.test(hostname) || hostname === "localhost") return domains;
  const labels = hostname.split(".");
  for (let i = 0; i + 2 <= labels.length; i += 1) {
    const domain = labels.slice(i).join(".");
    if (domain.split(".").length < 2) break;
    domains.push(domain, `.${domain}`);
  }
  return domains;
}

/** Deletes only `_ga` and `_ga_<container>` for the configured measurement id. */
export function clearGa4Cookies(measurementId: string): void {
  const doc = (globalThis as { document?: Document }).document;
  const loc = (globalThis as { location?: { hostname?: string } }).location;
  if (!doc) return;
  const names = ga4CookieNames(measurementId);
  let existing = "";
  try {
    existing = doc.cookie ?? "";
  } catch {
    return;
  }
  const present = new Set(
    existing
      .split(";")
      .map((part) => part.split("=")[0]?.trim())
      .filter((name): name is string => Boolean(name)),
  );
  for (const name of names) {
    if (!present.has(name)) continue;
    for (const domain of cookieDomains(loc?.hostname ?? "")) {
      const domainPart = domain ? `; domain=${domain}` : "";
      try {
        doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/${domainPart}`;
      } catch {
        // A rejected cookie write must never break the page.
      }
    }
  }
}

export function createGa4Adapter(options: Ga4AdapterOptions): Ga4Adapter {
  const { measurementId, loader, now, isPermitted } = options;
  const disableFlag = gaDisableFlagName(measurementId);

  let started = false;
  let loaded = false;
  let generation = 0;
  let dataLayerBaseline = 0;
  let campaignApplied = false;
  let handle: { remove: () => void } | null = null;

  function push(args: unknown[]): void {
    const target = win();
    if (!target?.dataLayer) return;
    target.dataLayer.push(args);
  }

  function bootstrap(): void {
    const target = win();
    if (!target) return;
    if (!Array.isArray(target.dataLayer)) target.dataLayer = [];
    dataLayerBaseline = target.dataLayer.length;
    if (typeof target.gtag !== "function") {
      target.gtag = function gtag(...args: unknown[]) {
        (globalThis as unknown as GtagWindow).dataLayer?.push(args);
      };
    }
  }

  function contextParams(routeLabel: string): Record<string, unknown> {
    return {
      page_location: `${SAFE_ORIGIN}${routeLabel}`,
      page_title: SAFE_TITLE,
      page_referrer: SAFE_REFERRER,
    };
  }

  function campaignParams(source: SourceTuple | null): Record<string, unknown> {
    if (source) {
      campaignApplied = true;
      return {
        campaign_source: source.source,
        campaign_medium: source.medium,
        campaign_name: source.campaign,
      };
    }
    if (!campaignApplied) return {};
    // Explicit purge of stale provider campaign context. Omitting the fields
    // from a later event would not clear anything.
    campaignApplied = false;
    return { campaign_source: "", campaign_medium: "", campaign_name: "" };
  }

  function configParams(routeLabel: string, source: SourceTuple | null): Record<string, unknown> {
    return {
      send_page_view: false,
      cookie_expires: 0,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ads_data_redaction: true,
      ...contextParams(routeLabel),
      ...campaignParams(source),
    };
  }

  function start(context: { routeLabel: string; source: SourceTuple | null }): void {
    if (started) return;
    started = true;
    loaded = false;
    generation += 1;
    const thisGeneration = generation;

    bootstrap();
    const target = win();
    if (target) target[disableFlag] = false;

    // Consent defaults must be in the queue before config or the tag script.
    push(["consent", "default", { ...ALL_DENIED }]);
    push(["consent", "update", { ...ANALYTICS_GRANTED }]);
    push(["js", new Date(now())]);
    push(["config", measurementId, configParams(context.routeLabel, context.source)]);

    handle = loader({
      src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
      measurementId,
      generation: thisGeneration,
      onLoad: () => {
        // A callback from an invalidated generation never revives the tag.
        if (thisGeneration !== generation || !started) return;
        // Neither does one that arrives after the preference stopped being
        // valid. `isPermitted` re-reads the preference, so a grant that expired
        // or was withdrawn while this load was in flight tears the tag down
        // here - the documented opt-out is set and the queue is dropped -
        // rather than letting a late script go live unchecked.
        if (!isPermitted()) {
          if (started) stop();
          return;
        }
        loaded = true;
      },
      onError: () => {
        if (thisGeneration !== generation) return;
        loaded = false;
      },
    });
  }

  function stop(): void {
    // Invalidate every in-flight load generation and queued callback first.
    generation += 1;
    const target = win();
    // Layer 2: the documented opt-out, set before anything else can send.
    if (target) target[disableFlag] = true;

    if (target?.dataLayer && !loaded) {
      // Nothing has processed the queue yet, so our own entries can still be
      // dropped. After load, gtag.js owns `push`; already-sent payloads cannot
      // be recalled and this splice is deliberately not claimed to unsend them.
      try {
        target.dataLayer.splice(dataLayerBaseline);
      } catch {
        // Ignore an exotic dataLayer implementation.
      }
    }
    if (started && target?.dataLayer) {
      // Layer 3: complement the flag with an explicit denied consent update.
      push(["consent", "update", { ...ALL_DENIED }]);
    }
    if (campaignApplied && started && target?.dataLayer) {
      push(["config", measurementId, campaignParams(null)]);
    }

    clearGa4Cookies(measurementId);
    handle?.remove();
    handle = null;
    started = false;
    loaded = false;
    campaignApplied = false;
  }

  /**
   * Re-configures the page's campaign and route context together. The caller
   * decides when either changed; with no campaign held and none to purge this
   * is still a context refresh, because `config` is the only page context that
   * traffic the tag originates itself will ever inherit.
   */
  function setCampaign(source: SourceTuple | null, routeLabel: string): void {
    if (!started) return;
    push([
      "config",
      measurementId,
      { send_page_view: false, ...contextParams(routeLabel), ...campaignParams(source) },
    ]);
  }

  function sendPageview(routeLabel: string): void {
    if (!started) return;
    push(["event", "page_view", { ...contextParams(routeLabel) }]);
  }

  /**
   * Custom events carry the same controlled context as a pageview. The context
   * is spread *last* on purpose: even if a caller somehow supplied
   * `page_location`, `page_title` or `page_referrer`, the safe values win, so
   * raw URL/title/referrer can never be attached to an event.
   */
  function sendEvent(
    name: string,
    params: EventParams,
    routeLabel: string,
    campaignScope: EventCampaignScope = "inherit",
  ): void {
    if (!started) return;
    push([
      "event",
      name,
      { ...params, ...eventCampaignParams(campaignScope), ...contextParams(routeLabel) },
    ]);
  }

  /**
   * Event-scoped campaign override. Deliberately *only* a clear, and
   * deliberately does not touch `campaignApplied`: values set in one scope do
   * not modify another, so the page's own campaign context survives untouched
   * and the next ordinary event still inherits it. When no campaign is applied
   * there is nothing to inherit, so nothing is sent - an event that never had a
   * campaign to shed stays clean rather than gaining three empty fields.
   *
   * What this cannot show locally: how Google's own attribution models treat an
   * empty campaign on a single event. Native acquisition reporting stays a
   * website #83 gate.
   */
  function eventCampaignParams(scope: EventCampaignScope): Record<string, unknown> {
    if (scope !== "clear" || !campaignApplied) return {};
    return { campaign_source: "", campaign_medium: "", campaign_name: "" };
  }

  return { start, stop, setCampaign, sendPageview, sendEvent, isStarted: () => started };
}
