/**
 * Iteration 2: deterministic OpenClaw concurrent sessions.
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

describe('openclaw-concurrent-sessions experiment', () => {
  it('records session-isolated approvals, mixed-order decisions, and throughput', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-openclaw-concurrent-'));
    tempDirs.push(resultsDir);

    const runnerPath =
      '../../experiments/iteration-2/scenarios/openclaw-concurrent-sessions/run.mjs';
    const mod = await import(runnerPath);
    const outcome = await mod.runOpenClawConcurrentSessions({
      resultsDir,
      log: () => {},
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace['comparesTo']).toBe('exp-A-transparency');
    expect(trace['concurrencyLevel']).toBe(4);
    expect(trace['sessions']).toHaveLength(4);
    expect(trace['decisionOrder'].map((item: { sessionId: string }) => item.sessionId)).toEqual([
      'openclaw-session-03',
      'openclaw-session-01',
      'openclaw-session-04',
      'openclaw-session-02',
    ]);
    expect(trace['crossSessionLeaks']).toEqual([]);
    expect(trace['outputBundles']).toHaveLength(4);
    expect(trace['queueMetrics'].metrics.duplicate_execution_count).toBe(0);
    expect(trace['queueMetrics'].metrics.successful_resume_count).toBe(4);
    expect(trace['throughput'].completedSessions).toBe(4);
    expect(trace['observedBottlenecks']).toEqual([]);

    for (const session of trace['sessions']) {
      expect(session.output.path).toContain(session.sessionId);
      expect(session.output.content.sessionId).toBe(session.sessionId);
      expect(session.evidenceChain).toHaveLength(4);
    }

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
