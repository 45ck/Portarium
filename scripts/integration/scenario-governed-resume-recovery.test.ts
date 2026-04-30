/**
 * Iteration 2: deterministic governed resume recovery replay.
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

describe('governed-resume-recovery experiment', () => {
  it('records pending approval recovery, operator visibility, and exact resume outcomes', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-governed-resume-recovery-'));
    tempDirs.push(resultsDir);

    const runnerPath = '../../experiments/iteration-2/scenarios/governed-resume-recovery/run.mjs';
    const mod = await import(runnerPath);
    const outcome = await mod.runGovernedResumeRecovery({
      resultsDir,
      log: () => {},
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace['beadId']).toBe('bead-1059');
    expect(trace['comparesTo']).toBe('growth-studio-openclaw-live-v2');
    expect(trace['mode']).toBe('deterministic-recovery');
    expect(trace['variants']).toHaveLength(4);
    expect(trace['variants'].map((variant: { variantId: string }) => variant.variantId)).toEqual([
      'process-crash',
      'service-restart',
      'deploy-restart',
      'provider-outage',
    ]);
    expect(trace['queueMetrics'].metrics.duplicate_execution_count).toBe(0);
    expect(trace['queueMetrics'].metrics.restart_count).toBe(4);
    expect(trace['queueMetrics'].metrics.successful_resume_count).toBe(3);
    expect(trace['queueMetrics'].metrics.resume_latency_ms).toEqual([1250, 1000, 1500]);

    const providerOutage = trace['variants'].find(
      (variant: { variantId: string }) => variant.variantId === 'provider-outage',
    );
    expect(providerOutage.classification.productDefects).toEqual([]);
    expect(providerOutage.classification.environmentLimitations).toContain(
      'external provider unavailable; resume not attempted',
    );
    expect(providerOutage.resume.successful).toBe(false);

    for (const variant of trace['variants']) {
      expect(variant.stateSurvival.planPreserved).toBe(true);
      expect(variant.stateSurvival.approvalPendingBeforeRecovery).toBe(true);
      expect(variant.evidenceChain).toHaveLength(4);
      expect(variant.evidenceChain[0].phase).toBe('plan-before-interruption');
      expect(variant.evidenceChain[2].phase).toBe('recovered-state-visible');
    }

    for (const artifactName of [
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'report.md',
      'plan-before-interruption.json',
      'approval-before-interruption.json',
      'evidence-chain-after-recovery.json',
      'cockpit-waiting-state.json',
    ]) {
      expect(existsSync(join(resultsDir, artifactName))).toBe(true);
    }
  });
});
