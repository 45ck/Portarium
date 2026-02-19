import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryItsmItOpsAdapter } from './in-memory-itsm-it-ops-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryItsmItOpsAdapter', () => {
  it('returns tenant-scoped incidents', async () => {
    const seedA = InMemoryItsmItOpsAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryItsmItOpsAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryItsmItOpsAdapter({
      seed: {
        ...seedA,
        incidents: [...seedA.incidents!, ...seedB.incidents!],
      },
    });

    const result = await adapter.execute({ tenantId: TENANT_A, operation: 'listIncidents' });
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'tickets') return;
    expect(result.result.tickets).toHaveLength(1);
    expect(result.result.tickets[0]?.tenantId).toBe(TENANT_A);
  });

  it('creates, updates, resolves, and fetches incidents', async () => {
    const adapter = new InMemoryItsmItOpsAdapter({
      seed: InMemoryItsmItOpsAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createIncident',
      payload: { subject: 'API latency spike', priority: 'urgent' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'ticket') return;
    expect(created.result.ticket.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
    const ticketId = created.result.ticket.ticketId;

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateIncident',
      payload: { ticketId, status: 'pending' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'ticket') return;
    expect(updated.result.ticket.status).toBe('pending');

    const resolved = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'resolveIncident',
      payload: { ticketId },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.result.kind !== 'ticket') return;
    expect(resolved.result.ticket.status).toBe('resolved');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getIncident',
      payload: { ticketId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'ticket') return;
    expect(fetched.result.ticket.ticketId).toBe(ticketId);
  });

  it('supports change request lifecycle', async () => {
    const adapter = new InMemoryItsmItOpsAdapter({
      seed: InMemoryItsmItOpsAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const listed = await adapter.execute({ tenantId: TENANT_A, operation: 'listChangeRequests' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'tickets') return;
    expect(listed.result.tickets).toHaveLength(1);

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createChangeRequest',
      payload: { subject: 'Rotate service account credentials' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'ticket') return;

    const approved = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'approveChangeRequest',
      payload: { ticketId: created.result.ticket.ticketId, decision: 'approve' },
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok || approved.result.kind !== 'ticket') return;
    expect(approved.result.ticket.status).toBe('resolved');
  });

  it('supports asset and CMDB operations', async () => {
    const adapter = new InMemoryItsmItOpsAdapter({
      seed: InMemoryItsmItOpsAdapter.seedMinimal(TENANT_A),
    });

    const assets = await adapter.execute({ tenantId: TENANT_A, operation: 'listAssets' });
    expect(assets.ok).toBe(true);
    if (!assets.ok || assets.result.kind !== 'assets') return;
    expect(assets.result.assets).toHaveLength(1);

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createAsset',
      payload: { name: 'worker-node-21', assetType: 'compute_node', status: 'active' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'asset') return;
    const assetId = created.result.asset.assetId;

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateAsset',
      payload: { assetId, status: 'maintenance' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'asset') return;
    expect(updated.result.asset.status).toBe('maintenance');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getAsset',
      payload: { assetId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'asset') return;
    expect(fetched.result.asset.assetId).toBe(assetId);

    const cmdbItems = await adapter.execute({ tenantId: TENANT_A, operation: 'listCMDBItems' });
    expect(cmdbItems.ok).toBe(true);
    if (!cmdbItems.ok || cmdbItems.result.kind !== 'assets') return;
    expect(cmdbItems.result.assets).toHaveLength(1);

    const cmdbItem = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getCMDBItem',
      payload: { assetId: 'cmdb-1000' },
    });
    expect(cmdbItem.ok).toBe(true);
    if (!cmdbItem.ok || cmdbItem.result.kind !== 'asset') return;
    expect(cmdbItem.result.asset.assetType).toBe('service');
  });

  it('supports problem and service request reads', async () => {
    const adapter = new InMemoryItsmItOpsAdapter({
      seed: InMemoryItsmItOpsAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const problems = await adapter.execute({ tenantId: TENANT_A, operation: 'listProblems' });
    expect(problems.ok).toBe(true);
    if (!problems.ok || problems.result.kind !== 'tickets') return;
    expect(problems.result.tickets).toHaveLength(1);

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createProblem',
      payload: { subject: 'Repeated queue backpressure', priority: 'high' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'ticket') return;
    expect(created.result.ticket.createdAtIso).toBe('2026-02-19T00:00:00.000Z');

    const serviceRequests = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listServiceRequests',
    });
    expect(serviceRequests.ok).toBe(true);
    if (!serviceRequests.ok || serviceRequests.result.kind !== 'tickets') return;
    expect(serviceRequests.result.tickets).toHaveLength(1);
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryItsmItOpsAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listIncidents',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported ItsmItOps operation: bogusOperation.',
    });
  });
});
