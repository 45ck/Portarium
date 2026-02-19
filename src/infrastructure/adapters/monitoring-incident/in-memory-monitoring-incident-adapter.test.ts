import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryMonitoringIncidentAdapter } from './in-memory-monitoring-incident-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryMonitoringIncidentAdapter', () => {
  it('returns tenant-scoped alerts and incidents', async () => {
    const seedA = InMemoryMonitoringIncidentAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryMonitoringIncidentAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryMonitoringIncidentAdapter({
      seed: {
        ...seedA,
        alerts: [...seedA.alerts!, ...seedB.alerts!],
        incidents: [...seedA.incidents!, ...seedB.incidents!],
      },
    });

    const alerts = await adapter.execute({ tenantId: TENANT_A, operation: 'listAlerts' });
    expect(alerts.ok).toBe(true);
    if (!alerts.ok || alerts.result.kind !== 'externalRefs') return;
    expect(alerts.result.externalRefs).toHaveLength(1);
    expect(alerts.result.externalRefs[0]?.externalId).toBe('alert-1000');

    const incidents = await adapter.execute({ tenantId: TENANT_A, operation: 'listIncidents' });
    expect(incidents.ok).toBe(true);
    if (!incidents.ok || incidents.result.kind !== 'tickets') return;
    expect(incidents.result.tickets).toHaveLength(1);
    expect(incidents.result.tickets[0]?.tenantId).toBe(TENANT_A);
  });

  it('supports alert read and decision operations', async () => {
    const adapter = new InMemoryMonitoringIncidentAdapter({
      seed: InMemoryMonitoringIncidentAdapter.seedMinimal(TENANT_A),
    });

    const alert = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getAlert',
      payload: { alertId: 'alert-1000' },
    });
    expect(alert.ok).toBe(true);
    if (!alert.ok || alert.result.kind !== 'externalRef') return;
    expect(alert.result.externalRef.externalType).toBe('alert');

    const acknowledged = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'acknowledgeAlert',
      payload: { alertId: 'alert-1000' },
    });
    expect(acknowledged.ok).toBe(true);
    if (!acknowledged.ok || acknowledged.result.kind !== 'externalRef') return;
    expect(acknowledged.result.externalRef.externalType).toBe('alert_acknowledgement');

    const resolved = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'resolveAlert',
      payload: { alertId: 'alert-1000' },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.result.kind !== 'externalRef') return;
    expect(resolved.result.externalRef.externalType).toBe('alert_resolution');
  });

  it('supports incident lifecycle operations', async () => {
    const adapter = new InMemoryMonitoringIncidentAdapter({
      seed: InMemoryMonitoringIncidentAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createIncident',
      payload: { subject: 'SLO burn alert', priority: 'urgent' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'ticket') return;
    expect(created.result.ticket.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
    const ticketId = created.result.ticket.ticketId;

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateIncident',
      payload: { ticketId, status: 'pending', assigneeId: 'user-1000' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'ticket') return;
    expect(updated.result.ticket.status).toBe('pending');
    expect(updated.result.ticket.assigneeId).toBe('user-1000');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getIncident',
      payload: { ticketId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'ticket') return;
    expect(fetched.result.ticket.ticketId).toBe(ticketId);
  });

  it('supports schedule, service, status-page, and notification operations', async () => {
    const adapter = new InMemoryMonitoringIncidentAdapter({
      seed: InMemoryMonitoringIncidentAdapter.seedMinimal(TENANT_A),
    });

    const schedules = await adapter.execute({ tenantId: TENANT_A, operation: 'listOnCallSchedules' });
    expect(schedules.ok).toBe(true);
    if (!schedules.ok || schedules.result.kind !== 'externalRefs') return;
    const scheduleId = schedules.result.externalRefs[0]!.externalId;

    const schedule = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getOnCallSchedule',
      payload: { scheduleId },
    });
    expect(schedule.ok).toBe(true);
    if (!schedule.ok || schedule.result.kind !== 'externalRef') return;
    expect(schedule.result.externalRef.externalId).toBe(scheduleId);

    const createdSchedule = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createOnCallSchedule',
      payload: { name: 'Secondary SRE Rotation' },
    });
    expect(createdSchedule.ok).toBe(true);
    if (!createdSchedule.ok || createdSchedule.result.kind !== 'externalRef') return;

    const escalationPolicies = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listEscalationPolicies',
    });
    expect(escalationPolicies.ok).toBe(true);
    if (!escalationPolicies.ok || escalationPolicies.result.kind !== 'externalRefs') return;
    expect(escalationPolicies.result.externalRefs.length).toBeGreaterThan(0);

    const services = await adapter.execute({ tenantId: TENANT_A, operation: 'listServices' });
    expect(services.ok).toBe(true);
    if (!services.ok || services.result.kind !== 'externalRefs') return;
    const serviceId = services.result.externalRefs[0]!.externalId;

    const service = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getService',
      payload: { serviceId },
    });
    expect(service.ok).toBe(true);
    if (!service.ok || service.result.kind !== 'externalRef') return;
    expect(service.result.externalRef.externalId).toBe(serviceId);

    const statusPage = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createStatusPage',
      payload: { title: 'Public Status' },
    });
    expect(statusPage.ok).toBe(true);
    if (!statusPage.ok || statusPage.result.kind !== 'externalRef') return;
    const statusPageId = statusPage.result.externalRef.externalId;

    const updatedStatusPage = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateStatusPage',
      payload: { statusPageId, message: 'Investigating elevated error rates' },
    });
    expect(updatedStatusPage.ok).toBe(true);
    if (!updatedStatusPage.ok || updatedStatusPage.result.kind !== 'externalRef') return;
    expect(updatedStatusPage.result.externalRef.displayLabel).toContain('Investigating');

    const maintenanceWindows = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listMaintenanceWindows',
    });
    expect(maintenanceWindows.ok).toBe(true);
    if (!maintenanceWindows.ok || maintenanceWindows.result.kind !== 'externalRefs') return;
    expect(maintenanceWindows.result.externalRefs.length).toBeGreaterThan(0);

    const notification = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'sendNotification',
      payload: { serviceId, message: 'Investigating latency issues.' },
    });
    expect(notification.ok).toBe(true);
    if (!notification.ok || notification.result.kind !== 'externalRef') return;
    expect(notification.result.externalRef.externalType).toBe('notification');
  });

  it('returns validation and not-found errors', async () => {
    const adapter = new InMemoryMonitoringIncidentAdapter({
      seed: InMemoryMonitoringIncidentAdapter.seedMinimal(TENANT_A),
    });

    const missingTicketId = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateIncident',
      payload: {},
    });
    expect(missingTicketId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'ticketId is required for updateIncident.',
    });

    const invalidStatus = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateIncident',
      payload: { ticketId: 'incident-1000', status: 'invalid' },
    });
    expect(invalidStatus).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'status must be one of: open, pending, resolved, closed.',
    });

    const missingStatusPage = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateStatusPage',
      payload: { statusPageId: 'status-page-does-not-exist' },
    });
    expect(missingStatusPage).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Status page status-page-does-not-exist was not found.',
    });
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryMonitoringIncidentAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listAlerts',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported MonitoringIncident operation: bogusOperation.',
    });
  });
});
