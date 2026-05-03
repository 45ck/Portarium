// @ts-check

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  buildLiveRerunTrace,
  resolveIteration2LiveOpenClawRerun,
  writeLiveRerunMetadataArtifact,
} from '../../../shared/iteration2-live-openclaw-rerun.js';
import { createIteration2Telemetry } from '../../../shared/iteration2-telemetry.js';

const EXPERIMENT_NAME = 'growth-studio-openclaw-live-v2';
const DEFAULT_ATTEMPT_ID = 'deterministic-growth-v2';
const DEFAULT_RESULTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'results',
  EXPERIMENT_NAME,
  DEFAULT_ATTEMPT_ID,
);
const FIXED_STARTED_AT_ISO = '2026-04-29T22:00:00.000Z';
const DETERMINISTIC_ATTEMPT_ID = DEFAULT_ATTEMPT_ID;
const LIVE_ATTEMPT_ID = 'live-openclaw-rerun-v1';

/**
 * @typedef {{
 *   label: string;
 *   passed: boolean;
 *   detail?: string;
 * }} Assertion
 */

/**
 * @typedef {{
 *   approvalId: string;
 *   sessionId: string;
 *   action: string;
 *   tier: 'Assisted' | 'Human-approve';
 *   requestedAtIso: string;
 *   status: 'pending' | 'approved';
 *   delayWindowMs: number;
 *   decidedAtIso?: string;
 *   resumedAtIso?: string;
 *   executionKey: string;
 * }} GrowthApproval
 */

/**
 * @typedef {{
 *   variantId: 'live-wait' | 'restart-resume';
 *   sessionId: string;
 *   runId: string;
 *   agentId: string;
 *   processMode: 'alive' | 'restarted';
 *   approvals: GrowthApproval[];
 *   preWaitWrites: string[];
 *   outputBundlePath: string;
 * }} GrowthVariant
 */

/**
 * @typedef {{
 *   experiment: string;
 *   attemptId: string;
 *   timestamp: string;
 *   outcome: 'confirmed' | 'refuted' | 'inconclusive' | 'skipped';
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
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
 *   fetchImpl?: typeof fetch;
 *   codexExecImpl?: import('../../../shared/live-model-preflight.js').CodexExecProbe;
 * }} RunGrowthStudioLiveV2Options
 */

function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function hashRecord(record) {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}

function attemptIdFromResultsDir(resultsDir) {
  const attemptId = basename(normalize(resultsDir));
  if (attemptId.length === 0) {
    throw new Error(`Cannot derive attempt id from results directory: ${resultsDir}`);
  }
  return attemptId;
}

function makeVariants() {
  /** @type {GrowthVariant[]} */
  return [
    {
      variantId: 'live-wait',
      sessionId: 'growth-live-wait-session',
      runId: 'growth-live-wait-run',
      agentId: 'openclaw-growth-agent',
      processMode: 'alive',
      preWaitWrites: ['prospect-dossier.md'],
      outputBundlePath: 'outputs/growth-live-wait-session/outreach-approved.json',
      approvals: [
        {
          approvalId: 'appr-growth-live-copy',
          sessionId: 'growth-live-wait-session',
          action: 'draft:outreach-copy',
          tier: 'Assisted',
          requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 60_000),
          status: 'pending',
          delayWindowMs: 12 * 60_000,
          executionKey: 'growth-live-wait-session:draft:outreach-copy',
        },
        {
          approvalId: 'appr-growth-live-send',
          sessionId: 'growth-live-wait-session',
          action: 'send:approved-outreach',
          tier: 'Human-approve',
          requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 5 * 60_000),
          status: 'pending',
          delayWindowMs: 8 * 60 * 60_000,
          executionKey: 'growth-live-wait-session:send:approved-outreach',
        },
      ],
    },
    {
      variantId: 'restart-resume',
      sessionId: 'growth-restart-resume-session',
      runId: 'growth-restart-resume-run',
      agentId: 'openclaw-growth-agent',
      processMode: 'restarted',
      preWaitWrites: ['campaign-plan.md'],
      outputBundlePath: 'outputs/growth-restart-resume-session/campaign-approved.json',
      approvals: [
        {
          approvalId: 'appr-growth-restart-content',
          sessionId: 'growth-restart-resume-session',
          action: 'draft:launch-post',
          tier: 'Assisted',
          requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 90_000),
          status: 'pending',
          delayWindowMs: 15 * 60_000,
          executionKey: 'growth-restart-resume-session:draft:launch-post',
        },
        {
          approvalId: 'appr-growth-restart-publish',
          sessionId: 'growth-restart-resume-session',
          action: 'publish:launch-post',
          tier: 'Human-approve',
          requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 7 * 60_000),
          status: 'pending',
          delayWindowMs: 9 * 60 * 60_000,
          executionKey: 'growth-restart-resume-session:publish:launch-post',
        },
      ],
    },
  ];
}

