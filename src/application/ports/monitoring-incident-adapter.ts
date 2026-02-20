import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { TicketV1 } from '../../domain/canonical/ticket-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const MONITORING_INCIDENT_OPERATIONS_V1 = [
  'listAlerts',
  'getAlert',
  'acknowledgeAlert',
  'resolveAlert',
  'listIncidents',
  'getIncident',
  'createIncident',
  'updateIncident',
  'listOnCallSchedules',
  'getOnCallSchedule',
  'createOnCallSchedule',
  'listEscalationPolicies',
  'listServices',
  'getService',
  'createStatusPage',
  'updateStatusPage',
  'listMaintenanceWindows',
  'sendNotification',
] as const;

export type MonitoringIncidentOperationV1 = (typeof MONITORING_INCIDENT_OPERATIONS_V1)[number];

export type MonitoringIncidentOperationResultV1 =
  | Readonly<{ kind: 'ticket'; ticket: TicketV1 }>
  | Readonly<{ kind: 'tickets'; tickets: readonly TicketV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: MonitoringIncidentOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type MonitoringIncidentExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: MonitoringIncidentOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type MonitoringIncidentExecuteOutputV1 =
  | Readonly<{ ok: true; result: MonitoringIncidentOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface MonitoringIncidentAdapterPort {
  execute(input: MonitoringIncidentExecuteInputV1): Promise<MonitoringIncidentExecuteOutputV1>;
}
