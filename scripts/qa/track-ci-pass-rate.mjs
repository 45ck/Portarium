#!/usr/bin/env node
/**
 * scripts/qa/track-ci-pass-rate.mjs
 *
 * Tracks CI run pass/fail rates over time. Appends the current run outcome to
 * reports/ci-pass-rate.jsonl and generates a summary badge.
 *
 * In CI: called automatically after the test suite to record the outcome.
 * Locally: run with --report to see the 30-day trend.
 *
 * Usage:
 *   # Record a CI run result (called from ci.yml after tests):
 *   node scripts/qa/track-ci-pass-rate.mjs --record --status passed --run-id $GITHUB_RUN_ID
 *   node scripts/qa/track-ci-pass-rate.mjs --record --status failed --run-id $GITHUB_RUN_ID
 *
 *   # Print pass-rate report:
 *   node scripts/qa/track-ci-pass-rate.mjs --report
 *
 *   # Write shields.io badge JSON (called in reports step):
 *   node scripts/qa/track-ci-pass-rate.mjs --badge
 *
 * Bead: bead-0825
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const HISTORY_PATH = resolve(REPO_ROOT, 'reports/ci-pass-rate.jsonl');
const BADGE_PATH = resolve(REPO_ROOT, 'reports/ci-pass-rate-badge.json');

const ROLLING_DAYS = 30;

const args = process.argv.slice(2);

function getArg(flag, fallback = null) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? (args[idx + 1] ?? fallback) : fallback;
}

const MODE_RECORD = args.includes('--record');
const MODE_REPORT = args.includes('--report');
const MODE_BADGE = args.includes('--badge');
const STATUS = getArg('--status'); // 'passed' | 'failed'
const RUN_ID = getArg('--run-id', `local-${Date.now()}`);
const BRANCH = getArg('--branch', process.env['GITHUB_REF_NAME'] ?? 'main');

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

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - ROLLING_DAYS);
  return d.toISOString();
}

function calculatePassRate(history) {
  const cutoff = cutoffDate();
  const recent = history.filter((e) => e.ts >= cutoff && e.branch === 'main');
  if (recent.length === 0) return null;
  const passed = recent.filter((e) => e.status === 'passed').length;
  return { runs: recent.length, passed, rate: (passed / recent.length) * 100 };
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function record() {
  if (!STATUS || !['passed', 'failed'].includes(STATUS)) {
    process.stderr.write(`[track-ci] --status must be 'passed' or 'failed'\n`);
    process.exit(1);
  }

  const entry = {
    runId: RUN_ID,
    ts: new Date().toISOString(),
    branch: BRANCH,
    status: STATUS,
  };

  mkdirSync(dirname(HISTORY_PATH), { recursive: true });
  appendFileSync(HISTORY_PATH, JSON.stringify(entry) + '\n', 'utf8');
  process.stdout.write(`[track-ci] Recorded: ${STATUS} (runId=${RUN_ID}, branch=${BRANCH})\n`);

  // Auto-write badge on each record
  writeBadge();
}

function report() {
  const history = loadHistory();
  const stats = calculatePassRate(history);

  process.stdout.write(`\nCI Pass Rate Report (last ${ROLLING_DAYS} days, main branch)\n`);
  process.stdout.write('─'.repeat(50) + '\n');

  if (!stats) {
    process.stdout.write('  No data recorded yet.\n');
    return;
  }

  process.stdout.write(
    `  Pass rate: ${stats.rate.toFixed(1)}% (${stats.passed}/${stats.runs} runs)\n`,
  );

  const color = stats.rate >= 95 ? '✓ GREEN' : stats.rate >= 80 ? '~ YELLOW' : '✗ RED';
  process.stdout.write(`  Status: ${color}\n`);
}

function writeBadge() {
  const history = loadHistory();
  const stats = calculatePassRate(history);

  const message = stats ? `${stats.rate.toFixed(0)}%` : 'N/A';
  const color = !stats
    ? 'lightgrey'
    : stats.rate >= 95
      ? 'brightgreen'
      : stats.rate >= 80
        ? 'yellow'
        : 'red';

  const badge = {
    schemaVersion: 1,
    label: 'CI pass rate',
    message,
    color,
    namedLogo: 'githubactions',
  };

  mkdirSync(dirname(BADGE_PATH), { recursive: true });
  writeFileSync(BADGE_PATH, JSON.stringify(badge, null, 2) + '\n', 'utf8');
  process.stdout.write(`[track-ci] Badge written → ${BADGE_PATH} (${message})\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (MODE_RECORD) {
  record();
} else if (MODE_REPORT) {
  report();
} else if (MODE_BADGE) {
  writeBadge();
} else {
  process.stderr.write(
    'Usage: node scripts/qa/track-ci-pass-rate.mjs\n' +
      '  --record --status <passed|failed> [--run-id <id>] [--branch <name>]\n' +
      '  --report\n' +
      '  --badge\n',
  );
  process.exit(1);
}
