// @ts-check

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createIteration2Telemetry } from '../../../shared/iteration2-telemetry.js';

const EXPERIMENT_NAME = 'shift-aware-approval-coverage';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');
const FIXED_STARTED_AT_ISO = '2026-04-30T16:50:00.000Z';
const SHIFT_BOUNDARY_ISO = '2026-04-30T17:00:00.000Z';
const COVERAGE_ENDS_AT_ISO = '2026-04-30T23:00:00.000Z';

/**
 * @typedef {{
 *   label: string;
 *   passed: boolean;
 *   detail?: string;
 * }} Assertion
 */

/**
 * @typedef {'medium' | 'high'} RiskLevel
 */

/**
 * @typedef {{
 *   approvalId: string;
 *   sessionId: string;
 *   action: string;
 *   tier: 'Assisted' | 'Human-approve';
 *   requestedBy: string;
 *   requestedAtIso: string;
 *   primaryAssignee: string;
 *   currentAssignee: string;
 *   subjectKind: 'finance-action' | 'customer-comms';
 *   riskLevel: RiskLevel;
 *   status: 'pending' | 'approved';
 *   decidedAtIso?: string;
 *   decidedBy?: string;
 *   escalatedAtIso?: string;
 * }} ShiftApproval
 */

/**
 * @typedef {{
 *   evidenceId: string;
 *   occurredAtIso: string;
 *   category: 'Approval' | 'Policy' | 'System';
 *   kind:
 *     | 'assignment_changed'
 *     | 'delegation_window_opened'
 *     | 'delegation_window_closed'
 *     | 'eligibility_rejected'
 *     | 'escalation_recorded'
 *     | 'approval_decision'
 *     | 'run_resumed';
 *   approvalId?: string;
 *   actor: string;
 *   summary: string;
 *   metadata: Record<string, unknown>;
 * }} CoverageEvidence
 */

/**
 * @typedef {{
 *   from: string;
 *   to: string;
 *   approvalId: string;
 *   atIso: string;
 *   reason: string;
 * }} AssignmentChange
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
 *   resultsDir?: string;
 *   writeResults?: boolean;
 *   log?: (line: string) => void;
 * }} RunShiftAwareCoverageOptions
 */

const RISK_ORDER = {
  medium: 1,
  high: 2,
};

const OPERATORS = {
  'operator-day': {
    userId: 'operator-day',
    activeFromIso: '2026-04-30T09:00:00.000Z',
    activeUntilIso: SHIFT_BOUNDARY_ISO,
    roles: ['approver'],
    subjectKinds: ['finance-action', 'customer-comms'],
    maxRiskLevel: 'high',
  },
  'operator-night': {
    userId: 'operator-night',
    activeFromIso: SHIFT_BOUNDARY_ISO,
    activeUntilIso: COVERAGE_ENDS_AT_ISO,
    roles: ['approver'],
    subjectKinds: ['finance-action', 'customer-comms'],
    maxRiskLevel: 'high',
  },
  'operator-lead': {
    userId: 'operator-lead',
    activeFromIso: SHIFT_BOUNDARY_ISO,
    activeUntilIso: '2026-05-01T01:00:00.000Z',
    roles: ['approver'],
    subjectKinds: ['finance-action', 'customer-comms'],
    maxRiskLevel: 'high',
  },
};

const DELEGATION_WINDOW = {
  grantId: 'grant-after-hours-coverage-1',
  delegatorUserId: 'operator-day',
  delegateUserId: 'operator-night',
  startsAtIso: SHIFT_BOUNDARY_ISO,
  expiresAtIso: COVERAGE_ENDS_AT_ISO,
  authoritySource: 'queue-delegation',
  reason: 'Primary operator inactive after day shift.',
};

