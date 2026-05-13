export const GSLR_STATIC_IMPORT_VERIFICATION_DESIGN_V1_SCHEMA_VERSION =
  'portarium.gslr-static-import-verification-design.v1' as const;

export type GslrStaticImportVerificationDesignStatusV1 =
  | 'ready-for-static-verification-design'
  | 'blocked';

export type GslrStaticImportVerificationDesignV1 = Readonly<{
  schemaVersion: typeof GSLR_STATIC_IMPORT_VERIFICATION_DESIGN_V1_SCHEMA_VERSION;
  keyring: Readonly<{
    trustSource: 'production-keyring' | 'test-fixture' | 'runtime-discovery';
    trustStoreMode: 'pinned-static' | 'network-discovered';
    trustedAlgorithms: readonly ('ed25519' | 'test-ed25519')[];
    revocationPolicy: 'documented' | 'absent';
    rotationPolicy: 'documented' | 'absent';
  }>;
  artifacts: Readonly<{
    byteSource: 'operator-supplied-bytes' | 'declared-hashes-only' | 'live-source-fetch';
    hashAlgorithm: 'sha256' | 'none';
    missingBytePolicy: 'block' | 'allow-not-fetched';
    mismatchPolicy: 'quarantine' | 'allow';
    rawPayloadPolicy: 'reject' | 'allow';
    maxBytesPerArtifact: number;
  }>;
  authority: Readonly<{
    runtimeAuthority: 'none' | 'route-decision' | 'action-execution';
    actionControls: 'absent' | 'present';
    liveEndpoints: 'blocked' | 'allowed';
    mcConnectorAccess: 'blocked' | 'allowed';
  }>;
}>;

export type GslrStaticImportVerificationDesignResultV1 = Readonly<{
  schemaVersion: typeof GSLR_STATIC_IMPORT_VERIFICATION_DESIGN_V1_SCHEMA_VERSION;
  status: GslrStaticImportVerificationDesignStatusV1;
  keyringReady: boolean;
  artifactBytesReady: boolean;
  blockers: readonly string[];
  boundaryWarnings: readonly string[];
}>;

export function evaluateGslrStaticImportVerificationDesignV1(
  design: GslrStaticImportVerificationDesignV1,
): GslrStaticImportVerificationDesignResultV1 {
  assertSchemaVersion(design);

  const keyringBlockers = keyringReadinessBlockers(design);
  const artifactBlockers = artifactReadinessBlockers(design);
  const authorityBlockers = authorityBlockersFor(design);
  const blockers = [...keyringBlockers, ...artifactBlockers, ...authorityBlockers];

  return deepFreeze({
    schemaVersion: GSLR_STATIC_IMPORT_VERIFICATION_DESIGN_V1_SCHEMA_VERSION,
    status: blockers.length === 0 ? 'ready-for-static-verification-design' : 'blocked',
    keyringReady: keyringBlockers.length === 0,
    artifactBytesReady: artifactBlockers.length === 0,
    blockers,
    boundaryWarnings: [
      'Passing this design gate authorizes static verification design only.',
      'This design gate does not implement a production keyring, fetch live artifact bytes, write persistence, create queues, open SSE streams, create runtime cards, make route decisions, execute actions, or access MC connectors.',
      'Artifact bytes must be supplied to the static verifier boundary and hash-checked before append; live source fetch remains blocked.',
    ],
  });
}

export function recommendedGslrStaticImportVerificationDesignV1(): GslrStaticImportVerificationDesignV1 {
  return deepFreeze({
    schemaVersion: GSLR_STATIC_IMPORT_VERIFICATION_DESIGN_V1_SCHEMA_VERSION,
    keyring: {
      trustSource: 'production-keyring',
      trustStoreMode: 'pinned-static',
      trustedAlgorithms: ['ed25519'],
      revocationPolicy: 'documented',
      rotationPolicy: 'documented',
    },
    artifacts: {
      byteSource: 'operator-supplied-bytes',
      hashAlgorithm: 'sha256',
      missingBytePolicy: 'block',
      mismatchPolicy: 'quarantine',
      rawPayloadPolicy: 'reject',
      maxBytesPerArtifact: 1_048_576,
    },
    authority: {
      runtimeAuthority: 'none',
      actionControls: 'absent',
      liveEndpoints: 'blocked',
      mcConnectorAccess: 'blocked',
    },
  });
}

function keyringReadinessBlockers(design: GslrStaticImportVerificationDesignV1): string[] {
  const blockers: string[] = [];
  if (design.keyring.trustSource !== 'production-keyring') {
    blockers.push('keyring trustSource must be production-keyring');
  }
  if (design.keyring.trustStoreMode !== 'pinned-static') {
    blockers.push('keyring trustStoreMode must be pinned-static, not network-discovered');
  }
  if (
    design.keyring.trustedAlgorithms.includes('test-ed25519') ||
    !design.keyring.trustedAlgorithms.includes('ed25519')
  ) {
    blockers.push('keyring trustedAlgorithms must include ed25519 and exclude test-ed25519');
  }
  if (design.keyring.revocationPolicy !== 'documented') {
    blockers.push('keyring revocationPolicy must be documented');
  }
  if (design.keyring.rotationPolicy !== 'documented') {
    blockers.push('keyring rotationPolicy must be documented');
  }
  return blockers;
}

function artifactReadinessBlockers(design: GslrStaticImportVerificationDesignV1): string[] {
  const blockers: string[] = [];
  if (design.artifacts.byteSource !== 'operator-supplied-bytes') {
    blockers.push('artifact byteSource must be operator-supplied-bytes');
  }
  if (design.artifacts.hashAlgorithm !== 'sha256') {
    blockers.push('artifact hashAlgorithm must be sha256');
  }
  if (design.artifacts.missingBytePolicy !== 'block') {
    blockers.push('artifact missingBytePolicy must block missing bytes');
  }
  if (design.artifacts.mismatchPolicy !== 'quarantine') {
    blockers.push('artifact mismatchPolicy must quarantine mismatches');
  }
  if (design.artifacts.rawPayloadPolicy !== 'reject') {
    blockers.push('artifact rawPayloadPolicy must reject raw/source payload bodies');
  }
  if (
    !Number.isInteger(design.artifacts.maxBytesPerArtifact) ||
    design.artifacts.maxBytesPerArtifact <= 0
  ) {
    blockers.push('artifact maxBytesPerArtifact must be a positive integer');
  }
  return blockers;
}

function authorityBlockersFor(design: GslrStaticImportVerificationDesignV1): string[] {
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
  if (design.authority.mcConnectorAccess !== 'blocked') {
    blockers.push('mcConnectorAccess must remain blocked');
  }
  return blockers;
}

function assertSchemaVersion(design: GslrStaticImportVerificationDesignV1) {
  if (design.schemaVersion !== GSLR_STATIC_IMPORT_VERIFICATION_DESIGN_V1_SCHEMA_VERSION) {
    throw new Error(
      `schemaVersion must be ${GSLR_STATIC_IMPORT_VERIFICATION_DESIGN_V1_SCHEMA_VERSION}`,
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
