import { describe, expect, it } from 'vitest';

import type {
  EvidenceEntryAppendInput,
  EvidenceLogPort,
  EventPublisher,
} from '../../application/ports/index.js';
import { EvidencePayloadAlreadyExistsError } from '../../application/ports/evidence-payload-store.js';
import { appendEvidenceEntryV1, verifyEvidenceChainV1 } from '../../domain/evidence/evidence-chain-v1.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import { AGENT_CLOUD_EVENT_TYPES } from '../../domain/event-stream/agent-events-v1.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import {
  CorrelationId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import { InMemoryWormEvidencePayloadStore } from './in-memory-worm-evidence-payload-store.js';
import { AgentActionEvidenceHooks } from './agent-action-evidence-hooks.js';

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

function agentEventOf(
  eventType: 'ActionDispatched' | 'ActionCompleted' | 'ActionFailed',
  eventId: string,
  payload: Record<string, unknown>,
): DomainEventV1 {
  return {
    schemaVersion: 1,
    eventId,
    eventType,
    aggregateKind: 'Run',
    aggregateId: 'run-100',
    occurredAtIso: '2026-02-20T10:00:00.000Z',
    workspaceId: WorkspaceId('workspace-1'),
    correlationId: CorrelationId('corr-1'),
    actorUserId: UserId('user-1'),
    payload,
  };
}

describe('AgentActionEvidenceHooks', () => {
  it('writes payload refs + hash-chained evidence and emits com.portarium.agent CloudEvents', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const eventPublisher = new InMemoryEventPublisher();
    const hooks = new AgentActionEvidenceHooks({ payloadStore, evidenceLog, eventPublisher });

    const dispatched = agentEventOf('ActionDispatched', 'evt-dispatch-1', {
      runId: 'run-100',
      actionId: 'action-100',
      machineId: 'machine-1',
      agentId: 'agent-1',
      status: 'queued',
    });
    const completed = agentEventOf('ActionCompleted', 'evt-complete-1', {
      runId: 'run-100',
      actionId: 'action-100',
      machineId: 'machine-1',
      agentId: 'agent-1',
      status: 'ok',
    });
    const failed = agentEventOf('ActionFailed', 'evt-failed-1', {
      runId: 'run-100',
      actionId: 'action-101',
      machineId: 'machine-1',
      agentId: 'agent-1',
      errorMessage: 'Gateway timeout',
    });

    await hooks.record(dispatched);
    await hooks.record(completed);
    await hooks.record(failed);

    const entries = evidenceLog.listByRun(TenantId('workspace-1'), 'run-100');
    expect(entries).toHaveLength(3);
    expect(entries[0]!.summary).toContain('ActionDispatched');
    expect(entries[1]!.summary).toContain('ActionCompleted');
    expect(entries[2]!.summary).toContain('ActionFailed');
    expect(entries.every((entry) => (entry.payloadRefs?.length ?? 0) >= 1)).toBe(true);

    const verify = verifyEvidenceChainV1(entries, new NodeCryptoEvidenceHasher());
    expect(verify.ok).toBe(true);

    expect(eventPublisher.events).toHaveLength(3);
    expect(eventPublisher.events.map((event) => event.type)).toEqual([
      AGENT_CLOUD_EVENT_TYPES.ActionDispatched,
      AGENT_CLOUD_EVENT_TYPES.ActionCompleted,
      AGENT_CLOUD_EVENT_TYPES.ActionFailed,
    ]);
    expect(eventPublisher.events.every((event) => event.runid === 'run-100')).toBe(true);
    expect(eventPublisher.events.every((event) => event.actionid !== undefined)).toBe(true);
  });

  it('enforces WORM no-overwrite semantics for duplicate agent event payload writes', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const eventPublisher = new InMemoryEventPublisher();
    const hooks = new AgentActionEvidenceHooks({ payloadStore, evidenceLog, eventPublisher });
    const event = agentEventOf('ActionDispatched', 'evt-dispatch-dup', {
      runId: 'run-100',
      actionId: 'action-100',
      machineId: 'machine-1',
      agentId: 'agent-1',
    });

    await hooks.record(event);
    await expect(hooks.record(event)).rejects.toBeInstanceOf(EvidencePayloadAlreadyExistsError);
  });

  it('ignores non-agent lifecycle events', async () => {
    const payloadStore = new InMemoryWormEvidencePayloadStore();
    const evidenceLog = new InMemoryEvidenceLog();
    const eventPublisher = new InMemoryEventPublisher();
    const hooks = new AgentActionEvidenceHooks({ payloadStore, evidenceLog, eventPublisher });

    const unrelated: DomainEventV1 = {
      schemaVersion: 1,
      eventId: 'evt-workspace-1',
      eventType: 'WorkspaceUpdated',
      aggregateKind: 'Workspace',
      aggregateId: 'workspace-1',
      occurredAtIso: '2026-02-20T10:00:00.000Z',
      workspaceId: WorkspaceId('workspace-1'),
      correlationId: CorrelationId('corr-1'),
      payload: {},
    };

    await hooks.record(unrelated);

    expect(evidenceLog.listByRun(TenantId('workspace-1'), 'run-100')).toEqual([]);
    expect(eventPublisher.events).toHaveLength(0);
  });
});
