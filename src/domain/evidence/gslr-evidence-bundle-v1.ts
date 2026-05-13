/* cspell:ignore hiddenoraclebody oraclecommand rawpayload rawstderr rawstdout sourcepayload studentpayload */

import { HashSha256, type HashSha256 as HashSha256Type } from '../primitives/index.js';
import { canonicalizeJson } from './canonical-json.js';
import type { EvidenceHasher, EvidenceSignatureVerifier } from './evidence-hasher.js';
import {
  GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION,
  projectGslrRouteEvidenceToEngineeringCardInputV1,
  type GslrEngineeringEvidenceCardProjectionInputV1,
  type GslrMeasuredArmEvidenceV1,
  type GslrRouteArmV1,
  type GslrRoutePolicyDecisionV1,
} from './gslr-engineering-evidence-card-projection-v1.js';
import type { EngineeringEvidenceCardInputV1 } from './engineering-evidence-card-v1.js';

export const GSLR_EVIDENCE_BUNDLE_V1_SCHEMA_VERSION = 'portarium.gslr-evidence-bundle.v1' as const;

export type GslrEvidenceBundleV1 = Readonly<{
  schemaVersion: typeof GSLR_EVIDENCE_BUNDLE_V1_SCHEMA_VERSION;
  bundleId: string;
  createdAtIso: string;
  source: Readonly<{
    system: 'prompt-language';
    repo: '45ck/prompt-language';
    commit: string;
    runId: string;
    runGroupId: string | null;
  }>;
  subject: Readonly<{
    task: string;
    policyVersion: string | null;
  }>;
  evidence: GslrEngineeringEvidenceCardProjectionInputV1;
  artifactHashes: readonly Readonly<{
    ref: string;
    sha256: HashSha256Type;
  }>[];
  constraints: Readonly<{
    importMode: 'manual-static-only';
    runtimeAuthority: 'none';
    actionControls: 'absent';
  }>;
  verification: Readonly<{
    payloadHashSha256: HashSha256Type;
    signatureBase64: string;
    signer: Readonly<{
      keyId: string;
      algorithm: 'ed25519' | 'test-ed25519';
    }>;
    notBeforeIso: string;
    expiresAtIso: string;
  }>;
}>;

export type VerifiedGslrEvidenceBundleV1 = Readonly<{
  bundle: GslrEvidenceBundleV1;
  canonicalPayload: string;
  payloadHashSha256: HashSha256Type;
  card: EngineeringEvidenceCardInputV1;
  boundaryWarnings: readonly string[];
}>;

export type GslrEvidenceBundleRejectionCategoryV1 =
  | 'payload_hash'
  | 'signature'
  | 'provenance'
  | 'validity_window'
  | 'artifact_hash_coverage'
  | 'static_constraints';

export type GslrEvidenceBundleRejectionCodeV1 =
  | 'payload_hash_mismatch'
  | 'signature_invalid'
  | 'provenance_mismatch'
  | 'validity_window_invalid'
  | 'artifact_hash_missing'
  | 'artifact_ref_invalid'
  | 'raw_payload_forbidden'
  | 'schema_invalid'
  | 'static_constraint_violation';

export class GslrEvidenceBundleVerificationError extends Error {
  public override readonly name = 'GslrEvidenceBundleVerificationError';
  public readonly code: GslrEvidenceBundleRejectionCodeV1;
  public readonly category: GslrEvidenceBundleRejectionCategoryV1;

  public constructor(
    message: string,
    code: GslrEvidenceBundleRejectionCodeV1,
    category: GslrEvidenceBundleRejectionCategoryV1,
  ) {
    super(message);
    this.code = code;
    this.category = category;
  }
}

export function verifyGslrEvidenceBundleV1(
  value: unknown,
  deps: {
    hasher: EvidenceHasher;
    signatureVerifier: EvidenceSignatureVerifier;
    nowIso: string;
  },
): VerifiedGslrEvidenceBundleV1 {
  const bundle = parseGslrEvidenceBundleV1(value);
  validateTemporalWindow(bundle, deps.nowIso);
  validateCrossReferences(bundle);

  const canonicalPayload = canonicalizeGslrEvidenceBundlePayloadV1(bundle);
  const payloadHashSha256 = HashSha256(String(deps.hasher.sha256Hex(canonicalPayload)));
  if (payloadHashSha256 !== bundle.verification.payloadHashSha256) {
    throw verificationError(
      'payload_hash_mismatch',
      'payload_hash',
      'payloadHashSha256 does not match bundle payload',
    );
  }

  if (!deps.signatureVerifier.verify(canonicalPayload, bundle.verification.signatureBase64)) {
    throw verificationError(
      'signature_invalid',
      'signature',
      'bundle signature verification failed',
    );
  }

  const card = projectGslrRouteEvidenceToEngineeringCardInputV1(bundle.evidence);
  return deepFreeze({
    bundle,
    canonicalPayload,
    payloadHashSha256,
    card,
    boundaryWarnings: [
      'Verified GSLR bundle is manual static evidence only.',
      'Verification does not create live prompt-language ingestion.',
      'Verification does not create Cockpit runtime cards, queues, database tables, or SSE streams.',
      'Verification does not authorize production action execution or MacquarieCollege connector access.',
    ],
  });
}

