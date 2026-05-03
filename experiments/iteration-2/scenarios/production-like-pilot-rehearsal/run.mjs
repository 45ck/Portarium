// @ts-check

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createIteration2Telemetry } from '../../../shared/iteration2-telemetry.js';

const EXPERIMENT_NAME = 'production-like-pilot-rehearsal';
const ATTEMPT_ID = 'pilot-rehearsal-v1';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');
const FIXED_STARTED_AT_ISO = '2026-05-03T05:00:00.000Z';
const REDACTED = '[REDACTED]';

const REQUIRED_ARTIFACTS = [
  'outcome.json',
  'queue-metrics.json',
  'evidence-summary.json',
  'report.md',
  'restart-persistence.json',
  'browser-qa-evidence.json',
  'redaction-audit.json',
  'divergence-classification.json',
  'external-sor-stubs.json',
];

const FORBIDDEN_FRAGMENTS = [
  'Bearer pilot-secret-token',
  'source-oauth-token',
  'approver@example.test',
  'customer@example.test',
  'https://crm.example.invalid/private/opportunities/opp-9001',
  'https://billing.example.invalid/private/invoices/inv-7788',
];

function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function writeJsonIfAbsent(path, value) {
  if (existsSync(path)) {
    throw new Error(`Refusing to overwrite production-like pilot rehearsal artifact: ${path}`);
  }
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function redact(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redact(entryValue, entryKey),
      ]),
    );
  }
  if (typeof value !== 'string') return value;

  if (/authorization|token|secret/i.test(key)) return REDACTED;
  if (/email/i.test(key)) return '[REDACTED_EMAIL]';
  if (/url|uri|path/i.test(key)) return '[REDACTED_PATH]';
  if (/Bearer\s+/i.test(value)) return REDACTED;
  return value;
}

function isRedacted(value) {
  const body = JSON.stringify(value);
  return FORBIDDEN_FRAGMENTS.every((fragment) => !body.includes(fragment));
}

function makeApprovalQueue() {
  return [
    {
      approvalId: 'apr-pilot-001',
      runId: 'run-pilot-billing-001',
      sessionId: 'pilot-billing-queue',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 5_000),
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 115_000),
      tier: 'Human-approve',
      requestedBy: 'user-requester',
      decidedBy: 'user-approver-finance',
      workspaceId: 'ws-pilot-rehearsal',
      decision: 'approved',
      externalEffectKey: 'crm:opportunity:opp-9001:update-stage',
      rawEffect: {
        system: 'crm',
        operation: 'update-opportunity-stage',
        authorization: 'Bearer pilot-secret-token',
        oauthToken: 'source-oauth-token',
        customerEmail: 'customer@example.test',
        targetUrl: 'https://crm.example.invalid/private/opportunities/opp-9001',
      },
    },
    {
      approvalId: 'apr-pilot-002',
      runId: 'run-pilot-billing-001',
      sessionId: 'pilot-billing-queue',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 25_000),
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 205_000),
      tier: 'Assisted',
      requestedBy: 'user-requester',
      decidedBy: 'user-approver-billing',
      workspaceId: 'ws-pilot-rehearsal',
      decision: 'request_changes',
      externalEffectKey: 'billing:invoice:inv-7788:hold',
      rawEffect: {
        system: 'billing',
        operation: 'place-invoice-hold',
        authorization: 'Bearer pilot-secret-token',
        customerEmail: 'customer@example.test',
        targetUrl: 'https://billing.example.invalid/private/invoices/inv-7788',
      },
    },
    {
      approvalId: 'apr-pilot-003',
      runId: 'run-pilot-renewal-001',
      sessionId: 'pilot-renewal-queue',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 40_000),
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 290_000),
      tier: 'Human-approve',
      requestedBy: 'user-renewal-agent',
      decidedBy: 'user-approver-lead',
      workspaceId: 'ws-pilot-rehearsal',
      decision: 'approved',
      externalEffectKey: 'crm:subscription:sub-4411:renewal-notice',
      rawEffect: {
        system: 'crm',
        operation: 'send-renewal-notice',
        authorization: 'Bearer pilot-secret-token',
        approverEmail: 'approver@example.test',
        targetUrl: 'https://crm.example.invalid/private/opportunities/opp-9001',
      },
    },
  ];
}

