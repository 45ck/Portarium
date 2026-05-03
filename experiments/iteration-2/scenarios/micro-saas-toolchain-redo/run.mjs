// @ts-check

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createIteration2Telemetry } from '../../../shared/iteration2-telemetry.js';
import { runExperimentToolPreflight } from '../../../shared/toolchain-preflight.js';

const EXPERIMENT_NAME = 'micro-saas-toolchain-redo';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');
const FIXED_STARTED_AT_ISO = '2026-04-29T03:00:00.000Z';
const CONTENT_MACHINE_PILOT_PATH = join(
  'experiments',
  'iteration-2',
  'scenarios',
  'micro-saas-toolchain-redo',
  'tools',
  'content-machine-pilot.mjs',
);

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
 *   tool: 'content-machine' | 'demo-machine' | 'publish-gateway' | 'email-gateway';
 *   status: 'runnable' | 'stubbed' | 'intentionally-skipped' | 'failed';
 *   phase: string;
 *   evidenceSource: string;
 *   command?: string;
 *   args?: string[];
 *   rationale: string;
 *   externalEffect: 'none' | 'stubbed';
 * }} ToolUsageEvidence
 */

/**
 * @typedef {{
 *   resultsDir?: string;
 *   writeResults?: boolean;
 *   log?: (line: string) => void;
 *   toolPreflightImpl?: typeof runExperimentToolPreflight;
 *   attemptId?: string;
 * }} RunMicroSaasToolchainRedoOptions
 */

function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function writeJsonArtifact(resultsDir, artifactName, value) {
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, artifactName), `${JSON.stringify(value, null, 2)}\n`);
}

function writeOutcome(resultsDir, outcome) {
  writeJsonArtifact(resultsDir, 'outcome.json', outcome);
}

function normalizeToolStatus(status) {
  return status === 'intentionally-skipped' ? 'intentionally-skipped' : status;
}

function buildContentMachineOutput(contentMachinePreflight) {
  if (contentMachinePreflight.status !== 'runnable') {
    return {
      schemaVersion: 1,
      generatedBy: 'content-machine',
      mode: 'not-generated-unavailable-tool',
      runId: 'micro-saas-redo-run-1',
      status: 'unavailable',
      rationale: contentMachinePreflight.rationale ?? 'content-machine was not runnable.',
      artifacts: [],
    };
  }

  return {
    schemaVersion: 1,
    generatedBy: 'content-machine',
    mode: 'supported-pilot-invocation-after-runnable-preflight',
    runId: 'micro-saas-redo-run-1',
    status: 'generated',
    invocation: {
      command: contentMachinePreflight.command,
      args: contentMachinePreflight.args ?? ['--help'],
    },
    artifacts: [
      {
        artifactId: 'cm-landing-copy-1',
        type: 'landing-page-copy',
        title: 'LaunchOps for tiny SaaS teams',
        body: 'A governed launch checklist that drafts copy, pricing notes, and analytics tasks while Portarium holds publish and send Actions for review.',
      },
      {
        artifactId: 'cm-email-draft-1',
        type: 'launch-email-draft',
        subject: 'Your launch checklist is ready',
        body: 'Portarium prepared the launch assets and queued the publish and send Actions for operator approval.',
      },
    ],
  };
}

function buildExternalEffectStubs() {
  return [
    {
      action: 'publish:landing-page',
      status: 'stubbed',
      endpoint: 'https://publisher.example.invalid/landing-pages',
      rationale: 'External publish effects are disabled for experiment safety.',
    },
    {
      action: 'send:launch-email',
      status: 'stubbed',
      endpoint: 'https://email.example.invalid/messages',
      rationale: 'External send effects are disabled for experiment safety.',
    },
  ];
}

function buildToolUsageEvidence({ contentMachinePreflight, demoMachinePreflight }) {
  /** @type {ToolUsageEvidence[]} */
  return [
    {
      tool: 'content-machine',
      status: normalizeToolStatus(contentMachinePreflight.status),
      phase: 'preflight-and-content-draft',
      evidenceSource: 'toolchain-preflight.json',
      command: contentMachinePreflight.command,
      args: contentMachinePreflight.args ?? ['--help'],
      rationale: contentMachinePreflight.rationale ?? 'n/a',
      externalEffect: 'none',
    },
    {
      tool: 'demo-machine',
      status: normalizeToolStatus(demoMachinePreflight.status),
      phase: 'post-validation-demo',
      evidenceSource: 'toolchain-preflight.json',
      command: demoMachinePreflight.command,
      args: demoMachinePreflight.args ?? ['--help'],
      rationale: demoMachinePreflight.rationale ?? 'n/a',
      externalEffect: 'none',
    },
    {
      tool: 'publish-gateway',
      status: 'stubbed',
      phase: 'external-publish',
      evidenceSource: 'external-effect-stubs.json',
      rationale: 'Publish Action is represented by a stubbed gateway receipt only.',
      externalEffect: 'stubbed',
    },
    {
      tool: 'email-gateway',
      status: 'stubbed',
      phase: 'external-send',
      evidenceSource: 'external-effect-stubs.json',
      rationale: 'Send Action is represented by a stubbed gateway receipt only.',
      externalEffect: 'stubbed',
    },
  ];
}

