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

  it('concurrent duplicate event injection: first write wins, second throws (WORM race)', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const eventPublisher = new InMemoryEventPublisher();
    const hooks = new AgentActionEvidenceHooks({ payloadStore, evidenceLog, eventPublisher });
    const evt = agentEvent('ActionFailed', 'evt-race-1', '2026-02-22T00:02:00.000Z', {
      runId: 'run-robot-2',
      actionId: 'action-robot-2',
      toolName: 'robot:execute_action',
      status: 'failed',
      errorMessage: 'Concurrent duplicate injection',
    });

    // Both record calls are started synchronously — the first put() wins before the second sees the map
    const [r1, r2] = await Promise.allSettled([hooks.record(evt), hooks.record(evt)]);

    const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
    const rejected = [r1, r2].filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(EvidencePayloadAlreadyExistsError);

    // Chain must have exactly one entry (the successful write)
    const entries = evidenceLog.listByRun(TenantId('workspace-robotics-1'), 'run-robot-2');
    expect(entries).toHaveLength(1);
    expect(verifyEvidenceChainV1(entries, new NodeCryptoEvidenceHasher())).toEqual({ ok: true });
  });

  it('concurrent recording of two distinct actions in the same run produces a valid chain', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const eventPublisher = new InMemoryEventPublisher();
    const hooks = new AgentActionEvidenceHooks({ payloadStore, evidenceLog, eventPublisher });

    await Promise.all([
      hooks.record(
        agentEvent('ActionDispatched', 'evt-par-A', '2026-02-22T00:03:00.000Z', {
          runId: 'run-robot-3',
          actionId: 'action-robot-A',
          toolName: 'robot:execute_action',
          status: 'queued',
        }),
      ),
      hooks.record(
        agentEvent('ActionDispatched', 'evt-par-B', '2026-02-22T00:03:00.001Z', {
          runId: 'run-robot-3',
          actionId: 'action-robot-B',
          toolName: 'robot:execute_action',
          status: 'queued',
        }),
      ),
    ]);

    const entries = evidenceLog.listByRun(TenantId('workspace-robotics-1'), 'run-robot-3');
    expect(entries).toHaveLength(2);
    expect(verifyEvidenceChainV1(entries, new NodeCryptoEvidenceHasher())).toEqual({ ok: true });
  });

  it('cancellation sequence (dispatch → fail with cancel reason) produces a valid chain', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const eventPublisher = new InMemoryEventPublisher();
    const hooks = new AgentActionEvidenceHooks({ payloadStore, evidenceLog, eventPublisher });

    const cancelSequence: DomainEventV1[] = [
      agentEvent('ActionDispatched', 'evt-cancel-dispatched', '2026-02-22T00:04:00.000Z', {
        runId: 'run-robot-4',
        actionId: 'action-robot-4',
        toolName: 'robot:execute_action',
        status: 'queued',
      }),
      agentEvent('ActionFailed', 'evt-cancel-failed', '2026-02-22T00:04:01.000Z', {
        runId: 'run-robot-4',
        actionId: 'action-robot-4',
        toolName: 'robot:execute_action',
        status: 'cancelled',
        errorMessage: 'Operator cancelled mission before execution',
      }),
    ];

    for (const event of cancelSequence) {
      await hooks.record(event);
    }

    const entries = evidenceLog.listByRun(TenantId('workspace-robotics-1'), 'run-robot-4');
    expect(entries).toHaveLength(2);
    expect(verifyEvidenceChainV1(entries, new NodeCryptoEvidenceHasher())).toEqual({ ok: true });
    // Both entries must reference their payload
    expect(entries.every((e) => (e.payloadRefs?.length ?? 0) === 1)).toBe(true);
  });

  it('publishes one EvidenceRecorded cloud event per action event recorded', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const eventPublisher = new InMemoryEventPublisher();
    const hooks = new AgentActionEvidenceHooks({ payloadStore, evidenceLog, eventPublisher });

    const events: DomainEventV1[] = [
      agentEvent('ActionDispatched', 'evt-pub-1', '2026-02-22T00:05:00.000Z', {
        runId: 'run-robot-5',
        actionId: 'action-robot-5',
        toolName: 'robot:execute_action',
        status: 'queued',
      }),
      agentEvent('ActionFailed', 'evt-pub-2', '2026-02-22T00:05:01.000Z', {
        runId: 'run-robot-5',
        actionId: 'action-robot-5',
        toolName: 'robot:execute_action',
        status: 'failed',
        errorMessage: 'Retry timeout',
      }),
      agentEvent('ActionCompleted', 'evt-pub-3', '2026-02-22T00:05:02.000Z', {
        runId: 'run-robot-5',
        actionId: 'action-robot-5',
        toolName: 'robot:execute_action',
        status: 'succeeded',
      }),
    ];

    for (const event of events) {
      await hooks.record(event);
    }

    expect(eventPublisher.events).toHaveLength(3);
    // Each published cloud event carries the original domain event id
    const publishedIds = eventPublisher.events.map((e) => e.id);
    expect(publishedIds).toEqual(['evt-pub-1', 'evt-pub-2', 'evt-pub-3']);
  });

  it('stress: 10-event retry chain verifies end-to-end', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const eventPublisher = new InMemoryEventPublisher();
    const hooks = new AgentActionEvidenceHooks({ payloadStore, evidenceLog, eventPublisher });

    const stressEvents: DomainEventV1[] = [];
    for (let i = 0; i < 9; i++) {
      stressEvents.push(
        agentEvent(
          'ActionFailed',
          `evt-stress-fail-${i}`,
          new Date(Date.UTC(2026, 1, 22, 0, 6, i)).toISOString(),
          {
            runId: 'run-robot-6',
            actionId: 'action-robot-6',
            toolName: 'robot:execute_action',
            status: 'failed',
            errorMessage: `Adversarial transient failure #${i}`,
          },
        ),
      );
    }
    stressEvents.push(
      agentEvent('ActionCompleted', 'evt-stress-success', '2026-02-22T00:06:09.000Z', {
        runId: 'run-robot-6',
        actionId: 'action-robot-6',
        toolName: 'robot:execute_action',
        status: 'succeeded',
      }),
    );

    for (const event of stressEvents) {
      await hooks.record(event);
    }

    const entries = evidenceLog.listByRun(TenantId('workspace-robotics-1'), 'run-robot-6');
    expect(entries).toHaveLength(10);
    expect(verifyEvidenceChainV1(entries, new NodeCryptoEvidenceHasher())).toEqual({ ok: true });
  });
});