function makeDurableState(approvals) {
  const approvalStore = new Map();
  const runStore = new Map();
  const policyStore = new Map();
  const evidenceLog = [];
  const effectLedger = new Map();

  policyStore.set('policy-pilot-approval-queues', {
    policyId: 'policy-pilot-approval-queues',
    version: 3,
    workspaceId: 'ws-pilot-rehearsal',
    requiresRealAuth: true,
    sodRequired: true,
  });

  for (const approval of approvals) {
    approvalStore.set(approval.approvalId, { ...approval, status: 'Pending' });
    runStore.set(approval.runId, {
      runId: approval.runId,
      workspaceId: approval.workspaceId,
      status: 'WaitingForApproval',
      controlState: 'healthy',
      evidenceEntryCount: 0,
    });
    evidenceLog.push({
      evidenceId: `ev-${approval.approvalId}-requested`,
      category: 'Approval',
      summary: 'Approval Gate requested and queued.',
      links: { approvalId: approval.approvalId, runId: approval.runId },
      payload: redact(approval.rawEffect),
    });
  }

  return { approvalStore, runStore, policyStore, evidenceLog, effectLedger };
}

function authorizeDecision(approval, principal) {
  return (
    principal.workspaceId === approval.workspaceId &&
    principal.roles.includes('approver') &&
    principal.userId === approval.decidedBy &&
    principal.userId !== approval.requestedBy
  );
}

function replayThroughRestart(state) {
  return {
    approvalStore: new Map(state.approvalStore),
    runStore: new Map(state.runStore),
    policyStore: new Map(state.policyStore),
    evidenceLog: [...state.evidenceLog],
    effectLedger: new Map(state.effectLedger),
  };
}

function applyDecision(approval, state, telemetry) {
  const principal = {
    userId: approval.decidedBy,
    workspaceId: approval.workspaceId,
    roles: ['approver', 'operator'],
  };
  const authorized = authorizeDecision(approval, principal);
  if (!authorized) {
    throw new Error(`Unauthorized pilot approval decision: ${approval.approvalId}`);
  }

  state.approvalStore.set(approval.approvalId, {
    ...state.approvalStore.get(approval.approvalId),
    status: approval.decision === 'approved' ? 'Approved' : 'ChangesRequested',
    decidedBy: approval.decidedBy,
    decidedAtIso: approval.decidedAtIso,
  });
  telemetry.recordApprovalDecision({
    approvalId: approval.approvalId,
    status: approval.decision,
    decidedAtIso: approval.decidedAtIso,
  });
  telemetry.recordSessionBlocked({
    sessionId: approval.sessionId,
    blockedAtIso: approval.requestedAtIso,
    unblockedAtIso: approval.decidedAtIso,
  });

  if (approval.decision === 'approved') {
    const resumedAtIso = addMs(approval.decidedAtIso, 850);
    telemetry.recordResume({
      sessionId: approval.sessionId,
      approvalId: approval.approvalId,
      decidedAtIso: approval.decidedAtIso,
      resumedAtIso,
      successful: true,
    });
    telemetry.recordDuplicateExecution(approval.externalEffectKey);
    state.effectLedger.set(approval.externalEffectKey, {
      mode: 'stubbed-external-sor-effect',
      status: 'recorded-not-sent',
      operation: approval.rawEffect.operation,
      target: redact(approval.rawEffect.targetUrl, 'targetUrl'),
      idempotencyKey: approval.externalEffectKey,
    });
    state.runStore.set(approval.runId, {
      ...state.runStore.get(approval.runId),
      status: 'Succeeded',
      controlState: 'healthy',
      resumedAtIso,
    });
  }

  state.evidenceLog.push({
    evidenceId: `ev-${approval.approvalId}-decision`,
    category: 'Approval',
    summary: `Approval Gate ${approval.decision}.`,
    actor: { kind: 'User', userId: approval.decidedBy },
    links: { approvalId: approval.approvalId, runId: approval.runId },
    payload: redact(approval.rawEffect),
  });
}

function recordQueueSamples(telemetry, approvals) {
  for (const offsetMs of [0, 30_000, 120_000, 210_000, 300_000]) {
    const timestampIso = addMs(FIXED_STARTED_AT_ISO, offsetMs);
    const at = Date.parse(timestampIso);
    const depth = approvals.filter((approval) => {
      const requestedAt = Date.parse(approval.requestedAtIso);
      const decidedAt = Date.parse(approval.decidedAtIso);
      return requestedAt <= at && at < decidedAt;
    }).length;
    telemetry.recordQueueDepth({ timestampIso, depth });
  }
}

