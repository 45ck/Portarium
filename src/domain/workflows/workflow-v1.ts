import {
  ActionId,
  WorkflowId,
  WorkspaceId,
  isPortFamily,
  type ActionId as ActionIdType,
  type ExecutionTier,
  type PortFamily,
  type WorkflowId as WorkflowIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  isAllowedPortCapability,
  type PortCapability,
} from '../ports/port-family-capabilities-v1.js';
import {
  readBoolean,
  readInteger,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type WorkflowActionV1 = Readonly<{
  actionId: ActionIdType;
  order: number;
  portFamily: PortFamily;
  capability?: PortCapability;
  operation: string;
  inputSchemaRef?: string;
  outputSchemaRef?: string;
  executionTierOverride?: ExecutionTier;
}>;

export type WorkflowV1 = Readonly<{
  schemaVersion: 1;
  workflowId: WorkflowIdType;
  workspaceId: WorkspaceIdType;
  name: string;
  description?: string;
  version: number;
  active: boolean;
  executionTier: ExecutionTier;
  actions: readonly WorkflowActionV1[];
}>;

export class WorkflowParseError extends Error {
  public override readonly name = 'WorkflowParseError';

  public constructor(message: string) {
    super(message);
  }
}

const TIER_RANK: Readonly<Record<ExecutionTier, number>> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
} as const;

export function parseWorkflowV1(value: unknown): WorkflowV1 {
  const record = readRecord(value, 'Workflow', WorkflowParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', WorkflowParseError);
  if (schemaVersion !== 1) {
    throw new WorkflowParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const workflowId = WorkflowId(readString(record, 'workflowId', WorkflowParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', WorkflowParseError));
  const name = readString(record, 'name', WorkflowParseError);
  const description = readOptionalString(record, 'description', WorkflowParseError);

  const version = readInteger(record, 'version', WorkflowParseError);
  if (version < 1) throw new WorkflowParseError('version must be >= 1.');

  const active = readBoolean(record, 'active', WorkflowParseError);
  const executionTierRaw = readString(record, 'executionTier', WorkflowParseError);
  if (!isExecutionTier(executionTierRaw)) {
    throw new WorkflowParseError(
      'executionTier must be one of: Auto, Assisted, HumanApprove, ManualOnly.',
    );
  }

  const actionsRaw = record['actions'];
  if (!Array.isArray(actionsRaw)) {
    throw new WorkflowParseError('actions must be an array.');
  }
  if (actionsRaw.length === 0) {
    throw new WorkflowParseError('actions must be a non-empty array.');
  }

  const actions = actionsRaw.map((a, idx) =>
    parseWorkflowActionV1(a, `actions[${idx}]`, executionTierRaw),
  );

  validateActionOrdering(actions);

  return {
    schemaVersion: 1,
    workflowId,
    workspaceId,
    name,
    ...(description ? { description } : {}),
    version,
    active,
    executionTier: executionTierRaw,
    actions,
  };
}

function parseWorkflowActionV1(
  value: unknown,
  pathLabel: string,
  workflowTier: ExecutionTier,
): WorkflowActionV1 {
  const record = readRecord(value, pathLabel, WorkflowParseError);
  const actionId = ActionId(readString(record, 'actionId', WorkflowParseError));
  const order = parseActionOrder(record, pathLabel);
  const portFamily = parseActionPortFamily(record, pathLabel);
  const capability = parseCapabilityField(record, 'capability', pathLabel, portFamily);
  const operation = parseActionOperation(record, pathLabel, capability);
  const inputSchemaRef = readOptionalString(record, 'inputSchemaRef', WorkflowParseError);
  const outputSchemaRef = readOptionalString(record, 'outputSchemaRef', WorkflowParseError);
  const executionTierOverride = parseExecutionTierOverride(
    record,
    pathLabel,
    workflowTier,
  );

  return {
    actionId,
    order,
    portFamily,
    ...(capability !== undefined ? { capability } : {}),
    operation,
    ...(inputSchemaRef ? { inputSchemaRef } : {}),
    ...(outputSchemaRef ? { outputSchemaRef } : {}),
    ...(executionTierOverride ? { executionTierOverride } : {}),
  };
}

function parseCapabilityField(
  record: Record<string, unknown>,
  key: string,
  pathLabel: string,
  portFamily: PortFamily,
): PortCapability | undefined {
  const capabilityRaw = readOptionalString(record, key, WorkflowParseError);
  if (capabilityRaw === undefined) {
    return undefined;
  }
  if (!isAllowedPortCapability(portFamily, capabilityRaw)) {
    throw new WorkflowParseError(
      `${pathLabel}.${key} '${capabilityRaw}' is not supported for port family ${portFamily}.`,
    );
  }
  return capabilityRaw;
}

function parseActionOrder(record: Record<string, unknown>, pathLabel: string): number {
  const order = readInteger(record, 'order', WorkflowParseError);
  if (order < 1) throw new WorkflowParseError(`${pathLabel}.order must be >= 1.`);
  return order;
}

function parseActionPortFamily(record: Record<string, unknown>, pathLabel: string): PortFamily {
  const portFamilyRaw = readString(record, 'portFamily', WorkflowParseError);
  if (!isPortFamily(portFamilyRaw)) {
    throw new WorkflowParseError(`${pathLabel}.portFamily must be a valid PortFamily.`);
  }
  return portFamilyRaw;
}

function parseActionOperation(
  record: Record<string, unknown>,
  pathLabel: string,
  capability?: PortCapability,
): string {
  const legacyOperation = readOptionalString(record, 'operation', WorkflowParseError);

  if (capability !== undefined && legacyOperation !== undefined && legacyOperation !== capability) {
    throw new WorkflowParseError(
      `${pathLabel}.operation must match capability when both are provided.`,
    );
  }

  if (capability === undefined && legacyOperation === undefined) {
    throw new WorkflowParseError(`${pathLabel} must provide either capability or operation.`);
  }

  if (capability === undefined && !/^[^:\s]+:[^:\s]+$/.test(legacyOperation!)) {
    throw new WorkflowParseError(
      `${pathLabel}.operation must match "entity:verb" format when capability is not provided.`,
    );
  }

  return capability ?? legacyOperation!;
}

function parseExecutionTierOverride(
  record: Record<string, unknown>,
  pathLabel: string,
  workflowTier: ExecutionTier,
): ExecutionTier | undefined {
  const executionTierOverrideRaw = readOptionalString(record, 'executionTierOverride', WorkflowParseError);
  if (executionTierOverrideRaw === undefined) return undefined;

  if (!isExecutionTier(executionTierOverrideRaw)) {
    throw new WorkflowParseError(
      `${pathLabel}.executionTierOverride must be one of: Auto, Assisted, HumanApprove, ManualOnly.`,
    );
  }
  if (TIER_RANK[executionTierOverrideRaw] < TIER_RANK[workflowTier]) {
    throw new WorkflowParseError(
      `${pathLabel}.executionTierOverride cannot be less strict than the workflow executionTier.`,
    );
  }
  return executionTierOverrideRaw;
}

function validateActionOrdering(actions: readonly WorkflowActionV1[]): void {
  for (let i = 0; i < actions.length; i += 1) {
    const expected = i + 1;
    const actual = actions[i]?.order;
    if (actual !== expected) {
      throw new WorkflowParseError(
        `actions must be ordered by 'order' with contiguous values starting at 1 (expected ${expected}, got ${actual}).`,
      );
    }
  }
}

function isExecutionTier(value: string): value is ExecutionTier {
  return (
    value === 'Auto' || value === 'Assisted' || value === 'HumanApprove' || value === 'ManualOnly'
  );
}
