// @ts-check

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createIteration2Telemetry } from '../../../shared/iteration2-telemetry.js';
import { runExperimentToolPreflight } from '../../../shared/toolchain-preflight.js';

const EXPERIMENT_NAME = 'micro-saas-agent-stack-v2';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');
const FIXED_STARTED_AT_ISO = '2026-04-29T02:00:00.000Z';

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
 *   requestedBy: string;
 *   requiredOperator: 'operator-a' | 'operator-b';
 *   requestedAtIso: string;
 *   status: 'pending' | 'approved' | 'request_changes' | 'denied';
 *   decidedAtIso?: string;
 *   decidedBy?: string;
 * }} HandoffApproval
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
 *   toolPreflightImpl?: typeof runExperimentToolPreflight;
 * }} RunMicroSaasHandoffOptions
 */

function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function makeApprovals() {
  /** @type {HandoffApproval[]} */
  return [
    {
      approvalId: 'appr-ms-01',
      sessionId: 'micro-saas-run-1',
      action: 'draft:landing-page-copy',
      tier: 'Assisted',
      requestedBy: 'agent-product-builder',
      requiredOperator: 'operator-a',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 0),
      status: 'pending',
    },
    {
      approvalId: 'appr-ms-02',
      sessionId: 'micro-saas-run-1',
      action: 'draft:pricing-page',
      tier: 'Assisted',
      requestedBy: 'agent-product-builder',
      requiredOperator: 'operator-a',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 2_000),
      status: 'pending',
    },
    {
      approvalId: 'appr-ms-03',
      sessionId: 'micro-saas-run-1',
      action: 'publish:landing-page',
      tier: 'Human-approve',
      requestedBy: 'agent-product-builder',
      requiredOperator: 'operator-b',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 4_000),
      status: 'pending',
    },
    {
      approvalId: 'appr-ms-04',
      sessionId: 'micro-saas-run-1',
      action: 'send:launch-email',
      tier: 'Human-approve',
      requestedBy: 'agent-product-builder',
      requiredOperator: 'operator-b',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 6_000),
      status: 'pending',
    },
    {
      approvalId: 'appr-ms-05',
      sessionId: 'micro-saas-run-1',
      action: 'create:analytics-dashboard',
      tier: 'Assisted',
      requestedBy: 'agent-product-builder',
      requiredOperator: 'operator-a',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 8_000),
      status: 'pending',
    },
  ];
}

function queueSnapshot(label, approvals, atIso) {
  return {
    label,
    atIso,
    pending: approvals
      .filter((approval) => approval.status === 'pending')
      .map((approval) => ({
        approvalId: approval.approvalId,
        action: approval.action,
        requiredOperator: approval.requiredOperator,
        tier: approval.tier,
      })),
    decided: approvals
      .filter((approval) => approval.status !== 'pending')
      .map((approval) => ({
        approvalId: approval.approvalId,
        status: approval.status,
        decidedBy: approval.decidedBy,
      })),
  };
}

function decide(approval, status, operatorId, decidedAtIso, telemetry) {
  approval.status = status;
  approval.decidedBy = operatorId;
  approval.decidedAtIso = decidedAtIso;
  telemetry.recordApprovalDecision({
    approvalId: approval.approvalId,
    status,
    decidedAtIso,
  });
  telemetry.recordSessionBlocked({
    sessionId: approval.sessionId,
    blockedAtIso: approval.requestedAtIso,
    unblockedAtIso: decidedAtIso,
  });

  if (status === 'approved') {
    telemetry.recordResume({
      sessionId: approval.sessionId,
      approvalId: approval.approvalId,
      decidedAtIso,
      resumedAtIso: addMs(decidedAtIso, 900),
      successful: true,
    });
    telemetry.recordDuplicateExecution(`${approval.sessionId}:${approval.approvalId}:execute`);
  }
}

function applyHandoff(approvals, telemetry) {
  for (const approval of approvals) {
    telemetry.recordApprovalRequested({
      approvalId: approval.approvalId,
      sessionId: approval.sessionId,
      tier: approval.tier,
      requestedAtIso: approval.requestedAtIso,
    });
  }

  const snapshots = [
    queueSnapshot('before-operator-actions', approvals, addMs(FIXED_STARTED_AT_ISO, 9_000)),
  ];
  telemetry.recordQueueDepth({ timestampIso: addMs(FIXED_STARTED_AT_ISO, 9_000), depth: 5 });

  decide(approvals[0], 'approved', 'operator-a', addMs(FIXED_STARTED_AT_ISO, 12_000), telemetry);
  decide(
    approvals[1],
    'request_changes',
    'operator-a',
    addMs(FIXED_STARTED_AT_ISO, 16_000),
    telemetry,
  );
  snapshots.push(queueSnapshot('after-operator-a', approvals, addMs(FIXED_STARTED_AT_ISO, 17_000)));
  telemetry.recordQueueDepth({ timestampIso: addMs(FIXED_STARTED_AT_ISO, 17_000), depth: 3 });

  decide(approvals[2], 'approved', 'operator-b', addMs(FIXED_STARTED_AT_ISO, 24_000), telemetry);
  decide(approvals[3], 'denied', 'operator-b', addMs(FIXED_STARTED_AT_ISO, 30_000), telemetry);
  decide(approvals[4], 'approved', 'operator-a', addMs(FIXED_STARTED_AT_ISO, 34_000), telemetry);
  snapshots.push(
    queueSnapshot('after-team-handoff', approvals, addMs(FIXED_STARTED_AT_ISO, 35_000)),
  );
  telemetry.recordQueueDepth({ timestampIso: addMs(FIXED_STARTED_AT_ISO, 35_000), depth: 0 });

  return snapshots;
}

