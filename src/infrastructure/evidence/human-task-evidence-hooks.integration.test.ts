import { describe, expect, it } from 'vitest';

import type { EvidenceLogPort, EvidenceEntryAppendInput } from '../../application/ports/index.js';
import { EvidencePayloadAlreadyExistsError } from '../../application/ports/evidence-payload-store.js';
import { appendEvidenceEntryV1 } from '../../domain/evidence/evidence-chain-v1.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import { CorrelationId, TenantId, UserId, WorkspaceId } from '../../domain/primitives/index.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import { InMemoryWormEvidencePayloadStore } from './in-memory-worm-evidence-payload-store.js';
import { HumanTaskEvidenceHooks } from './human-task-evidence-hooks.js';

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

  public listByWorkItem(tenantId: ReturnType<typeof TenantId>, workItemId: string): EvidenceEntryV1[] {
    return (this.#entries.get(String(tenantId)) ?? []).filter(
      (entry) => String(entry.links?.workItemId ?? '') === workItemId,
    );
  }
}

function eventOf(
  eventType: 'HumanTaskAssigned' | 'HumanTaskCompleted',
  eventId: string,
  payload: Record<string, unknown>,
): DomainEventV1 {
  return {
    schemaVersion: 1,
    eventId,
    eventType,
    aggregateKind: 'HumanTask',
    aggregateId: 'ht-1',
    occurredAtIso: '2026-02-20T10:00:00.000Z',
    workspaceId: WorkspaceId('workspace-1'),
    correlationId: CorrelationId('corr-1'),
    actorUserId: UserId('user-1'),
    payload,
  };
}

describe('HumanTaskEvidenceHooks', () => {
  it('writes WORM payloads and evidence-log entries for assigned/completed events', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const hooks = new HumanTaskEvidenceHooks({ payloadStore, evidenceLog });
    const assigned = eventOf('HumanTaskAssigned', 'evt-assign-1', {
      humanTaskId: 'ht-1',
      workItemId: 'wi-100',
      runId: 'run-100',
      stepId: 'step-approve',
    });
    const completed = eventOf('HumanTaskCompleted', 'evt-complete-1', {
      humanTaskId: 'ht-1',
      workItemId: 'wi-100',
      runId: 'run-100',
      stepId: 'step-approve',
      completionNote: 'Reviewed and completed.',
    });

    await hooks.record(assigned);
    await hooks.record(completed);

    const byWorkItem = evidenceLog.listByWorkItem(TenantId('workspace-1'), 'wi-100');
    expect(byWorkItem).toHaveLength(2);
    expect(byWorkItem[0]!.summary).toContain('HumanTaskAssigned');
    expect(byWorkItem[1]!.summary).toContain('HumanTaskCompleted');

    const assignedLocation = {
      bucket: 'evidence',
      key: 'workspaces/workspace-1/human-tasks/ht-1/evt-assign-1.json',
    } as const;
    const completedLocation = {
      bucket: 'evidence',
      key: 'workspaces/workspace-1/human-tasks/ht-1/evt-complete-1.json',
    } as const;
    expect(payloadStore.__test__get(assignedLocation)).toBeDefined();
    expect(payloadStore.__test__get(completedLocation)).toBeDefined();
  });

  it('enforces WORM no-overwrite semantics for duplicate event payload writes', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const hooks = new HumanTaskEvidenceHooks({ payloadStore, evidenceLog });
    const assigned = eventOf('HumanTaskAssigned', 'evt-assign-dup', {
      humanTaskId: 'ht-1',
      workItemId: 'wi-100',
      runId: 'run-100',
      stepId: 'step-approve',
    });

    await hooks.record(assigned);
    await expect(hooks.record(assigned)).rejects.toBeInstanceOf(EvidencePayloadAlreadyExistsError);
  });
});
