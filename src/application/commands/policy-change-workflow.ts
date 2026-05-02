import {
  ApprovalId,
  EventId,
  EvidenceId,
  PolicyChangeId,
  PolicyId,
  WorkspaceId,
  type PolicyChangeId as PolicyChangeIdType,
  type PolicyId as PolicyIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import {
  applyStandardPolicyChangeV1,
  approvePolicyChangeV1,
  markPolicyChangeRolledBackV1,
  parsePolicyChangeRequestV1,
  parsePolicyV1,
  requiresPolicyChangeApproval,
  toPolicyChangeAuditEntryV1,
  type PolicyChangeAuditEntryV1,
  type PolicyChangeDiffEntryV1,
  type PolicyChangeOperationV1,
  type PolicyChangeRequestV1,
  type PolicyChangeRiskV1,
  type PolicyChangeRunEffectV1,
  type PolicyV1,
} from '../../domain/policy/index.js';
import {
  type AppContext,
  APP_ACTIONS,
  type Conflict,
  type DependencyFailure,
  err,
  type Forbidden,
  type NotFound,
  ok,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import type { DomainEventType, DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdGenerator,
  PolicyStore,
  UnitOfWork,
} from '../ports/index.js';

const POLICY_CHANGE_SOURCE = 'portarium.control-plane.policy-changes';

type PolicyChangeStore = PolicyStore &
  Required<
    Pick<
      PolicyStore,
      | 'getPolicyChangeById'
      | 'savePolicyChange'
      | 'appendPolicyChangeAuditEntry'
      | 'listPolicyChangeAuditEntries'
    >
  >;

export type PolicyChangeScopeInput =
  | Readonly<{ targetKind: 'Workspace'; workspaceId: string }>
  | Readonly<{ targetKind: 'ActionClass'; workspaceId: string; actionClass: string }>
  | Readonly<{ targetKind: 'Tenant'; tenantId: string }>;

export type ProposePolicyChangeInput = Readonly<{
  workspaceId: string;
  policyId: string;
  operation: PolicyChangeOperationV1;
  risk: PolicyChangeRiskV1;
  scope: PolicyChangeScopeInput;
  proposedPolicy: unknown;
  rationale: string;
  diff: readonly PolicyChangeDiffEntryV1[];
  runEffect: PolicyChangeRunEffectV1;
  effectiveFromIso: string;
  expiresAtIso?: string;
  approvalId?: string;
  approvalRequired?: boolean;
  replayReportRequired?: boolean;
  supersedesPolicyChangeId?: string;
}>;

export type ApprovePolicyChangeInput = Readonly<{
  workspaceId: string;
  policyChangeId: string;
  approvalId: string;
  rationale: string;
}>;

export type RollbackPolicyChangeInput = Readonly<{
  workspaceId: string;
  targetPolicyChangeId: string;
  rationale: string;
  effectiveFromIso: string;
  runEffect?: PolicyChangeRunEffectV1;
  approvalId?: string;
}>;

export type PolicyChangeOutput = Readonly<{
  policyChangeId: PolicyChangeIdType;
  status: PolicyChangeRequestV1['status'];
  approvalRequired: boolean;
}>;

export type PolicyChangeCommandError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | Conflict
  | DependencyFailure;

export interface PolicyChangeWorkflowDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  policyStore: PolicyChangeStore;
  unitOfWork: UnitOfWork;
  eventPublisher: EventPublisher;
  evidenceLog?: EvidenceLogPort;
}

export async function proposePolicyChange(
  deps: PolicyChangeWorkflowDeps,
  ctx: AppContext,
  input: ProposePolicyChangeInput,
): Promise<Result<PolicyChangeOutput, PolicyChangeCommandError>> {
  const validation = validateProposal(input);
  if (validation) return validation;
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.policyChangePropose);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.policyChangePropose,
      message: 'Caller is not permitted to propose policy changes.',
    });
  }

  const ids = parseWorkspacePolicyIds(input.workspaceId, input.policyId);
  if (!ids.ok) return ids;
  const proposedPolicy = parsePolicyInput(input.proposedPolicy);
  if (!proposedPolicy.ok) return proposedPolicy;

  const existing = await deps.policyStore.getPolicyById(
    ctx.tenantId,
    ids.value.workspaceId,
    ids.value.policyId,
  );
  if (input.operation !== 'Create' && existing === null) {
    return err({
      kind: 'NotFound',
      resource: 'Policy',
      message: `Policy ${input.policyId} not found.`,
    });
  }

  const nowIso = deps.clock.nowIso();
  const rawChange = {
    schemaVersion: 1,
    policyChangeId: deps.idGenerator.generateId(),
    policyId: input.policyId,
    workspaceId: input.workspaceId,
    operation: input.operation,
    risk: input.risk,
    status: 'PendingApproval',
    scope: input.scope,
    ...(existing !== null ? { basePolicy: existing } : {}),
    proposedPolicy: proposedPolicy.value,
    proposedAtIso: nowIso,
    proposedByUserId: String(ctx.principalId),
    rationale: input.rationale,
    diff: input.diff,
    runEffect: input.runEffect,
    effectiveFromIso: input.effectiveFromIso,
    ...(input.expiresAtIso !== undefined ? { expiresAtIso: input.expiresAtIso } : {}),
    approval: {
      approvalRequired: input.approvalRequired ?? input.risk === 'High',
      ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
    },
    ...(input.replayReportRequired === true
      ? { activationRequirements: { replayReportRequired: true } }
      : {}),
    ...(input.supersedesPolicyChangeId !== undefined
      ? { supersedesPolicyChangeId: input.supersedesPolicyChangeId }
      : {}),
  };

  const parsed = parsePolicyChange(rawChange);
  if (!parsed.ok) return parsed;
  const applied =
    requiresPolicyChangeApproval(parsed.value) ||
    parsed.value.activationRequirements?.replayReportRequired === true
      ? parsed.value
      : applyStandardPolicyChangeV1(parsed.value);

  return persistPolicyChange({
    deps,
    ctx,
    change: applied,
    eventType: applied.status === 'Applied' ? 'PolicyChangeApplied' : 'PolicyChangeProposed',
    auditEventType: applied.status === 'Applied' ? 'PolicyChangeApplied' : 'PolicyChangeProposed',
    actorUserId: ctx.principalId,
    rationale: input.rationale,
    saveProposedPolicy: applied.status === 'Applied',
  });
}

