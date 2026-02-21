import { randomUUID } from 'node:crypto';

import {
  diffEffects,
  type EffectDiffResultV1,
  type VerifiedEffectV1,
} from '../../domain/services/diff.js';
import { buildPlanFromWorkflow, validatePlanEffectIds } from '../../domain/services/planning.js';
import type { RunStatus } from '../../domain/runs/run-v1.js';
import type { PlanV1, PlannedEffectV1 } from '../../domain/plan/plan-v1.js';
import type { WorkflowActionV1, WorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import {
  emitCounter,
  emitHistogram,
  type MetricAttributes,
} from '../observability/metrics-hooks.js';
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
import {
  appendEvidence,
  ensureRunState,
  runStateTestApi,
  setRunDiff,
  setRunPlan,
  transitionRun,
  verifyEvidenceChainOrThrow,
} from './activities-run-state.js';
import {
  buildActionMetricAttributes,
  buildRunMetricAttributes,
  observeTemporalSpan,
  resetTemporalTelemetryHooksForTest,
  resolvePackTelemetryContext,
  setTemporalTelemetryHooksForTest,
  type PackTelemetryContext,
} from './activities-telemetry.js';

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
    run: async () => completeRunExecution(input, packTelemetry, runMetrics, runStartedAtMs),
  });
}

function buildRunPlan(input: CompleteRunActivityInput, nowIso: string): PlanV1 {
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
    throw new Error(`Duplicate effect IDs in plan: ${validation.duplicateEffectIds.join(', ')}`);
  }
  return plan;
}

function appendPlanBuiltEvidence(input: CompleteRunActivityInput, nowIso: string, plan: PlanV1): void {
  appendEvidence(input.tenantId, {
    schemaVersion: 1,
    evidenceId: EvidenceId(randomUUID()),
    workspaceId: WorkspaceId(input.tenantId),
    correlationId: CorrelationId(input.correlationId),
    occurredAtIso: nowIso,
    category: 'Plan',
    summary: `Plan built with ${plan.plannedEffects.length} effects.`,
    actor: { kind: 'System' },
    links: { runId: RunId(input.runId), planId: plan.planId },
  });
}

function appendDiffComputedEvidence(
  input: CompleteRunActivityInput,
  nowIso: string,
  planId: PlanV1['planId'],
  diff: EffectDiffResultV1,
): void {
  appendEvidence(input.tenantId, {
    schemaVersion: 1,
    evidenceId: EvidenceId(randomUUID()),
    workspaceId: WorkspaceId(input.tenantId),
    correlationId: CorrelationId(input.correlationId),
    occurredAtIso: nowIso,
    category: 'System',
    summary: `Planned vs verified diff computed (clean=${diff.isClean}).`,
    actor: { kind: 'System' },
    links: { runId: RunId(input.runId), planId },
    payloadRefs: [
      {
        kind: 'Diff',
        uri: `memory://runs/${encodeURIComponent(input.runId)}/diff`,
        contentType: 'application/json',
      },
    ],
  });
}

async function completeRunExecution(
  input: CompleteRunActivityInput,
  packTelemetry: PackTelemetryContext,
  runMetrics: MetricAttributes,
  runStartedAtMs: number,
): Promise<void> {
  try {
    ensureRunState(input.tenantId, input.runId, 'Running');
    const nowIso = new Date().toISOString();
    const plan = buildRunPlan(input, nowIso);
    setRunPlan(input.tenantId, input.runId, plan);
    appendPlanBuiltEvidence(input, nowIso, plan);

    const verified = await buildVerifiedEffectsWithTelemetry({
      workflow: input.workflow,
      plannedEffects: plan.plannedEffects,
      workflowExecutionTier: input.workflow.executionTier,
      packTelemetry,
    });
    const diff = diffEffects({ planned: plan.plannedEffects, verified });
    setRunDiff(input.tenantId, input.runId, diff);
    appendDiffComputedEvidence(input, nowIso, plan.planId, diff);

    transitionRun(input.tenantId, input.runId, 'Succeeded');
    emitCounter('portarium.run.succeeded', runMetrics);
    emitHistogram('portarium.run.duration.ms', Date.now() - runStartedAtMs, {
      ...runMetrics,
      'run.outcome': 'succeeded',
    });
    verifyEvidenceChainOrThrow(input.tenantId, input.runId);
  } catch (error) {
    emitCounter('portarium.run.failed', { ...runMetrics, errorKind: 'UnhandledException' });
    emitHistogram('portarium.run.duration.ms', Date.now() - runStartedAtMs, {
      ...runMetrics,
      'run.outcome': 'exception',
    });
    throw error;
  }
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

export { setTemporalTelemetryHooksForTest, resetTemporalTelemetryHooksForTest };

export const __test = {
  reset(): void {
    runStateTestApi.reset();
    resetTemporalTelemetryHooksForTest();
  },
  getRunStatus(tenantId: string, runId: string): RunStatus | undefined {
    return runStateTestApi.getRunStatus(tenantId, runId);
  },
  getEvidence(tenantId: string, runId: string): readonly EvidenceEntryV1[] {
    return runStateTestApi.getEvidence(tenantId, runId);
  },
  getPlan(tenantId: string, runId: string): PlanV1 | undefined {
    return runStateTestApi.getPlan(tenantId, runId);
  },
  getDiff(tenantId: string, runId: string): EffectDiffResultV1 | undefined {
    return runStateTestApi.getDiff(tenantId, runId);
  },
};
