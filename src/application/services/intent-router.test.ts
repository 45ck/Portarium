import { describe, expect, it } from 'vitest';
import { routeProjectIntent, IntentRouterValidationError } from './intent-router.js';

describe('routeProjectIntent', () => {
  it('normalizes a human trigger into a project intent, bead proposals, and a plan artifact', () => {
    let id = 0;
    const result = routeProjectIntent(
      {
        workspaceId: 'ws-1',
        actorUserId: 'user-1',
        triggerText: '  add approval queue summary; add mobile tests  ',
        constraints: ['Keep worktrees gated until approval'],
      },
      {
        clock: { nowIso: () => '2026-04-29T00:00:00.000Z' },
        idGenerator: { generateId: () => `${++id}` },
      },
    );

    expect(result.intent.normalizedGoal).toBe('add approval queue summary; add mobile tests');
    expect(result.proposals).toHaveLength(2);
    expect(result.proposals[0]).toMatchObject({
      executionTier: 'HumanApprove',
      dependsOnProposalIds: [],
    });
    expect(result.proposals[1]?.dependsOnProposalIds).toEqual([result.proposals[0]?.proposalId]);
    expect(result.plan.plannedEffects).toHaveLength(2);
    expect(result.artifact.markdown).toContain('Human approval is required');
  });

  it('rejects vague trigger text', () => {
    expect(() =>
      routeProjectIntent(
        {
          workspaceId: 'ws-1',
          actorUserId: 'user-1',
          triggerText: 'fix',
        },
        {
          clock: { nowIso: () => '2026-04-29T00:00:00.000Z' },
          idGenerator: { generateId: () => '1' },
        },
      ),
    ).toThrow(IntentRouterValidationError);
  });
});
