import { PolicyChangeId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  buildPolicyShadowReplayReportV1,
  type PolicyChangeRequestV1,
  type PolicyShadowReplayReportV1,
  type PolicyShadowReplaySubjectV1,
  type PolicyV1,
} from '../../domain/policy/index.js';
import type { ApprovalV1 } from '../../domain/approvals/index.js';
import type { RunV1 } from '../../domain/runs/index.js';
import type { HumanTaskV1 } from '../../domain/workforce/index.js';
import {
  APP_ACTIONS,
  type AppContext,
  type Forbidden,
  type NotFound,
  type Result,
  type ValidationFailed,
  err,
  ok,
} from '../common/index.js';
import type {
  ApprovalQueryStore,
  AuthorizationPort,
  HumanTaskStore,
  PolicyStore,
  RunQueryStore,
} from '../ports/index.js';

type PolicyChangeReplayStore = PolicyStore &
  Required<Pick<PolicyStore, 'getPolicyChangeById' | 'getPolicyById'>>;

export type PreviewPolicyChangeReplayInput = Readonly<{
  workspaceId: string;
  policyChangeId: string;
  fromIso?: string;
  limit?: number;
}>;

export type PreviewPolicyChangeReplayOutput = Readonly<PolicyShadowReplayReportV1>;
export type PreviewPolicyChangeReplayError = Forbidden | ValidationFailed | NotFound;

export interface PreviewPolicyChangeReplayDeps {
  authorization: AuthorizationPort;
  clock: { nowIso(): string };
  policyStore: PolicyChangeReplayStore;
  runStore: RunQueryStore;
  approvalStore: ApprovalQueryStore;
  humanTaskStore?: Pick<HumanTaskStore, 'listHumanTasks'>;
}

export type BuiltPolicyChangeReplay = Readonly<{
  change: PolicyChangeRequestV1;
  report: PolicyShadowReplayReportV1;
}>;

export async function previewPolicyChangeReplay(
  deps: PreviewPolicyChangeReplayDeps,
  ctx: AppContext,
  input: PreviewPolicyChangeReplayInput,
): Promise<Result<PreviewPolicyChangeReplayOutput, PreviewPolicyChangeReplayError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.policyChangeReplay);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.policyChangeReplay,
      message: 'Caller is not permitted to replay policy changes.',
    });
  }

  const built = await buildPolicyChangeReplay(deps, ctx, input);
  if (!built.ok) return built;
  return ok(built.value.report);
}

export async function buildPolicyChangeReplay(
  deps: Omit<PreviewPolicyChangeReplayDeps, 'authorization'>,
  ctx: AppContext,
  input: PreviewPolicyChangeReplayInput,
): Promise<Result<BuiltPolicyChangeReplay, ValidationFailed | NotFound>> {
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;

  const change = await deps.policyStore.getPolicyChangeById(
    ctx.tenantId,
    parsed.value.workspaceId,
    parsed.value.policyChangeId,
  );
  if (change === null) {
    return err({
      kind: 'NotFound',
      resource: 'PolicyChange',
      message: `Policy change ${input.policyChangeId} not found.`,
    });
  }

  const currentPolicy = await resolveCurrentPolicy(deps.policyStore, ctx, change);
  if (!currentPolicy.ok) return currentPolicy;

  const generatedAtIso = deps.clock.nowIso();
  const subjects = await loadReplaySubjects(deps, ctx, {
    workspaceId: parsed.value.workspaceId,
    limit: parsed.value.limit,
    generatedAtIso,
    ...(parsed.value.fromIso !== undefined ? { fromIso: parsed.value.fromIso } : {}),
  });

  return ok({
    change,
    report: buildPolicyShadowReplayReportV1({
      policyChangeId: change.policyChangeId,
      workspaceId: change.workspaceId,
      currentPolicy: currentPolicy.value,
      proposedPolicy: change.proposedPolicy,
      subjects,
      generatedAtIso,
      ...(parsed.value.fromIso !== undefined ? { fromIso: parsed.value.fromIso } : {}),
    }),
  });
}

function parseInput(input: PreviewPolicyChangeReplayInput): Result<
  Readonly<{
    workspaceId: ReturnType<typeof WorkspaceId>;
    policyChangeId: ReturnType<typeof PolicyChangeId>;
    fromIso?: string;
    limit: number;
  }>,
  ValidationFailed
> {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.policyChangeId !== 'string' || input.policyChangeId.trim() === '') {
    return err({
      kind: 'ValidationFailed',
      message: 'policyChangeId must be a non-empty string.',
    });
  }
  if (input.fromIso !== undefined && Number.isNaN(Date.parse(input.fromIso))) {
    return err({ kind: 'ValidationFailed', message: 'fromIso must be a valid ISO timestamp.' });
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
    return err({ kind: 'ValidationFailed', message: 'limit must be a positive integer.' });
  }

  try {
    return ok({
      workspaceId: WorkspaceId(input.workspaceId),
      policyChangeId: PolicyChangeId(input.policyChangeId),
      ...(input.fromIso !== undefined ? { fromIso: input.fromIso } : {}),
      limit: Math.min(input.limit ?? 50, 200),
    });
  } catch {
    return err({
      kind: 'ValidationFailed',
      message: 'Invalid workspaceId or policyChangeId.',
    });
  }
}

