import { describe, expect, it } from 'vitest';
import { APPROVALS, EVIDENCE, RUNS, WORK_ITEMS } from '@/mocks/fixtures/growth-studio-demo';
import {
  buildGrowthStudioDashboardModel,
  isGrowthStudioApproval,
  isGrowthStudioRun,
  isGrowthStudioWorkItem,
} from './growth-studio-dashboard';

describe('growth studio dashboard model', () => {
  it('builds funnel metrics from Growth Studio demo data', () => {
    const model = buildGrowthStudioDashboardModel({
      approvals: APPROVALS,
      runs: RUNS,
      workItems: WORK_ITEMS,
      evidence: EVIDENCE,
      now: new Date('2026-03-03T12:00:00Z'),
    });

    expect(model.hasGrowthSignals).toBe(true);
    expect(model.prospectsResearched).toBe(7);
    expect(model.pendingApprovals).toBe(2);
    expect(model.draftsCreated).toBe(2);
    expect(model.actionsExecuted).toBe(1);
    expect(model.conversionRate).toBe(14);
    expect(model.metrics.map((metric) => metric.label)).toEqual([
      'Prospects Researched',
      'Drafts Created',
      'Approvals Pending',
      'Actions Executed',
      'Conversion Rate',
    ]);
  });

  it('builds an expandable activity timeline with agent, tool, tier, and outcome metadata', () => {
    const model = buildGrowthStudioDashboardModel({
      approvals: APPROVALS,
      runs: RUNS,
      workItems: WORK_ITEMS,
      evidence: EVIDENCE,
      now: new Date('2026-03-03T12:00:00Z'),
    });

    expect(model.activity).toHaveLength(7);
    expect(model.activity[0]).toMatchObject({
      id: 'apr-gs-3007',
      persona: 'OutreachExecutor',
      tool: 'write:billing',
      tier: 'HumanApprove',
      outcome: 'Executed',
    });
    expect(model.activity[0]?.workItem?.workItemId).toBe('wi-gs-1007');
    expect(model.activity[0]?.evidence.map((entry) => entry.evidenceId)).toContain('evd-gs-4010');
  });

  it('summarizes approval policy effectiveness and latency by tier', () => {
    const model = buildGrowthStudioDashboardModel({
      approvals: APPROVALS,
      runs: RUNS,
      workItems: WORK_ITEMS,
      evidence: EVIDENCE,
      now: new Date('2026-03-03T12:00:00Z'),
    });

    expect(model.policyEffectiveness.breakdown).toEqual({
      autoApproved: 0,
      humanApproved: 3,
      denied: 1,
      requestChanges: 1,
      pending: 2,
    });
    expect(model.policyEffectiveness.sodTriggerCount).toBe(3);
    expect(model.policyEffectiveness.latencyByTier).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tier: 'Assisted', averageSeconds: 45, sampleCount: 1 }),
        expect.objectContaining({ tier: 'ManualOnly', averageSeconds: 120, sampleCount: 1 }),
        expect.objectContaining({ tier: 'HumanApprove', sampleCount: 3 }),
      ]),
    );
  });

  it('renders a zero-state model for live workspaces without Growth Studio signals', () => {
    const model = buildGrowthStudioDashboardModel({
      approvals: [],
      runs: [],
      workItems: [],
      evidence: [],
      now: new Date('2026-03-03T12:00:00Z'),
    });

    expect(model.hasGrowthSignals).toBe(false);
    expect(model.prospectsResearched).toBe(0);
    expect(model.activity).toEqual([]);
    expect(model.policyEffectiveness.breakdown).toEqual({
      autoApproved: 0,
      humanApproved: 0,
      denied: 0,
      requestChanges: 0,
      pending: 0,
    });
  });

  it('recognizes Growth Studio records by ubiquitous identifiers', () => {
    expect(isGrowthStudioWorkItem(WORK_ITEMS[0]!)).toBe(true);
    expect(isGrowthStudioRun(RUNS[0]!)).toBe(true);
    expect(isGrowthStudioApproval(APPROVALS[0]!)).toBe(true);
  });
});
