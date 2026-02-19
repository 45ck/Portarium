import type {
  ActionId as ActionIdType,
  CorrelationId as CorrelationIdType,
  RunId as RunIdType,
  TenantId as TenantIdType,
} from '../../domain/primitives/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

export const PORTARIUM_TELEMETRY_NAMESPACE = 'com.portarium' as const;

export type CloudEventInput = Readonly<{
  source: string;
  eventType: string;
  eventId: string;
  tenantId: TenantIdType;
  correlationId: CorrelationIdType;
  subject?: string;
  data?: unknown;
  occurredAtIso?: string;
  runId?: RunIdType;
  actionId?: ActionIdType;
}>;

/**
 * Derive the CloudEvents `type` attribute from a DomainEventV1.
 * Follows the convention: `com.portarium.<aggregate-lowercase>.<DomainEventType>`
 * Example: aggregateKind='Run', eventType='RunStarted' → 'com.portarium.run.RunStarted'
 */
export function domainEventToCloudEventsType(
  event: Pick<DomainEventV1, 'aggregateKind' | 'eventType'>,
): string {
  const namespace = event.aggregateKind.toLowerCase().replace(/\s+/g, '-');
  return `${PORTARIUM_TELEMETRY_NAMESPACE}.${namespace}.${event.eventType}`;
}

/**
 * Convert a DomainEventV1 to a PortariumCloudEventV1 using standard field mappings.
 * - type: derived via domainEventToCloudEventsType
 * - subject: `<aggregateKind-plural>/<aggregateId>` (e.g. `runs/run-1`)
 * - tenantid: workspaceId (WorkspaceId is an alias for TenantId)
 * - correlationid: correlationId
 * - data: payload (if present)
 */
export function domainEventToPortariumCloudEvent(
  event: DomainEventV1,
  source: string,
): PortariumCloudEventV1 {
  const kind = event.aggregateKind.toLowerCase();
  const subject = `${kind}s/${event.aggregateId}`;
  return createPortariumCloudEvent({
    source,
    eventType: domainEventToCloudEventsType(event),
    eventId: event.eventId,
    tenantId: event.workspaceId,
    correlationId: event.correlationId,
    subject,
    occurredAtIso: event.occurredAtIso,
    ...(event.payload !== undefined ? { data: event.payload } : {}),
  });
}

export const createPortariumCloudEvent = ({
  source,
  eventType,
  eventId,
  tenantId,
  correlationId,
  subject,
  data,
  occurredAtIso,
  runId,
  actionId,
}: CloudEventInput): PortariumCloudEventV1 => {
  return {
    specversion: '1.0',
    id: eventId,
    source,
    type: eventType,
    ...(subject ? { subject } : {}),
    ...(occurredAtIso ? { time: occurredAtIso } : {}),
    datacontenttype: 'application/json',
    tenantid: tenantId,
    correlationid: correlationId,
    ...(runId ? { runid: runId } : {}),
    ...(actionId ? { actionid: actionId } : {}),
    ...(data !== undefined ? { data } : {}),
  };
};
