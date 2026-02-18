import {
  TicketId,
  TenantId,
  type TicketId as TicketIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readEnum,
  readInteger,
  readIsoString,
  readOptionalEnum,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Ticket', TicketParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', TicketParseError);
  if (schemaVersion !== 1) {
    throw new TicketParseError('schemaVersion must be 1.');
  }

  const ticketId = TicketId(readString(record, 'ticketId', TicketParseError));
  const tenantId = TenantId(readString(record, 'tenantId', TicketParseError));
  const subject = readString(record, 'subject', TicketParseError);
  const status = readEnum(record, 'status', TICKET_STATUSES, TicketParseError);
  const priority = readOptionalEnum(record, 'priority', TICKET_PRIORITIES, TicketParseError);
  const assigneeId = readOptionalString(record, 'assigneeId', TicketParseError);
  const createdAtIso = readIsoString(record, 'createdAtIso', TicketParseError);
  const externalRefs = readOptionalExternalRefs(record);

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
