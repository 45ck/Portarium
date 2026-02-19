import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryProcurementSpendAdapter } from './in-memory-procurement-spend-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryProcurementSpendAdapter', () => {
  it('returns tenant-scoped purchase orders', async () => {
    const adapter = new InMemoryProcurementSpendAdapter({
      seed: {
        ...InMemoryProcurementSpendAdapter.seedMinimal(TENANT_A),
        purchaseOrders: [
          ...InMemoryProcurementSpendAdapter.seedMinimal(TENANT_A).purchaseOrders!,
          ...InMemoryProcurementSpendAdapter.seedMinimal(TENANT_B).purchaseOrders!,
        ],
      },
    });

    const result = await adapter.execute({ tenantId: TENANT_A, operation: 'listPurchaseOrders' });
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'orders') return;
    expect(result.result.orders).toHaveLength(1);
    expect(result.result.orders[0]?.tenantId).toBe(TENANT_A);
  });

  it('validates createPurchaseOrder input', async () => {
    const adapter = new InMemoryProcurementSpendAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createPurchaseOrder',
      payload: {},
    });
    expect(result).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'totalAmount must be a non-negative number for createPurchaseOrder.',
    });
  });

  it('creates and approves purchase orders', async () => {
    const adapter = new InMemoryProcurementSpendAdapter({
      seed: InMemoryProcurementSpendAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createPurchaseOrder',
      payload: { orderNumber: 'PO-2000', totalAmount: 900, currencyCode: 'USD' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'order') return;

    const approved = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'approvePurchaseOrder',
      payload: { orderId: created.result.order.orderId },
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok || approved.result.kind !== 'order') return;
    expect(approved.result.order.status).toBe('confirmed');
  });

  it('creates and retrieves vendors', async () => {
    const adapter = new InMemoryProcurementSpendAdapter({
      seed: InMemoryProcurementSpendAdapter.seedMinimal(TENANT_A),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createVendor',
      payload: { displayName: 'Acme Supplier' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'vendor') return;

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getVendor',
      payload: { partyId: created.result.vendor.partyId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'vendor') return;
    expect(fetched.result.vendor.displayName).toBe('Acme Supplier');
  });

  it('handles expense report and rfq external refs', async () => {
    const adapter = new InMemoryProcurementSpendAdapter({
      seed: InMemoryProcurementSpendAdapter.seedMinimal(TENANT_A),
    });

    const expense = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createExpenseReport',
      payload: { title: 'Travel expenses' },
    });
    expect(expense.ok).toBe(true);
    if (!expense.ok || expense.result.kind !== 'externalRef') return;

    const approved = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'approveExpenseReport',
      payload: { externalId: expense.result.externalRef.externalId },
    });
    expect(approved).toEqual({
      ok: true,
      result: { kind: 'accepted', operation: 'approveExpenseReport' },
    });

    const rfq = await adapter.execute({ tenantId: TENANT_A, operation: 'createRFQ' });
    expect(rfq.ok).toBe(true);
    if (!rfq.ok || rfq.result.kind !== 'externalRef') return;
    expect(rfq.result.externalRef.externalType).toBe('rfq');
  });

  it('lists and fetches contracts', async () => {
    const adapter = new InMemoryProcurementSpendAdapter({
      seed: InMemoryProcurementSpendAdapter.seedMinimal(TENANT_A),
    });

    const listed = await adapter.execute({ tenantId: TENANT_A, operation: 'listContracts' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'contracts') return;
    expect(listed.result.contracts).toHaveLength(1);

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getContract',
      payload: { subscriptionId: listed.result.contracts[0]!.subscriptionId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'contract') return;
    expect(fetched.result.contract.planName).toBe('MSA 2026');
  });
});
