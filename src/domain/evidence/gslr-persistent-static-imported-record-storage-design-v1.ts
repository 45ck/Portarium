import type {
  GslrStaticImportVerificationDesignResultV1,
  GslrStaticImportVerificationDesignStatusV1,
} from './gslr-static-import-verification-design-v1.js';

export const GSLR_PERSISTENT_STATIC_IMPORTED_RECORD_STORAGE_DESIGN_V1_SCHEMA_VERSION =
  'portarium.gslr-persistent-static-imported-record-storage-design.v1' as const;

export type GslrPersistentStaticImportedRecordStorageDesignStatusV1 =
  | 'ready-for-persistent-static-storage-design'
  | 'blocked';

export type GslrPersistentStaticImportedRecordStorageDesignV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_IMPORTED_RECORD_STORAGE_DESIGN_V1_SCHEMA_VERSION;
  verificationGate: Readonly<{
    status: GslrStaticImportVerificationDesignStatusV1;
    keyringReady: boolean;
    artifactBytesReady: boolean;
  }>;
  storage: Readonly<{
    target: 'append-only-static-record-store' | 'general-purpose-database' | 'runtime-card-store';
    mutationModel: 'append-only' | 'upsert' | 'mutable-update';
    idempotency: 'required' | 'optional';
    recordFingerprint: 'canonical-json-sha256' | 'none';
    duplicatePolicy: 'reject-conflicts-replay-identical' | 'overwrite';
    auditTrail: 'append-only-events' | 'last-write-only';
  }>;
  review: Readonly<{
    stateTransitions: 'constrained' | 'free-form';
    actorRequired: boolean;
    reasonRequired: boolean;
  }>;
  retention: Readonly<{
    deletionPolicy: 'prohibited' | 'allowed';
    exportPermitted: boolean;
    rawPayloadStorage: 'forbidden' | 'allowed';
  }>;
  authority: Readonly<{
    runtimeAuthority: 'none' | 'route-decision' | 'action-execution';
    actionControls: 'absent' | 'present';
    liveEndpoints: 'blocked' | 'allowed';
    queues: 'absent' | 'present';
    sseStreams: 'absent' | 'present';
    mcConnectorAccess: 'blocked' | 'allowed';
  }>;
}>;

export type GslrPersistentStaticImportedRecordStorageDesignResultV1 = Readonly<{
  schemaVersion: typeof GSLR_PERSISTENT_STATIC_IMPORTED_RECORD_STORAGE_DESIGN_V1_SCHEMA_VERSION;
  status: GslrPersistentStaticImportedRecordStorageDesignStatusV1;
  blockers: readonly string[];
  boundaryWarnings: readonly string[];
}>;

export function recommendedGslrPersistentStaticImportedRecordStorageDesignV1(
  verificationGate: GslrStaticImportVerificationDesignResultV1,
): GslrPersistentStaticImportedRecordStorageDesignV1 {
  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_IMPORTED_RECORD_STORAGE_DESIGN_V1_SCHEMA_VERSION,
    verificationGate: {
      status: verificationGate.status,
      keyringReady: verificationGate.keyringReady,
      artifactBytesReady: verificationGate.artifactBytesReady,
    },
    storage: {
      target: 'append-only-static-record-store',
      mutationModel: 'append-only',
      idempotency: 'required',
      recordFingerprint: 'canonical-json-sha256',
      duplicatePolicy: 'reject-conflicts-replay-identical',
      auditTrail: 'append-only-events',
    },
    review: {
      stateTransitions: 'constrained',
      actorRequired: true,
      reasonRequired: true,
    },
    retention: {
      deletionPolicy: 'prohibited',
      exportPermitted: true,
      rawPayloadStorage: 'forbidden',
    },
    authority: {
      runtimeAuthority: 'none',
      actionControls: 'absent',
      liveEndpoints: 'blocked',
      queues: 'absent',
      sseStreams: 'absent',
      mcConnectorAccess: 'blocked',
    },
  });
}

