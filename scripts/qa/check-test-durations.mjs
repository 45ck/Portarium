#!/usr/bin/env node
/**
 * scripts/qa/check-test-durations.mjs
 *
 * Reads a Vitest JUnit XML report and flags tests that exceed a duration
 * threshold (default: 30 seconds). Outputs a JSON summary to
 * reports/test-durations.json for trend tracking.
 *
 * Usage:
 *   node scripts/qa/check-test-durations.mjs
 *   node scripts/qa/check-test-durations.mjs --check           # exit 1 if any test >30s
 *   node scripts/qa/check-test-durations.mjs --threshold 15    # custom threshold (seconds)
 *   node scripts/qa/check-test-durations.mjs --input path/to/junit.xml
 *
 * Bead: bead-0825
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

const DEFAULT_JUNIT_PATH = resolve(REPO_ROOT, 'test-results/junit.xml');
const DEFAULT_THRESHOLD_S = 30;
const REPORT_PATH = resolve(REPO_ROOT, 'reports/test-durations.json');

const args = process.argv.slice(2);

function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : fallback;
}

const MODE_CHECK = args.includes('--check');
const JUNIT_PATH = getArg('--input', DEFAULT_JUNIT_PATH);
const THRESHOLD_S = Number(getArg('--threshold', String(DEFAULT_THRESHOLD_S)));

// ---------------------------------------------------------------------------
// Minimal XML parser (no external deps)
// ---------------------------------------------------------------------------

/**
 * Parse JUnit XML into a flat list of test cases with duration info.
 * @returns {{ classname: string, name: string, timeMs: number }[]}
 */
function parseJunit(xml) {
  const results = [];

  // Extract all <testcase> elements
  const testcaseRe = /<testcase\s([^/]*?(?:\/(?!>)[^/]*?)*?)\s*\/?>/gs;
  for (const match of xml.matchAll(testcaseRe)) {
    const attrs = match[1];
    const name = extractAttr(attrs, 'name');
    const classname = extractAttr(attrs, 'classname');
    const timeStr = extractAttr(attrs, 'time');
    const timeS = timeStr ? parseFloat(timeStr) : 0;
    if (name !== null) {
      results.push({ classname: classname ?? '', name, timeMs: timeS * 1000 });
    }
  }

  return results;
}

function extractAttr(attrs, key) {
  const re = new RegExp(`${key}=["']([^"']*)["']`);
  const m = attrs.match(re);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!existsSync(JUNIT_PATH)) {
  process.stdout.write(
    `[check-durations] JUnit file not found: ${JUNIT_PATH}\n` +
      `  Run tests first: npm run test (or npm run test:unit)\n`,
  );
  // Not a hard failure — CI may not have run tests yet
  process.exit(0);
}

const xml = readFileSync(JUNIT_PATH, 'utf8');
const tests = parseJunit(xml);

if (tests.length === 0) {
  process.stdout.write(`[check-durations] No test cases found in ${JUNIT_PATH}\n`);
  process.exit(0);
}

const thresholdMs = THRESHOLD_S * 1000;
const slow = tests.filter((t) => t.timeMs >= thresholdMs).sort((a, b) => b.timeMs - a.timeMs);
const totalMs = tests.reduce((sum, t) => sum + t.timeMs, 0);
const p95Ms = (() => {
  const sorted = tests.map((t) => t.timeMs).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] ?? 0;
})();

// Write report
const report = {
  generatedAt: new Date().toISOString(),
  threshold: { seconds: THRESHOLD_S },
  summary: {
    total: tests.length,
    slow: slow.length,
    totalMs: Math.round(totalMs),
    p95Ms: Math.round(p95Ms),
  },
  slowTests: slow.map((t) => ({
    name: t.name,
    classname: t.classname,
    durationS: +(t.timeMs / 1000).toFixed(3),
  })),
};

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

// Print report
process.stdout.write(`\nTest Duration Report (threshold: ${THRESHOLD_S}s)\n`);
process.stdout.write('─'.repeat(60) + '\n');
process.stdout.write(
  `  Total tests: ${tests.length}  |  Total duration: ${(totalMs / 1000).toFixed(1)}s  |  p95: ${(p95Ms / 1000).toFixed(1)}s\n`,
);

if (slow.length === 0) {
  process.stdout.write(`\n✓ No tests exceed ${THRESHOLD_S}s threshold.\n`);
} else {
  process.stdout.write(`\n⚠ ${slow.length} test(s) exceed ${THRESHOLD_S}s:\n`);
  for (const t of slow) {
    process.stdout.write(
      `  ${(t.timeMs / 1000).toFixed(1).padStart(6)}s  ${t.classname} › ${t.name}\n`,
    );
  }
}

process.stdout.write(`\n[check-durations] Report written → ${REPORT_PATH}\n`);

if (MODE_CHECK && slow.length > 0) {
  process.stderr.write(
    `[check-durations] FAIL: ${slow.length} test(s) exceed ${THRESHOLD_S}s. ` +
      `Review and split long tests or mark them as integration-only.\n`,
  );
  process.exit(1);
}
