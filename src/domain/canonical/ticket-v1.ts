import {
  TicketId,
  TenantId,
  type TicketId as TicketIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
type TicketStatus = (typeof TICKET_STATUSES)[number];

const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export type TicketV1 = Readonly<{
  ticketId: TicketIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  subject: string;
  status: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string;
  createdAtIso: string;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class TicketParseError extends Error {
  public override readonly name = 'TicketParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseTicketV1(value: unknown): TicketV1 {
  if (!isRecord(value)) {
    throw new TicketParseError('Ticket must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new TicketParseError('schemaVersion must be 1.');
  }

  const ticketId = TicketId(readString(value, 'ticketId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const subject = readString(value, 'subject');
  const status = readEnum(value, 'status', TICKET_STATUSES);
  const priority = readOptionalEnum(value, 'priority', TICKET_PRIORITIES);
  const assigneeId = readOptionalString(value, 'assigneeId');
  const createdAtIso = readString(value, 'createdAtIso');
  const externalRefs = readOptionalExternalRefs(value);

  return {
    ticketId,
    tenantId,
    schemaVersion: 1,
    subject,
    status,
    ...(priority ? { priority } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    createdAtIso,
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new TicketParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new TicketParseError(`${key} must be a non-empty string when provided.`);
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
    throw new TicketParseError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return v as T;
}

function readOptionalEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new TicketParseError(`${key} must be one of: ${allowed.join(', ')} when provided.`);
  }
  return v as T;
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new TicketParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
