import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const timedScript = readFileSync(
  resolve(repoRoot, 'examples/openclaw/run-timed-experiments.mjs'),
  'utf8',
);
const businessScript = readFileSync(
  resolve(repoRoot, 'examples/openclaw/business-scenarios/run-business-experiments.mjs'),
  'utf8',
);

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function expectGuardBeforeApprovalUse(source: string, functionName: string): void {
  const functionStart = source.indexOf(`async function ${functionName}()`);
  expect(functionStart).toBeGreaterThanOrEqual(0);

  const guard = source.indexOf('if (failMissingApprovalId(result, propose,', functionStart);
  const firstApprovalUse = source.indexOf('`/approvals/${approvalId}', functionStart);

  expect(guard).toBeGreaterThanOrEqual(0);
  expect(firstApprovalUse).toBeGreaterThanOrEqual(0);
  expect(guard).toBeLessThan(firstApprovalUse);
}

function expectBefore(source: string, earlier: string, later: string): void {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);

  expect(earlierIndex).toBeGreaterThanOrEqual(0);
  expect(laterIndex).toBeGreaterThanOrEqual(0);
  expect(earlierIndex).toBeLessThan(laterIndex);
}

describe('OpenClaw experiment script safety guards', () => {
  it('guards every timed HumanApprove experiment before using approvalId', () => {
    expect(countMatches(timedScript, /if \(failMissingApprovalId\(result, propose, 'exp-/g)).toBe(
      4,
    );

    for (const functionName of ['experimentA', 'experimentB', 'experimentC', 'experimentD']) {
      expectGuardBeforeApprovalUse(timedScript, functionName);
    }
  });

  it('guards every business HumanApprove scenario before using approvalId', () => {
    expect(
      countMatches(businessScript, /if \(failMissingApprovalId\(result, propose, 'scenario-/g),
    ).toBe(5);

    for (const functionName of ['scenario2', 'scenario3', 'scenario4', 'scenario5', 'scenario6']) {
      expectGuardBeforeApprovalUse(businessScript, functionName);
    }
  });

  it('only runs maker-checker operator approval after self-approval is rejected', () => {
    expectBefore(
      timedScript,
      'if (selfApprove.status !== 403) {',
      'result.timestamps.t5_operator_approve_sent = now();',
    );
    expectBefore(
      businessScript,
      'if (selfApprove.status !== 403) {',
      'result.maker_checker.t5_operator_approve_sent = now();',
    );
  });
});
