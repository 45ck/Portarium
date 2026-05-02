import { describe, expect, it } from 'vitest';

import {
  buildWeeklyAutonomyDigestArtifactV1,
  parseWeeklyAutonomyDigestArtifactV1,
  renderWeeklyAutonomyDigestMarkdown,
  type WeeklyAutonomyDigestActionObservationV1,
} from './weekly-autonomy-digest-v1.js';

function observations(
  actionClass: string,
  count: number,
  executionTier: WeeklyAutonomyDigestActionObservationV1['executionTier'],
  options: Readonly<{ anomalies?: number; reversals?: number; startIso?: string }> = {},
): WeeklyAutonomyDigestActionObservationV1[] {
  const start = new Date(options.startIso ?? '2026-01-01T00:00:00.000Z');
  return Array.from({ length: count }, (_, index) => ({
    actionClass,
    executionTier,
    occurredAtIso: new Date(start.getTime() + index * 3_600_000).toISOString(),
    anomaly: index < (options.anomalies ?? 0),
    reversal: index < (options.reversals ?? 0),
  }));
}

describe('weekly autonomy digest artifact', () => {
  it('aggregates weekly counts by action class and tier', () => {
    const digest = buildWeeklyAutonomyDigestArtifactV1({
      artifactId: 'art-digest-1',
      workspaceId: 'ws-1',
      periodStartIso: '2026-03-24T00:00:00.000Z',
      periodEndIso: '2026-03-31T00:00:00.000Z',
      historyWindowStartIso: '2026-01-01T00:00:00.000Z',
      generatedAtIso: '2026-03-31T01:00:00.000Z',
      observations: [
        ...observations('write:lint-fix', 34, 'Auto', {
          startIso: '2026-03-24T00:00:00.000Z',
        }),
        ...observations('write:small-refactor', 4, 'Assisted', {
          anomalies: 1,
          startIso: '2026-03-24T00:00:00.000Z',
        }),
        ...observations('git:push-main', 2, 'HumanApprove', {
          reversals: 1,
          startIso: '2026-03-24T00:00:00.000Z',
        }),
      ],
      currentPolicyTiers: {
        'write:lint-fix': 'Auto',
        'write:small-refactor': 'Assisted',
        'git:push-main': 'HumanApprove',
      },
    });

    const lint = digest.actionClasses.find((item) => item.actionClass === 'write:lint-fix');
    const refactor = digest.actionClasses.find(
      (item) => item.actionClass === 'write:small-refactor',
    );
    const push = digest.actionClasses.find((item) => item.actionClass === 'git:push-main');

    expect(lint?.weekly.Auto.actions).toBe(34);
    expect(refactor?.weekly.Assisted.anomalies).toBe(1);
    expect(push?.weekly.HumanApprove.reversals).toBe(1);
    expect(digest.overall.Auto.actions).toBe(34);
    expect(digest.overall.Assisted.anomalyRate).toBe(0.25);
    expect(digest.acknowledgement.status).toBe('Unacknowledged');
    expect(digest.evidenceSemantics.acknowledgementRecordsDigestHash).toBe(true);
  });

  it('recommends promote and demote shortcuts from 90-day history without applying policy', () => {
    const digest = buildWeeklyAutonomyDigestArtifactV1({
      artifactId: 'art-digest-2',
      workspaceId: 'ws-1',
      periodStartIso: '2026-03-24T00:00:00.000Z',
      periodEndIso: '2026-03-31T00:00:00.000Z',
      historyWindowStartIso: '2026-01-01T00:00:00.000Z',
      generatedAtIso: '2026-03-31T01:00:00.000Z',
      observations: [
        ...observations('write:small-refactor', 34, 'Assisted'),
        ...observations('branch:cleanup', 20, 'Auto', { anomalies: 2 }),
      ],
      currentPolicyTiers: {
        'write:small-refactor': 'Assisted',
        'branch:cleanup': 'Auto',
      },
    });

    expect(digest.recommendedPolicyAdjustments).toEqual([
      expect.objectContaining({
        actionClass: 'branch:cleanup',
        adjustment: 'demote',
        currentTier: 'Auto',
        recommendedTier: 'Assisted',
        shortcut: expect.objectContaining({ effect: 'draft-policy-change-only' }),
      }),
      expect.objectContaining({
        actionClass: 'write:small-refactor',
        adjustment: 'promote',
        currentTier: 'Assisted',
        recommendedTier: 'Auto',
      }),
    ]);
  });

  it('renders Markdown with required acknowledgement and evidence semantics', () => {
    const digest = buildWeeklyAutonomyDigestArtifactV1({
      artifactId: 'art-digest-3',
      workspaceId: 'ws-1',
      periodStartIso: '2026-03-24T00:00:00.000Z',
      periodEndIso: '2026-03-31T00:00:00.000Z',
      historyWindowStartIso: '2026-01-01T00:00:00.000Z',
      generatedAtIso: '2026-03-31T01:00:00.000Z',
      observations: observations('write:lint-fix', 1, 'Auto', {
        startIso: '2026-03-24T00:00:00.000Z',
      }),
    });

    const markdown = renderWeeklyAutonomyDigestMarkdown(digest);

    expect(markdown).toContain('# Weekly Autonomy Digest: 2026-03-24 -> 2026-03-31');
    expect(markdown).toContain('| `write:lint-fix` | AUTO | 1 | 0 | 0 | 0.00% | 0.00% |');
    expect(markdown).toContain('Acknowledgement required: yes');
    expect(markdown).toContain('Policy shortcut effect: draft-policy-change-only');
  });

  it('parses acknowledged digest artifacts and validates acknowledgement completeness', () => {
    const digest = buildWeeklyAutonomyDigestArtifactV1({
      artifactId: 'art-digest-4',
      workspaceId: 'ws-1',
      periodStartIso: '2026-03-24T00:00:00.000Z',
      periodEndIso: '2026-03-31T00:00:00.000Z',
      historyWindowStartIso: '2026-01-01T00:00:00.000Z',
      generatedAtIso: '2026-03-31T01:00:00.000Z',
      observations: [],
      acknowledgedAtIso: '2026-03-31T02:00:00.000Z',
      acknowledgedByUserId: 'user-1',
      acknowledgementEvidenceId: 'ev-ack-1',
    });

    const parsed = parseWeeklyAutonomyDigestArtifactV1(digest);

    expect(parsed.acknowledgement.status).toBe('Acknowledged');
    expect(parsed.acknowledgement.acknowledgedByUserId).toBe('user-1');
    expect(() =>
      parseWeeklyAutonomyDigestArtifactV1({
        ...digest,
        acknowledgement: {
          required: true,
          status: 'Acknowledged',
        },
      }),
    ).toThrow(/acknowledgedAtIso/i);
  });
});
