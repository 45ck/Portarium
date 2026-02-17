import { describe, expect, it } from 'vitest';

import { parseDomainEventV1 } from './domain-events-v1.js';

describe('parseDomainEventV1: happy path', () => {
  it('parses a minimal domain event with required fields', () => {
    const evt = parseDomainEventV1({
      schemaVersion: 1,
      eventId: 'evt-1',
      eventType: 'WorkflowCreated',
      aggregateKind: 'Workflow',
      aggregateId: 'wf-1',
      occurredAtIso: '2026-02-17T00:00:00.000Z',
    });

    expect(evt.schemaVersion).toBe(1);
    expect(evt.eventType).toBe('WorkflowCreated');
    expect(evt.aggregateId).toBe('wf-1');
    expect(evt.actorUserId).toBeUndefined();
    expect(evt.payload).toBeUndefined();
  });

  it('parses optional actor, correlation, and payload', () => {
    const evt = parseDomainEventV1({
      schemaVersion: 1,
      eventId: 'evt-2',
      eventType: 'RunStarted',
      aggregateKind: 'Run',
      aggregateId: 'run-1',
      occurredAtIso: '2026-02-17T00:00:00.000Z',
      actorUserId: 'user-1',
      correlationId: 'corr-1',
      payload: { source: 'run-service', version: 1 },
    });

    expect(evt.actorUserId).toBe('user-1');
    expect(evt.correlationId).toBe('corr-1');
    expect(evt.payload).toEqual({ source: 'run-service', version: 1 });
  });

  it('parses a new domain event type (RunPaused)', () => {
    const evt = parseDomainEventV1({
      schemaVersion: 1,
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
});

describe('parseDomainEventV1: validation', () => {
  it('rejects non-objects and unsupported schema versions', () => {
    expect(() => parseDomainEventV1('nope')).toThrow(/DomainEventV1 must be an object/i);

    expect(() =>
      parseDomainEventV1({
        schemaVersion: 2,
        eventId: 'evt-1',
        eventType: 'RunStarted',
        aggregateKind: 'Run',
        aggregateId: 'run-1',
        occurredAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/schemaVersion/i);
  });

  it('rejects invalid event types and timestamps', () => {
    expect(() =>
      parseDomainEventV1({
        schemaVersion: 1,
        eventId: 'evt-1',
        eventType: 'SomethingElse',
        aggregateKind: 'Run',
        aggregateId: 'run-1',
        occurredAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/eventType is not a recognised DomainEventType/);

    expect(() =>
      parseDomainEventV1({
        schemaVersion: 1,
        eventId: 'evt-1',
        eventType: 'RunStarted',
        aggregateKind: 'Run',
        aggregateId: 'run-1',
        occurredAtIso: 'not-a-date',
      }),
    ).toThrow(/occurredAtIso/);
  });

  it('rejects invalid optional identifiers', () => {
    expect(() =>
      parseDomainEventV1({
        schemaVersion: 1,
        eventId: 'evt-1',
        eventType: 'RunStarted',
        aggregateKind: 'Run',
        aggregateId: 'run-1',
        occurredAtIso: '2026-02-17T00:00:00.000Z',
        actorUserId: '   ',
      }),
    ).toThrow(/actorUserId/);

    expect(() =>
      parseDomainEventV1({
        schemaVersion: 1,
        eventId: 'evt-1',
        eventType: 'RunStarted',
        aggregateKind: 'Run',
        aggregateId: 'run-1',
        occurredAtIso: '2026-02-17T00:00:00.000Z',
        payload: [],
      }),
    ).toThrow(/payload/);
  });
});
