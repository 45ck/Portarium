/* cspell:ignore hiddenoraclebody oraclecommand rawpayload rawstderr rawstdout sourcepayload studentpayload */

export const ENGINEERING_EVIDENCE_CARD_INPUT_V1_SCHEMA_VERSION =
  'portarium.evidence-card-input.v1' as const;

export type EngineeringEvidenceCardActionStatus = 'research-only' | 'blocked';

export type EngineeringEvidenceCardInputV1 = Readonly<{
  schemaVersion: typeof ENGINEERING_EVIDENCE_CARD_INPUT_V1_SCHEMA_VERSION;
  source: Readonly<{
    system: 'prompt-language';
    area: 'harness-arena';
    manifestSchemaVersion: string | number | boolean | null;
  }>;
  workItem: Readonly<{
    id: string;
    runId: string;
    runGroupId: string | null;
    policyVersion: string | null;
  }>;
  route: Readonly<{
    arm: 'local-only' | 'frontier-only' | 'advisor-only' | 'hybrid-router';
    decision: string;
    policyDecision?: 'local-screen' | 'advisor-only' | 'frontier-baseline' | 'hybrid-required';
    selectedModel: string | null;
    selectedProvider: string | null;
    reason: string;
  }>;
  gates: Readonly<{
    finalVerdict: 'pass' | 'fail' | 'blocked' | string | null;
    privateOracle: 'pass' | 'fail';
    blockingReviewDefects: readonly string[];
  }>;
  cost: Readonly<{
    frontierTokensTotal: number;
    cachedInputTokensTotal: number;
    providerUsdTotal: number;
    localWallSecondsTotal: number;
  }>;
  actionBoundary: Readonly<{
    status: EngineeringEvidenceCardActionStatus;
    reason: string;
  }>;
  artifactRefs: Readonly<{
    manifest: string;
    oracleStdout: string | null;
    oracleStderr: string | null;
  }>;
}>;

export class EngineeringEvidenceCardParseError extends Error {
  public override readonly name = 'EngineeringEvidenceCardParseError';

  public constructor(message: string) {
    super(message);
  }
}

const ARMS = new Set<EngineeringEvidenceCardInputV1['route']['arm']>([
  'local-only',
  'frontier-only',
  'advisor-only',
  'hybrid-router',
]);

const ACTION_STATUSES = new Set<EngineeringEvidenceCardActionStatus>(['research-only', 'blocked']);

const PRIVATE_ORACLE_STATUSES = new Set<EngineeringEvidenceCardInputV1['gates']['privateOracle']>([
  'pass',
  'fail',
]);

const SOURCE_SYSTEMS = new Set<EngineeringEvidenceCardInputV1['source']['system']>([
  'prompt-language',
]);

const SOURCE_AREAS = new Set<EngineeringEvidenceCardInputV1['source']['area']>(['harness-arena']);

const POLICY_DECISIONS = new Set<
  NonNullable<EngineeringEvidenceCardInputV1['route']['policyDecision']>
>(['local-screen', 'advisor-only', 'frontier-baseline', 'hybrid-required']);

const FORBIDDEN_KEYS = new Set([
  'rawpayload',
  'sourcepayload',
  'studentpayload',
  'credential',
  'secret',
  'token',
  'password',
  'oraclecommand',
  'rawstdout',
  'rawstderr',
  'hiddenoraclebody',
]);

export function parseEngineeringEvidenceCardInputV1(
  value: unknown,
): EngineeringEvidenceCardInputV1 {
  const card = readRecord(value, 'EngineeringEvidenceCardInputV1');
  assertNoForbiddenKeys(card);

  const schemaVersion = readString(card, 'schemaVersion');
  if (schemaVersion !== ENGINEERING_EVIDENCE_CARD_INPUT_V1_SCHEMA_VERSION) {
    throw new EngineeringEvidenceCardParseError(
      `schemaVersion must be ${ENGINEERING_EVIDENCE_CARD_INPUT_V1_SCHEMA_VERSION}`,
    );
  }

  const source = readRecord(card['source'], 'source');
  const workItem = readRecord(card['workItem'], 'workItem');
  const route = readRecord(card['route'], 'route');
  const gates = readRecord(card['gates'], 'gates');
  const cost = readRecord(card['cost'], 'cost');
  const actionBoundary = readRecord(card['actionBoundary'], 'actionBoundary');
  const artifactRefs = readRecord(card['artifactRefs'], 'artifactRefs');

  const sourceSystem = readLiteral(source, 'system', SOURCE_SYSTEMS);
  const sourceArea = readLiteral(source, 'area', SOURCE_AREAS);
  const routeArm = readLiteral(route, 'arm', ARMS);
  const privateOracle = readLiteral(gates, 'privateOracle', PRIVATE_ORACLE_STATUSES);
  const actionStatus = readLiteral(actionBoundary, 'status', ACTION_STATUSES);
  const policyDecision = readOptionalLiteral(route, 'policyDecision', POLICY_DECISIONS);

  const blockingReviewDefects = readStringArray(gates, 'blockingReviewDefects');
  const finalVerdict = readOptionalString(gates, 'finalVerdict');

  enforceActionBoundary({
    actionStatus,
    blockingReviewDefects,
    finalVerdict,
    privateOracle,
  });

  return {
    schemaVersion: ENGINEERING_EVIDENCE_CARD_INPUT_V1_SCHEMA_VERSION,
    source: {
      system: sourceSystem,
      area: sourceArea,
      manifestSchemaVersion: readScalarOrNull(source, 'manifestSchemaVersion'),
    },
    workItem: {
      id: readString(workItem, 'id'),
      runId: readString(workItem, 'runId'),
      runGroupId: readNullableString(workItem, 'runGroupId'),
      policyVersion: readNullableString(workItem, 'policyVersion'),
    },
    route: {
      arm: routeArm,
      decision: readString(route, 'decision'),
      ...(policyDecision ? { policyDecision } : {}),
      selectedModel: readNullableString(route, 'selectedModel'),
      selectedProvider: readNullableString(route, 'selectedProvider'),
      reason: readString(route, 'reason'),
    },
    gates: {
      finalVerdict,
      privateOracle,
      blockingReviewDefects,
    },
    cost: {
      frontierTokensTotal: readNonNegativeNumber(cost, 'frontierTokensTotal'),
      cachedInputTokensTotal: readNonNegativeNumber(cost, 'cachedInputTokensTotal'),
      providerUsdTotal: readNonNegativeNumber(cost, 'providerUsdTotal'),
      localWallSecondsTotal: readNonNegativeNumber(cost, 'localWallSecondsTotal'),
    },
    actionBoundary: {
      status: actionStatus,
      reason: readString(actionBoundary, 'reason'),
    },
    artifactRefs: {
      manifest: readArtifactRef(artifactRefs, 'manifest'),
      oracleStdout: readNullableArtifactRef(artifactRefs, 'oracleStdout'),
      oracleStderr: readNullableArtifactRef(artifactRefs, 'oracleStderr'),
    },
  };
}