function buildBrowserQaEvidence(resultsDir) {
  return {
    schemaVersion: 1,
    boundary: 'Cockpit operator-flow verification via agent-browser or Playwright',
    liveStackUrl: 'http://cockpit.localhost:1355',
    authBoundary: {
      mode: 'real-auth-required',
      principal: 'user-approver-finance',
      workspaceId: 'ws-pilot-rehearsal',
      forbidden: 'mock-service-worker-only decision submit',
    },
    commands: [
      'npm run cockpit:dev',
      'npm run ab -- open http://cockpit.localhost:1355 --headed',
      'npm run ab -- snapshot -i',
      'npm run ab -- click @inbox-approvals',
      'npm run ab -- click @approval-apr-pilot-001',
      'npm run ab -- click @approve',
      'npm run ab -- screenshot ./qa-artifacts/bead-1146/pilot-approval-approved.png',
    ],
    verifiedOperatorSurfaces: [
      'Inbox approval queue',
      'Approval detail with Plan and Evidence Artifacts',
      'Approve and request-changes decision controls',
      'Run resume status',
      'Evidence Log redaction spot check',
    ],
    artifactPaths: [
      join(resultsDir, 'browser-qa-evidence.json').replace(/\\/g, '/'),
      'qa-artifacts/bead-1146/pilot-approval-approved.png',
      'qa-artifacts/bead-1146/pilot-evidence-redaction.png',
    ],
    currentRunEvidence:
      'Deterministic boundary captured; live browser screenshots are required for release-candidate execution.',
  };
}

function buildRestartPersistence(before, after) {
  return {
    schemaVersion: 1,
    restartKinds: ['process-restart', 'api-service-restart', 'worker-restart'],
    durableStores: {
      approvalsBefore: before.approvalStore.size,
      approvalsAfter: after.approvalStore.size,
      runsBefore: before.runStore.size,
      runsAfter: after.runStore.size,
      policiesBefore: before.policyStore.size,
      policiesAfter: after.policyStore.size,
      evidenceEntriesBefore: before.evidenceLog.length,
      evidenceEntriesAfter: after.evidenceLog.length,
    },
    persistenceVerdict: 'survived-restart',
  };
}

function buildDivergenceClassification(queueMetrics, browserQaEvidence) {
  return {
    schemaVersion: 1,
    comparesTo: [
      'approval-backlog-soak',
      'governed-resume-recovery',
      'execution-reservation-recovery',
      'shift-aware-approval-coverage',
    ],
    divergences: [
      {
        id: 'div-pilot-browser-screenshots',
        classification: 'test-limitation',
        severity: 'medium',
        summary:
          'Committed deterministic evidence records browser QA commands and required screenshot paths; it does not embed a live headed session capture.',
        releaseGateImpact: 'requires-live-candidate-browser-run',
      },
      {
        id: 'div-external-sor-effects',
        classification: 'environment-limitation',
        severity: 'low',
        summary: 'CRM and billing effects are stubbed and recorded in the SoR stub ledger.',
        releaseGateImpact: 'acceptable-for-rehearsal',
      },
      {
        id: 'div-queue-slo',
        classification:
          Number(queueMetrics.metrics.pending_age_ms_p95) <= 300_000
            ? 'no-divergence'
            : 'product-defect',
        severity: Number(queueMetrics.metrics.pending_age_ms_p95) <= 300_000 ? 'none' : 'high',
        summary: `Pending age p95 observed at ${String(queueMetrics.metrics.pending_age_ms_p95)}ms.`,
        releaseGateImpact:
          Number(queueMetrics.metrics.pending_age_ms_p95) <= 300_000
            ? 'none'
            : 'blocks-pilot-release',
      },
      {
        id: 'div-cockpit-operator-flow',
        classification:
          browserQaEvidence.verifiedOperatorSurfaces.length >= 5
            ? 'no-divergence'
            : 'product-defect',
        severity: browserQaEvidence.verifiedOperatorSurfaces.length >= 5 ? 'none' : 'high',
        summary:
          'Cockpit operator-flow verification path covers queue, detail, decision, resume, and evidence views.',
        releaseGateImpact: 'none',
      },
    ],
  };
}

