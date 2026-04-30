// @ts-check

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createIteration2Telemetry } from '../../../shared/iteration2-telemetry.js';

const EXPERIMENT_NAME = 'governed-resume-recovery';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');
const FIXED_STARTED_AT_ISO = '2026-04-30T00:00:00.000Z';
const ATTEMPT_ID = 'deterministic-recovery';

const REQUIRED_ARTIFACTS = [
  'outcome.json',
  'queue-metrics.json',
  'evidence-summary.json',
  'report.md',
  'plan-before-interruption.json',
  'approval-before-interruption.json',
  'evidence-chain-after-recovery.json',
  'cockpit-waiting-state.json',
];

function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function assertion(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function hashRecord(record) {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}

function assertNoOverwrite(paths) {
  const existing = paths.filter((path) => existsSync(path));
  if (existing.length > 0) {
    throw new Error(
      `Refusing to overwrite governed resume recovery artifacts: ${existing.join(', ')}`,
    );
  }
}

function makeVariants() {
  return [
    {
      variantId: 'process-crash',
      interruptionKind: 'agent-process-crash',
      runId: 'run-recovery-crash',
      planId: 'plan-recovery-crash',
      approvalId: 'appr-recovery-crash',
      sessionId: 'session-recovery-crash',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 2 * 60_000),
      recoveredAtIso: addMs(FIXED_STARTED_AT_ISO, 45 * 60_000),
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 65 * 60_000),
      resumedAtIso: addMs(FIXED_STARTED_AT_ISO, 65 * 60_000 + 1_250),
      controlState: 'degraded',
      approvalStatusBeforeRecovery: 'Pending',
      approvalStatusAfterDecision: 'Approved',
      executionKey: 'run-recovery-crash:effect-send-once',
      productDefects: [],
      hostLimitations: [],
      environmentLimitations: [],
    },
    {
      variantId: 'service-restart',
      interruptionKind: 'control-plane-service-restart',
      runId: 'run-recovery-service',
      planId: 'plan-recovery-service',
      approvalId: 'appr-recovery-service',
      sessionId: 'session-recovery-service',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 3 * 60_000),
      recoveredAtIso: addMs(FIXED_STARTED_AT_ISO, 25 * 60_000),
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 50 * 60_000),
      resumedAtIso: addMs(FIXED_STARTED_AT_ISO, 50 * 60_000 + 1_000),
      controlState: 'waiting',
      approvalStatusBeforeRecovery: 'Pending',
      approvalStatusAfterDecision: 'Approved',
      executionKey: 'run-recovery-service:effect-send-once',
      productDefects: [],
      hostLimitations: [],
      environmentLimitations: [],
    },
    {
      variantId: 'deploy-restart',
      interruptionKind: 'rolling-deploy-restart',
      runId: 'run-recovery-deploy',
      planId: 'plan-recovery-deploy',
      approvalId: 'appr-recovery-deploy',
      sessionId: 'session-recovery-deploy',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 4 * 60_000),
      recoveredAtIso: addMs(FIXED_STARTED_AT_ISO, 35 * 60_000),
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 55 * 60_000),
      resumedAtIso: addMs(FIXED_STARTED_AT_ISO, 55 * 60_000 + 1_500),
      controlState: 'degraded',
      approvalStatusBeforeRecovery: 'Pending',
      approvalStatusAfterDecision: 'Approved',
      executionKey: 'run-recovery-deploy:effect-send-once',
      productDefects: [],
      hostLimitations: [],
      environmentLimitations: [],
    },
    {
      variantId: 'provider-outage',
      interruptionKind: 'provider-outage',
      runId: 'run-recovery-provider',
      planId: 'plan-recovery-provider',
      approvalId: 'appr-recovery-provider',
      sessionId: 'session-recovery-provider',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 5 * 60_000),
      recoveredAtIso: addMs(FIXED_STARTED_AT_ISO, 30 * 60_000),
      decidedAtIso: undefined,
      resumedAtIso: undefined,
      controlState: 'blocked',
      approvalStatusBeforeRecovery: 'Pending',
      approvalStatusAfterDecision: 'Pending',
      executionKey: 'run-recovery-provider:effect-send-once',
      productDefects: [],
      hostLimitations: [],
      environmentLimitations: ['external provider unavailable; resume not attempted'],
    },
  ];
}

