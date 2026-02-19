import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryPayrollAdapter } from './in-memory-payroll-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryPayrollAdapter integration', () => {
  it('supports payroll run create/get/list and approval flows', async () => {
    const adapter = new InMemoryPayrollAdapter({
      seed: InMemoryPayrollAdapter.seedMinimal(TENANT),
    });

    const createdRun = await adapter.execute({
      tenantId: TENANT,
      operation: 'runPayroll',
      payload: { periodLabel: 'March 2026 Payroll' },
    });
    expect(createdRun.ok).toBe(true);
    if (!createdRun.ok || createdRun.result.kind !== 'externalRef') return;
    const payrollRunId = createdRun.result.externalRef.externalId;

    const fetchedRun = await adapter.execute({
      tenantId: TENANT,
      operation: 'getPayrollRun',
      payload: { payrollRunId },
    });
    expect(fetchedRun.ok).toBe(true);
    if (!fetchedRun.ok || fetchedRun.result.kind !== 'externalRef') return;
    expect(fetchedRun.result.externalRef.externalId).toBe(payrollRunId);

    const submitted = await adapter.execute({
      tenantId: TENANT,
      operation: 'submitPayrollForApproval',
      payload: { payrollRunId },
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok || submitted.result.kind !== 'externalRef') return;
    expect(submitted.result.externalRef.externalType).toBe('payroll_approval_submission');

    const approved = await adapter.execute({
      tenantId: TENANT,
      operation: 'approvePayroll',
      payload: { payrollRunId, decision: 'approve' },
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok || approved.result.kind !== 'externalRef') return;
    expect(approved.result.externalRef.externalType).toBe('payroll_approval_decision');

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listPayrollRuns' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'externalRefs') return;
    expect(listed.result.externalRefs.some((ref) => ref.externalId === payrollRunId)).toBe(true);
  });

  it('supports pay stub, pay schedule, and tax calculation flows', async () => {
    const adapter = new InMemoryPayrollAdapter({
      seed: InMemoryPayrollAdapter.seedMinimal(TENANT),
    });

    const payStubs = await adapter.execute({ tenantId: TENANT, operation: 'listPayStubs' });
    expect(payStubs.ok).toBe(true);
    if (!payStubs.ok || payStubs.result.kind !== 'externalRefs') return;
    const payStubId = payStubs.result.externalRefs[0]!.externalId;

    const payStub = await adapter.execute({
      tenantId: TENANT,
      operation: 'getPayStub',
      payload: { payStubId },
    });
    expect(payStub.ok).toBe(true);
    if (!payStub.ok || payStub.result.kind !== 'externalRef') return;
    expect(payStub.result.externalRef.externalId).toBe(payStubId);

    const paySchedule = await adapter.execute({
      tenantId: TENANT,
      operation: 'getPaySchedule',
      payload: { scheduleId: 'schedule-1000' },
    });
    expect(paySchedule.ok).toBe(true);
    if (!paySchedule.ok || paySchedule.result.kind !== 'externalRef') return;
    expect(paySchedule.result.externalRef.externalType).toBe('pay_schedule');

    const tax = await adapter.execute({
      tenantId: TENANT,
      operation: 'calculateTax',
      payload: { label: 'March 2026 Tax Calculation' },
    });
    expect(tax.ok).toBe(true);
    if (!tax.ok || tax.result.kind !== 'externalRef') return;
    expect(tax.result.externalRef.externalType).toBe('tax_calculation');
  });

  it('supports deductions and earnings list flows', async () => {
    const adapter = new InMemoryPayrollAdapter({
      seed: InMemoryPayrollAdapter.seedMinimal(TENANT),
    });

    const deductions = await adapter.execute({ tenantId: TENANT, operation: 'listDeductions' });
    expect(deductions.ok).toBe(true);
    if (!deductions.ok || deductions.result.kind !== 'externalRefs') return;
    expect(deductions.result.externalRefs).toHaveLength(1);
    expect(deductions.result.externalRefs[0]?.externalType).toBe('deduction');

    const earnings = await adapter.execute({ tenantId: TENANT, operation: 'listEarnings' });
    expect(earnings.ok).toBe(true);
    if (!earnings.ok || earnings.result.kind !== 'externalRefs') return;
    expect(earnings.result.externalRefs).toHaveLength(1);
    expect(earnings.result.externalRefs[0]?.externalType).toBe('earning');
  });

  it('supports contractor payment listing with optional status filter', async () => {
    const adapter = new InMemoryPayrollAdapter({
      seed: InMemoryPayrollAdapter.seedMinimal(TENANT),
    });

    const allPayments = await adapter.execute({
      tenantId: TENANT,
      operation: 'listContractorPayments',
    });
    expect(allPayments.ok).toBe(true);
    if (!allPayments.ok || allPayments.result.kind !== 'payments') return;
    expect(allPayments.result.payments).toHaveLength(1);

    const filtered = await adapter.execute({
      tenantId: TENANT,
      operation: 'listContractorPayments',
      payload: { status: 'completed' },
    });
    expect(filtered.ok).toBe(true);
    if (!filtered.ok || filtered.result.kind !== 'payments') return;
    expect(filtered.result.payments).toHaveLength(1);

    const empty = await adapter.execute({
      tenantId: TENANT,
      operation: 'listContractorPayments',
      payload: { status: 'failed' },
    });
    expect(empty.ok).toBe(true);
    if (!empty.ok || empty.result.kind !== 'payments') return;
    expect(empty.result.payments).toHaveLength(0);
  });
});
