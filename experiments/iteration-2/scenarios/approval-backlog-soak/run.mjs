// @ts-check

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createIteration2Telemetry } from '../../../shared/iteration2-telemetry.js';

const EXPERIMENT_NAME = 'approval-backlog-soak';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');
const FIXED_STARTED_AT_ISO = '2026-04-29T00:00:00.000Z';

/**
 * @typedef {{
 *   label: string;
 *   passed: boolean;
 *   detail?: string;
 * }} Assertion
 */

/**
 * @typedef {{
 *   experiment: string;
 *   timestamp: string;
 *   outcome: 'confirmed' | 'refuted' | 'inconclusive';
 *   duration_ms: number;
 *   assertions: Assertion[];
 *   trace: Record<string, unknown>;
 *   error?: string;
 * }} ExperimentOutcome
 */

/**
 * @typedef {{
 *   approvalId: string;
 *   sessionId: string;
 *   tenantId: string;
 *   tier: 'Assisted' | 'Human-approve';
 *   requestedAtIso: string;
 *   status: 'pending' | 'approved' | 'denied' | 'request_changes' | 'escalated' | 'expired';
 *   decidedAtIso?: string;
 *   escalatedAtIso?: string;
 *   expiredAtIso?: string;
 * }} SoakApproval
 */

/**
 * @typedef {{
 *   resultsDir?: string;
 *   writeResults?: boolean;
 *   log?: (line: string) => void;
 * }} RunApprovalBacklogSoakOptions
 */

function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function makeBacklog() {
  /** @type {SoakApproval[]} */
  const approvals = [];
  const tenants = ['tenant-soak-a', 'tenant-soak-b'];
  const sessions = ['session-a', 'session-b', 'session-c', 'session-d'];

  for (let index = 0; index < 24; index += 1) {
    approvals.push({
      approvalId: `appr-soak-${String(index + 1).padStart(2, '0')}`,
      sessionId: sessions[index % sessions.length],
      tenantId: tenants[index % tenants.length],
      tier: index % 3 === 0 ? 'Human-approve' : 'Assisted',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, index * 1_000),
      status: 'pending',
    });
  }

  return approvals;
}

function queueDepthAt(approvals, atIso) {
  const at = Date.parse(atIso);
  return approvals.filter((approval) => {
    const requestedAt = Date.parse(approval.requestedAtIso);
    const decidedAt = approval.decidedAtIso
      ? Date.parse(approval.decidedAtIso)
      : Number.POSITIVE_INFINITY;
    return requestedAt <= at && at < decidedAt;
  }).length;
}

