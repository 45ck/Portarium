import { describe, expect, it } from 'vitest';

import { buildApprovalCardContract } from '@/components/cockpit/triage-card/approval-card-contract';
import { verifyChain } from '@/components/cockpit/triage-modes/lib/chain-verification';
import { DATASETS } from './index';
import { APPROVALS, EVIDENCE, PLANS, RUNS, WORK_ITEMS } from './growth-studio-demo';

describe('Growth Studio fixture dataset', () => {
  it('is registered as a loadable mock dataset', async () => {
    const entry = DATASETS.find((dataset) => dataset.id === 'growth-studio');
    expect(entry).toBeDefined();

    const loaded = await entry!.load();
    expect(loaded.APPROVALS).toHaveLength(7);
    expect(loaded.WORK_ITEMS).toHaveLength(7);
    expect(loaded.EVIDENCE).toHaveLength(10);
  });

  it('covers the requested approval status mix across the full growth loop', () => {
    const counts = APPROVALS.reduce<Record<string, number>>((acc, approval) => {
      acc[approval.status] = (acc[approval.status] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts).toMatchObject({
      Pending: 2,
      Approved: 2,
      Denied: 1,
      Executed: 1,
      RequestChanges: 1,
    });
    expect(APPROVALS.map((approval) => approval.workItemId)).toEqual([
      'wi-gs-1001',
      'wi-gs-1002',
      'wi-gs-1003',
      'wi-gs-1004',
      'wi-gs-1005',
      'wi-gs-1006',
      'wi-gs-1007',
    ]);
  });

  it('embeds realistic prospect context and policy evaluation results', () => {
    const prospectText = JSON.stringify({ WORK_ITEMS, PLANS, APPROVALS });
    expect(prospectText).toContain('Northstar Health');
    expect(prospectText).toContain('Graphite Robotics');
    expect(prospectText).toContain('Atlas Retail');
    expect(prospectText).toContain('Harbor Foods');
    expect(prospectText).toContain('Vela Clinics');

    expect(APPROVALS.every((approval) => approval.policyRule)).toBe(true);
    expect(APPROVALS.every((approval) => approval.policyRule?.ruleId.startsWith('GROWTH-'))).toBe(
      true,
    );
    expect(EVIDENCE.some((entry) => entry.category === 'Policy')).toBe(true);
    expect(EVIDENCE.some((entry) => entry.category === 'PolicyViolation')).toBe(true);
  });

  it('keeps evidence hash links valid in timestamp order', () => {
    const checked = verifyChain(EVIDENCE);
    expect(checked).toHaveLength(EVIDENCE.length);
    expect(checked.slice(1).every((entry) => entry.chainValid === true)).toBe(true);
  });

  it('provides card-deck context for every approval', () => {
    for (const approval of APPROVALS) {
      const plan = PLANS.find((item) => item.planId === approval.planId);
      const run = RUNS.find((item) => item.runId === approval.runId);
      const evidenceEntries = EVIDENCE.filter(
        (entry) =>
          entry.links?.approvalId === approval.approvalId ||
          entry.links?.runId === approval.runId ||
          entry.links?.workItemId === approval.workItemId,
      );

      expect(plan, `${approval.approvalId} has a plan`).toBeDefined();
      expect(run, `${approval.approvalId} has a run`).toBeDefined();
      expect(plan!.plannedEffects.length, `${approval.approvalId} has effects`).toBeGreaterThan(0);
      expect(evidenceEntries.length, `${approval.approvalId} has evidence`).toBeGreaterThan(0);

      const contract = buildApprovalCardContract({
        approval,
        plannedEffects: plan!.plannedEffects,
        evidenceEntries,
        run,
      });
      expect(contract.fields.proposedAction.value).not.toContain('No planned effects');
      expect(contract.fields.policyResult.value).toContain(approval.policyRule!.tier);
    }
  });
});