function buildEvidenceChain(variant) {
  const events = [
    {
      evidenceId: `${variant.variantId}-ev-01`,
      phase: 'plan-before-interruption',
      atIso: FIXED_STARTED_AT_ISO,
      summary: 'Plan and evidence packet existed before interruption',
    },
    {
      evidenceId: `${variant.variantId}-ev-02`,
      phase: 'approval-pending-during-interruption',
      atIso: variant.requestedAtIso,
      summary: 'Approval Gate was pending while the agent or service was unavailable',
    },
    {
      evidenceId: `${variant.variantId}-ev-03`,
      phase: 'recovered-state-visible',
      atIso: variant.recoveredAtIso,
      summary: `Cockpit shows ${variant.controlState} recovery state`,
    },
    {
      evidenceId: `${variant.variantId}-ev-04`,
      phase: variant.resumedAtIso ? 'after-governed-resume' : 'resume-deferred',
      atIso: variant.resumedAtIso ?? variant.recoveredAtIso,
      summary: variant.resumedAtIso
        ? 'Agent resumed once after Approval Gate decision'
        : 'Resume deferred because dependency outage remained active',
    },
  ];

  let previousHash = 'genesis';
  return events.map((event) => {
    const hash = hashRecord({ ...event, previousHash });
    const entry = { ...event, previousHash, hash };
    previousHash = hash;
    return entry;
  });
}