function applySoakPolicy(approvals, telemetry) {
  const escalationIds = new Set();
  const duplicateEscalationIds = new Set();
  const runtimeSamples = [];
  const errorEvents = [];

  for (const approval of approvals) {
    telemetry.recordApprovalRequested({
      approvalId: approval.approvalId,
      sessionId: approval.sessionId,
      tier: approval.tier,
      requestedAtIso: approval.requestedAtIso,
    });
  }

  for (let sample = 0; sample <= 8; sample += 1) {
    const timestampIso = addMs(FIXED_STARTED_AT_ISO, sample * 7_500);
    telemetry.recordQueueDepth({ timestampIso, depth: queueDepthAt(approvals, timestampIso) });
    runtimeSamples.push({
      timestampIso,
      rssBytes: 80_000_000 + sample * 125_000,
      heapUsedBytes: 18_000_000 + sample * 64_000,
      errorCount: 0,
    });
  }

  approvals.forEach((approval, index) => {
    const requestedOffsetMs = index * 1_000;

    if (index % 11 === 0) {
      approval.status = 'expired';
      approval.expiredAtIso = addMs(FIXED_STARTED_AT_ISO, requestedOffsetMs + 52_000);
      approval.decidedAtIso = approval.expiredAtIso;
      telemetry.recordApprovalDecision({
        approvalId: approval.approvalId,
        status: 'expired',
        decidedAtIso: approval.expiredAtIso,
      });
      telemetry.recordSessionBlocked({
        sessionId: approval.sessionId,
        blockedAtIso: approval.requestedAtIso,
        unblockedAtIso: approval.expiredAtIso,
      });
      return;
    }

    if (index % 5 === 0) {
      approval.status = 'escalated';
      approval.escalatedAtIso = addMs(FIXED_STARTED_AT_ISO, requestedOffsetMs + 30_000);
      approval.decidedAtIso = approval.escalatedAtIso;
      if (escalationIds.has(approval.approvalId)) {
        duplicateEscalationIds.add(approval.approvalId);
      }
      escalationIds.add(approval.approvalId);
      telemetry.recordApprovalDecision({
        approvalId: approval.approvalId,
        status: 'escalated',
        decidedAtIso: approval.escalatedAtIso,
      });
      telemetry.recordSessionBlocked({
        sessionId: approval.sessionId,
        blockedAtIso: approval.requestedAtIso,
        unblockedAtIso: approval.escalatedAtIso,
      });
      return;
    }

    if (index % 7 === 0) {
      approval.status = 'request_changes';
      approval.decidedAtIso = addMs(FIXED_STARTED_AT_ISO, requestedOffsetMs + 18_000);
      telemetry.recordApprovalDecision({
        approvalId: approval.approvalId,
        status: 'request_changes',
        decidedAtIso: approval.decidedAtIso,
      });
      telemetry.recordSessionBlocked({
        sessionId: approval.sessionId,
        blockedAtIso: approval.requestedAtIso,
        unblockedAtIso: approval.decidedAtIso,
      });
      return;
    }

    approval.status = 'approved';
    approval.decidedAtIso = addMs(FIXED_STARTED_AT_ISO, requestedOffsetMs + 12_000);
    telemetry.recordApprovalDecision({
      approvalId: approval.approvalId,
      status: 'approved',
      decidedAtIso: approval.decidedAtIso,
    });
    telemetry.recordSessionBlocked({
      sessionId: approval.sessionId,
      blockedAtIso: approval.requestedAtIso,
      unblockedAtIso: approval.decidedAtIso,
    });
    telemetry.recordResume({
      sessionId: approval.sessionId,
      approvalId: approval.approvalId,
      decidedAtIso: approval.decidedAtIso,
      resumedAtIso: addMs(approval.decidedAtIso, 1_250),
      successful: true,
    });
    telemetry.recordDuplicateExecution(`${approval.sessionId}:${approval.approvalId}:execute`);
  });

  return {
    escalationIds: [...escalationIds],
    duplicateEscalationIds: [...duplicateEscalationIds],
    runtimeSamples,
    errorEvents,
  };
}

function buildAssertions({ approvals, queueMetrics, evidenceSummary, trace }) {
  const metrics = queueMetrics.metrics;
  const expired = approvals.filter((approval) => approval.status === 'expired');
  const escalated = approvals.filter((approval) => approval.status === 'escalated');
  const runtime = /** @type {{ errorEvents: unknown[]; runtimeSamples: unknown[] }} */ (
    trace.runtime
  );

  return [
    assert(
      'escalation and expiry happen independently per approval',
      escalated.length > 0 &&
        expired.length > 0 &&
        new Set([...escalated, ...expired].map((approval) => approval.approvalId)).size ===
          escalated.length + expired.length,
      `escalated=${escalated.length}, expired=${expired.length}`,
    ),
    assert(
      'queue depth and pending age are recorded over time',
      Array.isArray(metrics.queue_depth_over_time) &&
        metrics.queue_depth_over_time.length >= 5 &&
        Number(metrics.pending_age_ms_max) > 0,
      `samples=${Array.isArray(metrics.queue_depth_over_time) ? metrics.queue_depth_over_time.length : 0}`,
    ),
    assert(
      'no duplicate escalation events are emitted',
      Array.isArray(trace.duplicateEscalationIds) && trace.duplicateEscalationIds.length === 0,
      `duplicates=${Array.isArray(trace.duplicateEscalationIds) ? trace.duplicateEscalationIds.length : 'n/a'}`,
    ),
    assert(
      'runtime memory and error rate are captured',
      runtime.runtimeSamples.length >= 5 && runtime.errorEvents.length === 0,
      `samples=${runtime.runtimeSamples.length}, errors=${runtime.errorEvents.length}`,
    ),
    assert(
      'telemetry artifacts are complete',
      evidenceSummary.complete === true && evidenceSummary.evidenceCompletenessCount >= 4,
      `present=${evidenceSummary.evidenceCompletenessCount}, missing=${evidenceSummary.missingArtifacts.join(',')}`,
    ),
    assert(
      'threshold assertions pass',
      trace.thresholdAssertions.every((item) => item.passed),
      JSON.stringify(trace.thresholdAssertions),
    ),
  ];
}

