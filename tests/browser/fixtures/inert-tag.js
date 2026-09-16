/*
 * Inert local tag for the browser fixtures (issue #161).
 *
 * Installed with `addInitScript` before any navigation, so the measurement
 * adapter's transport seam resolves to this instead of requesting Google. It
 * models only what the adapter's contract depends on: a drained `dataLayer`
 * backlog, `push` taken over on load, `window['ga-disable-<ID>']` consulted
 * immediately before every send and every cookie write, consent state, and a
 * provider-originated lifecycle ping that does not pass through the wrapper.
 *
 * It also models `config` parameter inheritance: parameters set by `config`
 * persist and are inherited by later events unless the event overrides them.
 * That is what lets a test see a stale or freshly captured campaign riding
 * along on an event that does not carry the fields itself. The model is a
 * simplification of real parameter scoping.
 *
 * It transmits nothing. Every "collection attempt" stays on `window` for the
 * test to read, so a fixture pass says nothing about real gtag.js behaviour.
 */
(() => {
  const state = {
    loadRequests: [],
    collected: [],
    suppressed: [],
    consentStates: [],
    configs: [],
    loaded: false,
    measurementId: "",
    analyticsGranted: false,
    /** Accumulated, still-active `config` parameters for the measurement id. */
    configState: {},
  };
  window.__FEMME_MEASUREMENT_FIXTURE_STATE__ = state;

  const disabled = () => window["ga-disable-" + state.measurementId] === true;

  const send = (name, params) => {
    // Event parameters win over inherited config parameters of the same name.
    const effective = Object.assign({}, state.configState, params);
    if (disabled()) {
      state.suppressed.push({ name, params, effective });
      return;
    }
    state.collected.push({ name, params, effective });
  };

  const writeCookies = () => {
    if (disabled() || !state.analyticsGranted) return;
    const container = state.measurementId.replace(/^G-/, "");
    document.cookie = "_ga=GA1.1.fixture.session; path=/";
    document.cookie = "_ga_" + container + "=GS1.1.fixture.session; path=/";
  };

  const process = (entry) => {
    if (!Array.isArray(entry)) return;
    const [command, a, b] = entry;
    if (command === "consent") {
      const next = b || {};
      state.consentStates.push(Object.assign({ mode: String(a) }, next));
      if (typeof next.analytics_storage === "string") {
        state.analyticsGranted = next.analytics_storage === "granted";
      }
      return;
    }
    if (command === "config") {
      const params = b || {};
      state.configs.push({ id: String(a), params: params });
      if (String(a) === state.measurementId) {
        state.configState = Object.assign({}, state.configState, params);
      }
      writeCookies();
      return;
    }
    if (command === "event") send(String(a), b || {});
  };

  window.__FEMME_MEASUREMENT_FIXTURE_TAG__ = (request) => {
    state.loadRequests.push({ src: request.src, generation: request.generation });
    state.measurementId = request.measurementId;
    if (state.loaded) {
      // Already executed: a repeat request (a re-grant in the same document)
      // resolves immediately.
      request.onLoad();
      return;
    }
    state.loaded = true;
    const backlog = Array.isArray(window.dataLayer) ? window.dataLayer.slice() : [];
    if (Array.isArray(window.dataLayer)) {
      // gtag.js owns `push` from here on: entries can no longer be un-queued.
      window.dataLayer.push = (...items) => {
        items.forEach(process);
        return 0;
      };
    }
    backlog.forEach(process);
    request.onLoad();
    return () => {
      // Removing the script element proves nothing on its own; the lifecycle
      // tick below is what shows the documented opt-out is consulted.
    };
  };

  window.__FEMME_FIXTURE_LIFECYCLE_TICK__ = () => {
    if (!state.loaded) return;
    send("user_engagement", { engagement_time_msec: 1000 });
  };

  // Never contact the business from a fixture run. Captured in the capture
  // phase so React's own click handler still fires on the way back up.
  window.__FEMME_FIXTURE_CONTACT_ATTEMPTS__ = [];
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (/^(tel:|mailto:)/i.test(href)) {
        window.__FEMME_FIXTURE_CONTACT_ATTEMPTS__.push(href);
        event.preventDefault();
      }
    },
    true,
  );
})();
