/**
 * Back/forward-cache fixture for the cross-document arrival regression
 * (issue #161, finding A-R1).
 *
 * What is real here: the application. The worker compiles the repository's own
 * `measurement-fixture` build — the React inquiry form, the measurement runtime
 * and the inquiry submitter, unmodified — and serves it from a loopback server
 * owned by this file. The Vite dev server is not used: its HMR socket is not
 * part of the app and can keep a document out of the back/forward cache.
 *
 * What is modelled: the two endpoints the app would otherwise reach.
 *   - The tag is the existing inert `inert-tag.js`, served as an ordinary script
 *     ahead of the app bundle.
 *   - The inquiry endpoint is a same-origin loopback path on this server, which
 *     is one of the endpoints `isInertFixtureEndpoint` already accepts. It
 *     holds the response until the spec releases it, so "Back before the
 *     response" and "response while away" are orderings, not sleeps.
 *
 * What is deliberately absent: Playwright route interception and init scripts.
 * Nothing sits between the page and the network stack that could change whether
 * the browser caches the document. Confinement comes from the browser instead:
 * every non-loopback hostname is made unresolvable at launch, and any remote
 * request that finished anyway fails the test.
 *
 * Playwright disables the back/forward cache by default. `BFCACHE_LAUNCH` takes
 * that flag back out; the specs then assert the `persisted` flags the documents
 * actually saw, so a run that did not achieve a cache restore fails.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { INERT_TAG_SCRIPT } from "./measurement.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..", "..");

/**
 * The tree the app is compiled from. Always this repository, unless a
 * sensitivity run points it at a scratch copy of an earlier head to show the
 * same, unweakened spec failing there. It is reported on every test.
 */
export const APP_ROOT = path.resolve(process.env.FEMME_BFCACHE_APP_ROOT || REPO_ROOT);

/** Same-origin, so provably inert: it can only ever reach this loopback server. */
export const INQUIRY_ENDPOINT_PATH = "/__fixture/formspree/f/local-inert-fixture";

export const BFCACHE_LAUNCH = {
  // Installed Chrome in new-headless mode is the configuration the parent
  // mechanism probe restored documents with. Overridable, never skippable.
  channel: process.env.FEMME_BFCACHE_CHANNEL || "chrome",
  // "block" is implemented as an init script, and this file uses none. The app
  // registers no service worker.
  serviceWorkers: "allow" as const,
  launchOptions: {
    ignoreDefaultArgs: ["--disable-back-forward-cache"],
    args: ["--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"],
  },
};

const LIFECYCLE_RECORDER = `(() => {
  const navigationType = () => {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry ? entry.type : null;
  };
  // Lives in this document's own heap: it is still here after Back only if the
  // document itself was restored rather than loaded again.
  const record = { token: String(Date.now()) + "-" + String(Math.random()).slice(2), events: [] };
  window.__FEMME_BFCACHE_DOCUMENT__ = record;
  const log = (type) => (event) =>
    record.events.push({
      type,
      persisted: event.persisted === true,
      at: Date.now(),
      navigationType: navigationType(),
      url: location.pathname + location.search,
    });
  addEventListener("pageshow", log("pageshow"));
  addEventListener("pagehide", log("pagehide"));
})();`;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

export type InquiryExchange = {
  body: Record<string, string>;
  receivedAt: number;
  /** When the accepted response was fully written, or `null` while held. */
  respondedAt: number | null;
};

export type BfcacheApp = {
  origin: string;
  appRoot: string;
  /** Every POST the inquiry endpoint received, in order. */
  exchanges: InquiryExchange[];
  /** Forgets earlier exchanges. Anything still held is answered 503 first. */
  reset: () => void;
  waitForExchanges: (count: number, timeoutMs?: number) => Promise<void>;
  /** Accepts every held inquiry and resolves once the responses are written. */
  releaseHeld: () => Promise<void>;
};

export type DocumentLifecycleEvent = {
  type: "pageshow" | "pagehide";
  persisted: boolean;
  at: number;
  navigationType: string | null;
  url: string;
};

export type DocumentRecord = { token: string; events: DocumentLifecycleEvent[] };

/**
 * `vite build --mode measurement-fixture`, the repository's own build, run the
 * way `npm run build` runs it. The only difference from the fixture env file is
 * the inquiry endpoint, which an explicit process value outranks; it is set on
 * the child alone, so this worker's environment is untouched.
 */
