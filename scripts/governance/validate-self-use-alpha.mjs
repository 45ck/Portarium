#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ALPHA_PATH = path.join(
  process.cwd(),
  'docs',
  'internal',
  'governance',
  'source-to-micro-saas-self-use-alpha.json',
);

const REQUIRED_EVIDENCE_EVENTS = [
  'operator-effort',
  'exception',
  'rollback-event',
  'failure',
  'manual-fallback',
  'stop-using-it',
  'useful-output',
  'artifact-review',
];

const REQUIRED_ARTIFACT_KINDS = [
  'project-brief',
  'research-dossier',
  'opportunity-brief',
  'implementation-or-backlog-artifact',
  'qa-or-release-evidence',
  'usefulness-scorecard',
];

const REQUIRED_SCORECARD_METRICS = [
  'operator_minutes_per_run',
  'approval_latency_ms_p50',
  'approval_latency_ms_p95',
  'blocked_duration_ms_p50',
  'blocked_duration_ms_p95',
  'throughput_per_operator_per_day',
  'throughput_per_workspace_per_day',
  'denial_rate',
  'rework_rate',
  'duplicate_execution_rate',
  'unsafe_action_escape_rate',
  'policy_violation_escape_rate',
  'cost_per_useful_outcome',
  'model_cost_per_useful_outcome',
  'tool_cost_per_useful_outcome',
  'operator_cost_per_useful_outcome',
  'business_kpi_delta_primary',
  'business_kpi_delta_secondary',
  'useful_outcome_count',
  'baseline_comparison_confidence',
  'baseline_sample_size_runs',
  'pilot_sample_size_runs',
];

const REQUIRED_FALLBACK_FIELDS = [
  'reason',
  'operatorMinutes',
  'workMovedOutsidePortarium',
  'evidenceRefs',
  'returnCondition',
];

