import { describe, expect, it } from 'vitest';
import {
  evaluateGslrPersistentStaticImportedRecordStorageDesignV1,
  recommendedGslrPersistentStaticImportedRecordStorageDesignV1,
} from './gslr-persistent-static-imported-record-storage-design-v1.js';
import {
  evaluateGslrPersistentStaticRepositoryImplementationReadinessV1,
  recommendedGslrPersistentStaticRepositoryImplementationReadinessV1,
  type GslrPersistentStaticRepositoryImplementationReadinessV1,
} from './gslr-persistent-static-repository-implementation-readiness-v1.js';
import {
  evaluateGslrStaticImportVerificationDesignV1,
  recommendedGslrStaticImportVerificationDesignV1,
} from './gslr-static-import-verification-design-v1.js';

describe('GslrPersistentStaticRepositoryImplementationReadinessV1', () => {
  it('accepts the recommended implementation-readiness checklist without applying storage', () => {
    const checklist = recommendedChecklist();
    const result = evaluateGslrPersistentStaticRepositoryImplementationReadinessV1(checklist);

    expect(result.status).toBe('ready-to-open-implementation-bead');
    expect(result.blockers).toEqual([]);
    expect(result.requiredImplementationArtifacts).toContain(
      'append-only static record table migration draft',
    );
    expect(result.boundaryWarnings.join(' ')).toContain(
      'opening a future implementation bead only',
    );
    expect(result.boundaryWarnings.join(' ')).toContain('does not apply migrations');
    expect(Object.isFrozen(checklist)).toBe(true);
    expect(Object.isFrozen(checklist.contractPlan)).toBe(true);
    expect(Object.isFrozen(result.requiredImplementationArtifacts)).toBe(true);
  });

  it('blocks readiness when the storage design gate is not ready', () => {
    const result = evaluateGslrPersistentStaticRepositoryImplementationReadinessV1(
      checklistWith({
        storageDesign: {
          status: 'blocked',
          design: {
            storage: {
              target: 'general-purpose-database',
            },
          },
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'storageDesign status must be ready-for-persistent-static-storage-design',
      'storageDesign target must be append-only-static-record-store',
    ]);
  });

  it('blocks readiness if migrations, tables, or production writes already exist', () => {
    const result = evaluateGslrPersistentStaticRepositoryImplementationReadinessV1(
      checklistWith({
        implementationState: {
          databaseMigrations: 'applied',
          productionTables: 'present',
          productionWrites: 'present',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'databaseMigrations must be not-started for readiness review',
      'productionTables must be absent for readiness review',
      'productionWrites must be absent for readiness review',
    ]);
  });

  it('blocks missing contract and operational plans', () => {
    const result = evaluateGslrPersistentStaticRepositoryImplementationReadinessV1(
      checklistWith({
        contractPlan: {
          repositoryPort: 'missing',
          appendOnlySchema: 'missing',
          idempotencyUniqueConstraint: 'missing',
          recordFingerprintConstraint: 'missing',
          auditEventSchema: 'missing',
          reviewStateTransitionTable: 'missing',
        },
        operationalPlan: {
          migrationPlan: 'missing',
          backupRestorePlan: 'missing',
          observabilityPlan: 'live-streaming',
          retentionPlan: 'delete-allowed',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'contractPlan repositoryPort must be specified',
      'contractPlan appendOnlySchema must be specified',
      'contractPlan idempotencyUniqueConstraint must be specified',
      'contractPlan recordFingerprintConstraint must be specified',
      'contractPlan auditEventSchema must be specified',
      'contractPlan reviewStateTransitionTable must be specified',
      'operationalPlan migrationPlan must be drafted-not-applied',
      'operationalPlan backupRestorePlan must be drafted',
      'operationalPlan observabilityPlan must be drafted-static-only',
      'operationalPlan retentionPlan must be drafted-delete-prohibited',
    ]);
  });

  it('blocks raw payload storage, runtime authority, and MC connector access policies', () => {
    const result = evaluateGslrPersistentStaticRepositoryImplementationReadinessV1(
      checklistWith({
        securityPlan: {
          verificationGateDependency: 'missing',
          rawPayloadStoragePolicy: 'allowed',
          runtimeAuthorityPolicy: 'action-execution',
          mcConnectorAccessPolicy: 'allowed',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'securityPlan verificationGateDependency must be documented',
      'securityPlan rawPayloadStoragePolicy must be forbidden',
      'securityPlan runtimeAuthorityPolicy must be none',
      'securityPlan mcConnectorAccessPolicy must be blocked',
    ]);
  });
});

function recommendedChecklist(): GslrPersistentStaticRepositoryImplementationReadinessV1 {
  const verificationGate = evaluateGslrStaticImportVerificationDesignV1(
    recommendedGslrStaticImportVerificationDesignV1(),
  );
  const storageDesign =
    recommendedGslrPersistentStaticImportedRecordStorageDesignV1(verificationGate);
  const storageResult = evaluateGslrPersistentStaticImportedRecordStorageDesignV1(storageDesign);
  expect(storageResult.status).toBe('ready-for-persistent-static-storage-design');
  return recommendedGslrPersistentStaticRepositoryImplementationReadinessV1(storageDesign);
}

function checklistWith(
  overrides: Partial<{
    storageDesign: {
      status?: GslrPersistentStaticRepositoryImplementationReadinessV1['storageDesign']['status'];
      design?: {
        storage?: Partial<
          GslrPersistentStaticRepositoryImplementationReadinessV1['storageDesign']['design']['storage']
        >;
      };
    };
    implementationState: Partial<
      GslrPersistentStaticRepositoryImplementationReadinessV1['implementationState']
    >;
    contractPlan: Partial<GslrPersistentStaticRepositoryImplementationReadinessV1['contractPlan']>;
    operationalPlan: Partial<
      GslrPersistentStaticRepositoryImplementationReadinessV1['operationalPlan']
    >;
    securityPlan: Partial<GslrPersistentStaticRepositoryImplementationReadinessV1['securityPlan']>;
  }> = {},
): GslrPersistentStaticRepositoryImplementationReadinessV1 {
  const checklist = recommendedChecklist();
  return {
    ...checklist,
    storageDesign: {
      ...checklist.storageDesign,
      ...overrides.storageDesign,
      design: {
        ...checklist.storageDesign.design,
        ...overrides.storageDesign?.design,
        storage: {
          ...checklist.storageDesign.design.storage,
          ...overrides.storageDesign?.design?.storage,
        },
      },
    },
    implementationState: {
      ...checklist.implementationState,
      ...overrides.implementationState,
    },
    contractPlan: {
      ...checklist.contractPlan,
      ...overrides.contractPlan,
    },
    operationalPlan: {
      ...checklist.operationalPlan,
      ...overrides.operationalPlan,
    },
    securityPlan: {
      ...checklist.securityPlan,
      ...overrides.securityPlan,
    },
  };
}