export async function approvePolicyChange(
  deps: PolicyChangeWorkflowDeps,
  ctx: AppContext,
  input: ApprovePolicyChangeInput,
): Promise<Result<PolicyChangeOutput, PolicyChangeCommandError>> {
  const validation = validateApproval(input);
  if (validation) return validation;
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.policyChangeApprove);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.policyChangeApprove,
      message: 'Caller is not permitted to approve policy changes.',
    });
  }

  const workspaceId = WorkspaceId(input.workspaceId);
  const policyChangeId = PolicyChangeId(input.policyChangeId);
  const existing = await deps.policyStore.getPolicyChangeById(
    ctx.tenantId,
    workspaceId,
    policyChangeId,
  );
  if (existing === null) {
    return err({
      kind: 'NotFound',
      resource: 'PolicyChange',
      message: `Policy change ${input.policyChangeId} not found.`,
    });
  }

  let approved: PolicyChangeRequestV1;
  try {
    approved = approvePolicyChangeV1({
      change: existing,
      approvalId: ApprovalId(input.approvalId),
      approvedByUserId: ctx.principalId,
      approvedAtIso: deps.clock.nowIso(),
    });
  } catch (error) {
    return err({
      kind: 'Conflict',
      message: error instanceof Error ? error.message : 'Policy change cannot be approved.',
    });
  }

  return persistPolicyChange({
    deps,
    ctx,
    change: approved,
    eventType: 'PolicyChangeApproved',
    auditEventType: 'PolicyChangeApproved',
    actorUserId: ctx.principalId,
    rationale: input.rationale,
    saveProposedPolicy: true,
    ...(approved.rollbackOfPolicyChangeId !== undefined
      ? { rollbackTargetPolicyChangeId: approved.rollbackOfPolicyChangeId }
      : {}),
  });
}

