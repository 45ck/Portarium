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

export type WorkflowActionV1 = Readonly<{
  actionId: ActionIdType;
  order: number;
  portFamily: PortFamily;
  operation: string;
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
  if (!isRecord(value)) throw new WorkflowParseError('Workflow must be an object.');

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new WorkflowParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const workflowId = WorkflowId(readString(value, 'workflowId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const name = readString(value, 'name');
  const description = readOptionalString(value, 'description');

  const version = readNumber(value, 'version');
  if (version < 1) throw new WorkflowParseError('version must be >= 1.');

  const active = readBoolean(value, 'active');

  const executionTierRaw = readString(value, 'executionTier');
  if (!isExecutionTier(executionTierRaw)) {
    throw new WorkflowParseError(
      'executionTier must be one of: Auto, Assisted, HumanApprove, ManualOnly.',
    );
  }

  const actionsRaw = value['actions'];
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
  if (!isRecord(value)) throw new WorkflowParseError(`${pathLabel} must be an object.`);

  const actionId = ActionId(readString(value, 'actionId'));
  const order = readNumber(value, 'order');
  if (order < 1) throw new WorkflowParseError(`${pathLabel}.order must be >= 1.`);

  const portFamilyRaw = readString(value, 'portFamily');
  if (!isPortFamily(portFamilyRaw)) {
    throw new WorkflowParseError(`${pathLabel}.portFamily must be a valid PortFamily.`);
  }

  const operation = readString(value, 'operation');

  const executionTierOverrideRaw = readOptionalString(value, 'executionTierOverride');
  if (executionTierOverrideRaw !== undefined) {
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
  }

  return {
    actionId,
    order,
    portFamily: portFamilyRaw,
    operation,
    ...(executionTierOverrideRaw ? { executionTierOverride: executionTierOverrideRaw } : {}),
  };
}

function validateActionOrdering(actions: readonly WorkflowActionV1[]): void {
  // Require strictly ordered, contiguous sequence: 1..N.
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

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkflowParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkflowParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new WorkflowParseError(`${key} must be an integer.`);
  }
  return v;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new WorkflowParseError(`${key} must be a boolean.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
