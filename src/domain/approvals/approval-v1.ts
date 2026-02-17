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

export type ApprovalStatus = 'Pending' | ApprovalDecision;

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
  if (!isRecord(value)) throw new ApprovalParseError('Approval must be an object.');

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new ApprovalParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const statusRaw = readString(value, 'status');
  if (!isApprovalStatus(statusRaw)) {
    throw new ApprovalParseError(
      'status must be one of: Pending, Approved, Denied, RequestChanges.',
    );
  }

  if (statusRaw === 'Pending') {
    assertNoDecisionFields(value);
    const base = parseApprovalBaseV1(value);
    return { ...base, status: 'Pending' };
  }

  const base = parseApprovalBaseV1(value);
  const decision = parseDecisionFields(value, statusRaw);
  return { ...base, ...decision };
}

function parseApprovalBaseV1(value: Record<string, unknown>): ApprovalBaseV1 {
  const approvalId = ApprovalId(readString(value, 'approvalId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const runId = RunId(readString(value, 'runId'));
  const planId = PlanId(readString(value, 'planId'));

  const workItemId = parseOptionalId(value, 'workItemId', WorkItemId);
  const assigneeUserId = parseOptionalId(value, 'assigneeUserId', UserId);

  const prompt = readString(value, 'prompt');
  const requestedAtIso = readString(value, 'requestedAtIso');
  const requestedByUserId = UserId(readString(value, 'requestedByUserId'));
  const dueAtIso = readOptionalString(value, 'dueAtIso');

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
  };
}

function parseDecisionFields(
  value: Record<string, unknown>,
  status: ApprovalDecision,
): Pick<ApprovalDecidedV1, 'status' | 'decidedAtIso' | 'decidedByUserId' | 'rationale'> {
  const decidedAtIso = readString(value, 'decidedAtIso');
  const decidedByUserId = UserId(readString(value, 'decidedByUserId'));
  const rationale = readString(value, 'rationale');
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

function parseOptionalId<T>(
  value: Record<string, unknown>,
  key: string,
  ctor: (raw: string) => T,
): T | undefined {
  const raw = readOptionalString(value, key);
  return raw === undefined ? undefined : ctor(raw);
}

function isApprovalDecision(value: string): value is ApprovalDecision {
  return value === 'Approved' || value === 'Denied' || value === 'RequestChanges';
}

function isApprovalStatus(value: string): value is ApprovalStatus {
  return value === 'Pending' || isApprovalDecision(value);
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ApprovalParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ApprovalParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new ApprovalParseError(`${key} must be an integer.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