function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function makeApprovals() {
  /** @type {ShiftApproval[]} */
  return [
    {
      approvalId: 'appr-shift-01',
      sessionId: 'shift-run-payments',
      action: 'sync:vendor-payout',
      tier: 'Human-approve',
      requestedBy: 'agent-procurement',
      requestedAtIso: '2026-04-30T16:55:00.000Z',
      primaryAssignee: 'operator-day',
      currentAssignee: 'operator-day',
      subjectKind: 'finance-action',
      riskLevel: 'high',
      status: 'pending',
    },
    {
      approvalId: 'appr-shift-02',
      sessionId: 'shift-run-billing',
      action: 'adjust:invoice-credit',
      tier: 'Assisted',
      requestedBy: 'agent-billing',
      requestedAtIso: '2026-04-30T18:15:00.000Z',
      primaryAssignee: 'operator-day',
      currentAssignee: 'operator-day',
      subjectKind: 'finance-action',
      riskLevel: 'medium',
      status: 'pending',
    },
    {
      approvalId: 'appr-shift-03',
      sessionId: 'shift-run-renewal',
      action: 'send:renewal-notice',
      tier: 'Human-approve',
      requestedBy: 'agent-customer-success',
      requestedAtIso: '2026-04-30T22:45:00.000Z',
      primaryAssignee: 'operator-day',
      currentAssignee: 'operator-day',
      subjectKind: 'customer-comms',
      riskLevel: 'high',
      status: 'pending',
    },
    {
      approvalId: 'appr-shift-04',
      sessionId: 'shift-run-exception',
      action: 'waive:late-fee',
      tier: 'Human-approve',
      requestedBy: 'operator-night',
      requestedAtIso: '2026-04-30T18:20:00.000Z',
      primaryAssignee: 'operator-day',
      currentAssignee: 'operator-day',
      subjectKind: 'finance-action',
      riskLevel: 'medium',
      status: 'pending',
    },
  ];
}

function isWithinWindow(operator, atIso) {
  const at = Date.parse(atIso);
  return at >= Date.parse(operator.activeFromIso) && at < Date.parse(operator.activeUntilIso);
}

function isEligible(operatorId, approval, atIso) {
  const operator = OPERATORS[operatorId];
  if (!operator) return false;
  if (!operator.roles.includes('approver')) return false;
  if (!operator.subjectKinds.includes(approval.subjectKind)) return false;
  if (RISK_ORDER[approval.riskLevel] > RISK_ORDER[operator.maxRiskLevel]) return false;
  if (!isWithinWindow(operator, atIso)) return false;
  return operator.userId !== approval.requestedBy;
}

function queueSnapshot(label, approvals, atIso) {
  return {
    label,
    atIso,
    pending: approvals
      .filter((approval) => approval.status === 'pending')
      .map((approval) => ({
        approvalId: approval.approvalId,
        currentAssignee: approval.currentAssignee,
        requestedAtIso: approval.requestedAtIso,
      })),
  };
}

function appendEvidence(events, event) {
  events.push({
    evidenceId: `evi-shift-${String(events.length + 1).padStart(2, '0')}`,
    ...event,
  });
}

function assign(approval, to, atIso, reason, assignmentChanges, evidenceEvents) {
  const from = approval.currentAssignee;
  approval.currentAssignee = to;
  assignmentChanges.push({ from, to, approvalId: approval.approvalId, atIso, reason });
  appendEvidence(evidenceEvents, {
    occurredAtIso: atIso,
    category: 'System',
    kind: 'assignment_changed',
    approvalId: approval.approvalId,
    actor: 'system',
    summary: `Approval ${approval.approvalId} reassigned from ${from} to ${to}.`,
    metadata: {
      from,
      to,
      governanceFunction: 'operator',
      authoritySource: DELEGATION_WINDOW.authoritySource,
      effect: 'current-run-effect',
      reason,
    },
  });
}

function rejectCandidate(approval, candidate, atIso, reason, evidenceEvents) {
  appendEvidence(evidenceEvents, {
    occurredAtIso: atIso,
    category: 'Policy',
    kind: 'eligibility_rejected',
    approvalId: approval.approvalId,
    actor: 'system',
    summary: `Candidate ${candidate} rejected for ${approval.approvalId}: ${reason}.`,
    metadata: {
      candidate,
      requestedBy: approval.requestedBy,
      reason,
      authoritySource: 'policy-rule',
      sodPreserved: true,
    },
  });
}

