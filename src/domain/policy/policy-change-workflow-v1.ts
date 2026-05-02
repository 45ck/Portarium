import {
  ApprovalId,
  EvidenceId,
  PolicyChangeId,
  PolicyId,
  TenantId,
  UserId,
  WorkspaceId,
  type ApprovalId as ApprovalIdType,
  type EvidenceId as EvidenceIdType,
  type PolicyChangeId as PolicyChangeIdType,
  type PolicyId as PolicyIdType,
  type TenantId as TenantIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  assertNotBefore,
  readEnum,
  readInteger,
  readIsoString,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

import { parsePolicyV1, type PolicyV1 } from './policy-v1.js';

export type PolicyChangeScopeV1 =
  | Readonly<{
      targetKind: 'Workspace';
      workspaceId: WorkspaceIdType;
    }>
  | Readonly<{
      targetKind: 'ActionClass';
      workspaceId: WorkspaceIdType;
      actionClass: string;
    }>
  | Readonly<{
      targetKind: 'Tenant';
      tenantId: TenantIdType;
    }>;

export type PolicyChangeOperationV1 = 'Create' | 'Update' | 'Deactivate' | 'Rollback';
export type PolicyChangeRiskV1 = 'Standard' | 'High';
export type PolicyChangeStatusV1 =
  | 'PendingApproval'
  | 'Applied'
  | 'Rejected'
  | 'RolledBack'
  | 'Superseded';
export type PolicyChangeRunEffectV1 = 'FutureRunsOnly' | 'ActiveAndFutureRuns';

export type PolicyChangeDiffEntryV1 = Readonly<{
  path: string;
  before?: unknown;
  after?: unknown;
}>;

export type PolicyChangeApprovalV1 = Readonly<{
  approvalRequired: boolean;
  approvalId?: ApprovalIdType;
  approvedAtIso?: string;
  approvedByUserId?: UserIdType;
}>;

export type PolicyChangeActivationRequirementsV1 = Readonly<{
  replayReportRequired: boolean;
  replayReportEvidenceId?: EvidenceIdType;
}>;

export type PolicyChangeRequestV1 = Readonly<{
  schemaVersion: 1;
  policyChangeId: PolicyChangeIdType;
  policyId: PolicyIdType;
  workspaceId: WorkspaceIdType;
  operation: PolicyChangeOperationV1;
  risk: PolicyChangeRiskV1;
  status: PolicyChangeStatusV1;
  scope: PolicyChangeScopeV1;
  basePolicy?: PolicyV1;
  proposedPolicy: PolicyV1;
  proposedAtIso: string;
  proposedByUserId: UserIdType;
  rationale: string;
  diff: readonly PolicyChangeDiffEntryV1[];
  runEffect: PolicyChangeRunEffectV1;
  effectiveFromIso: string;
  expiresAtIso?: string;
  approval: PolicyChangeApprovalV1;
  activationRequirements?: PolicyChangeActivationRequirementsV1;
  supersedesPolicyChangeId?: PolicyChangeIdType;
  supersededByPolicyChangeId?: PolicyChangeIdType;
  rollbackOfPolicyChangeId?: PolicyChangeIdType;
  rolledBackByPolicyChangeId?: PolicyChangeIdType;
}>;

export type PolicyChangeAuditEntryV1 = Readonly<{
  schemaVersion: 1;
  policyChangeId: PolicyChangeIdType;
  policyId: PolicyIdType;
  workspaceId: WorkspaceIdType;
  eventType:
    | 'PolicyChangeProposed'
    | 'PolicyChangeApproved'
    | 'PolicyChangeApplied'
    | 'PolicyChangeRejected'
    | 'PolicyChangeRolledBack'
    | 'PolicyChangeSuperseded';
  occurredAtIso: string;
  actorUserId: UserIdType;
  rationale: string;
  scope: PolicyChangeScopeV1;
  status: PolicyChangeStatusV1;
  policyVersion: number;
}>;

export class PolicyChangeParseError extends Error {
  public override readonly name = 'PolicyChangeParseError';

  public constructor(message: string) {
    super(message);
  }
}

export class PolicyChangeWorkflowError extends Error {
  public override readonly name = 'PolicyChangeWorkflowError';

  public constructor(message: string) {
    super(message);
  }
}

const OPERATIONS = ['Create', 'Update', 'Deactivate', 'Rollback'] as const;
const RISKS = ['Standard', 'High'] as const;
const STATUSES = ['PendingApproval', 'Applied', 'Rejected', 'RolledBack', 'Superseded'] as const;
const RUN_EFFECTS = ['FutureRunsOnly', 'ActiveAndFutureRuns'] as const;
const SCOPE_KINDS = ['Workspace', 'ActionClass', 'Tenant'] as const;

export function requiresPolicyChangeApproval(change: PolicyChangeRequestV1): boolean {
  return change.risk === 'High' || change.approval.approvalRequired;
}

export function approvePolicyChangeV1(params: {
  change: PolicyChangeRequestV1;
  approvalId: ApprovalIdType;
  approvedByUserId: UserIdType;
  approvedAtIso: string;
}): PolicyChangeRequestV1 {
  const { change, approvalId, approvedByUserId, approvedAtIso } = params;
  if (change.status !== 'PendingApproval') {
    throw new PolicyChangeWorkflowError('Only PendingApproval policy changes can be approved.');
  }
  if (change.proposedByUserId === approvedByUserId) {
    throw new PolicyChangeWorkflowError(
      'Maker-checker violation: proposer cannot approve the same policy change.',
    );
  }
  assertReplayReportSatisfied(change);
  assertNotBefore(change.proposedAtIso, approvedAtIso, PolicyChangeWorkflowError, {
    anchorLabel: 'proposedAtIso',
    laterLabel: 'approvedAtIso',
  });
  return {
    ...change,
    status: 'Applied',
    approval: {
      approvalRequired: true,
      approvalId,
      approvedAtIso,
      approvedByUserId,
    },
  };
}

export function applyStandardPolicyChangeV1(change: PolicyChangeRequestV1): PolicyChangeRequestV1 {
  if (requiresPolicyChangeApproval(change)) {
    throw new PolicyChangeWorkflowError('High-risk policy changes require approval.');
  }
  if (change.status !== 'PendingApproval') {
    throw new PolicyChangeWorkflowError('Only PendingApproval policy changes can be applied.');
  }
  assertReplayReportSatisfied(change);
  return { ...change, status: 'Applied' };
}

export function attachPolicyChangeReplayReportEvidenceV1(params: {
  change: PolicyChangeRequestV1;
  replayReportEvidenceId: EvidenceIdType;
}): PolicyChangeRequestV1 {
  return {
    ...params.change,
    activationRequirements: {
      replayReportRequired: params.change.activationRequirements?.replayReportRequired ?? true,
      replayReportEvidenceId: params.replayReportEvidenceId,
    },
  };
}

function assertReplayReportSatisfied(change: PolicyChangeRequestV1): void {
  if (
    change.activationRequirements?.replayReportRequired === true &&
    change.activationRequirements.replayReportEvidenceId === undefined
  ) {
    throw new PolicyChangeWorkflowError(
      'Replay report evidence is required before this policy change can be activated.',
    );
  }
}

export function markPolicyChangeRolledBackV1(params: {
  change: PolicyChangeRequestV1;
  rolledBackByPolicyChangeId: PolicyChangeIdType;
}): PolicyChangeRequestV1 {
  if (params.change.status !== 'Applied' && params.change.status !== 'Superseded') {
    throw new PolicyChangeWorkflowError('Only applied or superseded policy changes can roll back.');
  }
  return {
    ...params.change,
    status: 'RolledBack',
    rolledBackByPolicyChangeId: params.rolledBackByPolicyChangeId,
  };
}

export function markPolicyChangeSupersededV1(params: {
  change: PolicyChangeRequestV1;
  supersededByPolicyChangeId: PolicyChangeIdType;
}): PolicyChangeRequestV1 {
  if (params.change.status !== 'Applied') {
    throw new PolicyChangeWorkflowError('Only applied policy changes can be superseded.');
  }
  return {
    ...params.change,
    status: 'Superseded',
    supersededByPolicyChangeId: params.supersededByPolicyChangeId,
  };
}

export function isPolicyChangeEffectiveForRunV1(params: {
  change: PolicyChangeRequestV1;
  runStartedAtIso: string;
  evaluationAtIso: string;
}): boolean {
  const { change, runStartedAtIso, evaluationAtIso } = params;
  if (change.status !== 'Applied') return false;
  const effectiveFrom = Date.parse(change.effectiveFromIso);
  const evaluationAt = Date.parse(evaluationAtIso);
  if (Number.isNaN(effectiveFrom) || Number.isNaN(evaluationAt)) return false;
  if (evaluationAt < effectiveFrom) return false;
  if (change.expiresAtIso !== undefined && evaluationAt >= Date.parse(change.expiresAtIso)) {
    return false;
  }
  if (change.runEffect === 'ActiveAndFutureRuns') return true;
  return Date.parse(runStartedAtIso) >= effectiveFrom;
}

export function toPolicyChangeAuditEntryV1(params: {
  change: PolicyChangeRequestV1;
  eventType: PolicyChangeAuditEntryV1['eventType'];
  occurredAtIso: string;
  actorUserId: UserIdType;
  rationale: string;
}): PolicyChangeAuditEntryV1 {
  const { change, eventType, occurredAtIso, actorUserId, rationale } = params;
  return {
    schemaVersion: 1,
    policyChangeId: change.policyChangeId,
    policyId: change.policyId,
    workspaceId: change.workspaceId,
    eventType,
    occurredAtIso,
    actorUserId,
    rationale,
    scope: change.scope,
    status: change.status,
    policyVersion: change.proposedPolicy.version,
  };
}

export function parsePolicyChangeRequestV1(value: unknown): PolicyChangeRequestV1 {
  const record = readRecord(value, 'PolicyChangeRequest', PolicyChangeParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', PolicyChangeParseError);
  if (schemaVersion !== 1) {
    throw new PolicyChangeParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const policyChangeId = PolicyChangeId(
    readString(record, 'policyChangeId', PolicyChangeParseError),
  );
  const policyId = PolicyId(readString(record, 'policyId', PolicyChangeParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', PolicyChangeParseError));
  const operation = readEnum(record, 'operation', OPERATIONS, PolicyChangeParseError);
  const risk = readEnum(record, 'risk', RISKS, PolicyChangeParseError);
  const status = readEnum(record, 'status', STATUSES, PolicyChangeParseError);
  const scope = parsePolicyChangeScopeV1(record['scope']);
  const basePolicyRaw = record['basePolicy'];
  const basePolicy = basePolicyRaw === undefined ? undefined : parsePolicyV1(basePolicyRaw);
  const proposedPolicy = parsePolicyV1(record['proposedPolicy']);
  const proposedAtIso = readIsoString(record, 'proposedAtIso', PolicyChangeParseError);
  const proposedByUserId = UserId(readString(record, 'proposedByUserId', PolicyChangeParseError));
  const rationale = readString(record, 'rationale', PolicyChangeParseError);
  const diff = parsePolicyChangeDiffV1(record['diff']);
  const runEffect = readEnum(record, 'runEffect', RUN_EFFECTS, PolicyChangeParseError);
  const effectiveFromIso = readIsoString(record, 'effectiveFromIso', PolicyChangeParseError);
  assertNotBefore(proposedAtIso, effectiveFromIso, PolicyChangeParseError, {
    anchorLabel: 'proposedAtIso',
    laterLabel: 'effectiveFromIso',
  });
  const expiresAtIso = readOptionalIsoString(record, 'expiresAtIso', PolicyChangeParseError);
  if (expiresAtIso !== undefined) {
    assertNotBefore(effectiveFromIso, expiresAtIso, PolicyChangeParseError, {
      anchorLabel: 'effectiveFromIso',
      laterLabel: 'expiresAtIso',
    });
  }
  const approval = parsePolicyChangeApprovalV1(record['approval']);
  const activationRequirements = parseOptionalActivationRequirementsV1(
    record,
    'activationRequirements',
  );
  const supersedesPolicyChangeId = parseOptionalPolicyChangeId(record, 'supersedesPolicyChangeId');
  const supersededByPolicyChangeId = parseOptionalPolicyChangeId(
    record,
    'supersededByPolicyChangeId',
  );
  const rollbackOfPolicyChangeId = parseOptionalPolicyChangeId(record, 'rollbackOfPolicyChangeId');
  const rolledBackByPolicyChangeId = parseOptionalPolicyChangeId(
    record,
    'rolledBackByPolicyChangeId',
  );

  if (risk === 'High' && !approval.approvalRequired) {
    throw new PolicyChangeParseError('High-risk policy changes must require approval.');
  }
  if (approval.approvedByUserId !== undefined && approval.approvedByUserId === proposedByUserId) {
    throw new PolicyChangeParseError('Policy change approval must satisfy maker-checker.');
  }
  if (approval.approvedAtIso !== undefined) {
    assertNotBefore(proposedAtIso, approval.approvedAtIso, PolicyChangeParseError, {
      anchorLabel: 'proposedAtIso',
      laterLabel: 'approval.approvedAtIso',
    });
  }

  return {
    schemaVersion: 1,
    policyChangeId,
    policyId,
    workspaceId,
    operation,
    risk,
    status,
    scope,
    ...(basePolicy !== undefined ? { basePolicy } : {}),
    proposedPolicy,
    proposedAtIso,
    proposedByUserId,
    rationale,
    diff,
    runEffect,
    effectiveFromIso,
    ...(expiresAtIso !== undefined ? { expiresAtIso } : {}),
    approval,
    ...(activationRequirements !== undefined ? { activationRequirements } : {}),
    ...(supersedesPolicyChangeId !== undefined ? { supersedesPolicyChangeId } : {}),
    ...(supersededByPolicyChangeId !== undefined ? { supersededByPolicyChangeId } : {}),
    ...(rollbackOfPolicyChangeId !== undefined ? { rollbackOfPolicyChangeId } : {}),
    ...(rolledBackByPolicyChangeId !== undefined ? { rolledBackByPolicyChangeId } : {}),
  };
}

function parsePolicyChangeScopeV1(value: unknown): PolicyChangeScopeV1 {
  const record = readRecord(value, 'scope', PolicyChangeParseError);
  const targetKind = readEnum(record, 'targetKind', SCOPE_KINDS, PolicyChangeParseError);
  if (targetKind === 'Workspace') {
    return {
      targetKind,
      workspaceId: WorkspaceId(readString(record, 'workspaceId', PolicyChangeParseError)),
    };
  }
  if (targetKind === 'ActionClass') {
    return {
      targetKind,
      workspaceId: WorkspaceId(readString(record, 'workspaceId', PolicyChangeParseError)),
      actionClass: readString(record, 'actionClass', PolicyChangeParseError),
    };
  }
  return {
    targetKind,
    tenantId: TenantId(readString(record, 'tenantId', PolicyChangeParseError)),
  };
}

function parsePolicyChangeApprovalV1(value: unknown): PolicyChangeApprovalV1 {
  const record = readRecord(value, 'approval', PolicyChangeParseError);
  const approvalRequired = record['approvalRequired'];
  if (typeof approvalRequired !== 'boolean') {
    throw new PolicyChangeParseError('approvalRequired must be a boolean.');
  }
  const approvalIdRaw = readOptionalString(record, 'approvalId', PolicyChangeParseError);
  const approvedAtIso = readOptionalIsoString(record, 'approvedAtIso', PolicyChangeParseError);
  const approvedByUserIdRaw = readOptionalString(
    record,
    'approvedByUserId',
    PolicyChangeParseError,
  );
  if ((approvedAtIso === undefined) !== (approvedByUserIdRaw === undefined)) {
    throw new PolicyChangeParseError(
      'approvedAtIso and approvedByUserId must be provided together.',
    );
  }
  return {
    approvalRequired,
    ...(approvalIdRaw !== undefined ? { approvalId: ApprovalId(approvalIdRaw) } : {}),
    ...(approvedAtIso !== undefined ? { approvedAtIso } : {}),
    ...(approvedByUserIdRaw !== undefined ? { approvedByUserId: UserId(approvedByUserIdRaw) } : {}),
  };
}

function parseOptionalActivationRequirementsV1(
  record: Record<string, unknown>,
  key: string,
): PolicyChangeActivationRequirementsV1 | undefined {
  const raw = record[key];
  if (raw === undefined) return undefined;
  const value = readRecord(raw, key, PolicyChangeParseError);
  const replayReportRequired = value['replayReportRequired'];
  if (typeof replayReportRequired !== 'boolean') {
    throw new PolicyChangeParseError(
      'activationRequirements.replayReportRequired must be a boolean.',
    );
  }
  const replayReportEvidenceIdRaw = readOptionalString(
    value,
    'replayReportEvidenceId',
    PolicyChangeParseError,
  );
  return {
    replayReportRequired,
    ...(replayReportEvidenceIdRaw !== undefined
      ? { replayReportEvidenceId: EvidenceId(replayReportEvidenceIdRaw) }
      : {}),
  };
}

function parsePolicyChangeDiffV1(value: unknown): readonly PolicyChangeDiffEntryV1[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PolicyChangeParseError('diff must be a non-empty array.');
  }
  return value.map((entry, index) => parsePolicyChangeDiffEntryV1(entry, index));
}

function parsePolicyChangeDiffEntryV1(value: unknown, index: number): PolicyChangeDiffEntryV1 {
  const record = readRecord(value, `diff[${index}]`, PolicyChangeParseError);
  const path = readString(record, 'path', PolicyChangeParseError);
  const before = record['before'];
  const after = record['after'];
  if (before === undefined && after === undefined) {
    throw new PolicyChangeParseError('diff entries must include before or after.');
  }
  return {
    path,
    ...(before !== undefined ? { before } : {}),
    ...(after !== undefined ? { after } : {}),
  };
}

function parseOptionalPolicyChangeId(
  record: Record<string, unknown>,
  key: string,
): PolicyChangeIdType | undefined {
  const value = readOptionalString(record, key, PolicyChangeParseError);
  return value === undefined ? undefined : PolicyChangeId(value);
}
