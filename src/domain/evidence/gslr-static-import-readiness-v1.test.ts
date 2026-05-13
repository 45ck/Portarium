import { describe, expect, it } from 'vitest';

import {
  evaluateGslrStaticImportReadinessV1,
  GSLR_STATIC_IMPORT_READINESS_V1_SCHEMA_VERSION,
  GSLR_STATIC_IMPORT_REQUIRED_REVIEW_STATES,
  type GslrStaticImportReadinessAssessmentV1,
} from './gslr-static-import-readiness-v1.js';

function readyAssessment(
  overrides: Partial<GslrStaticImportReadinessAssessmentV1> = {},
): GslrStaticImportReadinessAssessmentV1 {
  return {
    schemaVersion: GSLR_STATIC_IMPORT_READINESS_V1_SCHEMA_VERSION,
    proposedImportMode: 'persistent-static-review',
    trust: {
      signatureTrust: 'production-keyring',
      keyRevocation: 'documented',
      trustedAlgorithms: ['ed25519'],
    },
    artifacts: {
      byteVerification: 'fetch-and-hash-bytes',
      storageBoundary: 'append-only-static-record',
      rawPayloadPolicy: 'reject',
    },
    authority: {
      runtimeAuthority: 'none',
      actionControls: 'absent',
      liveEndpoints: 'blocked',
    },
    operatorReview: {
      stateMachine: 'defined',
      requiredStates: GSLR_STATIC_IMPORT_REQUIRED_REVIEW_STATES,
    },
    rejectionReporting: {
      structuredCodes: 'defined',
    },
    ...overrides,
  };
}

describe('evaluateGslrStaticImportReadinessV1', () => {
  it('passes only the design gate for a static persistent review plan', () => {
    const result = evaluateGslrStaticImportReadinessV1(readyAssessment());

    expect(result.status).toBe('ready-for-static-import-design-gate');
    expect(result.blockers).toEqual([]);
    expect(result.boundaryWarnings).toContain(
      'Passing this gate authorizes static import design only.',
    );
    expect(result.boundaryWarnings.join(' ')).toContain('does not authorize runtime Cockpit cards');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.blockers)).toBe(true);
  });

  it('blocks the current manual preview shape from becoming persistent import work', () => {
    const result = evaluateGslrStaticImportReadinessV1(
      readyAssessment({
        proposedImportMode: 'manual-static-preview',
        trust: {
          signatureTrust: 'test-key',
          keyRevocation: 'absent',
          trustedAlgorithms: ['test-ed25519'],
        },
        artifacts: {
          byteVerification: 'declared-hashes-only',
          storageBoundary: 'none',
          rawPayloadPolicy: 'reject',
        },
        operatorReview: {
          stateMachine: 'absent',
          requiredStates: [],
        },
        rejectionReporting: {
          structuredCodes: 'absent',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain(
      'proposedImportMode must be persistent-static-review before import work starts',
    );
    expect(result.blockers).toContain('production keyring trust must replace test-key signatures');
    expect(result.blockers).toContain(
      'artifact byte verification must fetch and hash artifact content',
    );
    expect(result.blockers).toContain('structured verifier rejection codes must be defined');
  });

  it('blocks any readiness plan that adds runtime authority or action controls', () => {
    const result = evaluateGslrStaticImportReadinessV1(
      readyAssessment({
        authority: {
          runtimeAuthority: 'route-decision',
          actionControls: 'present',
          liveEndpoints: 'allowed',
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain('runtimeAuthority must remain none');
    expect(result.blockers).toContain('imported static evidence must not expose action controls');
    expect(result.blockers).toContain(
      'import readiness must keep live engineering endpoints blocked',
    );
  });

  it('requires the full operator review state set before static import design passes', () => {
    const result = evaluateGslrStaticImportReadinessV1(
      readyAssessment({
        operatorReview: {
          stateMachine: 'defined',
          requiredStates: ['received', 'verified', 'accepted_static'],
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain('operator review state is missing quarantined');
    expect(result.blockers).toContain('operator review state is missing review_pending');
    expect(result.blockers).toContain('operator review state is missing rejected');
    expect(result.blockers).toContain('operator review state is missing superseded');
  });
});
