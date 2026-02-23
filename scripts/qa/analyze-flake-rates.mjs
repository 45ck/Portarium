#!/usr/bin/env node
/**
 * scripts/qa/analyze-flake-rates.mjs
 *
 * Analyzes Playwright test results for flakiness and manages the quarantine list.
 *
 * Workflow:
 *   1. Each CI run emits a JSON results file via PLAYWRIGHT_JSON_OUTPUT env var.
 *   2. This script reads that JSON, extracts flake events, and appends to the
 *      30-day rolling history at reports/flake-history.jsonl.
 *   3. With --report: prints per-test flake rates for the last 30 days.
 *   4. With --update-quarantine: writes tests with >5% flake rate to e2e/quarantine.json.
 *   5. With --check: exits non-zero if any unquarantined test exceeds the threshold.
 *
 * Usage:
 *   # Record results from latest run (run after playwright):
 *   PLAYWRIGHT_JSON_OUTPUT=playwright-results.json npx playwright test ...
 *   node scripts/qa/analyze-flake-rates.mjs --record playwright-results.json
 *
 *   # Report current flake rates:
 *   node scripts/qa/analyze-flake-rates.mjs --report
 *
 *   # Auto-quarantine flaky tests (updates e2e/quarantine.json):
 *   node scripts/qa/analyze-flake-rates.mjs --update-quarantine
 *
 *   # CI gate — fail if unquarantined flaky tests exceed threshold:
 *   node scripts/qa/analyze-flake-rates.mjs --check
 *
 * Bead: bead-0830
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const HISTORY_PATH = resolve(REPO_ROOT, 'reports/flake-history.jsonl');
const QUARANTINE_PATH = resolve(REPO_ROOT, 'e2e/quarantine.json');

/** Flake threshold: tests with flake rate above this get quarantined */
const FLAKE_THRESHOLD_PCT = 5;

/** Rolling window: only consider runs within this many days */
const ROLLING_DAYS = 30;

const args = process.argv.slice(2);
const MODE_RECORD = args.includes('--record') ? args[args.indexOf('--record') + 1] : null;
const MODE_REPORT = args.includes('--report');
const MODE_UPDATE_QUARANTINE = args.includes('--update-quarantine');
const MODE_CHECK = args.includes('--check');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {{ title: string, file: string, project: string }} TestKey
 * @typedef {{ runId: string, ts: string, flaked: boolean, key: TestKey }} HistoryEntry
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadHistory() {
  if (!existsSync(HISTORY_PATH)) return [];
  return readFileSync(HISTORY_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function appendHistory(entries) {
  mkdirSync(dirname(HISTORY_PATH), { recursive: true });
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  appendFileSync(HISTORY_PATH, lines, 'utf8');
}

function loadQuarantine() {
  if (!existsSync(QUARANTINE_PATH)) return { tests: [] };
  try {
    return JSON.parse(readFileSync(QUARANTINE_PATH, 'utf8'));
  } catch {
    return { tests: [] };
  }
}

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - ROLLING_DAYS);
  return d.toISOString();
}

/**
 * From a Playwright JSON results file, extract a list of flake events.
 * A test is "flaked" if it was retried at least once but ultimately passed.
 */
function extractFlakeEvents(playwrightJson, runId) {
  const ts = new Date().toISOString();
  const events = [];

  for (const suite of playwrightJson.suites ?? []) {
    for (const spec of suite.specs ?? []) {
      const file = suite.file ?? '';
      const title = spec.title ?? '';
      for (const result of spec.tests ?? []) {
        const project = result.projectName ?? 'unknown';
        const results = result.results ?? [];
        const flaked =
          results.length > 1 &&
          results.at(-1)?.status === 'passed' &&
          results.some((r) => r.status !== 'passed');
        events.push({
          runId,
          ts,
          flaked,
          key: { title, file, project },
        });
      }
    }
  }
  return events;
}

/**
 * Calculate flake rate per (title, file) pair.
 * Returns Map<key, { runs: number, flakes: number, rate: number }>
 */
