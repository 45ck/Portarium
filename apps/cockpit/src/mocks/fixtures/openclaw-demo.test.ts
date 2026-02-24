import { describe, expect, it } from 'vitest';
import { APPROVALS, EVIDENCE, PLANS, RUNS, WORK_ITEMS } from './openclaw-demo';

describe('openclaw-demo fixture', () => {
  it('exports an OpenClaw-only approval queue', () => {
    expect(APPROVALS.length).toBeGreaterThan(0);
    expect(APPROVALS.every((approval) => approval.approvalId.startsWith('apr-oc-'))).toBe(true);
  });

  it('keeps run/work-item/plan/evidence IDs in the openclaw namespace', () => {
    expect(RUNS.every((run) => run.runId.startsWith('run-oc-'))).toBe(true);
    expect(WORK_ITEMS.every((item) => item.workItemId.startsWith('wi-oc-'))).toBe(true);
    expect(PLANS.every((plan) => plan.planId.startsWith('plan-oc-'))).toBe(true);
    expect(EVIDENCE.every((entry) => entry.evidenceId.startsWith('evd-oc-'))).toBe(true);
  });
});
