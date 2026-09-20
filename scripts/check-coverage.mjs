#!/usr/bin/env node
// Coverage floor for `pnpm test:coverage:check` (wired into CI).
// Runs the suite under c8, reads the stable `coverage-summary.json`
// report, and fails on breaching thresholds.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const GLOBAL_FLOORS = { lines: 75, branches: 88, functions: 70 };

// Line floors for modules with dedicated regression suites. Deliberately a
// few points under current coverage so unrelated refactors don't trip the
// gate, while deletions of covered behavior do.
const FILE_FLOORS = new Map([
  ["src/api/cache/cache.ts", 90],
  ["src/api/cache/create-cached-client.ts", 95],
  ["src/api/cache/keys.ts", 95],
  ["src/bot/composers/lookups/syllabus/flow.ts", 95],
  ["src/bot/composers/shared/error-boundary.ts", 95],
  ["src/utils/attachment-download.ts", 95],
  ["src/utils/file-utils.ts", 95],
  ["src/workers/announcements/notify/audience.ts", 95],
  ["src/workers/announcements/notify/orchestration.ts", 95],
  ["src/workers/attachment-delivery/worker.ts", 90],
  ["src/workers/broadcasts/worker.ts", 95],
  ["src/workers/data-sync/syncers/base.ts", 95],
  ["src/workers/data-sync/worker.ts", 90],
  ["src/workers/shared/recurring-schedules.ts", 95],
  ["src/workers/shared/worker-shutdown.ts", 95],
]);

const run = spawnSync(
  "pnpm",
  [
    "exec",
    "c8",
    "--reporter=json-summary",
    "--reports-dir=coverage",
    "node",
    "--import",
    "tsx",
    "--import",
    "./tests/setup.ts",
    "--test",
    "tests/**/*.test.ts",
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
);
process.stdout.write(run.stdout);
process.stderr.write(run.stderr);
if (run.status !== 0) {
  console.error("coverage check failed: test suite did not pass");
  process.exit(run.status ?? 1);
}

let summary;
try {
  summary = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8"));
} catch {
  console.error("coverage check failed: coverage-summary.json not found");
  process.exit(1);
}

const byRelativePath = new Map(
  Object.entries(summary)
    .filter(([path]) => path !== "total")
    .map(([path, entry]) => [relative(process.cwd(), path), entry])
);

const failures = [];
const total = summary.total;
for (const [metric, floor] of Object.entries(GLOBAL_FLOORS)) {
  const pct = total[metric]?.pct;
  if (pct === undefined) failures.push(`global ${metric}: not reported`);
  else if (pct < floor) failures.push(`global ${metric}: ${pct}% < ${floor}%`);
}
for (const [path, floor] of FILE_FLOORS) {
  const pct = byRelativePath.get(path)?.lines?.pct;
  if (pct === undefined) failures.push(`missing from report: ${path}`);
  else if (pct < floor) failures.push(`${path}: ${pct}% lines < ${floor}%`);
}

if (failures.length > 0) {
  console.error("\ncoverage floor breached:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `\ncoverage floor holds: lines ${total.lines.pct}% / branches ${total.branches.pct}% / functions ${total.functions.pct}%`
);
