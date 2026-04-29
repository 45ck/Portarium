import { describe, expect, it } from 'vitest';
import {
  ProjectIntentParseError,
  parseBeadProposalV1,
  parseProjectIntentV1,
} from './project-intent-v1.js';

describe('parseProjectIntentV1', () => {
  const validIntent = {
    schemaVersion: 1,
    intentId: 'intent-1',
    workspaceId: 'ws-1',
    createdAtIso: '2026-04-29T09:00:00.000Z',
    createdByUserId: 'user-1',
    source: 'Human',
    prompt: 'Plan safer approval handling for agents',
    normalizedGoal: 'Plan safer approval handling for agents',
    constraints: ['no worktrees until confirmed'],
  };

  it('parses a project intent contract', () => {
    const parsed = parseProjectIntentV1(validIntent);

    expect(parsed.intentId).toBe('intent-1');
    expect(parsed.source).toBe('Human');
    expect(parsed.constraints).toEqual(['no worktrees until confirmed']);
  });

  it('rejects unsupported trigger sources', () => {
    expect(() => parseProjectIntentV1({ ...validIntent, source: 'Webhook' })).toThrow(
      ProjectIntentParseError,
    );
  });
});

describe('parseBeadProposalV1', () => {
  const validProposal = {
    schemaVersion: 1,
    proposalId: 'proposal-1',
    title: 'Add approval review surface',
    body: 'Build a human confirmation step before agent work begins.',
    executionTier: 'HumanApprove',
    specRef: 'docs/internal/engineering-layer/build-plan.md#phase-7--intent-trigger-full-loop',
    dependsOnProposalIds: [],
    plannedEffectIds: ['effect-1'],
  };

  it('parses a bead proposal contract', () => {
    const parsed = parseBeadProposalV1(validProposal);

    expect(parsed.proposalId).toBe('proposal-1');
    expect(parsed.executionTier).toBe('HumanApprove');
    expect(parsed.plannedEffectIds).toEqual(['effect-1']);
  });

  it('rejects unsupported execution tiers', () => {
    expect(() => parseBeadProposalV1({ ...validProposal, executionTier: 'Background' })).toThrow(
      ProjectIntentParseError,
    );
  });
});