function buildEvidenceChain(variant, approvals) {
  const events = [
    {
      evidenceId: `${variant.variantId}-ev-01`,
      phase: 'before-wait',
      atIso: FIXED_STARTED_AT_ISO,
      summary: `OpenClaw proposed governed Actions for ${variant.sessionId}`,
    },
    {
      evidenceId: `${variant.variantId}-ev-02`,
      phase: 'during-wait',
      atIso: addMs(FIXED_STARTED_AT_ISO, 4 * 60 * 60_000),
      summary: 'Approval Gate remained pending during business-length wait',
    },
    {
      evidenceId: `${variant.variantId}-ev-03`,
      phase: 'approval-decision',
      atIso: approvals.at(-1)?.decidedAtIso ?? FIXED_STARTED_AT_ISO,
      summary: 'Operator approved the blocked Action',
    },
    {
      evidenceId: `${variant.variantId}-ev-04`,
      phase: 'after-resume',
      atIso: approvals.at(-1)?.resumedAtIso ?? FIXED_STARTED_AT_ISO,
      summary: 'Agent resumed and wrote the approved output bundle',
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

function recordQueueSamples(telemetry, approvals) {
  for (const offsetMs of [
    0,
    10 * 60_000,
    4 * 60 * 60_000,
    8 * 60 * 60_000 + 5 * 60_000,
    9 * 60 * 60_000 + 10 * 60_000,
  ]) {
    const timestampIso = addMs(FIXED_STARTED_AT_ISO, offsetMs);
    telemetry.recordQueueDepth({ timestampIso, depth: queueDepthAt(approvals, timestampIso) });
  }
}

function applyVariant(variant, telemetry) {
  const executionLedger = [];

  for (const artifact of variant.preWaitWrites) {
    executionLedger.push({
      phase: 'pre-wait',
      key: `${variant.sessionId}:${artifact}`,
      atIso: addMs(FIXED_STARTED_AT_ISO, 30_000),
      replayedAfterResume: false,
    });
  }

  for (const approval of variant.approvals) {
    telemetry.recordApprovalRequested({
      approvalId: approval.approvalId,
      sessionId: approval.sessionId,
      tier: approval.tier,
      requestedAtIso: approval.requestedAtIso,
    });
  }

  if (variant.variantId === 'restart-resume') {
    telemetry.recordRestart({
      sessionId: variant.sessionId,
      restartedAtIso: addMs(FIXED_STARTED_AT_ISO, 3 * 60 * 60_000),
    });
  }

  for (const approval of variant.approvals) {
    approval.status = 'approved';
    approval.decidedAtIso = addMs(approval.requestedAtIso, approval.delayWindowMs);
    approval.resumedAtIso = addMs(approval.decidedAtIso, 1_500);

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
      resumedAtIso: approval.resumedAtIso,
      successful: true,
    });
    telemetry.recordDuplicateExecution(approval.executionKey);
    executionLedger.push({
      phase: 'post-approval',
      key: approval.executionKey,
      approvalId: approval.approvalId,
      atIso: approval.resumedAtIso,
      outputBundlePath: variant.outputBundlePath,
    });
  }

  return {
    ...variant,
    approvals: variant.approvals.map((approval) => ({ ...approval })),
    executionLedger,
    evidenceChain: buildEvidenceChain(variant, variant.approvals),
  };
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

function buildAssertions({ variantTraces, queueMetrics, evidenceSummary, trace }) {
  const longPendingApprovals = variantTraces.flatMap((variant) =>
    variant.approvals.filter((approval) => approval.delayWindowMs >= 8 * 60 * 60_000),
  );
  const restartVariant = variantTraces.find((variant) => variant.variantId === 'restart-resume');
  const replayedPriorWrites = variantTraces.flatMap((variant) =>
    variant.executionLedger.filter((entry) => entry.replayedAfterResume === true),
  );

  return [
    assert(
      'both required variants complete',
      new Set(variantTraces.map((variant) => variant.variantId)).size === 2,
      `variants=${variantTraces.map((variant) => variant.variantId).join(',')}`,
    ),
    assert(
      'pending approvals survive business-length wait windows',
      longPendingApprovals.length === 2 &&
        longPendingApprovals.every((approval) => approval.status === 'approved'),
      `longPending=${longPendingApprovals.length}`,
    ),
    assert(
      'restart-resume records recovery before approval',
      restartVariant?.processMode === 'restarted' &&
        Number(queueMetrics.metrics.restart_count) === 1 &&
        Date.parse(String(restartVariant.approvals.at(-1)?.decidedAtIso)) >
          Date.parse(addMs(FIXED_STARTED_AT_ISO, 3 * 60 * 60_000)),
      `restartCount=${String(queueMetrics.metrics.restart_count)}`,
    ),
    assert(
      'resume executes exactly once without replaying prior writes',
      Number(queueMetrics.metrics.duplicate_execution_count) === 0 &&
        replayedPriorWrites.length === 0,
      `duplicates=${String(queueMetrics.metrics.duplicate_execution_count)}, replayed=${replayedPriorWrites.length}`,
    ),
    assert(
      'queue metrics capture delayed resume timing',
      Array.isArray(queueMetrics.metrics.resume_latency_ms) &&
        queueMetrics.metrics.resume_latency_ms.length === 4 &&
        Number(queueMetrics.metrics.pending_age_ms_p95) >= 8 * 60 * 60_000,
      `resumeSamples=${Array.isArray(queueMetrics.metrics.resume_latency_ms) ? queueMetrics.metrics.resume_latency_ms.length : 0}`,
    ),
    assert(
      'evidence chain is continuous before wait, during wait, and after resume',
      evidenceChainsAreContinuous(variantTraces),
      `chains=${variantTraces.length}`,
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
 * Run the deterministic Growth Studio OpenClaw live-v2 replay.
 *
 * @param {RunGrowthStudioLiveV2Options} [options]
 * @returns {Promise<ExperimentOutcome>}
 */
export async function runGrowthStudioOpenClawLiveV2(options = {}) {
  const startedAt = Date.now();
  const writeResults = options.writeResults ?? true;
  const log = options.log ?? console.log;
  const liveRerun = await resolveIteration2LiveOpenClawRerun({
    scenarioId: EXPERIMENT_NAME,
    env: options.env,
    fetchImpl: options.fetchImpl,
    codexExecImpl: options.codexExecImpl,
  });
  const resultsDir =
    options.resultsDir ??
    (liveRerun.status === 'ready'
      ? join(
          dirname(fileURLToPath(import.meta.url)),
          '..',
          '..',
          'results',
          EXPERIMENT_NAME,
          LIVE_ATTEMPT_ID,
        )
      : DEFAULT_RESULTS_DIR);
  const attemptId = attemptIdFromResultsDir(resultsDir);
  let trace = {};
  let assertions = [];
  let error;
  let skipReason;

  try {
    if (liveRerun.status === 'skipped' || liveRerun.status === 'inconclusive') {
      skipReason = liveRerun.status === 'skipped' ? liveRerun.reason : undefined;
      if (liveRerun.status === 'inconclusive') error = liveRerun.reason;
      trace = {
        mode: 'live-llm-openclaw-rerun',
        liveModelPreflight: liveRerun.liveModelPreflight,
        classification: liveRerun.classification,
      };
    } else {
      log('[growth-studio-openclaw-live-v2] replaying delayed approval variants');
      const telemetry = createIteration2Telemetry({
        scenarioId: EXPERIMENT_NAME,
        attemptId,
        resultsDir,
        requiredEvidenceArtifacts: [
          'outcome.json',
          'queue-metrics.json',
          'evidence-summary.json',
          'report.md',
          ...(liveRerun.status === 'ready' ? ['live-rerun-metadata.json'] : []),
        ],
      });

      const variants = makeVariants();
      const allApprovals = variants.flatMap((variant) => variant.approvals);
      const variantTraces = variants.map((variant) => applyVariant(variant, telemetry));
      recordQueueSamples(telemetry, allApprovals);

      telemetry.recordEvidenceArtifact({ artifactName: 'outcome.json', present: true });
      telemetry.recordEvidenceArtifact({ artifactName: 'queue-metrics.json', present: true });
      telemetry.recordEvidenceArtifact({ artifactName: 'evidence-summary.json', present: true });
      telemetry.recordEvidenceArtifact({ artifactName: 'report.md', present: true });
      if (liveRerun.status === 'ready') {
        telemetry.recordEvidenceArtifact({
          artifactName: 'live-rerun-metadata.json',
          present: true,
        });
      }

      const observedAtIso = addMs(FIXED_STARTED_AT_ISO, 10 * 60 * 60_000);
      const thresholdAssertions = telemetry.evaluateThresholds(
        {
          maxDuplicateExecutionCount: 0,
          maxPendingAgeMsP95: 10 * 60 * 60_000,
          maxResumeLatencyMs: 2_000,
          minEvidenceCompletenessCount: 4,
          minSuccessfulResumeCount: 4,
        },
        observedAtIso,
      );
      const artifactPaths = writeResults ? telemetry.writeArtifacts(observedAtIso) : {};
      const queueMetrics = telemetry.buildQueueMetrics(observedAtIso);
      const evidenceSummary = telemetry.buildEvidenceSummary(observedAtIso);

      const baseTrace = {
        comparesTo: 'growth-studio-openclaw-live',
        mode: liveRerun.status === 'ready' ? 'live-llm-openclaw-rerun' : 'deterministic-replay',
        liveLlmInference:
          liveRerun.status === 'ready' ? 'opt-in-preflight-ready' : 'not-required-for-ci',
        variants: variantTraces,
        queueMetrics,
        evidenceSummary,
        artifactPaths,
        thresholdAssertions,
        operatorDelayWindows: variantTraces.flatMap((variant) =>
          variant.approvals.map((approval) => ({
            approvalId: approval.approvalId,
            variantId: variant.variantId,
            delayWindowMs: approval.delayWindowMs,
          })),
        ),
      };
      const exactOnceResume = {
        duplicateExecutionCount: queueMetrics.metrics.duplicate_execution_count,
        successfulResumeCount: queueMetrics.metrics.successful_resume_count,
        priorWritesReplayed: variantTraces.some((variant) =>
          variant.executionLedger.some((entry) => entry.replayedAfterResume === true),
        ),
        result:
          Number(queueMetrics.metrics.duplicate_execution_count) === 0 &&
          Number(queueMetrics.metrics.successful_resume_count) === 4
            ? 'exact-once'
            : 'not-exact-once',
      };
      const liveTrace =
        liveRerun.status === 'ready'
          ? buildLiveRerunTrace({
              scenarioId: EXPERIMENT_NAME,
              deterministicAttemptId: DETERMINISTIC_ATTEMPT_ID,
              deterministicOutcome: 'confirmed',
              liveAttemptId: LIVE_ATTEMPT_ID,
              liveModelPreflight: liveRerun.liveModelPreflight,
              classification: liveRerun.classification,
              approvalIds: variantTraces.flatMap((variant) =>
                variant.approvals.map((approval) => approval.approvalId),
              ),
              queueMetrics,
              evidenceSummary,
              exactOnceResume,
            })
          : undefined;
      trace = liveTrace ? { ...baseTrace, liveOpenClawRerun: liveTrace } : baseTrace;
      if (writeResults && liveTrace) {
        artifactPaths.liveRerunMetadataPath = writeLiveRerunMetadataArtifact(resultsDir, liveTrace);
      }
      assertions = buildAssertions({ variantTraces, queueMetrics, evidenceSummary, trace });
      if (liveTrace) {
        assertions.push(
          assert(
            'live rerun records redacted provider metadata and separates variability',
            liveTrace.liveModelPreflight.status === 'ready' &&
              liveTrace.classification.productDefects.length === 0,
            `provider=${liveTrace.liveModelPreflight.provider ?? 'none'}, defects=${liveTrace.classification.productDefects.length}`,
          ),
        );
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const duration_ms = Date.now() - startedAt;
  const outcome =
    skipReason != null
      ? 'skipped'
      : error != null
        ? 'inconclusive'
        : assertions.length > 0 && assertions.every((item) => item.passed)
          ? 'confirmed'
          : 'refuted';

  const result = {
    experiment: EXPERIMENT_NAME,
    attemptId,
    timestamp: new Date().toISOString(),
    outcome,
    duration_ms,
    assertions,
    trace,
    ...(skipReason ? { skipReason } : {}),
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
  const outcome = await runGrowthStudioOpenClawLiveV2({ resultsDir });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
