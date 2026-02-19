import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryProcurementSpendAdapter } from './in-memory-procurement-spend-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryProcurementSpendAdapter integration', () => {
  it('supports purchase order create/get/approve/list flow', async () => {
    const adapter = new InMemoryProcurementSpendAdapter({
      seed: InMemoryProcurementSpendAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createPurchaseOrder',
      payload: { orderNumber: 'PO-IT-1', totalAmount: 1200, currencyCode: 'USD' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'order') return;
    const orderId = created.result.order.orderId;

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getPurchaseOrder',
      payload: { orderId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'order') return;
    expect(fetched.result.order.orderNumber).toBe('PO-IT-1');

    const approved = await adapter.execute({
      tenantId: TENANT,
      operation: 'approvePurchaseOrder',
      payload: { orderId },
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok || approved.result.kind !== 'order') return;
    expect(approved.result.order.status).toBe('confirmed');

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listPurchaseOrders' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'orders') return;
    expect(listed.result.orders.some((order) => order.orderId === orderId)).toBe(true);
  });

  it('supports expense report create/get/approve/list flow', async () => {
    const adapter = new InMemoryProcurementSpendAdapter({
      seed: InMemoryProcurementSpendAdapter.seedMinimal(TENANT),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createExpenseReport',
      payload: { title: 'Conference travel' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'externalRef') return;
    const externalId = created.result.externalRef.externalId;

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getExpenseReport',
      payload: { externalId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'externalRef') return;
    expect(fetched.result.externalRef.externalId).toBe(externalId);

    const approved = await adapter.execute({
      tenantId: TENANT,
      operation: 'approveExpenseReport',
      payload: { externalId },
    });
    expect(approved).toEqual({
      ok: true,
      result: { kind: 'accepted', operation: 'approveExpenseReport' },
    });

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listExpenseReports' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'externalRefs') return;
    expect(listed.result.externalRefs.some((ref) => ref.externalId === externalId)).toBe(true);
  });

  it('supports vendor create/get/list and rfq create flow', async () => {
    const adapter = new InMemoryProcurementSpendAdapter({
      seed: InMemoryProcurementSpendAdapter.seedMinimal(TENANT),
    });

    const vendor = await adapter.execute({
      tenantId: TENANT,
      operation: 'createVendor',
      payload: { displayName: 'Delta Components' },
    });
    expect(vendor.ok).toBe(true);
    if (!vendor.ok || vendor.result.kind !== 'vendor') return;
    const partyId = vendor.result.vendor.partyId;

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getVendor',
      payload: { partyId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'vendor') return;
    expect(fetched.result.vendor.displayName).toBe('Delta Components');

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listVendors' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'vendors') return;
    expect(listed.result.vendors.some((item) => item.partyId === partyId)).toBe(true);

    const rfq = await adapter.execute({ tenantId: TENANT, operation: 'createRFQ' });
    expect(rfq.ok).toBe(true);
    if (!rfq.ok || rfq.result.kind !== 'externalRef') return;
    expect(rfq.result.externalRef.externalType).toBe('rfq');
  });

  it('supports contract list/get flow', async () => {
    const adapter = new InMemoryProcurementSpendAdapter({
      seed: InMemoryProcurementSpendAdapter.seedMinimal(TENANT),
    });

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listContracts' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'contracts') return;
    expect(listed.result.contracts).toHaveLength(1);

    const subscriptionId = listed.result.contracts[0]!.subscriptionId;
    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getContract',
      payload: { subscriptionId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'contract') return;
    expect(fetched.result.contract.subscriptionId).toBe(subscriptionId);
  });
});
