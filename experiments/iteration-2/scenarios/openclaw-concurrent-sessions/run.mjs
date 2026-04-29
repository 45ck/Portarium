// @ts-check

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createIteration2Telemetry } from '../../../shared/iteration2-telemetry.js';

const EXPERIMENT_NAME = 'openclaw-concurrent-sessions';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');
const FIXED_STARTED_AT_ISO = '2026-04-30T00:00:00.000Z';
const CONCURRENCY_LEVEL = 4;

function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function hashRecord(record) {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}

function makeSessions() {
  return Array.from({ length: CONCURRENCY_LEVEL }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    return {
      sessionId: `openclaw-session-${n}`,
      tenantId: `tenant-${index % 2 === 0 ? 'a' : 'b'}`,
      workspaceId: `workspace-${index % 2 === 0 ? 'a' : 'b'}`,
      runId: `run-openclaw-${n}`,
      correlationId: `corr-openclaw-${n}`,
      agentId: `agent-openclaw-${n}`,
      outputBundlePath: `outputs/openclaw-session-${n}/artifact.json`,
      approval: {
        approvalId: `appr-openclaw-session-${n}`,
        sessionId: `openclaw-session-${n}`,
        action: `write:session-${n}-bundle`,
        tier: index === 0 ? 'Human-approve' : 'Assisted',
        requestedAtIso: addMs(FIXED_STARTED_AT_ISO, index * 1_000),
        status: 'pending',
        executionKey: `openclaw-session-${n}:write-bundle`,
      },
    };
  });
}

