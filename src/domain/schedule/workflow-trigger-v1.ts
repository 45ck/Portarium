import {
  TriggerDefinitionId,
  WorkflowId,
  WorkspaceId,
  type TriggerDefinitionId as TriggerDefinitionIdType,
  type WorkflowId as WorkflowIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export type TriggerKind = 'Cron' | 'Webhook' | 'DomainEvent' | 'Manual';

export type CronSchedule = Readonly<{ expression: string }>;
export type WebhookTriggerConfig = Readonly<{ endpointPath: string }>;
export type DomainEventTriggerConfig = Readonly<{ eventType: string }>;
export type ManualTriggerConfig = Readonly<{ label?: string }>;

export type TriggerConfig =
  | CronSchedule
  | WebhookTriggerConfig
  | DomainEventTriggerConfig
  | ManualTriggerConfig;

export type WorkflowTriggerV1 = Readonly<{
  schemaVersion: 1;
  triggerDefinitionId: TriggerDefinitionIdType;
  workspaceId: WorkspaceIdType;
  workflowId: WorkflowIdType;
  kind: TriggerKind;
  config: TriggerConfig;
  active: boolean;
  createdAtIso: string;
}>;

export class WorkflowTriggerParseError extends Error {
  public override readonly name = 'WorkflowTriggerParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseWorkflowTriggerV1(value: unknown): WorkflowTriggerV1 {
  if (!isRecord(value)) {
    throw new WorkflowTriggerParseError('WorkflowTrigger must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new WorkflowTriggerParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const triggerDefinitionId = TriggerDefinitionId(readString(value, 'triggerDefinitionId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const workflowId = WorkflowId(readString(value, 'workflowId'));

  const kindRaw = readString(value, 'kind');
  if (!isTriggerKind(kindRaw)) {
    throw new WorkflowTriggerParseError('kind must be one of: Cron, Webhook, DomainEvent, Manual.');
  }

  if (typeof value['active'] !== 'boolean') {
    throw new WorkflowTriggerParseError('active must be a boolean.');
  }
  const active: boolean = value['active'];

  const config = parseTriggerConfig(value['config'], kindRaw);

  const createdAtIso = readString(value, 'createdAtIso');
  parseIsoString(createdAtIso, 'createdAtIso');

  return {
    schemaVersion: 1,
    triggerDefinitionId,
    workspaceId,
    workflowId,
    kind: kindRaw,
    config,
    active,
    createdAtIso,
  };
}

function parseTriggerConfig(raw: unknown, kind: TriggerKind): TriggerConfig {
  if (!isRecord(raw)) {
    throw new WorkflowTriggerParseError('config must be an object.');
  }

  switch (kind) {
    case 'Cron': {
      const expression = readConfigString(raw, 'expression');
      return { expression };
    }
    case 'Webhook': {
      const endpointPath = readConfigString(raw, 'endpointPath');
      return { endpointPath };
    }
    case 'DomainEvent': {
      const eventType = readConfigString(raw, 'eventType');
      return { eventType };
    }
    case 'Manual': {
      const label = readOptionalString(raw, 'label');
      return {
        ...(label !== undefined ? { label } : {}),
      };
    }
  }
}

function isTriggerKind(value: string): value is TriggerKind {
  return value === 'Cron' || value === 'Webhook' || value === 'DomainEvent' || value === 'Manual';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkflowTriggerParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkflowTriggerParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readConfigString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkflowTriggerParseError(`config.${key} must be a non-empty string.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new WorkflowTriggerParseError(`${key} must be an integer.`);
  }
  return v;
}

function parseIsoString(value: string, label: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new WorkflowTriggerParseError(`${label} must be a valid ISO timestamp.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