export function isEngineeringEvidenceCardInputV1(
  value: unknown,
): value is EngineeringEvidenceCardInputV1 {
  try {
    parseEngineeringEvidenceCardInputV1(value);
    return true;
  } catch {
    return false;
  }
}

function enforceActionBoundary({
  actionStatus,
  blockingReviewDefects,
  finalVerdict,
  privateOracle,
}: {
  actionStatus: EngineeringEvidenceCardActionStatus;
  blockingReviewDefects: readonly string[];
  finalVerdict: string | null;
  privateOracle: 'pass' | 'fail';
}) {
  const hasBlockingEvidence =
    finalVerdict !== 'pass' || privateOracle !== 'pass' || blockingReviewDefects.length > 0;

  if (hasBlockingEvidence && actionStatus !== 'blocked') {
    throw new EngineeringEvidenceCardParseError(
      'actionBoundary.status must be blocked when verdict, oracle, or review evidence is blocking',
    );
  }
}

function assertNoForbiddenKeys(value: unknown) {
  const seen = new WeakSet<object>();

  function visit(current: unknown, path: string) {
    if (current === null || typeof current !== 'object') return;
    if (seen.has(current)) return;
    seen.add(current);

    for (const key of Reflect.ownKeys(current)) {
      if (typeof key !== 'string') continue;
      const keyPath = Array.isArray(current) ? `${path}[${key}]` : `${path}.${key}`;
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        throw new EngineeringEvidenceCardParseError(
          `Engineering evidence card must not include raw or secret field ${keyPath}`,
        );
      }
      visit((current as Record<string, unknown>)[key], keyPath);
    }
  }

  visit(value, 'card');
}

function readRecord(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EngineeringEvidenceCardParseError(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EngineeringEvidenceCardParseError(`${key} must be a non-empty string`);
  }
  return value;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new EngineeringEvidenceCardParseError(`${key} must be a string or null`);
  }
  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EngineeringEvidenceCardParseError(`${key} must be a non-empty string or null`);
  }
  return value;
}

function readScalarOrNull(
  record: Record<string, unknown>,
  key: string,
): string | number | boolean | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  throw new EngineeringEvidenceCardParseError(`${key} must be a scalar or null`);
}

function readNonNegativeNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new EngineeringEvidenceCardParseError(`${key} must be a non-negative finite number`);
  }
  return value;
}

function readStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new EngineeringEvidenceCardParseError(`${key} must be an array of strings`);
  }
  return value;
}

function readLiteral<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
): T {
  const value = readString(record, key);
  if (!allowed.has(value as T)) {
    throw new EngineeringEvidenceCardParseError(
      `${key} must be one of ${Array.from(allowed).join(', ')}`,
    );
  }
  return value as T;
}

function readOptionalLiteral<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
): T | null {
  if (!(key in record) || record[key] === null) return null;
  return readLiteral(record, key, allowed);
}

function readArtifactRef(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  assertArtifactRef(value, key);
  return value;
}

function readNullableArtifactRef(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EngineeringEvidenceCardParseError(`${key} must be a non-empty string or null`);
  }
  assertArtifactRef(value, key);
  return value;
}

function assertArtifactRef(value: string, key: string) {
  if (value.includes('?') || value.includes('#')) {
    throw new EngineeringEvidenceCardParseError(
      `${key} must be an artifact reference without query or fragment data`,
    );
  }
}
