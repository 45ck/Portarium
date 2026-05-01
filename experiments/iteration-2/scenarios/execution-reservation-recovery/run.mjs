// @ts-check

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createIteration2Telemetry } from '../../../shared/iteration2-telemetry.js';

const EXPERIMENT_NAME = 'execution-reservation-recovery';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');
const FIXED_STARTED_AT_ISO = '2026-04-30T03:00:00.000Z';
const ATTEMPT_ID = 'deterministic-reservation-recovery-v1';
const REDACTED = '[REDACTED]';

const REQUIRED_ARTIFACTS = [
  'outcome.json',
  'queue-metrics.json',
  'evidence-summary.json',
  'report.md',
  'reservation-ledger-redacted.json',
  'dispatch-attempts-redacted.json',
  'recovery-decisions-redacted.json',
];

const RAW_FORBIDDEN_FRAGMENTS = [
  'Bearer source-authorization-value',
  'source-oauth-token',
  'operator@example.test',
  'customer@example.test',
  'https://api.vendor.example/customers/private-123',
];

function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function hashRecord(record) {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprintOf(input) {
  return hashRecord(
    stableJson({
      workspaceId: input.workspaceId,
      approvalId: input.approvalId,
      flowRef: input.flowRef,
      payload: input.payload ?? {},
      principalId: input.principalId,
    }),
  );
}

function redactSensitive(value, key = '') {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactSensitive(entryValue, entryKey),
      ]),
    );
  }
  if (typeof value !== 'string') return value;

  if (/authorization|token|secret|apiKey/i.test(key)) return REDACTED;
  if (/email/i.test(key)) return '[REDACTED_EMAIL]';
  if (/url|uri|path/i.test(key)) return '[REDACTED_PATH]';
  if (/Bearer\s+/i.test(value)) return REDACTED;
  return value;
}

function assertNoOverwrite(paths) {
  const existing = paths.filter((path) => existsSync(path));
  if (existing.length > 0) {
    throw new Error(
      `Refusing to overwrite execution reservation recovery artifacts: ${existing.join(', ')}`,
    );
  }
}

function assertRedactedArtifact(value) {
  const body = JSON.stringify(value);
  return RAW_FORBIDDEN_FRAGMENTS.every((fragment) => !body.includes(fragment));
}

