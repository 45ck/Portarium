import { once } from 'node:events';
import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import type { Clock } from '../../application/ports/clock.js';
import type { OutboxEntry, OutboxPort } from '../../application/ports/outbox.js';
import { OutboxDispatcher } from '../../application/services/outbox-dispatcher.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import {
  ActivepiecesDomainEventTriggerPublishError,
  ActivepiecesDomainEventTriggerPublisher,
  extractDomainEventTypeFromCloudEventType,
} from './activepieces-domain-event-trigger-publisher.js';

type CapturedRequest = Readonly<{
  method: string;
  url: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  body: string;
}>;

type WebhookServer = Readonly<{
  webhookUrl: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}>;

class InMemoryOutboxStore implements OutboxPort {
  readonly #entries = new Map<string, OutboxEntry>();
  #sequence = 0;

  public constructor(entries: readonly OutboxEntry[]) {
    for (const entry of entries) {
      this.#entries.set(entry.entryId, entry);
    }
  }

  public async enqueue(event: PortariumCloudEventV1): Promise<OutboxEntry> {
    this.#sequence += 1;
    const entry: OutboxEntry = {
      entryId: `entry-${this.#sequence}`,
      event,
      status: 'Pending',
      retryCount: 0,
    };
    this.#entries.set(entry.entryId, entry);
    return entry;
  }

  public async fetchPending(limit: number): Promise<readonly OutboxEntry[]> {
    return [...this.#entries.values()]
      .filter((entry) => entry.status === 'Pending')
      .slice(0, Math.max(0, limit));
  }

  public async markPublished(entryId: string): Promise<void> {
    const current = this.#entries.get(entryId);
    if (!current) return;
    this.#entries.set(entryId, { ...current, status: 'Published' });
  }

  public async markFailed(entryId: string, reason: string, nextRetryAtIso: string): Promise<void> {
    const current = this.#entries.get(entryId);
    if (!current) return;
    this.#entries.set(entryId, {
      ...current,
      status: 'Pending',
      failedReason: reason,
      nextRetryAtIso,
      retryCount: current.retryCount + 1,
    });
  }
}

describe('extractDomainEventTypeFromCloudEventType', () => {
  it('extracts the final segment for com.portarium cloud event types', () => {
    expect(extractDomainEventTypeFromCloudEventType('com.portarium.run.RunStarted')).toBe(
      'RunStarted',
    );
  });

  it('returns undefined for non-portarium cloud event types', () => {
    expect(extractDomainEventTypeFromCloudEventType('com.external.run.RunStarted')).toBeUndefined();
    expect(extractDomainEventTypeFromCloudEventType('com.portarium')).toBeUndefined();
  });
});

describe('ActivepiecesDomainEventTriggerPublisher', () => {
  it('routes matching domain events to Activepieces webhook with tenantId and correlationId headers', async () => {
    const server = await startWebhookServer(202);

    try {
      const publisher = new ActivepiecesDomainEventTriggerPublisher({
        routes: [{ eventType: 'RunStarted', webhookUrl: server.webhookUrl }],
      });

      await publisher.publish(makeCloudEvent());

      expect(server.requests).toHaveLength(1);
      const request = server.requests[0];
      if (!request) throw new Error('Expected captured request.');
      expect(request.method).toBe('POST');
      expect(readHeaderValue(request.headers, 'tenantid')).toBe('tenant-1');
      expect(readHeaderValue(request.headers, 'correlationid')).toBe('corr-1');

      const body = JSON.parse(request.body) as { id: string; type: string; tenantid: string };
      expect(body.id).toBe('evt-1');
      expect(body.type).toBe('com.portarium.run.RunStarted');
      expect(body.tenantid).toBe('tenant-1');
    } finally {
      await server.close();
    }
  });

  it('ignores events when no matching DomainEvent route is configured', async () => {
    const server = await startWebhookServer(202);

    try {
      const publisher = new ActivepiecesDomainEventTriggerPublisher({
        routes: [{ eventType: 'RunStarted', webhookUrl: server.webhookUrl }],
      });

      await publisher.publish(makeCloudEvent('com.portarium.approval.ApprovalSubmitted'));

      expect(server.requests).toHaveLength(0);
    } finally {
      await server.close();
    }
  });

  it('throws a publish error when webhook returns non-2xx response', async () => {
    const server = await startWebhookServer(500);

    try {
      const publisher = new ActivepiecesDomainEventTriggerPublisher({
        routes: [{ eventType: 'RunStarted', webhookUrl: server.webhookUrl }],
      });

      await expect(publisher.publish(makeCloudEvent())).rejects.toBeInstanceOf(
        ActivepiecesDomainEventTriggerPublishError,
      );
      await expect(publisher.publish(makeCloudEvent())).rejects.toThrow(
        /Activepieces webhook delivery failed for RunStarted/,
      );
    } finally {
      await server.close();
    }
  });

  it('delivers DomainEvent outbox entries end-to-end through OutboxDispatcher', async () => {
    const server = await startWebhookServer(200);

    try {
      const publisher = new ActivepiecesDomainEventTriggerPublisher({
        routes: [{ eventType: 'RunStarted', webhookUrl: server.webhookUrl }],
      });

      const outboxEntry: OutboxEntry = {
        entryId: 'entry-1',
        event: makeCloudEvent(),
        status: 'Pending',
        retryCount: 0,
      };
      const outbox = new InMemoryOutboxStore([outboxEntry]);
      const clock: Clock = { nowIso: () => '2026-02-20T00:00:00.000Z' };
      const dispatcher = new OutboxDispatcher({ outbox, publisher, clock });

      const sweep = await dispatcher.sweep();
      expect(sweep).toEqual({ published: 1, failed: 0 });

      expect(server.requests).toHaveLength(1);
      const request = server.requests[0];
      if (!request) throw new Error('Expected captured request.');
      expect(readHeaderValue(request.headers, 'tenantid')).toBe('tenant-1');
      expect(readHeaderValue(request.headers, 'correlationid')).toBe('corr-1');
    } finally {
      await server.close();
    }
  });
});

function makeCloudEvent(type = 'com.portarium.run.RunStarted'): PortariumCloudEventV1 {
  return {
    specversion: '1.0',
    id: 'evt-1',
    source: 'portarium.test',
    type,
    tenantid: 'tenant-1',
    correlationid: 'corr-1',
    datacontenttype: 'application/json',
    data: {
      runId: 'run-1',
      workflowId: 'wf-1',
    },
  } as unknown as PortariumCloudEventV1;
}

function readHeaderValue(
  headers: Readonly<Record<string, string | string[] | undefined>>,
  key: string,
): string | undefined {
  const value = headers[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

async function startWebhookServer(responseStatus: number): Promise<WebhookServer> {
  const requests: CapturedRequest[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    request.on('end', () => {
      requests.push({
        method: request.method ?? '',
        url: request.url ?? '',
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      response.statusCode = responseStatus;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: responseStatus < 400 }));
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Unable to resolve webhook server address.');
  }

  return {
    webhookUrl: `http://127.0.0.1:${address.port}/activepieces/hooks/domain-event`,
    requests,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
