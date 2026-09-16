/**
 * The tag transport seam — the only faked layer in the fixture build.
 *
 * Everything above this file (consent sequencing, `consent` defaults/updates,
 * `config`, campaign context, the documented `ga-disable` opt-out, cookie
 * cleanup, queue invalidation) is the real adapter. This module decides only
 * *how the tag arrives*: a real `<script>` request on the live path, or a
 * locally installed inert fake on the fixture path. Fixture runs therefore
 * exercise the actual adapter without a Google request ever being made.
 */

export type TagLoadRequest = {
  src: string;
  measurementId: string;
  /** Load generation. A stale generation's callbacks must be ignored. */
  generation: number;
  onLoad: () => void;
  onError: () => void;
};

export type TagLoader = (request: TagLoadRequest) => { remove: () => void };

/** Global hook a local fixture installs *before* navigation. Never set in production. */
export const FIXTURE_TAG_GLOBAL = "__FEMME_MEASUREMENT_FIXTURE_TAG__";

type FixtureTagInstaller = (request: TagLoadRequest) => (() => void) | void;

/**
 * Live loader. Reachable only when `MEASUREMENT_ACTIVATION_APPROVED` is turned
 * on in `activation.ts` under website #83 — never from an environment value.
 */
export const scriptTagLoader: TagLoader = (request) => {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) {
    request.onError();
    return { remove: () => {} };
  }
  const script = doc.createElement("script");
  script.async = true;
  script.src = request.src;
  script.addEventListener("load", () => request.onLoad());
  script.addEventListener("error", () => request.onError());
  doc.head.appendChild(script);
  return {
    remove: () => {
      script.parentNode?.removeChild(script);
    },
  };
};

/**
 * Fixture loader. Hands the request to a locally installed inert tag. If no
 * fixture tag is installed nothing is requested and the load fails closed — a
 * fixture build can never silently fall through to a network request.
 */
export const fixtureTagLoader: TagLoader = (request) => {
  const installer = (globalThis as Record<string, unknown>)[FIXTURE_TAG_GLOBAL] as
    | FixtureTagInstaller
    | undefined;
  if (typeof installer !== "function") {
    request.onError();
    return { remove: () => {} };
  }
  const teardown = installer(request);
  return {
    remove: () => {
      if (typeof teardown === "function") teardown();
    },
  };
};

export function resolveTagLoader(mode: "disabled" | "fixture" | "live"): TagLoader | null {
  if (mode === "fixture") return fixtureTagLoader;
  if (mode === "live") return scriptTagLoader;
  return null;
}
