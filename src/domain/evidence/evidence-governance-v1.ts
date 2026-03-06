import { EvidenceId, UserId, WorkspaceId } from '../primitives/index.js';
import type { EvidenceCategory } from './evidence-entry-v1.js';

export type DispositionAction = 'Destroy' | 'DeIdentify' | 'Quarantine';

export type EvidenceRetentionScheduleId = string;
export type LegalHoldId = string;

export type EvidenceDispositionStatus =
  | 'Queued'
  | 'InProgress'
  | 'Completed'
  | 'Failed'
  | 'Blocked';

export type EvidenceRetentionScheduleV1 = Readonly<{
  schemaVersion: 1;
  scheduleId: EvidenceRetentionScheduleId;
  workspaceId: WorkspaceId;
  categories: readonly EvidenceCategory[];
  defaultDisposition: DispositionAction;
  retentionDays: number;
  legalHoldOverrides: boolean;
  createdByUserId: UserId;
  createdAtIso: string;
  updatedAtIso?: string;
  description?: string;
}>;

export type CreateEvidenceRetentionScheduleRequestV1 = Readonly<{
  schemaVersion: 1;
  categories: readonly EvidenceCategory[];
  defaultDisposition: DispositionAction;
  retentionDays: number;
  legalHoldOverrides?: boolean;
  description?: string;
}>;

export type UpdateEvidenceRetentionScheduleRequestV1 = Readonly<{
  categories?: readonly EvidenceCategory[];
  defaultDisposition?: DispositionAction;
  retentionDays?: number;
  legalHoldOverrides?: boolean;
  description?: string;
}>;

export type EvidenceDispositionJobV1 = Readonly<{
  jobId: string;
  evidenceId: EvidenceId;
  action: DispositionAction;
  status: EvidenceDispositionStatus;
  reason?: string;
  startedAtIso?: string;
}>;

export type ExecuteEvidenceDispositionRequestV1 = Readonly<{
  action: DispositionAction;
  reason?: string;
  actorUserId?: UserId;
}>;

export type LegalHoldV1 = Readonly<{
  schemaVersion: 1;
  holdId: LegalHoldId;
  workspaceId: WorkspaceId;
  evidenceCategory: EvidenceCategory;
  description: string;
  active: boolean;
  reason: string;
  createdByUserId: UserId;
  createdAtIso: string;
  expiresAtIso?: string;
}>;

export type CreateLegalHoldRequestV1 = Readonly<{
  schemaVersion: 1;
  evidenceCategory: EvidenceCategory;
  description: string;
  reason: string;
  active: boolean;
  expiresAtIso?: string;
}>;

export type UpdateLegalHoldRequestV1 = Readonly<{
  description?: string;
  reason?: string;
  active?: boolean;
  expiresAtIso?: string;
}>;

export class EvidenceGovernanceParseError extends Error {
  public override readonly name = 'EvidenceGovernanceParseError';

  public constructor(message: string) {
    super(message);
  }
}

const DISP_ACTIONS = new Set<DispositionAction>(['Destroy', 'DeIdentify', 'Quarantine']);
const EVIDENCE_CATEGORIES = new Set<EvidenceCategory>([
  'Plan',
  'Action',
  'Approval',
  'Policy',
  'System',
]);
const DISPOSITION_STATUSES = new Set<EvidenceDispositionStatus>([
  'Queued',
  'InProgress',
  'Completed',
  'Failed',
  'Blocked',
]);

export function parseEvidenceRetentionScheduleV1(value: unknown): EvidenceRetentionScheduleV1 {
  const record = assertRecord(value, 'EvidenceRetentionScheduleV1');
  const schemaVersion = readNumber(record, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new EvidenceGovernanceParseError(`schemaVersion must be 1, got: ${schemaVersion}`);
  }

  const scheduleId = readNonEmptyString(record, 'scheduleId');
  const workspaceId = WorkspaceId(readString(record, 'workspaceId'));
  const categories = readEvidenceCategoryList(record, 'categories');
  const defaultDisposition = readDispositionAction(record, 'defaultDisposition');
  const retentionDays = readPositiveInt(record, 'retentionDays');
  const legalHoldOverrides = readBoolean(record, 'legalHoldOverrides');
  const createdByUserId = UserId(readString(record, 'createdByUserId'));
  const createdAtIso = readNonEmptyString(record, 'createdAtIso');
  const updatedAtIso = readOptionalString(record, 'updatedAtIso');
  const description = readOptionalString(record, 'description');

  return {
    schemaVersion: 1,
    scheduleId,
    workspaceId,
    categories,
    defaultDisposition,
    retentionDays,
    legalHoldOverrides,
    createdByUserId,
    createdAtIso,
    ...(updatedAtIso ? { updatedAtIso } : {}),
    ...(description ? { description } : {}),
  };
}

