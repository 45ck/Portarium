import {
  CorrelationId,
  UserId,
  type CorrelationId as CorrelationIdType,
  type UserId as UserIdType,
} from '../primitives/index.js';

export type DomainEventType =
  | 'WorkspaceCreated'
  | 'WorkspaceUpdated'
  | 'WorkspaceDeleted'
  | 'UserAdded'
  | 'UserRemoved'
  | 'CredentialGrantIssued'
  | 'CredentialGrantRotated'
  | 'CredentialGrantRevoked'
  | 'WorkflowCreated'
  | 'WorkflowUpdated'
  | 'WorkflowActivated'
  | 'WorkflowDeactivated'
  | 'RunStarted'
  | 'RunSucceeded'
  | 'RunFailed'
  | 'RunCancelled'
  | 'PolicyCreated'
  | 'PolicyUpdated'
  | 'ApprovalRequested'
  | 'ApprovalGranted'
  | 'ApprovalDenied'
  | 'AdapterRegistered'
  | 'AdapterEnabled'
  | 'AdapterDisabled'
  | 'PortRegistered'
  | 'PortEnabled'
  | 'PortDisabled'
  | 'Unknown';

export type DomainEventV1 = Readonly<{
  schemaVersion: 1;
  eventId: string;
  eventType: DomainEventType;
  aggregateKind: string;
  aggregateId: string;
  occurredAtIso: string;
  actorUserId?: UserIdType;
  correlationId?: CorrelationIdType;
  payload?: unknown;
}>;

export class DomainEventParseError extends Error {
  public override readonly name = 'DomainEventParseError';

  public constructor(message: string) {
    super(message);
  }
}

const EVENT_TYPES = new Set<DomainEventType>([
  'WorkspaceCreated',
  'WorkspaceUpdated',
  'WorkspaceDeleted',
  'UserAdded',
  'UserRemoved',
  'CredentialGrantIssued',
  'CredentialGrantRotated',
  'CredentialGrantRevoked',
  'WorkflowCreated',
  'WorkflowUpdated',
  'WorkflowActivated',
  'WorkflowDeactivated',
  'RunStarted',
  'RunSucceeded',
  'RunFailed',
  'RunCancelled',
  'PolicyCreated',
  'PolicyUpdated',
  'ApprovalRequested',
  'ApprovalGranted',
  'ApprovalDenied',
  'AdapterRegistered',
  'AdapterEnabled',
  'AdapterDisabled',
  'PortRegistered',
  'PortEnabled',
  'PortDisabled',
  'Unknown',
]);

export function parseDomainEventV1(value: unknown): DomainEventV1 {
  const record = assertRecord(value, 'DomainEventV1');

  const schemaVersion = readNumber(record, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new DomainEventParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const eventId = readString(record, 'eventId');
  const eventType = readEventType(record, 'eventType');
  const aggregateKind = readString(record, 'aggregateKind');
  const aggregateId = readString(record, 'aggregateId');
  const occurredAtIso = readString(record, 'occurredAtIso');
  parseIsoString(occurredAtIso, 'occurredAtIso');

  const actorUserIdRaw = readOptionalString(record, 'actorUserId');
  const actorUserId = actorUserIdRaw === undefined ? undefined : UserId(actorUserIdRaw);

  const correlationIdRaw = readOptionalString(record, 'correlationId');
  const correlationId =
    correlationIdRaw === undefined ? undefined : CorrelationId(correlationIdRaw);

  const payload = readOptionalAnyObject(record, 'payload');

  return {
    schemaVersion: 1,
    eventId,
    eventType,
    aggregateKind,
    aggregateId,
    occurredAtIso,
    ...(actorUserId ? { actorUserId } : {}),
    ...(correlationId ? { correlationId } : {}),
    ...(payload !== undefined ? { payload } : {}),
  };
}

function readEventType(record: Record<string, unknown>, key: string): DomainEventType {
  const raw = readString(record, key);
  if (!EVENT_TYPES.has(raw as DomainEventType)) {
    throw new DomainEventParseError(
      'eventType must be one of: WorkspaceCreated, WorkspaceUpdated, WorkspaceDeleted, UserAdded, UserRemoved, CredentialGrantIssued, CredentialGrantRotated, CredentialGrantRevoked, WorkflowCreated, WorkflowUpdated, WorkflowActivated, WorkflowDeactivated, RunStarted, RunSucceeded, RunFailed, RunCancelled, PolicyCreated, PolicyUpdated, ApprovalRequested, ApprovalGranted, ApprovalDenied, AdapterRegistered, AdapterEnabled, AdapterDisabled, PortRegistered, PortEnabled, PortDisabled, Unknown.',
    );
  }
  return raw as DomainEventType;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new DomainEventParseError(`${key} must be an integer.`);
  }
  return value;
}

function readString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainEventParseError(`${key} must be a non-empty string.`);
  }
  return value;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  return readString(obj, key);
}

function readOptionalAnyObject(record: Record<string, unknown>, key: string): unknown {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainEventParseError(`${key} must be an object when provided.`);
  }
  return value;
}

function parseIsoString(value: string, label: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainEventParseError(`${label} must be a valid ISO timestamp.`);
  }
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new DomainEventParseError(`${label} must be an object.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
