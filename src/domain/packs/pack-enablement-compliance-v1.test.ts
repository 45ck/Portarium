import { describe, expect, it } from 'vitest';

import { parsePackComplianceProfileV1 } from './pack-compliance-profile-v1.js';
import { evaluatePackEnablementComplianceV1 } from './pack-enablement-compliance-v1.js';
import { parsePackManifestV1 } from './pack-manifest.js';

const MANIFEST_WITH_COMPLIANCE = parsePackManifestV1({
  manifestVersion: 1,
  kind: 'VerticalPack',
  id: 'scm.change-management',
  version: '1.0.0',
  requiresCore: '>=0.1.0',
  displayName: 'SCM Pack',
  lifecycle: {
    status: 'stable',
    supportWindows: [
      {
        train: 'Current',
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-12-31T00:00:00.000Z',
      },
    ],
  },
  assets: {
    complianceProfiles: ['compliance/scm-change-governance.json'],
  },
});

const MANIFEST_WITHOUT_COMPLIANCE = parsePackManifestV1({
  manifestVersion: 1,
  kind: 'VerticalPack',
  id: 'scm.change-management',
  version: '1.0.0',
  requiresCore: '>=0.1.0',
  displayName: 'SCM Pack',
  lifecycle: {
    status: 'stable',
    supportWindows: [
      {
        train: 'Current',
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-12-31T00:00:00.000Z',
      },
    ],
  },
  assets: {},
});

const SCM_COMPLIANCE_PROFILE = parsePackComplianceProfileV1({
  schemaVersion: 1,
  profileId: 'scm.change-governance',
  packId: 'scm.change-management',
  namespace: 'scm',
  jurisdiction: 'multi-jurisdiction',
  constraints: [{ constraintId: 'c-1', rule: 'evidence-chain-required', severity: 'high' }],
});

describe('evaluatePackEnablementComplianceV1', () => {
  it('allows enablement when declared and required profiles are satisfied', () => {
    const decision = evaluatePackEnablementComplianceV1({
      manifest: MANIFEST_WITH_COMPLIANCE,
      parsedProfilesByAsset: {
        'compliance/scm-change-governance.json': SCM_COMPLIANCE_PROFILE,
      },
      requiredProfileIds: ['scm.change-governance'],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.audit.packId).toBe('scm.change-management');
    expect(decision.audit.validatedProfileIds).toEqual(['scm.change-governance']);
    expect(decision.audit.missingRequiredProfileIds).toEqual([]);
  });

  it('denies when required profiles exist but manifest declares no compliance assets', () => {
    const decision = evaluatePackEnablementComplianceV1({
      manifest: MANIFEST_WITHOUT_COMPLIANCE,
      parsedProfilesByAsset: {},
      requiredProfileIds: ['scm.change-governance'],
    });

    if (decision.allowed) {
      throw new Error('Expected denial decision.');
    }

    expect(decision.reason).toBe('MissingComplianceAssetDeclaration');
  });

  it('denies when a declared compliance asset was not parsed/validated', () => {
    const decision = evaluatePackEnablementComplianceV1({
      manifest: MANIFEST_WITH_COMPLIANCE,
      parsedProfilesByAsset: {},
      requiredProfileIds: [],
    });

    if (decision.allowed) {
      throw new Error('Expected denial decision.');
    }

    expect(decision.reason).toBe('MissingParsedComplianceProfile');
  });

  it('denies when parsed compliance assets are not declared in manifest', () => {
    const decision = evaluatePackEnablementComplianceV1({
      manifest: MANIFEST_WITHOUT_COMPLIANCE,
      parsedProfilesByAsset: {
        'compliance/scm-change-governance.json': SCM_COMPLIANCE_PROFILE,
      },
      requiredProfileIds: [],
    });

    if (decision.allowed) {
      throw new Error('Expected denial decision.');
    }

    expect(decision.reason).toBe('UndeclaredComplianceAsset');
  });

  it('denies when compliance profile packId does not match manifest id', () => {
    const foreignProfile = parsePackComplianceProfileV1({
      schemaVersion: 1,
      profileId: 'scm.change-governance',
      packId: 'scm.other-pack',
      namespace: 'scm',
      jurisdiction: 'multi-jurisdiction',
      constraints: [{ constraintId: 'c-1', rule: 'evidence-chain-required', severity: 'high' }],
    });

    const decision = evaluatePackEnablementComplianceV1({
      manifest: MANIFEST_WITH_COMPLIANCE,
      parsedProfilesByAsset: {
        'compliance/scm-change-governance.json': foreignProfile,
      },
      requiredProfileIds: [],
    });

    if (decision.allowed) {
      throw new Error('Expected denial decision.');
    }

    expect(decision.reason).toBe('PackIdMismatch');
  });

  it('denies when required profile id is missing after validation', () => {
    const decision = evaluatePackEnablementComplianceV1({
      manifest: MANIFEST_WITH_COMPLIANCE,
      parsedProfilesByAsset: {
        'compliance/scm-change-governance.json': SCM_COMPLIANCE_PROFILE,
      },
      requiredProfileIds: ['edu.child-data-protection'],
    });

    if (decision.allowed) {
      throw new Error('Expected denial decision.');
    }

    expect(decision.reason).toBe('MissingRequiredComplianceProfile');
    expect(decision.audit.requiredProfileIds).toEqual(['edu.child-data-protection']);
    expect(decision.audit.missingRequiredProfileIds).toEqual(['edu.child-data-protection']);
  });
});
