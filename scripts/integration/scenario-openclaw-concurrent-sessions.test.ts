/**
 * Iteration 2: deterministic OpenClaw concurrent sessions.
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

  it('records opt-in live rerun comparison for concurrent approvals', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-openclaw-concurrent-rerun-'));
    tempDirs.push(resultsDir);

    const runnerPath =
      '../../experiments/iteration-2/scenarios/openclaw-concurrent-sessions/run.mjs';
    const mod = await import(runnerPath);
    const outcome = await mod.runOpenClawConcurrentSessions({
      resultsDir,
      log: () => {},
      env: {
        PORTARIUM_LIVE_OPENCLAW_RERUNS: 'true',
        PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
        PORTARIUM_LIVE_MODEL_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-concurrent-secret',
      },
      fetchImpl: async () => new Response('{}', { status: 200 }),
    });

    expect(outcome.outcome).toBe('confirmed');
    const trace = outcome.trace as Record<string, any>;
    expect(trace['mode']).toBe('live-llm-openclaw-rerun');
    expect(trace['liveOpenClawRerun']).toMatchObject({
      scenarioId: 'openclaw-concurrent-sessions',
      liveAttemptId: 'live-openclaw-rerun-v1',
      liveModelPreflight: {
        status: 'ready',
        provider: 'openai',
        model: 'gpt-4o',
        probe: 'chat-completions',
      },
      deterministicComparison: {
        deterministicAttemptId: 'deterministic-concurrency-v1',
        deterministicOutcome: 'confirmed',
        exactOnceResumeMatch: true,
      },
      exactOnceResume: {
        duplicateExecutionCount: 0,
        successfulResumeCount: 4,
        result: 'exact-once',
      },
    });
    expect(trace['liveOpenClawRerun'].approvalIds).toEqual([
      'appr-openclaw-session-01',
      'appr-openclaw-session-02',
      'appr-openclaw-session-03',
      'appr-openclaw-session-04',
    ]);
    expect(trace['liveOpenClawRerun'].classification.productDefects).toEqual([]);
    expect(JSON.stringify(outcome)).not.toContain('sk-concurrent-secret');
    expect(JSON.stringify(outcome)).not.toContain('OPENAI_API_KEY');
    expect(existsSync(join(resultsDir, 'live-rerun-metadata.json'))).toBe(true);
  });

  it('skips live rerun before execution when provider is not explicit', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-openclaw-concurrent-skip-'));
    tempDirs.push(resultsDir);

    const runnerPath =
      '../../experiments/iteration-2/scenarios/openclaw-concurrent-sessions/run.mjs';
    const mod = await import(runnerPath);
    const outcome = await mod.runOpenClawConcurrentSessions({
      resultsDir,
      log: () => {},
      env: {
        PORTARIUM_LIVE_OPENCLAW_RERUNS: 'true',
        PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
        OPENAI_API_KEY: 'sk-provider-secret',
      },
      fetchImpl: async () => new Response('{}', { status: 200 }),
    });

    expect(outcome.outcome).toBe('skipped');
    expect(outcome.trace).toMatchObject({
      mode: 'live-llm-openclaw-rerun',
      liveModelPreflight: {
        status: 'skipped',
        providerSelection: 'none',
        failureKind: 'unsupported_provider',
      },
    });
    expect(JSON.stringify(outcome)).not.toContain('sk-provider-secret');
    expect(JSON.stringify(outcome)).not.toContain('OPENAI_API_KEY');
    expect(existsSync(join(resultsDir, 'queue-metrics.json'))).toBe(false);
    expect(readFileSync(join(resultsDir, 'outcome.json'), 'utf8')).toContain(
      '"outcome": "skipped"',
    );
  });

  it('classifies provider variability separately from product defects', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-openclaw-concurrent-provider-'));
    tempDirs.push(resultsDir);

    const runnerPath =
      '../../experiments/iteration-2/scenarios/openclaw-concurrent-sessions/run.mjs';
    const mod = await import(runnerPath);
    const outcome = await mod.runOpenClawConcurrentSessions({
      resultsDir,
      log: () => {},
      env: {
        PORTARIUM_LIVE_OPENCLAW_RERUNS: 'true',
        PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
        PORTARIUM_LIVE_MODEL_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-rate-secret',
      },
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
          status: 429,
        }),
    });

    expect(outcome.outcome).toBe('inconclusive');
    expect(outcome.trace).toMatchObject({
      mode: 'live-llm-openclaw-rerun',
      liveModelPreflight: {
        status: 'failed',
        provider: 'openai',
        failureKind: 'quota_or_rate_limit',
      },
      classification: {
        productDefects: [],
        providerVariability: ['live model preflight quota_or_rate_limit'],
        environmentLimitations: [],
      },
    });
    expect(JSON.stringify(outcome)).not.toContain('sk-rate-secret');
    expect(JSON.stringify(outcome)).not.toContain('OPENAI_API_KEY');
    expect(existsSync(join(resultsDir, 'queue-metrics.json'))).toBe(false);
  });
});