export function parseCreateEvidenceRetentionScheduleRequestV1(
  value: unknown,
): CreateEvidenceRetentionScheduleRequestV1 {
  const record = assertRecord(value, 'CreateEvidenceRetentionScheduleRequestV1');
  const schemaVersion = readNumber(record, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new EvidenceGovernanceParseError(`schemaVersion must be 1, got: ${schemaVersion}`);
  }

  const legalHoldOverrides = readOptionalBoolean(record, 'legalHoldOverrides');
  const description = readOptionalString(record, 'description');

  return {
    schemaVersion: 1,
    categories: readEvidenceCategoryList(record, 'categories'),
    defaultDisposition: readDispositionAction(record, 'defaultDisposition'),
    retentionDays: readPositiveInt(record, 'retentionDays'),
    ...(legalHoldOverrides !== undefined ? { legalHoldOverrides } : {}),
    ...(description ? { description } : {}),
  };
}

export function parseUpdateEvidenceRetentionScheduleRequestV1(
  value: unknown,
): UpdateEvidenceRetentionScheduleRequestV1 {
  const record = assertRecord(value, 'UpdateEvidenceRetentionScheduleRequestV1');

  const payload: UpdateEvidenceRetentionScheduleRequestV1 = {
    ...(recordHasKey(record, 'categories')
      ? { categories: readEvidenceCategoryList(record, 'categories') }
      : {}),
    ...(recordHasKey(record, 'defaultDisposition')
      ? { defaultDisposition: readDispositionAction(record, 'defaultDisposition') }
      : {}),
    ...(recordHasKey(record, 'retentionDays')
      ? { retentionDays: readPositiveInt(record, 'retentionDays') }
      : {}),
    ...(recordHasKey(record, 'legalHoldOverrides')
      ? { legalHoldOverrides: readBoolean(record, 'legalHoldOverrides') }
      : {}),
    ...(recordHasKey(record, 'description')
      ? { description: readNonEmptyString(record, 'description') }
      : {}),
  };

  if (Object.keys(payload).length === 0) {
    throw new EvidenceGovernanceParseError(
      'UpdateEvidenceRetentionScheduleRequestV1 must include at least one field.',
    );
  }

  return payload;
}

export function parseEvidenceDispositionJobV1(value: unknown): EvidenceDispositionJobV1 {
  const record = assertRecord(value, 'EvidenceDispositionJobV1');
  const jobId = readNonEmptyString(record, 'jobId');
  const evidenceId = readNonEmptyString(record, 'evidenceId');
  const action = readDispositionAction(record, 'action');
  const status = readDispositionStatus(record, 'status');
  const reason = readOptionalString(record, 'reason');
  const startedAtIso = readOptionalString(record, 'startedAtIso');

  return {
    jobId,
    evidenceId: EvidenceId(evidenceId),
    action,
    status,
    ...(reason ? { reason } : {}),
    ...(startedAtIso ? { startedAtIso } : {}),
  };
}

export function parseExecuteEvidenceDispositionRequestV1(
  value: unknown,
): ExecuteEvidenceDispositionRequestV1 {
  const record = assertRecord(value, 'ExecuteEvidenceDispositionRequestV1');
  const action = readDispositionAction(record, 'action');
  const reason = readOptionalString(record, 'reason');
  const actorUserId = readOptionalUserId(record, 'actorUserId');

  return {
    action,
    ...(reason ? { reason } : {}),
    ...(actorUserId ? { actorUserId } : {}),
  };
}

export function parseLegalHoldV1(value: unknown): LegalHoldV1 {
  const record = assertRecord(value, 'LegalHoldV1');
  const schemaVersion = readNumber(record, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new EvidenceGovernanceParseError(`schemaVersion must be 1, got: ${schemaVersion}`);
  }

  const expiresAtIso = readOptionalString(record, 'expiresAtIso');

  return {
    schemaVersion: 1,
    holdId: readNonEmptyString(record, 'holdId'),
    workspaceId: WorkspaceId(readString(record, 'workspaceId')),
    evidenceCategory: readEvidenceCategory(record, 'evidenceCategory'),
    description: readNonEmptyString(record, 'description'),
    active: readBoolean(record, 'active'),
    reason: readNonEmptyString(record, 'reason'),
    createdByUserId: UserId(readString(record, 'createdByUserId')),
    createdAtIso: readNonEmptyString(record, 'createdAtIso'),
    ...(expiresAtIso ? { expiresAtIso } : {}),
  };
}

