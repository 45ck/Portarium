/**
 * Iteration 2: deterministic approval backlog soak.
 *
 * Exercises the v2 telemetry helper against a sustained approval backlog so CI
 * can verify escalation, expiry, queue depth, runtime, and evidence artifacts
 * before the live experiments use the same metric contract.
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('approval-backlog-soak experiment', () => {
  it('records backlog pressure, escalation, expiry, runtime, and telemetry artifacts', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-approval-backlog-soak-'));
    tempDirs.push(resultsDir);

    const mod =
      // @ts-expect-error The experiment is a checked .mjs runtime script.
      await import('../../experiments/iteration-2/scenarios/approval-backlog-soak/run.mjs');
    const outcome = await mod.runApprovalBacklogSoak({
      resultsDir,
      log: () => {},
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace['approvals']).toHaveLength(24);
    expect(trace['duplicateEscalationIds']).toEqual([]);
    expect(trace['queueMetrics'].metrics.escalation_count).toBeGreaterThan(0);
    expect(trace['queueMetrics'].metrics.expiry_count).toBeGreaterThan(0);
    expect(trace['queueMetrics'].metrics.queue_depth_over_time.length).toBeGreaterThanOrEqual(5);
    expect(trace['runtime'].runtimeSamples.length).toBeGreaterThanOrEqual(5);
    expect(trace['runtime'].errorEvents).toEqual([]);

    for (const artifactName of [
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'report.md',
    ]) {
      expect(existsSync(join(resultsDir, artifactName))).toBe(true);
    }
  });
});
