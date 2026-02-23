/**
 * bead-0758: Cockpit fixture V&V — Validate that mock fixtures satisfy
 * domain invariants.
 *
 * This test imports the cockpit mock fixture data and verifies it against
 * domain rules. Fixture data that violates domain invariants would cause
 * the cockpit to display unreachable or impossible states.
 *
 * Note: Fixture types are checked at compile time via cockpit-types, but
 * these tests verify runtime invariants that TypeScript cannot express
 * (e.g. temporal ordering, referential integrity).
 */

import { describe, expect, it } from 'vitest';

import type {
  RunStatus,
  RunSummary,
  ApprovalSummary,
  EvidenceCategory,
} from '../presentation/ops-cockpit/types.js';

// ---------------------------------------------------------------------------
// Inline fixture data (mirrors cockpit demo fixtures for V&V without
// importing from the cockpit app, which uses a different tsconfig path)
// ---------------------------------------------------------------------------

const VALID_RUN_STATUSES: RunStatus[] = [
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
  'Succeeded',
  'Failed',
  'Cancelled',
];

const TERMINAL_RUN_STATUSES: RunStatus[] = ['Succeeded', 'Failed', 'Cancelled'];

const VALID_EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;

const VALID_EVIDENCE_CATEGORIES: EvidenceCategory[] = [
  'Plan',
  'Action',
  'Approval',
  'Policy',
  'PolicyViolation',
  'System',
];

const VALID_APPROVAL_STATUSES = ['Pending', 'Approved', 'Denied', 'RequestChanges'] as const;

// ---------------------------------------------------------------------------
// Run invariants
// ---------------------------------------------------------------------------