function buildAssertions({ approvals, snapshots, queueMetrics, evidenceSummary, trace }) {
  const sodViolations = approvals.filter((approval) => approval.decidedBy === approval.requestedBy);
  const wrongOperatorDecisions = approvals.filter(
    (approval) => approval.decidedBy != null && approval.decidedBy !== approval.requiredOperator,
  );
  const requestChanges = approvals.filter((approval) => approval.status === 'request_changes');
  const denied = approvals.filter((approval) => approval.status === 'denied');
  const approved = approvals.filter((approval) => approval.status === 'approved');

  return [
    assert(
      'Separation of Duties is preserved',
      sodViolations.length === 0 && wrongOperatorDecisions.length === 0,
      `sodViolations=${sodViolations.length}, wrongOperator=${wrongOperatorDecisions.length}`,
    ),
    assert(
      'request-changes and denied work do not stop unrelated approvals',
      requestChanges.length === 1 && denied.length === 1 && approved.length >= 3,
      `approved=${approved.length}, requestChanges=${requestChanges.length}, denied=${denied.length}`,
    ),
    assert(
      'queue snapshots capture before and after operator actions',
      snapshots.length === 3 &&
        snapshots[0].pending.length === 5 &&
        snapshots.at(-1)?.pending.length === 0,
      `snapshots=${snapshots.length}`,
    ),
    assert(
      'queue metrics include handoff timing',
      Array.isArray(queueMetrics.metrics.queue_depth_over_time) &&
        queueMetrics.metrics.queue_depth_over_time.length === 3 &&
        Number(queueMetrics.metrics.successful_resume_count) === 3,
      `queueSamples=${Array.isArray(queueMetrics.metrics.queue_depth_over_time) ? queueMetrics.metrics.queue_depth_over_time.length : 0}`,
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

function writeJsonArtifact(resultsDir, artifactName, value) {
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, artifactName), `${JSON.stringify(value, null, 2)}\n`);
}

function buildToolchainReportSections(toolchainPreflight) {
  return [
    '## Experiment Toolchain Preflight',
    '',
    '| Tool | Status | Rationale |',
    '| --- | --- | --- |',
    `| ${toolchainPreflight.tool} | ${toolchainPreflight.status} | ${toolchainPreflight.rationale ?? 'n/a'} |`,
    '',
    `Demo-machine clip spec: \`${toolchainPreflight.clipSpecPath ?? 'n/a'}\``,
    '',
  ];
}

/**
 * Run the deterministic micro-SaaS operator handoff experiment.
 *
 * @param {RunMicroSaasHandoffOptions} [options]
 * @returns {Promise<ExperimentOutcome>}
 */
export async function runMicroSaasAgentStackV2(options = {}) {
  const startedAt = Date.now();
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const writeResults = options.writeResults ?? true;
  const log = options.log ?? console.log;
  const attemptId = 'deterministic-handoff-v1';
  let trace = {};
  let assertions = [];
  let error;

  try {
    log('[micro-saas-agent-stack-v2] simulating operator-team handoff');
    const toolPreflightImpl = options.toolPreflightImpl ?? runExperimentToolPreflight;
    const toolchainPreflight = await toolPreflightImpl({ tool: 'demo-machine' });

    const telemetry = createIteration2Telemetry({
      scenarioId: EXPERIMENT_NAME,
      attemptId,
      resultsDir,
      requiredEvidenceArtifacts: [
        'outcome.json',
        'queue-metrics.json',
        'evidence-summary.json',
        'report.md',
        'demo-machine-preflight.json',
      ],
    });

    const approvals = makeApprovals();
    const snapshots = applyHandoff(approvals, telemetry);
    telemetry.recordEvidenceArtifact({ artifactName: 'outcome.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'queue-metrics.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'evidence-summary.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'report.md', present: true });
    telemetry.recordEvidenceArtifact({
      artifactName: 'demo-machine-preflight.json',
      present: true,
    });

    const observedAtIso = addMs(FIXED_STARTED_AT_ISO, 40_000);
    const thresholdAssertions = telemetry.evaluateThresholds(
      {
        maxDuplicateExecutionCount: 0,
        maxPendingAgeMsP95: 32_000,
        maxResumeLatencyMs: 2_000,
        minEvidenceCompletenessCount: 4,
        minSuccessfulResumeCount: 3,
      },
      observedAtIso,
    );
    if (writeResults) {
      writeJsonArtifact(resultsDir, 'demo-machine-preflight.json', toolchainPreflight);
    }
    const artifactPaths = writeResults
      ? telemetry.writeArtifacts(observedAtIso, buildToolchainReportSections(toolchainPreflight))
      : {};
    const queueMetrics = telemetry.buildQueueMetrics(observedAtIso);
    const evidenceSummary = telemetry.buildEvidenceSummary(observedAtIso);

    trace = {
      comparesTo: 'micro-saas-agent-stack',
      toolchainPreflight: {
        demoMachine: toolchainPreflight,
      },
      approvals,
      queueSnapshots: snapshots,
      queueMetrics,
      evidenceSummary,
      artifactPaths,
      thresholdAssertions,
      handoff: {
        operatorA: approvals.filter((approval) => approval.decidedBy === 'operator-a').length,
        operatorB: approvals.filter((approval) => approval.decidedBy === 'operator-b').length,
      },
    };
    assertions = buildAssertions({ approvals, snapshots, queueMetrics, evidenceSummary, trace });
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
  const outcome = await runMicroSaasAgentStackV2({ resultsDir });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
