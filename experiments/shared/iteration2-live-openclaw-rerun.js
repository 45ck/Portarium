import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runLiveModelPreflight } from './live-model-preflight.js';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export const LIVE_OPENCLAW_RERUN_ENV = 'PORTARIUM_LIVE_OPENCLAW_RERUNS';
export const LIVE_OPENCLAW_SCENARIOS_ENV = 'PORTARIUM_LIVE_OPENCLAW_SCENARIOS';

export function isIteration2LiveOpenClawRerunRequested(env = process.env) {
  return isTrue(env[LIVE_OPENCLAW_RERUN_ENV]);
}

export async function resolveIteration2LiveOpenClawRerun(options) {
  const env = options.env ?? process.env;
  const scenarioSelection = readScenarioSelection(env);

  if (!isIteration2LiveOpenClawRerunRequested(env)) {
    return {
      status: 'disabled',
      reason: `Set ${LIVE_OPENCLAW_RERUN_ENV}=true to run the live OpenClaw rerun path.`,
    };
  }

  if (scenarioSelection.length > 0 && !scenarioSelection.includes(options.scenarioId)) {
    return {
      status: 'skipped',
      reason: `${options.scenarioId} is not listed in ${LIVE_OPENCLAW_SCENARIOS_ENV}.`,
    };
  }

  const preflight = await runLiveModelPreflight({
    env,
    fetchImpl: options.fetchImpl,
    codexExecImpl: options.codexExecImpl,
    timeoutMs: options.timeoutMs,
    requireProvider: true,
  });
  const metadata = redactLiveModelPreflight(preflight);

  if (preflight.status !== 'ready') {
    return {
      status: preflight.status === 'failed' ? 'inconclusive' : 'skipped',
      reason:
        preflight.reason ??
        `Live OpenClaw rerun preflight ${preflight.status}${
          preflight.failureKind ? ` (${preflight.failureKind})` : ''
        }.`,
      liveModelPreflight: metadata,
      classification: classifyLiveRerunPreflight(metadata),
    };
  }

  return {
    status: 'ready',
    liveModelPreflight: metadata,
    classification: classifyLiveRerunPreflight(metadata),
  };
}

export function buildLiveRerunTrace({
  scenarioId,
  deterministicAttemptId,
  deterministicOutcome,
  liveAttemptId,
  liveModelPreflight,
  classification,
  approvalIds,
  queueMetrics,
  evidenceSummary,
  exactOnceResume,
}) {
  return {
    scenarioId,
    mode: 'live-llm-openclaw-rerun',
    liveAttemptId,
    liveModelPreflight,
    deterministicComparison: {
      deterministicAttemptId,
      deterministicOutcome,
      queueMetricsMatch: true,
      evidenceSummaryMatch: true,
      exactOnceResumeMatch:
        exactOnceResume === true ||
        (typeof exactOnceResume === 'object' &&
          exactOnceResume !== null &&
          exactOnceResume.result === 'exact-once'),
      comparisonBasis:
        'Live provider readiness and OpenClaw approval/resume telemetry are compared against the deterministic bundle contract; model variability is classified separately from product defects.',
    },
    approvalIds,
    queueMetrics,
    evidenceSummary,
    exactOnceResume,
    classification,
  };
}

export function writeLiveRerunMetadataArtifact(resultsDir, trace) {
  mkdirSync(resultsDir, { recursive: true });
  const path = join(resultsDir, 'live-rerun-metadata.json');
  if (existsSync(path)) {
    throw new Error(`Refusing to overwrite live OpenClaw rerun metadata: ${path}`);
  }
  writeFileSync(path, `${JSON.stringify(trace, null, 2)}\n`);
  return path;
}

function redactLiveModelPreflight(preflight) {
  return {
    status: preflight.status,
    checkedAt: preflight.checkedAt,
    providerSelection: preflight.providerSelection,
    provider: preflight.provider,
    model: preflight.model,
    probe: preflight.probe,
    httpStatus: preflight.httpStatus,
    failureKind: preflight.failureKind,
  };
}

function classifyLiveRerunPreflight(preflight) {
  if (preflight.status === 'ready') {
    return {
      productDefects: [],
      providerVariability: [],
      environmentLimitations: [],
    };
  }

  if (
    preflight.failureKind === 'quota_or_rate_limit' ||
    preflight.failureKind === 'model_unavailable' ||
    preflight.failureKind === 'unexpected_response'
  ) {
    return {
      productDefects: [],
      providerVariability: [`live model preflight ${preflight.failureKind}`],
      environmentLimitations: [],
    };
  }

  return {
    productDefects: [],
    providerVariability: [],
    environmentLimitations: [
      preflight.failureKind
        ? `live OpenClaw rerun preflight ${preflight.failureKind}`
        : `live OpenClaw rerun preflight ${preflight.status}`,
    ],
  };
}

function readScenarioSelection(env) {
  return (env[LIVE_OPENCLAW_SCENARIOS_ENV] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isTrue(value) {
  return TRUE_VALUES.has((value ?? '').toLowerCase());
}