function calculateFlakeRates(history) {
  const cutoff = cutoffDate();
  const recent = history.filter((e) => e.ts >= cutoff);
  const stats = new Map();

  for (const entry of recent) {
    const key = `${entry.key.file}::${entry.key.title}`;
    if (!stats.has(key)) {
      stats.set(key, { title: entry.key.title, file: entry.key.file, runs: 0, flakes: 0 });
    }
    const s = stats.get(key);
    s.runs++;
    if (entry.flaked) s.flakes++;
  }

  for (const s of stats.values()) {
    s.rate = s.runs > 0 ? (s.flakes / s.runs) * 100 : 0;
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function recordResults(jsonPath) {
  const absPath = resolve(process.cwd(), jsonPath);
  if (!existsSync(absPath)) {
    process.stderr.write(`[analyze-flake] File not found: ${absPath}\n`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (e) {
    process.stderr.write(`[analyze-flake] Failed to parse JSON: ${e.message}\n`);
    process.exit(1);
  }

  const runId = `run-${Date.now()}`;
  const events = extractFlakeEvents(data, runId);
  appendHistory(events);

  const flaked = events.filter((e) => e.flaked);
  process.stdout.write(
    `[analyze-flake] Recorded ${events.length} test results, ${flaked.length} flake event(s) (runId=${runId})\n`,
  );
}

function report() {
  const history = loadHistory();
  if (history.length === 0) {
    process.stdout.write('[analyze-flake] No history found. Run with --record first.\n');
    return;
  }

  const rates = calculateFlakeRates(history);
  const sorted = [...rates.values()].sort((a, b) => b.rate - a.rate);

  process.stdout.write(`\nFlake Rate Report (last ${ROLLING_DAYS} days)\n`);
  process.stdout.write('─'.repeat(60) + '\n');

  let anyAboveThreshold = false;
  for (const s of sorted) {
    const flag = s.rate >= FLAKE_THRESHOLD_PCT ? ' ⚠ FLAKY' : '';
    if (s.rate >= FLAKE_THRESHOLD_PCT) anyAboveThreshold = true;
    process.stdout.write(
      `  ${s.rate.toFixed(1).padStart(5)}%  ${s.flakes}/${s.runs}  ${s.file} › ${s.title}${flag}\n`,
    );
  }

  if (!anyAboveThreshold) {
    process.stdout.write(`\n✓ No tests exceed ${FLAKE_THRESHOLD_PCT}% flake threshold.\n`);
  }

  // Write flake badge data
  const overallFlakeRate =
    sorted.length > 0 ? sorted.reduce((sum, s) => sum + s.rate, 0) / sorted.length : 0;
  writeFlakyBadge(overallFlakeRate);
}

function writeFlakyBadge(flakeRate) {
  const badgePath = resolve(REPO_ROOT, 'reports/flake-badge.json');
  mkdirSync(dirname(badgePath), { recursive: true });

  const color = flakeRate < 1 ? 'brightgreen' : flakeRate < 5 ? 'yellow' : 'red';
  const badge = {
    schemaVersion: 1,
    label: 'flake rate',
    message: `${flakeRate.toFixed(1)}%`,
    color,
    namedLogo: 'playwright',
  };
  writeFileSync(badgePath, JSON.stringify(badge, null, 2) + '\n', 'utf8');
  process.stdout.write(
    `[analyze-flake] Badge written → reports/flake-badge.json (${flakeRate.toFixed(1)}%)\n`,
  );
}

function updateQuarantine() {
  const history = loadHistory();
  const rates = calculateFlakeRates(history);
  const quarantine = loadQuarantine();

  const existingTitles = new Set(quarantine.tests.map((t) => t.title));
  const toAdd = [];

  for (const s of rates.values()) {
    if (s.rate >= FLAKE_THRESHOLD_PCT && !existingTitles.has(s.title)) {
      toAdd.push({
        title: s.title,
        file: s.file,
        quarantinedAt: new Date().toISOString().slice(0, 10),
        reason: `Auto-quarantined: ${s.rate.toFixed(1)}% flake rate (${s.flakes}/${s.runs} runs over ${ROLLING_DAYS}d)`,
      });
    }
  }

  if (toAdd.length === 0) {
    process.stdout.write('[analyze-flake] No new tests to quarantine.\n');
    return;
  }

  quarantine.tests.push(...toAdd);
  writeFileSync(QUARANTINE_PATH, JSON.stringify(quarantine, null, 2) + '\n', 'utf8');
  process.stdout.write(`[analyze-flake] Quarantined ${toAdd.length} test(s):\n`);
  for (const t of toAdd) {
    process.stdout.write(`  - ${t.file} › ${t.title}\n`);
  }
}

function check() {
  const history = loadHistory();
  const rates = calculateFlakeRates(history);
  const quarantine = loadQuarantine();
  const quarantinedTitles = new Set(quarantine.tests.map((t) => t.title));

  const flaky = [...rates.values()].filter(
    (s) => s.rate >= FLAKE_THRESHOLD_PCT && !quarantinedTitles.has(s.title),
  );

  if (flaky.length > 0) {
    process.stderr.write(
      `[analyze-flake] ${flaky.length} unquarantined test(s) exceed ${FLAKE_THRESHOLD_PCT}% flake threshold:\n`,
    );
    for (const s of flaky) {
      process.stderr.write(`  - ${s.file} › ${s.title} (${s.rate.toFixed(1)}%)\n`);
    }
    process.stderr.write(`\nRun: node scripts/qa/analyze-flake-rates.mjs --update-quarantine\n`);
    process.exit(1);
  }

  process.stdout.write(
    `[analyze-flake] OK — no unquarantined tests exceed ${FLAKE_THRESHOLD_PCT}% threshold.\n`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (MODE_RECORD) {
  recordResults(MODE_RECORD);
} else if (MODE_REPORT) {
  report();
} else if (MODE_UPDATE_QUARANTINE) {
  updateQuarantine();
} else if (MODE_CHECK) {
  check();
} else {
  process.stderr.write(
    'Usage: node scripts/qa/analyze-flake-rates.mjs --record <json> | --report | --update-quarantine | --check\n',
  );
  process.exit(1);
}
