import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createIteration2Telemetry,
  ITERATION2_REQUIRED_METRIC_NAMES,
} from '../../experiments/shared/iteration2-telemetry.js';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeTelemetry() {
  const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-iteration2-'));
  tempDirs.push(resultsDir);

  return createIteration2Telemetry({
    scenarioId: 'approval-backlog-soak',
    attemptId: '20260429T110000Z-test',
    resultsDir,
    requiredEvidenceArtifacts: ['outcome.json', 'queue-metrics.json', 'evidence-summary.json'],
  });
}

describe('Iteration 2 telemetry helper', () => {
  it('captures every required metric name in a reusable queue metrics artifact', () => {
    const telemetry = makeTelemetry();

    telemetry.recordApprovalRequested({
      approvalId: 'appr-1',
      sessionId: 'session-a',
      tier: 'Human-approve',
      requestedAtIso: '2026-04-29T00:00:00.000Z',
    });
    telemetry.recordApprovalRequested({
      approvalId: 'appr-2',
      sessionId: 'session-b',
      tier: 'Assisted',
      requestedAtIso: '2026-04-29T00:01:00.000Z',
    });
    telemetry.recordApprovalDecision({
      approvalId: 'appr-1',
      status: 'denied',
      decidedAtIso: '2026-04-29T00:05:00.000Z',
    });
    telemetry.recordApprovalDecision({
      approvalId: 'appr-2',
      status: 'request_changes',
      decidedAtIso: '2026-04-29T00:11:00.000Z',
    });
    telemetry.recordQueueDepth({ timestampIso: '2026-04-29T00:02:00.000Z', depth: 2 });
    telemetry.recordSessionBlocked({
      sessionId: 'session-a',
      blockedAtIso: '2026-04-29T00:00:30.000Z',
      unblockedAtIso: '2026-04-29T00:05:30.000Z',
    });
    telemetry.recordResume({
      sessionId: 'session-a',
      approvalId: 'appr-1',
      decidedAtIso: '2026-04-29T00:05:00.000Z',
      resumedAtIso: '2026-04-29T00:05:03.000Z',
      successful: true,
    });
    telemetry.recordDuplicateExecution('session-a:write:file:1');
    telemetry.recordDuplicateExecution('session-a:write:file:1');
    telemetry.recordEvidenceArtifact({ artifactName: 'queue-metrics.json', present: true });
    telemetry.recordRestart({ sessionId: 'session-a', successfulResume: true });

    const artifact = telemetry.buildQueueMetrics('2026-04-29T00:12:00.000Z');
    const metricNames = Object.keys(artifact.metrics);

    expect(new Set(metricNames)).toEqual(new Set(ITERATION2_REQUIRED_METRIC_NAMES));
    expect(artifact.metrics.approval_count_by_tier).toEqual({
      'Human-approve': 1,
      Assisted: 1,
    });
    expect(artifact.metrics.approval_count_by_session).toEqual({
      'session-a': 1,
      'session-b': 1,
    });
    expect(artifact.metrics.pending_age_ms_p50).toBe(300_000);
    expect(artifact.metrics.pending_age_ms_p95).toBe(600_000);
    expect(artifact.metrics.pending_age_ms_max).toBe(600_000);
    expect(artifact.metrics.denial_count).toBe(1);
    expect(artifact.metrics.request_changes_count).toBe(1);
    expect(artifact.metrics.duplicate_execution_count).toBe(1);
    expect(artifact.metrics.resume_latency_ms).toEqual([3_000]);
    expect(artifact.metrics.blocked_duration_ms).toEqual([300_000]);
    expect(artifact.metrics.successful_resume_count).toBe(1);
    expect(artifact.metrics.restart_count).toBe(1);
  });

  it('writes durable queue, evidence, and report artifacts for an attempt', () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-iteration2-write-'));
    tempDirs.push(resultsDir);
    const telemetry = createIteration2Telemetry({
      scenarioId: 'openclaw-concurrent-sessions',
      attemptId: '20260429T111500Z-test',
      resultsDir,
      requiredEvidenceArtifacts: ['outcome.json', 'queue-metrics.json', 'evidence-summary.json'],
    });

    telemetry.recordEvidenceArtifact({ artifactName: 'queue-metrics.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'evidence-summary.json', present: true });

    const paths = telemetry.writeArtifacts('2026-04-29T00:00:00.000Z');

    expect(existsSync(paths.queueMetricsPath)).toBe(true);
    expect(existsSync(paths.evidenceSummaryPath)).toBe(true);
    expect(existsSync(paths.reportPath)).toBe(true);

    const evidenceSummary = JSON.parse(readFileSync(paths.evidenceSummaryPath, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(evidenceSummary['missingArtifacts']).toEqual(['outcome.json']);
    expect(evidenceSummary['evidenceCompletenessCount']).toBe(2);
    expect(evidenceSummary['complete']).toBe(false);
  });

  it('turns metric thresholds into explicit pass or fail assertions', () => {
    const telemetry = makeTelemetry();

    telemetry.recordApprovalRequested({
      approvalId: 'appr-1',
      sessionId: 'session-a',
      tier: 'Human-approve',
      requestedAtIso: '2026-04-29T00:00:00.000Z',
    });
    telemetry.recordApprovalDecision({
      approvalId: 'appr-1',
      status: 'approved',
      decidedAtIso: '2026-04-29T00:00:10.000Z',
    });
    telemetry.recordResume({
      sessionId: 'session-a',
      approvalId: 'appr-1',
      decidedAtIso: '2026-04-29T00:00:10.000Z',
      resumedAtIso: '2026-04-29T00:00:14.000Z',
      successful: true,
    });
    telemetry.recordEvidenceArtifact({ artifactName: 'queue-metrics.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'evidence-summary.json', present: true });

    const assertions = telemetry.evaluateThresholds(
      {
        maxDuplicateExecutionCount: 0,
        maxPendingAgeMsP95: 10_000,
        maxResumeLatencyMs: 3_000,
        minEvidenceCompletenessCount: 2,
        minSuccessfulResumeCount: 1,
      },
      '2026-04-29T00:00:20.000Z',
    );

    expect(assertions.map((assertion) => assertion.passed)).toEqual([
      true,
      true,
      false,
      true,
      true,
    ]);
    expect(assertions[2]?.label).toBe('resume latency within threshold');
  });

  it('rejects unknown scenarios, orphan decisions, and artifact overwrites', () => {
    const unknownResultsDir = mkdtempSync(join(tmpdir(), 'portarium-iteration2-unknown-'));
    tempDirs.push(unknownResultsDir);

    expect(() =>
      createIteration2Telemetry({
        scenarioId: 'unknown-scenario',
        attemptId: '20260429T112000Z-test',
        resultsDir: unknownResultsDir,
      }),
    ).toThrow('Unknown Iteration 2 scenario: unknown-scenario');

    const telemetry = makeTelemetry();
    expect(() =>
      telemetry.recordApprovalDecision({
        approvalId: 'missing',
        status: 'approved',
        decidedAtIso: '2026-04-29T00:00:00.000Z',
      }),
    ).toThrow('Approval decision without request: missing');

    telemetry.writeArtifacts('2026-04-29T00:00:00.000Z');
    expect(() => telemetry.writeArtifacts('2026-04-29T00:00:01.000Z')).toThrow(
      'Refusing to overwrite Iteration 2 artifacts:',
    );
  });
});