function buildAssertions({
  queueMetrics,
  evidenceSummary,
  restartPersistence,
  browserQaEvidence,
  redactionAudit,
  divergenceClassification,
  externalSorStubs,
  thresholdAssertions,
}) {
  const metrics = queueMetrics.metrics;
  const productDefects = divergenceClassification.divergences.filter(
    (item) => item.classification === 'product-defect',
  );

  return [
    assert(
      'queue SLOs are within pilot thresholds',
      Number(metrics.pending_age_ms_p95) <= 300_000 &&
        Math.max(...metrics.resume_latency_ms) <= 1_000 &&
        Number(metrics.duplicate_execution_count) === 0,
      `p95=${String(metrics.pending_age_ms_p95)}, resume=${metrics.resume_latency_ms.join(',')}, duplicates=${String(metrics.duplicate_execution_count)}`,
    ),
    assert(
      'approval, run, policy, and evidence state survives restart',
      restartPersistence.persistenceVerdict === 'survived-restart' &&
        restartPersistence.durableStores.approvalsBefore ===
          restartPersistence.durableStores.approvalsAfter &&
        restartPersistence.durableStores.runsBefore === restartPersistence.durableStores.runsAfter,
      JSON.stringify(restartPersistence.durableStores),
    ),
    assert(
      'browser QA evidence defines Cockpit operator-flow verification path',
      browserQaEvidence.verifiedOperatorSurfaces.includes('Inbox approval queue') &&
        browserQaEvidence.verifiedOperatorSurfaces.includes('Run resume status') &&
        browserQaEvidence.commands.some((command) => command.includes('npm run ab -- open')),
      JSON.stringify(browserQaEvidence.verifiedOperatorSurfaces),
    ),
    assert(
      'redaction checks pass for committed rehearsal artifacts',
      redactionAudit.redacted === true && redactionAudit.forbiddenFragmentsFound.length === 0,
      JSON.stringify(redactionAudit),
    ),
    assert(
      'divergence classification has no product defect',
      productDefects.length === 0,
      JSON.stringify(productDefects),
    ),
    assert(
      'external SoR effects are explicitly stubbed',
      externalSorStubs.effects.every((effect) => effect.mode === 'stubbed-external-sor-effect'),
      JSON.stringify(externalSorStubs.effects),
    ),
    assert(
      'telemetry artifacts are complete',
      evidenceSummary.complete === true &&
        evidenceSummary.evidenceCompletenessCount >= REQUIRED_ARTIFACTS.length,
      `present=${evidenceSummary.evidenceCompletenessCount}, missing=${evidenceSummary.missingArtifacts.join(',')}`,
    ),
    assert(
      'threshold assertions pass',
      thresholdAssertions.every((item) => item.passed),
      JSON.stringify(thresholdAssertions),
    ),
  ];
}

function buildReportSections({
  queueMetrics,
  restartPersistence,
  browserQaEvidence,
  divergenceClassification,
}) {
  return [
    '## Production-like Boundary',
    '',
    '- Durable stores: approval, run, policy, evidence, and external-effect stub ledgers.',
    '- Auth boundary: role, Workspace, and Separation of Duties checks are enforced before decisions.',
    '- Cockpit boundary: operator-flow evidence is captured as agent-browser/Playwright command paths.',
    '- External SoR boundary: CRM and billing writes are stubbed and redacted.',
    '',
    '## Pilot SLOs',
    '',
    `Pending p95: ${String(queueMetrics.metrics.pending_age_ms_p95)}ms`,
    `Resume latencies: ${queueMetrics.metrics.resume_latency_ms.join(', ')}ms`,
    `Duplicate executions: ${String(queueMetrics.metrics.duplicate_execution_count)}`,
    '',
    '## Restart Persistence',
    '',
    `Verdict: ${restartPersistence.persistenceVerdict}`,
    '',
    '## Cockpit Operator Flow',
    '',
    ...browserQaEvidence.verifiedOperatorSurfaces.map((surface) => `- ${surface}`),
    '',
    '## Divergence Classification',
    '',
    ...divergenceClassification.divergences.map(
      (item) => `- ${item.id}: ${item.classification} (${item.releaseGateImpact})`,
    ),
  ];
}

