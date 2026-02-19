import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryMonitoringIncidentAdapter } from './in-memory-monitoring-incident-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryMonitoringIncidentAdapter integration', () => {
  it('supports alert and incident operational flow', async () => {
    const adapter = new InMemoryMonitoringIncidentAdapter({
      seed: InMemoryMonitoringIncidentAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const alerts = await adapter.execute({ tenantId: TENANT, operation: 'listAlerts' });
    expect(alerts.ok).toBe(true);
    if (!alerts.ok || alerts.result.kind !== 'externalRefs') return;
    const alertId = alerts.result.externalRefs[0]!.externalId;

    const alert = await adapter.execute({
      tenantId: TENANT,
      operation: 'getAlert',
      payload: { alertId },
    });
    expect(alert.ok).toBe(true);
    if (!alert.ok || alert.result.kind !== 'externalRef') return;
    expect(alert.result.externalRef.externalId).toBe(alertId);

    const acknowledged = await adapter.execute({
      tenantId: TENANT,
      operation: 'acknowledgeAlert',
      payload: { alertId },
    });
    expect(acknowledged.ok).toBe(true);
    if (!acknowledged.ok || acknowledged.result.kind !== 'externalRef') return;
    expect(acknowledged.result.externalRef.externalType).toBe('alert_acknowledgement');

    const resolved = await adapter.execute({
      tenantId: TENANT,
      operation: 'resolveAlert',
      payload: { alertId },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.result.kind !== 'externalRef') return;
    expect(resolved.result.externalRef.externalType).toBe('alert_resolution');

    const createdIncident = await adapter.execute({
      tenantId: TENANT,
      operation: 'createIncident',
      payload: { subject: 'Elevated p95 latency', priority: 'high' },
    });
    expect(createdIncident.ok).toBe(true);
    if (!createdIncident.ok || createdIncident.result.kind !== 'ticket') return;
    const ticketId = createdIncident.result.ticket.ticketId;

    const updatedIncident = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateIncident',
      payload: { ticketId, status: 'pending', assigneeId: 'user-2000' },
    });
    expect(updatedIncident.ok).toBe(true);
    if (!updatedIncident.ok || updatedIncident.result.kind !== 'ticket') return;
    expect(updatedIncident.result.ticket.status).toBe('pending');

    const fetchedIncident = await adapter.execute({
      tenantId: TENANT,
      operation: 'getIncident',
      payload: { ticketId },
    });
    expect(fetchedIncident.ok).toBe(true);
    if (!fetchedIncident.ok || fetchedIncident.result.kind !== 'ticket') return;
    expect(fetchedIncident.result.ticket.assigneeId).toBe('user-2000');
  });

  it('supports schedule/service/status page and notification flow', async () => {
    const adapter = new InMemoryMonitoringIncidentAdapter({
      seed: InMemoryMonitoringIncidentAdapter.seedMinimal(TENANT),
    });

    const schedules = await adapter.execute({ tenantId: TENANT, operation: 'listOnCallSchedules' });
    expect(schedules.ok).toBe(true);
    if (!schedules.ok || schedules.result.kind !== 'externalRefs') return;
    const scheduleId = schedules.result.externalRefs[0]!.externalId;

    const schedule = await adapter.execute({
      tenantId: TENANT,
      operation: 'getOnCallSchedule',
      payload: { scheduleId },
    });
    expect(schedule.ok).toBe(true);
    if (!schedule.ok || schedule.result.kind !== 'externalRef') return;
    expect(schedule.result.externalRef.externalId).toBe(scheduleId);

    const createdSchedule = await adapter.execute({
      tenantId: TENANT,
      operation: 'createOnCallSchedule',
      payload: { name: 'Database On-call Rotation' },
    });
    expect(createdSchedule.ok).toBe(true);
    if (!createdSchedule.ok || createdSchedule.result.kind !== 'externalRef') return;

    const escalationPolicies = await adapter.execute({
      tenantId: TENANT,
      operation: 'listEscalationPolicies',
    });
    expect(escalationPolicies.ok).toBe(true);
    if (!escalationPolicies.ok || escalationPolicies.result.kind !== 'externalRefs') return;
    expect(escalationPolicies.result.externalRefs.length).toBeGreaterThan(0);

    const services = await adapter.execute({ tenantId: TENANT, operation: 'listServices' });
    expect(services.ok).toBe(true);
    if (!services.ok || services.result.kind !== 'externalRefs') return;
    const serviceId = services.result.externalRefs[0]!.externalId;

    const service = await adapter.execute({
      tenantId: TENANT,
      operation: 'getService',
      payload: { serviceId },
    });
    expect(service.ok).toBe(true);
    if (!service.ok || service.result.kind !== 'externalRef') return;
    expect(service.result.externalRef.externalId).toBe(serviceId);

    const createdStatusPage = await adapter.execute({
      tenantId: TENANT,
      operation: 'createStatusPage',
      payload: { title: 'Public Status' },
    });
    expect(createdStatusPage.ok).toBe(true);
    if (!createdStatusPage.ok || createdStatusPage.result.kind !== 'externalRef') return;
    const statusPageId = createdStatusPage.result.externalRef.externalId;

    const updatedStatusPage = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateStatusPage',
      payload: { statusPageId, message: 'Investigating payment delays' },
    });
    expect(updatedStatusPage.ok).toBe(true);
    if (!updatedStatusPage.ok || updatedStatusPage.result.kind !== 'externalRef') return;
    expect(updatedStatusPage.result.externalRef.displayLabel).toContain('Investigating');

    const maintenanceWindows = await adapter.execute({
      tenantId: TENANT,
      operation: 'listMaintenanceWindows',
    });
    expect(maintenanceWindows.ok).toBe(true);
    if (!maintenanceWindows.ok || maintenanceWindows.result.kind !== 'externalRefs') return;
    expect(maintenanceWindows.result.externalRefs.length).toBeGreaterThan(0);

    const notification = await adapter.execute({
      tenantId: TENANT,
      operation: 'sendNotification',
      payload: { serviceId, message: 'Latency alert in progress' },
    });
    expect(notification.ok).toBe(true);
    if (!notification.ok || notification.result.kind !== 'externalRef') return;
    expect(notification.result.externalRef.externalType).toBe('notification');
  });

  it('returns validation and not-found errors for invalid payloads', async () => {
    const adapter = new InMemoryMonitoringIncidentAdapter({
      seed: InMemoryMonitoringIncidentAdapter.seedMinimal(TENANT),
    });

    const missingAlertId = await adapter.execute({
      tenantId: TENANT,
      operation: 'acknowledgeAlert',
      payload: {},
    });
    expect(missingAlertId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'alertId is required for acknowledgeAlert.',
    });

    const unknownAlert = await adapter.execute({
      tenantId: TENANT,
      operation: 'resolveAlert',
      payload: { alertId: 'alert-does-not-exist' },
    });
    expect(unknownAlert).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Alert alert-does-not-exist was not found.',
    });

    const missingMessage = await adapter.execute({
      tenantId: TENANT,
      operation: 'sendNotification',
      payload: { serviceId: 'service-1000' },
    });
    expect(missingMessage).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'message is required for sendNotification.',
    });
  });
});
