import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { TicketV1 } from '../../../domain/canonical/ticket-v1.js';
import { TicketId } from '../../../domain/primitives/index.js';
import type {
  MonitoringIncidentAdapterPort,
  MonitoringIncidentExecuteInputV1,
  MonitoringIncidentExecuteOutputV1,
} from '../../../application/ports/monitoring-incident-adapter.js';
import { MONITORING_INCIDENT_OPERATIONS_V1 } from '../../../application/ports/monitoring-incident-adapter.js';

const OPERATION_SET = new Set<string>(MONITORING_INCIDENT_OPERATIONS_V1);
const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
type TicketStatus = (typeof TICKET_STATUSES)[number];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type TicketPriority = (typeof TICKET_PRIORITIES)[number];

type TenantExternalRef = Readonly<{
  tenantId: MonitoringIncidentExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type InMemoryMonitoringIncidentAdapterSeed = Readonly<{
  alerts?: readonly TenantExternalRef[];
  incidents?: readonly TicketV1[];
  onCallSchedules?: readonly TenantExternalRef[];
  escalationPolicies?: readonly TenantExternalRef[];
  services?: readonly TenantExternalRef[];
  statusPages?: readonly TenantExternalRef[];
  maintenanceWindows?: readonly TenantExternalRef[];
}>;

type InMemoryMonitoringIncidentAdapterParams = Readonly<{
  seed?: InMemoryMonitoringIncidentAdapterSeed;
  now?: () => Date;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readTicketStatus(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): TicketStatus | null {
  const value = payload?.[key];
  if (typeof value !== 'string') return null;
  return TICKET_STATUSES.includes(value as TicketStatus) ? (value as TicketStatus) : null;
}

function readTicketPriority(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): TicketPriority | null {
  const value = payload?.[key];
  if (typeof value !== 'string') return null;
  return TICKET_PRIORITIES.includes(value as TicketPriority) ? (value as TicketPriority) : null;
}

export class InMemoryMonitoringIncidentAdapter implements MonitoringIncidentAdapterPort {
  readonly #now: () => Date;
  readonly #alerts: TenantExternalRef[];
  readonly #incidents: TicketV1[];
  readonly #onCallSchedules: TenantExternalRef[];
  readonly #escalationPolicies: TenantExternalRef[];
  readonly #services: TenantExternalRef[];
  readonly #statusPages: TenantExternalRef[];
  readonly #maintenanceWindows: TenantExternalRef[];
  #incidentSequence: number;
  #ackSequence: number;
  #resolveSequence: number;
  #scheduleSequence: number;
  #statusPageSequence: number;
  #notificationSequence: number;

  public constructor(params?: InMemoryMonitoringIncidentAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#alerts = [...(params?.seed?.alerts ?? [])];
    this.#incidents = [...(params?.seed?.incidents ?? [])];
    this.#onCallSchedules = [...(params?.seed?.onCallSchedules ?? [])];
    this.#escalationPolicies = [...(params?.seed?.escalationPolicies ?? [])];
    this.#services = [...(params?.seed?.services ?? [])];
    this.#statusPages = [...(params?.seed?.statusPages ?? [])];
    this.#maintenanceWindows = [...(params?.seed?.maintenanceWindows ?? [])];
    this.#incidentSequence = this.#incidents.length;
    this.#ackSequence = 0;
    this.#resolveSequence = 0;
    this.#scheduleSequence = this.#onCallSchedules.length;
    this.#statusPageSequence = this.#statusPages.length;
    this.#notificationSequence = 0;
  }

  public async execute(
    input: MonitoringIncidentExecuteInputV1,
  ): Promise<MonitoringIncidentExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported MonitoringIncident operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listAlerts':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#alerts, input) },
        };
      case 'getAlert':
        return this.#getTenantRef(input, this.#alerts, 'alertId', 'Alert', 'getAlert');
      case 'acknowledgeAlert':
        return this.#acknowledgeAlert(input);
      case 'resolveAlert':
        return this.#resolveAlert(input);
      case 'listIncidents':
        return { ok: true, result: { kind: 'tickets', tickets: this.#listIncidents(input) } };
      case 'getIncident':
        return this.#getIncident(input);
      case 'createIncident':
        return this.#createIncident(input);
      case 'updateIncident':
        return this.#updateIncident(input);
      case 'listOnCallSchedules':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#onCallSchedules, input),
          },
        };
      case 'getOnCallSchedule':
        return this.#getTenantRef(
          input,
          this.#onCallSchedules,
          'scheduleId',
          'On-call schedule',
          'getOnCallSchedule',
        );
      case 'createOnCallSchedule':
        return this.#createOnCallSchedule(input);
      case 'listEscalationPolicies':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#escalationPolicies, input),
          },
        };
      case 'listServices':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#services, input) },
        };
      case 'getService':
        return this.#getTenantRef(input, this.#services, 'serviceId', 'Service', 'getService');
      case 'createStatusPage':
        return this.#createStatusPage(input);
      case 'updateStatusPage':
        return this.#updateStatusPage(input);
      case 'listMaintenanceWindows':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#maintenanceWindows, input),
          },
        };
      case 'sendNotification':
        return this.#sendNotification(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported MonitoringIncident operation: ${String(input.operation)}.`,
        };
    }
  }

  #acknowledgeAlert(input: MonitoringIncidentExecuteInputV1): MonitoringIncidentExecuteOutputV1 {
    const alertId = readString(input.payload, 'alertId');
    if (alertId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'alertId is required for acknowledgeAlert.',
      };
    }
    const alert = this.#alerts.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === alertId,
    );
    if (alert === undefined) {
      return { ok: false, error: 'not_found', message: `Alert ${alertId} was not found.` };
    }
    void alert;

    const externalRef: ExternalObjectRef = {
      sorName: 'OpsMonitor',
      portFamily: 'MonitoringIncident',
      externalId: `alert-ack-${++this.#ackSequence}`,
      externalType: 'alert_acknowledgement',
      displayLabel: `Acknowledged ${alertId}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #resolveAlert(input: MonitoringIncidentExecuteInputV1): MonitoringIncidentExecuteOutputV1 {
    const alertId = readString(input.payload, 'alertId');
    if (alertId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'alertId is required for resolveAlert.',
      };
    }
    const alert = this.#alerts.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === alertId,
    );
    if (alert === undefined) {
      return { ok: false, error: 'not_found', message: `Alert ${alertId} was not found.` };
    }
    void alert;

    const externalRef: ExternalObjectRef = {
      sorName: 'OpsMonitor',
      portFamily: 'MonitoringIncident',
      externalId: `alert-resolution-${++this.#resolveSequence}`,
      externalType: 'alert_resolution',
      displayLabel: `Resolved ${alertId}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listIncidents(input: MonitoringIncidentExecuteInputV1): readonly TicketV1[] {
    return this.#incidents.filter((ticket) => ticket.tenantId === input.tenantId);
  }

  #getIncident(input: MonitoringIncidentExecuteInputV1): MonitoringIncidentExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for getIncident.',
      };
    }
    const incident = this.#incidents.find(
      (ticket) => ticket.tenantId === input.tenantId && ticket.ticketId === ticketId,
    );
    if (incident === undefined) {
      return { ok: false, error: 'not_found', message: `Incident ${ticketId} was not found.` };
    }
    return { ok: true, result: { kind: 'ticket', ticket: incident } };
  }

  #createIncident(input: MonitoringIncidentExecuteInputV1): MonitoringIncidentExecuteOutputV1 {
    const subject = readString(input.payload, 'subject');
    if (subject === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'subject is required for createIncident.',
      };
    }

    const incident: TicketV1 = {
      ticketId: TicketId(`incident-${++this.#incidentSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      subject,
      status: readTicketStatus(input.payload, 'status') ?? 'open',
      ...(readTicketPriority(input.payload, 'priority') !== null
        ? { priority: readTicketPriority(input.payload, 'priority')! }
        : {}),
      ...(typeof input.payload?.['assigneeId'] === 'string'
        ? { assigneeId: input.payload['assigneeId'] }
        : {}),
      createdAtIso: this.#now().toISOString(),
    };
    this.#incidents.push(incident);
    return { ok: true, result: { kind: 'ticket', ticket: incident } };
  }

  #updateIncident(input: MonitoringIncidentExecuteInputV1): MonitoringIncidentExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for updateIncident.',
      };
    }

    const index = this.#incidents.findIndex(
      (ticket) => ticket.tenantId === input.tenantId && ticket.ticketId === ticketId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Incident ${ticketId} was not found.` };
    }

    const statusValue = input.payload?.['status'];
    if (statusValue !== undefined && readTicketStatus(input.payload, 'status') === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'status must be one of: open, pending, resolved, closed.',
      };
    }
    const priorityValue = input.payload?.['priority'];
    if (priorityValue !== undefined && readTicketPriority(input.payload, 'priority') === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'priority must be one of: low, medium, high, urgent.',
      };
    }

    const incident: TicketV1 = {
      ...this.#incidents[index]!,
      ...(typeof input.payload?.['subject'] === 'string' ? { subject: input.payload['subject'] } : {}),
      ...(readTicketStatus(input.payload, 'status') !== null
        ? { status: readTicketStatus(input.payload, 'status')! }
        : {}),
      ...(readTicketPriority(input.payload, 'priority') !== null
        ? { priority: readTicketPriority(input.payload, 'priority')! }
        : {}),
      ...(typeof input.payload?.['assigneeId'] === 'string'
        ? { assigneeId: input.payload['assigneeId'] }
        : {}),
    };
    this.#incidents[index] = incident;
    return { ok: true, result: { kind: 'ticket', ticket: incident } };
  }

  #createOnCallSchedule(input: MonitoringIncidentExecuteInputV1): MonitoringIncidentExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createOnCallSchedule.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'OpsMonitor',
      portFamily: 'MonitoringIncident',
      externalId: `schedule-${++this.#scheduleSequence}`,
      externalType: 'on_call_schedule',
      displayLabel: name,
    };
    this.#onCallSchedules.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #createStatusPage(input: MonitoringIncidentExecuteInputV1): MonitoringIncidentExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createStatusPage.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'OpsMonitor',
      portFamily: 'MonitoringIncident',
      externalId: `status-page-${++this.#statusPageSequence}`,
      externalType: 'status_page',
      displayLabel: title,
    };
    this.#statusPages.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #updateStatusPage(input: MonitoringIncidentExecuteInputV1): MonitoringIncidentExecuteOutputV1 {
    const statusPageId = readString(input.payload, 'statusPageId');
    if (statusPageId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'statusPageId is required for updateStatusPage.',
      };
    }
    const statusPage = this.#statusPages.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === statusPageId,
    );
    if (statusPage === undefined) {
      return { ok: false, error: 'not_found', message: `Status page ${statusPageId} was not found.` };
    }

    const message = readString(input.payload, 'message');
    const displayLabel = message ?? statusPage.externalRef.displayLabel ?? `Status page ${statusPageId}`;
    const externalRef: ExternalObjectRef = {
      sorName: 'OpsMonitor',
      portFamily: 'MonitoringIncident',
      externalId: statusPageId,
      externalType: 'status_page',
      displayLabel,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #sendNotification(input: MonitoringIncidentExecuteInputV1): MonitoringIncidentExecuteOutputV1 {
    const serviceId = readString(input.payload, 'serviceId');
    if (serviceId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'serviceId is required for sendNotification.',
      };
    }
    const message = readString(input.payload, 'message');
    if (message === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'message is required for sendNotification.',
      };
    }
    const service = this.#services.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === serviceId,
    );
    if (service === undefined) {
      return { ok: false, error: 'not_found', message: `Service ${serviceId} was not found.` };
    }
    void service;

    const externalRef: ExternalObjectRef = {
      sorName: 'OpsMonitor',
      portFamily: 'MonitoringIncident',
      externalId: `notification-${++this.#notificationSequence}`,
      externalType: 'notification',
      displayLabel: message,
      deepLinkUrl: `https://ops.example/services/${serviceId}/notifications/${this.#notificationSequence}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: MonitoringIncidentExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((entry) => entry.tenantId === input.tenantId)
      .map((entry) => entry.externalRef);
  }

  #getTenantRef(
    input: MonitoringIncidentExecuteInputV1,
    source: readonly TenantExternalRef[],
    key: string,
    label: string,
    operationName: string,
  ): MonitoringIncidentExecuteOutputV1 {
    const externalId = readString(input.payload, key);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${key} is required for ${operationName}.`,
      };
    }
    const found = source.find(
      (entry) =>
        entry.tenantId === input.tenantId && entry.externalRef.externalId === externalId,
    );
    if (found === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: found.externalRef } };
  }

  public static seedMinimal(
    tenantId: MonitoringIncidentExecuteInputV1['tenantId'],
  ): InMemoryMonitoringIncidentAdapterSeed {
    return {
      alerts: [
        {
          tenantId,
          externalRef: {
            sorName: 'OpsMonitor',
            portFamily: 'MonitoringIncident',
            externalId: 'alert-1000',
            externalType: 'alert',
            displayLabel: 'High latency on API gateway',
          },
        },
      ],
      incidents: [
        {
          ticketId: TicketId('incident-1000'),
          tenantId,
          schemaVersion: 1,
          subject: 'API gateway latency breach',
          status: 'open',
          priority: 'high',
          createdAtIso: '2026-02-19T00:00:00.000Z',
        },
      ],
      onCallSchedules: [
        {
          tenantId,
          externalRef: {
            sorName: 'OpsMonitor',
            portFamily: 'MonitoringIncident',
            externalId: 'schedule-1000',
            externalType: 'on_call_schedule',
            displayLabel: 'Primary SRE Rotation',
          },
        },
      ],
      escalationPolicies: [
        {
          tenantId,
          externalRef: {
            sorName: 'OpsMonitor',
            portFamily: 'MonitoringIncident',
            externalId: 'escalation-1000',
            externalType: 'escalation_policy',
            displayLabel: 'Critical Incidents Escalation',
          },
        },
      ],
      services: [
        {
          tenantId,
          externalRef: {
            sorName: 'OpsMonitor',
            portFamily: 'MonitoringIncident',
            externalId: 'service-1000',
            externalType: 'service',
            displayLabel: 'Payments API',
          },
        },
      ],
      statusPages: [
        {
          tenantId,
          externalRef: {
            sorName: 'OpsMonitor',
            portFamily: 'MonitoringIncident',
            externalId: 'status-page-1000',
            externalType: 'status_page',
            displayLabel: 'Public Status',
          },
        },
      ],
      maintenanceWindows: [
        {
          tenantId,
          externalRef: {
            sorName: 'OpsMonitor',
            portFamily: 'MonitoringIncident',
            externalId: 'maintenance-1000',
            externalType: 'maintenance_window',
            displayLabel: 'Database patching window',
          },
        },
      ],
    };
  }
}
