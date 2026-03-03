import type { ApprovalPendingV1 } from '../../domain/approvals/index.js';
import type { AgentActionProposalV1 } from '../../domain/machines/index.js';
import type { PolicyV1 } from '../../domain/policy/index.js';
import {
  AgentId,
  ApprovalId,
  CorrelationId,
  EvidenceId,
  MachineId,
  PlanId,
  ProposalId as ProposalIdCtor,
  RunId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type {
  AppContext,
  DependencyFailure,
  NotFound,
  Result,
  ValidationFailed,
} from '../common/index.js';
import { APP_ACTIONS, err, ok } from '../common/index.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import type {
  AgentActionProposalStore,
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdGenerator,
  PolicyStore,
  UnitOfWork,
} from '../ports/index.js';
import {
  type AgentActionGovernanceEvaluation,
  type ParsedProposeAgentActionInput,
  type ProposeAgentActionInput as ProposeAgentActionInputFromHelpers,
  type ProposeAgentActionOutput as ProposeAgentActionOutputFromHelpers,
  type ProposeAgentActionPolicyError,
  evaluateAgentActionGovernance,
  parseProposeAgentActionInput,
  toProposeAgentActionPolicyGateError,
} from './propose-agent-action.helpers.js';
import {
  buildAgentActionAuditArtifacts,
  type AgentActionAuditArtifacts,
} from './propose-agent-action.audit.js';

const PROPOSE_AGENT_ACTION_SOURCE = 'portarium.control-plane.agent-governance';

export type ProposeAgentActionError =
  | ProposeAgentActionPolicyError
  | ValidationFailed
  | NotFound
  | DependencyFailure;

export interface ProposeAgentActionDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  unitOfWork: UnitOfWork;
  policyStore: PolicyStore;
  approvalStore: ApprovalStore;
  proposalStore?: AgentActionProposalStore;
  eventPublisher: EventPublisher;
  evidenceLog: EvidenceLogPort;
}

async function loadPolicies(
  deps: ProposeAgentActionDeps,
  ctx: AppContext,
  parsedInput: ParsedProposeAgentActionInput,
): Promise<Result<readonly PolicyV1[], NotFound>> {
  const policies: PolicyV1[] = [];
  for (const policyId of parsedInput.policyIds) {
    const policy = await deps.policyStore.getPolicyById(
      ctx.tenantId,
      parsedInput.workspaceId,
      policyId,
    );
    if (policy === null) {
      return err({
        kind: 'NotFound',
        resource: 'Policy',
        message: `Policy ${policyId} not found for workspace ${parsedInput.workspaceId}.`,
      });
    }
    policies.push(policy);
  }
  return ok(policies);
}

function nextId(idGenerator: IdGenerator, idLabel: string): Result<string, DependencyFailure> {
  const id = idGenerator.generateId();
  if (id.trim() !== '') return ok(id);
  return err({
    kind: 'DependencyFailure',
    message: `Unable to generate ${idLabel} identifier.`,
  });
}

function nowIso(clock: Clock): Result<string, DependencyFailure> {
  const now = clock.nowIso();
  if (now.trim() !== '') return ok(now);
  return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
}

function buildAuditArtifacts(
  deps: ProposeAgentActionDeps,
  ctx: AppContext,
  parsedInput: ParsedProposeAgentActionInput,
  evaluation: AgentActionGovernanceEvaluation,
): Result<AgentActionAuditArtifacts, DependencyFailure> {
  const proposalId = nextId(deps.idGenerator, 'agent-action-proposal');
  if (!proposalId.ok) return proposalId;
  const evidenceId = nextId(deps.idGenerator, 'evidence');
  if (!evidenceId.ok) return evidenceId;
  const eventId = nextId(deps.idGenerator, 'event');
  if (!eventId.ok) return eventId;
  const occurredAtIso = nowIso(deps.clock);
  if (!occurredAtIso.ok) return occurredAtIso;

  return ok(
    buildAgentActionAuditArtifacts({
      proposalId: proposalId.value,
      evidenceId: evidenceId.value,
      eventId: eventId.value,
      occurredAtIso: occurredAtIso.value,
      input: parsedInput,
      evaluation,
      workspaceId: ctx.tenantId,
      correlationId: ctx.correlationId,
      actorUserId: ctx.principalId,
    }),
  );
}