export function canonicalizeGslrEvidenceBundlePayloadV1(bundle: GslrEvidenceBundleV1): string {
  return canonicalizeJson({
    schemaVersion: bundle.schemaVersion,
    bundleId: bundle.bundleId,
    createdAtIso: bundle.createdAtIso,
    source: bundle.source,
    subject: bundle.subject,
    evidence: bundle.evidence,
    artifactHashes: bundle.artifactHashes,
    constraints: bundle.constraints,
  });
}

export function parseGslrEvidenceBundleV1(value: unknown): GslrEvidenceBundleV1 {
  const bundle = readRecord(value, 'GslrEvidenceBundleV1');
  assertNoForbiddenKeys(bundle);

  const schemaVersion = readString(bundle, 'schemaVersion');
  if (schemaVersion !== GSLR_EVIDENCE_BUNDLE_V1_SCHEMA_VERSION) {
    throw verificationError(
      'schema_invalid',
      'static_constraints',
      `schemaVersion must be ${GSLR_EVIDENCE_BUNDLE_V1_SCHEMA_VERSION}`,
    );
  }

  const source = readRecord(bundle['source'], 'source');
  const subject = readRecord(bundle['subject'], 'subject');
  const constraints = readRecord(bundle['constraints'], 'constraints');
  const verification = readRecord(bundle['verification'], 'verification');
  const signer = readRecord(verification['signer'], 'verification.signer');
  const evidence = readProjectionInput(bundle['evidence']);

  return {
    schemaVersion: GSLR_EVIDENCE_BUNDLE_V1_SCHEMA_VERSION,
    bundleId: readNonEmptyString(bundle, 'bundleId'),
    createdAtIso: readIsoDate(bundle, 'createdAtIso'),
    source: {
      system: readLiteral(source, 'system', new Set(['prompt-language'])),
      repo: readLiteral(source, 'repo', new Set(['45ck/prompt-language'])),
      commit: readCommit(source, 'commit'),
      runId: readNonEmptyString(source, 'runId'),
      runGroupId: readNullableString(source, 'runGroupId'),
    },
    subject: {
      task: readNonEmptyString(subject, 'task'),
      policyVersion: readNullableString(subject, 'policyVersion'),
    },
    evidence,
    artifactHashes: readArtifactHashes(bundle['artifactHashes']),
    constraints: {
      importMode: readLiteral(constraints, 'importMode', new Set(['manual-static-only'])),
      runtimeAuthority: readLiteral(constraints, 'runtimeAuthority', new Set(['none'])),
      actionControls: readLiteral(constraints, 'actionControls', new Set(['absent'])),
    },
    verification: {
      payloadHashSha256: readHashSha256(verification, 'payloadHashSha256'),
      signatureBase64: readBase64(verification, 'signatureBase64'),
      signer: {
        keyId: readNonEmptyString(signer, 'keyId'),
        algorithm: readLiteral(signer, 'algorithm', new Set(['ed25519', 'test-ed25519'])),
      },
      notBeforeIso: readIsoDate(verification, 'notBeforeIso'),
      expiresAtIso: readIsoDate(verification, 'expiresAtIso'),
    },
  };
}

function readProjectionInput(value: unknown): GslrEngineeringEvidenceCardProjectionInputV1 {
  const evidence = readRecord(value, 'evidence');
  const source = readRecord(evidence['source'], 'evidence.source');
  const route = readRecord(evidence['route'], 'evidence.route');
  const selectedRun = readRecord(route['selectedRun'], 'evidence.route.selectedRun');
  const artifactRefs = readRecord(evidence['artifactRefs'], 'evidence.artifactRefs');

  const schemaVersion = readString(evidence, 'schemaVersion');
  if (schemaVersion !== GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION) {
    throw verificationError(
      'schema_invalid',
      'static_constraints',
      `evidence.schemaVersion must be ${GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION}`,
    );
  }

  return {
    schemaVersion: GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION,
    source: {
      manifestSchemaVersion: readScalarOrNull(source, 'manifestSchemaVersion'),
    },
    policyVersion: readNullableString(evidence, 'policyVersion'),
    route: {
      task: readNonEmptyString(route, 'task'),
      policyDecision: readLiteral<GslrRoutePolicyDecisionV1>(
        route,
        'policyDecision',
        new Set(['local-screen', 'advisor-only', 'frontier-baseline', 'hybrid-required']),
      ),
      selectedRun: readSelectedRun(selectedRun),
    },
    artifactRefs: {
      manifest: readArtifactRef(artifactRefs, 'manifest'),
      oracleStdout: readNullableArtifactRef(artifactRefs, 'oracleStdout'),
      oracleStderr: readNullableArtifactRef(artifactRefs, 'oracleStderr'),
    },
  };
}

