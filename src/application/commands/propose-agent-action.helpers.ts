import { createHash } from 'node:crypto';

import {
  PolicyId,
  UserId,
  WorkspaceId,
  type EvidenceId as EvidenceIdType,
  type ExecutionTier,
  type PolicyId as PolicyIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import {
  evaluateOutboundCommunicationComplianceV1,
  parseOutboundCommunicationComplianceFixtureV1,
  type OutboundCommunicationComplianceEvaluationV1,
  type OutboundCommunicationComplianceFixtureV1,
  type PolicyV1,
} from '../../domain/policy/index.js';
import { evaluatePolicies, type PolicyEvaluationResultV1 } from '../../domain/services/index.js';
import {
  classifyOpenClawToolBlastRadiusV1,
  type OpenClawToolBlastRadiusPolicyV1,
} from '../../domain/machines/openclaw-tool-blast-radius-v1.js';
import {
  APP_ACTIONS,
  err,
  ok,
  type Conflict,
  type Forbidden,
  type Result,
  type ValidationFailed,
} from '../common/index.js';

export type ProposeAgentActionInput = Readonly<{
  workspaceId: string;
  agentId: string;
  machineId?: string;
  actionKind: string;
  toolName: string;
  parameters?: Record<string, unknown>;
  executionTier: ExecutionTier;
  policyIds: readonly string[];
  rationale: string;
  requestedByUserId?: string;
  correlationId?: string;
  idempotencyKey?: string;
}>;

export type ProposeAgentActionOutput = Readonly<{
  proposalId: string;
  evidenceId: EvidenceIdType;
  decision: 'Allow' | 'NeedsApproval' | 'Denied';
  approvalId?: string;
  message?: string;
}>;

export type ParsedProposeAgentActionInput = Readonly<{
  workspaceId: WorkspaceIdType;
  agentId: string;
  machineId?: string;
  actionKind: string;
  toolName: string;
  parameters?: Record<string, unknown>;
  executionTier: ExecutionTier;
  policyIds: readonly PolicyIdType[];
  rationale: string;
  requestedByUserId: UserIdType;
  idempotencyKey?: string;
  outboundCompliance?: OutboundCommunicationComplianceFixtureV1;
}>;

export type ProposeAgentActionPolicyError = Forbidden | Conflict;

function parseRequiredString(value: unknown, fieldName: string): Result<string, ValidationFailed> {
  if (typeof value !== 'string' || value.trim() === '') {
    return err({
      kind: 'ValidationFailed',
      message: `${fieldName} must be a non-empty string.`,
    });
  }
  return ok(value);
}

function parseStringArray(
  rawValues: unknown,
  fieldName: string,
): Result<readonly string[], ValidationFailed> {
  if (!Array.isArray(rawValues)) {
    return err({
      kind: 'ValidationFailed',
      message: `${fieldName} must be an array.`,
    });
  }

  const parsed: string[] = [];
  for (const rawValue of rawValues) {
    const valueResult = parseRequiredString(rawValue, `${fieldName}[]`);
    if (!valueResult.ok) return valueResult;
    parsed.push(valueResult.value);
  }
  return ok(parsed);
}

function parsePolicyIds(rawPolicyIds: unknown): Result<readonly PolicyIdType[], ValidationFailed> {
  const idsResult = parseStringArray(rawPolicyIds, 'policyIds');
  if (!idsResult.ok) return idsResult;
  if (idsResult.value.length === 0) {
    return err({
      kind: 'ValidationFailed',
      message: 'policyIds must be a non-empty array of policy identifiers.',
    });
  }
  return ok([...new Set(idsResult.value.map((policyId) => PolicyId(policyId)))]);
}

const VALID_EXECUTION_TIERS: readonly ExecutionTier[] = [
  'Auto',
  'Assisted',
  'HumanApprove',
  'ManualOnly',
];

export function parseProposeAgentActionInput(
  rawInput: ProposeAgentActionInput,
): Result<ParsedProposeAgentActionInput, ValidationFailed> {
  const workspaceIdResult = parseRequiredString(rawInput.workspaceId, 'workspaceId');
  if (!workspaceIdResult.ok) return workspaceIdResult;
  const agentIdResult = parseRequiredString(rawInput.agentId, 'agentId');
  if (!agentIdResult.ok) return agentIdResult;
  const actionKindResult = parseRequiredString(rawInput.actionKind, 'actionKind');
  if (!actionKindResult.ok) return actionKindResult;
  const toolNameResult = parseRequiredString(rawInput.toolName, 'toolName');
  if (!toolNameResult.ok) return toolNameResult;
  const rationaleResult = parseRequiredString(rawInput.rationale, 'rationale');
  if (!rationaleResult.ok) return rationaleResult;
  const requestedByUserIdResult = parseRequiredString(
    rawInput.requestedByUserId,
    'requestedByUserId',
  );
  if (!requestedByUserIdResult.ok) return requestedByUserIdResult;
  const policyIdsResult = parsePolicyIds(rawInput.policyIds);
  if (!policyIdsResult.ok) return policyIdsResult;
  const outboundComplianceResult = parseOptionalOutboundCompliance(rawInput.parameters);
  if (!outboundComplianceResult.ok) return outboundComplianceResult;

  if (!VALID_EXECUTION_TIERS.includes(rawInput.executionTier)) {
    return err({
      kind: 'ValidationFailed',
      message: `executionTier must be one of: ${VALID_EXECUTION_TIERS.join(', ')}.`,
    });
  }

  return ok({
    workspaceId: WorkspaceId(workspaceIdResult.value),
    agentId: agentIdResult.value,
    ...(rawInput.machineId ? { machineId: rawInput.machineId } : {}),
    actionKind: actionKindResult.value,
    toolName: toolNameResult.value,
    ...(rawInput.parameters ? { parameters: rawInput.parameters } : {}),
    executionTier: rawInput.executionTier,
    policyIds: policyIdsResult.value,
    rationale: rationaleResult.value,
    requestedByUserId: UserId(requestedByUserIdResult.value),
    ...(rawInput.idempotencyKey ? { idempotencyKey: rawInput.idempotencyKey } : {}),
    ...(outboundComplianceResult.value
      ? { outboundCompliance: outboundComplianceResult.value }
      : {}),
  });
}

export type AgentActionGovernanceEvaluation = Readonly<{
  policyEvaluation: PolicyEvaluationResultV1;
  toolClassification: OpenClawToolBlastRadiusPolicyV1;
  outboundCompliance?: OutboundCommunicationComplianceEvaluationV1 | undefined;
  decision: 'Allow' | 'NeedsApproval' | 'Denied';
}>;

export function evaluateAgentActionGovernance(params: {
  policies: readonly PolicyV1[];
  input: ParsedProposeAgentActionInput;
}): AgentActionGovernanceEvaluation {
  const { policies, input } = params;

  const toolClassification = classifyOpenClawToolBlastRadiusV1(input.toolName);
  const outboundCompliance =
    input.outboundCompliance && isGovernedOutboundAction(input)
      ? evaluateOutboundCommunicationComplianceV1(input.outboundCompliance)
      : undefined;

  const policyEvaluation = evaluatePolicies({
    policies,
    context: {
      initiatorUserId: input.requestedByUserId,
      approverUserIds: [],
      executionTier: input.executionTier,
      actionOperation: `agent:${input.actionKind}`,
    },
  });

  // Determine final decision from both tool classification and policy evaluation
  if (toolClassification.category === 'Dangerous') {
    return { policyEvaluation, toolClassification, outboundCompliance, decision: 'Denied' };
  }

  if (policyEvaluation.decision === 'Deny') {
    return { policyEvaluation, toolClassification, outboundCompliance, decision: 'Denied' };
  }

  if (
    outboundCompliance?.decision === 'Block' ||
    outboundCompliance?.decision === 'Defer' ||
    outboundCompliance?.decision === 'ManualOnly'
  ) {
    return { policyEvaluation, toolClassification, outboundCompliance, decision: 'Denied' };
  }

  if (
    policyEvaluation.decision === 'RequireApproval' ||
    outboundCompliance?.decision === 'HumanApprove' ||
    toolClassification.category === 'Mutation' ||
    toolClassification.category === 'Unknown'
  ) {
    return { policyEvaluation, toolClassification, outboundCompliance, decision: 'NeedsApproval' };
  }

  return { policyEvaluation, toolClassification, outboundCompliance, decision: 'Allow' };
}

export function toProposeAgentActionPolicyGateError(params: {
  evaluation: AgentActionGovernanceEvaluation;
  evidenceId: EvidenceIdType;
}): ProposeAgentActionPolicyError | null {
  const { evaluation, evidenceId } = params;

  if (evaluation.policyEvaluation.violations.length > 0) {
    return {
      kind: 'Forbidden',
      action: APP_ACTIONS.agentActionPropose,
      message: `SoD violation: ${evaluation.policyEvaluation.violations[0]!.kind}. Proposal evidence: ${evidenceId}.`,
    };
  }

  if (evaluation.decision === 'Denied') {
    if (evaluation.outboundCompliance?.decision === 'Defer') {
      return {
        kind: 'Conflict',
        message: `Outbound compliance deferred agent action until ${evaluation.outboundCompliance.deferredUntilIso ?? 'the next allowed send window'}. ${formatOutboundComplianceRationale(evaluation.outboundCompliance)} Proposal evidence: ${evidenceId}.`,
      };
    }

    if (
      evaluation.outboundCompliance?.decision === 'Block' ||
      evaluation.outboundCompliance?.decision === 'ManualOnly'
    ) {
      return {
        kind: 'Forbidden',
        action: APP_ACTIONS.agentActionPropose,
        message: `Outbound compliance ${evaluation.outboundCompliance.decision} for agent action proposal. ${formatOutboundComplianceRationale(evaluation.outboundCompliance)} Evidence: ${evidenceId}.`,
      };
    }

    return {
      kind: 'Forbidden',
      action: APP_ACTIONS.agentActionPropose,
      message: `Policy denied agent action proposal (tool: ${evaluation.toolClassification.toolName}, category: ${evaluation.toolClassification.category}). Evidence: ${evidenceId}.`,
    };
  }

  // NeedsApproval is not an error — it's a valid outcome that returns a proposal with an approval ID.
  // Allow is also not an error.
  return null;
}

export function formatOutboundComplianceRationale(
  evaluation: OutboundCommunicationComplianceEvaluationV1,
): string {
  const reasons = evaluation.rationales.map((rationale) => rationale.message).join(' ');
  const deferred = evaluation.deferredUntilIso
    ? ` Deferred until ${evaluation.deferredUntilIso}.`
    : '';
  return `Outbound compliance ${evaluation.decision} (${evaluation.channel}/${evaluation.purpose}). ${reasons}${deferred}`;
}

function parseOptionalOutboundCompliance(
  parameters: Record<string, unknown> | undefined,
): Result<OutboundCommunicationComplianceFixtureV1 | undefined, ValidationFailed> {
  if (parameters?.['outboundCompliance'] === undefined) {
    return ok(undefined);
  }

  try {
    return ok(parseOutboundCommunicationComplianceFixtureV1(parameters['outboundCompliance']));
  } catch (error) {
    return err({
      kind: 'ValidationFailed',
      message:
        error instanceof Error
          ? `outboundCompliance invalid: ${error.message}`
          : 'outboundCompliance invalid.',
    });
  }
}

function isGovernedOutboundAction(input: ParsedProposeAgentActionInput): boolean {
  const action = `${input.actionKind}:${input.toolName}`.toLowerCase();
  return (
    /(^|[:._-])(send|publish|post)([:._-]|$)/u.test(action) ||
    /(^|[:._-])(email|sms|message|campaign|social)([:._-])?(send|publish|post)([:._-]|$)/u.test(
      action,
    )
  );
}

// ---------------------------------------------------------------------------
// Idempotency key generation
// ---------------------------------------------------------------------------

/**
 * Derives a deterministic idempotency key from the proposal's identity fields:
 * workspaceId + agentId + actionKind + toolName + canonical parameters JSON.
 *
 * This allows automatic deduplication even when callers do not provide an
 * explicit idempotencyKey.
 */
export function generateIdempotencyKey(input: ParsedProposeAgentActionInput): string {
  const parts = [
    String(input.workspaceId),
    input.agentId,
    input.actionKind,
    input.toolName,
    input.executionTier,
    input.parameters ? stableJsonStringify(input.parameters) : '',
  ];
  return `auto:${createHash('sha256').update(parts.join('\0')).digest('hex')}`;
}

/**
 * Produces a deterministic JSON string by sorting object keys recursively.
 * Ensures identical parameters always hash to the same key regardless of
 * property insertion order.
 */
function stableJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableJsonStringify((value as Record<string, unknown>)[k])}`,
  );
  return '{' + entries.join(',') + '}';
}
