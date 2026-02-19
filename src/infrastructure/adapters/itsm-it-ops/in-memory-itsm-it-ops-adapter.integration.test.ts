import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryItsmItOpsAdapter } from './in-memory-itsm-it-ops-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryItsmItOpsAdapter integration', () => {
  it('supports incident create/update/get/resolve/list flow', async () => {
    const adapter = new InMemoryItsmItOpsAdapter({
      seed: InMemoryItsmItOpsAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createIncident',
      payload: { subject: 'Intermittent webhook failures', priority: 'high' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'ticket') return;
    expect(created.result.ticket.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
    const ticketId = created.result.ticket.ticketId;

    const updated = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateIncident',
      payload: { ticketId, status: 'pending' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'ticket') return;
    expect(updated.result.ticket.status).toBe('pending');

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getIncident',
      payload: { ticketId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'ticket') return;
    expect(fetched.result.ticket.ticketId).toBe(ticketId);

    const resolved = await adapter.execute({
      tenantId: TENANT,
      operation: 'resolveIncident',
      payload: { ticketId },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.result.kind !== 'ticket') return;
    expect(resolved.result.ticket.status).toBe('resolved');

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listIncidents' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'tickets') return;
    expect(listed.result.tickets.some((ticket) => ticket.ticketId === ticketId)).toBe(true);
  });

  it('supports change request create/list/approve flow', async () => {
    const adapter = new InMemoryItsmItOpsAdapter({
      seed: InMemoryItsmItOpsAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createChangeRequest',
      payload: { subject: 'Enable maintenance mode for release' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'ticket') return;
    const changeId = created.result.ticket.ticketId;

    const listed = await adapter.execute({
      tenantId: TENANT,
      operation: 'listChangeRequests',
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'tickets') return;
    expect(listed.result.tickets.some((ticket) => ticket.ticketId === changeId)).toBe(true);

    const approved = await adapter.execute({
      tenantId: TENANT,
      operation: 'approveChangeRequest',
      payload: { ticketId: changeId, decision: 'approve' },
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok || approved.result.kind !== 'ticket') return;
    expect(approved.result.ticket.status).toBe('resolved');
  });

  it('supports asset and CMDB flows', async () => {
    const adapter = new InMemoryItsmItOpsAdapter({
      seed: InMemoryItsmItOpsAdapter.seedMinimal(TENANT),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createAsset',
      payload: { name: 'build-node-17', assetType: 'compute_node', status: 'active' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'asset') return;
    const assetId = created.result.asset.assetId;

    const updated = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateAsset',
      payload: { assetId, status: 'maintenance' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'asset') return;
    expect(updated.result.asset.status).toBe('maintenance');

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getAsset',
      payload: { assetId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'asset') return;
    expect(fetched.result.asset.assetId).toBe(assetId);

    const assets = await adapter.execute({ tenantId: TENANT, operation: 'listAssets' });
    expect(assets.ok).toBe(true);
    if (!assets.ok || assets.result.kind !== 'assets') return;
    expect(assets.result.assets.some((asset) => asset.assetId === assetId)).toBe(true);

    const cmdbItems = await adapter.execute({ tenantId: TENANT, operation: 'listCMDBItems' });
    expect(cmdbItems.ok).toBe(true);
    if (!cmdbItems.ok || cmdbItems.result.kind !== 'assets') return;
    expect(cmdbItems.result.assets).toHaveLength(1);

    const cmdbItem = await adapter.execute({
      tenantId: TENANT,
      operation: 'getCMDBItem',
      payload: { assetId: 'cmdb-1000' },
    });
    expect(cmdbItem.ok).toBe(true);
    if (!cmdbItem.ok || cmdbItem.result.kind !== 'asset') return;
    expect(cmdbItem.result.asset.assetType).toBe('service');
  });

  it('supports problem/service request operations and validates required fields', async () => {
    const adapter = new InMemoryItsmItOpsAdapter({
      seed: InMemoryItsmItOpsAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const createdProblem = await adapter.execute({
      tenantId: TENANT,
      operation: 'createProblem',
      payload: { subject: 'Recurring queue saturation' },
    });
    expect(createdProblem.ok).toBe(true);
    if (!createdProblem.ok || createdProblem.result.kind !== 'ticket') return;
    expect(createdProblem.result.ticket.createdAtIso).toBe('2026-02-19T00:00:00.000Z');

    const problems = await adapter.execute({ tenantId: TENANT, operation: 'listProblems' });
    expect(problems.ok).toBe(true);
    if (!problems.ok || problems.result.kind !== 'tickets') return;
    expect(problems.result.tickets.length).toBeGreaterThan(0);

    const serviceRequests = await adapter.execute({
      tenantId: TENANT,
      operation: 'listServiceRequests',
    });
    expect(serviceRequests.ok).toBe(true);
    if (!serviceRequests.ok || serviceRequests.result.kind !== 'tickets') return;
    expect(serviceRequests.result.tickets).toHaveLength(1);

    const missingTicketId = await adapter.execute({
      tenantId: TENANT,
      operation: 'getIncident',
      payload: {},
    });
    expect(missingTicketId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'ticketId is required for getIncident.',
    });
  });
});
