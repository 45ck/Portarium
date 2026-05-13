import type { HashSha256 as HashSha256Type } from '../primitives/index.js';
import type {
  GslrEvidenceBundleRejectionCategoryV1,
  GslrEvidenceBundleRejectionCodeV1,
  GslrEvidenceBundleV1,
  GslrEvidenceBundleVerificationError,
  VerifiedGslrEvidenceBundleV1,
} from './gslr-evidence-bundle-v1.js';
import type { GslrStaticImportReviewStateV1 } from './gslr-static-import-readiness-v1.js';

export const GSLR_STATIC_IMPORTED_RECORD_V1_SCHEMA_VERSION =
  'portarium.gslr-static-imported-record.v1' as const;

const HASH_SHA_256_PATTERN = /^[a-f0-9]{64}$/;

export type GslrStaticImportedRecordStatusV1 = 'accepted_static' | 'quarantined_rejected';

export type GslrStaticImportedRecordArtifactByteStatusV1 =
  | 'not_fetched'
  | 'verified'
  | 'missing'
  | 'mismatch';

export type GslrStaticImportedRecordArtifactV1 = Readonly<{
  ref: string;
  declaredSha256: HashSha256Type;
  byteVerificationStatus: GslrStaticImportedRecordArtifactByteStatusV1;
  observedSha256: HashSha256Type | null;
}>;

export type GslrStaticImportedRecordV1 = Readonly<{
  schemaVersion: typeof GSLR_STATIC_IMPORTED_RECORD_V1_SCHEMA_VERSION;
  recordId: string;
  sourceRef: string;
  importedAtIso: string;
  status: GslrStaticImportedRecordStatusV1;
  reviewState: Extract<
    GslrStaticImportReviewStateV1,
    'accepted_static' | 'quarantined' | 'rejected'
  >;
  bundle: Readonly<{
    bundleId: string | null;
    payloadHashSha256: HashSha256Type | null;
    createdAtIso: string | null;
  }>;
  source: Readonly<{
    system: 'prompt-language' | null;
    repo: '45ck/prompt-language' | null;
    commit: string | null;
    runId: string | null;
    runGroupId: string | null;
  }>;
  subject: Readonly<{
    task: string | null;
    policyVersion: string | null;
  }>;
  signer: Readonly<{
    keyId: string | null;
    algorithm: 'ed25519' | 'test-ed25519' | null;
    trust: 'test-fixture' | 'production-keyring' | 'unknown';
  }>;
  verification: Readonly<
    | {
        status: 'verified';
        rejection: null;
      }
    | {
        status: 'rejected';
        rejection: Readonly<{
          code: GslrEvidenceBundleRejectionCodeV1;
          category: GslrEvidenceBundleRejectionCategoryV1;
          message: string;
        }>;
      }
  >;
  artifacts: readonly GslrStaticImportedRecordArtifactV1[];
  authority: Readonly<{
    runtimeAuthority: 'none';
    actionControls: 'absent';
    liveEndpoints: 'blocked';
    persistence: 'static-record-design-only';
  }>;
  boundaryWarnings: readonly string[];
}>;

export type GslrStaticImportedRecordBuildOptionsV1 = Readonly<{
  sourceRef: string;
  importedAtIso: string;
  artifactByteVerificationStatus?: GslrStaticImportedRecordArtifactByteStatusV1;
}>;

export function buildVerifiedGslrStaticImportedRecordV1(
  verified: VerifiedGslrEvidenceBundleV1,
  options: GslrStaticImportedRecordBuildOptionsV1,
): GslrStaticImportedRecordV1 {
  assertIso(options.importedAtIso, 'importedAtIso');
  assertStaticAuthority(verified.bundle);

  return deepFreeze({
    schemaVersion: GSLR_STATIC_IMPORTED_RECORD_V1_SCHEMA_VERSION,
    recordId: recordIdFor(verified.bundle.bundleId, verified.payloadHashSha256),
    sourceRef: options.sourceRef,
    importedAtIso: options.importedAtIso,
    status: 'accepted_static',
    reviewState: 'accepted_static',
    bundle: {
      bundleId: verified.bundle.bundleId,
      payloadHashSha256: verified.payloadHashSha256,
      createdAtIso: verified.bundle.createdAtIso,
    },
    source: sourceFields(verified.bundle),
    subject: subjectFields(verified.bundle),
    signer: signerFields(verified.bundle),
    verification: {
      status: 'verified',
      rejection: null,
    },
    artifacts: artifactRecords(
      verified.bundle,
      options.artifactByteVerificationStatus ?? 'not_fetched',
    ),
    authority: staticAuthority(),
    boundaryWarnings: [
      ...verified.boundaryWarnings,
      'Static imported record design does not persist to a database.',
      'Static imported record design does not create queues, tables, SSE streams, runtime cards, route decisions, or production actions.',
    ],
  });
}