async function resolveCurrentPolicy(
  policyStore: PolicyChangeReplayStore,
  ctx: AppContext,
  change: PolicyChangeRequestV1,
): Promise<Result<PolicyV1, NotFound>> {
  if (change.basePolicy !== undefined) return ok(change.basePolicy);
  const policy = await policyStore.getPolicyById(ctx.tenantId, change.workspaceId, change.policyId);
  if (policy === null) {
    return err({
      kind: 'NotFound',
      resource: 'Policy',
      message: `Policy ${String(change.policyId)} not found.`,
    });
  }
  return ok(policy);
}

async function loadReplaySubjects(
  deps: Pick<PreviewPolicyChangeReplayDeps, 'runStore' | 'approvalStore' | 'humanTaskStore'>,
  ctx: AppContext,
  params: Readonly<{
    workspaceId: ReturnType<typeof WorkspaceId>;
    limit: number;
    generatedAtIso: string;
    fromIso?: string;
  }>,
): Promise<readonly PolicyShadowReplaySubjectV1[]> {
  const runs = await deps.runStore.listRuns(ctx.tenantId, params.workspaceId, {
    filter: {},
    pagination: { limit: params.limit },
    sort: { field: 'createdAtIso', direction: 'desc' },
  });
  const approvals = await deps.approvalStore.listApprovals(ctx.tenantId, params.workspaceId, {
    limit: params.limit,
  });
  const humanTasks =
    deps.humanTaskStore?.listHumanTasks !== undefined
      ? await deps.humanTaskStore.listHumanTasks(ctx.tenantId, {
          workspaceId: params.workspaceId,
          limit: params.limit,
        })
      : { items: [] };

  return [
    ...runs.items.map(runToSubject),
    ...approvals.items.map(approvalToSubject),
    ...humanTasks.items.map((task) => humanTaskToSubject(task, params.generatedAtIso)),
  ].filter((subject) => {
    return params.fromIso === undefined
      ? true
      : Date.parse(subject.observedAtIso) >= Date.parse(params.fromIso);
  });
}

function runToSubject(run: RunV1): PolicyShadowReplaySubjectV1 {
  const estimatedCostCents = readOptionalNumber(run, 'estimatedCostCents');
  return {
    subjectKind: 'Run',
    subjectId: String(run.runId),
    runId: String(run.runId),
    observedAtIso: run.startedAtIso ?? run.createdAtIso,
    status: run.status,
    currentExecutionTier: run.executionTier,
    ...(estimatedCostCents !== undefined ? { estimatedCostCents } : {}),
    policyInput: {
      payloadKind: 'Run',
      runStatus: run.status,
      workflowId: String(run.workflowId),
      executionTier: run.executionTier,
      initiatedByUserId: String(run.initiatedByUserId),
      estimatedCostCents: estimatedCostCents ?? 0,
    },
  };
}

function approvalToSubject(approval: ApprovalV1): PolicyShadowReplaySubjectV1 {
  const estimatedCostCents = readOptionalNumber(approval, 'estimatedCostCents');
  return {
    subjectKind: 'Approval',
    subjectId: String(approval.approvalId),
    runId: String(approval.runId),
    observedAtIso: approval.requestedAtIso,
    status: approval.status,
    ...(approval.dueAtIso !== undefined ? { dueAtIso: approval.dueAtIso } : {}),
    currentExecutionTier: 'HumanApprove',
    ...(estimatedCostCents !== undefined ? { estimatedCostCents } : {}),
    policyInput: {
      payloadKind: 'Approval',
      approvalStatus: approval.status,
      runId: String(approval.runId),
      planId: String(approval.planId),
      requestedByUserId: String(approval.requestedByUserId),
      ...(approval.assigneeUserId !== undefined
        ? { assigneeUserId: String(approval.assigneeUserId) }
        : {}),
      escalationChain: approval.escalationChain ?? [],
      estimatedCostCents: estimatedCostCents ?? 0,
    },
  };
}

function humanTaskToSubject(
  task: HumanTaskV1,
  generatedAtIso: string,
): PolicyShadowReplaySubjectV1 {
  const estimatedCostCents = readOptionalNumber(task, 'estimatedCostCents');
  return {
    subjectKind: 'HumanTask',
    subjectId: String(task.humanTaskId),
    runId: String(task.runId),
    observedAtIso: task.dueAt ?? generatedAtIso,
    status: task.status,
    ...(task.dueAt !== undefined ? { dueAtIso: task.dueAt } : {}),
    currentExecutionTier: 'ManualOnly',
    ...(estimatedCostCents !== undefined ? { estimatedCostCents } : {}),
    policyInput: {
      payloadKind: 'HumanTask',
      humanTaskStatus: task.status,
      runId: String(task.runId),
      stepId: String(task.stepId),
      requiredCapabilities: task.requiredCapabilities,
      estimatedCostCents: estimatedCostCents ?? 0,
    },
  };
}

function readOptionalNumber(value: unknown, key: string): number | undefined {
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}
