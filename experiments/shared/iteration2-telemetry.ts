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
] as const;

export type Iteration2MetricName = (typeof ITERATION2_REQUIRED_METRIC_NAMES)[number];

export type ApprovalDecisionStatus =
  | 'approved'
  | 'denied'
  | 'request_changes'
  | 'escalated'
  | 'expired';

export type Iteration2TelemetryOptions = Readonly<{
  scenarioId: string;
  attemptId: string;
  resultsDir: string;
  requiredEvidenceArtifacts?: readonly string[];
}>;

export type ApprovalRequestedEvent = Readonly<{
  approvalId: string;
  sessionId: string;
  tier: string;
  requestedAtIso: string;
}>;

export type ApprovalDecisionEvent = Readonly<{
  approvalId: string;
  status: ApprovalDecisionStatus;
  decidedAtIso: string;
}>;

export type QueueDepthSample = Readonly<{
  timestampIso: string;
  depth: number;
}>;

export type SessionBlockedEvent = Readonly<{
  sessionId: string;
  blockedAtIso: string;
  unblockedAtIso: string;
}>;

export type ResumeEvent = Readonly<{
  sessionId: string;
  approvalId: string;
  decidedAtIso: string;
  resumedAtIso: string;
  successful: boolean;
}>;

export type EvidenceArtifactEvent = Readonly<{
  artifactName: string;
  present: boolean;
  evidenceId?: string;
}>;

export type RestartEvent = Readonly<{
  sessionId: string;
  successfulResume: boolean;
}>;

export type QueueMetrics = Readonly<{
  schemaVersion: 1;
  scenarioId: string;
  attemptId: string;
  generatedAtIso: string;
  metrics: Readonly<Record<Iteration2MetricName, unknown>>;
}>;

export type EvidenceSummary = Readonly<{
  schemaVersion: 1;
  scenarioId: string;
  attemptId: string;
  generatedAtIso: string;
  requiredArtifacts: readonly string[];
  presentArtifacts: readonly string[];
  missingArtifacts: readonly string[];
  evidenceCompletenessCount: number;
  complete: boolean;
}>;

export type Iteration2Thresholds = Readonly<{
  maxDuplicateExecutionCount?: number;
  maxPendingAgeMsP95?: number;
  maxResumeLatencyMs?: number;
  minEvidenceCompletenessCount?: number;
  minSuccessfulResumeCount?: number;
}>;

export type Iteration2Assertion = Readonly<{
  label: string;
  passed: boolean;
  detail: string;
}>;

type ApprovalRecord = ApprovalRequestedEvent & Partial<ApprovalDecisionEvent>;

type Iteration2SuiteManifest = Readonly<{
  scenarios: readonly Readonly<{ scenarioId: string }>[];
}>;

const suiteManifestPath = join(process.cwd(), 'experiments', 'iteration-2', 'suite.manifest.json');

function readSuiteManifest(): Iteration2SuiteManifest {
  return JSON.parse(readFileSync(suiteManifestPath, 'utf8')) as Iteration2SuiteManifest;
}

function assertKnownScenario(scenarioId: string): void {
  const scenarioIds = new Set(readSuiteManifest().scenarios.map((scenario) => scenario.scenarioId));
  if (!scenarioIds.has(scenarioId)) {
    throw new Error(`Unknown Iteration 2 scenario: ${scenarioId}`);
  }
}

function parseIso(value: string): number {
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }
  return time;
}

function durationMs(startIso: string, endIso: string): number {
  return Math.max(0, parseIso(endIso) - parseIso(startIso));
}