function compileFixtureApp(outDir: string): void {
  const viteBin = path.join(
    path.dirname(createRequire(import.meta.url).resolve("vite/package.json")),
    "bin",
    "vite.js",
  );
  const env: NodeJS.ProcessEnv = { ...process.env, VITE_FORMSPREE_ENDPOINT: INQUIRY_ENDPOINT_PATH };
  // A test runner's NODE_ENV must not turn this into a development build.
  delete env.NODE_ENV;
  const result = spawnSync(
    process.execPath,
    [
      viteBin,
      "build",
      "--mode",
      "measurement-fixture",
      "--outDir",
      outDir,
      "--emptyOutDir",
      "--logLevel",
      "error",
    ],
    { cwd: APP_ROOT, env, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error("The measurement-fixture build failed:\n" + result.stdout + result.stderr);
  }
}

function readJsonBody(request: http.IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, string>);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function startServer(distDir: string): Promise<{ app: BfcacheApp; close: () => Promise<void> }> {
  const indexHtml = readFileSync(path.join(distDir, "index.html"), "utf8").replace(
    /<head([^>]*)>/i,
    '<head$1><script src="/__fixture/inert-tag.js"></script><script src="/__fixture/lifecycle-recorder.js"></script>',
  );
  if (!indexHtml.includes("/__fixture/inert-tag.js")) {
    throw new Error("The compiled index.html has no <head> to install the inert tag into.");
  }

  let exchanges: InquiryExchange[] = [];
  let held: { exchange: InquiryExchange; response: http.ServerResponse }[] = [];

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const send = (status: number, type: string, body: string | Buffer) => {
      // No `no-store`: that alone would keep a document out of the cache.
      response.writeHead(status, { "content-type": type, "cache-control": "no-cache" });
      response.end(body);
    };

    if (url.pathname === INQUIRY_ENDPOINT_PATH) {
      if (request.method !== "POST") return send(405, "application/json", '{"ok":false}');
      readJsonBody(request).then(
        (body) => {
          const exchange: InquiryExchange = { body, receivedAt: Date.now(), respondedAt: null };
          exchanges.push(exchange);
          held.push({ exchange, response });
        },
        () => send(400, "application/json", '{"ok":false}'),
      );
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") return send(405, "text/plain", "");
    if (url.pathname === "/__fixture/inert-tag.js") {
      return send(200, CONTENT_TYPES[".js"], readFileSync(INERT_TAG_SCRIPT));
    }
    if (url.pathname === "/__fixture/lifecycle-recorder.js") {
      return send(200, CONTENT_TYPES[".js"], LIFECYCLE_RECORDER);
    }

    let candidate: string;
    try {
      candidate = path.normalize(path.join(distDir, decodeURIComponent(url.pathname)));
    } catch {
      return send(400, "text/plain", "");
    }
    const isAsset =
      candidate.startsWith(distDir + path.sep) &&
      candidate !== path.join(distDir, "index.html") &&
      existsSync(candidate) &&
      statSync(candidate).isFile();
    if (isAsset) {
      const type = CONTENT_TYPES[path.extname(candidate).toLowerCase()] ?? "application/octet-stream";
      response.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
      createReadStream(candidate).pipe(response);
      return;
    }
    // A missing asset is a 404; every other path is the single-page app, the
    // same rewrite `vercel.json` applies.
    if (path.extname(url.pathname) !== "" && url.pathname !== "/index.html") {
      return send(404, "text/plain", "");
    }
    return send(200, CONTENT_TYPES[".html"], indexHtml);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;

  const answer = (entry: (typeof held)[number], status: number): Promise<void> =>
    new Promise((resolve) => {
      entry.response.writeHead(status, { "content-type": "application/json" });
      entry.response.end(JSON.stringify({ ok: status < 400 }), () => {
        entry.exchange.respondedAt = Date.now();
        resolve();
      });
    });

  const app: BfcacheApp = {
    origin: `http://127.0.0.1:${port}`,
    appRoot: APP_ROOT,
    get exchanges() {
      return exchanges;
    },
    reset: () => {
      for (const entry of held) void answer(entry, 503);
      held = [];
      exchanges = [];
    },
    waitForExchanges: async (count, timeoutMs = 10_000) => {
      const deadline = Date.now() + timeoutMs;
      while (exchanges.length < count) {
        if (Date.now() > deadline) {
          throw new Error(`The inquiry endpoint saw ${exchanges.length} request(s), expected ${count}.`);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    },
    releaseHeld: async () => {
      const releasing = held;
      held = [];
      if (releasing.length === 0) throw new Error("There is no held inquiry to accept.");
      await Promise.all(releasing.map((entry) => answer(entry, 200)));
    },
  };

  return {
    app,
    close: () =>
      new Promise((resolve) => {
        app.reset();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

type WorkerFixtures = { bfcacheServer: BfcacheApp };
type TestFixtures = {
  bfcacheApp: BfcacheApp;
  /** Non-loopback requests that completed. Must stay empty. */
  remoteRequestsFinished: string[];
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  bfcacheServer: [
    async ({}, use) => {
      const distDir = mkdtempSync(path.join(os.tmpdir(), "femme-arrival-bfcache-"));
      let close: (() => Promise<void>) | null = null;
      try {
        compileFixtureApp(distDir);
        const started = await startServer(distDir);
        close = started.close;
        await use(started.app);
      } finally {
        await close?.();
        rmSync(distDir, { recursive: true, force: true });
      }
    },
    { scope: "worker", timeout: 240_000 },
  ],
  bfcacheApp: async ({ bfcacheServer }, use, testInfo) => {
    bfcacheServer.reset();
    testInfo.annotations.push({ type: "app-root", description: bfcacheServer.appRoot });
    await use(bfcacheServer);
    bfcacheServer.reset();
  },
  remoteRequestsFinished: async ({ page }, use) => {
    const finished: string[] = [];
    // Observation only. Nothing is intercepted, fulfilled or aborted.
    page.on("requestfinished", (request) => {
      const url = request.url();
      if (!/^https?:/i.test(url)) return;
      if (new URL(url).hostname !== "127.0.0.1") finished.push(url);
    });
    await use(finished);
  },
});

export { expect };

export async function documentRecord(page: Page): Promise<DocumentRecord | null> {
  return page.evaluate(
    () =>
      (window as unknown as { __FEMME_BFCACHE_DOCUMENT__?: DocumentRecord }).__FEMME_BFCACHE_DOCUMENT__ ?? null,
  );
}

/**
 * Why the browser says the previous document was not restored, when it says
 * anything. Diagnostic text for a failed `persisted` assertion, nothing more.
 */
export async function notRestoredReasons(page: Page): Promise<string> {
  return page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0] as
      | (PerformanceNavigationTiming & { notRestoredReasons?: unknown })
      | undefined;
    return JSON.stringify({
      navigationType: entry?.type ?? null,
      notRestoredReasons: entry?.notRestoredReasons ?? null,
    });
  });
}

export type StoredSource = { n: number; t: number; a: number; g: number; s: string; m: string; c: string };

/** The granted same-tab source record exactly as the app wrote it. */
export async function storedSource(page: Page): Promise<StoredSource | null> {
  return page.evaluate(() => {
    const raw = window.sessionStorage.getItem("femme.analytics.source.v1");
    return raw === null ? null : (JSON.parse(raw) as StoredSource);
  });
}

/**
 * A full same-tab forward navigation started by the page itself, the way a
 * followed link is, then a bounded wait for the new document's runtime to have
 * started its tag. `goto` is not used: it is a different kind of navigation and
 * it waits on a `load` this flow does not need.
 */
export async function followLinkToNewDocument(page: Page, url: string, leavingToken: string): Promise<void> {
  // The navigation this starts can tear the context down before the call
  // returns; the bounded predicate below is what decides whether it happened.
  await page.evaluate((next) => window.location.assign(next), url).catch(() => undefined);
  await page.waitForFunction(
    ({ next, leaving }) => {
      const record = (window as unknown as { __FEMME_BFCACHE_DOCUMENT__?: { token: string } })
        .__FEMME_BFCACHE_DOCUMENT__;
      const tag = (window as unknown as { __FEMME_MEASUREMENT_FIXTURE_STATE__?: { loaded: boolean } })
        .__FEMME_MEASUREMENT_FIXTURE_STATE__;
      return (
        window.location.pathname + window.location.search === next &&
        record !== undefined &&
        record.token !== leaving &&
        tag?.loaded === true
      );
    },
    { next: url, leaving: leavingToken },
    { timeout: 15_000 },
  );
}

/**
 * Back. A cache restore fires no new `load`, so this is `history.back()` plus a
 * bounded predicate on the URL and on the restored document having seen its
 * `pageshow` — whatever `persisted` turned out to be. The caller asserts that.
 */
export async function goBackTo(page: Page, url: string): Promise<void> {
  await page.evaluate(() => window.history.back()).catch(() => undefined);
  await page.waitForFunction(
    (expected) => {
      const record = (window as unknown as { __FEMME_BFCACHE_DOCUMENT__?: DocumentRecord })
        .__FEMME_BFCACHE_DOCUMENT__;
      if (window.location.pathname + window.location.search !== expected || !record) return false;
      const last = record.events.at(-1);
      return last !== undefined && last.type === "pageshow" && last.url === expected;
    },
    url,
    { timeout: 15_000 },
  );
}
