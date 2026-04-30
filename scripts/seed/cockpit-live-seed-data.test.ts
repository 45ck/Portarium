import { describe, expect, it } from 'vitest';

import {
  COCKPIT_LIVE_SEED_DEFAULTS,
  COCKPIT_LIVE_SEED_IDS,
  createCockpitLiveSeedBundle,
  createCockpitLiveSeedSummary,
  validateCockpitLiveSeedBundle,
} from './cockpit-live-seed-data.js';

describe('cockpit live seed data', () => {
  it('builds a valid parser-backed ws-local-dev bundle', () => {
    const bundle = createCockpitLiveSeedBundle();

    expect(String(bundle.tenantId)).toBe(COCKPIT_LIVE_SEED_DEFAULTS.tenantId);
    expect(String(bundle.workspaceId)).toBe(COCKPIT_LIVE_SEED_DEFAULTS.workspaceId);
    expect(String(bundle.workspace.workspaceId)).toBe('ws-local-dev');
    expect(validateCockpitLiveSeedBundle(bundle)).toEqual([]);
  });

  it('covers the Cockpit live pages and write-smoke target', () => {
    const bundle = createCockpitLiveSeedBundle();

    expect(bundle.runs.map((run) => run.status)).toEqual(
      expect.arrayContaining(['WaitingForApproval', 'Running', 'Succeeded', 'Failed']),
    );
    expect(bundle.evidence.map((entry) => entry.category)).toEqual(
      expect.arrayContaining(['Plan', 'Approval', 'Action', 'System']),
    );
    expect(bundle.approvals).toContainEqual(
      expect.objectContaining({
        approvalId: 'apr-live-001',
        status: 'Pending',
        runId: 'run-live-001',
        planId: 'plan-live-001',
      }),
    );
    expect(bundle.workItems.map((item) => String(item.workItemId))).toEqual(
      expect.arrayContaining([...COCKPIT_LIVE_SEED_IDS.workItems]),
    );
  });

  it('summarises the deterministic IDs used by the runbook', () => {
    const summary = createCockpitLiveSeedSummary(createCockpitLiveSeedBundle());

    expect(summary.keyIds).toEqual({
      pendingApprovalId: 'apr-live-001',
      writableRunId: 'run-live-001',
      primaryWorkItemId: 'wi-live-001',
    });
    expect(summary.counts.runs).toBe(4);
    expect(summary.counts.approvals).toBe(2);
    expect(summary.counts.evidence).toBe(4);
  });
});
