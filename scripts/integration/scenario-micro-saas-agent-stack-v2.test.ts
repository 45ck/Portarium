/**
 * Iteration 2: deterministic micro-SaaS operator-team handoff.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('micro-saas-agent-stack-v2 experiment', () => {
  it('records operator handoff, SoD, request changes, and queue snapshots', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-micro-saas-v2-'));
    tempDirs.push(resultsDir);

    const mod =
      // @ts-expect-error The experiment is a checked .mjs runtime script.
      await import('../../experiments/iteration-2/scenarios/micro-saas-agent-stack-v2/run.mjs');
    const outcome = await mod.runMicroSaasAgentStackV2({
      resultsDir,
      log: () => {},
      toolPreflightImpl: async () => ({
        tool: 'demo-machine',
        status: 'intentionally-skipped',
        checkedAt: '2026-04-29T02:00:00.000Z',
        command: 'demo-machine',
        probe: 'cli-help',
        rationale: 'AppLocker blocks the local demo-machine binary.',
        clipSpecPath:
          'docs/internal/ui/cockpit/demo-machine/clips/01-approval-gate-unblocks-run.demo.yaml',
      }),
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace['comparesTo']).toBe('micro-saas-agent-stack');
    expect(trace['toolchainPreflight'].demoMachine.status).toBe('intentionally-skipped');
    expect(trace['approvals']).toHaveLength(5);
    expect(trace['handoff']).toEqual({ operatorA: 3, operatorB: 2 });
    expect(trace['queueSnapshots']).toHaveLength(3);
    expect(trace['queueSnapshots'][0].pending).toHaveLength(5);
    expect(trace['queueSnapshots'][2].pending).toHaveLength(0);
    expect(trace['queueMetrics'].metrics.request_changes_count).toBe(1);
    expect(trace['queueMetrics'].metrics.denial_count).toBe(1);

    for (const artifactName of [
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'report.md',
      'demo-machine-preflight.json',
    ]) {
      expect(existsSync(join(resultsDir, artifactName))).toBe(true);
    }

    const report = readFileSync(join(resultsDir, 'report.md'), 'utf8');
    expect(report).toContain('Experiment Toolchain Preflight');
    expect(report).toContain('demo-machine');
    expect(report).toContain('intentionally-skipped');
  });
});
