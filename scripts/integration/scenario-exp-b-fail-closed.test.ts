/**
 * Experiment B: deterministic fail-closed OpenClaw plugin check.
 *
 * Runs the experiment script directly so CI proves that an unreachable
 * Portarium control plane prevents tool execution.
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

describe('Experiment B fail-closed script', () => {
  it('blocks the tool and records no pass-through execution when Portarium is unreachable', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-exp-b-'));
    tempDirs.push(resultsDir);

    // @ts-expect-error The experiment runner is a checked .mjs script.
    const mod = await import('../../experiments/exp-B-fail-closed/run.mjs');
    const outcome = await mod.runExperimentB({
      resultsDir,
      writeResults: false,
      log: () => {},
      portariumUrl: 'http://127.0.0.1:1',
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions).not.toHaveLength(0);
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace['hookPriority']).toBe(1000);
    expect(trace['attempt'].status).toBe('error');
    expect(trace['attempt'].blocked).toBe(true);
    expect(trace['attempt'].toolExecuted).toBe(false);
    expect(trace['executionCount']).toBe(0);
    expect(trace['attempt'].blockReason).toContain(
      'Portarium governance unavailable — failing closed',
    );
    expect(trace['logs'].join('\n')).toContain('Portarium governance unavailable — failing closed');
  });
});