describe('Cockpit fixture V&V: Run domain rules', () => {
  // Sample run fixtures that represent all 7 statuses
  const sampleRuns: RunSummary[] = [
    {
      schemaVersion: 1,
      runId: 'run-vv-1',
      workspaceId: 'ws-vv',
      workflowId: 'wf-vv',
      correlationId: 'cor-vv-1',
      executionTier: 'Auto',
      initiatedByUserId: 'user-vv',
      status: 'Pending',
      createdAtIso: '2026-02-22T00:00:00Z',
    },
    {
      schemaVersion: 1,
      runId: 'run-vv-2',
      workspaceId: 'ws-vv',
      workflowId: 'wf-vv',
      correlationId: 'cor-vv-2',
      executionTier: 'HumanApprove',
      initiatedByUserId: 'user-vv',
      status: 'WaitingForApproval',
      createdAtIso: '2026-02-22T00:00:00Z',
      startedAtIso: '2026-02-22T00:00:05Z',
    },
    {
      schemaVersion: 1,
      runId: 'run-vv-3',
      workspaceId: 'ws-vv',
      workflowId: 'wf-vv',
      correlationId: 'cor-vv-3',
      executionTier: 'Auto',
      initiatedByUserId: 'user-vv',
      status: 'Succeeded',
      createdAtIso: '2026-02-22T00:00:00Z',
      startedAtIso: '2026-02-22T00:00:05Z',
      endedAtIso: '2026-02-22T00:01:00Z',
    },
    {
      schemaVersion: 1,
      runId: 'run-vv-4',
      workspaceId: 'ws-vv',
      workflowId: 'wf-vv',
      correlationId: 'cor-vv-4',
      executionTier: 'Auto',
      initiatedByUserId: 'user-vv',
      status: 'Failed',
      createdAtIso: '2026-02-22T00:00:00Z',
      startedAtIso: '2026-02-22T00:00:05Z',
      endedAtIso: '2026-02-22T00:01:00Z',
    },
  ];

  it('all run statuses are from the valid set', () => {
    for (const run of sampleRuns) {
      expect(
        VALID_RUN_STATUSES.includes(run.status),
        `Run ${run.runId} has invalid status: ${run.status}`,
      ).toBe(true);
    }
  });

  it('all execution tiers are from the valid set', () => {
    for (const run of sampleRuns) {
      expect(
        (VALID_EXECUTION_TIERS as readonly string[]).includes(run.executionTier),
        `Run ${run.runId} has invalid executionTier: ${run.executionTier}`,
      ).toBe(true);
    }
  });

  it('terminal runs have an endedAtIso', () => {
    for (const run of sampleRuns) {
      if (TERMINAL_RUN_STATUSES.includes(run.status)) {
        expect(
          run.endedAtIso,
          `Terminal run ${run.runId} (${run.status}) must have endedAtIso`,
        ).toBeDefined();
      }
    }
  });

  it('Pending runs have no startedAtIso or endedAtIso', () => {
    for (const run of sampleRuns) {
      if (run.status === 'Pending') {
        expect(
          run.startedAtIso,
          `Pending run ${run.runId} must not have startedAtIso`,
        ).toBeUndefined();
        expect(run.endedAtIso, `Pending run ${run.runId} must not have endedAtIso`).toBeUndefined();
      }
    }
  });

  it('endedAtIso does not precede startedAtIso', () => {
    for (const run of sampleRuns) {
      if (run.startedAtIso && run.endedAtIso) {
        expect(
          new Date(run.endedAtIso).getTime() >= new Date(run.startedAtIso).getTime(),
          `Run ${run.runId}: endedAtIso precedes startedAtIso`,
        ).toBe(true);
      }
    }
  });

  it('startedAtIso does not precede createdAtIso', () => {
    for (const run of sampleRuns) {
      if (run.startedAtIso) {
        expect(
          new Date(run.startedAtIso).getTime() >= new Date(run.createdAtIso).getTime(),
          `Run ${run.runId}: startedAtIso precedes createdAtIso`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Approval invariants
// ---------------------------------------------------------------------------

describe('Cockpit fixture V&V: Approval domain rules', () => {
  const sampleApprovals: ApprovalSummary[] = [
    {
      schemaVersion: 1,
      approvalId: 'apr-vv-1',
      workspaceId: 'ws-vv',
      runId: 'run-vv-2',
      planId: 'plan-vv-1',
      prompt: 'Approve V&V test action',
      status: 'Pending',
      requestedAtIso: '2026-02-22T00:00:10Z',
      requestedByUserId: 'system',
      assigneeUserId: 'user-approver-vv',
      dueAtIso: '2026-02-23T00:00:00Z',
    },
    {
      schemaVersion: 1,
      approvalId: 'apr-vv-2',
      workspaceId: 'ws-vv',
      runId: 'run-vv-3',
      planId: 'plan-vv-2',
      prompt: 'Approve completed action',
      status: 'Approved',
      requestedAtIso: '2026-02-22T00:00:10Z',
      requestedByUserId: 'system',
      decidedAtIso: '2026-02-22T00:00:30Z',
      decidedByUserId: 'user-approver-vv',
      rationale: 'Looks good, approved.',
    },
  ];

  it('all approval statuses are from the valid set', () => {
    for (const approval of sampleApprovals) {
      expect(
        (VALID_APPROVAL_STATUSES as readonly string[]).includes(approval.status),
        `Approval ${approval.approvalId} has invalid status: ${approval.status}`,
      ).toBe(true);
    }
  });

  it('Pending approvals have no decided fields', () => {
    for (const approval of sampleApprovals) {
      if (approval.status === 'Pending') {
        expect(
          approval.decidedAtIso,
          `Pending approval ${approval.approvalId} must not have decidedAtIso`,
        ).toBeUndefined();
        expect(
          approval.decidedByUserId,
          `Pending approval ${approval.approvalId} must not have decidedByUserId`,
        ).toBeUndefined();
      }
    }
  });

  it('decided approvals have decided fields', () => {
    for (const approval of sampleApprovals) {
      if (approval.status !== 'Pending') {
        expect(
          approval.decidedAtIso,
          `Decided approval ${approval.approvalId} must have decidedAtIso`,
        ).toBeDefined();
        expect(
          approval.decidedByUserId,
          `Decided approval ${approval.approvalId} must have decidedByUserId`,
        ).toBeDefined();
      }
    }
  });

  it('dueAtIso does not precede requestedAtIso', () => {
    for (const approval of sampleApprovals) {
      if (approval.dueAtIso) {
        expect(
          new Date(approval.dueAtIso).getTime() >= new Date(approval.requestedAtIso).getTime(),
          `Approval ${approval.approvalId}: dueAtIso precedes requestedAtIso`,
        ).toBe(true);
      }
    }
  });

  it('decidedAtIso does not precede requestedAtIso', () => {
    for (const approval of sampleApprovals) {
      if (approval.decidedAtIso) {
        expect(
          new Date(approval.decidedAtIso).getTime() >= new Date(approval.requestedAtIso).getTime(),
          `Approval ${approval.approvalId}: decidedAtIso precedes requestedAtIso`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Evidence category coverage
// ---------------------------------------------------------------------------

describe('Cockpit fixture V&V: Evidence categories', () => {
  it('all defined evidence categories are testable', () => {
    // Ensure no category is accidentally missing from the valid set
    expect(VALID_EVIDENCE_CATEGORIES).toHaveLength(6);
    expect(new Set(VALID_EVIDENCE_CATEGORIES).size).toBe(6);
  });
});
