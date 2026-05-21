/**
 * Privacy-conscious analytics (issue #15).
 *
 * Provider-agnostic: supports Plausible and/or Google Analytics 4, selected
 * purely by which env vars are set. With none set, analytics is fully disabled —
 * no script is injected and every call is a silent no-op. No personally
 * identifiable information is ever sent; callers pass only safe metadata
 * (location, link type, service name).
 *
 *   VITE_PLAUSIBLE_DOMAIN     site/data-domain registered in Plausible
 *   VITE_PLAUSIBLE_API_HOST   optional; self-hosted host (default https://plausible.io)
 *   VITE_GA4_MEASUREMENT_ID   GA4 measurement id, format G-XXXXXXXXXX
 */

type EventProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: ((event: string, options?: { props?: EventProps; callback?: () => void }) => void) & {
      q?: unknown[];
    };
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN || "";
const PLAUSIBLE_API_HOST = import.meta.env.VITE_PLAUSIBLE_API_HOST || "https://plausible.io";
const GA4_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID || "";

const plausibleEnabled = Boolean(PLAUSIBLE_DOMAIN);
const ga4Enabled = Boolean(GA4_ID);

function appendScript(src: string, attrs: Record<string, string> = {}) {
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.defer = true;
  for (const [key, value] of Object.entries(attrs)) {
    script.setAttribute(key, value);
  }
  document.head.appendChild(script);
}

function initPlausible() {
  // Queue stub so trackEvent() calls before the script loads aren't lost.
  window.plausible =
    window.plausible ||
    function (...args: unknown[]) {
      (window.plausible!.q = window.plausible!.q || []).push(args);
    };
  // script.js auto-captures pageviews, including SPA History API navigations.
  appendScript(`${PLAUSIBLE_API_HOST}/js/script.js`, { "data-domain": PLAUSIBLE_DOMAIN });
}

function initGa4() {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function (...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  appendScript(`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`);
  window.gtag("js", new Date());
  // Disable auto pageview; SPA route changes are sent manually via trackPageview.
  window.gtag("config", GA4_ID, { send_page_view: false });
}

/** Inject configured provider scripts. Safe to call once at app startup. */
export function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    if (plausibleEnabled) initPlausible();
    if (ga4Enabled) initGa4();
  } catch {
    // Analytics must never break the app.
  }
}

/** Fire a custom event to whichever provider(s) are configured. No-op otherwise. */
export function trackEvent(name: string, props?: EventProps) {
  try {
    if (plausibleEnabled) {
      window.plausible?.(name, props ? { props } : undefined);
    }
    if (ga4Enabled) {
      window.gtag?.("event", name, props ?? {});
    }
  } catch {
    // Never let a tracking call interrupt a click or submit.
  }
}

/**
 * Record a pageview for an SPA route change. GA4 only — Plausible's script.js
 * auto-captures History API navigations, so sending it here would double count.
 */
export function trackPageview(path?: string) {
  if (!ga4Enabled) return;
  try {
    window.gtag?.("event", "page_view", {
      page_path: path ?? window.location.pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  } catch {
    // No-op on failure.
  }
}