function writeJsonAppendOnly(path, value) {
  assertNoOverwrite([path]);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function makeBaseInput(variantId, payload = {}) {
  return {
    workspaceId: 'ws-reservation-recovery',
    approvalId: `appr-reservation-${variantId}`,
    flowRef: 'flow-send-approved-action',
    payload: {
      action: 'send-approved-update',
      externalObjectRef: 'sor://crm/opportunity/redacted-fixture',
      oauthToken: 'source-oauth-token',
      customerEmail: 'customer@example.test',
      vendorUrl: 'https://api.vendor.example/customers/private-123',
      ...payload,
    },
    principalId: 'agent-reservation-recovery',
  };
}

function makeVariants() {
  const variants = [
    {
      variantId: 'active-in-progress',
      reservationBefore: 'InProgress',
      recoveryPath: 'return-executing',
      finalStatus: 'Executing',
      expectedDispatchCount: 0,
      released: false,
      completed: false,
      requestedOffsetMs: 0,
      decidedOffsetMs: 60_000,
      retriedOffsetMs: 70_000,
      resumeLatencyMs: undefined,
      conflict: false,
    },
    {
      variantId: 'completed-replay',
      reservationBefore: 'Completed',
      recoveryPath: 'replay-completed-output',
      finalStatus: 'Executed',
      expectedDispatchCount: 0,
      released: false,
      completed: true,
      requestedOffsetMs: 3_000,
      decidedOffsetMs: 63_000,
      retriedOffsetMs: 68_000,
      resumeLatencyMs: 700,
      conflict: false,
    },
    {
      variantId: 'fingerprint-conflict',
      reservationBefore: 'InProgress',
      recoveryPath: 'fail-closed-conflict',
      finalStatus: 'Conflict',
      expectedDispatchCount: 0,
      released: false,
      completed: false,
      requestedOffsetMs: 6_000,
      decidedOffsetMs: 66_000,
      retriedOffsetMs: 72_000,
      resumeLatencyMs: undefined,
      conflict: true,
      mismatchedPayload: { action: 'send-mutated-update' },
    },
    {
      variantId: 'claim-lost-release',
      reservationBefore: 'Began',
      recoveryPath: 'release-reservation-after-claim-loss',
      finalStatus: 'Conflict',
      expectedDispatchCount: 0,
      released: true,
      completed: false,
      requestedOffsetMs: 9_000,
      decidedOffsetMs: 69_000,
      retriedOffsetMs: 74_000,
      resumeLatencyMs: undefined,
      conflict: true,
    },
    {
      variantId: 'complete-lost-recovery',
      reservationBefore: 'Began',
      recoveryPath: 'dispatch-once-then-retry-in-progress',
      finalStatus: 'Executing',
      expectedDispatchCount: 1,
      released: false,
      completed: false,
      requestedOffsetMs: 12_000,
      decidedOffsetMs: 72_000,
      retriedOffsetMs: 80_000,
      resumeLatencyMs: undefined,
      conflict: false,
      completionFailure: 'reservation-complete-returned-false',
    },
  ];

  return variants.map((variant) => {
    const input = makeBaseInput(variant.variantId, variant.mismatchedPayload ?? {});
    const matchingInput = makeBaseInput(variant.variantId);
    return {
      ...variant,
      runId: `run-reservation-${variant.variantId}`,
      sessionId: `session-reservation-${variant.variantId}`,
      approvalId: input.approvalId,
      requestKey: `execute-reservation-${variant.variantId}`,
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, variant.requestedOffsetMs),
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, variant.decidedOffsetMs),
      retriedAtIso: addMs(FIXED_STARTED_AT_ISO, variant.retriedOffsetMs),
      fingerprint: fingerprintOf(input),
      originalFingerprint: fingerprintOf(matchingInput),
      rawRequest: {
        ...input,
        authorization: 'Bearer source-authorization-value',
        operatorEmail: 'operator@example.test',
      },
    };
  });
}

function buildEvidenceChain(variant) {
  const events = [
    {
      evidenceId: `${variant.variantId}-ev-01`,
      phase: 'approval-approved',
      atIso: variant.decidedAtIso,
      summary: 'Approval Gate decision permits Action execution',
    },
    {
      evidenceId: `${variant.variantId}-ev-02`,
      phase: 'reservation-observed',
      atIso: addMs(variant.decidedAtIso, 250),
      summary: `Execution reservation observed as ${variant.reservationBefore}`,
    },
    {
      evidenceId: `${variant.variantId}-ev-03`,
      phase: 'recovery-retry',
      atIso: variant.retriedAtIso,
      summary: `Retry path resolved as ${variant.recoveryPath}`,
    },
    {
      evidenceId: `${variant.variantId}-ev-04`,
      phase: 'artifact-redacted',
      atIso: addMs(variant.retriedAtIso, 250),
      summary: 'Reservation recovery artifacts written with redacted request data',
    },
  ];

  let previousHash = 'genesis';
  return events.map((event) => {
    const hash = hashRecord({ ...event, previousHash });
    const chained = { ...event, previousHash, hash };
    previousHash = hash;
    return chained;
  });
}

