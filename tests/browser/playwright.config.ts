/**
 * Local-only browser fixtures for issue #161.
 *
 * Three loopback servers, all started by this configuration:
 *
 *   1. the repository's Vite dev server in `measurement-fixture` mode - the
 *      only one where the measurement path is eligible at all;
 *   2. the same dev server in *production* mode carrying an ambient
 *      `VITE_GA4_MEASUREMENT_ID`;
 *   3. a real `vite build` artifact of that same production configuration,
 *      served by `vite preview`.
 *
 * (2) and (3) are different evidence: (2) exercises production *mode* through
 * the dev pipeline, (3) exercises the actual compiled bundle that a deployment
 * would serve. Neither is evidence about the live Vercel project, whose
 * environment this build has not inspected.
 *
 * Nothing here reaches the network: the fixtures block every remote request
 * from the context before the first navigation, and the measurement fixture
 * path itself refuses to run on any non-loopback host.
 *
 * `reuseExistingServer` is off everywhere on purpose. Reusing whatever happens
 * to be listening on a port would let an unrelated local server silently
 * satisfy a gate test; failing to start is the safe outcome.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = 4317;
const BASE_URL = `http://127.0.0.1:${PORT}`;
// A second, production-mode server carrying an ambient measurement id, used to
// show that the production configuration activates nothing.
const AMBIENT_PORT = 4318;
const AMBIENT_URL = `http://127.0.0.1:${AMBIENT_PORT}`;
// A third server, serving a real compiled build of that same configuration.
const ARTIFACT_PORT = 4319;
const ARTIFACT_URL = `http://127.0.0.1:${ARTIFACT_PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "../../test-results/measurement-browser",
  use: {
    baseURL: BASE_URL,
    // No browser-level proxying, no video, no trace upload. Screenshots are
    // taken explicitly by the specs that need them.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "desktop-1440",
      testIgnore: /production-(gate|artifact)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-390",
      testIgnore: /production-(gate|artifact)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false },
    },
    {
      name: "narrow-320",
      testIgnore: /production-(gate|artifact)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 720 }, isMobile: false },
    },
    {
      name: "production-gate",
      testMatch: /production-gate\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        baseURL: AMBIENT_URL,
      },
    },
    {
      // The same assertions against the compiled artifact rather than the dev
      // pipeline, so the gate is shown to survive a real production build.
      name: "production-artifact",
      testMatch: /production-artifact\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        baseURL: ARTIFACT_URL,
      },
    },
  ],
  webServer: [
    {
      command: "npm run dev:measurement-fixture",
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "npm run dev:measurement-ambient-check",
      url: AMBIENT_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      // Build first, then serve exactly what was built.
      command:
        "npm run build:measurement-ambient-check && npm run preview:measurement-ambient-check",
      url: ARTIFACT_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
