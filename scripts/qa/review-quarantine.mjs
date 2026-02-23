#!/usr/bin/env node
/**
 * scripts/qa/review-quarantine.mjs
 *
 * Weekly quarantine review: lists all quarantined tests with their age,
 * current flake rate (from history), and a recommendation.
 *
 * Outputs:
 *   - Tests that have been fixed (no recent flakes) — safe to un-quarantine
 *   - Tests that are still flaky but improving
 *   - Tests that remain persistently flaky — consider deletion/rewrite
 *
 * Usage:
 *   node scripts/qa/review-quarantine.mjs
 *   node scripts/qa/review-quarantine.mjs --unquarantine <title>
 *
 * Bead: bead-0830
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const HISTORY_PATH = resolve(REPO_ROOT, 'reports/flake-history.jsonl');
const QUARANTINE_PATH = resolve(REPO_ROOT, 'e2e/quarantine.json');

const ROLLING_DAYS = 30;
const SAFE_TO_UNQUARANTINE_THRESHOLD_PCT = 1; // <1% flake rate over last 30d = safe to remove

const args = process.argv.slice(2);
const UNQUARANTINE_TITLE = args.includes('--unquarantine')
  ? args[args.indexOf('--unquarantine') + 1]
  : null;

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

function calculateFlakeRate(history, title) {
  const cutoff = cutoffDate();
  const recent = history.filter((e) => e.ts >= cutoff && e.key?.title === title);
  if (recent.length === 0) return null;
  const flakes = recent.filter((e) => e.flaked).length;
  return { runs: recent.length, flakes, rate: (flakes / recent.length) * 100 };
}

function daysSince(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function unquarantineByTitle(title) {
  const quarantine = loadQuarantine();
  const before = quarantine.tests.length;
  quarantine.tests = quarantine.tests.filter((t) => t.title !== title);
  const after = quarantine.tests.length;

  if (before === after) {
    process.stderr.write(`[review-quarantine] Test not found in quarantine: "${title}"\n`);
    process.exit(1);
  }

  writeFileSync(QUARANTINE_PATH, JSON.stringify(quarantine, null, 2) + '\n', 'utf8');
  process.stdout.write(`[review-quarantine] Removed from quarantine: "${title}"\n`);
}

function review() {
  const quarantine = loadQuarantine();
  const history = loadHistory();

  if (quarantine.tests.length === 0) {
    process.stdout.write('[review-quarantine] No quarantined tests.\n');
    return;
  }

  process.stdout.write(`\nQuarantine Review — ${quarantine.tests.length} test(s)\n`);
  process.stdout.write('─'.repeat(70) + '\n');

  const safeToRemove = [];
  const stillFlaky = [];
  const noData = [];

  for (const test of quarantine.tests) {
    const age = daysSince(test.quarantinedAt);
    const stats = calculateFlakeRate(history, test.title);

    if (!stats) {
      noData.push({ test, age });
    } else if (stats.rate < SAFE_TO_UNQUARANTINE_THRESHOLD_PCT) {
      safeToRemove.push({ test, age, stats });
    } else {
      stillFlaky.push({ test, age, stats });
    }
  }

  if (safeToRemove.length > 0) {
    process.stdout.write('\n✓ SAFE TO UN-QUARANTINE (flake rate <1% over last 30d):\n');
    for (const { test, age, stats } of safeToRemove) {
      process.stdout.write(
        `  ${test.file} › ${test.title}\n` +
          `    Quarantined ${age}d ago | Rate: ${stats.rate.toFixed(1)}% (${stats.flakes}/${stats.runs} runs)\n` +
          `    Reason: ${test.reason}\n` +
          `    → node scripts/qa/review-quarantine.mjs --unquarantine "${test.title}"\n\n`,
      );
    }
  }

  if (stillFlaky.length > 0) {
    process.stdout.write('\n⚠ STILL FLAKY:\n');
    for (const { test, age, stats } of stillFlaky) {
      const recommendation =
        age > 30 ? '(persistent — consider rewrite or deletion)' : '(recently quarantined)';
      process.stdout.write(
        `  ${test.file} › ${test.title}\n` +
          `    Quarantined ${age}d ago ${recommendation}\n` +
          `    Rate: ${stats.rate.toFixed(1)}% (${stats.flakes}/${stats.runs} runs)\n` +
          `    Reason: ${test.reason}\n\n`,
      );
    }
  }

  if (noData.length > 0) {
    process.stdout.write('\n? NO RECENT RUN DATA:\n');
    for (const { test, age } of noData) {
      process.stdout.write(`  ${test.file} › ${test.title} (quarantined ${age}d ago)\n`);
    }
    process.stdout.write(
      '  → Run test suite with PLAYWRIGHT_JSON_OUTPUT=playwright-results.json\n',
    );
    process.stdout.write(
      '    then: node scripts/qa/analyze-flake-rates.mjs --record playwright-results.json\n\n',
    );
  }

  process.stdout.write(
    `Summary: ${safeToRemove.length} safe-to-remove, ${stillFlaky.length} still flaky, ${noData.length} no data\n`,
  );
}

if (UNQUARANTINE_TITLE) {
  unquarantineByTitle(UNQUARANTINE_TITLE);
} else {
  review();
}
