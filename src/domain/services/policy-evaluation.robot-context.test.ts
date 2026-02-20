import { describe, expect, it } from 'vitest';

import { PolicyId, UserId, WorkspaceId } from '../primitives/index.js';
import type { PolicyV1 } from '../policy/policy-v1.js';
import { evaluatePolicy } from './policy-evaluation.js';

describe('evaluatePolicy robotContext support', () => {
  it('passes robotContext through SoD evaluation', () => {
    const policy: PolicyV1 = {
      schemaVersion: 1,
      policyId: PolicyId('pol-robot-1'),
      workspaceId: WorkspaceId('ws-1'),
      name: 'Robot Hazardous Zone SoD',
      active: true,
      priority: 1,
      version: 1,
      createdAtIso: '2026-02-20T00:00:00.000Z',
      createdByUserId: UserId('creator-1'),
      sodConstraints: [{ kind: 'HazardousZoneNoSelfApproval' }],
    };

    const result = evaluatePolicy({
      policy,
      context: {
        initiatorUserId: UserId('operator-1'),
        approverUserIds: [UserId('operator-1')],
        executionTier: 'HumanApprove',
        robotContext: {
          hazardousZone: true,
          missionProposerUserId: UserId('operator-1'),
        },
      },
    });

    expect(result.decision).toBe('RequireApproval');
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'HazardousZoneNoSelfApprovalViolation' }),
      ]),
    );
  });
});
