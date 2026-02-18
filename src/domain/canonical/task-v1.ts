import {
  CanonicalTaskId,
  TenantId,
  type CanonicalTaskId as CanonicalTaskIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readEnum,
  readInteger,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

export type CanonicalTaskV1 = Readonly<{
  canonicalTaskId: CanonicalTaskIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  title: string;
  status: TaskStatus;
  assigneeId?: string;
  dueAtIso?: string;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class TaskParseError extends Error {
  public override readonly name = 'TaskParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseCanonicalTaskV1(value: unknown): CanonicalTaskV1 {
  const record = readRecord(value, 'Task', TaskParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', TaskParseError);
  if (schemaVersion !== 1) {
    throw new TaskParseError('schemaVersion must be 1.');
  }

  const canonicalTaskId = CanonicalTaskId(readString(record, 'canonicalTaskId', TaskParseError));
  const tenantId = TenantId(readString(record, 'tenantId', TaskParseError));
  const title = readString(record, 'title', TaskParseError);
  const status = readEnum(record, 'status', TASK_STATUSES, TaskParseError);
  const assigneeId = readOptionalString(record, 'assigneeId', TaskParseError);
  const dueAtIso = readOptionalIsoString(record, 'dueAtIso', TaskParseError);
  const externalRefs = readOptionalExternalRefs(record);

  return {
    canonicalTaskId,
    tenantId,
    schemaVersion: 1,
    title,
    status,
    ...(assigneeId ? { assigneeId } : {}),
    ...(dueAtIso ? { dueAtIso } : {}),
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new TaskParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}
