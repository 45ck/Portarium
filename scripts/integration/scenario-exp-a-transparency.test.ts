/**
 * Experiment A: deterministic before-hook transparency check.
 *
 * Runs the experiment script directly so CI proves the registered native hook
 * governs representative OpenClaw-style tool-call events.
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

describe('Experiment A before-hook transparency script', () => {
  it('allows read, gates write for approval, and denies shell without agent code changes', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-exp-a-'));
    tempDirs.push(resultsDir);

    // @ts-expect-error The experiment runner is validated by this runtime scenario.
    const mod = await import('../../experiments/exp-A-transparency/run.mjs');
    const outcome = await mod.runExperimentA({
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
    expect(trace['hookPriority']).toBe(1000);
    expect(trace['attempts'].read.toolExecuted).toBe(true);
    expect(trace['attempts'].write.toolExecuted).toBe(true);
    expect(trace['initialWriteApproval'].body.status).toBe('Pending');
    expect(trace['writeDecision'].body.status).toBe('Approved');
    expect(trace['attempts'].shell.blocked).toBe(true);
    expect(trace['attempts'].shell.toolExecuted).toBe(false);
    expect(trace['executions'].map((entry: { toolName: string }) => entry.toolName)).toEqual([
      'read:file',
      'write:file',
    ]);

    const proposals = trace['proposals'] as {
      request: { toolName: string };
      response: { decision: string };
    }[];
    expect(proposals.map((proposal) => proposal.request.toolName)).toEqual([
      'read:file',
      'write:file',
      'shell.exec',
    ]);
    expect(proposals.map((proposal) => proposal.response.decision)).toEqual([
      'Allow',
      'NeedsApproval',
      'Denied',
    ]);
  });
});
