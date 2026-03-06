import {
  MachineId,
  PlanId,
  RunId,
  WorkspaceId,
  type MachineId as MachineIdType,
  type PlanId as PlanIdType,
  type RunId as RunIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export type MachineInvocationStatus = 'accepted' | 'running' | 'completed' | 'failed';

export type MachineInvocationRequestV1 = Readonly<{
  schemaVersion: 1;
  invocationId: string;
  machineId: MachineIdType;
  workspaceId: WorkspaceIdType;
  runId?: RunIdType;
  planId?: PlanIdType;
  action: string;
  input?: Record<string, unknown>;
  callbackUrl?: string;
  idempotencyKey?: string;
}>;

export type MachineInvocationResponseV1 = Readonly<{
  schemaVersion: 1;
  invocationId: string;
  status: MachineInvocationStatus;
  statusUrl?: string;
  artifactUris?: readonly string[];
  error?: string;
}>;

export type MachineInvocationProgressEventV1 = Readonly<{
  schemaVersion: 1;
  invocationId: string;
  status: MachineInvocationStatus;
  step?: string;
  progressRatio?: number;
  diagnostics?: string;
}>;

export class MachineInvocationParseError extends Error {
  public override readonly name = 'MachineInvocationParseError';

  public constructor(message: string) {
    super(message);
  }
}

const MACHINE_INVOCATION_STATUSES: ReadonlySet<string> = new Set([
  'accepted',
  'running',
  'completed',
  'failed',
]);

export function parseMachineInvocationRequestV1(value: unknown): MachineInvocationRequestV1 {
  if (!isRecord(value)) {
    throw new MachineInvocationParseError('MachineInvocationRequest must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new MachineInvocationParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const invocationId = readString(value, 'invocationId');
  const machineId = MachineId(readString(value, 'machineId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const action = readString(value, 'action');

  const runIdRaw = value['runId'];
  const runId = readOptionalBrandedString('runId', runIdRaw, RunId);

  const planIdRaw = value['planId'];
  const planId = readOptionalBrandedString('planId', planIdRaw, PlanId);

  const inputRaw = value['input'];
  const input = inputRaw === undefined ? undefined : parseInputObject(inputRaw);

  const callbackUrlRaw = value['callbackUrl'];
  const callbackUrl = readOptionalUrl(callbackUrlRaw, 'callbackUrl');

  const idempotencyKey = readOptionalString(value, 'idempotencyKey');

  return {
    schemaVersion: 1,
    invocationId,
    machineId,
    workspaceId,
    ...(runId ? { runId } : {}),
    ...(planId ? { planId } : {}),
    action,
    ...(input ? { input } : {}),
    ...(callbackUrl ? { callbackUrl } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

export function parseMachineInvocationResponseV1(value: unknown): MachineInvocationResponseV1 {
  if (!isRecord(value)) {
    throw new MachineInvocationParseError('MachineInvocationResponse must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new MachineInvocationParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const invocationId = readString(value, 'invocationId');
  const status = readStatus(value, 'status');
  const statusUrl = readOptionalUrl(value['statusUrl'], 'statusUrl');
  const error = readOptionalString(value, 'error');
  const artifactUris = parseOptionalArtifactUris(value);

  const outputArtifactUris = parseDeprecatedArtifactUris(value);
  const mergedArtifactUris = artifactUris ?? outputArtifactUris;

  return {
    schemaVersion: 1,
    invocationId,
    status,
    ...(statusUrl ? { statusUrl } : {}),
    ...(mergedArtifactUris ? { artifactUris: mergedArtifactUris } : {}),
    ...(error ? { error } : {}),
  };
}

export function parseMachineInvocationProgressEventV1(
  value: unknown,
): MachineInvocationProgressEventV1 {
  if (!isRecord(value)) {
    throw new MachineInvocationParseError('MachineInvocationProgressEvent must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new MachineInvocationParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const invocationId = readString(value, 'invocationId');
  const status = readStatus(value, 'status');
  const step = readOptionalString(value, 'step');
  const progressRatio = readOptionalProgressRatio(value, 'progressRatio');
  const diagnostics = readOptionalString(value, 'diagnostics');

  return {
    schemaVersion: 1,
    invocationId,
    status,
    ...(step ? { step } : {}),
    ...(progressRatio !== undefined ? { progressRatio } : {}),
    ...(diagnostics ? { diagnostics } : {}),
  };
}

function parseInputObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new MachineInvocationParseError('input must be an object when provided.');
  }
  return value;
}

function parseDeprecatedArtifactUris(
  record: Record<string, unknown>,
): readonly string[] | undefined {
  const value = record['outputArtifactUris'];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new MachineInvocationParseError('outputArtifactUris must be an array when provided.');
  }
  return value.map((uri, index) => {
    if (typeof uri !== 'string' || uri.trim() === '') {
      throw new MachineInvocationParseError(
        `outputArtifactUris[${index}] must be a non-empty string when provided.`,
      );
    }
    return uri;
  });
}

function parseOptionalArtifactUris(record: Record<string, unknown>): readonly string[] | undefined {
  const value = record['artifactUris'];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new MachineInvocationParseError('artifactUris must be an array when provided.');
  }
  return value.map((uri, index) => {
    if (typeof uri !== 'string' || uri.trim() === '') {
      throw new MachineInvocationParseError(
        `artifactUris[${index}] must be a non-empty string when provided.`,
      );
    }
    return uri;
  });
}

function readOptionalProgressRatio(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    throw new MachineInvocationParseError(`${key} must be a number between 0 and 1.`);
  }
  return value;
}

function readStatus(record: Record<string, unknown>, key: string): MachineInvocationStatus {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MachineInvocationParseError(`${key} must be a non-empty string.`);
  }
  if (!MACHINE_INVOCATION_STATUSES.has(value)) {
    throw new MachineInvocationParseError(
      `${key} must be one of: ${Array.from(MACHINE_INVOCATION_STATUSES).join(', ')}.`,
    );
  }
  return value as MachineInvocationStatus;
}

function readOptionalBrandedString<T extends string>(
  key: string,
  rawValue: unknown,
  parse: (value: string) => T,
): T | undefined {
  if (rawValue === undefined) return undefined;
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    throw new MachineInvocationParseError(`${key} must be a non-empty string when provided.`);
  }
  return parse(rawValue);
}

function readOptionalUrl(value: unknown, key: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MachineInvocationParseError(`${key} must be a valid non-empty URL.`);
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('bad protocol');
    }
  } catch {
    throw new MachineInvocationParseError(`${key} must be a valid http(s) URL.`);
  }
  return value;
}

function readString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MachineInvocationParseError(`${key} must be a non-empty string.`);
  }
  return value;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MachineInvocationParseError(`${key} must be a non-empty string when provided.`);
  }
  return value;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new MachineInvocationParseError(`${key} must be an integer.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