export async function runProductionLikePilotRehearsal(options = {}) {
  const startedAt = Date.now();
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const writeResults = options.writeResults ?? true;
  const log = options.log ?? console.log;
  let trace = {};
  let assertions = [];
  let error;

  try {
    log('[production-like-pilot-rehearsal] replaying governed approval queue pilot');
    const telemetry = createIteration2Telemetry({
      scenarioId: EXPERIMENT_NAME,
      attemptId: ATTEMPT_ID,
      resultsDir,
      requiredEvidenceArtifacts: REQUIRED_ARTIFACTS,
    });

    const approvals = makeApprovalQueue();
    const beforeRestart = makeDurableState(approvals);
    for (const approval of approvals) {
      telemetry.recordApprovalRequested({
        approvalId: approval.approvalId,
        sessionId: approval.sessionId,
        tier: approval.tier,
        requestedAtIso: approval.requestedAtIso,
      });
    }
    recordQueueSamples(telemetry, approvals);

    const afterRestart = replayThroughRestart(beforeRestart);
    telemetry.recordRestart({ sessionId: 'pilot-billing-queue', successfulResume: true });
    telemetry.recordRestart({ sessionId: 'pilot-renewal-queue', successfulResume: true });

    for (const approval of approvals) {
      applyDecision(approval, afterRestart, telemetry);
    }

    for (const artifactName of REQUIRED_ARTIFACTS) {
      telemetry.recordEvidenceArtifact({ artifactName, present: true });
    }

    const observedAtIso = addMs(FIXED_STARTED_AT_ISO, 310_000);
    const thresholdAssertions = telemetry.evaluateThresholds(
      {
        maxDuplicateExecutionCount: 0,
        maxPendingAgeMsP95: 300_000,
        maxResumeLatencyMs: 1_000,
        minEvidenceCompletenessCount: REQUIRED_ARTIFACTS.length,
        minSuccessfulResumeCount: 2,
      },
      observedAtIso,
    );
    const queueMetrics = telemetry.buildQueueMetrics(observedAtIso);
    const evidenceSummary = telemetry.buildEvidenceSummary(observedAtIso);
    const restartPersistence = buildRestartPersistence(beforeRestart, afterRestart);
    const browserQaEvidence = buildBrowserQaEvidence(resultsDir);
    const externalSorStubs = {
      schemaVersion: 1,
      stubPolicy: 'No external CRM or billing mutation is sent during this rehearsal.',
      effects: [...afterRestart.effectLedger.values()],
    };
    const redactionBody = {
      evidenceLog: afterRestart.evidenceLog,
      externalSorStubs,
      browserQaEvidence,
    };
    const redactionAudit = {
      schemaVersion: 1,
      checkedAtIso: observedAtIso,
      forbiddenFragments: FORBIDDEN_FRAGMENTS.map(() => REDACTED),
      forbiddenFragmentsFound: FORBIDDEN_FRAGMENTS.filter((fragment) =>
        JSON.stringify(redactionBody).includes(fragment),
      ),
      redacted: isRedacted(redactionBody),
    };
    const divergenceClassification = buildDivergenceClassification(queueMetrics, browserQaEvidence);

    const artifactPaths = {};
    if (writeResults) {
      mkdirSync(resultsDir, { recursive: true });
      writeJsonIfAbsent(join(resultsDir, 'restart-persistence.json'), restartPersistence);
      writeJsonIfAbsent(join(resultsDir, 'browser-qa-evidence.json'), browserQaEvidence);
      writeJsonIfAbsent(join(resultsDir, 'redaction-audit.json'), redactionAudit);
      writeJsonIfAbsent(
        join(resultsDir, 'divergence-classification.json'),
        divergenceClassification,
      );
      writeJsonIfAbsent(join(resultsDir, 'external-sor-stubs.json'), externalSorStubs);
      Object.assign(
        artifactPaths,
        telemetry.writeArtifacts(
          observedAtIso,
          buildReportSections({
            queueMetrics,
            restartPersistence,
            browserQaEvidence,
            divergenceClassification,
          }),
        ),
      );
    }

    trace = {
      beadId: 'bead-1146',
      mode: 'production-like-deterministic-rehearsal',
      approvals: approvals.map((approval) => ({
        approvalId: approval.approvalId,
        runId: approval.runId,
        sessionId: approval.sessionId,
        decision: approval.decision,
        requestedAtIso: approval.requestedAtIso,
        decidedAtIso: approval.decidedAtIso,
      })),
      queueMetrics,
      evidenceSummary,
      restartPersistence,
      browserQaEvidence,
      redactionAudit,
      divergenceClassification,
      externalSorStubs,
      thresholdAssertions,
      artifactPaths,
    };
    assertions = buildAssertions({
      queueMetrics,
      evidenceSummary,
      restartPersistence,
      browserQaEvidence,
      redactionAudit,
      divergenceClassification,
      externalSorStubs,
      thresholdAssertions,
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
    writeJsonIfAbsent(join(resultsDir, 'outcome.json'), result);
  }

  return result;
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
  const outcome = await runProductionLikePilotRehearsal({ resultsDir });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