export function buildRejectedGslrStaticImportedRecordV1(
  input: {
    bundle: unknown;
    error: GslrEvidenceBundleVerificationError;
  },
  options: GslrStaticImportedRecordBuildOptionsV1,
): GslrStaticImportedRecordV1 {
  assertIso(options.importedAtIso, 'importedAtIso');
  const bundle = partialBundle(input.bundle);
  const bundleId = readStringOrNull(bundle, 'bundleId');
  const payloadHash = readVerificationPayloadHash(bundle);

  return deepFreeze({
    schemaVersion: GSLR_STATIC_IMPORTED_RECORD_V1_SCHEMA_VERSION,
    recordId: recordIdFor(bundleId ?? 'rejected-bundle', payloadHash ?? input.error.code),
    sourceRef: options.sourceRef,
    importedAtIso: options.importedAtIso,
    status: 'quarantined_rejected',
    reviewState: 'quarantined',
    bundle: {
      bundleId,
      payloadHashSha256: payloadHash,
      createdAtIso: readStringOrNull(bundle, 'createdAtIso'),
    },
    source: sourceFields(bundle),
    subject: subjectFields(bundle),
    signer: signerFields(bundle),
    verification: {
      status: 'rejected',
      rejection: {
        code: input.error.code,
        category: input.error.category,
        message: input.error.message,
      },
    },
    artifacts: artifactRecords(bundle, options.artifactByteVerificationStatus ?? 'not_fetched'),
    authority: staticAuthority(),
    boundaryWarnings: [
      'Rejected GSLR bundle is quarantined static evidence only.',
      'Rejected static imported record design does not create live prompt-language ingestion.',
      'Rejected static imported record design does not create Cockpit runtime cards, queues, database tables, or SSE streams.',
      'Rejected static imported record design does not authorize production action execution or MacquarieCollege connector access.',
    ],
  });
}

function recordIdFor(bundleId: string, discriminator: string) {
  return `gslr-static-import:${bundleId}:${discriminator}`;
}

function assertStaticAuthority(bundle: GslrEvidenceBundleV1) {
  if (
    bundle.constraints.runtimeAuthority !== 'none' ||
    bundle.constraints.actionControls !== 'absent'
  ) {
    throw new Error(
      'GSLR static imported records cannot carry runtime authority or action controls',
    );
  }
}

function staticAuthority(): GslrStaticImportedRecordV1['authority'] {
  return {
    runtimeAuthority: 'none',
    actionControls: 'absent',
    liveEndpoints: 'blocked',
    persistence: 'static-record-design-only',
  };
}

function sourceFields(bundle: Partial<GslrEvidenceBundleV1>): GslrStaticImportedRecordV1['source'] {
  const source = partialRecord(bundle.source);
  return {
    system: source['system'] === 'prompt-language' ? 'prompt-language' : null,
    repo: source['repo'] === '45ck/prompt-language' ? '45ck/prompt-language' : null,
    commit: readStringOrNull(source, 'commit'),
    runId: readStringOrNull(source, 'runId'),
    runGroupId: readStringOrNull(source, 'runGroupId'),
  };
}

function subjectFields(
  bundle: Partial<GslrEvidenceBundleV1>,
): GslrStaticImportedRecordV1['subject'] {
  const subject = partialRecord(bundle.subject);
  return {
    task: readStringOrNull(subject, 'task'),
    policyVersion: readStringOrNull(subject, 'policyVersion'),
  };
}

function signerFields(bundle: Partial<GslrEvidenceBundleV1>): GslrStaticImportedRecordV1['signer'] {
  const verification = partialRecord(bundle.verification);
  const signer = partialRecord(verification['signer']);
  const algorithm =
    signer['algorithm'] === 'ed25519' || signer['algorithm'] === 'test-ed25519'
      ? signer['algorithm']
      : null;
  return {
    keyId: readStringOrNull(signer, 'keyId'),
    algorithm,
    trust:
      algorithm === 'ed25519'
        ? 'production-keyring'
        : algorithm === 'test-ed25519'
          ? 'test-fixture'
          : 'unknown',
  };
}

function artifactRecords(
  bundle: Partial<GslrEvidenceBundleV1>,
  byteVerificationStatus: GslrStaticImportedRecordArtifactByteStatusV1,
): readonly GslrStaticImportedRecordArtifactV1[] {
  const artifactHashes = Array.isArray(bundle.artifactHashes) ? bundle.artifactHashes : [];
  return artifactHashes.flatMap((entry) => {
    const artifact = partialRecord(entry);
    const ref = readStringOrNull(artifact, 'ref');
    const sha256 = readHashSha256OrNull(artifact, 'sha256');
    if (ref === null || sha256 === null) return [];
    return [
      {
        ref,
        declaredSha256: sha256,
        byteVerificationStatus,
        observedSha256: byteVerificationStatus === 'verified' ? sha256 : null,
      },
    ];
  });
}

function readVerificationPayloadHash(bundle: Partial<GslrEvidenceBundleV1>): HashSha256Type | null {
  return readHashSha256OrNull(partialRecord(bundle.verification), 'payloadHashSha256');
}

function partialBundle(value: unknown): Partial<GslrEvidenceBundleV1> {
  return partialRecord(value) as Partial<GslrEvidenceBundleV1>;
}

function partialRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readStringOrNull(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readHashSha256OrNull(record: Record<string, unknown>, key: string): HashSha256Type | null {
  const value = readStringOrNull(record, key);
  return value !== null && HASH_SHA_256_PATTERN.test(value) ? (value as HashSha256Type) : null;
}

function assertIso(value: string, name: string) {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be a valid ISO date`);
  }
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