export function parseCreateLegalHoldRequestV1(value: unknown): CreateLegalHoldRequestV1 {
  const record = assertRecord(value, 'CreateLegalHoldRequestV1');
  const schemaVersion = readNumber(record, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new EvidenceGovernanceParseError(`schemaVersion must be 1, got: ${schemaVersion}`);
  }

  return {
    schemaVersion: 1,
    evidenceCategory: readEvidenceCategory(record, 'evidenceCategory'),
    description: readNonEmptyString(record, 'description'),
    reason: readNonEmptyString(record, 'reason'),
    active: readBoolean(record, 'active'),
    ...(recordHasKey(record, 'expiresAtIso')
      ? { expiresAtIso: readNonEmptyString(record, 'expiresAtIso') }
      : {}),
  };
}

export function parseUpdateLegalHoldRequestV1(value: unknown): UpdateLegalHoldRequestV1 {
  const record = assertRecord(value, 'UpdateLegalHoldRequestV1');

  const payload: UpdateLegalHoldRequestV1 = {
    ...(recordHasKey(record, 'description')
      ? { description: readNonEmptyString(record, 'description') }
      : {}),
    ...(recordHasKey(record, 'reason') ? { reason: readNonEmptyString(record, 'reason') } : {}),
    ...(recordHasKey(record, 'active') ? { active: readBoolean(record, 'active') } : {}),
    ...(recordHasKey(record, 'expiresAtIso')
      ? { expiresAtIso: readNonEmptyString(record, 'expiresAtIso') }
      : {}),
  };

  if (Object.keys(payload).length === 0) {
    throw new EvidenceGovernanceParseError(
      'UpdateLegalHoldRequestV1 must include at least one field.',
    );
  }

  return payload;
}

function readEvidenceCategoryList(
  record: Record<string, unknown>,
  key: string,
): readonly EvidenceCategory[] {
  const raw = record[key];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new EvidenceGovernanceParseError(`${key} must be a non-empty array.`);
  }

  return raw.map((entry, index) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new EvidenceGovernanceParseError(`${key}[${index}] must be a non-empty string.`);
    }
    if (!EVIDENCE_CATEGORIES.has(entry as EvidenceCategory)) {
      throw new EvidenceGovernanceParseError(
        `${key}[${index}] must be one of: Plan, Action, Approval, Policy, System.`,
      );
    }
    return entry as EvidenceCategory;
  });
}

function readEvidenceCategory(record: Record<string, unknown>, key: string): EvidenceCategory {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new EvidenceGovernanceParseError(`${key} must be a non-empty string.`);
  }
  if (!EVIDENCE_CATEGORIES.has(value as EvidenceCategory)) {
    throw new EvidenceGovernanceParseError(
      `${key} must be one of: Plan, Action, Approval, Policy, System.`,
    );
  }
  return value as EvidenceCategory;
}

function readDispositionAction(record: Record<string, unknown>, key: string): DispositionAction {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new EvidenceGovernanceParseError(`${key} must be a non-empty string.`);
  }
  if (!DISP_ACTIONS.has(value as DispositionAction)) {
    throw new EvidenceGovernanceParseError(
      `${key} must be one of: Destroy, DeIdentify, Quarantine.`,
    );
  }
  return value as DispositionAction;
}

function readDispositionStatus(
  record: Record<string, unknown>,
  key: string,
): EvidenceDispositionStatus {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new EvidenceGovernanceParseError(`${key} must be a non-empty string.`);
  }
  if (!DISPOSITION_STATUSES.has(value as EvidenceDispositionStatus)) {
    throw new EvidenceGovernanceParseError(
      `${key} must be one of: Queued, InProgress, Completed, Failed, Blocked.`,
    );
  }
  return value as EvidenceDispositionStatus;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new EvidenceGovernanceParseError(`${key} must be an integer.`);
  }
  return value;
}

function readPositiveInt(record: Record<string, unknown>, key: string): number {
  const value = readNumber(record, key);
  if (value <= 0) {
    throw new EvidenceGovernanceParseError(`${key} must be >= 1.`);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new EvidenceGovernanceParseError(`${key} must be a boolean.`);
  }
  return value;
}

function readOptionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  if (!recordHasKey(record, key)) return undefined;
  return readBoolean(record, key);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new EvidenceGovernanceParseError(`${key} must be a string.`);
  }
  return value;
}

function readNonEmptyString(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (value.trim() === '') {
    throw new EvidenceGovernanceParseError(`${key} must be a non-empty string.`);
  }
  return value;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  if (!recordHasKey(record, key)) return undefined;
  const value = readString(record, key);
  if (value.trim() === '') {
    throw new EvidenceGovernanceParseError(`${key} must be a non-empty string.`);
  }
  return value;
}

function readOptionalUserId(record: Record<string, unknown>, key: string): UserId | undefined {
  if (!recordHasKey(record, key)) return undefined;
  return UserId(readNonEmptyString(record, key));
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new EvidenceGovernanceParseError(`${label} must be an object.`);
  }
  return value;
}

function recordHasKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
