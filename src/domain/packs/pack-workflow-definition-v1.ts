import {
  PackId,
  WorkflowDefinitionId,
  type PackId as PackIdType,
  type WorkflowDefinitionId as WorkflowDefinitionIdType,
} from '../primitives/index.js';
import type { ExecutionTier } from '../primitives/index.js';
import { readInteger, readRecord, readString } from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Pack workflow definition', PackWorkflowDefinitionParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PackWorkflowDefinitionParseError);
  if (schemaVersion !== 1) {
    throw new PackWorkflowDefinitionParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const definitionId = readString(record, 'definitionId', PackWorkflowDefinitionParseError);
  const packId = readString(record, 'packId', PackWorkflowDefinitionParseError);
  const namespace = readString(record, 'namespace', PackWorkflowDefinitionParseError);
  const triggerType = readString(record, 'triggerType', PackWorkflowDefinitionParseError);

  const executionTier = readString(record, 'executionTier', PackWorkflowDefinitionParseError);
  if (!EXECUTION_TIERS.includes(executionTier)) {
    throw new PackWorkflowDefinitionParseError(
      `Invalid executionTier: "${executionTier}". Must be one of: ${EXECUTION_TIERS.join(', ')}.`,
    );
  }

  const stepsRaw = record['steps'];
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
  const record = readRecord(value, `steps[${index}]`, PackWorkflowDefinitionParseError);

  const stepId = readString(record, 'stepId', PackWorkflowDefinitionParseError);
  const name = readString(record, 'name', PackWorkflowDefinitionParseError);
  const actionType = readString(record, 'actionType', PackWorkflowDefinitionParseError);

  return { stepId, name, actionType };
}