export async function rollbackPolicyChange(
  deps: PolicyChangeWorkflowDeps,
  ctx: AppContext,
  input: RollbackPolicyChangeInput,
): Promise<Result<PolicyChangeOutput, PolicyChangeCommandError>> {
  const validation = validateRollback(input);
  if (validation) return validation;
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.policyChangeRollback);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.policyChangeRollback,
      message: 'Caller is not permitted to roll back policy changes.',
    });
  }

  const workspaceId = WorkspaceId(input.workspaceId);
  const targetId = PolicyChangeId(input.targetPolicyChangeId);
  const target = await deps.policyStore.getPolicyChangeById(ctx.tenantId, workspaceId, targetId);
  if (target === null) {
    return err({
      kind: 'NotFound',
      resource: 'PolicyChange',
      message: `Policy change ${input.targetPolicyChangeId} not found.`,
    });
  }
  if (target.status !== 'Applied' && target.status !== 'Superseded') {
    return err({
      kind: 'Conflict',
      message: 'Only applied or superseded policy changes can be rolled back.',
    });
  }
  if (target.basePolicy === undefined) {
    return err({
      kind: 'Conflict',
      message: 'Policy change has no base policy to roll back to.',
    });
  }

  const rawRollback = {
    schemaVersion: 1,
    policyChangeId: deps.idGenerator.generateId(),
    policyId: String(target.policyId),
    workspaceId: input.workspaceId,
    operation: 'Rollback',
    risk: target.risk,
    status: 'PendingApproval',
    scope: target.scope,
    basePolicy: target.proposedPolicy,
    proposedPolicy: target.basePolicy,
    proposedAtIso: deps.clock.nowIso(),
    proposedByUserId: String(ctx.principalId),
    rationale: input.rationale,
    diff: target.diff.map((entry) => ({
      path: entry.path,
      ...(entry.after !== undefined ? { before: entry.after } : {}),
      ...(entry.before !== undefined ? { after: entry.before } : {}),
    })),
    runEffect: input.runEffect ?? 'FutureRunsOnly',
    effectiveFromIso: input.effectiveFromIso,
    approval: {
      approvalRequired: target.risk === 'High',
      ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
    },
    ...(target.activationRequirements?.replayReportRequired === true
      ? { activationRequirements: { replayReportRequired: true } }
      : {}),
    rollbackOfPolicyChangeId: String(target.policyChangeId),
  };

  const parsed = parsePolicyChange(rawRollback);
  if (!parsed.ok) return parsed;
  const applied = requiresPolicyChangeApproval(parsed.value)
    ? parsed.value
    : applyStandardPolicyChangeV1(parsed.value);

  return persistPolicyChange({
    deps,
    ctx,
    change: applied,
    eventType: applied.status === 'Applied' ? 'PolicyChangeRolledBack' : 'PolicyChangeProposed',
    auditEventType:
      applied.status === 'Applied' ? 'PolicyChangeRolledBack' : 'PolicyChangeProposed',
    actorUserId: ctx.principalId,
    rationale: input.rationale,
    saveProposedPolicy: applied.status === 'Applied',
    ...(applied.status === 'Applied'
      ? { rollbackTargetPolicyChangeId: target.policyChangeId }
      : {}),
  });
}

function validateProposal(input: ProposePolicyChangeInput): Result<never, ValidationFailed> | null {
  if (!isNonEmpty(input.workspaceId)) return validation('workspaceId must be a non-empty string.');
  if (!isNonEmpty(input.policyId)) return validation('policyId must be a non-empty string.');
  if (!isNonEmpty(input.rationale)) return validation('rationale must be a non-empty string.');
  if (!Array.isArray(input.diff) || input.diff.length === 0) {
    return validation('diff must be a non-empty array.');
  }
  if (!isNonEmpty(input.effectiveFromIso) || Number.isNaN(Date.parse(input.effectiveFromIso))) {
    return validation('effectiveFromIso must be a valid ISO timestamp.');
  }
  return null;
}

function validateApproval(input: ApprovePolicyChangeInput): Result<never, ValidationFailed> | null {
  if (!isNonEmpty(input.workspaceId)) return validation('workspaceId must be a non-empty string.');
  if (!isNonEmpty(input.policyChangeId)) {
    return validation('policyChangeId must be a non-empty string.');
  }
  if (!isNonEmpty(input.approvalId)) return validation('approvalId must be a non-empty string.');
  if (!isNonEmpty(input.rationale)) return validation('rationale must be a non-empty string.');
  return null;
}