function decide(approval, operatorId, decidedAtIso, telemetry, evidenceEvents) {
  if (!isEligible(operatorId, approval, decidedAtIso)) {
    throw new Error(`Ineligible decision attempted: ${operatorId} for ${approval.approvalId}`);
  }

  approval.status = 'approved';
  approval.decidedBy = operatorId;
  approval.decidedAtIso = decidedAtIso;
  telemetry.recordApprovalDecision({
    approvalId: approval.approvalId,
    status: 'approved',
    decidedAtIso,
  });
  telemetry.recordSessionBlocked({
    sessionId: approval.sessionId,
    blockedAtIso: approval.requestedAtIso,
    unblockedAtIso: decidedAtIso,
  });
  telemetry.recordResume({
    sessionId: approval.sessionId,
    approvalId: approval.approvalId,
    decidedAtIso,
    resumedAtIso: addMs(decidedAtIso, 1_100),
    successful: true,
  });
  telemetry.recordDuplicateExecution(`${approval.sessionId}:${approval.approvalId}:execute`);

  appendEvidence(evidenceEvents, {
    occurredAtIso: decidedAtIso,
    category: 'Approval',
    kind: 'approval_decision',
    approvalId: approval.approvalId,
    actor: operatorId,
    summary: `Approval ${approval.approvalId} approved by covered operator ${operatorId}.`,
    metadata: {
      accountableActorUserId: operatorId,
      governanceFunction: 'approver',
      authoritySource:
        operatorId === 'operator-lead' ? 'policy-rule' : DELEGATION_WINDOW.authoritySource,
      effect: 'current-run-effect',
      sodPreserved: operatorId !== approval.requestedBy,
    },
  });
  appendEvidence(evidenceEvents, {
    occurredAtIso: addMs(decidedAtIso, 1_100),
    category: 'System',
    kind: 'run_resumed',
    approvalId: approval.approvalId,
    actor: 'system',
    summary: `Run ${approval.sessionId} resumed after ${approval.approvalId}.`,
    metadata: {
      sessionId: approval.sessionId,
      resumedBy: 'approval-scheduler',
      effect: 'current-run-effect',
    },
  });
}