const REQUIRED_STOP_USING_FIELDS = [
  'stoppedAtIso',
  'runId',
  'reason',
  'manualFallbackUsed',
  'restartCondition',
  'followUpBeadRefs',
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringField(record, field) {
  const value = isRecord(record) ? record[field] : undefined;
  return typeof value === 'string' ? value : '';
}

function numberField(record, field) {
  const value = isRecord(record) ? record[field] : undefined;
  return typeof value === 'number' ? value : Number.NaN;
}

function arrayField(record, field) {
  const value = isRecord(record) ? record[field] : undefined;
  return Array.isArray(value) ? value : [];
}

function hasAll(values, required) {
  const actual = new Set(values.filter((value) => typeof value === 'string'));
  return required.every((value) => actual.has(value));
}

function assertion(id, passed, message) {
  return { id, passed, message };
}

function validateChosenWorkflow(plan) {
  return assertion(
    'chosen-workflow',
    stringField(plan, 'workflowId') === 'source-to-micro-saas-builder' &&
      stringField(plan, 'projectTypeId') === 'micro-saas-agent-stack',
    'Plan must bind bead-1102 to the chosen source-to-micro-saas-builder workflow and micro-saas-agent-stack Project type.',
  );
}

function validateSelfUseClaim(plan) {
  return assertion(
    'truthful-self-use-label',
    stringField(plan, 'readinessLabel') === 'self-use' &&
      stringField(plan, 'productionClaim') === 'self-use',
    'Plan must carry an explicit self-use readiness label and production claim for the alpha Project.',
  );
}

function validateRecurrence(plan) {
  const recurrence = isRecord(plan) ? plan['recurrence'] : undefined;
  return assertion(
    'recurring-alpha-window',
    stringField(recurrence, 'cadence') === 'weekly' &&
      numberField(recurrence, 'minimumPilotRuns') >= 3 &&
      numberField(recurrence, 'minimumCalendarDays') >= 7,
    'Alpha must be recurring: weekly cadence, at least three Runs, and at least seven calendar days.',
  );
}

function validateBaseline(plan) {
  const baseline = isRecord(plan) ? plan['baseline'] : undefined;
  return assertion(
    'baseline-capture',
    stringField(baseline, 'comparisonWorkflow').length > 0 &&
      numberField(baseline, 'minimumSampleSizeRuns') >= 3 &&
      arrayField(baseline, 'captureMethods').length >= 2,
    'Plan must define a comparable manual baseline with sample size and capture methods.',
  );
}

function validateUsefulOutcome(plan) {
  const usefulOutcome = isRecord(plan) ? plan['usefulOutcome'] : undefined;
  return assertion(
    'useful-outcome',
    stringField(usefulOutcome, 'definition').includes('Artifact package') &&
      arrayField(usefulOutcome, 'acceptanceSignals').length >= 4,
    'Plan must define a useful Artifact package outcome and acceptance signals.',
  );
}

function validateArtifacts(plan) {
  const artifactKinds = arrayField(plan, 'artifactPlan').map((item) =>
    isRecord(item) ? stringField(item, 'artifactKind') : '',
  );
  return assertion(
    'required-artifacts',
    hasAll(artifactKinds, REQUIRED_ARTIFACT_KINDS),
    `Plan must require artifact kinds: ${REQUIRED_ARTIFACT_KINDS.join(', ')}.`,
  );
}

function validateEvidenceEvents(plan) {
  const eventKinds = arrayField(plan, 'requiredEvidenceEvents').map((item) =>
    isRecord(item) ? stringField(item, 'eventKind') : '',
  );
  return assertion(
    'required-evidence-events',
    hasAll(eventKinds, REQUIRED_EVIDENCE_EVENTS),
    `Plan must capture evidence events: ${REQUIRED_EVIDENCE_EVENTS.join(', ')}.`,
  );
}

function validateRollbackProtocol(plan) {
  const rollback = isRecord(plan) ? plan['rollbackProtocol'] : undefined;
  return assertion(
    'rollback-protocol',
    arrayField(rollback, 'rollbackScopeLevels').length >= 3 &&
      arrayField(rollback, 'rollbackTriggers').length >= 5 &&
      arrayField(rollback, 'completionCriteria').length >= 4,
    'Plan must define rollback levels, triggers, and completion criteria.',
  );
}

function validateManualFallback(plan) {
  const fallback = isRecord(plan) ? plan['manualFallbackProtocol'] : undefined;
  return assertion(
    'manual-fallback-protocol',
    arrayField(fallback, 'allowedRoutes').length >= 3 &&
      hasAll(arrayField(fallback, 'requiredFields'), REQUIRED_FALLBACK_FIELDS),
    `Plan must define manual fallback routes and fields: ${REQUIRED_FALLBACK_FIELDS.join(', ')}.`,
  );
}

function validateStopUsingIt(plan) {
  const stopUsingIt = isRecord(plan) ? plan['stopUsingItProtocol'] : undefined;
  return assertion(
    'stop-using-it-protocol',
    arrayField(stopUsingIt, 'requiredTriggers').length >= 5 &&
      hasAll(arrayField(stopUsingIt, 'requiredFields'), REQUIRED_STOP_USING_FIELDS),
    `Plan must define stop-using-it triggers and fields: ${REQUIRED_STOP_USING_FIELDS.join(', ')}.`,
  );
}

function validateScorecard(plan) {
  return assertion(
    'scorecard-metrics',
    hasAll(arrayField(plan, 'scorecardMetrics'), REQUIRED_SCORECARD_METRICS),
    `Plan must include governed pilot scorecard metrics: ${REQUIRED_SCORECARD_METRICS.join(', ')}.`,
  );
}

function validateRunLedger(plan) {
  const template = isRecord(plan) ? plan['runLedgerTemplate'] : undefined;
  const required = [
    'operatorMinutes',
    'exceptionEvents',
    'rollbackEvents',
    'manualFallbackEvents',
    'stopUsingItEvents',
    'followUpBeadRefs',
  ];
  return assertion(
    'run-ledger-template',
    hasAll(arrayField(template, 'requiredFields'), required),
    `Run ledger must include fields for effort, exceptions, rollback, manual fallback, stop-using-it, and follow-up Beads.`,
  );
}

export function validateSelfUseAlphaPlan(plan) {
  return [
    validateChosenWorkflow(plan),
    validateSelfUseClaim(plan),
    validateRecurrence(plan),
    validateBaseline(plan),
    validateUsefulOutcome(plan),
    validateArtifacts(plan),
    validateEvidenceEvents(plan),
    validateRollbackProtocol(plan),
    validateManualFallback(plan),
    validateStopUsingIt(plan),
    validateScorecard(plan),
    validateRunLedger(plan),
  ];
}

export async function loadSelfUseAlphaPlan(filePath = DEFAULT_ALPHA_PATH) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function validateSelfUseAlphaFile(filePath = DEFAULT_ALPHA_PATH) {
  const plan = await loadSelfUseAlphaPlan(filePath);
  return validateSelfUseAlphaPlan(plan);
}

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    filePath: argv.find((value, index) => argv[index - 1] === '--file') ?? DEFAULT_ALPHA_PATH,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const assertions = await validateSelfUseAlphaFile(args.filePath);
  const failed = assertions.filter((item) => !item.passed);

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({ passed: failed.length === 0, assertions }, null, 2)}\n`,
    );
  } else {
    for (const item of assertions) {
      process.stdout.write(`${item.passed ? 'pass' : 'fail'} ${item.id}: ${item.message}\n`);
    }
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exit(1);
  });
}
