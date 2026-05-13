import type { GslrStaticImportReviewStateV1 } from './gslr-static-import-readiness-v1.js';
import type { GslrStaticImportedRecordRepositoryAppendInputV1 } from './gslr-static-imported-record-repository-v1.js';
import type { GslrStaticImportedRecordV1 } from './gslr-static-imported-record-v1.js';

export const GSLR_STATIC_IMPORTED_RECORD_IMPORTER_PLAN_V1_SCHEMA_VERSION =
  'portarium.gslr-static-imported-record-importer-plan.v1' as const;

export type GslrStaticImportedRecordImporterPlanStatusV1 =
  | 'ready-to-append-static-record'
  | 'blocked';

export type GslrStaticImportedRecordImporterPolicyV1 = Readonly<{
  trigger: 'manual-operator-submission' | 'live-manifest-polling';
  artifactBytePolicy: 'fetch-and-hash-before-append' | 'declared-hashes-only';
  keyringRequirement: 'production-keyring-required' | 'test-fixture-allowed';
  repositoryTarget: 'append-only-static-record-contract' | 'production-database';
  operatorReviewDefaults: Readonly<{
    verified: Extract<GslrStaticImportReviewStateV1, 'accepted_static'>;
    rejected: Extract<GslrStaticImportReviewStateV1, 'quarantined'>;
  }>;
  failureReporting: 'structured-rejection-code' | 'message-only';
  authority: Readonly<{
    runtimeAuthority: 'none' | 'route-decision' | 'action-execution';
    actionControls: 'absent' | 'present';
    liveEndpoints: 'blocked' | 'allowed';
  }>;
}>;

export type GslrStaticImportedRecordImporterFailureReportV1 = Readonly<{
  recordId: string;
  sourceRef: string;
  rejectionCode: string | null;
  rejectionCategory: string | null;
  message: string | null;
}>;

export type GslrStaticImportedRecordImporterPlanV1 = Readonly<{
  schemaVersion: typeof GSLR_STATIC_IMPORTED_RECORD_IMPORTER_PLAN_V1_SCHEMA_VERSION;
  status: GslrStaticImportedRecordImporterPlanStatusV1;
  idempotencyKey: string;
  appendInput: GslrStaticImportedRecordRepositoryAppendInputV1 | null;
  failureReport: GslrStaticImportedRecordImporterFailureReportV1 | null;
  blockers: readonly string[];
  boundaryWarnings: readonly string[];
}>;

export function strictManualGslrStaticImportedRecordImporterPolicyV1(): GslrStaticImportedRecordImporterPolicyV1 {
  const policy = {
    trigger: 'manual-operator-submission',
    artifactBytePolicy: 'fetch-and-hash-before-append',
    keyringRequirement: 'production-keyring-required',
    repositoryTarget: 'append-only-static-record-contract',
    operatorReviewDefaults: {
      verified: 'accepted_static',
      rejected: 'quarantined',
    },
    failureReporting: 'structured-rejection-code',
    authority: {
      runtimeAuthority: 'none',
      actionControls: 'absent',
      liveEndpoints: 'blocked',
    },
  } satisfies GslrStaticImportedRecordImporterPolicyV1;
  return deepFreeze(policy);
}

export function planGslrStaticImportedRecordRepositoryAppendV1(input: {
  record: GslrStaticImportedRecordV1;
  policy: GslrStaticImportedRecordImporterPolicyV1;
  plannedAtIso: string;
  actor: string;
  reason?: string;
}): GslrStaticImportedRecordImporterPlanV1 {
  const blockers = importerPolicyBlockers(input.policy);
  if (Number.isNaN(Date.parse(input.plannedAtIso))) {
    blockers.push('plannedAtIso must be a valid ISO date');
  }
  if (input.actor.length === 0) {
    blockers.push('actor must be non-empty');
  }
  blockers.push(...recordBlockers(input.record, input.policy));

  const idempotencyKey = deriveGslrStaticImportedRecordImporterIdempotencyKeyV1(input.record);
  const appendInput =
    blockers.length === 0
      ? Object.freeze({
          record: input.record,
          idempotencyKey,
          appendedAtIso: input.plannedAtIso,
          actor: input.actor,
          reason:
            input.reason ??
            `manual static GSLR import plan for ${input.record.verification.status} bundle`,
        })
      : null;

  return deepFreeze({
    schemaVersion: GSLR_STATIC_IMPORTED_RECORD_IMPORTER_PLAN_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-to-append-static-record' : 'blocked',
    idempotencyKey,
    appendInput,
    failureReport: failureReport(input.record),
    blockers,
    boundaryWarnings: importerBoundaryWarnings(),
  });
}