async function persistAuditArtifacts(
  deps: ProposeAgentActionDeps,
  ctx: AppContext,
  audit: AgentActionAuditArtifacts,
): Promise<Result<true, DependencyFailure>> {
  try {
    await deps.unitOfWork.execute(async () => {
      await deps.evidenceLog.appendEntry(ctx.tenantId, audit.evidence);
      await deps.eventPublisher.publish(
        domainEventToPortariumCloudEvent(
          audit.event,
          PROPOSE_AGENT_ACTION_SOURCE,
          ctx.traceparent,
        ),
      );
    });
    return ok(true);
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to persist agent action proposal audit trail.',
    });
  }
}

async function saveProposalRecord(
  deps: ProposeAgentActionDeps,
  ctx: AppContext,
  parsedInput: ParsedProposeAgentActionInput,
  evaluation: AgentActionGovernanceEvaluation,
  audit: AgentActionAuditArtifacts,
  approvalId?: string,
): Promise<void> {
  if (!deps.proposalStore) return;
  const proposal: AgentActionProposalV1 = {
    schemaVersion: 1,
    proposalId: ProposalIdCtor(audit.proposalId),
    workspaceId: parsedInput.workspaceId,
    agentId: AgentId(parsedInput.agentId),
    actionKind: parsedInput.actionKind,
    toolName: parsedInput.toolName,
    ...(parsedInput.parameters ? { parameters: parsedInput.parameters } : {}),
    ...(parsedInput.machineId ? { machineId: MachineId(parsedInput.machineId) } : {}),
    executionTier: parsedInput.executionTier,
    toolClassification: {
      toolName: evaluation.toolClassification.toolName,
      category: evaluation.toolClassification.category,
      minimumTier: evaluation.toolClassification.minimumTier,
      rationale: evaluation.toolClassification.rationale,
    },
    policyDecision: evaluation.policyEvaluation.decision,
    policyIds: parsedInput.policyIds,
    decision: evaluation.decision,
    ...(approvalId ? { approvalId: ApprovalId(approvalId) } : {}),
    rationale: parsedInput.rationale,
    requestedByUserId: parsedInput.requestedByUserId,
    correlationId: CorrelationId(String(ctx.correlationId)),
    proposedAtIso: deps.clock.nowIso(),
    ...(parsedInput.idempotencyKey ? { idempotencyKey: parsedInput.idempotencyKey } : {}),
  };
  try {
    await deps.proposalStore.saveProposal(ctx.tenantId, proposal);
  } catch {
    // Non-fatal: proposal persistence failure should not block the response.
  }
}

function proposalToOutput(proposal: AgentActionProposalV1): ProposeAgentActionOutput {
  return {
    proposalId: String(proposal.proposalId),
    evidenceId: EvidenceId(`idempotent-replay:${String(proposal.proposalId)}`),
    decision: proposal.decision,
    ...(proposal.approvalId ? { approvalId: String(proposal.approvalId) } : {}),
  };
}

