import { randomUUID } from 'node:crypto';

import { SpanStatusCode, trace } from '@opentelemetry/api';

import {
  diffEffects,
  type EffectDiffResultV1,
  type VerifiedEffectV1,
} from '../../domain/services/diff.js';
import { buildPlanFromWorkflow, validatePlanEffectIds } from '../../domain/services/planning.js';
import { assertValidRunStatusTransition } from '../../domain/services/run-status-transitions.js';
import type { RunStatus } from '../../domain/runs/run-v1.js';
import type { PlanV1, PlannedEffectV1 } from '../../domain/plan/plan-v1.js';
import type { WorkflowActionV1, WorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import {
  emitCounter,
  emitHistogram,
  type MetricAttributes,
} from '../observability/metrics-hooks.js';
import {
  appendEvidenceEntryV1,
  verifyEvidenceChainV1,
} from '../../domain/evidence/evidence-chain-v1.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import {
  CorrelationId,
  EffectId,
  EvidenceId,
  PlanId,
  RunId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';

export type StartRunActivityInput = Readonly<{
  runId: string;
  tenantId: string;
  workflowId: string;
  workflow: WorkflowV1;
  initiatedByUserId: string;
  correlationId: string;
  traceparent?: string;
  tracestate?: string;
  packId?: string;
  packVersion?: string;
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
}>;

export type CompleteRunActivityInput = Readonly<{
  runId: string;
  tenantId: string;
  workflowId: string;
  workflow: WorkflowV1;
  initiatedByUserId: string;
  correlationId: string;
  traceparent?: string;
  tracestate?: string;
  packId?: string;
  packVersion?: string;
}>;

type TemporalTelemetryAttributes = Readonly<Record<string, string | number | boolean>>;
type TemporalSpanOutcome = 'ok' | 'error';

interface TemporalTelemetryHooks {
  onSpanStart(spanName: string, attributes: TemporalTelemetryAttributes): void;
  onSpanEnd(
    spanName: string,
    outcome: TemporalSpanOutcome,
    durationMs: number,
    attributes: TemporalTelemetryAttributes,
  ): void;
}

type PackTelemetryContext = Readonly<{
  packId: string;
  packVersion: string;
}>;

interface RunExecutionState {
  status: RunStatus;
  evidence: EvidenceEntryV1[];
  plan?: PlanV1;
  diff?: EffectDiffResultV1;
}

const tracer = trace.getTracer('portarium.infrastructure.temporal.activities');
const hasher = new NodeCryptoEvidenceHasher();
const runs = new Map<string, RunExecutionState>();
const DEFAULT_PACK_TELEMETRY_CONTEXT: PackTelemetryContext = {
  packId: 'core.unscoped',
  packVersion: '0.0.0',
};

const NOOP_TEMPORAL_TELEMETRY_HOOKS: TemporalTelemetryHooks = {
  onSpanStart() {
    // no-op by default
  },
  onSpanEnd() {
    // no-op by default
  },
};

let activeTemporalTelemetryHooks: TemporalTelemetryHooks = NOOP_TEMPORAL_TELEMETRY_HOOKS;

export async function startRunActivity(input: StartRunActivityInput): Promise<void> {
  const packTelemetry = resolvePackTelemetryContext(
    input.workflow,
    input.packId,
    input.packVersion,
  );
  const runMetrics = buildRunMetricAttributes(packTelemetry, input.executionTier);

  await observeTemporalSpan({
    spanName: 'workflow.run.start',
    attributes: {
      ...runMetrics,
      'workflow.id': input.workflowId,
    },
    run: () => {
      emitCounter('portarium.run.started', runMetrics);

      ensureRunState(input.tenantId, input.runId, 'Pending');
      transitionRun(input.tenantId, input.runId, 'Running');

      appendEvidence(input.tenantId, {
        schemaVersion: 1,
        evidenceId: EvidenceId(randomUUID()),
        workspaceId: WorkspaceId(input.tenantId),
        correlationId: CorrelationId(input.correlationId),
        occurredAtIso: new Date().toISOString(),
        category: 'System',
        summary: `Run started for workflow ${input.workflowId}.`,
        actor: { kind: 'System' },
        links: {
          runId: RunId(input.runId),
        },
      });
      return Promise.resolve();
    },
  });
}

export async function completeRunActivity(input: CompleteRunActivityInput): Promise<void> {
  const packTelemetry = resolvePackTelemetryContext(
    input.workflow,
    input.packId,
    input.packVersion,
  );
  const runMetrics = buildRunMetricAttributes(packTelemetry, input.workflow.executionTier);
  const runStartedAtMs = Date.now();

  await observeTemporalSpan({
    spanName: 'workflow.run.complete',
    attributes: {
      ...runMetrics,
      'workflow.id': input.workflowId,
    },
    run: async () => {
      try {
        ensureRunState(input.tenantId, input.runId, 'Running');

        const nowIso = new Date().toISOString();

        const plan = buildPlanFromWorkflow({
          workflow: input.workflow,
          workspaceId: WorkspaceId(input.tenantId),
          createdByUserId: UserId(input.initiatedByUserId),
          planId: PlanId(randomUUID()),
          createdAtIso: nowIso,
          effectFactory: actionToPlannedEffect,
        });

        const validation = validatePlanEffectIds(plan);
        if (!validation.ok) {
          throw new Error(
            `Duplicate effect IDs in plan: ${validation.duplicateEffectIds.join(', ')}`,
          );
        }

        setRunPlan(input.tenantId, input.runId, plan);

        appendEvidence(input.tenantId, {
          schemaVersion: 1,
          evidenceId: EvidenceId(randomUUID()),
          workspaceId: WorkspaceId(input.tenantId),
          correlationId: CorrelationId(input.correlationId),
          occurredAtIso: nowIso,
          category: 'Plan',
          summary: `Plan built with ${plan.plannedEffects.length} effects.`,
          actor: { kind: 'System' },
          links: {
            runId: RunId(input.runId),
            planId: plan.planId,
          },
        });

        const verified = await buildVerifiedEffectsWithTelemetry({
          workflow: input.workflow,
          plannedEffects: plan.plannedEffects,
          workflowExecutionTier: input.workflow.executionTier,
          packTelemetry,
        });

        const diff = diffEffects({ planned: plan.plannedEffects, verified });
        setRunDiff(input.tenantId, input.runId, diff);

        appendEvidence(input.tenantId, {
          schemaVersion: 1,
          evidenceId: EvidenceId(randomUUID()),
          workspaceId: WorkspaceId(input.tenantId),
          correlationId: CorrelationId(input.correlationId),
          occurredAtIso: nowIso,
          category: 'System',
          summary: `Planned vs verified diff computed (clean=${diff.isClean}).`,
          actor: { kind: 'System' },
          links: {
            runId: RunId(input.runId),
            planId: plan.planId,
          },
          payloadRefs: [
            {
              kind: 'Diff',
              uri: `memory://runs/${encodeURIComponent(input.runId)}/diff`,
              contentType: 'application/json',
            },
          ],
        });

        transitionRun(input.tenantId, input.runId, 'Succeeded');
        emitCounter('portarium.run.succeeded', runMetrics);
        emitHistogram('portarium.run.duration.ms', Date.now() - runStartedAtMs, {
          ...runMetrics,
          'run.outcome': 'succeeded',
        });

        verifyEvidenceChainOrThrow(input.tenantId, input.runId);
      } catch (error) {
        emitCounter('portarium.run.failed', {
          ...runMetrics,
          errorKind: 'UnhandledException',
        });
        emitHistogram('portarium.run.duration.ms', Date.now() - runStartedAtMs, {
          ...runMetrics,
          'run.outcome': 'exception',
        });
        throw error;
      }
    },
  });
}

async function buildVerifiedEffectsWithTelemetry(params: {
  workflow: WorkflowV1;
  plannedEffects: readonly PlannedEffectV1[];
  workflowExecutionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
  packTelemetry: PackTelemetryContext;
}): Promise<readonly VerifiedEffectV1[]> {
  const plannedByActionId = new Map<string, PlannedEffectV1>(
    params.plannedEffects.map((effect) => [String(effect.effectId), effect]),
  );
  const verified: VerifiedEffectV1[] = [];

  for (const action of params.workflow.actions) {
    const plannedEffect = plannedByActionId.get(String(action.actionId));
    if (!plannedEffect) {
      continue;
    }

    const actionMetrics = buildActionMetricAttributes(
      params.packTelemetry,
      params.workflowExecutionTier,
      action,
    );
    const actionStartedAtMs = Date.now();

    try {
      const verifiedEffect = await observeTemporalSpan({
        spanName: 'workflow.action.execute',
        attributes: actionMetrics,
        run: () =>
          Promise.resolve({
            effectId: plannedEffect.effectId,
            operation: plannedEffect.operation,
            target: plannedEffect.target,
            summary: `Verified: ${plannedEffect.summary}`,
            verifiedAtIso: new Date().toISOString(),
          } satisfies VerifiedEffectV1),
      });

      emitCounter('portarium.action.succeeded', actionMetrics);
      emitHistogram('portarium.action.duration.ms', Date.now() - actionStartedAtMs, {
        ...actionMetrics,
        'action.outcome': 'succeeded',
      });
      verified.push(verifiedEffect);
    } catch (error) {
      emitCounter('portarium.action.failed', {
        ...actionMetrics,
        errorKind: 'UnhandledException',
      });
      emitHistogram('portarium.action.duration.ms', Date.now() - actionStartedAtMs, {
        ...actionMetrics,
        'action.outcome': 'exception',
      });
      throw error;
    }
  }

  return verified;
}

async function observeTemporalSpan<T>(params: {
  spanName: string;
  attributes: TemporalTelemetryAttributes;
  run: () => Promise<T>;
}): Promise<T> {
  return tracer.startActiveSpan(
    params.spanName,
    { attributes: params.attributes },
    async (span) => {
      activeTemporalTelemetryHooks.onSpanStart(params.spanName, params.attributes);
      const startedAtMs = Date.now();

      try {
        const value = await params.run();
        const durationMs = Date.now() - startedAtMs;
        span.setStatus({ code: SpanStatusCode.OK });
        activeTemporalTelemetryHooks.onSpanEnd(
          params.spanName,
          'ok',
          durationMs,
          params.attributes,
        );
        return value;
      } catch (error) {
        const durationMs = Date.now() - startedAtMs;
        const message =
          error instanceof Error ? error.message : 'Unhandled Temporal activity error.';
        span.recordException(error instanceof Error ? error : new Error(message));
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        activeTemporalTelemetryHooks.onSpanEnd(
          params.spanName,
          'error',
          durationMs,
          params.attributes,
        );
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

function resolvePackTelemetryContext(
  _workflow: WorkflowV1,
  packId: string | undefined,
  packVersion: string | undefined,
): PackTelemetryContext {
  if (packId && packVersion) {
    return { packId, packVersion };
  }

  return DEFAULT_PACK_TELEMETRY_CONTEXT;
}

function buildRunMetricAttributes(
  packTelemetry: PackTelemetryContext,
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly',
): MetricAttributes {
  return {
    'pack.id': packTelemetry.packId,
    'pack.version': packTelemetry.packVersion,
    'workflow.execution_tier': executionTier,
    'telemetry.pii_safe': true,
  };
}

function buildActionMetricAttributes(
  packTelemetry: PackTelemetryContext,
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly',
  action: WorkflowActionV1,
): MetricAttributes {
  return {
    ...buildRunMetricAttributes(packTelemetry, executionTier),
    'action.id': String(action.actionId),
    'action.operation': action.operation,
    'action.port_family': action.portFamily,
  };
}

function runKey(tenantId: string, runId: string): string {
  return `${tenantId}/${runId}`;
}

function ensureRunState(tenantId: string, runId: string, initial: RunStatus): RunExecutionState {
  const key = runKey(tenantId, runId);
  const existing = runs.get(key);
  if (existing) return existing;
  const created: RunExecutionState = { status: initial, evidence: [] };
  runs.set(key, created);
  return created;
}

function transitionRun(tenantId: string, runId: string, to: RunStatus): void {
  const state = ensureRunState(tenantId, runId, 'Pending');
  assertValidRunStatusTransition(state.status, to);
  state.status = to;
}

function setRunPlan(tenantId: string, runId: string, plan: PlanV1): void {
  const state = ensureRunState(tenantId, runId, 'Pending');
  state.plan = plan;
}

function setRunDiff(tenantId: string, runId: string, diff: EffectDiffResultV1): void {
  const state = ensureRunState(tenantId, runId, 'Pending');
  state.diff = diff;
}

function appendEvidence(
  tenantId: string,
  next: Omit<EvidenceEntryV1, 'previousHash' | 'hashSha256' | 'signatureBase64'>,
): EvidenceEntryV1 {
  const state = ensureRunState(tenantId, String(next.links?.runId ?? 'unknown'), 'Pending');
  const previous = state.evidence[state.evidence.length - 1];
  const entry = appendEvidenceEntryV1({ previous, next, hasher });
  state.evidence.push(entry);
  return entry;
}

function getEvidenceChain(tenantId: string, runId: string): readonly EvidenceEntryV1[] {
  const state = ensureRunState(tenantId, runId, 'Pending');
  return state.evidence;
}

function verifyEvidenceChainOrThrow(tenantId: string, runId: string): void {
  const verify = verifyEvidenceChainV1(getEvidenceChain(tenantId, runId), hasher);
  if (!verify.ok) {
    throw new Error(`Evidence chain invalid: ${verify.reason} (index=${verify.index})`);
  }
}

function actionToPlannedEffect(action: WorkflowActionV1): PlannedEffectV1 {
  // Current workflow schema does not yet encode a typed effect operation.
  // Treat every action as an Upsert into an external system reference.
  return {
    effectId: EffectId(String(action.actionId)),
    operation: 'Upsert',
    target: {
      sorName: 'execution-plane',
      portFamily: action.portFamily,
      externalId: String(action.actionId),
      externalType: action.operation,
      displayLabel: action.operation,
    },
    summary: `Action ${action.order}: ${action.operation}`,
    idempotencyKey: String(action.actionId),
  };
}

export function setTemporalTelemetryHooksForTest(hooks: TemporalTelemetryHooks): void {
  activeTemporalTelemetryHooks = hooks;
}

export function resetTemporalTelemetryHooksForTest(): void {
  activeTemporalTelemetryHooks = NOOP_TEMPORAL_TELEMETRY_HOOKS;
}

export const __test = {
  reset(): void {
    runs.clear();
    resetTemporalTelemetryHooksForTest();
  },
  getRunStatus(tenantId: string, runId: string): RunStatus | undefined {
    return runs.get(runKey(tenantId, runId))?.status;
  },
  getEvidence(tenantId: string, runId: string): readonly EvidenceEntryV1[] {
    return runs.get(runKey(tenantId, runId))?.evidence ?? [];
  },
  getPlan(tenantId: string, runId: string): PlanV1 | undefined {
    return runs.get(runKey(tenantId, runId))?.plan;
  },
  getDiff(tenantId: string, runId: string): EffectDiffResultV1 | undefined {
    return runs.get(runKey(tenantId, runId))?.diff;
  },
};
