import type { EventPublisher } from '../../application/ports/event-publisher.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const ACTIVEPIECES_TENANT_HEADER = 'tenantId';
const ACTIVEPIECES_CORRELATION_HEADER = 'correlationId';

export type ActivepiecesDomainEventTriggerRoute = Readonly<{
  eventType: string;
  webhookUrl: string;
}>;

export type ActivepiecesDomainEventTriggerPublisherConfig = Readonly<{
  routes: readonly ActivepiecesDomainEventTriggerRoute[];
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}>;

export class ActivepiecesDomainEventTriggerPublishError extends Error {
  public override readonly name = 'ActivepiecesDomainEventTriggerPublishError';

  public constructor(message: string, options?: Readonly<{ cause?: unknown }>) {
    super(message, options);
  }
}

export class ActivepiecesDomainEventTriggerPublisher implements EventPublisher {
  readonly #routesByEventType: ReadonlyMap<string, URL>;
  readonly #timeoutMs: number;
  readonly #fetchFn: typeof fetch;

  public constructor(config: ActivepiecesDomainEventTriggerPublisherConfig) {
    this.#routesByEventType = buildRouteMap(config.routes);
    this.#timeoutMs = resolveTimeoutMs(config.timeoutMs);
    this.#fetchFn = config.fetchFn ?? fetch;
  }

  public async publish(event: PortariumCloudEventV1): Promise<void> {
    const domainEventType = extractDomainEventTypeFromCloudEventType(event.type);
    if (domainEventType === undefined) {
      return;
    }

    const webhookUrl = this.#routesByEventType.get(domainEventType);
    if (webhookUrl === undefined) {
      return;
    }

    const timeoutController = new AbortController();
    const timeoutHandle = setTimeout(() => timeoutController.abort(), this.#timeoutMs);
    const headers: Record<string, string> = {
      'content-type': 'application/cloudevents+json',
      [ACTIVEPIECES_TENANT_HEADER]: String(event.tenantid),
      [ACTIVEPIECES_CORRELATION_HEADER]: String(event.correlationid),
    };

    try {
      const response = await this.#fetchFn(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
        signal: timeoutController.signal,
      });
      if (!response.ok) {
        throw new ActivepiecesDomainEventTriggerPublishError(
          `Activepieces webhook delivery failed for ${domainEventType} (${response.status} ${response.statusText}).`,
        );
      }
    } catch (error) {
      if (error instanceof ActivepiecesDomainEventTriggerPublishError) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : 'Unknown publish error.';
      throw new ActivepiecesDomainEventTriggerPublishError(
        `Activepieces webhook delivery failed for ${domainEventType}: ${reason}`,
        { cause: error },
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

export function extractDomainEventTypeFromCloudEventType(
  cloudEventType: string,
): string | undefined {
  const segments = cloudEventType.split('.');
  if (segments.length < 4) {
    return undefined;
  }
  if (segments[0] !== 'com' || segments[1] !== 'portarium') {
    return undefined;
  }
  const eventType = segments[segments.length - 1]?.trim();
  if (!eventType) {
    return undefined;
  }
  return eventType;
}

function buildRouteMap(
  routes: readonly ActivepiecesDomainEventTriggerRoute[],
): ReadonlyMap<string, URL> {
  const map = new Map<string, URL>();
  for (const route of routes) {
    const eventType = route.eventType.trim();
    if (eventType === '') {
      throw new ActivepiecesDomainEventTriggerPublishError(
        'Activepieces route eventType must be a non-empty string.',
      );
    }
    if (map.has(eventType)) {
      throw new ActivepiecesDomainEventTriggerPublishError(
        `Duplicate Activepieces route for DomainEvent type "${eventType}".`,
      );
    }

    const webhookUrl = parseWebhookUrl(route.webhookUrl, eventType);
    map.set(eventType, webhookUrl);
  }
  return map;
}

function parseWebhookUrl(raw: string, eventType: string): URL {
  let webhookUrl: URL;
  try {
    webhookUrl = new URL(raw);
  } catch {
    throw new ActivepiecesDomainEventTriggerPublishError(
      `Invalid Activepieces webhook URL for ${eventType}.`,
    );
  }
  if (webhookUrl.protocol !== 'http:' && webhookUrl.protocol !== 'https:') {
    throw new ActivepiecesDomainEventTriggerPublishError(
      `Activepieces webhook URL for ${eventType} must use http or https.`,
    );
  }
  return webhookUrl;
}

function resolveTimeoutMs(timeoutMs?: number): number {
  if (timeoutMs === undefined) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ActivepiecesDomainEventTriggerPublishError(
      'Activepieces webhook timeoutMs must be a positive number.',
    );
  }
  return Math.floor(timeoutMs);
}
