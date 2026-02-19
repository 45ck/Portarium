import { describe, expect, it } from 'vitest';

import { UserId } from '../primitives/index.js';
import {
  evaluateTruthDivergenceV1,
  parseDefinitionTruthStateV1,
  transitionDefinitionsTruthModeV1,
} from './definition-truth-v1.js';

const VALID_STATE = {
  schemaVersion: 1,
  workspaceId: 'ws-1',
  deploymentMode: 'Team',
  definitionsTruthMode: 'GitAuthoritative',
  runtimeStateStore: 'Database',
  gitRef: 'b9aa2f6',
  appliedGitRef: 'b9aa2f6',
  runtimeHasUnappliedMutations: false,
  divergenceStatus: 'InSync',
  transitionLog: [],
} as const;

describe('parseDefinitionTruthStateV1', () => {
  it('parses a valid Git-authoritative state', () => {
    const parsed = parseDefinitionTruthStateV1(VALID_STATE);
    expect(parsed.workspaceId).toBe('ws-1');
    expect(parsed.definitionsTruthMode).toBe('GitAuthoritative');
    expect(parsed.runtimeStateStore).toBe('Database');
  });

  it('requires gitRef when mode is GitAuthoritative', () => {
    const invalid = { ...VALID_STATE } as Record<string, unknown>;
    delete invalid['gitRef'];
    expect(() => parseDefinitionTruthStateV1(invalid)).toThrow(
      /gitRef is required when definitionsTruthMode is GitAuthoritative/i,
    );
  });

  it('rejects unknown deployment mode', () => {
    expect(() =>
      parseDefinitionTruthStateV1({
        ...VALID_STATE,
        deploymentMode: 'Shared',
      }),
    ).toThrow(/deploymentMode must be one of/i);
  });
});

describe('evaluateTruthDivergenceV1', () => {
  it('returns InSync when refs align and runtime has no drift', () => {
    expect(
      evaluateTruthDivergenceV1({
        gitRef: 'abc1234',
        appliedGitRef: 'abc1234',
        runtimeHasUnappliedMutations: false,
      }),
    ).toBe('InSync');
  });

  it('returns GitAhead when git and runtime-applied refs diverge', () => {
    expect(
      evaluateTruthDivergenceV1({
        gitRef: 'abc1234',
        appliedGitRef: 'def5678',
        runtimeHasUnappliedMutations: false,
      }),
    ).toBe('GitAhead');
  });

  it('returns RuntimeAhead when runtime has unapplied mutations only', () => {
    expect(
      evaluateTruthDivergenceV1({
        gitRef: 'abc1234',
        appliedGitRef: 'abc1234',
        runtimeHasUnappliedMutations: true,
      }),
    ).toBe('RuntimeAhead');
  });

  it('returns Conflict when both git and runtime drift are present', () => {
    expect(
      evaluateTruthDivergenceV1({
        gitRef: 'abc1234',
        appliedGitRef: 'def5678',
        runtimeHasUnappliedMutations: true,
      }),
    ).toBe('Conflict');
  });
});

describe('transitionDefinitionsTruthModeV1', () => {
  it('appends transition and marks RuntimeAhead when moving to RuntimeAuthoritative', () => {
    const next = transitionDefinitionsTruthModeV1({
      state: parseDefinitionTruthStateV1(VALID_STATE),
      toMode: 'RuntimeAuthoritative',
      transitionedAtIso: '2026-02-19T00:00:00.000Z',
      transitionedByUserId: UserId('user-1'),
      reason: 'Emergency runtime hotfix',
    });

    expect(next.definitionsTruthMode).toBe('RuntimeAuthoritative');
    expect(next.divergenceStatus).toBe('RuntimeAhead');
    expect(next.transitionLog).toHaveLength(1);
    expect(next.transitionLog[0]?.fromMode).toBe('GitAuthoritative');
    expect(next.transitionLog[0]?.toMode).toBe('RuntimeAuthoritative');
  });

  it('requires gitRef when transitioning to GitAuthoritative', () => {
    const current = parseDefinitionTruthStateV1({
      ...VALID_STATE,
      definitionsTruthMode: 'RuntimeAuthoritative',
      gitRef: undefined,
      divergenceStatus: 'RuntimeAhead',
    });

    expect(() =>
      transitionDefinitionsTruthModeV1({
        state: current,
        toMode: 'GitAuthoritative',
        transitionedAtIso: '2026-02-19T01:00:00.000Z',
        transitionedByUserId: UserId('user-2'),
        reason: 'Reconcile runtime edits into git',
      }),
    ).toThrow(/gitRef is required when transitioning to GitAuthoritative/i);
  });
});
