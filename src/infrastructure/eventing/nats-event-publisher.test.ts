import { describe, it, expect } from 'vitest';
import {
  NatsEventPublisher,
  NatsEventPublishError,
  cloudEventTypeToNatsSubject,
  type NatsJetStreamConnection,
  type NatsPublishAck,
} from './nats-event-publisher.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import { TenantId, CorrelationId, RunId } from '../../domain/primitives/index.js';

function makeEvent(overrides?: Partial<PortariumCloudEventV1>): PortariumCloudEventV1 {
  return {
    specversion: '1.0',
    id: 'evt-001',
    source: 'portarium/control-plane',
    type: 'com.portarium.runs.started',
    tenantid: TenantId('tenant-1'),
    correlationid: CorrelationId('corr-1'),
    runid: RunId('run-1'),
    time: '2026-02-21T00:00:00.000Z',
    datacontenttype: 'application/json',
    data: { workflowId: 'wf-1' },
    ...overrides,
  };
}

function makeMockJetStream(): NatsJetStreamConnection & {
  calls: { subject: string; data: Uint8Array }[];
} {
  const calls: { subject: string; data: Uint8Array }[] = [];
  return {
    calls,
    async publish(subject: string, data: Uint8Array): Promise<NatsPublishAck> {
      calls.push({ subject, data });
      return { stream: 'PORTARIUM_RUNS', seq: 1, duplicate: false };
    },
  };
}

describe('NatsEventPublisher', () => {
  it('publishes a CloudEvent to the correct NATS subject', async () => {
    const js = makeMockJetStream();
    const publisher = new NatsEventPublisher({ jetstream: js });

    await publisher.publish(makeEvent());

    expect(js.calls).toHaveLength(1);
    expect(js.calls[0]!.subject).toBe('portarium.events.runs.started');

    const decoded = JSON.parse(new TextDecoder().decode(js.calls[0]!.data));
    expect(decoded.id).toBe('evt-001');
    expect(decoded.tenantid).toBe('tenant-1');
  });

  it('maps agent events to the agents subject', async () => {
    const js = makeMockJetStream();
    const publisher = new NatsEventPublisher({ jetstream: js });

    await publisher.publish(makeEvent({ type: 'com.portarium.agents.registered' }));

    expect(js.calls[0]!.subject).toBe('portarium.events.agents.registered');
  });

  it('wraps JetStream publish errors in NatsEventPublishError', async () => {
    const js: NatsJetStreamConnection = {
      async publish(): Promise<NatsPublishAck> {
        throw new Error('connection lost');
      },
    };
    const publisher = new NatsEventPublisher({ jetstream: js });

    await expect(publisher.publish(makeEvent())).rejects.toThrow(NatsEventPublishError);
    await expect(publisher.publish(makeEvent())).rejects.toThrow(/connection lost/);
  });
});

describe('cloudEventTypeToNatsSubject', () => {
  it('strips com.portarium prefix and adds portarium.events prefix', () => {
    expect(cloudEventTypeToNatsSubject('com.portarium.runs.started')).toBe(
      'portarium.events.runs.started',
    );
    expect(cloudEventTypeToNatsSubject('com.portarium.evidence.appended')).toBe(
      'portarium.events.evidence.appended',
    );
    expect(cloudEventTypeToNatsSubject('com.portarium.agents.heartbeat')).toBe(
      'portarium.events.agents.heartbeat',
    );
  });

  it('handles non-portarium event types with unknown prefix', () => {
    expect(cloudEventTypeToNatsSubject('com.other.system.event')).toBe(
      'portarium.events.unknown.com.other.system.event',
    );
  });
});