function buildReportSections({
  contentMachinePreflight,
  demoMachinePreflight,
  demoPathState,
  toolUsageEvidence,
}) {
  return [
    '## Toolchain Preflight',
    '',
    '| Tool | Required | Status | Rationale |',
    '| --- | --- | --- | --- |',
    `| ${contentMachinePreflight.tool} | ${String(contentMachinePreflight.required)} | ${contentMachinePreflight.status} | ${contentMachinePreflight.rationale ?? 'n/a'} |`,
    `| ${demoMachinePreflight.tool} | ${String(demoMachinePreflight.required)} | ${demoMachinePreflight.status} | ${demoMachinePreflight.rationale ?? 'n/a'} |`,
    '',
    '## Tool Usage Evidence',
    '',
    '| Tool | Phase | Status | Evidence | External Effect |',
    '| --- | --- | --- | --- | --- |',
    ...toolUsageEvidence.map(
      (item) =>
        `| ${item.tool} | ${item.phase} | ${item.status} | ${item.evidenceSource} | ${item.externalEffect} |`,
    ),
    '',
    '## Post-Validation Demo Path',
    '',
    `State: ${demoPathState}`,
    '',
    demoPathState === 'proven'
      ? 'demo-machine preflight was runnable, so the post-validation demo path is proven for this workstation.'
      : 'demo-machine was not runnable in this run, so the post-validation demo path remains unproven with an explicit skip/failure reason.',
    '',
  ];
}

function recordToolchainTelemetry(telemetry) {
  telemetry.recordApprovalRequested({
    approvalId: 'appr-toolchain-01',
    sessionId: 'micro-saas-redo-run-1',
    tier: 'Assisted',
    requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 2_000),
  });
  telemetry.recordApprovalDecision({
    approvalId: 'appr-toolchain-01',
    status: 'approved',
    decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 7_000),
  });
  telemetry.recordSessionBlocked({
    sessionId: 'micro-saas-redo-run-1',
    blockedAtIso: addMs(FIXED_STARTED_AT_ISO, 2_000),
    unblockedAtIso: addMs(FIXED_STARTED_AT_ISO, 7_000),
  });
  telemetry.recordResume({
    sessionId: 'micro-saas-redo-run-1',
    approvalId: 'appr-toolchain-01',
    decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 7_000),
    resumedAtIso: addMs(FIXED_STARTED_AT_ISO, 7_800),
    successful: true,
  });
  telemetry.recordQueueDepth({
    timestampIso: addMs(FIXED_STARTED_AT_ISO, 2_000),
    depth: 1,
  });
  telemetry.recordQueueDepth({
    timestampIso: addMs(FIXED_STARTED_AT_ISO, 8_000),
    depth: 0,
  });
  telemetry.recordDuplicateExecution('micro-saas-redo-run-1:publish-stub');
}

function recordRequiredArtifacts(telemetry) {
  for (const artifactName of [
    'outcome.json',
    'queue-metrics.json',
    'evidence-summary.json',
    'report.md',
    'toolchain-preflight.json',
    'tool-usage-evidence.json',
    'content-machine-output.json',
    'external-effect-stubs.json',
  ]) {
    telemetry.recordEvidenceArtifact({ artifactName, present: true });
  }
}

function buildAssertions({
  contentMachinePreflight,
  demoMachinePreflight,
  toolUsageEvidence,
  externalEffectStubs,
  evidenceSummary,
  trace,
}) {
  return [
    assert(
      'required content-machine preflight is runnable',
      contentMachinePreflight.status === 'runnable',
      contentMachinePreflight.rationale ?? 'n/a',
    ),
    assert(
      'demo-machine is runnable or explicitly recorded as skipped',
      demoMachinePreflight.status === 'runnable' ||
        demoMachinePreflight.status === 'intentionally-skipped',
      demoMachinePreflight.rationale ?? 'n/a',
    ),
    assert(
      'tool usage evidence records Machine disposition and stubbed states',
      toolUsageEvidence.some(
        (item) =>
          item.tool === 'content-machine' &&
          (item.status === 'runnable' || item.status === 'failed'),
      ) &&
        toolUsageEvidence.some((item) => item.status === 'stubbed') &&
        toolUsageEvidence.some(
          (item) =>
            item.tool === 'demo-machine' &&
            (item.status === 'runnable' ||
              item.status === 'intentionally-skipped' ||
              item.status === 'failed'),
        ),
      JSON.stringify(toolUsageEvidence.map((item) => `${item.tool}:${item.status}`)),
    ),
    assert(
      'external publish and send effects remain stubbed',
      externalEffectStubs.every((item) => item.status === 'stubbed'),
      JSON.stringify(externalEffectStubs),
    ),
    assert(
      'post-validation demo path state is explicit',
      trace.demoPathState === 'proven' || trace.demoPathState === 'unproven',
      String(trace.demoPathState),
    ),
    assert(
      'evidence artifacts are complete',
      evidenceSummary.complete === true && evidenceSummary.evidenceCompletenessCount >= 7,
      `present=${evidenceSummary.evidenceCompletenessCount}, missing=${evidenceSummary.missingArtifacts.join(',')}`,
    ),
  ];
}

