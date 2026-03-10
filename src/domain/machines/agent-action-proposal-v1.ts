import {
  AgentId,
  ApprovalId,
  CorrelationId,
  EvidenceId,
  MachineId,
  PolicyId,
  ProposalId,
  UserId,
  WorkspaceId,
  type AgentId as AgentIdType,
  type ApprovalId as ApprovalIdType,
  type CorrelationId as CorrelationIdType,
  type EvidenceId as EvidenceIdType,
  type ExecutionTier,
  type MachineId as MachineIdType,
  type PolicyId as PolicyIdType,
  type ProposalId as ProposalIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import type { OpenClawToolRiskCategoryV1 } from './openclaw-tool-blast-radius-v1.js';
import {
  readEnum,
  readInteger,
  readIsoString,
  readOptionalRecordField,
  readOptionalString,
  readRecord,
  readString,
  readStringArray,
} from '../validation/parse-utils.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROPOSAL_DECISIONS = ['Allow', 'NeedsApproval', 'Denied'] as const;
export type AgentActionProposalDecision = (typeof PROPOSAL_DECISIONS)[number];

const TOOL_RISK_CATEGORIES = ['ReadOnly', 'Mutation', 'Dangerous', 'Unknown'] as const;

const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;

const POLICY_DECISIONS = ['Allow', 'Deny', 'RequireApproval'] as const;
export type AgentActionPolicyDecision = (typeof POLICY_DECISIONS)[number];

// ---------------------------------------------------------------------------
// Tool classification snapshot (embedded value object)
// ---------------------------------------------------------------------------

export type AgentActionToolClassificationV1 = Readonly<{
  toolName: string;
  category: OpenClawToolRiskCategoryV1;
  minimumTier: ExecutionTier;
  rationale: string;
}>;

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export type AgentActionProposalV1 = Readonly<{
  schemaVersion: 1;
  proposalId: ProposalIdType;
  workspaceId: WorkspaceIdType;
  agentId: AgentIdType;
  machineId?: MachineIdType;
  actionKind: string;
  toolName: string;
  parameters?: Record<string, unknown>;
  executionTier: ExecutionTier;
  toolClassification: AgentActionToolClassificationV1;
  policyDecision: AgentActionPolicyDecision;
  policyIds: readonly PolicyIdType[];
  decision: AgentActionProposalDecision;
  approvalId?: ApprovalIdType;
  rationale: string;
  requestedByUserId: UserIdType;
  correlationId: CorrelationIdType;
  proposedAtIso: string;
  idempotencyKey?: string;
  evidenceId?: EvidenceIdType;
}>;

// ---------------------------------------------------------------------------
// Parse error
// ---------------------------------------------------------------------------

export class AgentActionProposalParseError extends Error {
  public override readonly name = 'AgentActionProposalParseError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const E = AgentActionProposalParseError;

export function parseAgentActionProposalV1(value: unknown): AgentActionProposalV1 {
  const record = readRecord(value, 'AgentActionProposal', E);

  const schemaVersion = readInteger(record, 'schemaVersion', E);
  if (schemaVersion !== 1) {
    throw new E(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const proposalId = ProposalId(readString(record, 'proposalId', E));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', E));
  const agentId = AgentId(readString(record, 'agentId', E));
  const machineIdRaw = readOptionalString(record, 'machineId', E);
  const actionKind = readString(record, 'actionKind', E);
  const toolName = readString(record, 'toolName', E);
  const parameters = readOptionalRecordField(record, 'parameters', E);
  const executionTier = readEnum(record, 'executionTier', EXECUTION_TIERS, E);

  const toolClassification = parseToolClassification(record);

  const policyDecision = readEnum(record, 'policyDecision', POLICY_DECISIONS, E);
  const policyIdsRaw = readStringArray(record, 'policyIds', E, { minLength: 1 });
  const policyIds = policyIdsRaw.map((id) => PolicyId(id));
  const decision = readEnum(record, 'decision', PROPOSAL_DECISIONS, E);
  const approvalIdRaw = readOptionalString(record, 'approvalId', E);
  const rationale = readString(record, 'rationale', E);
  const requestedByUserId = UserId(readString(record, 'requestedByUserId', E));
  const correlationId = CorrelationId(readString(record, 'correlationId', E));
  const proposedAtIso = readIsoString(record, 'proposedAtIso', E);
  const idempotencyKey = readOptionalString(record, 'idempotencyKey', E);
  const evidenceIdRaw = readOptionalString(record, 'evidenceId', E);

  return {
    schemaVersion: 1,
    proposalId,
    workspaceId,
    agentId,
    ...(machineIdRaw !== undefined ? { machineId: MachineId(machineIdRaw) } : {}),
    actionKind,
    toolName,
    ...(parameters !== undefined ? { parameters } : {}),
    executionTier,
    toolClassification,
    policyDecision,
    policyIds,
    decision,
    ...(approvalIdRaw !== undefined ? { approvalId: ApprovalId(approvalIdRaw) } : {}),
    rationale,
    requestedByUserId,
    correlationId,
    proposedAtIso,
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    ...(evidenceIdRaw !== undefined ? { evidenceId: EvidenceId(evidenceIdRaw) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseToolClassification(record: Record<string, unknown>): AgentActionToolClassificationV1 {
  const raw = record['toolClassification'];
  const tc = readRecord(raw, 'toolClassification', E);

  const toolName = readString(tc, 'toolName', E, { path: 'toolClassification' });
  const category = readEnum(tc, 'category', TOOL_RISK_CATEGORIES, E);
  const minimumTier = readEnum(tc, 'minimumTier', EXECUTION_TIERS, E);
  const rationale = readString(tc, 'rationale', E, { path: 'toolClassification' });

  return { toolName, category, minimumTier, rationale };
}
