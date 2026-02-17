import type { ExternalObjectRef } from '../canonical/external-object-ref.js';
import { parseExternalObjectRef } from '../canonical/external-object-ref.js';
import {
  ApprovalId,
  EvidenceId,
  RunId,
  UserId,
  WorkItemId,
  WorkspaceId,
  type ApprovalId as ApprovalIdType,
  type EvidenceId as EvidenceIdType,
  type RunId as RunIdType,
  type UserId as UserIdType,
  type WorkItemId as WorkItemIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export type WorkItemStatus = 'Open' | 'InProgress' | 'Blocked' | 'Resolved' | 'Closed';

export type WorkItemSlaV1 = Readonly<{
  dueAtIso?: string;
}>;

export type WorkItemLinksV1 = Readonly<{
  externalRefs?: readonly ExternalObjectRef[];
  runIds?: readonly RunIdType[];
  approvalIds?: readonly ApprovalIdType[];
  evidenceIds?: readonly EvidenceIdType[];
}>;

export type WorkItemV1 = Readonly<{
  schemaVersion: 1;
  workItemId: WorkItemIdType;
  workspaceId: WorkspaceIdType;
  createdAtIso: string;
  createdByUserId: UserIdType;
  title: string;
  status: WorkItemStatus;
  ownerUserId?: UserIdType;
  sla?: WorkItemSlaV1;
  links?: WorkItemLinksV1;
}>;

export class WorkItemParseError extends Error {
  public override readonly name = 'WorkItemParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseWorkItemV1(value: unknown): WorkItemV1 {
  if (!isRecord(value)) throw new WorkItemParseError('WorkItem must be an object.');

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new WorkItemParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const workItemId = WorkItemId(readString(value, 'workItemId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const createdAtIso = readString(value, 'createdAtIso');
  const createdByUserId = UserId(readString(value, 'createdByUserId'));

  const title = readString(value, 'title');

  const statusRaw = readString(value, 'status');
  if (!isWorkItemStatus(statusRaw)) {
    throw new WorkItemParseError('status must be one of: Open, InProgress, Blocked, Resolved, Closed.');
  }

  const ownerUserIdRaw = readOptionalString(value, 'ownerUserId');
  const ownerUserId = ownerUserIdRaw === undefined ? undefined : UserId(ownerUserIdRaw);

  const slaRaw = value['sla'];
  const sla = slaRaw === undefined ? undefined : parseWorkItemSlaV1(slaRaw);

  const linksRaw = value['links'];
  const links = linksRaw === undefined ? undefined : parseWorkItemLinksV1(linksRaw);

  return {
    schemaVersion: 1,
    workItemId,
    workspaceId,
    createdAtIso,
    createdByUserId,
    title,
    status: statusRaw,
    ...(ownerUserId ? { ownerUserId } : {}),
    ...(sla ? { sla } : {}),
    ...(links ? { links } : {}),
  };
}

function parseWorkItemSlaV1(value: unknown): WorkItemSlaV1 {
  if (!isRecord(value)) throw new WorkItemParseError('sla must be an object.');
  const dueAtIso = readOptionalString(value, 'dueAtIso');
  return {
    ...(dueAtIso ? { dueAtIso } : {}),
  };
}

function parseWorkItemLinksV1(value: unknown): WorkItemLinksV1 {
  if (!isRecord(value)) throw new WorkItemParseError('links must be an object.');

  const externalRefsRaw = value['externalRefs'];
  const externalRefs =
    externalRefsRaw === undefined ? undefined : parseExternalRefs(externalRefsRaw);

  const runIdsRaw = value['runIds'];
  const runIds = runIdsRaw === undefined ? undefined : parseIds(runIdsRaw, 'runIds', RunId);

  const approvalIdsRaw = value['approvalIds'];
  const approvalIds =
    approvalIdsRaw === undefined ? undefined : parseIds(approvalIdsRaw, 'approvalIds', ApprovalId);

  const evidenceIdsRaw = value['evidenceIds'];
  const evidenceIds =
    evidenceIdsRaw === undefined ? undefined : parseIds(evidenceIdsRaw, 'evidenceIds', EvidenceId);

  return {
    ...(externalRefs ? { externalRefs } : {}),
    ...(runIds ? { runIds } : {}),
    ...(approvalIds ? { approvalIds } : {}),
    ...(evidenceIds ? { evidenceIds } : {}),
  };
}

function parseExternalRefs(value: unknown): readonly ExternalObjectRef[] {
  if (!Array.isArray(value)) {
    throw new WorkItemParseError('links.externalRefs must be an array.');
  }

  return value.map((v, idx) => {
    try {
      return parseExternalObjectRef(v);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new WorkItemParseError(`links.externalRefs[${idx}] invalid: ${message}`);
    }
  });
}

function parseIds<T>(value: unknown, label: string, ctor: (id: string) => T): readonly T[] {
  if (!Array.isArray(value)) {
    throw new WorkItemParseError(`links.${label} must be an array.`);
  }

  return value.map((v, idx) => {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new WorkItemParseError(`links.${label}[${idx}] must be a non-empty string.`);
    }
    return ctor(v);
  });
}

function isWorkItemStatus(value: string): value is WorkItemStatus {
  return value === 'Open' || value === 'InProgress' || value === 'Blocked' || value === 'Resolved' || value === 'Closed';
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkItemParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkItemParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new WorkItemParseError(`${key} must be an integer.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
