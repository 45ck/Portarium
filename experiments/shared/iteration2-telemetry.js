import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const ITERATION2_REQUIRED_METRIC_NAMES = [
  'approval_count_by_tier',
  'approval_count_by_session',
  'pending_age_ms_p50',
  'pending_age_ms_p95',
  'pending_age_ms_max',
  'resume_latency_ms',
  'blocked_duration_ms',
  'queue_depth_over_time',
  'denial_count',
  'request_changes_count',
  'escalation_count',
  'expiry_count',
  'duplicate_execution_count',
  'evidence_completeness_count',
  'restart_count',
  'successful_resume_count',
];

const suiteManifestPath = join(process.cwd(), 'experiments', 'iteration-2', 'suite.manifest.json');

function readSuiteManifest() {
  return JSON.parse(readFileSync(suiteManifestPath, 'utf8'));
}

function assertKnownScenario(scenarioId) {
  const scenarioIds = new Set(readSuiteManifest().scenarios.map((scenario) => scenario.scenarioId));
  if (!scenarioIds.has(scenarioId)) {
    throw new Error(`Unknown Iteration 2 scenario: ${scenarioId}`);
  }
}

function parseIso(value) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }
  return time;
}

function durationMs(startIso, endIso) {
  return Math.max(0, parseIso(endIso) - parseIso(startIso));
}