export function deriveGslrStaticImportedRecordImporterIdempotencyKeyV1(
  record: GslrStaticImportedRecordV1,
): string {
  const discriminator =
    record.bundle.payloadHashSha256 ?? record.verification.rejection?.code ?? record.status;
  return [
    'gslr-static-importer',
    encodeURIComponent(record.sourceRef),
    encodeURIComponent(record.recordId),
    encodeURIComponent(discriminator),
  ].join(':');
}

function importerPolicyBlockers(policy: GslrStaticImportedRecordImporterPolicyV1): string[] {
  const blockers: string[] = [];
  if (policy.trigger !== 'manual-operator-submission') {
    blockers.push('import trigger must be manual-operator-submission');
  }
  if (policy.artifactBytePolicy !== 'fetch-and-hash-before-append') {
    blockers.push('artifactBytePolicy must be fetch-and-hash-before-append');
  }
  if (policy.keyringRequirement !== 'production-keyring-required') {
    blockers.push('keyringRequirement must be production-keyring-required');
  }
  if (policy.repositoryTarget !== 'append-only-static-record-contract') {
    blockers.push('repositoryTarget must be append-only-static-record-contract');
  }
  if (policy.failureReporting !== 'structured-rejection-code') {
    blockers.push('failureReporting must be structured-rejection-code');
  }
  if (policy.authority.runtimeAuthority !== 'none') {
    blockers.push('runtimeAuthority must remain none');
  }
  if (policy.authority.actionControls !== 'absent') {
    blockers.push('actionControls must remain absent');
  }
  if (policy.authority.liveEndpoints !== 'blocked') {
    blockers.push('liveEndpoints must remain blocked');
  }
  return blockers;
}

function recordBlockers(
  record: GslrStaticImportedRecordV1,
  policy: GslrStaticImportedRecordImporterPolicyV1,
): string[] {
  const blockers: string[] = [];
  if (
    record.authority.runtimeAuthority !== 'none' ||
    record.authority.actionControls !== 'absent' ||
    record.authority.liveEndpoints !== 'blocked'
  ) {
    blockers.push('record authority must keep runtime authority none and live endpoints blocked');
  }

  if (record.verification.status === 'verified') {
    if (record.status !== 'accepted_static') {
      blockers.push('verified records must have accepted_static status');
    }
    if (record.reviewState !== policy.operatorReviewDefaults.verified) {
      blockers.push('verified records must use the configured verified review default');
    }
    if (record.signer.trust !== 'production-keyring') {
      blockers.push('verified records require production-keyring signer trust before import');
    }
    if (record.artifacts.some((artifact) => artifact.byteVerificationStatus !== 'verified')) {
      blockers.push('verified records require artifact byte verification before import');
    }
  } else {
    if (record.status !== 'quarantined_rejected') {
      blockers.push('rejected records must have quarantined_rejected status');
    }
    if (record.reviewState !== policy.operatorReviewDefaults.rejected) {
      blockers.push('rejected records must use the configured rejected review default');
    }
    if (record.verification.rejection === null) {
      blockers.push('rejected records must preserve structured rejection details');
    }
  }
  return blockers;
}

function failureReport(
  record: GslrStaticImportedRecordV1,
): GslrStaticImportedRecordImporterFailureReportV1 | null {
  if (record.verification.status !== 'rejected') return null;
  return {
    recordId: record.recordId,
    sourceRef: record.sourceRef,
    rejectionCode: record.verification.rejection.code,
    rejectionCategory: record.verification.rejection.category,
    message: record.verification.rejection.message,
  };
}

function importerBoundaryWarnings(): readonly string[] {
  return [
    'Static imported-record importer planning is docs/test-only.',
    'Importer planning does not fetch artifact bytes, write a database, poll prompt-language manifests, or call live endpoints.',
    'Importer planning does not create queues, SSE streams, runtime Cockpit cards, route decisions, production actions, or MC connector access.',
  ];
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
