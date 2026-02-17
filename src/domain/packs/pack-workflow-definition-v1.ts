import {
  PackId,
  WorkflowDefinitionId,
  type PackId as PackIdType,
  type WorkflowDefinitionId as WorkflowDefinitionIdType,
} from '../primitives/index.js';
import type { ExecutionTier } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowStepV1 = Readonly<{
  stepId: string;
  name: string;
  actionType: string;
}>;

export type PackWorkflowDefinitionV1 = Readonly<{
  schemaVersion: 1;
  definitionId: WorkflowDefinitionIdType;
  packId: PackIdType;
  namespace: string;
  steps: readonly WorkflowStepV1[];
  triggerType: string;
  executionTier: ExecutionTier;
}>;

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class PackWorkflowDefinitionParseError extends Error {
  public override readonly name = 'PackWorkflowDefinitionParseError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const EXECUTION_TIERS: readonly string[] = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];

export function parsePackWorkflowDefinitionV1(value: unknown): PackWorkflowDefinitionV1 {
  if (!isRecord(value)) {
    throw new PackWorkflowDefinitionParseError('Pack workflow definition must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new PackWorkflowDefinitionParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const definitionId = readString(value, 'definitionId');
  const packId = readString(value, 'packId');
  const namespace = readString(value, 'namespace');
  const triggerType = readString(value, 'triggerType');

  const executionTier = readString(value, 'executionTier');
  if (!EXECUTION_TIERS.includes(executionTier)) {
    throw new PackWorkflowDefinitionParseError(
      `Invalid executionTier: "${executionTier}". Must be one of: ${EXECUTION_TIERS.join(', ')}.`,
    );
  }

  const stepsRaw = value['steps'];
  if (!Array.isArray(stepsRaw)) {
    throw new PackWorkflowDefinitionParseError('steps must be an array.');
  }
  const steps = stepsRaw.map((s, i) => parseWorkflowStep(s, i));

  return {
    schemaVersion: 1,
    definitionId: WorkflowDefinitionId(definitionId),
    packId: PackId(packId),
    namespace,
    steps,
    triggerType,
    executionTier: executionTier as ExecutionTier,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parseWorkflowStep(value: unknown, index: number): WorkflowStepV1 {
  if (!isRecord(value)) {
    throw new PackWorkflowDefinitionParseError(`steps[${index}] must be an object.`);
  }

  const stepId = readString(value, 'stepId');
  const name = readString(value, 'name');
  const actionType = readString(value, 'actionType');

  return { stepId, name, actionType };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackWorkflowDefinitionParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new PackWorkflowDefinitionParseError(`${key} must be an integer.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
