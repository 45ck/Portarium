import { describe, expect, it } from 'vitest';

import { ApprovalId, PlanId, RunId, UserId, WorkspaceId } from '../primitives/index.js';
import type { ApprovalPendingV1 } from '../approvals/approval-v1.js';

import {
  evaluateApprovalRoutingSodV1,
  evaluateSodConstraintsV1,
  parseSodConstraintsV1,
  type SodConstraintV1,
} from './sod-constraints-v1.js';

describe('parseSodConstraintsV1', () => {
  it('parses supported SoD constraint kinds', () => {
    const constraints = parseSodConstraintsV1([
      { kind: 'MakerChecker' },
      { kind: 'DistinctApprovers', minimumApprovers: 2 },
      { kind: 'IncompatibleDuties', dutyKeys: ['payment:initiate', 'payment:approve'] },
      { kind: 'HazardousZoneNoSelfApproval' },
      { kind: 'SafetyClassifiedZoneDualApproval' },
      { kind: 'RemoteEstopRequesterSeparation' },
      {
        kind: 'SpecialistApproval',
        requiredRoles: ['data-platform'],
        rationale: 'SQL changes require data-platform approval.',
      },
    ]);

    expect(constraints).toHaveLength(7);
    expect(constraints[0]).toEqual({ kind: 'MakerChecker' });
    expect(constraints[1]).toEqual({ kind: 'DistinctApprovers', minimumApprovers: 2 });
    expect(constraints[2]).toEqual({
      kind: 'IncompatibleDuties',
      dutyKeys: ['payment:initiate', 'payment:approve'],
    });
    expect(constraints[3]).toEqual({ kind: 'HazardousZoneNoSelfApproval' });
    expect(constraints[4]).toEqual({ kind: 'SafetyClassifiedZoneDualApproval' });
    expect(constraints[5]).toEqual({ kind: 'RemoteEstopRequesterSeparation' });
    expect(constraints[6]).toEqual({
      kind: 'SpecialistApproval',
      requiredRoles: ['data-platform'],
      rationale: 'SQL changes require data-platform approval.',
    });
  });

  it('validates SpecialistApproval requiredRoles is non-empty', () => {
    expect(() =>
      parseSodConstraintsV1([{ kind: 'SpecialistApproval', requiredRoles: [], rationale: 'test' }]),
    ).toThrow(/requiredRoles/i);
  });

  it('rejects non-array inputs', () => {
    expect(() => parseSodConstraintsV1({})).toThrow(/sodConstraints must be an array/i);
  });

  it('rejects invalid kinds and shapes', () => {
    expect(() => parseSodConstraintsV1([null])).toThrow(/sodConstraints\[0\].*object/i);
    expect(() => parseSodConstraintsV1([{ kind: 'Nope' }])).toThrow(/kind must be one of/i);
  });

  it('validates DistinctApprovers minimumApprovers', () => {
    expect(() =>
      parseSodConstraintsV1([{ kind: 'DistinctApprovers', minimumApprovers: 0 }]),
    ).toThrow(/minimumApprovers/i);
  });

  it('validates IncompatibleDuties dutyKeys length and values', () => {
    expect(() =>
      parseSodConstraintsV1([{ kind: 'IncompatibleDuties', dutyKeys: ['only-one'] }]),
    ).toThrow(/dutyKeys/i);

    expect(() =>
      parseSodConstraintsV1([{ kind: 'IncompatibleDuties', dutyKeys: ['a', '   '] }]),
    ).toThrow(/dutyKeys/i);
  });
});