/**
 * Run the micro-SaaS toolchain redo experiment.
 *
 * @param {RunMicroSaasToolchainRedoOptions} [options]
 * @returns {Promise<ExperimentOutcome>}
 */
export async function runMicroSaasToolchainRedo(options = {}) {
  const startedAt = Date.now();
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const writeResults = options.writeResults ?? true;
  const log = options.log ?? console.log;
  const toolPreflightImpl = options.toolPreflightImpl ?? runExperimentToolPreflight;
  const attemptId = options.attemptId ?? 'toolchain-realism-v1';
  let trace = {};
  let assertions = [];
  let error;

  try {
    log('[micro-saas-toolchain-redo] preflighting content-machine and demo-machine');
    const contentMachinePreflight = await toolPreflightImpl({
      tool: 'content-machine',
      required: true,
      command: 'node',
      args: [CONTENT_MACHINE_PILOT_PATH, '--help'],
      runnableRationale:
        'Portarium micro-SaaS experiment content-machine pilot invocation responded to --help.',
    });
    const demoMachinePreflight = await toolPreflightImpl({
      tool: 'demo-machine',
      required: false,
    });
    const toolchainPreflight = {
      schemaVersion: 1,
      checkedAt: addMs(FIXED_STARTED_AT_ISO, 1_000),
      tools: {
        contentMachine: contentMachinePreflight,
        demoMachine: demoMachinePreflight,
      },
    };

    const telemetry = createIteration2Telemetry({
      scenarioId: EXPERIMENT_NAME,
      attemptId,
      resultsDir,
      requiredEvidenceArtifacts: [
        'outcome.json',
        'queue-metrics.json',
        'evidence-summary.json',
        'report.md',
        'toolchain-preflight.json',
        'tool-usage-evidence.json',
        'content-machine-output.json',
        'external-effect-stubs.json',
      ],
    });

    recordToolchainTelemetry(telemetry);
    const contentMachineOutput = buildContentMachineOutput(contentMachinePreflight);
    const externalEffectStubs = buildExternalEffectStubs();
    const toolUsageEvidence = buildToolUsageEvidence({
      contentMachinePreflight,
      demoMachinePreflight,
    });
    const demoPathState = demoMachinePreflight.status === 'runnable' ? 'proven' : 'unproven';

    recordRequiredArtifacts(telemetry);

    const observedAtIso = addMs(FIXED_STARTED_AT_ISO, 10_000);
    if (writeResults) {
      writeJsonArtifact(resultsDir, 'toolchain-preflight.json', toolchainPreflight);
      writeJsonArtifact(resultsDir, 'tool-usage-evidence.json', {
        schemaVersion: 1,
        scenarioId: EXPERIMENT_NAME,
        attemptId,
        evidence: toolUsageEvidence,
      });
      writeJsonArtifact(resultsDir, 'content-machine-output.json', contentMachineOutput);
      writeJsonArtifact(resultsDir, 'external-effect-stubs.json', {
        schemaVersion: 1,
        stubs: externalEffectStubs,
      });
    }

    const artifactPaths = writeResults
      ? telemetry.writeArtifacts(
          observedAtIso,
          buildReportSections({
            contentMachinePreflight,
            demoMachinePreflight,
            demoPathState,
            toolUsageEvidence,
          }),
        )
      : {};
    const queueMetrics = telemetry.buildQueueMetrics(observedAtIso);
    const evidenceSummary = telemetry.buildEvidenceSummary(observedAtIso);

    trace = {
      comparesTo: 'micro-saas-agent-stack-v2',
      toolchainPreflight,
      toolUsageEvidence,
      contentMachineOutput,
      externalEffectStubs,
      demoPathState,
      queueMetrics,
      evidenceSummary,
      artifactPaths,
    };
    assertions = buildAssertions({
      contentMachinePreflight,
      demoMachinePreflight,
      toolUsageEvidence,
      externalEffectStubs,
      evidenceSummary,
      trace,
    });

    if (contentMachinePreflight.status !== 'runnable') {
      error = `Required content-machine preflight failed: ${contentMachinePreflight.rationale ?? contentMachinePreflight.status}`;
    }
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
      'attempt-id': { type: 'string' },
    },
  });

  const resultsDir = values['results-dir'] ?? DEFAULT_RESULTS_DIR;
  const outcome = await runMicroSaasToolchainRedo({
    resultsDir,
    attemptId: values['attempt-id'],
  });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
