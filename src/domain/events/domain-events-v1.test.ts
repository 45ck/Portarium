import { describe, expect, it } from 'vitest';

import { parseDomainEventV1 } from './domain-events-v1.js';

const BASE = {
  schemaVersion: 1,
  eventId: 'evt-1',
  eventType: 'WorkflowCreated',
  aggregateKind: 'Workflow',
  aggregateId: 'wf-1',
  occurredAtIso: '2026-02-17T00:00:00.000Z',
  workspaceId: 'ws-abc',
  correlationId: 'corr-xyz',
} as const;

describe('parseDomainEventV1: happy path', () => {
  it('parses a minimal domain event with required fields', () => {
    const evt = parseDomainEventV1(BASE);

    expect(evt.schemaVersion).toBe(1);
    expect(evt.eventType).toBe('WorkflowCreated');
    expect(evt.aggregateId).toBe('wf-1');
    expect(evt.workspaceId).toBe('ws-abc');
    expect(evt.correlationId).toBe('corr-xyz');
    expect(evt.actorUserId).toBeUndefined();
    expect(evt.payload).toBeUndefined();
  });

  it('parses optional actor and payload', () => {
    const evt = parseDomainEventV1({
      ...BASE,
      eventType: 'RunStarted',
      aggregateKind: 'Run',
      aggregateId: 'run-1',
      actorUserId: 'user-1',
      payload: { source: 'run-service', version: 1 },
    });

    expect(evt.actorUserId).toBe('user-1');
    expect(evt.correlationId).toBe('corr-xyz');
    expect(evt.payload).toEqual({ source: 'run-service', version: 1 });
  });

  it('parses a new domain event type (RunPaused)', () => {
    const evt = parseDomainEventV1({
      ...BASE,
      eventId: 'evt-3',
      eventType: 'RunPaused',
      aggregateKind: 'Run',
      aggregateId: 'run-2',
      occurredAtIso: '2026-02-17T12:30:00.000Z',
      payload: { reason: 'awaiting-approval' },
    });

    expect(evt.eventType).toBe('RunPaused');
    expect(evt.aggregateKind).toBe('Run');
    expect(evt.payload).toEqual({ reason: 'awaiting-approval' });
  });

  it('parses workforce lifecycle event types', () => {
    const evt = parseDomainEventV1({
      ...BASE,
      eventId: 'evt-workforce-1',
      eventType: 'WorkforceMemberRegistered',
      aggregateKind: 'WorkforceMember',
      aggregateId: 'wm-001',
      payload: { linkedUserId: 'user-1' },
    });

    expect(evt.eventType).toBe('WorkforceMemberRegistered');
    expect(evt.aggregateKind).toBe('WorkforceMember');
  });

  it('parses human task lifecycle event types', () => {
    const evt = parseDomainEventV1({
      ...BASE,
      eventId: 'evt-human-task-1',
      eventType: 'HumanTaskCreated',
      aggregateKind: 'HumanTask',
      aggregateId: 'ht-1',
      payload: { runId: 'run-1' },
    });

    expect(evt.eventType).toBe('HumanTaskCreated');
    expect(evt.aggregateKind).toBe('HumanTask');
  });

  it('parses workforce queue lifecycle event types', () => {
    const evt = parseDomainEventV1({
      ...BASE,
      eventId: 'evt-queue-1',
      eventType: 'WorkforceQueueCreated',
      aggregateKind: 'WorkforceQueue',
      aggregateId: 'queue-ops',
      payload: { memberCount: 2 },
    });

    expect(evt.eventType).toBe('WorkforceQueueCreated');
    expect(evt.aggregateKind).toBe('WorkforceQueue');
  });
});

describe('parseDomainEventV1: validation', () => {
  it('rejects non-objects and unsupported schema versions', () => {
    expect(() => parseDomainEventV1('nope')).toThrow(/DomainEventV1 must be an object/i);

    expect(() => parseDomainEventV1({ ...BASE, schemaVersion: 2 })).toThrow(/schemaVersion/i);
  });

  it('rejects missing workspaceId', () => {
    expect(() =>
      parseDomainEventV1({
        schemaVersion: 1,
        eventId: 'evt-1',
        eventType: 'WorkflowCreated',
        aggregateKind: 'Workflow',
        aggregateId: 'wf-1',
        occurredAtIso: '2026-02-17T00:00:00.000Z',
        correlationId: 'corr-xyz',
      }),
    ).toThrow(/workspaceId/);
  });

  it('rejects missing correlationId', () => {
    expect(() =>
      parseDomainEventV1({
        schemaVersion: 1,
        eventId: 'evt-1',
        eventType: 'WorkflowCreated',
        aggregateKind: 'Workflow',
        aggregateId: 'wf-1',
        occurredAtIso: '2026-02-17T00:00:00.000Z',
        workspaceId: 'ws-abc',
      }),
    ).toThrow(/correlationId/);
  });

  it('rejects invalid event types and timestamps', () => {
    expect(() => parseDomainEventV1({ ...BASE, eventType: 'SomethingElse' })).toThrow(
      /eventType is not a recognised DomainEventType/,
    );

    expect(() => parseDomainEventV1({ ...BASE, occurredAtIso: 'not-a-date' })).toThrow(
      /occurredAtIso/,
    );
  });

  it('rejects invalid optional identifiers', () => {
    expect(() => parseDomainEventV1({ ...BASE, actorUserId: '   ' })).toThrow(/actorUserId/);

    expect(() => parseDomainEventV1({ ...BASE, payload: [] })).toThrow(/payload/);
  });
});