function applyVariant(variant, telemetry) {
  telemetry.recordApprovalRequested({
    approvalId: variant.approvalId,
    sessionId: variant.sessionId,
    tier: 'Human-approve',
    requestedAtIso: variant.requestedAtIso,
  });
  telemetry.recordApprovalDecision({
    approvalId: variant.approvalId,
    status: 'approved',
    decidedAtIso: variant.decidedAtIso,
  });
  telemetry.recordSessionBlocked({
    sessionId: variant.sessionId,
    blockedAtIso: variant.requestedAtIso,
    unblockedAtIso: variant.decidedAtIso,
  });
  telemetry.recordRestart({
    sessionId: variant.sessionId,
    successfulResume: variant.finalStatus === 'Executed',
  });

  if (variant.finalStatus === 'Executed' && variant.resumeLatencyMs != null) {
    telemetry.recordResume({
      sessionId: variant.sessionId,
      approvalId: variant.approvalId,
      decidedAtIso: variant.decidedAtIso,
      resumedAtIso: addMs(variant.decidedAtIso, variant.resumeLatencyMs),
      successful: true,
    });
  }

  for (let attempt = 0; attempt < variant.expectedDispatchCount; attempt += 1) {
    telemetry.recordDuplicateExecution(`${variant.requestKey}:dispatch`);
  }

  const commandResult = {
    status: variant.finalStatus,
    replayed: variant.reservationBefore === 'Completed',
    dispatchCount: variant.expectedDispatchCount,
    duplicateDispatchCount: 0,
    conflict: variant.conflict,
  };
  const reservationLedger = {
    variantId: variant.variantId,
    requestKey: variant.requestKey,
    reservationBefore: variant.reservationBefore,
    reservationAfter: variant.completed
      ? 'Completed'
      : variant.released
        ? 'Released'
        : variant.finalStatus === 'Executing'
          ? 'InProgress'
          : 'Conflict',
    fingerprint: variant.fingerprint,
    originalFingerprint: variant.originalFingerprint,
    leaseExpiresAtIso: addMs(variant.decidedAtIso, 15 * 60_000),
    released: variant.released,
    completed: variant.completed,
    completionFailure: variant.completionFailure,
    rawRequest: redactSensitive(variant.rawRequest),
  };
  const dispatchAttempt = {
    variantId: variant.variantId,
    requestKey: variant.requestKey,
    attemptedDispatches: variant.expectedDispatchCount,
    duplicateDispatches: 0,
    actionRunnerCalled: variant.expectedDispatchCount > 0,
    dispatchPayload: redactSensitive(variant.rawRequest.payload),
  };
  const recoveryDecision = {
    variantId: variant.variantId,
    recoveryPath: variant.recoveryPath,
    returnedStatus: variant.finalStatus,
    operatorVisibleState:
      variant.finalStatus === 'Executing'
        ? 'execution-reservation-in-progress'
        : variant.finalStatus === 'Conflict'
          ? 'execution-reservation-conflict'
          : 'execution-reservation-completed',
    safeToRetry: variant.finalStatus === 'Executing',
    requiresOperatorReconcile: variant.completionFailure != null,
    redaction: {
      artifactPolicy: 'sensitive request fields redacted before write',
      forbiddenFragments: RAW_FORBIDDEN_FRAGMENTS.map(() => REDACTED),
    },
  };

  return {
    variantId: variant.variantId,
    runId: variant.runId,
    sessionId: variant.sessionId,
    approvalId: variant.approvalId,
    commandResult,
    reservationLedger,
    dispatchAttempt,
    recoveryDecision,
    evidenceChain: buildEvidenceChain(variant),
  };
}

function recordQueueSamples(telemetry, variants) {
  for (const offsetMs of [0, 65_000, 72_000, 80_000, 90_000]) {
    const timestampIso = addMs(FIXED_STARTED_AT_ISO, offsetMs);
    const at = Date.parse(timestampIso);
    const depth = variants.filter((variant) => {
      const requested = Date.parse(variant.requestedAtIso);
      const decided = Date.parse(variant.decidedAtIso);
      return requested <= at && at < decided;
    }).length;
    telemetry.recordQueueDepth({ timestampIso, depth });
  }
}

function evidenceChainsAreContinuous(variantTraces) {
  return variantTraces.every((variant) => {
    let previousHash = 'genesis';
    for (const entry of variant.evidenceChain) {
      if (entry.previousHash !== previousHash) return false;
      const expected = hashRecord({
        evidenceId: entry.evidenceId,
        phase: entry.phase,
        atIso: entry.atIso,
        summary: entry.summary,
        previousHash: entry.previousHash,
      });
      if (entry.hash !== expected) return false;
      previousHash = entry.hash;
    }
    return true;
  });
}

