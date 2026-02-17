import type {
  ActionId as ActionIdType,
  CorrelationId as CorrelationIdType,
  RunId as RunIdType,
  TenantId as TenantIdType,
} from '../../domain/primitives/index.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

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
