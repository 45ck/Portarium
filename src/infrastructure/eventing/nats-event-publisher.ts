import type { EventPublisher } from '../../application/ports/event-publisher.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

// ---------------------------------------------------------------------------
// NATS JetStream event publisher (ADR-0074)
// ---------------------------------------------------------------------------

const NATS_SUBJECT_PREFIX = 'portarium.events';

export type NatsJetStreamConnection = Readonly<{
  publish(subject: string, data: Uint8Array): Promise<NatsPublishAck>;
}>;

export type NatsPublishAck = Readonly<{
  stream: string;
  seq: number;
  duplicate: boolean;
}>;

export type NatsEventPublisherConfig = Readonly<{
  jetstream: NatsJetStreamConnection;
}>;

export class NatsEventPublishError extends Error {
  public override readonly name = 'NatsEventPublishError';

  public constructor(message: string, options?: Readonly<{ cause?: unknown }>) {
    super(message, options);
  }
}

export class NatsEventPublisher implements EventPublisher {
  readonly #jetstream: NatsJetStreamConnection;

  public constructor(config: NatsEventPublisherConfig) {
    this.#jetstream = config.jetstream;
  }

  public async publish(event: PortariumCloudEventV1): Promise<void> {
    const subject = cloudEventTypeToNatsSubject(event.type);
    const payload = new TextEncoder().encode(JSON.stringify(event));

    try {
      await this.#jetstream.publish(subject, payload);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown NATS publish error.';
      throw new NatsEventPublishError(
        `NATS JetStream publish failed for subject ${subject}: ${reason}`,
        { cause: error },
      );
    }
  }
}

/**
 * Maps a CloudEvents `type` (e.g. `com.portarium.runs.started`) to a NATS
 * subject (e.g. `portarium.events.runs.started`).
 *
 * Convention: strip the `com.portarium.` prefix and prepend `portarium.events.`.
 */
export function cloudEventTypeToNatsSubject(cloudEventType: string): string {
  const PORTARIUM_PREFIX = 'com.portarium.';
  if (cloudEventType.startsWith(PORTARIUM_PREFIX)) {
    const domainPath = cloudEventType.slice(PORTARIUM_PREFIX.length);
    return `${NATS_SUBJECT_PREFIX}.${domainPath}`;
  }
  return `${NATS_SUBJECT_PREFIX}.unknown.${cloudEventType}`;
}
