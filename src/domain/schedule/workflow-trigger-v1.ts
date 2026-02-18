import {
  TriggerDefinitionId,
  WorkflowId,
  WorkspaceId,
  type TriggerDefinitionId as TriggerDefinitionIdType,
  type WorkflowId as WorkflowIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  parseNonEmptyString,
  readBoolean,
  readInteger,
  readIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'WorkflowTrigger', WorkflowTriggerParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', WorkflowTriggerParseError);
  if (schemaVersion !== 1) {
    throw new WorkflowTriggerParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const triggerDefinitionId = TriggerDefinitionId(
    readString(record, 'triggerDefinitionId', WorkflowTriggerParseError),
  );
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', WorkflowTriggerParseError));
  const workflowId = WorkflowId(readString(record, 'workflowId', WorkflowTriggerParseError));

  const kindRaw = readString(record, 'kind', WorkflowTriggerParseError);
  if (!isTriggerKind(kindRaw)) {
    throw new WorkflowTriggerParseError('kind must be one of: Cron, Webhook, DomainEvent, Manual.');
  }

  const active = readBoolean(record, 'active', WorkflowTriggerParseError);

  const config = parseTriggerConfig(record['config'], kindRaw);

  const createdAtIso = readIsoString(record, 'createdAtIso', WorkflowTriggerParseError);

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
  const record = readRecord(raw, 'config', WorkflowTriggerParseError);

  switch (kind) {
    case 'Cron': {
      const expression = parseNonEmptyString(
        record['expression'],
        'config.expression',
        WorkflowTriggerParseError,
      );
      return { expression };
    }
    case 'Webhook': {
      const endpointPath = parseNonEmptyString(
        record['endpointPath'],
        'config.endpointPath',
        WorkflowTriggerParseError,
      );
      return { endpointPath };
    }
    case 'DomainEvent': {
      const eventType = parseNonEmptyString(
        record['eventType'],
        'config.eventType',
        WorkflowTriggerParseError,
      );
      return { eventType };
    }
    case 'Manual': {
      const label = readOptionalString(record, 'label', WorkflowTriggerParseError);
      return {
        ...(label !== undefined ? { label } : {}),
      };
    }
  }
}

function isTriggerKind(value: string): value is TriggerKind {
  return value === 'Cron' || value === 'Webhook' || value === 'DomainEvent' || value === 'Manual';
}