describe('evaluateSodConstraintsV1', () => {
  it('flags MakerChecker violations when initiator is also an approver', () => {
    const violations = evaluateSodConstraintsV1({
      constraints: [{ kind: 'MakerChecker' }],
      context: {
        initiatorUserId: UserId('user-1'),
        approverUserIds: [UserId('user-1'), UserId('user-2')],
      },
    });

    expect(violations).toEqual([
      { kind: 'MakerCheckerViolation', initiatorUserId: UserId('user-1') },
    ]);
  });

  it('flags DistinctApprovers violations using distinct counts', () => {
    const violations = evaluateSodConstraintsV1({
      constraints: [{ kind: 'DistinctApprovers', minimumApprovers: 2 }],
      context: {
        initiatorUserId: UserId('user-1'),
        approverUserIds: [UserId('user-2'), UserId('user-2')],
      },
    });

    expect(violations).toEqual([
      {
        kind: 'DistinctApproversViolation',
        requiredApprovers: 2,
        distinctApprovers: 1,
        approverUserIds: [UserId('user-2')],
      },
    ]);
  });

  it('flags IncompatibleDuties violations when a user performs 2+ incompatible duties', () => {
    const violations = evaluateSodConstraintsV1({
      constraints: [{ kind: 'IncompatibleDuties', dutyKeys: ['a', 'b', 'c'] }],
      context: {
        initiatorUserId: UserId('user-1'),
        approverUserIds: [],
        performedDuties: [
          { userId: UserId('user-9'), dutyKey: 'a' },
          { userId: UserId('user-9'), dutyKey: 'b' },
        ],
      },
    });

    expect(violations).toEqual([
      {
        kind: 'IncompatibleDutiesViolation',
        userId: UserId('user-9'),
        dutyKeys: ['a', 'b'],
        constraintDutyKeys: ['a', 'b', 'c'],
      },
    ]);
  });

  it('returns no violations when constraints are satisfied', () => {
    const constraints: SodConstraintV1[] = [
      { kind: 'MakerChecker' },
      { kind: 'DistinctApprovers', minimumApprovers: 2 },
      { kind: 'IncompatibleDuties', dutyKeys: ['a', 'b'] },
    ];

    const violations = evaluateSodConstraintsV1({
      constraints,
      context: {
        initiatorUserId: UserId('user-1'),
        approverUserIds: [UserId('user-2'), UserId('user-3')],
        performedDuties: [
          { userId: UserId('user-9'), dutyKey: 'a' },
          { userId: UserId('user-8'), dutyKey: 'b' },
        ],
      },
    });

    expect(violations).toEqual([]);
  });

  it('flags hazardous-zone mission proposer self-approval', () => {
    const violations = evaluateSodConstraintsV1({
      constraints: [{ kind: 'HazardousZoneNoSelfApproval' }],
      context: {
        initiatorUserId: UserId('mission-proposer-1'),
        approverUserIds: [UserId('mission-proposer-1')],
        robotContext: {
          hazardousZone: true,
          missionProposerUserId: UserId('mission-proposer-1'),
        },
      },
    });

    expect(violations).toEqual([
      {
        kind: 'HazardousZoneNoSelfApprovalViolation',
        missionProposerUserId: UserId('mission-proposer-1'),
      },
    ]);
  });

  it('flags safety-classified zone dual-approval violations when fewer than two approvers are present', () => {
    const violations = evaluateSodConstraintsV1({
      constraints: [{ kind: 'SafetyClassifiedZoneDualApproval' }],
      context: {
        initiatorUserId: UserId('operator-1'),
        approverUserIds: [UserId('approver-1')],
        robotContext: {
          safetyClassifiedZone: true,
        },
      },
    });

    expect(violations).toEqual([
      {
        kind: 'SafetyClassifiedZoneDualApprovalViolation',
        requiredApprovers: 2,
        distinctApprovers: 1,
        approverUserIds: [UserId('approver-1')],
      },
    ]);
  });

  it('flags remote e-stop requester separation violations', () => {
    const violations = evaluateSodConstraintsV1({
      constraints: [{ kind: 'RemoteEstopRequesterSeparation' }],
      context: {
        initiatorUserId: UserId('operator-1'),
        approverUserIds: [UserId('operator-1')],
        robotContext: {
          remoteEstopRequest: true,
          estopRequesterUserId: UserId('operator-1'),
        },
      },
    });

    expect(violations).toEqual([
      {
        kind: 'RemoteEstopRequesterSeparationViolation',
        estopRequesterUserId: UserId('operator-1'),
      },
    ]);
  });

  describe('SpecialistApproval', () => {
    const constraint: SodConstraintV1 = {
      kind: 'SpecialistApproval',
      requiredRoles: ['data-platform', 'dba'],
      rationale: 'SQL schema changes require specialist approval.',
    };

    it('flags violation when no approver holds a required role', () => {
      const violations = evaluateSodConstraintsV1({
        constraints: [constraint],
        context: {
          initiatorUserId: UserId('user-1'),
          approverUserIds: [UserId('approver-1')],
          approverRoles: [{ userId: UserId('approver-1'), roles: ['developer'] }],
        },
      });

      expect(violations).toEqual([
        {
          kind: 'SpecialistApprovalViolation',
          requiredRoles: ['data-platform', 'dba'],
          rationale: 'SQL schema changes require specialist approval.',
        },
      ]);
    });

    it('passes when at least one approver holds a required role', () => {
      const violations = evaluateSodConstraintsV1({
        constraints: [constraint],
        context: {
          initiatorUserId: UserId('user-1'),
          approverUserIds: [UserId('approver-1'), UserId('approver-2')],
          approverRoles: [
            { userId: UserId('approver-1'), roles: ['developer'] },
            { userId: UserId('approver-2'), roles: ['data-platform', 'sre'] },
          ],
        },
      });

      expect(violations).toEqual([]);
    });

    it('passes when approver holds secondary required role (dba)', () => {
      const violations = evaluateSodConstraintsV1({
        constraints: [constraint],
        context: {
          initiatorUserId: UserId('user-1'),
          approverUserIds: [UserId('approver-1')],
          approverRoles: [{ userId: UserId('approver-1'), roles: ['dba'] }],
        },
      });

      expect(violations).toEqual([]);
    });

    it('skips evaluation when approverRoles is not provided', () => {
      const violations = evaluateSodConstraintsV1({
        constraints: [constraint],
        context: {
          initiatorUserId: UserId('user-1'),
          approverUserIds: [UserId('approver-1')],
          // approverRoles intentionally omitted
        },
      });

      expect(violations).toEqual([]);
    });

    it('skips evaluation when approverRoles is empty', () => {
      const violations = evaluateSodConstraintsV1({
        constraints: [constraint],
        context: {
          initiatorUserId: UserId('user-1'),
          approverUserIds: [UserId('approver-1')],
          approverRoles: [],
        },
      });

      expect(violations).toEqual([]);
    });

    it('flags violation when approver has no roles entry at all', () => {
      const violations = evaluateSodConstraintsV1({
        constraints: [constraint],
        context: {
          initiatorUserId: UserId('user-1'),
          approverUserIds: [UserId('approver-1')],
          // approver-1 not listed in approverRoles
          approverRoles: [{ userId: UserId('other-user'), roles: ['data-platform'] }],
        },
      });

      expect(violations).toEqual([
        {
          kind: 'SpecialistApprovalViolation',
          requiredRoles: ['data-platform', 'dba'],
          rationale: 'SQL schema changes require specialist approval.',
        },
      ]);
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateApprovalRoutingSodV1
// ---------------------------------------------------------------------------

const PENDING_APPROVAL: ApprovalPendingV1 = {
  schemaVersion: 1,
  approvalId: ApprovalId('appr-1'),
  workspaceId: WorkspaceId('ws-1'),
  runId: RunId('run-1'),
  planId: PlanId('plan-1'),
  prompt: 'Please approve this change',
  requestedAtIso: '2026-02-18T00:00:00.000Z',
  requestedByUserId: UserId('initiator-1'),
  status: 'Pending',
};

describe('evaluateApprovalRoutingSodV1', () => {
  it('rejects when proposed approver is the initiator (MakerChecker)', () => {
    const violations = evaluateApprovalRoutingSodV1({
      approval: PENDING_APPROVAL,
      proposedApproverId: UserId('initiator-1'),
      constraints: [{ kind: 'MakerChecker' }],
    });

    expect(violations).toEqual([
      { kind: 'MakerCheckerViolation', initiatorUserId: UserId('initiator-1') },
    ]);
  });

  it('passes when proposed approver is different from initiator (MakerChecker)', () => {
    const violations = evaluateApprovalRoutingSodV1({
      approval: PENDING_APPROVAL,
      proposedApproverId: UserId('approver-1'),
      constraints: [{ kind: 'MakerChecker' }],
    });

    expect(violations).toEqual([]);
  });

  it('rejects when distinct approver threshold is not met', () => {
    const violations = evaluateApprovalRoutingSodV1({
      approval: PENDING_APPROVAL,
      proposedApproverId: UserId('approver-1'),
      previousApproverIds: [UserId('approver-1')],
      constraints: [{ kind: 'DistinctApprovers', minimumApprovers: 2 }],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]!.kind).toBe('DistinctApproversViolation');
  });

  it('passes when distinct approver threshold is met', () => {
    const violations = evaluateApprovalRoutingSodV1({
      approval: PENDING_APPROVAL,
      proposedApproverId: UserId('approver-2'),
      previousApproverIds: [UserId('approver-1')],
      constraints: [{ kind: 'DistinctApprovers', minimumApprovers: 2 }],
    });

    expect(violations).toEqual([]);
  });

  it('returns no violations when constraints list is empty', () => {
    const violations = evaluateApprovalRoutingSodV1({
      approval: PENDING_APPROVAL,
      proposedApproverId: UserId('initiator-1'),
      constraints: [],
    });

    expect(violations).toEqual([]);
  });

  it('defaults previousApproverIds to empty when omitted', () => {
    const violations = evaluateApprovalRoutingSodV1({
      approval: PENDING_APPROVAL,
      proposedApproverId: UserId('approver-1'),
      constraints: [{ kind: 'DistinctApprovers', minimumApprovers: 1 }],
    });

    expect(violations).toEqual([]);
  });
});