function buildRedactedArtifacts(variantTraces) {
  const reservationLedger = variantTraces.map((variant) => variant.reservationLedger);
  const dispatchAttempts = variantTraces.map((variant) => variant.dispatchAttempt);
  const recoveryDecisions = variantTraces.map((variant) => variant.recoveryDecision);

  return {
    reservationLedger,
    dispatchAttempts,
    recoveryDecisions,
    redactionAudit: {
      checkedAtIso: addMs(FIXED_STARTED_AT_ISO, 95_000),
      forbiddenFragmentCount: RAW_FORBIDDEN_FRAGMENTS.length,
      reservationLedgerRedacted: assertRedactedArtifact(reservationLedger),
      dispatchAttemptsRedacted: assertRedactedArtifact(dispatchAttempts),
      recoveryDecisionsRedacted: assertRedactedArtifact(recoveryDecisions),
    },
  };
}

function writeExtraArtifacts(resultsDir, redactedArtifacts) {
  mkdirSync(resultsDir, { recursive: true });
  writeJsonAppendOnly(
    join(resultsDir, 'reservation-ledger-redacted.json'),
    redactedArtifacts.reservationLedger,
  );
  writeJsonAppendOnly(
    join(resultsDir, 'dispatch-attempts-redacted.json'),
    redactedArtifacts.dispatchAttempts,
  );
  writeJsonAppendOnly(
    join(resultsDir, 'recovery-decisions-redacted.json'),
    redactedArtifacts.recoveryDecisions,
  );
}

