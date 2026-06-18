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

export type ApprovalPacketArtifactRole = 'primary' | 'supporting' | 'decision-evidence';

export type ApprovalPacketArtifactRefV1 = Readonly<{
  artifactId: string;
  title: string;
  mimeType: string;
  role: ApprovalPacketArtifactRole;
  evidenceId?: EvidenceIdType;
  uri?: string;
  sha256?: string;
  thumbnailUri?: string;
  fullUri?: string;
  thumbnailUrl?: string | null;
  fullUrl?: string | null;
  evidenceKind?: 'Artifact' | 'Snapshot' | 'Diff' | 'Log';
  sourceFamily?: string;
  sourceId?: string;
  dataClass?: string;
  retention?: string;
  displayPolicy?: string;
  caption?: string;
  capturedAtIso?: string;
  capturedAtUtc?: string;
  runId?: string;
  approvalId?: string;
  messageId?: string;
  correlationId?: string;
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

export type ApprovalPacketOperatorBriefV1 = Readonly<{
  schemaVersion?: 1;
  action: string;
  whyGated: string;
  whatApprovingAllows: readonly string[];
  whatApprovingDoesNotAllow: readonly string[];
  risk: string;
  rollback: string;
  recommendation: string;
  userVisibleConsequence: string;
  authority?: string;
}>;

export type ApprovalPacketDecisionViewKind =
  | 'recommendation'
  | 'flow'
  | 'risk'
  | 'scope'
  | 'evidence'
  | 'operator-input'
  | 'custom';

export type ApprovalPacketDecisionViewItemTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'critical';

export type ApprovalPacketDecisionViewItemV1 = Readonly<{
  label: string;
  value: string;
  tone?: ApprovalPacketDecisionViewItemTone;
}>;

export type ApprovalPacketDecisionViewV1 = Readonly<{
  id: string;
  label: string;
  stance: string;
  summary: string;
  bullets: readonly string[];
  kind?: ApprovalPacketDecisionViewKind;
  diagram?: string;
  items?: readonly ApprovalPacketDecisionViewItemV1[];
}>;

export type ApprovalPacketV1 = Readonly<{
  schemaVersion: 1;
  packetId: string;
  operatorBrief?: ApprovalPacketOperatorBriefV1;
  decisionViews?: readonly ApprovalPacketDecisionViewV1[];
  artifacts: readonly ApprovalPacketArtifactRefV1[];
  visualEvidenceTimeline?: readonly ApprovalPacketArtifactRefV1[];
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
  const operatorBrief =
    record['operatorBrief'] === undefined ? undefined : parseOperatorBrief(record['operatorBrief']);
  const decisionViews =
    record['decisionViews'] === undefined
      ? undefined
      : parseNonEmptyArray(record['decisionViews'], 'decisionViews', parseDecisionView);
  const visualEvidenceTimeline =
    record['visualEvidenceTimeline'] === undefined
      ? undefined
      : parseNonEmptyArray(
          record['visualEvidenceTimeline'],
          'visualEvidenceTimeline',
          parseArtifactRef,
        );

  if (!artifacts.some((artifact) => artifact.role === 'primary')) {
    throw new ApprovalPacketParseError('artifacts must include a primary artifact.');
  }

  return deepFreeze({
    schemaVersion: 1,
    packetId,
    ...(operatorBrief ? { operatorBrief } : {}),
    ...(decisionViews ? { decisionViews } : {}),
    artifacts,
    ...(visualEvidenceTimeline ? { visualEvidenceTimeline } : {}),
    reviewDocs,
    requestedCapabilities,
    planScope,
  });
}

function parseArtifactRef(value: unknown, pathLabel: string): ApprovalPacketArtifactRefV1 {
  const record = readRecord(value, pathLabel, ApprovalPacketParseError);
  const role = readString(record, 'role', ApprovalPacketParseError);
  if (role !== 'primary' && role !== 'supporting' && role !== 'decision-evidence') {
    throw new ApprovalPacketParseError(
      `${pathLabel}.role must be primary, supporting, or decision-evidence.`,
    );
  }
  const evidenceIdRaw = readOptionalNonEmpty(record, 'evidenceId', pathLabel);
  const uri = readOptionalNonEmpty(record, 'uri', pathLabel);
  const sha256 = readOptionalNonEmpty(record, 'sha256', pathLabel);
  const thumbnailUri = readOptionalNonEmpty(record, 'thumbnailUri', pathLabel);
  const fullUri = readOptionalNonEmpty(record, 'fullUri', pathLabel);
  const thumbnailUrl = readOptionalNullableNonEmpty(record, 'thumbnailUrl', pathLabel);
  const fullUrl = readOptionalNullableNonEmpty(record, 'fullUrl', pathLabel);
  const evidenceKind = readOptionalEvidenceKind(record, 'evidenceKind', pathLabel);
  const sourceFamily = readOptionalNonEmpty(record, 'sourceFamily', pathLabel);
  const sourceId = readOptionalNonEmpty(record, 'sourceId', pathLabel);
  const dataClass = readOptionalNonEmpty(record, 'dataClass', pathLabel);
  const retention = readOptionalNonEmpty(record, 'retention', pathLabel);
  const displayPolicy = readOptionalNonEmpty(record, 'displayPolicy', pathLabel);
  const caption = readOptionalNonEmpty(record, 'caption', pathLabel);
  const capturedAtIso = readOptionalNonEmpty(record, 'capturedAtIso', pathLabel);
  const capturedAtUtc = readOptionalNonEmpty(record, 'capturedAtUtc', pathLabel);
  const runId = readOptionalNonEmpty(record, 'runId', pathLabel);
  const approvalId = readOptionalNonEmpty(record, 'approvalId', pathLabel);
  const messageId = readOptionalNonEmpty(record, 'messageId', pathLabel);
  const correlationId = readOptionalNonEmpty(record, 'correlationId', pathLabel);
  return {
    artifactId: readNonEmpty(record, 'artifactId', pathLabel),
    title: readNonEmpty(record, 'title', pathLabel),
    mimeType: readNonEmpty(record, 'mimeType', pathLabel),
    role,
    ...(evidenceIdRaw ? { evidenceId: EvidenceId(evidenceIdRaw) } : {}),
    ...(uri ? { uri } : {}),
    ...(sha256 ? { sha256 } : {}),
    ...(thumbnailUri ? { thumbnailUri } : {}),
    ...(fullUri ? { fullUri } : {}),
    ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
    ...(fullUrl !== undefined ? { fullUrl } : {}),
    ...(evidenceKind ? { evidenceKind } : {}),
    ...(sourceFamily ? { sourceFamily } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(dataClass ? { dataClass } : {}),
    ...(retention ? { retention } : {}),
    ...(displayPolicy ? { displayPolicy } : {}),
    ...(caption ? { caption } : {}),
    ...(capturedAtIso ? { capturedAtIso } : {}),
    ...(capturedAtUtc ? { capturedAtUtc } : {}),
    ...(runId ? { runId } : {}),
    ...(approvalId ? { approvalId } : {}),
    ...(messageId ? { messageId } : {}),
    ...(correlationId ? { correlationId } : {}),
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

function parseOperatorBrief(value: unknown): ApprovalPacketOperatorBriefV1 {
  const record = readRecord(value, 'operatorBrief', ApprovalPacketParseError);
  const schemaVersion =
    record['schemaVersion'] === undefined
      ? undefined
      : readInteger(record, 'schemaVersion', ApprovalPacketParseError);
  if (schemaVersion !== undefined && schemaVersion !== 1) {
    throw new ApprovalPacketParseError('operatorBrief.schemaVersion must be 1 when present.');
  }
  const authority = readOptionalNonEmpty(record, 'authority', 'operatorBrief');
  return {
    ...(schemaVersion ? { schemaVersion: 1 as const } : {}),
    action: readNonEmpty(record, 'action', 'operatorBrief'),
    whyGated: readNonEmpty(record, 'whyGated', 'operatorBrief'),
    whatApprovingAllows: parseStringIds(
      record['whatApprovingAllows'],
      'operatorBrief.whatApprovingAllows',
    ),
    whatApprovingDoesNotAllow: parseStringIds(
      record['whatApprovingDoesNotAllow'],
      'operatorBrief.whatApprovingDoesNotAllow',
    ),
    risk: readNonEmpty(record, 'risk', 'operatorBrief'),
    rollback: readNonEmpty(record, 'rollback', 'operatorBrief'),
    recommendation: readNonEmpty(record, 'recommendation', 'operatorBrief'),
    userVisibleConsequence: readNonEmpty(record, 'userVisibleConsequence', 'operatorBrief'),
    ...(authority ? { authority } : {}),
  };
}

function parseDecisionView(value: unknown, pathLabel: string): ApprovalPacketDecisionViewV1 {
  const record = readRecord(value, pathLabel, ApprovalPacketParseError);
  const kind = readOptionalDecisionViewKind(record, 'kind', pathLabel);
  const diagram = readOptionalNonEmpty(record, 'diagram', pathLabel);
  const items =
    record['items'] === undefined
      ? undefined
      : parseNonEmptyArray(record['items'], `${pathLabel}.items`, parseDecisionViewItem);
  return {
    id: readNonEmpty(record, 'id', pathLabel),
    label: readNonEmpty(record, 'label', pathLabel),
    stance: readNonEmpty(record, 'stance', pathLabel),
    summary: readNonEmpty(record, 'summary', pathLabel),
    bullets: parseStringIds(record['bullets'], `${pathLabel}.bullets`),
    ...(kind ? { kind } : {}),
    ...(diagram ? { diagram } : {}),
    ...(items ? { items } : {}),
  };
}

function parseDecisionViewItem(
  value: unknown,
  pathLabel: string,
): ApprovalPacketDecisionViewItemV1 {
  const record = readRecord(value, pathLabel, ApprovalPacketParseError);
  const tone = readOptionalDecisionViewItemTone(record, 'tone', pathLabel);
  return {
    label: readNonEmpty(record, 'label', pathLabel),
    value: readNonEmpty(record, 'value', pathLabel),
    ...(tone ? { tone } : {}),
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
  const value = readString(
    record,
    key,
    ApprovalPacketParseError,
    prefix ? { path: prefix } : undefined,
  );
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

function readOptionalNullableNonEmpty(
  record: Record<string, unknown>,
  key: string,
  prefix: string,
): string | null | undefined {
  if (!(key in record)) return undefined;
  if (record[key] === null) return null;
  const value = readOptionalString(record, key, ApprovalPacketParseError);
  if (value?.trim() === '') {
    throw new ApprovalPacketParseError(`${prefix}.${key} must be non-empty when present.`);
  }
  return value;
}

function readOptionalEvidenceKind(
  record: Record<string, unknown>,
  key: string,
  prefix: string,
): ApprovalPacketArtifactRefV1['evidenceKind'] | undefined {
  const value = readOptionalNonEmpty(record, key, prefix);
  if (value === undefined) return undefined;
  if (value === 'Artifact' || value === 'Snapshot' || value === 'Diff' || value === 'Log') {
    return value;
  }
  throw new ApprovalPacketParseError(`${prefix}.${key} must be Artifact, Snapshot, Diff, or Log.`);
}

function readOptionalDecisionViewKind(
  record: Record<string, unknown>,
  key: string,
  prefix: string,
): ApprovalPacketDecisionViewKind | undefined {
  const value = readOptionalNonEmpty(record, key, prefix);
  if (value === undefined) return undefined;
  if (
    value === 'recommendation' ||
    value === 'flow' ||
    value === 'risk' ||
    value === 'scope' ||
    value === 'evidence' ||
    value === 'operator-input' ||
    value === 'custom'
  ) {
    return value;
  }
  throw new ApprovalPacketParseError(
    `${prefix}.${key} must be recommendation, flow, risk, scope, evidence, operator-input, or custom.`,
  );
}

function readOptionalDecisionViewItemTone(
  record: Record<string, unknown>,
  key: string,
  prefix: string,
): ApprovalPacketDecisionViewItemTone | undefined {
  const value = readOptionalNonEmpty(record, key, prefix);
  if (value === undefined) return undefined;
  if (
    value === 'neutral' ||
    value === 'info' ||
    value === 'success' ||
    value === 'warning' ||
    value === 'critical'
  ) {
    return value;
  }
  throw new ApprovalPacketParseError(
    `${prefix}.${key} must be neutral, info, success, warning, or critical.`,
  );
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