function readSelectedRun(record: Record<string, unknown>): GslrMeasuredArmEvidenceV1 {
  const cachedInputTokens = readOptionalNonNegativeNumber(record, 'cachedInputTokens');
  return {
    arm: readLiteral<GslrRouteArmV1>(
      record,
      'arm',
      new Set(['local-only', 'frontier-only', 'advisor-only', 'hybrid-router']),
    ),
    runId: readNonEmptyString(record, 'runId'),
    runGroupId: readNullableString(record, 'runGroupId'),
    finalVerdict: readOptionalString(record, 'finalVerdict'),
    privateOracle: readLiteral(record, 'privateOracle', new Set(['pass', 'fail'])),
    blockingReviewDefects: readStringArray(record, 'blockingReviewDefects'),
    frontierTokens: readNonNegativeNumber(record, 'frontierTokens'),
    ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
    providerUsd: readNonNegativeNumber(record, 'providerUsd'),
    localWallSeconds: readNonNegativeNumber(record, 'localWallSeconds'),
    selectedModel: readNullableString(record, 'selectedModel'),
    selectedProvider: readNullableString(record, 'selectedProvider'),
    reason: readNonEmptyString(record, 'reason'),
  };
}

function validateTemporalWindow(bundle: GslrEvidenceBundleV1, nowIso: string) {
  const createdAt = Date.parse(bundle.createdAtIso);
  const notBefore = Date.parse(bundle.verification.notBeforeIso);
  const expiresAt = Date.parse(bundle.verification.expiresAtIso);
  const now = Date.parse(nowIso);

  if (expiresAt <= notBefore) {
    throw verificationError(
      'validity_window_invalid',
      'validity_window',
      'verification.expiresAtIso must be after notBeforeIso',
    );
  }
  if (Number.isNaN(now)) {
    throw verificationError(
      'validity_window_invalid',
      'validity_window',
      'nowIso must be a valid ISO date',
    );
  }
  if (createdAt < notBefore || createdAt > expiresAt) {
    throw verificationError(
      'validity_window_invalid',
      'validity_window',
      'createdAtIso must be inside the verification validity window',
    );
  }
  if (now < notBefore || now > expiresAt) {
    throw verificationError(
      'validity_window_invalid',
      'validity_window',
      'bundle is outside its verification window',
    );
  }
}

function validateCrossReferences(bundle: GslrEvidenceBundleV1) {
  const selectedRun = bundle.evidence.route.selectedRun;
  if (bundle.source.runId !== selectedRun.runId) {
    throw verificationError(
      'provenance_mismatch',
      'provenance',
      'source.runId must match evidence selected runId',
    );
  }
  if (bundle.source.runGroupId !== selectedRun.runGroupId) {
    throw verificationError(
      'provenance_mismatch',
      'provenance',
      'source.runGroupId must match evidence selected runGroupId',
    );
  }
  if (bundle.subject.task !== bundle.evidence.route.task) {
    throw verificationError(
      'provenance_mismatch',
      'provenance',
      'subject.task must match evidence route.task',
    );
  }
  if (bundle.subject.policyVersion !== bundle.evidence.policyVersion) {
    throw verificationError(
      'provenance_mismatch',
      'provenance',
      'subject.policyVersion must match evidence policyVersion',
    );
  }

  const refs = new Set([
    bundle.evidence.artifactRefs.manifest,
    bundle.evidence.artifactRefs.oracleStdout,
    bundle.evidence.artifactRefs.oracleStderr,
  ]);
  refs.delete(null);
  for (const ref of refs) {
    if (!bundle.artifactHashes.some((artifact) => artifact.ref === ref)) {
      throw verificationError(
        'artifact_hash_missing',
        'artifact_hash_coverage',
        `missing artifact hash for ${ref}`,
      );
    }
  }
}