function validateRollback(
  input: RollbackPolicyChangeInput,
): Result<never, ValidationFailed> | null {
  if (!isNonEmpty(input.workspaceId)) return validation('workspaceId must be a non-empty string.');
  if (!isNonEmpty(input.targetPolicyChangeId)) {
    return validation('targetPolicyChangeId must be a non-empty string.');
  }
  if (!isNonEmpty(input.rationale)) return validation('rationale must be a non-empty string.');
  if (!isNonEmpty(input.effectiveFromIso) || Number.isNaN(Date.parse(input.effectiveFromIso))) {
    return validation('effectiveFromIso must be a valid ISO timestamp.');
  }
  return null;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function validation(message: string): Result<never, ValidationFailed> {
  return err({ kind: 'ValidationFailed', message });
}

function parseWorkspacePolicyIds(
  workspaceId: string,
  policyId: string,
): Result<Readonly<{ workspaceId: WorkspaceIdType; policyId: PolicyIdType }>, ValidationFailed> {
  try {
    return ok({ workspaceId: WorkspaceId(workspaceId), policyId: PolicyId(policyId) });
  } catch {
    return validation('Invalid workspaceId or policyId.');
  }
}

function parsePolicyInput(value: unknown): Result<PolicyV1, ValidationFailed> {
  try {
    return ok(parsePolicyV1(value));
  } catch (error) {
    return validation(error instanceof Error ? error.message : 'proposedPolicy is invalid.');
  }
}

function parsePolicyChange(value: unknown): Result<PolicyChangeRequestV1, ValidationFailed> {
  try {
    return ok(parsePolicyChangeRequestV1(value));
  } catch (error) {
    return validation(error instanceof Error ? error.message : 'policy change is invalid.');
  }
}

async function persistPolicyChange(params: {
  deps: PolicyChangeWorkflowDeps;
  ctx: AppContext;
  change: PolicyChangeRequestV1;
  eventType: DomainEventType;
  auditEventType: PolicyChangeAuditEntryV1['eventType'];
  actorUserId: UserIdType;
  rationale: string;
  saveProposedPolicy: boolean;
  rollbackTargetPolicyChangeId?: PolicyChangeIdType;
}): Promise<Result<PolicyChangeOutput, PolicyChangeCommandError>> {
  const {
    deps,
    ctx,
    change,
    eventType,
    auditEventType,
    actorUserId,
    rationale,
    saveProposedPolicy,
    rollbackTargetPolicyChangeId,
  } = params;
  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.policyStore.savePolicyChange(ctx.tenantId, change.workspaceId, change);
      if (saveProposedPolicy) {
        await deps.policyStore.savePolicy(ctx.tenantId, change.workspaceId, change.proposedPolicy);
      }
      if (rollbackTargetPolicyChangeId !== undefined) {
        const target = await deps.policyStore.getPolicyChangeById(
          ctx.tenantId,
          change.workspaceId,
          rollbackTargetPolicyChangeId,
        );
        if (target !== null) {
          await deps.policyStore.savePolicyChange(
            ctx.tenantId,
            change.workspaceId,
            markPolicyChangeRolledBackV1({
              change: target,
              rolledBackByPolicyChangeId: change.policyChangeId,
            }),
          );
        }
      }

      const audit = toPolicyChangeAuditEntryV1({
        change,
        eventType: auditEventType,
        occurredAtIso: deps.clock.nowIso(),
        actorUserId,
        rationale,
      });
      await deps.policyStore.appendPolicyChangeAuditEntry(ctx.tenantId, change.workspaceId, audit);

      if (deps.evidenceLog) {
        await deps.evidenceLog.appendEntry(ctx.tenantId, {
          schemaVersion: 1,
          evidenceId: EvidenceId(deps.idGenerator.generateId()),
          workspaceId: change.workspaceId,
          correlationId: ctx.correlationId,
          occurredAtIso: audit.occurredAtIso,
          category: 'Policy',
          summary: `${audit.eventType}: ${String(change.policyId)} v${change.proposedPolicy.version}`,
          actor: { kind: 'User', userId: actorUserId },
          links: {},
        });
      }

      const event: DomainEventV1 = {
        schemaVersion: 1,
        eventId: EventId(deps.idGenerator.generateId()),
        eventType,
        aggregateKind: 'PolicyChange',
        aggregateId: change.policyChangeId,
        occurredAtIso: audit.occurredAtIso,
        workspaceId: change.workspaceId,
        correlationId: ctx.correlationId,
        actorUserId,
        payload: { change, audit },
      };
      await deps.eventPublisher.publish(
        domainEventToPortariumCloudEvent(event, POLICY_CHANGE_SOURCE, ctx.traceparent),
      );

      return ok({
        policyChangeId: change.policyChangeId,
        status: change.status,
        approvalRequired: requiresPolicyChangeApproval(change),
      });
    });
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Failed to persist policy change.',
    });
  }
}
