import {
  CanonicalTaskId,
  TenantId,
  type CanonicalTaskId as CanonicalTaskIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

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
  if (!isRecord(value)) {
    throw new TaskParseError('Task must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new TaskParseError('schemaVersion must be 1.');
  }

  const canonicalTaskId = CanonicalTaskId(readString(value, 'canonicalTaskId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const title = readString(value, 'title');
  const status = readEnum(value, 'status', TASK_STATUSES);
  const assigneeId = readOptionalString(value, 'assigneeId');
  const dueAtIso = readOptionalString(value, 'dueAtIso');
  const externalRefs = readOptionalExternalRefs(value);

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

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new TaskParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new TaskParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const v = obj[key];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new TaskParseError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return v as T;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
