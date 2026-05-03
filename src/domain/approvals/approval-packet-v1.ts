import {
  EffectId,
  EvidenceId,
  PlanId,
  type EffectId as EffectIdType,
  type EvidenceId as EvidenceIdType,
  type PlanId as PlanIdType,
} from '../primitives/index.js';
import {
  readInteger,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type ApprovalPacketArtifactRole = 'primary' | 'supporting';

export type ApprovalPacketArtifactRefV1 = Readonly<{
  artifactId: string;
  title: string;
  mimeType: string;
  role: ApprovalPacketArtifactRole;
  evidenceId?: EvidenceIdType;
  uri?: string;
  sha256?: string;
}>;

export type ApprovalPacketReviewDocV1 = Readonly<{
  title: string;
  markdown: string;
}>;

export type ApprovalPacketRequestedCapabilityV1 = Readonly<{
  capabilityId: string;
  reason: string;
  required: boolean;
}>;

export type ApprovalPacketPlanScopeV1 = Readonly<{
  planId: PlanIdType;
  summary: string;
  actionIds: readonly string[];
  plannedEffectIds: readonly EffectIdType[];
}>;

export type ApprovalPacketV1 = Readonly<{
  schemaVersion: 1;
  packetId: string;
  artifacts: readonly ApprovalPacketArtifactRefV1[];
  reviewDocs: readonly ApprovalPacketReviewDocV1[];
  requestedCapabilities: readonly ApprovalPacketRequestedCapabilityV1[];
  planScope: ApprovalPacketPlanScopeV1;
}>;

export class ApprovalPacketParseError extends Error {
  public override readonly name = 'ApprovalPacketParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseApprovalPacketV1(value: unknown): ApprovalPacketV1 {
  const record = readRecord(value, 'ApprovalPacket', ApprovalPacketParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', ApprovalPacketParseError);
  if (schemaVersion !== 1) {
    throw new ApprovalPacketParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const packetId = readNonEmpty(record, 'packetId');
  const artifacts = parseNonEmptyArray(record['artifacts'], 'artifacts', parseArtifactRef);
  const reviewDocs = parseNonEmptyArray(record['reviewDocs'], 'reviewDocs', parseReviewDoc);
  const requestedCapabilities = parseNonEmptyArray(
    record['requestedCapabilities'],
    'requestedCapabilities',
    parseRequestedCapability,
  );
  const planScope = parsePlanScope(record['planScope']);

  if (!artifacts.some((artifact) => artifact.role === 'primary')) {
    throw new ApprovalPacketParseError('artifacts must include a primary artifact.');
  }

  return deepFreeze({
    schemaVersion: 1,
    packetId,
    artifacts,
    reviewDocs,
    requestedCapabilities,
    planScope,
  });
}

function parseArtifactRef(value: unknown, pathLabel: string): ApprovalPacketArtifactRefV1 {
  const record = readRecord(value, pathLabel, ApprovalPacketParseError);
  const role = readString(record, 'role', ApprovalPacketParseError);
  if (role !== 'primary' && role !== 'supporting') {
    throw new ApprovalPacketParseError(`${pathLabel}.role must be primary or supporting.`);
  }
  const evidenceIdRaw = readOptionalNonEmpty(record, 'evidenceId', pathLabel);
  const uri = readOptionalNonEmpty(record, 'uri', pathLabel);
  const sha256 = readOptionalNonEmpty(record, 'sha256', pathLabel);
  return {
    artifactId: readNonEmpty(record, 'artifactId', pathLabel),
    title: readNonEmpty(record, 'title', pathLabel),
    mimeType: readNonEmpty(record, 'mimeType', pathLabel),
    role,
    ...(evidenceIdRaw ? { evidenceId: EvidenceId(evidenceIdRaw) } : {}),
    ...(uri ? { uri } : {}),
    ...(sha256 ? { sha256 } : {}),
  };
}

function parseReviewDoc(value: unknown, pathLabel: string): ApprovalPacketReviewDocV1 {
  const record = readRecord(value, pathLabel, ApprovalPacketParseError);
  return {
    title: readNonEmpty(record, 'title', pathLabel),
    markdown: readNonEmpty(record, 'markdown', pathLabel),
  };
}

function parseRequestedCapability(
  value: unknown,
  pathLabel: string,
): ApprovalPacketRequestedCapabilityV1 {
  const record = readRecord(value, pathLabel, ApprovalPacketParseError);
  const required = record['required'];
  if (typeof required !== 'boolean') {
    throw new ApprovalPacketParseError(`${pathLabel}.required must be a boolean.`);
  }
  return {
    capabilityId: readNonEmpty(record, 'capabilityId', pathLabel),
    reason: readNonEmpty(record, 'reason', pathLabel),
    required,
  };
}

function parsePlanScope(value: unknown): ApprovalPacketPlanScopeV1 {
  const record = readRecord(value, 'planScope', ApprovalPacketParseError);
  const actionIds = parseStringIds(record['actionIds'], 'planScope.actionIds');
  const plannedEffectIds = parseStringIds(record['plannedEffectIds'], 'planScope.plannedEffectIds');
  return {
    planId: PlanId(readNonEmpty(record, 'planId', 'planScope')),
    summary: readNonEmpty(record, 'summary', 'planScope'),
    actionIds,
    plannedEffectIds: plannedEffectIds.map((id) => EffectId(id)),
  };
}

function parseStringIds(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApprovalPacketParseError(`${field} must be a non-empty array.`);
  }
  const ids = value.map((item, idx) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new ApprovalPacketParseError(`${field}[${idx}] must be a non-empty string.`);
    }
    return item;
  });
  if (new Set(ids).size !== ids.length) {
    throw new ApprovalPacketParseError(`${field} must not contain duplicate values.`);
  }
  return Object.freeze(ids);
}

function parseNonEmptyArray<T>(
  value: unknown,
  field: string,
  parseItem: (item: unknown, pathLabel: string) => T,
): readonly T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApprovalPacketParseError(`${field} must be a non-empty array.`);
  }
  return Object.freeze(value.map((item, idx) => parseItem(item, `${field}[${idx}]`)));
}

function readNonEmpty(record: Record<string, unknown>, key: string, prefix?: string): string {
  const value = readString(record, key, ApprovalPacketParseError);
  if (value.trim() === '') {
    throw new ApprovalPacketParseError(`${prefix ? `${prefix}.` : ''}${key} must be non-empty.`);
  }
  return value;
}

function readOptionalNonEmpty(
  record: Record<string, unknown>,
  key: string,
  prefix: string,
): string | undefined {
  const value = readOptionalString(record, key, ApprovalPacketParseError);
  if (value?.trim() === '') {
    throw new ApprovalPacketParseError(`${prefix}.${key} must be non-empty.`);
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}
