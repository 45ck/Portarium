/**
 * Experiment C: deterministic Cockpit/operator-visible approval lifecycle.
 *
 * Runs the experiment script directly so CI can validate the native plugin
 * proposal/approval/execute contract without live Cockpit or a real LLM.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('Experiment C approval lifecycle script', () => {
  it('shows approval visibility, operator approval, agent unblock, run visibility, and evidence', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-exp-c-'));
    tempDirs.push(resultsDir);

    const mod = await import('../../experiments/exp-C-approval-lifecycle/run.mjs');
    const outcome = await mod.runExperimentC({
      resultsDir,
      writeResults: false,
      log: () => {},
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions).not.toHaveLength(0);
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace.proposal.body.toolName).toBe('write:file');
    expect(trace.approvalList.pendingApproval.toolName).toBe('write:file');
    expect(trace.execution.body.approvedByHuman).toBe(true);
    expect(trace.run.body.status).toBe('Succeeded');

    const categories = new Set(
      trace.evidence.body.evidence.map((entry: { category: string }) => entry.category),
    );
    expect(categories).toEqual(new Set(['Plan', 'Approval', 'Action', 'System']));
  });
});
