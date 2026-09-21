#!/usr/bin/env node
/**
 * Focused measurement test runner (issue #161).
 *
 * Runs `tests/measurement/**\/*.test.ts` on Node's built-in test runner. Node
 * strips the TypeScript types directly, so this needs no bundler, no transform
 * step and no extra dependency; the relative imports inside `src/lib/measurement`
 * carry explicit `.ts` extensions for exactly that reason.
 *
 * Browser fixtures are a separate command: `npm run test:measurement:browser`.
 */

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDir = path.join(repoRoot, "tests", "measurement");

function collect(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collect(full));
    else if (entry.name.endsWith(".test.ts")) found.push(full);
  }
  return found.sort();
}

const files = collect(testDir).map((file) => path.relative(repoRoot, file));
if (files.length === 0) {
  console.error("No measurement tests found in tests/measurement.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=spec", "--disable-warning=ExperimentalWarning", ...files],
  { cwd: repoRoot, stdio: "inherit" },
);

process.exit(result.status ?? 1);
