/**
 * Iteration 2: deterministic Growth Studio OpenClaw live-v2 replay.
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

describe('growth-studio-openclaw-live-v2 experiment', () => {
  it('records delayed approval durability and exact resume for live-wait and restart-resume', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-growth-live-v2-'));
    tempDirs.push(resultsDir);

    const runnerPath =
      '../../experiments/iteration-2/scenarios/growth-studio-openclaw-live-v2/run.mjs';
    const mod = await import(runnerPath);
    const outcome = await mod.runGrowthStudioOpenClawLiveV2({
      resultsDir,
      log: () => {},
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace['comparesTo']).toBe('growth-studio-openclaw-live');
    expect(trace['mode']).toBe('deterministic-replay');
    expect(trace['variants']).toHaveLength(2);
    expect(trace['variants'].map((variant: { variantId: string }) => variant.variantId)).toEqual([
      'live-wait',
      'restart-resume',
    ]);
    expect(trace['queueMetrics'].metrics.duplicate_execution_count).toBe(0);
    expect(trace['queueMetrics'].metrics.restart_count).toBe(1);
    expect(trace['queueMetrics'].metrics.successful_resume_count).toBe(4);
    expect(trace['queueMetrics'].metrics.resume_latency_ms).toEqual([1500, 1500, 1500, 1500]);
    expect(trace['operatorDelayWindows']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          approvalId: 'appr-growth-live-send',
          delayWindowMs: 28_800_000,
        }),
        expect.objectContaining({
          approvalId: 'appr-growth-restart-publish',
          delayWindowMs: 32_400_000,
        }),
      ]),
    );

    for (const variant of trace['variants']) {
      expect(variant.evidenceChain).toHaveLength(4);
      expect(variant.evidenceChain[0].phase).toBe('before-wait');
      expect(variant.evidenceChain[1].phase).toBe('during-wait');
      expect(variant.evidenceChain[3].phase).toBe('after-resume');
      expect(
        variant.executionLedger.filter(
          (entry: { phase: string; replayedAfterResume?: boolean }) =>
            entry.phase === 'pre-wait' && entry.replayedAfterResume === true,
        ),
      ).toEqual([]);
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