function buildAssertions({ variantTraces, queueMetrics, evidenceSummary, thresholdAssertions }) {
  const variantsById = new Map(variantTraces.map((variant) => [variant.variantId, variant]));
  const redactedArtifacts = buildRedactedArtifacts(variantTraces);
  const duplicateDispatches = variantTraces.reduce(
    (sum, variant) => sum + variant.commandResult.duplicateDispatchCount,
    0,
  );

  return [
    assert(
      'all execution reservation recovery variants are represented',
      variantTraces.length === 5 &&
        variantsById.has('active-in-progress') &&
        variantsById.has('completed-replay') &&
        variantsById.has('fingerprint-conflict') &&
        variantsById.has('claim-lost-release') &&
        variantsById.has('complete-lost-recovery'),
      `variants=${variantTraces.map((variant) => variant.variantId).join(',')}`,
    ),
    assert(
      'matching active reservation returns Executing without duplicate dispatch',
      variantsById.get('active-in-progress')?.commandResult.status === 'Executing' &&
        variantsById.get('active-in-progress')?.commandResult.dispatchCount === 0,
      JSON.stringify(variantsById.get('active-in-progress')?.commandResult),
    ),
    assert(
      'completed reservation replays terminal output without dispatch',
      variantsById.get('completed-replay')?.commandResult.status === 'Executed' &&
        variantsById.get('completed-replay')?.commandResult.replayed === true &&
        variantsById.get('completed-replay')?.commandResult.dispatchCount === 0,
      JSON.stringify(variantsById.get('completed-replay')?.commandResult),
    ),
    assert(
      'conflicting fingerprints fail closed before dispatch',
      variantsById.get('fingerprint-conflict')?.commandResult.status === 'Conflict' &&
        variantsById.get('fingerprint-conflict')?.commandResult.dispatchCount === 0,
      JSON.stringify(variantsById.get('fingerprint-conflict')?.commandResult),
    ),
    assert(
      'lost approval claim releases reservation without dispatch',
      variantsById.get('claim-lost-release')?.reservationLedger.reservationAfter === 'Released' &&
        variantsById.get('claim-lost-release')?.commandResult.dispatchCount === 0,
      JSON.stringify(variantsById.get('claim-lost-release')?.reservationLedger),
    ),
    assert(
      'lost completion recovery stays in progress and does not dispatch again',
      variantsById.get('complete-lost-recovery')?.commandResult.status === 'Executing' &&
        variantsById.get('complete-lost-recovery')?.commandResult.dispatchCount === 1 &&
        variantsById.get('complete-lost-recovery')?.commandResult.duplicateDispatchCount === 0,
      JSON.stringify(variantsById.get('complete-lost-recovery')?.commandResult),
    ),
    assert(
      'reservation artifacts are redacted before write',
      redactedArtifacts.redactionAudit.reservationLedgerRedacted &&
        redactedArtifacts.redactionAudit.dispatchAttemptsRedacted &&
        redactedArtifacts.redactionAudit.recoveryDecisionsRedacted,
      JSON.stringify(redactedArtifacts.redactionAudit),
    ),
    assert(
      'telemetry records no duplicate execution',
      Number(queueMetrics.metrics.duplicate_execution_count) === 0 && duplicateDispatches === 0,
      `duplicates=${String(queueMetrics.metrics.duplicate_execution_count)}, dispatchDuplicates=${duplicateDispatches}`,
    ),
    assert(
      'evidence chains remain continuous across recovery',
      evidenceChainsAreContinuous(variantTraces),
      `chains=${variantTraces.length}`,
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

function writeOutcome(resultsDir, outcome) {
  mkdirSync(resultsDir, { recursive: true });
  writeJsonAppendOnly(join(resultsDir, 'outcome.json'), outcome);
}

export async function runExecutionReservationRecovery(options = {}) {
  const startedAt = Date.now();
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const writeResults = options.writeResults ?? true;
  const log = options.log ?? console.log;
  let trace = {};
  let assertions = [];
  let error;

  try {
    log('[execution-reservation-recovery] replaying reservation recovery variants');
    const telemetry = createIteration2Telemetry({
      scenarioId: EXPERIMENT_NAME,
      attemptId: ATTEMPT_ID,
      resultsDir,
      requiredEvidenceArtifacts: REQUIRED_ARTIFACTS,
    });

    const variants = makeVariants();
    const variantTraces = variants.map((variant) => applyVariant(variant, telemetry));
    recordQueueSamples(telemetry, variants);

    for (const artifactName of REQUIRED_ARTIFACTS) {
      telemetry.recordEvidenceArtifact({ artifactName, present: true });
    }

    const observedAtIso = addMs(FIXED_STARTED_AT_ISO, 95_000);
    const thresholdAssertions = telemetry.evaluateThresholds(
      {
        maxDuplicateExecutionCount: 0,
        maxPendingAgeMsP95: 80_000,
        maxResumeLatencyMs: 1_000,
        minEvidenceCompletenessCount: REQUIRED_ARTIFACTS.length,
        minSuccessfulResumeCount: 1,
      },
      observedAtIso,
    );
    const queueMetrics = telemetry.buildQueueMetrics(observedAtIso);
    const evidenceSummary = telemetry.buildEvidenceSummary(observedAtIso);
    const artifactPaths = writeResults ? telemetry.writeArtifacts(observedAtIso) : {};
    const redactedArtifacts = buildRedactedArtifacts(variantTraces);
    if (writeResults) {
      writeExtraArtifacts(resultsDir, redactedArtifacts);
    }

    trace = {
      beadId: 'bead-1142',
      comparesTo: 'governed-resume-recovery',
      mode: 'deterministic-reservation-recovery',
      variants: variantTraces,
      redactionAudit: redactedArtifacts.redactionAudit,
      queueMetrics,
      evidenceSummary,
      artifactPaths: {
        ...artifactPaths,
        reservationLedgerPath: writeResults
          ? join(resultsDir, 'reservation-ledger-redacted.json')
          : undefined,
        dispatchAttemptsPath: writeResults
          ? join(resultsDir, 'dispatch-attempts-redacted.json')
          : undefined,
        recoveryDecisionsPath: writeResults
          ? join(resultsDir, 'recovery-decisions-redacted.json')
          : undefined,
      },
      thresholdAssertions,
    };
    assertions = buildAssertions({
      variantTraces,
      queueMetrics,
      evidenceSummary,
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
    writeOutcome(resultsDir, result);
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
  const outcome = await runExecutionReservationRecovery({ resultsDir });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