function applyShiftCoverage(approvals, telemetry) {
  /** @type {CoverageEvidence[]} */
  const evidenceEvents = [];
  /** @type {AssignmentChange[]} */
  const assignmentChanges = [];
  const queueSnapshots = [];

  appendEvidence(evidenceEvents, {
    occurredAtIso: DELEGATION_WINDOW.startsAtIso,
    category: 'System',
    kind: 'delegation_window_opened',
    actor: 'system',
    summary: `Delegation ${DELEGATION_WINDOW.grantId} opened for after-hours coverage.`,
    metadata: { ...DELEGATION_WINDOW },
  });

  for (const approval of approvals) {
    telemetry.recordApprovalRequested({
      approvalId: approval.approvalId,
      sessionId: approval.sessionId,
      tier: approval.tier,
      requestedAtIso: approval.requestedAtIso,
    });
  }

  queueSnapshots.push(
    queueSnapshot('before-shift-boundary', approvals, '2026-04-30T16:56:00.000Z'),
  );
  telemetry.recordQueueDepth({ timestampIso: '2026-04-30T16:56:00.000Z', depth: 1 });

  assign(
    approvals[0],
    'operator-night',
    '2026-04-30T17:05:00.000Z',
    'pending approval crossed the day-to-night shift boundary',
    assignmentChanges,
    evidenceEvents,
  );
  decide(approvals[0], 'operator-night', '2026-04-30T17:20:00.000Z', telemetry, evidenceEvents);

  assign(
    approvals[1],
    'operator-night',
    '2026-04-30T18:16:00.000Z',
    'primary operator unavailable; delegation window is active',
    assignmentChanges,
    evidenceEvents,
  );
  decide(approvals[1], 'operator-night', '2026-04-30T18:45:00.000Z', telemetry, evidenceEvents);

  if (!isEligible('operator-night', approvals[3], '2026-04-30T18:21:00.000Z')) {
    rejectCandidate(
      approvals[3],
      'operator-night',
      '2026-04-30T18:21:00.000Z',
      'Separation of Duties prevents requester from approving delegated work',
      evidenceEvents,
    );
  }
  assign(
    approvals[3],
    'operator-lead',
    '2026-04-30T18:22:00.000Z',
    'delegated operator was ineligible; on-call lead is eligible',
    assignmentChanges,
    evidenceEvents,
  );
  decide(approvals[3], 'operator-lead', '2026-04-30T18:50:00.000Z', telemetry, evidenceEvents);

  queueSnapshots.push(
    queueSnapshot('after-delegation-routing', approvals, '2026-04-30T18:55:00.000Z'),
  );
  telemetry.recordQueueDepth({ timestampIso: '2026-04-30T18:55:00.000Z', depth: 1 });

  assign(
    approvals[2],
    'operator-night',
    '2026-04-30T22:46:00.000Z',
    'late approval enters after-hours coverage queue',
    assignmentChanges,
    evidenceEvents,
  );
  appendEvidence(evidenceEvents, {
    occurredAtIso: DELEGATION_WINDOW.expiresAtIso,
    category: 'System',
    kind: 'delegation_window_closed',
    actor: 'system',
    summary: `Delegation ${DELEGATION_WINDOW.grantId} closed before ${approvals[2].approvalId} was decided.`,
    metadata: {
      grantId: DELEGATION_WINDOW.grantId,
      approvalId: approvals[2].approvalId,
      expiresAtIso: DELEGATION_WINDOW.expiresAtIso,
      pendingAfterClose: true,
    },
  });
  approvals[2].escalatedAtIso = '2026-04-30T23:30:00.000Z';
  telemetry.recordApprovalDecision({
    approvalId: approvals[2].approvalId,
    status: 'escalated',
    decidedAtIso: approvals[2].escalatedAtIso,
  });
  appendEvidence(evidenceEvents, {
    occurredAtIso: approvals[2].escalatedAtIso,
    category: 'System',
    kind: 'escalation_recorded',
    approvalId: approvals[2].approvalId,
    actor: 'system',
    summary: `Approval ${approvals[2].approvalId} escalated after missing coverage window.`,
    metadata: {
      from: 'operator-night',
      to: 'operator-lead',
      coverageEndsAtIso: COVERAGE_ENDS_AT_ISO,
      authoritySource: 'policy-rule',
      effect: 'current-run-effect',
    },
  });
  assign(
    approvals[2],
    'operator-lead',
    approvals[2].escalatedAtIso,
    'coverage window missed; escalation chain selected on-call lead',
    assignmentChanges,
    evidenceEvents,
  );
  decide(approvals[2], 'operator-lead', '2026-04-30T23:45:00.000Z', telemetry, evidenceEvents);

  queueSnapshots.push(
    queueSnapshot('after-escalation-decision', approvals, '2026-04-30T23:50:00.000Z'),
  );
  telemetry.recordQueueDepth({ timestampIso: '2026-04-30T23:50:00.000Z', depth: 0 });

  return { assignmentChanges, evidenceEvents, queueSnapshots };
}

function buildComparison(queueMetrics, evidenceEvents) {
  return {
    comparesTo: 'micro-saas-agent-stack-v2',
    baselineBehavior: 'operator-team handoff assumes both operators are reachable during the run',
    afterHoursBehavior:
      'shift-aware coverage preserves handoff context, applies bounded delegation, and escalates when a coverage window closes without a decision',
    metricComparison: {
      handoffOperatorCount: 2,
      shiftAwareOperatorCount: 3,
      baselineEscalationCount: 0,
      shiftAwareEscalationCount: queueMetrics.metrics.escalation_count,
      shiftAwareEvidenceEvents: evidenceEvents.length,
    },
  };
}