export async function proposeAgentAction(
  deps: ProposeAgentActionDeps,
  ctx: AppContext,
  input: ProposeAgentActionInput,
): Promise<Result<ProposeAgentActionOutput, ProposeAgentActionError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.agentActionPropose);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.agentActionPropose,
      message: 'Caller is not permitted to propose agent actions.',
    });
  }

  const parsedInput = parseProposeAgentActionInput({
    ...input,
    requestedByUserId: input.requestedByUserId ?? ctx.principalId.toString(),
  });
  if (!parsedInput.ok) return parsedInput;

  if (parsedInput.value.workspaceId !== ctx.tenantId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.agentActionPropose,
      message: 'Workspace mismatch for agent action proposal request.',
    });
  }

  // Idempotency: if idempotencyKey is provided and a matching proposal exists,
  // return the existing result without re-evaluating policy or writing evidence.
  if (parsedInput.value.idempotencyKey && deps.proposalStore) {
    const existing = await deps.proposalStore.getProposalByIdempotencyKey(
      ctx.tenantId,
      parsedInput.value.workspaceId,
      parsedInput.value.idempotencyKey,
    );
    if (existing) {
      return ok(proposalToOutput(existing));
    }
  }

  const policies = await loadPolicies(deps, ctx, parsedInput.value);
  if (!policies.ok) return policies;

  const evaluation = evaluateAgentActionGovernance({
    policies: policies.value,
    input: parsedInput.value,
  });

  const auditResult = buildAuditArtifacts(deps, ctx, parsedInput.value, evaluation);
  if (!auditResult.ok) return auditResult;
  const persistResult = await persistAuditArtifacts(deps, ctx, auditResult.value);
  if (!persistResult.ok) return persistResult;

  // Check for hard policy gate errors (SoD violations, outright denial)
  const gateError = toProposeAgentActionPolicyGateError({
    evaluation,
    evidenceId: auditResult.value.evidenceId,
  });
  if (gateError) return err(gateError);

  // For NeedsApproval: create and persist a real approval record
  if (evaluation.decision === 'NeedsApproval') {
    const approvalIdResult = nextId(deps.idGenerator, 'approval');
    if (!approvalIdResult.ok) return approvalIdResult;
    const requestedAtResult = nowIso(deps.clock);
    if (!requestedAtResult.ok) return requestedAtResult;

    const approval: ApprovalPendingV1 = {
      schemaVersion: 1,
      approvalId: ApprovalId(approvalIdResult.value),
      workspaceId: WorkspaceId(String(parsedInput.value.workspaceId)),
      runId: RunId(auditResult.value.proposalId),
      planId: PlanId(auditResult.value.proposalId),
      prompt: `Tool '${parsedInput.value.toolName}' (${evaluation.toolClassification.category}) requires approval at tier ${evaluation.toolClassification.minimumTier}. Rationale: ${parsedInput.value.rationale}`,
      requestedAtIso: requestedAtResult.value,
      requestedByUserId: parsedInput.value.requestedByUserId,
      status: 'Pending',
    };

    try {
      await deps.approvalStore.saveApproval(ctx.tenantId, approval);
    } catch (error) {
      return err({
        kind: 'DependencyFailure',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to persist approval record.',
      });
    }

    const needsApprovalOutput: ProposeAgentActionOutput = {
      proposalId: auditResult.value.proposalId,
      evidenceId: auditResult.value.evidenceId,
      decision: 'NeedsApproval',
      approvalId: approvalIdResult.value,
      message: `Tool '${parsedInput.value.toolName}' (${evaluation.toolClassification.category}) requires approval at tier ${evaluation.toolClassification.minimumTier}.`,
    };

    await saveProposalRecord(deps, ctx, parsedInput.value, evaluation, auditResult.value, approvalIdResult.value);
    return ok(needsApprovalOutput);
  }

  const allowOutput: ProposeAgentActionOutput = {
    proposalId: auditResult.value.proposalId,
    evidenceId: auditResult.value.evidenceId,
    decision: 'Allow',
  };

  await saveProposalRecord(deps, ctx, parsedInput.value, evaluation, auditResult.value);
  return ok(allowOutput);
}

// Canonical type alias declarations required by the contract test AST scanner.
export type ProposeAgentActionInput = ProposeAgentActionInputFromHelpers;
export type ProposeAgentActionOutput = ProposeAgentActionOutputFromHelpers;
