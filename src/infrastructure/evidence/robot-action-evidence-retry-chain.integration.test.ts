import { describe, expect, it } from 'vitest';

import type {
  EvidenceEntryAppendInput,
  EvidenceLogPort,
  EventPublisher,
} from '../../application/ports/index.js';
import { EvidencePayloadAlreadyExistsError } from '../../application/ports/evidence-payload-store.js';
import {
  appendEvidenceEntryV1,
  verifyEvidenceChainV1,
} from '../../domain/evidence/evidence-chain-v1.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import { CorrelationId, TenantId, UserId, WorkspaceId } from '../../domain/primitives/index.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import { AgentActionEvidenceHooks } from './agent-action-evidence-hooks.js';
import { InMemoryWormEvidencePayloadStore } from './in-memory-worm-evidence-payload-store.js';

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

  public listByRun(tenantId: ReturnType<typeof TenantId>, runId: string): EvidenceEntryV1[] {
    return (this.#entries.get(String(tenantId)) ?? []).filter(
      (entry) => String(entry.links?.runId ?? '') === runId,
    );
  }
}

class InMemoryEventPublisher implements EventPublisher {
  readonly events: PortariumCloudEventV1[] = [];

  public async publish(event: PortariumCloudEventV1): Promise<void> {
    this.events.push(event);
  }
}

function agentEvent(
  eventType: 'ActionDispatched' | 'ActionCompleted' | 'ActionFailed',
  eventId: string,
  occurredAtIso: string,
  payload: Record<string, unknown>,
): DomainEventV1 {
  return {
    schemaVersion: 1,
    eventId,
    eventType,
    aggregateKind: 'Run',
    aggregateId: 'run-robot-1',
    occurredAtIso,
    workspaceId: WorkspaceId('workspace-robotics-1'),
    correlationId: CorrelationId('corr-robot-1'),
    actorUserId: UserId('operator-1'),
    payload,
  };
}

describe('robot action evidence chain under adversarial retries', () => {
  it('keeps a valid append-only chain across repeated retries for the same action', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const eventPublisher = new InMemoryEventPublisher();
    const hooks = new AgentActionEvidenceHooks({ payloadStore, evidenceLog, eventPublisher });

    const retryEvents: DomainEventV1[] = [
      agentEvent('ActionDispatched', 'evt-r0-dispatched', '2026-02-22T00:00:00.000Z', {
        runId: 'run-robot-1',
        actionId: 'action-robot-1',
        machineId: 'machine-robot-1',
        toolName: 'robot:execute_action',
        status: 'queued',
      }),
      agentEvent('ActionFailed', 'evt-r1-failed', '2026-02-22T00:00:01.000Z', {
        runId: 'run-robot-1',
        actionId: 'action-robot-1',
        machineId: 'machine-robot-1',
        toolName: 'robot:execute_action',
        status: 'failed',
        errorMessage: 'Timeout during retry #1',
      }),
      agentEvent('ActionDispatched', 'evt-r1-dispatched', '2026-02-22T00:00:02.000Z', {
        runId: 'run-robot-1',
        actionId: 'action-robot-1',
        machineId: 'machine-robot-1',
        toolName: 'robot:execute_action',
        status: 'retrying',
      }),
      agentEvent('ActionFailed', 'evt-r2-failed', '2026-02-22T00:00:03.000Z', {
        runId: 'run-robot-1',
        actionId: 'action-robot-1',
        machineId: 'machine-robot-1',
        toolName: 'robot:execute_action',
        status: 'failed',
        errorMessage: 'Transient gateway 502 during retry #2',
      }),
      agentEvent('ActionCompleted', 'evt-r2-completed', '2026-02-22T00:00:04.000Z', {
        runId: 'run-robot-1',
        actionId: 'action-robot-1',
        machineId: 'machine-robot-1',
        toolName: 'robot:execute_action',
        status: 'succeeded',
      }),
    ];

    for (const event of retryEvents) {
      await hooks.record(event);
    }

    const entries = evidenceLog.listByRun(TenantId('workspace-robotics-1'), 'run-robot-1');
    expect(entries).toHaveLength(5);
    expect(entries.every((entry) => (entry.payloadRefs?.length ?? 0) === 1)).toBe(true);
    expect(verifyEvidenceChainV1(entries, new NodeCryptoEvidenceHasher())).toEqual({ ok: true });
  });

  it('rejects duplicate retry event payload writes by event id (WORM no-overwrite)', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const eventPublisher = new InMemoryEventPublisher();
    const hooks = new AgentActionEvidenceHooks({ payloadStore, evidenceLog, eventPublisher });
    const duplicate = agentEvent('ActionFailed', 'evt-r3-failed', '2026-02-22T00:01:00.000Z', {
      runId: 'run-robot-1',
      actionId: 'action-robot-1',
      machineId: 'machine-robot-1',
      toolName: 'robot:execute_action',
      status: 'failed',
      errorMessage: 'Adversarial duplicate failure event',
    });

    await hooks.record(duplicate);
    await expect(hooks.record(duplicate)).rejects.toBeInstanceOf(EvidencePayloadAlreadyExistsError);
  });
});
