import { describe, expect, it } from 'vitest';

import { UserId } from '../primitives/index.js';

import {
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
    ]);

    expect(constraints).toHaveLength(3);
    expect(constraints[0]).toEqual({ kind: 'MakerChecker' });
    expect(constraints[1]).toEqual({ kind: 'DistinctApprovers', minimumApprovers: 2 });
    expect(constraints[2]).toEqual({
      kind: 'IncompatibleDuties',
      dutyKeys: ['payment:initiate', 'payment:approve'],
    });
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
});
