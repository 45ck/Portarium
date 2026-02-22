import { describe, expect, it } from 'vitest';

import type { EvidenceEntryAppendInput, EvidenceLogPort } from '../../application/ports/index.js';
import { EvidencePayloadAlreadyExistsError } from '../../application/ports/evidence-payload-store.js';
import {
  appendEvidenceEntryV1,
  verifyEvidenceChainV1,
} from '../../domain/evidence/evidence-chain-v1.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import { CorrelationId, TenantId, UserId, WorkspaceId } from '../../domain/primitives/index.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import { InMemoryWormEvidencePayloadStore } from './in-memory-worm-evidence-payload-store.js';
import { ApprovalEvidenceHooks } from './approval-evidence-hooks.js';

class InMemoryEvidenceLog implements EvidenceLogPort {
  readonly #hasher = new NodeCryptoEvidenceHasher();
  readonly #entries = new Map<string, EvidenceEntryV1[]>();

  public async appendEntry(
    tenantId: ReturnType<typeof TenantId>,
    entry: EvidenceEntryAppendInput,
  ): Promise<EvidenceEntryV1> {
    const key = String(tenantId);
    const current = this.#entries.get(key) ?? [];
    const previous = current[current.length - 1];
    const next = appendEvidenceEntryV1({ previous, next: entry, hasher: this.#hasher });
    this.#entries.set(key, [...current, next]);
    return next;
  }

  public listByApproval(
    tenantId: ReturnType<typeof TenantId>,
    approvalId: string,
  ): EvidenceEntryV1[] {
    return (this.#entries.get(String(tenantId)) ?? []).filter(
      (entry) => String(entry.links?.approvalId ?? '') === approvalId,
    );
  }

  public listAll(tenantId: ReturnType<typeof TenantId>): EvidenceEntryV1[] {
    return this.#entries.get(String(tenantId)) ?? [];
  }
}

function approvalEventOf(
  eventType:
    | 'ApprovalRequested'
    | 'ApprovalGranted'
    | 'ApprovalDenied'
    | 'ApprovalChangesRequested',
  eventId: string,
  payload: Record<string, unknown>,
): DomainEventV1 {
  return {
    schemaVersion: 1,
    eventId,
    eventType,
    aggregateKind: 'Approval',
    aggregateId: 'approval-1',
    occurredAtIso: '2026-02-23T10:00:00.000Z',
    workspaceId: WorkspaceId('ws-approval-test'),
    correlationId: CorrelationId('corr-approval-1'),
    actorUserId: UserId('user-reviewer-1'),
    payload,
  };
}

const BASE_APPROVAL_PAYLOAD = {
  approvalId: 'approval-1',
  workspaceId: 'ws-approval-test',
  runId: 'run-approval-1',
  planId: 'plan-1',
  prompt: 'Approve deployment to production',
  requestedAtIso: '2026-02-23T09:00:00.000Z',
  requestedByUserId: 'user-requester-1',
  status: 'Pending',
};

describe('ApprovalEvidenceHooks', () => {
  it('records all 4 approval lifecycle events as hash-chained evidence entries', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const hooks = new ApprovalEvidenceHooks({ payloadStore, evidenceLog });

    const requested = approvalEventOf('ApprovalRequested', 'evt-req-1', BASE_APPROVAL_PAYLOAD);
    const granted = approvalEventOf('ApprovalGranted', 'evt-grant-1', {
      ...BASE_APPROVAL_PAYLOAD,
      status: 'Approved',
      decidedByUserId: 'user-reviewer-1',
      decidedAtIso: '2026-02-23T10:00:00.000Z',
      rationale: 'All checks passed, deployment approved.',
    });
    const denied = approvalEventOf('ApprovalDenied', 'evt-deny-1', {
      ...BASE_APPROVAL_PAYLOAD,
      approvalId: 'approval-2',
      runId: 'run-approval-2',
      status: 'Denied',
      decidedByUserId: 'user-reviewer-1',
      decidedAtIso: '2026-02-23T10:01:00.000Z',
      rationale: 'Risk level too high.',
    });
    const changesRequested = approvalEventOf('ApprovalChangesRequested', 'evt-changes-1', {
      ...BASE_APPROVAL_PAYLOAD,
      approvalId: 'approval-3',
      runId: 'run-approval-3',
      status: 'RequestChanges',
      decidedByUserId: 'user-reviewer-1',
      decidedAtIso: '2026-02-23T10:02:00.000Z',
      rationale: 'Please add rollback plan before re-submitting.',
    });

    await hooks.record(requested);
    await hooks.record(granted);
    await hooks.record(denied);
    await hooks.record(changesRequested);

    const allEntries = evidenceLog.listAll(TenantId('ws-approval-test'));
    expect(allEntries).toHaveLength(4);

    // Verify categories
    expect(allEntries.every((e) => e.category === 'Approval')).toBe(true);

    // Verify summaries
    expect(allEntries[0]!.summary).toContain('ApprovalRequested');
    expect(allEntries[1]!.summary).toContain('ApprovalGranted');
    expect(allEntries[2]!.summary).toContain('ApprovalDenied');
    expect(allEntries[3]!.summary).toContain('ApprovalChangesRequested');

    // Verify all entries have payload refs
    expect(allEntries.every((e) => (e.payloadRefs?.length ?? 0) >= 1)).toBe(true);

    // Verify hash-chain integrity
    const verify = verifyEvidenceChainV1(allEntries, new NodeCryptoEvidenceHasher());
    expect(verify.ok).toBe(true);
  });

  it('links evidence entries to both approvalId and runId', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const hooks = new ApprovalEvidenceHooks({ payloadStore, evidenceLog });

    const granted = approvalEventOf('ApprovalGranted', 'evt-grant-link-1', {
      ...BASE_APPROVAL_PAYLOAD,
      status: 'Approved',
      decidedByUserId: 'user-reviewer-1',
      decidedAtIso: '2026-02-23T10:00:00.000Z',
      rationale: 'LGTM',
    });

    await hooks.record(granted);

    const byApproval = evidenceLog.listByApproval(TenantId('ws-approval-test'), 'approval-1');
    expect(byApproval).toHaveLength(1);

    const entry = byApproval[0]!;
    expect(String(entry.links?.approvalId ?? '')).toBe('approval-1');
    expect(String(entry.links?.runId ?? '')).toBe('run-approval-1');
  });

  it('includes decision and rationale in the evidence summary', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const hooks = new ApprovalEvidenceHooks({ payloadStore, evidenceLog });

    const denied = approvalEventOf('ApprovalDenied', 'evt-deny-detail-1', {
      ...BASE_APPROVAL_PAYLOAD,
      status: 'Denied',
      decidedByUserId: 'user-reviewer-1',
      decidedAtIso: '2026-02-23T10:00:00.000Z',
      rationale: 'Not enough reviewers.',
    });

    await hooks.record(denied);

    const entries = evidenceLog.listByApproval(TenantId('ws-approval-test'), 'approval-1');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.summary).toContain('Denied');
  });

  it('enforces WORM no-overwrite semantics for duplicate approval event payload writes', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const hooks = new ApprovalEvidenceHooks({ payloadStore, evidenceLog });

    const event = approvalEventOf('ApprovalGranted', 'evt-grant-dup-1', {
      ...BASE_APPROVAL_PAYLOAD,
      status: 'Approved',
      decidedByUserId: 'user-reviewer-1',
      decidedAtIso: '2026-02-23T10:00:00.000Z',
      rationale: 'Approved.',
    });

    await hooks.record(event);
    await expect(hooks.record(event)).rejects.toBeInstanceOf(EvidencePayloadAlreadyExistsError);
  });

  it('sets long compliance retention (≥7 years) on the approval payload', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const hooks = new ApprovalEvidenceHooks({ payloadStore, evidenceLog });

    const event = approvalEventOf('ApprovalGranted', 'evt-grant-worm-1', {
      ...BASE_APPROVAL_PAYLOAD,
      status: 'Approved',
      decidedByUserId: 'user-reviewer-1',
      decidedAtIso: '2026-02-23T10:00:00.000Z',
      rationale: 'All good.',
    });
    await hooks.record(event);

    const key = `workspaces/${encodeURIComponent('ws-approval-test')}/approvals/${encodeURIComponent('approval-1')}/${encodeURIComponent('evt-grant-worm-1')}.json`;
    const stored = payloadStore.__test__get({ bucket: 'evidence', key });
    expect(stored).toBeDefined();
    expect(stored!.lockMode).toBe('COMPLIANCE');

    const eventAt = new Date('2026-02-23T10:00:00.000Z').getTime();
    const sevenYearsMs = 7 * 365 * 86_400_000;
    expect((stored!.retainUntilMs ?? 0) - eventAt).toBeGreaterThanOrEqual(sevenYearsMs);
  });

  it('ignores non-approval domain events', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const hooks = new ApprovalEvidenceHooks({ payloadStore, evidenceLog });

    const unrelated: DomainEventV1 = {
      schemaVersion: 1,
      eventId: 'evt-unrelated-1',
      eventType: 'ActionDispatched',
      aggregateKind: 'Run',
      aggregateId: 'run-99',
      occurredAtIso: '2026-02-23T10:00:00.000Z',
      workspaceId: WorkspaceId('ws-approval-test'),
      correlationId: CorrelationId('corr-approval-1'),
      payload: { runId: 'run-99', actionId: 'action-1' },
    };

    await hooks.record(unrelated);

    expect(evidenceLog.listAll(TenantId('ws-approval-test'))).toHaveLength(0);
  });

  it('records evidence with actor from event actorUserId', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const hooks = new ApprovalEvidenceHooks({ payloadStore, evidenceLog });

    const event = approvalEventOf('ApprovalGranted', 'evt-grant-actor-1', {
      ...BASE_APPROVAL_PAYLOAD,
      status: 'Approved',
      decidedByUserId: 'user-reviewer-1',
      decidedAtIso: '2026-02-23T10:00:00.000Z',
      rationale: 'Looks good.',
    });
    await hooks.record(event);

    const entries = evidenceLog.listByApproval(TenantId('ws-approval-test'), 'approval-1');
    expect(entries).toHaveLength(1);
    const actor = entries[0]!.actor;
    expect(actor.kind).toBe('User');
    if (actor.kind === 'User') {
      expect(String(actor.userId)).toBe('user-reviewer-1');
    }
  });

  it('approval evidence from a governed run produces a valid chain for the release gate', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const hooks = new ApprovalEvidenceHooks({ payloadStore, evidenceLog });

    // Simulate: approval requested → approved → evidence chain for governed run
    const requested = approvalEventOf('ApprovalRequested', 'evt-req-chain-1', {
      ...BASE_APPROVAL_PAYLOAD,
      approvalId: 'approval-chain-1',
      runId: 'run-chain-1',
    });
    const granted = approvalEventOf('ApprovalGranted', 'evt-grant-chain-1', {
      ...BASE_APPROVAL_PAYLOAD,
      approvalId: 'approval-chain-1',
      runId: 'run-chain-1',
      status: 'Approved',
      decidedByUserId: 'user-reviewer-1',
      decidedAtIso: '2026-02-23T10:05:00.000Z',
      rationale: 'SLOs are met, approved.',
    });

    await hooks.record(requested);
    await hooks.record(granted);

    const byApproval = evidenceLog.listByApproval(TenantId('ws-approval-test'), 'approval-chain-1');
    expect(byApproval).toHaveLength(2);

    // Both entries must link to the same runId
    const runIds = byApproval.map((e) => String(e.links?.runId ?? ''));
    expect(runIds).toEqual(['run-chain-1', 'run-chain-1']);

    // ApprovalId must be tracked on every entry
    const approvalIds = byApproval.map((e) => String(e.links?.approvalId ?? ''));
    expect(approvalIds).toEqual(['approval-chain-1', 'approval-chain-1']);

    // Chain must be intact
    const allEntries = evidenceLog.listAll(TenantId('ws-approval-test'));
    const verify = verifyEvidenceChainV1(allEntries, new NodeCryptoEvidenceHasher());
    expect(verify.ok).toBe(true);

    // At least one Approval-category entry exists for the run — satisfies release gate
    const approvalEvidence = allEntries.filter((e) => e.category === 'Approval');
    expect(approvalEvidence.length).toBeGreaterThanOrEqual(1);
    const runEvidence = approvalEvidence.filter(
      (e) => String(e.links?.runId ?? '') === 'run-chain-1',
    );
    expect(runEvidence.length).toBeGreaterThanOrEqual(1);
  });
});
