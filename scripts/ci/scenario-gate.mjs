#!/usr/bin/env node

/**
 * CI scenario gate — runs the control-plane scenario suite with deterministic
 * seed and validates that all scenario tests pass with required evidence,
 * auth-contract, and bypass-policy assertions.
 *
 * Produces a JSON summary artifact at `reports/scenarios/scenario-summary.json`
 * and a human-readable log at `reports/scenarios/scenario-gate.log`.
 *
 * Exit codes:
 *   0 — all scenarios passed, all invariants satisfied
 *   1 — scenario failures or missing invariant assertions
 *
 * Bead: bead-0851
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPORTS_DIR = join(process.cwd(), 'reports', 'scenarios');
const JUNIT_PATH = join(process.cwd(), 'test-results', 'scenario-junit.xml');
const JSON_RESULT_PATH = join(REPORTS_DIR, 'scenario-results.json');
const SUMMARY_PATH = join(REPORTS_DIR, 'scenario-summary.json');
const LOG_PATH = join(REPORTS_DIR, 'scenario-gate.log');

// Deterministic seed for reproducible test ordering
const SEED = process.env['SCENARIO_SEED'] ?? '20260302';

mkdirSync(REPORTS_DIR, { recursive: true });

const log = [];
function emit(msg) {
  const line = `[scenario-gate] ${msg}`;
  console.log(line);
  log.push(line);
}

// ---------------------------------------------------------------------------
// Phase 1: Run scenario tests via vitest with deterministic seed
// ---------------------------------------------------------------------------

emit(`Running scenario suite with seed=${SEED} ...`);

const vitestArgs = [
  'node_modules/vitest/vitest.mjs',
  'run',
  '--reporter=verbose',
  '--reporter=json',
  '--reporter=junit',
  `--outputFile.json=${JSON_RESULT_PATH}`,
  `--outputFile.junit=${JUNIT_PATH}`,
  `--sequence.seed=${SEED}`,
  'scripts/integration/scenario',
];

let testExitCode = 0;
const vitestRun = spawnSync(process.execPath, vitestArgs, {
  stdio: 'inherit',
  env: { ...process.env, CI: 'true' },
});

if (vitestRun.error) {
  throw vitestRun.error;
}

if (vitestRun.status !== 0) {
  testExitCode = vitestRun.status ?? 1;
}

// ---------------------------------------------------------------------------
// Phase 2: Parse results and validate invariants
// ---------------------------------------------------------------------------

emit('Validating scenario invariants ...');

let results;
try {
  results = JSON.parse(readFileSync(JSON_RESULT_PATH, 'utf8'));
} catch {
  emit('FAIL: Could not read scenario results JSON.');
  writeFileSync(LOG_PATH, log.join('\n') + '\n');
  process.exit(1);
}

const testResults = results.testResults ?? [];
const allTests = testResults.flatMap((f) => f.assertionResults ?? []);

const totalTests = allTests.length;
const passed = allTests.filter((t) => t.status === 'passed').length;
const failed = allTests.filter((t) => t.status === 'failed').length;

emit(`Total scenario tests: ${totalTests}  passed: ${passed}  failed: ${failed}`);

// Invariant checks: verify critical scenario categories are present and passing
const invariants = [
  {
    name: 'evidence-sequence',
    desc: 'Evidence hash-chain / evidence-log assertions present',
    pattern: /evidence|hash.?chain|appendEntry/i,
  },
  {
    name: 'auth-contract',
    desc: 'Auth/authz negative-path contract checks present',
    pattern: /auth|401|403|unauthorized|forbidden/i,
  },
  {
    name: 'bypass-policy',
    desc: 'Bypass-policy / outbound-governance assertions present',
    pattern: /bypass|policy|egress|governance|fail.?closed/i,
  },
  {
    name: 'recovery-resume',
    desc: 'Pending approval recovery and governed resume assertions present',
    pattern: /recovery|resume|restart|exact.?once|duplicate execution/i,
  },
];

const invariantResults = [];
let gatePass = testExitCode === 0;

for (const inv of invariants) {
  const matching = allTests.filter(
    (t) => inv.pattern.test(t.fullName) || inv.pattern.test(t.ancestorTitles?.join(' ') ?? ''),
  );
  const present = matching.length > 0;
  const allPassing = matching.every((t) => t.status === 'passed');
  const ok = present && allPassing;

  invariantResults.push({
    invariant: inv.name,
    description: inv.desc,
    testsMatched: matching.length,
    allPassing,
    pass: ok,
  });

  if (!ok) {
    gatePass = false;
    if (!present) {
      emit(`FAIL: Invariant "${inv.name}" — no matching tests found. ${inv.desc}`);
    } else {
      const failedNames = matching
        .filter((t) => t.status !== 'passed')
        .map((t) => t.fullName)
        .join(', ');
      emit(`FAIL: Invariant "${inv.name}" — failing tests: ${failedNames}`);
    }
  } else {
    emit(`PASS: Invariant "${inv.name}" — ${matching.length} tests, all passing.`);
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Write summary artifact
// ---------------------------------------------------------------------------

const summary = {
  timestamp: new Date().toISOString(),
  seed: SEED,
  gate: gatePass ? 'PASS' : 'FAIL',
  totals: { total: totalTests, passed, failed },
  invariants: invariantResults,
  scenarioFiles: testResults.map((f) => ({
    file: f.name,
    tests: f.numPassingTests ?? 0,
    failures: f.numFailingTests ?? 0,
    duration: f.perfStats?.runtime ?? 0,
  })),
};

writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2) + '\n');
writeFileSync(LOG_PATH, log.join('\n') + '\n');

emit(`Summary written to ${SUMMARY_PATH}`);

if (!gatePass) {
  emit('SCENARIO GATE: FAIL');
  process.exit(1);
} else {
  emit('SCENARIO GATE: PASS');
  process.exit(0);
}
