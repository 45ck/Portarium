import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

export interface EventPublisher {
  publish(event: PortariumCloudEventV1): Promise<void>;
}
