import { describe, expect, it } from 'vitest';

import { resolveApproverEligibilityV1 } from './sod-eligibility-v1.js';
import type { SodConstraintV1 } from './sod-constraints-v1.js';

// ---------------------------------------------------------------------------
// resolveApproverEligibilityV1
// ---------------------------------------------------------------------------

describe('resolveApproverEligibilityV1', () => {
  it('returns empty requirements for an empty constraints list', () => {
    const manifest = resolveApproverEligibilityV1([]);
    expect(manifest.requirements).toHaveLength(0);
  });

  it('produces MustNotBeInitiator from MakerChecker', () => {
    const constraints: SodConstraintV1[] = [{ kind: 'MakerChecker' }];
    const manifest = resolveApproverEligibilityV1(constraints);

    expect(manifest.requirements).toHaveLength(1);
    const req = manifest.requirements[0]!;
    expect(req.kind).toBe('MustNotBeInitiator');
    expect(req.rationale).toMatch(/different from the user who initiated/i);
  });

  it('produces MustBeDistinctFrom from DistinctApprovers', () => {
    const constraints: SodConstraintV1[] = [{ kind: 'DistinctApprovers', minimumApprovers: 3 }];
    const manifest = resolveApproverEligibilityV1(constraints);

    expect(manifest.requirements).toHaveLength(1);
    const req = manifest.requirements[0]!;
    expect(req.kind).toBe('MustBeDistinctFrom');
    if (req.kind === 'MustBeDistinctFrom') {
      expect(req.minimumDistinct).toBe(3);
    }
    expect(req.rationale).toMatch(/3 distinct/i);
  });

  it('produces MustNotHaveIncompatibleDuties from IncompatibleDuties', () => {
    const constraints: SodConstraintV1[] = [
      { kind: 'IncompatibleDuties', dutyKeys: ['payment:initiate', 'payment:approve'] },
    ];
    const manifest = resolveApproverEligibilityV1(constraints);

    expect(manifest.requirements).toHaveLength(1);
    const req = manifest.requirements[0]!;
    expect(req.kind).toBe('MustNotHaveIncompatibleDuties');
    if (req.kind === 'MustNotHaveIncompatibleDuties') {
      expect(req.dutyKeys).toContain('payment:initiate');
      expect(req.dutyKeys).toContain('payment:approve');
    }
  });

  describe('HazardousZoneNoSelfApproval', () => {
    const constraint: SodConstraintV1 = { kind: 'HazardousZoneNoSelfApproval' };

    it('emits MustNotBeMissionProposer when hazardousZone=true', () => {
      const manifest = resolveApproverEligibilityV1([constraint], { hazardousZone: true });
      expect(manifest.requirements).toHaveLength(1);
      expect(manifest.requirements[0]!.kind).toBe('MustNotBeMissionProposer');
    });

    it('emits no requirement when hazardousZone is absent', () => {
      const manifest = resolveApproverEligibilityV1([constraint]);
      expect(manifest.requirements).toHaveLength(0);
    });

    it('emits no requirement when hazardousZone=false', () => {
      const manifest = resolveApproverEligibilityV1([constraint], { hazardousZone: false });
      expect(manifest.requirements).toHaveLength(0);
    });
  });

  describe('SafetyClassifiedZoneDualApproval', () => {
    const constraint: SodConstraintV1 = { kind: 'SafetyClassifiedZoneDualApproval' };

    it('emits RequiresDualApproval when safetyClassifiedZone=true', () => {
      const manifest = resolveApproverEligibilityV1([constraint], { safetyClassifiedZone: true });
      expect(manifest.requirements).toHaveLength(1);
      const req = manifest.requirements[0]!;
      expect(req.kind).toBe('RequiresDualApproval');
      if (req.kind === 'RequiresDualApproval') {
        expect(req.minimumDistinct).toBe(2);
      }
    });

    it('emits no requirement when safetyClassifiedZone is absent', () => {
      const manifest = resolveApproverEligibilityV1([constraint]);
      expect(manifest.requirements).toHaveLength(0);
    });
  });

  describe('RemoteEstopRequesterSeparation', () => {
    const constraint: SodConstraintV1 = { kind: 'RemoteEstopRequesterSeparation' };

    it('emits MustNotBeEstopRequester when remoteEstopRequest=true', () => {
      const manifest = resolveApproverEligibilityV1([constraint], { remoteEstopRequest: true });
      expect(manifest.requirements).toHaveLength(1);
      expect(manifest.requirements[0]!.kind).toBe('MustNotBeEstopRequester');
    });

    it('emits no requirement when remoteEstopRequest is absent', () => {
      const manifest = resolveApproverEligibilityV1([constraint]);
      expect(manifest.requirements).toHaveLength(0);
    });
  });

  describe('SpecialistApproval', () => {
    const constraint: SodConstraintV1 = {
      kind: 'SpecialistApproval',
      requiredRoles: ['data-platform', 'dba'],
      rationale: 'SQL schema changes require data-platform or DBA approval.',
    };

    it('emits MustHaveOneOfRoles with correct roles and rationale', () => {
      const manifest = resolveApproverEligibilityV1([constraint]);
      expect(manifest.requirements).toHaveLength(1);
      const req = manifest.requirements[0]!;
      expect(req.kind).toBe('MustHaveOneOfRoles');
      if (req.kind === 'MustHaveOneOfRoles') {
        expect(req.requiredRoles).toContain('data-platform');
        expect(req.requiredRoles).toContain('dba');
        expect(req.rationale).toBe('SQL schema changes require data-platform or DBA approval.');
      }
    });
  });

  it('aggregates requirements from multiple constraints', () => {
    const constraints: SodConstraintV1[] = [
      { kind: 'MakerChecker' },
      { kind: 'DistinctApprovers', minimumApprovers: 2 },
      {
        kind: 'SpecialistApproval',
        requiredRoles: ['finance'],
        rationale: 'Finance team must approve budget changes.',
      },
    ];
    const manifest = resolveApproverEligibilityV1(constraints);

    expect(manifest.requirements).toHaveLength(3);
    const kinds = manifest.requirements.map((r) => r.kind);
    expect(kinds).toContain('MustNotBeInitiator');
    expect(kinds).toContain('MustBeDistinctFrom');
    expect(kinds).toContain('MustHaveOneOfRoles');
  });

  it('manifest is frozen (immutable value object)', () => {
    const manifest = resolveApproverEligibilityV1([{ kind: 'MakerChecker' }]);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.requirements)).toBe(true);
  });
});