export function evaluateGslrPersistentStaticImportedRecordStorageDesignV1(
  design: GslrPersistentStaticImportedRecordStorageDesignV1,
): GslrPersistentStaticImportedRecordStorageDesignResultV1 {
  assertSchemaVersion(design);
  const blockers = [
    ...verificationGateBlockers(design),
    ...storageBlockers(design),
    ...reviewBlockers(design),
    ...retentionBlockers(design),
    ...authorityBlockers(design),
  ];

  return deepFreeze({
    schemaVersion: GSLR_PERSISTENT_STATIC_IMPORTED_RECORD_STORAGE_DESIGN_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-for-persistent-static-storage-design' : 'blocked',
    blockers,
    boundaryWarnings: [
      'Passing this design gate authorizes persistent static storage design only.',
      'This design gate does not create database migrations, write production state, poll prompt-language manifests, create queues, open SSE streams, create runtime cards, make route decisions, execute actions, or access MC connectors.',
      'Persistent static storage must remain append-only and must reject runtime authority or action controls.',
    ],
  });
}

function verificationGateBlockers(
  design: GslrPersistentStaticImportedRecordStorageDesignV1,
): string[] {
  const blockers: string[] = [];
  if (design.verificationGate.status !== 'ready-for-static-verification-design') {
    blockers.push('verificationGate status must be ready-for-static-verification-design');
  }
  if (!design.verificationGate.keyringReady) {
    blockers.push('verificationGate keyringReady must be true');
  }
  if (!design.verificationGate.artifactBytesReady) {
    blockers.push('verificationGate artifactBytesReady must be true');
  }
  return blockers;
}

function storageBlockers(design: GslrPersistentStaticImportedRecordStorageDesignV1): string[] {
  const blockers: string[] = [];
  if (design.storage.target !== 'append-only-static-record-store') {
    blockers.push('storage target must be append-only-static-record-store');
  }
  if (design.storage.mutationModel !== 'append-only') {
    blockers.push('storage mutationModel must be append-only');
  }
  if (design.storage.idempotency !== 'required') {
    blockers.push('storage idempotency must be required');
  }
  if (design.storage.recordFingerprint !== 'canonical-json-sha256') {
    blockers.push('storage recordFingerprint must be canonical-json-sha256');
  }
  if (design.storage.duplicatePolicy !== 'reject-conflicts-replay-identical') {
    blockers.push('storage duplicatePolicy must reject conflicts and replay identical appends');
  }
  if (design.storage.auditTrail !== 'append-only-events') {
    blockers.push('storage auditTrail must be append-only-events');
  }
  return blockers;
}

function reviewBlockers(design: GslrPersistentStaticImportedRecordStorageDesignV1): string[] {
  const blockers: string[] = [];
  if (design.review.stateTransitions !== 'constrained') {
    blockers.push('review stateTransitions must be constrained');
  }
  if (!design.review.actorRequired) {
    blockers.push('review actorRequired must be true');
  }
  if (!design.review.reasonRequired) {
    blockers.push('review reasonRequired must be true');
  }
  return blockers;
}

function retentionBlockers(design: GslrPersistentStaticImportedRecordStorageDesignV1): string[] {
  const blockers: string[] = [];
  if (design.retention.deletionPolicy !== 'prohibited') {
    blockers.push('retention deletionPolicy must be prohibited');
  }
  if (!design.retention.exportPermitted) {
    blockers.push('retention exportPermitted must be true for static review packets');
  }
  if (design.retention.rawPayloadStorage !== 'forbidden') {
    blockers.push('retention rawPayloadStorage must be forbidden');
  }
  return blockers;
}

function authorityBlockers(design: GslrPersistentStaticImportedRecordStorageDesignV1): string[] {
  const blockers: string[] = [];
  if (design.authority.runtimeAuthority !== 'none') {
    blockers.push('runtimeAuthority must remain none');
  }
  if (design.authority.actionControls !== 'absent') {
    blockers.push('actionControls must remain absent');
  }
  if (design.authority.liveEndpoints !== 'blocked') {
    blockers.push('liveEndpoints must remain blocked');
  }
  if (design.authority.queues !== 'absent') {
    blockers.push('queues must remain absent');
  }
  if (design.authority.sseStreams !== 'absent') {
    blockers.push('sseStreams must remain absent');
  }
  if (design.authority.mcConnectorAccess !== 'blocked') {
    blockers.push('mcConnectorAccess must remain blocked');
  }
  return blockers;
}

function assertSchemaVersion(design: GslrPersistentStaticImportedRecordStorageDesignV1) {
  if (
    design.schemaVersion !== GSLR_PERSISTENT_STATIC_IMPORTED_RECORD_STORAGE_DESIGN_V1_SCHEMA_VERSION
  ) {
    throw new Error(
      `schemaVersion must be ${GSLR_PERSISTENT_STATIC_IMPORTED_RECORD_STORAGE_DESIGN_V1_SCHEMA_VERSION}`,
    );
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
