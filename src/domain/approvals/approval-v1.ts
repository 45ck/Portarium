import {
  ApprovalId,
  PlanId,
  RunId,
  UserId,
  WorkItemId,
  WorkspaceId,
  type ApprovalDecision,
  type ApprovalId as ApprovalIdType,
  type PlanId as PlanIdType,
  type RunId as RunIdType,
  type UserId as UserIdType,
  type WorkItemId as WorkItemIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  parseIsoDate,
  readInteger,
  readIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type ApprovalStatus = 'Pending' | ApprovalDecision;

export type EscalationStepV1 = Readonly<{
  stepOrder: number;
  escalateToUserId: string;
  afterHours: number;
}>;

type ApprovalBaseV1 = Readonly<{
  schemaVersion: 1;
  approvalId: ApprovalIdType;
  workspaceId: WorkspaceIdType;
  runId: RunIdType;
  planId: PlanIdType;
  workItemId?: WorkItemIdType;
  prompt: string;
  requestedAtIso: string;
  requestedByUserId: UserIdType;
  assigneeUserId?: UserIdType;
  dueAtIso?: string;
  escalationChain?: readonly EscalationStepV1[];
}>;

export type ApprovalPendingV1 = Readonly<
  ApprovalBaseV1 & {
    status: 'Pending';
  }
>;

export type ApprovalDecidedV1 = Readonly<
  ApprovalBaseV1 & {
    status: ApprovalDecision;
    decidedAtIso: string;
    decidedByUserId: UserIdType;
    rationale: string;
  }
>;

export type ApprovalV1 = ApprovalPendingV1 | ApprovalDecidedV1;

export class ApprovalParseError extends Error {
  public override readonly name = 'ApprovalParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseApprovalV1(value: unknown): ApprovalV1 {
  const record = readRecord(value, 'Approval', ApprovalParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', ApprovalParseError);
  if (schemaVersion !== 1) {
    throw new ApprovalParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const statusRaw = readString(record, 'status', ApprovalParseError);
  if (!isApprovalStatus(statusRaw)) {
    throw new ApprovalParseError(
      'status must be one of: Pending, Approved, Denied, RequestChanges.',
    );
  }

  if (statusRaw === 'Pending') {
    assertNoDecisionFields(record);
    const base = parseApprovalBaseV1(record);
    return { ...base, status: 'Pending' };
  }

  const base = parseApprovalBaseV1(record);
  const decision = parseDecisionFields(record, statusRaw, base.requestedAtIso);
  return { ...base, ...decision };
}

function parseApprovalBaseV1(value: Record<string, unknown>): ApprovalBaseV1 {
  const approvalId = ApprovalId(readString(value, 'approvalId', ApprovalParseError));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId', ApprovalParseError));
  const runId = RunId(readString(value, 'runId', ApprovalParseError));
  const planId = PlanId(readString(value, 'planId', ApprovalParseError));

  const workItemId = parseOptionalId(value, 'workItemId', WorkItemId);
  const assigneeUserId = parseOptionalId(value, 'assigneeUserId', UserId);

  const prompt = readString(value, 'prompt', ApprovalParseError);
  const requestedAtIso = readIsoString(value, 'requestedAtIso', ApprovalParseError);
  const requestedByUserId = UserId(readString(value, 'requestedByUserId', ApprovalParseError));
  const dueAtIso = readOptionalString(value, 'dueAtIso', ApprovalParseError);
  if (dueAtIso !== undefined) {
    const requestedAt = parseIsoDate(requestedAtIso, 'requestedAtIso', ApprovalParseError);
    const dueAt = parseIsoDate(dueAtIso, 'dueAtIso', ApprovalParseError);
    if (dueAt < requestedAt) {
      throw new ApprovalParseError('dueAtIso must not precede requestedAtIso.');
    }
  }

  const escalationChainRaw = value['escalationChain'];
  const escalationChain =
    escalationChainRaw === undefined ? undefined : parseEscalationChain(escalationChainRaw);

  return {
    schemaVersion: 1,
    approvalId,
    workspaceId,
    runId,
    planId,
    ...(workItemId ? { workItemId } : {}),
    prompt,
    requestedAtIso,
    requestedByUserId,
    ...(assigneeUserId ? { assigneeUserId } : {}),
    ...(dueAtIso ? { dueAtIso } : {}),
    ...(escalationChain ? { escalationChain } : {}),
  };
}

function parseDecisionFields(
  value: Record<string, unknown>,
  status: ApprovalDecision,
  requestedAtIso: string,
): Pick<ApprovalDecidedV1, 'status' | 'decidedAtIso' | 'decidedByUserId' | 'rationale'> {
  const decidedAtIso = readIsoString(value, 'decidedAtIso', ApprovalParseError);
  const requestedAt = parseIsoDate(requestedAtIso, 'requestedAtIso', ApprovalParseError);
  const decidedAt = parseIsoDate(decidedAtIso, 'decidedAtIso', ApprovalParseError);
  if (decidedAt < requestedAt) {
    throw new ApprovalParseError('decidedAtIso must not precede requestedAtIso.');
  }
  const decidedByUserId = UserId(readString(value, 'decidedByUserId', ApprovalParseError));
  const rationale = readString(value, 'rationale', ApprovalParseError);
  return { status, decidedAtIso, decidedByUserId, rationale };
}

function assertNoDecisionFields(value: Record<string, unknown>): void {
  if (value['decidedAtIso'] !== undefined) {
    throw new ApprovalParseError('Pending approvals must not include decision fields.');
  }
  if (value['decidedByUserId'] !== undefined) {
    throw new ApprovalParseError('Pending approvals must not include decision fields.');
  }
  if (value['rationale'] !== undefined) {
    throw new ApprovalParseError('Pending approvals must not include decision fields.');
  }
}

function parseEscalationChain(value: unknown): readonly EscalationStepV1[] {
  if (!Array.isArray(value)) {
    throw new ApprovalParseError('escalationChain must be an array.');
  }
  return value.map((s, idx) => parseEscalationStep(s, `escalationChain[${idx}]`));
}

function parseEscalationStep(value: unknown, pathLabel: string): EscalationStepV1 {
  if (!isRecord(value)) throw new ApprovalParseError(`${pathLabel} must be an object.`);
  const stepOrder = readInteger(value, 'stepOrder', ApprovalParseError);
  const escalateToUserId = readString(value, 'escalateToUserId', ApprovalParseError);
  const afterHours = readInteger(value, 'afterHours', ApprovalParseError);
  return { stepOrder, escalateToUserId, afterHours };
}

function parseOptionalId<T>(
  value: Record<string, unknown>,
  key: string,
  ctor: (raw: string) => T,
): T | undefined {
  const raw = readOptionalString(value, key, ApprovalParseError);
  return raw === undefined ? undefined : ctor(raw);
}

function isApprovalDecision(value: string): value is ApprovalDecision {
  return value === 'Approved' || value === 'Denied' || value === 'RequestChanges';
}

function isApprovalStatus(value: string): value is ApprovalStatus {
  return value === 'Pending' || isApprovalDecision(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