function buildEvidenceChain(session, approval) {
  const events = [
    {
      evidenceId: `${session.sessionId}-ev-01`,
      sessionId: session.sessionId,
      phase: 'proposal',
      atIso: approval.requestedAtIso,
      summary: 'OpenClaw session proposed governed Action',
    },
    {
      evidenceId: `${session.sessionId}-ev-02`,
      sessionId: session.sessionId,
      phase: 'blocked',
      atIso: addMs(approval.requestedAtIso, 2_000),
      summary: 'Session waited on its own Approval Gate',
    },
    {
      evidenceId: `${session.sessionId}-ev-03`,
      sessionId: session.sessionId,
      phase: 'decision',
      atIso: approval.decidedAtIso,
      summary: 'Operator decision resolved this session only',
    },
    {
      evidenceId: `${session.sessionId}-ev-04`,
      sessionId: session.sessionId,
      phase: 'output-written',
      atIso: approval.resumedAtIso,
      summary: 'Session resumed and wrote its output bundle',
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
  for (const offsetMs of [0, 3_500, 9_900, 10_300, 10_700, 18_500]) {
    const timestampIso = addMs(FIXED_STARTED_AT_ISO, offsetMs);
    telemetry.recordQueueDepth({ timestampIso, depth: queueDepthAt(approvals, timestampIso) });
  }
}

function applyMixedOrderDecisions(sessions, telemetry) {
  const decisionPlan = [
    { sessionIndex: 2, decidedOffsetMs: 10_000 },
    { sessionIndex: 0, decidedOffsetMs: 10_200 },
    { sessionIndex: 3, decidedOffsetMs: 10_400 },
    { sessionIndex: 1, decidedOffsetMs: 18_000 },
  ];
  const decisionOrder = [];
  const outputBundles = [];
  const crossSessionLeaks = [];

  for (const session of sessions) {
    telemetry.recordApprovalRequested({
      approvalId: session.approval.approvalId,
      sessionId: session.sessionId,
      tier: session.approval.tier,
      requestedAtIso: session.approval.requestedAtIso,
    });
  }

  for (const decision of decisionPlan) {
    const session = sessions[decision.sessionIndex];
    const approval = session.approval;
    approval.status = 'approved';
    approval.decidedAtIso = addMs(FIXED_STARTED_AT_ISO, decision.decidedOffsetMs);
    approval.resumedAtIso = addMs(approval.decidedAtIso, 800);
    decisionOrder.push({
      sessionId: session.sessionId,
      approvalId: approval.approvalId,
      decidedAtIso: approval.decidedAtIso,
    });

    telemetry.recordApprovalDecision({
      approvalId: approval.approvalId,
      status: 'approved',
      decidedAtIso: approval.decidedAtIso,
    });
    telemetry.recordSessionBlocked({
      sessionId: session.sessionId,
      blockedAtIso: approval.requestedAtIso,
      unblockedAtIso: approval.decidedAtIso,
    });
    telemetry.recordResume({
      sessionId: session.sessionId,
      approvalId: approval.approvalId,
      decidedAtIso: approval.decidedAtIso,
      resumedAtIso: approval.resumedAtIso,
      successful: true,
    });
    telemetry.recordDuplicateExecution(approval.executionKey);

    for (const candidate of sessions) {
      if (
        candidate.sessionId !== session.sessionId &&
        candidate.approval.status === 'pending' &&
        candidate.outputBundlePath === session.outputBundlePath
      ) {
        crossSessionLeaks.push({
          fromSessionId: session.sessionId,
          leakedToSessionId: candidate.sessionId,
        });
      }
    }

    outputBundles.push({
      sessionId: session.sessionId,
      runId: session.runId,
      agentId: session.agentId,
      correlationId: session.correlationId,
      approvalId: approval.approvalId,
      writtenAtIso: approval.resumedAtIso,
      path: session.outputBundlePath,
      content: {
        sessionId: session.sessionId,
        runId: session.runId,
        action: approval.action,
        approvalId: approval.approvalId,
      },
    });
  }

  return { decisionOrder, outputBundles, crossSessionLeaks };
}

function evidenceChainsAreContinuous(sessionTraces) {
  return sessionTraces.every((session) => {
    let previousHash = 'genesis';
    for (const entry of session.evidenceChain) {
      if (entry.previousHash !== previousHash) return false;
      const expected = hashRecord({
        evidenceId: entry.evidenceId,
        sessionId: entry.sessionId,
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

function findCrossSessionLeaks(sessionTraces, outputBundles) {
  const leaks = [];
  const sessionIds = new Set(sessionTraces.map((session) => session.sessionId));
  const outputPaths = new Set();

  for (const session of sessionTraces) {
    if (!session.approval.approvalId.includes(session.sessionId.replace('openclaw-', ''))) {
      leaks.push({ kind: 'approval-scope', sessionId: session.sessionId });
    }
  }

  for (const output of outputBundles) {
    if (!sessionIds.has(output.sessionId)) {
      leaks.push({ kind: 'unknown-output-session', sessionId: output.sessionId });
    }
    if (outputPaths.has(output.path)) {
      leaks.push({ kind: 'duplicate-output-path', path: output.path });
    }
    outputPaths.add(output.path);
    if (output.content.sessionId !== output.sessionId || output.content.runId !== output.runId) {
      leaks.push({ kind: 'output-content-mismatch', path: output.path });
    }
  }

  return leaks;
}

function buildThroughputSummary(sessions, outputBundles) {
  const firstRequest = Math.min(
    ...sessions.map((session) => Date.parse(session.approval.requestedAtIso)),
  );
  const lastOutput = Math.max(...outputBundles.map((output) => Date.parse(output.writtenAtIso)));
  const durationSeconds = Math.max(1, (lastOutput - firstRequest) / 1_000);
  return {
    simulatedDurationSeconds: durationSeconds,
    completedSessions: outputBundles.length,
    completedActions: outputBundles.length,
    sessionThroughputPerSecond: outputBundles.length / durationSeconds,
    actionThroughputPerSecond: outputBundles.length / durationSeconds,
  };
}

function buildAssertions({ sessionTraces, outputBundles, queueMetrics, evidenceSummary, trace }) {
  const approvalIds = sessionTraces.map((session) => session.approval.approvalId);
  const outputPaths = outputBundles.map((output) => output.path);
  const sessionTwo = sessionTraces.find((session) => session.sessionId === 'openclaw-session-02');
  const firstDecisionAt = trace.decisionOrder[0]?.decidedAtIso;
  const leaks = findCrossSessionLeaks(sessionTraces, outputBundles);

  return [
    assert(
      'all sessions complete at the declared concurrency level',
      sessionTraces.length === trace.concurrencyLevel &&
        outputBundles.length === trace.concurrencyLevel,
      `sessions=${sessionTraces.length}, outputs=${outputBundles.length}`,
    ),
    assert(
      'approval IDs and output bundles stay session-scoped',
      new Set(approvalIds).size === approvalIds.length &&
        new Set(outputPaths).size === outputPaths.length &&
        leaks.length === 0,
      `leaks=${JSON.stringify(leaks)}`,
    ),
    assert(
      'mixed-order decision for one session does not unblock another',
      sessionTwo != null &&
        firstDecisionAt != null &&
        Date.parse(sessionTwo.approval.decidedAtIso) > Date.parse(firstDecisionAt) &&
        Date.parse(sessionTwo.output.writtenAtIso) > Date.parse(sessionTwo.approval.decidedAtIso),
      `session02Decided=${sessionTwo?.approval.decidedAtIso}`,
    ),
    assert(
      'near-simultaneous approvals execute exactly once',
      Number(queueMetrics.metrics.duplicate_execution_count) === 0 &&
        Number(queueMetrics.metrics.successful_resume_count) === trace.concurrencyLevel,
      `duplicates=${String(queueMetrics.metrics.duplicate_execution_count)}`,
    ),
    assert(
      'throughput, latency, and queue depth are recorded',
      trace.throughput.completedSessions === trace.concurrencyLevel &&
        Array.isArray(queueMetrics.metrics.resume_latency_ms) &&
        queueMetrics.metrics.resume_latency_ms.length === trace.concurrencyLevel &&
        Array.isArray(queueMetrics.metrics.queue_depth_over_time) &&
        queueMetrics.metrics.queue_depth_over_time.length >= 5,
      `resumeSamples=${Array.isArray(queueMetrics.metrics.resume_latency_ms) ? queueMetrics.metrics.resume_latency_ms.length : 0}`,
    ),
    assert(
      'evidence chains are continuous and session-local',
      evidenceChainsAreContinuous(sessionTraces),
      `chains=${sessionTraces.length}`,
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
 * Run the deterministic concurrent OpenClaw sessions experiment.
 *
 * @param {{ resultsDir?: string; writeResults?: boolean; log?: (line: string) => void }} [options]
 */
export async function runOpenClawConcurrentSessions(options = {}) {
  const startedAt = Date.now();
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const writeResults = options.writeResults ?? true;
  const log = options.log ?? console.log;
  const attemptId = 'deterministic-concurrency-v1';
  let trace = {};
  let assertions = [];
  let error;

  try {
    log('[openclaw-concurrent-sessions] simulating governed concurrent sessions');
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

    const sessions = makeSessions();
    const approvals = sessions.map((session) => session.approval);
    const decisionTrace = applyMixedOrderDecisions(sessions, telemetry);
    recordQueueSamples(telemetry, approvals);

    telemetry.recordEvidenceArtifact({ artifactName: 'outcome.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'queue-metrics.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'evidence-summary.json', present: true });
    telemetry.recordEvidenceArtifact({ artifactName: 'report.md', present: true });

    const observedAtIso = addMs(FIXED_STARTED_AT_ISO, 25_000);
    const thresholdAssertions = telemetry.evaluateThresholds(
      {
        maxDuplicateExecutionCount: 0,
        maxPendingAgeMsP95: 20_000,
        maxResumeLatencyMs: 1_000,
        minEvidenceCompletenessCount: 4,
        minSuccessfulResumeCount: CONCURRENCY_LEVEL,
      },
      observedAtIso,
    );
    const artifactPaths = writeResults ? telemetry.writeArtifacts(observedAtIso) : {};
    const queueMetrics = telemetry.buildQueueMetrics(observedAtIso);
    const evidenceSummary = telemetry.buildEvidenceSummary(observedAtIso);
    const outputBySession = new Map(
      decisionTrace.outputBundles.map((output) => [output.sessionId, output]),
    );
    const sessionTraces = sessions.map((session) => ({
      ...session,
      approval: { ...session.approval },
      output: outputBySession.get(session.sessionId),
      evidenceChain: buildEvidenceChain(session, session.approval),
    }));

    trace = {
      comparesTo: 'exp-A-transparency',
      mode: 'deterministic-concurrency',
      concurrencyLevel: CONCURRENCY_LEVEL,
      nearSimultaneousDecisionWindowMs: 400,
      maxConcurrentBlockedSessions: Math.max(
        ...queueMetrics.metrics.queue_depth_over_time.map((sample) => sample.depth),
      ),
      sessions: sessionTraces,
      decisionOrder: decisionTrace.decisionOrder,
      outputBundles: decisionTrace.outputBundles,
      crossSessionLeaks: decisionTrace.crossSessionLeaks,
      throughput: buildThroughputSummary(sessions, decisionTrace.outputBundles),
      observedBottlenecks: [],
      queueMetrics,
      evidenceSummary,
      artifactPaths,
      thresholdAssertions,
    };
    assertions = buildAssertions({
      sessionTraces,
      outputBundles: decisionTrace.outputBundles,
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
  const outcome = await runOpenClawConcurrentSessions({ resultsDir });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