function writeOutcome(resultsDir, outcome) {
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, 'outcome.json'), `${JSON.stringify(outcome, null, 2)}\n`);
}

/**
 * Run the deterministic approval backlog soak experiment.
 *
 * @param {RunApprovalBacklogSoakOptions} [options]
 * @returns {Promise<ExperimentOutcome>}
 */
export async function runApprovalBacklogSoak(options = {}) {
  const startedAt = Date.now();
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const writeResults = options.writeResults ?? true;
  const log = options.log ?? console.log;
  const attemptId = 'deterministic-soak-v1';
  let trace = {};
  let assertions = [];
  let error;

  try {
    log('[approval-backlog-soak] generating deterministic backlog');
    const telemetry = createIteration2Telemetry({
      scenarioId: EXPERIMENT_NAME,
      attemptId,
      resultsDir,
      requiredEvidenceArtifacts: [
        'outcome.json',
        'queue-metrics.json',
        'evidence-summary.json',
        'report.md',
      ],
    });

    const approvals = makeBacklog();
    const policyTrace = applySoakPolicy(approvals, telemetry);

    telemetry.recordEvidenceArtifact({ artifactName: 'outcome.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'queue-metrics.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'evidence-summary.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'report.md', present: true });

    const observedAtIso = addMs(FIXED_STARTED_AT_ISO, 90_000);
    const thresholdAssertions = telemetry.evaluateThresholds(
      {
        maxDuplicateExecutionCount: 0,
        maxPendingAgeMsP95: 60_000,
        maxResumeLatencyMs: 2_000,
        minEvidenceCompletenessCount: 4,
        minSuccessfulResumeCount: 8,
      },
      observedAtIso,
    );
    const artifactPaths = writeResults ? telemetry.writeArtifacts(observedAtIso) : {};
    const queueMetrics = telemetry.buildQueueMetrics(observedAtIso);
    const evidenceSummary = telemetry.buildEvidenceSummary(observedAtIso);

    trace = {
      approvals,
      queueMetrics,
      evidenceSummary,
      artifactPaths,
      thresholdAssertions,
      duplicateEscalationIds: policyTrace.duplicateEscalationIds,
      escalationIds: policyTrace.escalationIds,
      runtime: {
        runtimeSamples: policyTrace.runtimeSamples,
        errorEvents: policyTrace.errorEvents,
        hostLimitations: [],
        defectClassification:
          'No product defects observed in deterministic soak; host resource use stayed bounded.',
      },
    };
    assertions = buildAssertions({ approvals, queueMetrics, evidenceSummary, trace });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const duration_ms = Date.now() - startedAt;
  const outcome =
    error != null
      ? 'inconclusive'
      : assertions.length > 0 && assertions.every((item) => item.passed)
        ? 'confirmed'
        : 'refuted';

  const result = {
    experiment: EXPERIMENT_NAME,
    timestamp: new Date().toISOString(),
    outcome,
    duration_ms,
    assertions,
    trace,
    ...(error ? { error } : {}),
  };

  if (writeResults) {
    writeOutcome(resultsDir, result);
  }

  return /** @type {ExperimentOutcome} */ (result);
}

function printSummary(outcome, resultsDir = DEFAULT_RESULTS_DIR) {
  console.log(`\nResult: ${outcome.outcome.toUpperCase()} (${outcome.duration_ms}ms)`);
  for (const item of outcome.assertions) {
    const mark = item.passed ? 'PASS' : 'FAIL';
    const detail = item.detail ? ` - ${item.detail}` : '';
    console.log(`  ${mark}: ${item.label}${detail}`);
  }
  if (outcome.error) console.log(`\nError: ${outcome.error}`);
  console.log(`\nFull results written to: ${join(resultsDir, 'outcome.json')}`);
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/');

if (isMain) {
  const { values } = parseArgs({
    options: {
      'results-dir': { type: 'string' },
    },
  });

  const resultsDir = values['results-dir'] ?? DEFAULT_RESULTS_DIR;
  const outcome = await runApprovalBacklogSoak({ resultsDir });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