function percentile(values: readonly number[], percentileRank: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function incrementCounter(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertAppendOnlyArtifactPaths(paths: readonly string[]): void {
  const existing = paths.filter((path) => existsSync(path));
  if (existing.length > 0) {
    throw new Error(`Refusing to overwrite Iteration 2 artifacts: ${existing.join(', ')}`);
  }
}

export function createIteration2Telemetry(options: Iteration2TelemetryOptions) {
  assertKnownScenario(options.scenarioId);

  const approvals = new Map<string, ApprovalRecord>();
  const queueDepthSamples: QueueDepthSample[] = [];
  const blockedEvents: SessionBlockedEvent[] = [];
  const resumeEvents: ResumeEvent[] = [];
  const evidenceEvents: EvidenceArtifactEvent[] = [];
  const restartEvents: RestartEvent[] = [];
  const decisionEvents: ApprovalDecisionEvent[] = [];
  const executionKeys = new Set<string>();
  let duplicateExecutionCount = 0;

  function recordApprovalRequested(event: ApprovalRequestedEvent): void {
    approvals.set(event.approvalId, { ...event });
  }

  function recordApprovalDecision(event: ApprovalDecisionEvent): void {
    const existing = approvals.get(event.approvalId);
    if (!existing) {
      throw new Error(`Approval decision without request: ${event.approvalId}`);
    }
    decisionEvents.push(event);
    approvals.set(event.approvalId, { ...existing, ...event });
  }

  function recordQueueDepth(sample: QueueDepthSample): void {
    queueDepthSamples.push(sample);
  }

  function recordSessionBlocked(event: SessionBlockedEvent): void {
    blockedEvents.push(event);
  }

  function recordResume(event: ResumeEvent): void {
    resumeEvents.push(event);
  }

  function recordDuplicateExecution(executionKey: string): void {
    if (executionKeys.has(executionKey)) {
      duplicateExecutionCount += 1;
      return;
    }
    executionKeys.add(executionKey);
  }

  function recordEvidenceArtifact(event: EvidenceArtifactEvent): void {
    evidenceEvents.push(event);
  }

  function recordRestart(event: RestartEvent): void {
    restartEvents.push(event);
  }

  function buildQueueMetrics(observedAtIso = new Date().toISOString()): QueueMetrics {
    const approvalCountByTier: Record<string, number> = {};
    const approvalCountBySession: Record<string, number> = {};
    const pendingAges = [];
    let denialCount = 0;
    let requestChangesCount = 0;
    let escalationCount = 0;
    let expiryCount = 0;

    for (const approval of approvals.values()) {
      incrementCounter(approvalCountByTier, approval.tier);
      incrementCounter(approvalCountBySession, approval.sessionId);

      pendingAges.push(durationMs(approval.requestedAtIso, approval.decidedAtIso ?? observedAtIso));
    }

    for (const event of decisionEvents) {
      if (event.status === 'denied') denialCount += 1;
      if (event.status === 'request_changes') requestChangesCount += 1;
      if (event.status === 'escalated') escalationCount += 1;
      if (event.status === 'expired') expiryCount += 1;
    }

    const resumeLatencies = resumeEvents.map((event) =>
      durationMs(event.decidedAtIso, event.resumedAtIso),
    );
    const blockedDurations = blockedEvents.map((event) =>
      durationMs(event.blockedAtIso, event.unblockedAtIso),
    );

    const metrics: Record<Iteration2MetricName, unknown> = {
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
    };

    return {
      schemaVersion: 1,
      scenarioId: options.scenarioId,
      attemptId: options.attemptId,
      generatedAtIso: observedAtIso,
      metrics,
    };
  }

  function buildEvidenceSummary(observedAtIso = new Date().toISOString()): EvidenceSummary {
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

  function evaluateThresholds(
    thresholds: Iteration2Thresholds,
    observedAtIso = new Date().toISOString(),
  ): readonly Iteration2Assertion[] {
    const queueMetrics = buildQueueMetrics(observedAtIso).metrics;
    const evidenceSummary = buildEvidenceSummary(observedAtIso);
    const assertions: Iteration2Assertion[] = [];

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
      const values = queueMetrics.resume_latency_ms as readonly number[];
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

  function writeArtifacts(
    observedAtIso = new Date().toISOString(),
    reportSections: readonly string[] = [],
  ): {
    queueMetricsPath: string;
    evidenceSummaryPath: string;
    reportPath: string;
  } {
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
        ...reportSections,
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