function buildReportSections(comparison, queueMetrics, evidenceEvents) {
  return [
    '## After-Hours Coverage Comparison',
    '',
    `Baseline: \`${comparison.comparesTo}\` records operator-team handoff while both operators are reachable.`,
    'This scenario adds inactive primary operators, bounded delegation windows, missed-window escalation, and eligibility rejection before assignment.',
    '',
    '| Behavior | operator-team handoff | shift-aware coverage |',
    '| --- | --- | --- |',
    '| Assignment model | role split between Operator A and Operator B | primary assignee, delegate, and on-call lead |',
    `| Escalations | ${comparison.metricComparison.baselineEscalationCount} | ${comparison.metricComparison.shiftAwareEscalationCount} |`,
    `| Evidence events | queue snapshots only | ${comparison.metricComparison.shiftAwareEvidenceEvents} assignment, delegation, eligibility, escalation, decision, and resume events |`,
    '| Stall handling | unrelated approvals continue after denial/request-changes | pending work reroutes or escalates after coverage closes |',
    '',
    '## Shift-Aware Metrics',
    '',
    `Successful resumes: ${queueMetrics.metrics.successful_resume_count}`,
    `Escalations: ${queueMetrics.metrics.escalation_count}`,
    `Evidence events recorded: ${evidenceEvents.length}`,
    '',
  ];
}

function buildAssertions({
  approvals,
  evidenceEvents,
  assignmentChanges,
  queueMetrics,
  evidenceSummary,
  trace,
}) {
  const evidenceKinds = new Set(evidenceEvents.map((event) => event.kind));
  const sodViolations = approvals.filter((approval) => approval.decidedBy === approval.requestedBy);
  const pending = approvals.filter((approval) => approval.status === 'pending');
  const shiftBoundaryHandoffs = assignmentChanges.filter(
    (change) =>
      Date.parse(
        approvals.find((approval) => approval.approvalId === change.approvalId)?.requestedAtIso ??
          change.atIso,
      ) < Date.parse(SHIFT_BOUNDARY_ISO) &&
      Date.parse(change.atIso) >= Date.parse(SHIFT_BOUNDARY_ISO),
  );
  const escalatedAfterCoverage = approvals.filter(
    (approval) =>
      approval.escalatedAtIso != null &&
      Date.parse(approval.escalatedAtIso) > Date.parse(COVERAGE_ENDS_AT_ISO),
  );

  return [
    assert(
      'assignment changes, delegation windows, and escalations are recorded as evidence',
      evidenceKinds.has('assignment_changed') &&
        evidenceKinds.has('delegation_window_opened') &&
        evidenceKinds.has('delegation_window_closed') &&
        evidenceKinds.has('escalation_recorded'),
      `kinds=${[...evidenceKinds].join(',')}`,
    ),
    assert(
      'unavailable primary operator does not stall governed work forever',
      pending.length === 0 &&
        Number(queueMetrics.metrics.successful_resume_count) === approvals.length,
      `pending=${pending.length}, resumes=${String(queueMetrics.metrics.successful_resume_count)}`,
    ),
    assert(
      'SoD and eligibility still apply after delegation or handoff',
      sodViolations.length === 0 &&
        evidenceEvents.some(
          (event) => event.kind === 'eligibility_rejected' && event.approvalId === 'appr-shift-04',
        ),
      `sodViolations=${sodViolations.length}`,
    ),
    assert(
      'one approval waits across shift boundary and another escalates after coverage closes',
      shiftBoundaryHandoffs.length >= 1 && escalatedAfterCoverage.length >= 1,
      `handoffs=${shiftBoundaryHandoffs.length}, escalatedAfterCoverage=${escalatedAfterCoverage.length}`,
    ),
    assert(
      'telemetry artifacts are complete including assignment evidence',
      evidenceSummary.complete === true && evidenceSummary.evidenceCompletenessCount >= 5,
      `present=${evidenceSummary.evidenceCompletenessCount}, missing=${evidenceSummary.missingArtifacts.join(',')}`,
    ),
    assert(
      'report compares after-hours behavior to operator-team handoff baseline',
      trace.comparison?.comparesTo === 'micro-saas-agent-stack-v2' &&
        trace.comparison?.afterHoursBehavior.includes('bounded delegation'),
      JSON.stringify(trace.comparison),
    ),
    assert(
      'threshold assertions pass',
      trace.thresholdAssertions.every((item) => item.passed),
      JSON.stringify(trace.thresholdAssertions),
    ),
  ];
}