function percentile(values, percentileRank) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function incrementCounter(target, key) {
  target[key] = (target[key] ?? 0) + 1;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertAppendOnlyArtifactPaths(paths) {
  const existing = paths.filter((path) => existsSync(path));
  if (existing.length > 0) {
    throw new Error(`Refusing to overwrite Iteration 2 artifacts: ${existing.join(', ')}`);
  }
}

export function createIteration2Telemetry(options) {
  assertKnownScenario(options.scenarioId);

  const approvals = new Map();
  const queueDepthSamples = [];
  const blockedEvents = [];
  const resumeEvents = [];
  const evidenceEvents = [];
  const restartEvents = [];
  const executionKeys = new Set();
  let duplicateExecutionCount = 0;

  function recordApprovalRequested(event) {
    approvals.set(event.approvalId, { ...event });
  }

  function recordApprovalDecision(event) {
    const existing = approvals.get(event.approvalId);
    if (!existing) {
      throw new Error(`Approval decision without request: ${event.approvalId}`);
    }
    approvals.set(event.approvalId, { ...existing, ...event });
  }

  function recordQueueDepth(sample) {
    queueDepthSamples.push(sample);
  }

  function recordSessionBlocked(event) {
    blockedEvents.push(event);
  }

  function recordResume(event) {
    resumeEvents.push(event);
  }

  function recordDuplicateExecution(executionKey) {
    if (executionKeys.has(executionKey)) {
      duplicateExecutionCount += 1;
      return;
    }
    executionKeys.add(executionKey);
  }

  function recordEvidenceArtifact(event) {
    evidenceEvents.push(event);
  }

  function recordRestart(event) {
    restartEvents.push(event);
  }

  function buildEvidenceSummary(observedAtIso = new Date().toISOString()) {
    const requiredArtifacts = [...(options.requiredEvidenceArtifacts ?? [])];
    const presentArtifacts = evidenceEvents
      .filter((event) => event.present)
      .map((event) => event.artifactName);
    const presentSet = new Set(presentArtifacts);
    const missingArtifacts = requiredArtifacts.filter((artifact) => !presentSet.has(artifact));

    return {
      schemaVersion: 1,
      scenarioId: options.scenarioId,
      attemptId: options.attemptId,
      generatedAtIso: observedAtIso,
      requiredArtifacts,
      presentArtifacts,
      missingArtifacts,
      evidenceCompletenessCount: presentArtifacts.length,
      complete: missingArtifacts.length === 0,
    };
  }

  function buildQueueMetrics(observedAtIso = new Date().toISOString()) {
    const approvalCountByTier = {};
    const approvalCountBySession = {};
    const pendingAges = [];
    let denialCount = 0;
    let requestChangesCount = 0;
    let escalationCount = 0;
    let expiryCount = 0;

    for (const approval of approvals.values()) {
      incrementCounter(approvalCountByTier, approval.tier);
      incrementCounter(approvalCountBySession, approval.sessionId);
      pendingAges.push(durationMs(approval.requestedAtIso, approval.decidedAtIso ?? observedAtIso));

      if (approval.status === 'denied') denialCount += 1;
      if (approval.status === 'request_changes') requestChangesCount += 1;
      if (approval.status === 'escalated') escalationCount += 1;
      if (approval.status === 'expired') expiryCount += 1;
    }

    const resumeLatencies = resumeEvents.map((event) =>
      durationMs(event.decidedAtIso, event.resumedAtIso),
    );
    const blockedDurations = blockedEvents.map((event) =>
      durationMs(event.blockedAtIso, event.unblockedAtIso),
    );

    return {
      schemaVersion: 1,
      scenarioId: options.scenarioId,
      attemptId: options.attemptId,
      generatedAtIso: observedAtIso,
      metrics: {
        approval_count_by_tier: approvalCountByTier,
        approval_count_by_session: approvalCountBySession,
        pending_age_ms_p50: percentile(pendingAges, 50),
        pending_age_ms_p95: percentile(pendingAges, 95),
        pending_age_ms_max: pendingAges.length === 0 ? 0 : Math.max(...pendingAges),
        resume_latency_ms: resumeLatencies,
        blocked_duration_ms: blockedDurations,
        queue_depth_over_time: [...queueDepthSamples],
        denial_count: denialCount,
        request_changes_count: requestChangesCount,
        escalation_count: escalationCount,
        expiry_count: expiryCount,
        duplicate_execution_count: duplicateExecutionCount,
        evidence_completeness_count: buildEvidenceSummary(observedAtIso).evidenceCompletenessCount,
        restart_count: restartEvents.length,
        successful_resume_count: resumeEvents.filter((event) => event.successful).length,
      },
    };
  }

  function evaluateThresholds(thresholds, observedAtIso = new Date().toISOString()) {
    const queueMetrics = buildQueueMetrics(observedAtIso).metrics;
    const evidenceSummary = buildEvidenceSummary(observedAtIso);
    const assertions = [];

    if (thresholds.maxDuplicateExecutionCount !== undefined) {
      const actual = Number(queueMetrics.duplicate_execution_count);
      assertions.push({
        label: 'duplicate execution count within threshold',
        passed: actual <= thresholds.maxDuplicateExecutionCount,
        detail: `${actual} <= ${thresholds.maxDuplicateExecutionCount}`,
      });
    }

    if (thresholds.maxPendingAgeMsP95 !== undefined) {
      const actual = Number(queueMetrics.pending_age_ms_p95);
      assertions.push({
        label: 'pending age p95 within threshold',
        passed: actual <= thresholds.maxPendingAgeMsP95,
        detail: `${actual} <= ${thresholds.maxPendingAgeMsP95}`,
      });
    }

    if (thresholds.maxResumeLatencyMs !== undefined) {
      const values = queueMetrics.resume_latency_ms;
      const maxLatency = values.length === 0 ? 0 : Math.max(...values);
      assertions.push({
        label: 'resume latency within threshold',
        passed: maxLatency <= thresholds.maxResumeLatencyMs,
        detail: `${maxLatency} <= ${thresholds.maxResumeLatencyMs}`,
      });
    }

    if (thresholds.minEvidenceCompletenessCount !== undefined) {
      assertions.push({
        label: 'evidence completeness count meets threshold',
        passed:
          evidenceSummary.evidenceCompletenessCount >= thresholds.minEvidenceCompletenessCount,
        detail: `${evidenceSummary.evidenceCompletenessCount} >= ${thresholds.minEvidenceCompletenessCount}`,
      });
    }

    if (thresholds.minSuccessfulResumeCount !== undefined) {
      const actual = Number(queueMetrics.successful_resume_count);
      assertions.push({
        label: 'successful resume count meets threshold',
        passed: actual >= thresholds.minSuccessfulResumeCount,
        detail: `${actual} >= ${thresholds.minSuccessfulResumeCount}`,
      });
    }

    return assertions;
  }

  function writeArtifacts(observedAtIso = new Date().toISOString()) {
    mkdirSync(options.resultsDir, { recursive: true });

    const queueMetrics = buildQueueMetrics(observedAtIso);
    const evidenceSummary = buildEvidenceSummary(observedAtIso);
    const queueMetricsPath = join(options.resultsDir, 'queue-metrics.json');
    const evidenceSummaryPath = join(options.resultsDir, 'evidence-summary.json');
    const reportPath = join(options.resultsDir, 'report.md');
    assertAppendOnlyArtifactPaths([queueMetricsPath, evidenceSummaryPath, reportPath]);

    writeJson(queueMetricsPath, queueMetrics);
    writeJson(evidenceSummaryPath, evidenceSummary);
    writeFileSync(
      reportPath,
      [
        `# ${options.scenarioId} ${options.attemptId}`,
        '',
        `Generated: ${observedAtIso}`,
        '',
        '## Metric Artifacts',
        '',
        '- `queue-metrics.json`',
        '- `evidence-summary.json`',
        '',
        '## Evidence Completeness',
        '',
        `Present: ${evidenceSummary.evidenceCompletenessCount}`,
        `Missing: ${evidenceSummary.missingArtifacts.length}`,
        '',
      ].join('\n'),
    );

    return { queueMetricsPath, evidenceSummaryPath, reportPath };
  }

  return {
    recordApprovalRequested,
    recordApprovalDecision,
    recordQueueDepth,
    recordSessionBlocked,
    recordResume,
    recordDuplicateExecution,
    recordEvidenceArtifact,
    recordRestart,
    buildQueueMetrics,
    buildEvidenceSummary,
    evaluateThresholds,
    writeArtifacts,
  };
}
