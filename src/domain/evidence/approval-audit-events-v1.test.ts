import { describe, expect, it } from 'vitest';

import {
  buildApprovalAuditEntry,
  isApprovalAuditEventKind,
  type ApprovalAuditEventDetail,
  type ApprovalAuditEventKind,
  type BuildApprovalAuditEntryParams,
} from './approval-audit-events-v1.js';
import type { EvidenceEntryV1 } from './evidence-entry-v1.js';
import type {
  ApprovalId,
  CorrelationId,
  EvidenceId,
  HashSha256,
  PolicyId,
  RunId,
  UserId,
  WorkspaceId,
} from '../primitives/index.js';
import type { EvidenceHasher } from './evidence-hasher.js';

// ---------------------------------------------------------------------------
// Test hasher (deterministic, for testing only)
// ---------------------------------------------------------------------------

const testHasher: EvidenceHasher = {
  sha256Hex(input: string): HashSha256 {
    // Simple deterministic hash for testing — NOT cryptographic
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }
    return `sha256-${String(Math.abs(hash)).padStart(64, '0')}` as HashSha256;
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseParams(
  detail: ApprovalAuditEventDetail,
  previousEntry?: EvidenceEntryV1,
): BuildApprovalAuditEntryParams {
  return {
    evidenceId: 'evi-test-1' as EvidenceId,
    workspaceId: 'ws-1' as WorkspaceId,
    correlationId: 'cor-1' as CorrelationId,
    occurredAtIso: '2026-02-23T12:00:00Z',
    actor: { kind: 'User', userId: 'usr-1' as UserId },
    detail,
    hasher: testHasher,
    ...(previousEntry !== undefined ? { previousEntry } : {}),
  };
}

const APPROVAL_ID = 'appr-1' as ApprovalId;

// ---------------------------------------------------------------------------
// buildApprovalAuditEntry — one test per event kind
// ---------------------------------------------------------------------------

describe('buildApprovalAuditEntry', () => {
  it('creates an entry for approval_opened', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'approval_opened',
      approvalId: APPROVAL_ID,
      requestedByUserId: 'usr-alice' as UserId,
      payloadHash: 'sha256-abc' as HashSha256,
      prompt: 'Deploy to production',
    };
    const entry = buildApprovalAuditEntry(baseParams(detail));

    expect(entry.schemaVersion).toBe(1);
    expect(entry.category).toBe('Approval');
    expect(entry.summary).toContain('appr-1');
    expect(entry.summary).toContain('usr-alice');
    expect(entry.summary).toContain('Deploy to production');
    expect(entry.links?.approvalId).toBe(APPROVAL_ID);
    expect(entry.hashSha256).toBeTruthy();
    expect(entry.previousHash).toBeUndefined();
  });

  it('creates an entry for policy_evaluated', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'policy_evaluated',
      approvalId: APPROVAL_ID,
      policyId: 'pol-sod-1' as PolicyId,
      outcome: 'needs_human',
      explanation: 'SoD rule requires a different approver',
    };
    const entry = buildApprovalAuditEntry(baseParams(detail));

    expect(entry.category).toBe('Policy');
    expect(entry.summary).toContain('pol-sod-1');
    expect(entry.summary).toContain('needs_human');
    expect(entry.summary).toContain('SoD rule');
  });

  it('creates an entry for approval_assigned', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'approval_assigned',
      approvalId: APPROVAL_ID,
      assigneeUserId: 'usr-bob' as UserId,
      reason: 'Policy-driven assignment',
    };
    const entry = buildApprovalAuditEntry(baseParams(detail));

    expect(entry.category).toBe('Approval');
    expect(entry.summary).toContain('usr-bob');
    expect(entry.summary).toContain('Policy-driven');
  });

  it('creates an entry for decision_recorded (Approved)', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'decision_recorded',
      approvalId: APPROVAL_ID,
      decision: 'Approved',
      decidedByUserId: 'usr-bob' as UserId,
      rationale: 'Verified and looks good',
      payloadHashAtDecision: 'sha256-xyz' as HashSha256,
    };
    const entry = buildApprovalAuditEntry(baseParams(detail));

    expect(entry.category).toBe('Approval');
    expect(entry.summary).toContain('Approved');
    expect(entry.summary).toContain('usr-bob');
    expect(entry.summary).toContain('Verified');
  });

  it('creates an entry for decision_recorded (Denied)', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'decision_recorded',
      approvalId: APPROVAL_ID,
      decision: 'Denied',
      decidedByUserId: 'usr-carol' as UserId,
      rationale: 'Insufficient evidence',
      payloadHashAtDecision: 'sha256-xyz' as HashSha256,
    };
    const entry = buildApprovalAuditEntry(baseParams(detail));

    expect(entry.summary).toContain('Denied');
    expect(entry.summary).toContain('usr-carol');
  });

  it('creates an entry for changes_requested', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'changes_requested',
      approvalId: APPROVAL_ID,
      requestedByUserId: 'usr-carol' as UserId,
      feedback: 'Please update the blast radius analysis',
    };
    const entry = buildApprovalAuditEntry(baseParams(detail));

    expect(entry.category).toBe('Approval');
    expect(entry.summary).toContain('Changes requested');
    expect(entry.summary).toContain('blast radius');
  });

  it('creates an entry for approval_reopened', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'approval_reopened',
      approvalId: APPROVAL_ID,
      reopenedByUserId: 'usr-alice' as UserId,
      reason: 'Changes addressed',
    };
    const entry = buildApprovalAuditEntry(baseParams(detail));

    expect(entry.category).toBe('Approval');
    expect(entry.summary).toContain('reopened');
    expect(entry.summary).toContain('usr-alice');
  });

  it('creates an entry for approval_executed', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'approval_executed',
      approvalId: APPROVAL_ID,
      runId: 'run-42' as RunId,
    };
    const entry = buildApprovalAuditEntry(baseParams(detail));

    expect(entry.category).toBe('Action');
    expect(entry.summary).toContain('executed');
    expect(entry.summary).toContain('run-42');
  });

  it('creates an entry for effects_applied', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'effects_applied',
      approvalId: APPROVAL_ID,
      runId: 'run-42' as RunId,
      effectCount: 3,
      effectsSummary: 'Updated 3 records in Salesforce',
    };
    const entry = buildApprovalAuditEntry(baseParams(detail));

    expect(entry.category).toBe('Action');
    expect(entry.summary).toContain('3 effect(s)');
    expect(entry.summary).toContain('Salesforce');
  });

  it('creates an entry for rollback_executed', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'rollback_executed',
      approvalId: APPROVAL_ID,
      runId: 'run-42' as RunId,
      reason: 'Post-execution validation failed',
    };
    const entry = buildApprovalAuditEntry(baseParams(detail));

    expect(entry.category).toBe('Action');
    expect(entry.summary).toContain('Rollback');
    expect(entry.summary).toContain('validation failed');
  });

  it('creates an entry for approval_expired', () => {
    const detail: ApprovalAuditEventDetail = {
      kind: 'approval_expired',
      approvalId: APPROVAL_ID,
      expiredAtIso: '2026-02-24T00:00:00Z',
    };
    const entry = buildApprovalAuditEntry(baseParams({ ...detail }, undefined));

    expect(entry.category).toBe('System');
    expect(entry.summary).toContain('expired');
    expect(entry.summary).toContain('2026-02-24');
  });
});

