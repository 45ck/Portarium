import type { PortFamily } from '../../domain/primitives/index.js';
import { isPortFamily } from '../../domain/primitives/index.js';
import {
  readBoolean,
  readInteger,
  readRecord,
  readString,
} from '../../domain/validation/parse-utils.js';

export type ActivepiecesPieceActionPatternV1 = Readonly<{
  operation: string;
  displayName: string;
  flowSlug: string;
  requiresApproval?: boolean;
}>;

export type ActivepiecesPiecePackagePatternV1 = Readonly<{
  schemaVersion: 1;
  packageName: string;
  pieceName: string;
  portFamily: PortFamily;
  operations: readonly ActivepiecesPieceActionPatternV1[];
}>;

export type ActivepiecesCorrelationHeaders = Readonly<{
  tenantId: string;
  correlationId: string;
  runId?: string;
}>;

export class ActivepiecesPiecePackagePatternParseError extends Error {
  public override readonly name = 'ActivepiecesPiecePackagePatternParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseActivepiecesPiecePackagePatternV1(
  value: unknown,
): ActivepiecesPiecePackagePatternV1 {
  const record = readRecord(
    value,
    'ActivepiecesPiecePackagePatternV1',
    ActivepiecesPiecePackagePatternParseError,
  );

  const schemaVersion = readInteger(
    record,
    'schemaVersion',
    ActivepiecesPiecePackagePatternParseError,
  );
  if (schemaVersion !== 1) {
    throw new ActivepiecesPiecePackagePatternParseError(
      `Unsupported schemaVersion: ${schemaVersion}`,
    );
  }

  const packageName = readString(record, 'packageName', ActivepiecesPiecePackagePatternParseError);
  const pieceName = readString(record, 'pieceName', ActivepiecesPiecePackagePatternParseError);
  const portFamilyRaw = readString(record, 'portFamily', ActivepiecesPiecePackagePatternParseError);
  if (!isPortFamily(portFamilyRaw)) {
    throw new ActivepiecesPiecePackagePatternParseError('portFamily must be a valid PortFamily.');
  }

  const operationsRaw = record['operations'];
  if (!Array.isArray(operationsRaw) || operationsRaw.length === 0) {
    throw new ActivepiecesPiecePackagePatternParseError('operations must be a non-empty array.');
  }

  const operations = operationsRaw.map((operation, index) =>
    parseOperation(operation, `operations[${index}]`),
  );
  enforceUniqueness(operations);

  return {
    schemaVersion: 1,
    packageName,
    pieceName,
    portFamily: portFamilyRaw,
    operations,
  };
}

export function buildActivepiecesCorrelationHeaders(
  headers: ActivepiecesCorrelationHeaders,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {
    tenantId: requireHeaderValue(headers.tenantId, 'tenantId'),
    correlationId: requireHeaderValue(headers.correlationId, 'correlationId'),
  };
  if (headers.runId !== undefined) {
    out['runId'] = requireHeaderValue(headers.runId, 'runId');
  }
  return out;
}

function parseOperation(value: unknown, path: string): ActivepiecesPieceActionPatternV1 {
  const record = readRecord(value, path, ActivepiecesPiecePackagePatternParseError);
  const operation = readString(record, 'operation', ActivepiecesPiecePackagePatternParseError);
  const displayName = readString(record, 'displayName', ActivepiecesPiecePackagePatternParseError);
  const flowSlug = readString(record, 'flowSlug', ActivepiecesPiecePackagePatternParseError);
  const requiresApproval = readOptionalBoolean(record, 'requiresApproval');

  return {
    operation,
    displayName,
    flowSlug,
    ...(requiresApproval !== undefined ? { requiresApproval } : {}),
  };
}

function readOptionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const raw = record[key];
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw === 'boolean') {
    return readBoolean(record, key, ActivepiecesPiecePackagePatternParseError);
  }
  throw new ActivepiecesPiecePackagePatternParseError(`${key} must be a boolean when provided.`);
}

function enforceUniqueness(operations: readonly ActivepiecesPieceActionPatternV1[]): void {
  const operationSet = new Set<string>();
  const flowSlugSet = new Set<string>();

  for (const operation of operations) {
    if (operationSet.has(operation.operation)) {
      throw new ActivepiecesPiecePackagePatternParseError(
        `Duplicate operation mapping: ${operation.operation}`,
      );
    }
    if (flowSlugSet.has(operation.flowSlug)) {
      throw new ActivepiecesPiecePackagePatternParseError(
        `Duplicate flowSlug mapping: ${operation.flowSlug}`,
      );
    }
    operationSet.add(operation.operation);
    flowSlugSet.add(operation.flowSlug);
  }
}

function requireHeaderValue(value: string, key: string): string {
  if (value.trim() === '') {
    throw new ActivepiecesPiecePackagePatternParseError(`${key} must be a non-empty string.`);
  }
  return value;
}
