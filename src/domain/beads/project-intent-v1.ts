import {
  PlanId,
  UserId,
  WorkspaceId,
  type PlanId as PlanIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import { readInteger, readIsoString, readRecord, readString } from '../validation/parse-utils.js';

export type IntentTriggerSource = 'Human' | 'Ops' | 'Agent';
export type BeadProposalTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';

const SOURCES = ['Human', 'Ops', 'Agent'] as const;
const TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;

export type ProjectIntentV1 = Readonly<{
  schemaVersion: 1;
  intentId: PlanIdType;
  workspaceId: WorkspaceIdType;
  createdAtIso: string;
  createdByUserId: UserIdType;
  source: IntentTriggerSource;
  prompt: string;
  normalizedGoal: string;
  constraints: readonly string[];
}>;

export type BeadProposalV1 = Readonly<{
  schemaVersion: 1;
  proposalId: string;
  title: string;
  body: string;
  executionTier: BeadProposalTier;
  specRef: string;
  dependsOnProposalIds: readonly string[];
  plannedEffectIds: readonly string[];
}>;

export class ProjectIntentParseError extends Error {
  public override readonly name = 'ProjectIntentParseError';
}

export function parseProjectIntentV1(value: unknown): ProjectIntentV1 {
  const record = readRecord(value, 'ProjectIntent', ProjectIntentParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', ProjectIntentParseError);
  if (schemaVersion !== 1) throw new ProjectIntentParseError('Unsupported schemaVersion.');

  const source = readString(record, 'source', ProjectIntentParseError);
  if (!isSource(source)) throw new ProjectIntentParseError('source is not supported.');

  const constraintsRaw = record['constraints'];
  if (!Array.isArray(constraintsRaw)) {
    throw new ProjectIntentParseError('constraints must be an array.');
  }

  return {
    schemaVersion: 1,
    intentId: PlanId(readString(record, 'intentId', ProjectIntentParseError)),
    workspaceId: WorkspaceId(readString(record, 'workspaceId', ProjectIntentParseError)),
    createdAtIso: readIsoString(record, 'createdAtIso', ProjectIntentParseError),
    createdByUserId: UserId(readString(record, 'createdByUserId', ProjectIntentParseError)),
    source,
    prompt: readString(record, 'prompt', ProjectIntentParseError),
    normalizedGoal: readString(record, 'normalizedGoal', ProjectIntentParseError),
    constraints: constraintsRaw.map((constraint, index) => {
      if (typeof constraint !== 'string' || constraint.trim().length === 0) {
        throw new ProjectIntentParseError(`constraints[${index}] must be a non-empty string.`);
      }
      return constraint.trim();
    }),
  };
}

export function parseBeadProposalV1(value: unknown): BeadProposalV1 {
  const record = readRecord(value, 'BeadProposal', ProjectIntentParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', ProjectIntentParseError);
  if (schemaVersion !== 1) throw new ProjectIntentParseError('Unsupported schemaVersion.');

  const executionTier = readString(record, 'executionTier', ProjectIntentParseError);
  if (!isTier(executionTier)) throw new ProjectIntentParseError('executionTier is not supported.');

  return {
    schemaVersion: 1,
    proposalId: readString(record, 'proposalId', ProjectIntentParseError),
    title: readString(record, 'title', ProjectIntentParseError),
    body: readString(record, 'body', ProjectIntentParseError),
    executionTier,
    specRef: readString(record, 'specRef', ProjectIntentParseError),
    dependsOnProposalIds: readStringArray(record['dependsOnProposalIds'], 'dependsOnProposalIds'),
    plannedEffectIds: readStringArray(record['plannedEffectIds'], 'plannedEffectIds'),
  };
}

function readStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new ProjectIntentParseError(`${label} must be an array.`);
  return value.map((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new ProjectIntentParseError(`${label}[${index}] must be a non-empty string.`);
    }
    return item.trim();
  });
}

function isSource(value: string): value is IntentTriggerSource {
  return (SOURCES as readonly string[]).includes(value);
}

function isTier(value: string): value is BeadProposalTier {
  return (TIERS as readonly string[]).includes(value);
}