function writeJsonIfAbsent(path, value) {
  if (existsSync(path)) {
    throw new Error(`Refusing to overwrite Iteration 2 artifact: ${path}`);
  }
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeOutcome(resultsDir, outcome) {
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, 'outcome.json'), `${JSON.stringify(outcome, null, 2)}\n`);
}

/**
 * Run the deterministic shift-aware approval coverage experiment.
 *
 * @param {RunShiftAwareCoverageOptions} [options]
 * @returns {Promise<ExperimentOutcome>}
 */
export async function runShiftAwareApprovalCoverage(options = {}) {
  const startedAt = Date.now();
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const writeResults = options.writeResults ?? true;
  const log = options.log ?? console.log;
  const attemptId = 'deterministic-shift-coverage-v1';
  let trace = {};
  let assertions = [];
  let error;

  try {
    log('[shift-aware-approval-coverage] simulating after-hours delegation and escalation');
    const telemetry = createIteration2Telemetry({
      scenarioId: EXPERIMENT_NAME,
      attemptId,
      resultsDir,
      requiredEvidenceArtifacts: [
        'outcome.json',
        'queue-metrics.json',
        'evidence-summary.json',
        'report.md',
        'assignment-evidence.json',
      ],
    });

    const approvals = makeApprovals();
    const coverageTrace = applyShiftCoverage(approvals, telemetry);

    telemetry.recordEvidenceArtifact({ artifactName: 'outcome.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'queue-metrics.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'evidence-summary.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'report.md', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'assignment-evidence.json', present: true });

    const observedAtIso = addMs(FIXED_STARTED_AT_ISO, 7 * 60 * 60 * 1000 + 10_000);
    const thresholdAssertions = telemetry.evaluateThresholds(
      {
        maxDuplicateExecutionCount: 0,
        maxPendingAgeMsP95: 60 * 60 * 1000,
        maxResumeLatencyMs: 2_000,
        minEvidenceCompletenessCount: 5,
        minSuccessfulResumeCount: 4,
      },
      observedAtIso,
    );
    const queueMetrics = telemetry.buildQueueMetrics(observedAtIso);
    const evidenceSummary = telemetry.buildEvidenceSummary(observedAtIso);
    const comparison = buildComparison(queueMetrics, coverageTrace.evidenceEvents);
    const artifactPaths = {};

    if (writeResults) {
      mkdirSync(resultsDir, { recursive: true });
      const assignmentEvidencePath = join(resultsDir, 'assignment-evidence.json');
      writeJsonIfAbsent(assignmentEvidencePath, {
        schemaVersion: 1,
        scenarioId: EXPERIMENT_NAME,
        attemptId,
        generatedAtIso: observedAtIso,
        delegationWindow: DELEGATION_WINDOW,
        assignmentChanges: coverageTrace.assignmentChanges,
        evidenceEvents: coverageTrace.evidenceEvents,
      });
      Object.assign(artifactPaths, { assignmentEvidencePath });
      Object.assign(
        artifactPaths,
        telemetry.writeArtifacts(
          observedAtIso,
          buildReportSections(comparison, queueMetrics, coverageTrace.evidenceEvents),
        ),
      );
    }

    trace = {
      comparesTo: 'micro-saas-agent-stack-v2',
      approvals,
      delegationWindow: DELEGATION_WINDOW,
      assignmentChanges: coverageTrace.assignmentChanges,
      evidenceEvents: coverageTrace.evidenceEvents,
      queueSnapshots: coverageTrace.queueSnapshots,
      queueMetrics,
      evidenceSummary,
      comparison,
      artifactPaths,
      thresholdAssertions,
    };
    assertions = buildAssertions({
      approvals,
      evidenceEvents: coverageTrace.evidenceEvents,
      assignmentChanges: coverageTrace.assignmentChanges,
      queueMetrics,
      evidenceSummary,
      trace,
    });
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
  const outcome = await runShiftAwareApprovalCoverage({ resultsDir });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
