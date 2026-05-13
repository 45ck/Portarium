import type { EvidenceHasher, EvidenceSignatureVerifier } from './evidence-hasher.js';
import {
  GslrEvidenceBundleVerificationError,
  verifyGslrEvidenceBundleV1,
  type VerifiedGslrEvidenceBundleV1,
} from './gslr-evidence-bundle-v1.js';
import {
  planGslrStaticImportedRecordRepositoryAppendV1,
  strictManualGslrStaticImportedRecordImporterPolicyV1,
  type GslrStaticImportedRecordImporterPlanV1,
} from './gslr-static-imported-record-importer-plan-v1.js';
import {
  createGslrStaticImportedRecordRepositoryDesignV1,
  GslrStaticImportedRecordRepositoryError,
  type GslrStaticImportedRecordRepositoryAppendResultV1,
  type GslrStaticImportedRecordRepositoryContractV1,
  type GslrStaticImportedRecordRepositoryEntryV1,
} from './gslr-static-imported-record-repository-v1.js';
import {
  buildRejectedGslrStaticImportedRecordV1,
  buildVerifiedGslrStaticImportedRecordV1,
  type GslrStaticImportedRecordArtifactByteStatusV1,
  type GslrStaticImportedRecordV1,
} from './gslr-static-imported-record-v1.js';

export const GSLR_STATIC_IMPORTER_DRY_RUN_V1_SCHEMA_VERSION =
  'portarium.gslr-static-importer-dry-run.v1' as const;

export type GslrStaticImporterDryRunStatusV1 =
  | 'stored'
  | 'replayed'
  | 'planned-blocked'
  | 'append-rejected';

export type GslrStaticImporterDryRunInputV1 = Readonly<{
  bundle: unknown;
  sourceRef: string;
  nowIso: string;
  dryRunAtIso: string;
  actor: string;
  hasher: EvidenceHasher;
  signatureVerifier: EvidenceSignatureVerifier;
  repository?: GslrStaticImportedRecordRepositoryContractV1;
  verifiedArtifactByteStatus?: GslrStaticImportedRecordArtifactByteStatusV1;
}>;

export type GslrStaticImporterDryRunRejectedAppendV1 = Readonly<{
  code: GslrStaticImportedRecordRepositoryError['code'];
  message: string;
}>;

export type GslrStaticImporterDryRunResultV1 = Readonly<{
  schemaVersion: typeof GSLR_STATIC_IMPORTER_DRY_RUN_V1_SCHEMA_VERSION;
  status: GslrStaticImporterDryRunStatusV1;
  sourceRef: string;
  verifiedBundle: VerifiedGslrEvidenceBundleV1 | null;
  record: GslrStaticImportedRecordV1;
  plan: GslrStaticImportedRecordImporterPlanV1;
  appendResult: GslrStaticImportedRecordRepositoryAppendResultV1 | null;
  appendRejection: GslrStaticImporterDryRunRejectedAppendV1 | null;
  repositoryEntries: readonly GslrStaticImportedRecordRepositoryEntryV1[];
  boundaryWarnings: readonly string[];
}>;

export function runGslrStaticImporterDryRunV1(
  input: GslrStaticImporterDryRunInputV1,
): GslrStaticImporterDryRunResultV1 {
  const repository = input.repository ?? createGslrStaticImportedRecordRepositoryDesignV1();
  const verifiedBundle = verifyBundleForDryRun(input);
  const record =
    verifiedBundle instanceof GslrEvidenceBundleVerificationError
      ? buildRejectedGslrStaticImportedRecordV1(
          { bundle: input.bundle, error: verifiedBundle },
          {
            sourceRef: input.sourceRef,
            importedAtIso: input.dryRunAtIso,
            artifactByteVerificationStatus: 'not_fetched',
          },
        )
      : buildVerifiedGslrStaticImportedRecordV1(verifiedBundle, {
          sourceRef: input.sourceRef,
          importedAtIso: input.dryRunAtIso,
          artifactByteVerificationStatus: input.verifiedArtifactByteStatus ?? 'verified',
        });

  const plan = planGslrStaticImportedRecordRepositoryAppendV1({
    record,
    policy: strictManualGslrStaticImportedRecordImporterPolicyV1(),
    plannedAtIso: input.dryRunAtIso,
    actor: input.actor,
    reason: `GSLR-20 static importer dry-run for ${record.sourceRef}`,
  });

  if (plan.appendInput === null) {
    return freezeResult({
      sourceRef: input.sourceRef,
      status: 'planned-blocked',
      verifiedBundle:
        verifiedBundle instanceof GslrEvidenceBundleVerificationError ? null : verifiedBundle,
      record,
      plan,
      appendResult: null,
      appendRejection: null,
      repositoryEntries: repository.list(),
    });
  }

  try {
    const appendResult = repository.append(plan.appendInput);
    return freezeResult({
      sourceRef: input.sourceRef,
      status: appendResult.status,
      verifiedBundle:
        verifiedBundle instanceof GslrEvidenceBundleVerificationError ? null : verifiedBundle,
      record,
      plan,
      appendResult,
      appendRejection: null,
      repositoryEntries: repository.list(),
    });
  } catch (caught) {
    if (!(caught instanceof GslrStaticImportedRecordRepositoryError)) {
      throw caught;
    }
    return freezeResult({
      sourceRef: input.sourceRef,
      status: 'append-rejected',
      verifiedBundle:
        verifiedBundle instanceof GslrEvidenceBundleVerificationError ? null : verifiedBundle,
      record,
      plan,
      appendResult: null,
      appendRejection: {
        code: caught.code,
        message: caught.message,
      },
      repositoryEntries: repository.list(),
    });
  }
}

function verifyBundleForDryRun(
  input: GslrStaticImporterDryRunInputV1,
): VerifiedGslrEvidenceBundleV1 | GslrEvidenceBundleVerificationError {
  try {
    return verifyGslrEvidenceBundleV1(input.bundle, {
      hasher: input.hasher,
      signatureVerifier: input.signatureVerifier,
      nowIso: input.nowIso,
    });
  } catch (caught) {
    if (caught instanceof GslrEvidenceBundleVerificationError) return caught;
    throw caught;
  }
}

function freezeResult(
  input: Omit<GslrStaticImporterDryRunResultV1, 'schemaVersion' | 'boundaryWarnings'>,
): GslrStaticImporterDryRunResultV1 {
  return deepFreeze({
    schemaVersion: GSLR_STATIC_IMPORTER_DRY_RUN_V1_SCHEMA_VERSION,
    ...input,
    boundaryWarnings: [
      'GSLR-20 static importer dry-run is docs/test-only.',
      'Dry-run uses an in-memory append-only repository contract and does not write production database state.',
      'Dry-run does not poll prompt-language manifests, call live endpoints, create queues, open SSE streams, create runtime Cockpit cards, make route decisions, execute production actions, or access MC connectors.',
    ],
  });
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
