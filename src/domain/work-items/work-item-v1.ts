import type { ExternalObjectRef } from '../canonical/external-object-ref.js';
import { parseExternalObjectRef } from '../canonical/external-object-ref.js';
import {
  ApprovalId,
  EvidenceId,
  RunId,
  UserId,
  WorkItemId,
  WorkflowId,
  WorkspaceId,
  type ApprovalId as ApprovalIdType,
  type EvidenceId as EvidenceIdType,
  type RunId as RunIdType,
  type UserId as UserIdType,
  type WorkItemId as WorkItemIdType,
  type WorkflowId as WorkflowIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  assertNotBefore,
  parseNonEmptyString,
  readInteger,
  readIsoString,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type WorkItemStatus = 'Open' | 'InProgress' | 'Blocked' | 'Resolved' | 'Closed';

export type WorkItemSlaV1 = Readonly<{
  dueAtIso?: string;
}>;

export type WorkItemLinksV1 = Readonly<{
  externalRefs?: readonly ExternalObjectRef[];
  runIds?: readonly RunIdType[];
  workflowIds?: readonly WorkflowIdType[];
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
  const record = readRecord(value, 'WorkItem', WorkItemParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', WorkItemParseError);
  if (schemaVersion !== 1) {
    throw new WorkItemParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const workItemId = WorkItemId(readString(record, 'workItemId', WorkItemParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', WorkItemParseError));
  const createdAtIso = readIsoString(record, 'createdAtIso', WorkItemParseError);
  const createdByUserId = UserId(readString(record, 'createdByUserId', WorkItemParseError));

  const title = readString(record, 'title', WorkItemParseError);

  const statusRaw = readString(record, 'status', WorkItemParseError);
  if (!isWorkItemStatus(statusRaw)) {
    throw new WorkItemParseError(
      'status must be one of: Open, InProgress, Blocked, Resolved, Closed.',
    );
  }

  const ownerUserIdRaw = readOptionalString(record, 'ownerUserId', WorkItemParseError);
  const ownerUserId = ownerUserIdRaw === undefined ? undefined : UserId(ownerUserIdRaw);

  const slaRaw = record['sla'];
  const sla = slaRaw === undefined ? undefined : parseWorkItemSlaV1(slaRaw, createdAtIso);

  const linksRaw = record['links'];
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

function parseWorkItemSlaV1(value: unknown, createdAtIso: string): WorkItemSlaV1 {
  const record = readRecord(value, 'sla', WorkItemParseError);
  const dueAtIso = readOptionalIsoString(record, 'dueAtIso', WorkItemParseError);
  if (dueAtIso !== undefined) {
    assertNotBefore(createdAtIso, dueAtIso, WorkItemParseError, {
      anchorLabel: 'createdAtIso',
      laterLabel: 'sla.dueAtIso',
    });
  }
  return {
    ...(dueAtIso ? { dueAtIso } : {}),
  };
}

function parseWorkItemLinksV1(value: unknown): WorkItemLinksV1 {
  const record = readRecord(value, 'links', WorkItemParseError);

  const externalRefsRaw = record['externalRefs'];
  const externalRefs =
    externalRefsRaw === undefined ? undefined : parseExternalRefs(externalRefsRaw);

  const runIdsRaw = record['runIds'];
  const runIds = runIdsRaw === undefined ? undefined : parseIds(runIdsRaw, 'runIds', RunId);

  const workflowIdsRaw = record['workflowIds'];
  const workflowIds =
    workflowIdsRaw === undefined ? undefined : parseIds(workflowIdsRaw, 'workflowIds', WorkflowId);

  const approvalIdsRaw = record['approvalIds'];
  const approvalIds =
    approvalIdsRaw === undefined ? undefined : parseIds(approvalIdsRaw, 'approvalIds', ApprovalId);

  const evidenceIdsRaw = record['evidenceIds'];
  const evidenceIds =
    evidenceIdsRaw === undefined ? undefined : parseIds(evidenceIdsRaw, 'evidenceIds', EvidenceId);

  return {
    ...(externalRefs ? { externalRefs } : {}),
    ...(runIds ? { runIds } : {}),
    ...(workflowIds ? { workflowIds } : {}),
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
    const raw = parseNonEmptyString(v, `links.${label}[${idx}]`, WorkItemParseError);
    return ctor(raw);
  });
}

function isWorkItemStatus(value: string): value is WorkItemStatus {
  return (
    value === 'Open' ||
    value === 'InProgress' ||
    value === 'Blocked' ||
    value === 'Resolved' ||
    value === 'Closed'
  );
}