function readArtifactHashes(value: unknown): GslrEvidenceBundleV1['artifactHashes'] {
  if (!Array.isArray(value) || value.length === 0) {
    throw verificationError(
      'artifact_hash_missing',
      'artifact_hash_coverage',
      'artifactHashes must be a non-empty array',
    );
  }
  return value.map((entry, index) => {
    const record = readRecord(entry, `artifactHashes[${index}]`);
    return {
      ref: readArtifactRef(record, 'ref'),
      sha256: readHashSha256(record, 'sha256'),
    };
  });
}

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
        throw verificationError(
          'raw_payload_forbidden',
          'static_constraints',
          `GSLR evidence bundle must not include raw or secret field ${keyPath}`,
        );
      }
      visit((current as Record<string, unknown>)[key], keyPath);
    }
  }

  visit(value, 'bundle');
}

function readRecord(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw verificationError('schema_invalid', 'static_constraints', `${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw verificationError('schema_invalid', 'static_constraints', `${key} must be a string`);
  }
  return value;
}

function readNonEmptyString(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!value.trim()) {
    throw verificationError(
      'schema_invalid',
      'static_constraints',
      `${key} must be a non-empty string`,
    );
  }
  return value;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw verificationError(
      'schema_invalid',
      'static_constraints',
      `${key} must be a string or null`,
    );
  }
  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw verificationError(
      'schema_invalid',
      'static_constraints',
      `${key} must be a non-empty string or null`,
    );
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
  throw verificationError(
    'schema_invalid',
    'static_constraints',
    `${key} must be a scalar or null`,
  );
}

function readStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw verificationError(
      'schema_invalid',
      'static_constraints',
      `${key} must be an array of strings`,
    );
  }
  return value;
}

function readLiteral<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
): T {
  const value = readNonEmptyString(record, key);
  if (!allowed.has(value as T)) {
    throw verificationError(
      'static_constraint_violation',
      'static_constraints',
      `${key} must be one of ${Array.from(allowed).join(', ')}`,
    );
  }
  return value as T;
}

function readNonNegativeNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw verificationError(
      'schema_invalid',
      'static_constraints',
      `${key} must be a non-negative finite number`,
    );
  }
  return value;
}

function readOptionalNonNegativeNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  return readNonNegativeNumber(record, key);
}

function readIsoDate(record: Record<string, unknown>, key: string): string {
  const value = readNonEmptyString(record, key);
  if (Number.isNaN(Date.parse(value))) {
    throw verificationError(
      'validity_window_invalid',
      'validity_window',
      `${key} must be a valid ISO date`,
    );
  }
  return value;
}

function readCommit(record: Record<string, unknown>, key: string): string {
  const value = readNonEmptyString(record, key);
  if (!/^[0-9a-f]{7,40}$/i.test(value)) {
    throw verificationError(
      'schema_invalid',
      'static_constraints',
      `${key} must be a git commit hash`,
    );
  }
  return value;
}

function readHashSha256(record: Record<string, unknown>, key: string): HashSha256Type {
  const value = readNonEmptyString(record, key);
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw verificationError(
      'schema_invalid',
      'static_constraints',
      `${key} must be a 64-character SHA-256 hex hash`,
    );
  }
  return HashSha256(value.toLowerCase());
}

function readBase64(record: Record<string, unknown>, key: string): string {
  const value = readNonEmptyString(record, key);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw verificationError('signature_invalid', 'signature', `${key} must be base64 text`);
  }
  return value;
}

function readArtifactRef(record: Record<string, unknown>, key: string): string {
  const value = readNonEmptyString(record, key);
  if (value.includes('?') || value.includes('#')) {
    throw verificationError(
      'artifact_ref_invalid',
      'artifact_hash_coverage',
      `${key} must be an artifact reference without query or fragment data`,
    );
  }
  if (value.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    throw verificationError(
      'artifact_ref_invalid',
      'artifact_hash_coverage',
      `${key} must be a repository-relative artifact reference`,
    );
  }
  if (value.split(/[\\/]+/).includes('..')) {
    throw verificationError(
      'artifact_ref_invalid',
      'artifact_hash_coverage',
      `${key} must not traverse parents`,
    );
  }
  return value;
}

function readNullableArtifactRef(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw verificationError(
      'schema_invalid',
      'static_constraints',
      `${key} must be a non-empty string or null`,
    );
  }
  return readArtifactRef({ [key]: value }, key);
}

function verificationError(
  code: GslrEvidenceBundleRejectionCodeV1,
  category: GslrEvidenceBundleRejectionCategoryV1,
  message: string,
) {
  return new GslrEvidenceBundleVerificationError(message, code, category);
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