// ---------------------------------------------------------------------------
// Chain linking
// ---------------------------------------------------------------------------

describe('buildApprovalAuditEntry — chain linking', () => {
  it('sets previousHash when a previous entry is provided', () => {
    const first = buildApprovalAuditEntry(
      baseParams({
        kind: 'approval_opened',
        approvalId: APPROVAL_ID,
        requestedByUserId: 'usr-alice' as UserId,
        payloadHash: 'sha256-abc' as HashSha256,
        prompt: 'First',
      }),
    );

    const second = buildApprovalAuditEntry({
      ...baseParams({
        kind: 'approval_assigned',
        approvalId: APPROVAL_ID,
        assigneeUserId: 'usr-bob' as UserId,
        reason: 'Auto-assigned',
      }),
      evidenceId: 'evi-test-2' as EvidenceId,
      occurredAtIso: '2026-02-23T12:01:00Z',
      previousEntry: first,
    });

    expect(second.previousHash).toBe(first.hashSha256);
  });

  it('produces different hashes for different events', () => {
    const entry1 = buildApprovalAuditEntry(
      baseParams({
        kind: 'approval_opened',
        approvalId: APPROVAL_ID,
        requestedByUserId: 'usr-alice' as UserId,
        payloadHash: 'sha256-abc' as HashSha256,
        prompt: 'Event A',
      }),
    );

    const entry2 = buildApprovalAuditEntry({
      ...baseParams({
        kind: 'approval_opened',
        approvalId: APPROVAL_ID,
        requestedByUserId: 'usr-alice' as UserId,
        payloadHash: 'sha256-abc' as HashSha256,
        prompt: 'Event B',
      }),
      evidenceId: 'evi-test-2' as EvidenceId,
    });

    expect(entry1.hashSha256).not.toBe(entry2.hashSha256);
  });

  it('builds a 3-entry chain with correct hash linking', () => {
    const e1 = buildApprovalAuditEntry(
      baseParams({
        kind: 'approval_opened',
        approvalId: APPROVAL_ID,
        requestedByUserId: 'usr-alice' as UserId,
        payloadHash: 'sha256-abc' as HashSha256,
        prompt: 'Chain test',
      }),
    );

    const e2 = buildApprovalAuditEntry({
      ...baseParams({
        kind: 'policy_evaluated',
        approvalId: APPROVAL_ID,
        policyId: 'pol-1' as PolicyId,
        outcome: 'pass',
        explanation: 'All clear',
      }),
      evidenceId: 'evi-2' as EvidenceId,
      occurredAtIso: '2026-02-23T12:01:00Z',
      previousEntry: e1,
    });

    const e3 = buildApprovalAuditEntry({
      ...baseParams({
        kind: 'decision_recorded',
        approvalId: APPROVAL_ID,
        decision: 'Approved',
        decidedByUserId: 'usr-bob' as UserId,
        rationale: 'LGTM',
        payloadHashAtDecision: 'sha256-abc' as HashSha256,
      }),
      evidenceId: 'evi-3' as EvidenceId,
      occurredAtIso: '2026-02-23T12:02:00Z',
      previousEntry: e2,
    });

    expect(e1.previousHash).toBeUndefined();
    expect(e2.previousHash).toBe(e1.hashSha256);
    expect(e3.previousHash).toBe(e2.hashSha256);

    // All hashes are distinct
    const hashes = new Set([e1.hashSha256, e2.hashSha256, e3.hashSha256]);
    expect(hashes.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// isApprovalAuditEventKind
// ---------------------------------------------------------------------------

describe('isApprovalAuditEventKind', () => {
  const validKinds: ApprovalAuditEventKind[] = [
    'approval_opened',
    'policy_evaluated',
    'approval_assigned',
    'decision_recorded',
    'changes_requested',
    'approval_reopened',
    'approval_executed',
    'effects_applied',
    'rollback_executed',
    'approval_expired',
  ];

  it.each(validKinds)('returns true for %s', (kind) => {
    expect(isApprovalAuditEventKind(kind)).toBe(true);
  });

  it('returns false for unknown kind', () => {
    expect(isApprovalAuditEventKind('unknown_event')).toBe(false);
    expect(isApprovalAuditEventKind('')).toBe(false);
    expect(isApprovalAuditEventKind('ApprovalOpened')).toBe(false);
  });

  it('all 10 event kinds are valid', () => {
    expect(validKinds).toHaveLength(10);
    for (const kind of validKinds) {
      expect(isApprovalAuditEventKind(kind)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Actor types
// ---------------------------------------------------------------------------

describe('buildApprovalAuditEntry — actor types', () => {
  it('accepts Machine actor', () => {
    const entry = buildApprovalAuditEntry({
      ...baseParams({
        kind: 'approval_expired',
        approvalId: APPROVAL_ID,
        expiredAtIso: '2026-02-24T00:00:00Z',
      }),
      actor: { kind: 'System' },
    });

    expect(entry.actor.kind).toBe('System');
  });

  it('preserves User actor identity', () => {
    const entry = buildApprovalAuditEntry(
      baseParams({
        kind: 'decision_recorded',
        approvalId: APPROVAL_ID,
        decision: 'Approved',
        decidedByUserId: 'usr-specific' as UserId,
        rationale: 'Approved',
        payloadHashAtDecision: 'sha256-abc' as HashSha256,
      }),
    );

    expect(entry.actor).toEqual({ kind: 'User', userId: 'usr-1' });
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('buildApprovalAuditEntry — immutability', () => {
  it('returned entry has hashSha256 set', () => {
    const entry = buildApprovalAuditEntry(
      baseParams({
        kind: 'approval_opened',
        approvalId: APPROVAL_ID,
        requestedByUserId: 'usr-alice' as UserId,
        payloadHash: 'sha256-abc' as HashSha256,
        prompt: 'Test',
      }),
    );

    expect(typeof entry.hashSha256).toBe('string');
    expect(entry.hashSha256.length).toBeGreaterThan(0);
  });
});
