import { describe, expect, it } from 'vitest';
import {
  ADAPTERS,
  AGENTS,
  APPROVALS,
  CREDENTIAL_GRANTS,
  EVIDENCE,
  MACHINES,
  MISSIONS,
  PLANS,
  ROBOTS,
  RUNS,
  SAFETY_CONSTRAINTS,
  WORK_ITEMS,
} from './platform-showcase';

describe('platform showcase fixture', () => {
  it('uses a neutral workspace across Cockpit control-plane records', () => {
    const workspaceRecords = [
      ...WORK_ITEMS,
      ...RUNS,
      ...APPROVALS,
      ...PLANS,
      ...EVIDENCE,
      ...AGENTS,
      ...MACHINES,
      ...CREDENTIAL_GRANTS,
    ];

    expect(workspaceRecords).not.toHaveLength(0);
    expect(new Set(workspaceRecords.map((record) => record.workspaceId))).toEqual(
      new Set(['ws-platform-showcase']),
    );
  });

  it('covers useful non-prototype Cockpit surfaces without enabling robotics fixtures', () => {
    expect(WORK_ITEMS.length).toBeGreaterThanOrEqual(5);
    expect(RUNS.map((run) => run.status)).toEqual(
      expect.arrayContaining(['Running', 'WaitingForApproval', 'Succeeded', 'Failed', 'Paused']),
    );
    expect(APPROVALS.some((approval) => approval.status === 'Pending')).toBe(true);
    expect(EVIDENCE.length).toBeGreaterThanOrEqual(APPROVALS.length);
    expect(ADAPTERS.map((adapter) => adapter.status)).toEqual(
      expect.arrayContaining(['healthy', 'degraded']),
    );
    expect(ROBOTS).toEqual([]);
    expect(MISSIONS).toEqual([]);
    expect(SAFETY_CONSTRAINTS).toEqual([]);
  });
});