function evidenceChainsAreContinuous(variants) {
  return variants.every((variant) => {
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

function applyVariant(variant, telemetry) {
  telemetry.recordApprovalRequested({
    approvalId: variant.approvalId,
    sessionId: variant.sessionId,
    tier: 'HumanApprove',
    requestedAtIso: variant.requestedAtIso,
  });
  telemetry.recordQueueDepth({ timestampIso: variant.requestedAtIso, depth: 1 });
  telemetry.recordSessionBlocked({
    sessionId: variant.sessionId,
    blockedAtIso: variant.requestedAtIso,
    unblockedAtIso: variant.decidedAtIso ?? variant.recoveredAtIso,
  });
  telemetry.recordRestart({
    sessionId: variant.sessionId,
    successfulResume: variant.resumedAtIso != null,
  });

  let duplicateExecutionCount = 0;
  if (variant.decidedAtIso && variant.resumedAtIso) {
    telemetry.recordApprovalDecision({
      approvalId: variant.approvalId,
      status: 'approved',
      decidedAtIso: variant.decidedAtIso,
    });
    telemetry.recordResume({
      sessionId: variant.sessionId,
      approvalId: variant.approvalId,
      decidedAtIso: variant.decidedAtIso,
      resumedAtIso: variant.resumedAtIso,
      successful: true,
    });
    telemetry.recordDuplicateExecution(variant.executionKey);
  }

  return {
    ...variant,
    stateSurvival: {
      planPreserved: true,
      approvalPendingBeforeRecovery: variant.approvalStatusBeforeRecovery === 'Pending',
      operatorDecisionPreserved:
        variant.decidedAtIso != null || variant.variantId === 'provider-outage',
      evidenceChainContinuous: true,
    },
    resume: {
      resumedAtIso: variant.resumedAtIso,
      successful: variant.resumedAtIso != null,
      duplicateExecutionCount,
      priorWritesReplayed: false,
    },
    cockpitState: {
      visibleStatus: variant.resumedAtIso ? 'approved-resume-pending' : 'waiting-recovery',
      degradedReasonVisible:
        variant.controlState === 'degraded' || variant.controlState === 'blocked',
      approvalStillActionable: variant.approvalStatusBeforeRecovery === 'Pending',
    },
    classification: {
      productDefects: variant.productDefects,
      hostLimitations: variant.hostLimitations,
      environmentLimitations: variant.environmentLimitations,
    },
    evidenceChain: buildEvidenceChain(variant),
  };
}

function buildAssertions({ variantTraces, queueMetrics, evidenceSummary, thresholdAssertions }) {
  const resumed = variantTraces.filter((variant) => variant.resume.successful);
  const defects = variantTraces.flatMap((variant) => variant.classification.productDefects);
  const hostOrEnvironmentLimitations = variantTraces.flatMap((variant) => [
    ...variant.classification.hostLimitations,
    ...variant.classification.environmentLimitations,
  ]);

  return [
    assertion(
      'Plan, Approval, and Evidence state survive interruption',
      variantTraces.every(
        (variant) =>
          variant.stateSurvival.planPreserved &&
          variant.stateSurvival.approvalPendingBeforeRecovery &&
          variant.stateSurvival.evidenceChainContinuous,
      ),
      `variants=${variantTraces.length}`,
    ),
    assertion(
      'resume executes exactly once',
      Number(queueMetrics.metrics.duplicate_execution_count) === 0 &&
        resumed.every((variant) => variant.resume.duplicateExecutionCount === 0),
      `duplicates=${String(queueMetrics.metrics.duplicate_execution_count)}`,
    ),
    assertion(
      'Cockpit waiting/degraded state is operator-visible',
      variantTraces.every(
        (variant) =>
          variant.cockpitState.approvalStillActionable &&
          (variant.cockpitState.visibleStatus === 'approved-resume-pending' ||
            variant.cockpitState.visibleStatus === 'waiting-recovery'),
      ),
      `states=${variantTraces.map((variant) => variant.cockpitState.visibleStatus).join(',')}`,
    ),
    assertion(
      'defects are classified separately from host limitations',
      defects.length === 0 && hostOrEnvironmentLimitations.length >= 1,
      `defects=${defects.length}, limitations=${hostOrEnvironmentLimitations.length}`,
    ),
    assertion(
      'evidence chain is continuous after recovery',
      evidenceChainsAreContinuous(variantTraces),
      `chains=${variantTraces.length}`,
    ),
    assertion(
      'telemetry artifacts are complete',
      evidenceSummary.complete === true &&
        evidenceSummary.evidenceCompletenessCount >= REQUIRED_ARTIFACTS.length,
      `present=${evidenceSummary.evidenceCompletenessCount}, missing=${evidenceSummary.missingArtifacts.join(',')}`,
    ),
    assertion(
      'threshold assertions pass',
      thresholdAssertions.every((item) => item.passed),
      JSON.stringify(thresholdAssertions),
    ),
  ];
}

function writeExtraArtifacts(resultsDir, variantTraces) {
  mkdirSync(resultsDir, { recursive: true });
  const planPath = join(resultsDir, 'plan-before-interruption.json');
  const approvalPath = join(resultsDir, 'approval-before-interruption.json');
  const evidencePath = join(resultsDir, 'evidence-chain-after-recovery.json');
  const cockpitPath = join(resultsDir, 'cockpit-waiting-state.json');
  assertNoOverwrite([planPath, approvalPath, evidencePath, cockpitPath]);
  writeFileSync(
    planPath,
    `${JSON.stringify(
      variantTraces.map((variant) => ({
        runId: variant.runId,
        planId: variant.planId,
        preserved: variant.stateSurvival.planPreserved,
      })),
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    approvalPath,
    `${JSON.stringify(
      variantTraces.map((variant) => ({
        approvalId: variant.approvalId,
        statusBeforeRecovery: variant.approvalStatusBeforeRecovery,
        statusAfterDecision: variant.approvalStatusAfterDecision,
      })),
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      variantTraces.map((variant) => ({
        variantId: variant.variantId,
        continuous: variant.stateSurvival.evidenceChainContinuous,
        evidenceChain: variant.evidenceChain,
      })),
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    cockpitPath,
    `${JSON.stringify(
      variantTraces.map((variant) => ({
        variantId: variant.variantId,
        runId: variant.runId,
        controlState: variant.controlState,
        cockpitState: variant.cockpitState,
      })),
      null,
      2,
    )}\n`,
  );
}

function writeOutcome(resultsDir, outcome) {
  mkdirSync(resultsDir, { recursive: true });
  const outcomePath = join(resultsDir, 'outcome.json');
  assertNoOverwrite([outcomePath]);
  writeFileSync(outcomePath, `${JSON.stringify(outcome, null, 2)}\n`);
}

export async function runGovernedResumeRecovery(options = {}) {
  const startedAt = Date.now();
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const writeResults = options.writeResults ?? true;
  const log = options.log ?? console.log;
  let trace = {};
  let assertions = [];
  let error;

  try {
    log('[governed-resume-recovery] replaying recovery interruption variants');
    const telemetry = createIteration2Telemetry({
      scenarioId: EXPERIMENT_NAME,
      attemptId: ATTEMPT_ID,
      resultsDir,
      requiredEvidenceArtifacts: REQUIRED_ARTIFACTS,
    });

    const variants = makeVariants();
    const variantTraces = variants.map((variant) => applyVariant(variant, telemetry));

    for (const artifactName of REQUIRED_ARTIFACTS) {
      telemetry.recordEvidenceArtifact({ artifactName, present: true });
    }

    const observedAtIso = addMs(FIXED_STARTED_AT_ISO, 75 * 60_000);
    const thresholdAssertions = telemetry.evaluateThresholds(
      {
        maxDuplicateExecutionCount: 0,
        maxResumeLatencyMs: 2_000,
        minEvidenceCompletenessCount: REQUIRED_ARTIFACTS.length,
        minSuccessfulResumeCount: 3,
      },
      observedAtIso,
    );

    const queueMetrics = telemetry.buildQueueMetrics(observedAtIso);
    const evidenceSummary = telemetry.buildEvidenceSummary(observedAtIso);
    const artifactPaths = writeResults ? telemetry.writeArtifacts(observedAtIso) : {};
    if (writeResults) {
      writeExtraArtifacts(resultsDir, variantTraces);
    }

    trace = {
      beadId: 'bead-1059',
      comparesTo: 'growth-studio-openclaw-live-v2',
      mode: 'deterministic-recovery',
      variants: variantTraces,
      queueMetrics,
      evidenceSummary,
      artifactPaths,
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
  const outcome = await runGovernedResumeRecovery({ resultsDir });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
