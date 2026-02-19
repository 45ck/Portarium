import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryPayrollAdapter } from './in-memory-payroll-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryPayrollAdapter', () => {
  it('returns tenant-scoped payroll runs and contractor payments', async () => {
    const seedA = InMemoryPayrollAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryPayrollAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryPayrollAdapter({
      seed: {
        ...seedA,
        payrollRuns: [...seedA.payrollRuns!, ...seedB.payrollRuns!],
        contractorPayments: [...seedA.contractorPayments!, ...seedB.contractorPayments!],
      },
    });

    const payrollRuns = await adapter.execute({ tenantId: TENANT_A, operation: 'listPayrollRuns' });
    expect(payrollRuns.ok).toBe(true);
    if (!payrollRuns.ok || payrollRuns.result.kind !== 'externalRefs') return;
    expect(payrollRuns.result.externalRefs).toHaveLength(1);

    const contractorPayments = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listContractorPayments',
    });
    expect(contractorPayments.ok).toBe(true);
    if (!contractorPayments.ok || contractorPayments.result.kind !== 'payments') return;
    expect(contractorPayments.result.payments).toHaveLength(1);
    expect(contractorPayments.result.payments[0]?.tenantId).toBe(TENANT_A);
  });

  it('runs payroll and supports approval operations', async () => {
    const adapter = new InMemoryPayrollAdapter({
      seed: InMemoryPayrollAdapter.seedMinimal(TENANT_A),
    });

    const createdRun = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'runPayroll',
      payload: { periodLabel: 'March 2026 Payroll' },
    });
    expect(createdRun.ok).toBe(true);
    if (!createdRun.ok || createdRun.result.kind !== 'externalRef') return;

    const fetchedRun = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getPayrollRun',
      payload: { payrollRunId: createdRun.result.externalRef.externalId },
    });
    expect(fetchedRun.ok).toBe(true);
    if (!fetchedRun.ok || fetchedRun.result.kind !== 'externalRef') return;

    const submitted = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'submitPayrollForApproval',
      payload: { payrollRunId: fetchedRun.result.externalRef.externalId },
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok || submitted.result.kind !== 'externalRef') return;
    expect(submitted.result.externalRef.externalType).toBe('payroll_approval_submission');

    const approved = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'approvePayroll',
      payload: { payrollRunId: fetchedRun.result.externalRef.externalId, decision: 'approve' },
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok || approved.result.kind !== 'externalRef') return;
    expect(approved.result.externalRef.externalType).toBe('payroll_approval_decision');
  });

  it('retrieves pay stubs and lists deductions and earnings', async () => {
    const adapter = new InMemoryPayrollAdapter({
      seed: InMemoryPayrollAdapter.seedMinimal(TENANT_A),
    });

    const payStubs = await adapter.execute({ tenantId: TENANT_A, operation: 'listPayStubs' });
    expect(payStubs.ok).toBe(true);
    if (!payStubs.ok || payStubs.result.kind !== 'externalRefs') return;
    expect(payStubs.result.externalRefs).toHaveLength(1);

    const payStub = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getPayStub',
      payload: { payStubId: payStubs.result.externalRefs[0]!.externalId },
    });
    expect(payStub.ok).toBe(true);
    if (!payStub.ok || payStub.result.kind !== 'externalRef') return;
    expect(payStub.result.externalRef.externalType).toBe('pay_stub');

    const deductions = await adapter.execute({ tenantId: TENANT_A, operation: 'listDeductions' });
    expect(deductions.ok).toBe(true);
    if (!deductions.ok || deductions.result.kind !== 'externalRefs') return;
    expect(deductions.result.externalRefs).toHaveLength(1);

    const earnings = await adapter.execute({ tenantId: TENANT_A, operation: 'listEarnings' });
    expect(earnings.ok).toBe(true);
    if (!earnings.ok || earnings.result.kind !== 'externalRefs') return;
    expect(earnings.result.externalRefs).toHaveLength(1);
  });

  it('calculates tax and retrieves pay schedule', async () => {
    const adapter = new InMemoryPayrollAdapter({
      seed: InMemoryPayrollAdapter.seedMinimal(TENANT_A),
    });

    const calculatedTax = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'calculateTax',
      payload: { label: 'March 2026 Tax Calculation' },
    });
    expect(calculatedTax.ok).toBe(true);
    if (!calculatedTax.ok || calculatedTax.result.kind !== 'externalRef') return;
    expect(calculatedTax.result.externalRef.externalType).toBe('tax_calculation');

    const paySchedule = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getPaySchedule',
      payload: { scheduleId: 'schedule-1000' },
    });
    expect(paySchedule.ok).toBe(true);
    if (!paySchedule.ok || paySchedule.result.kind !== 'externalRef') return;
    expect(paySchedule.result.externalRef.externalType).toBe('pay_schedule');
  });

  it('validates payroll approval and rejects unsupported operations', async () => {
    const adapter = new InMemoryPayrollAdapter({
      seed: InMemoryPayrollAdapter.seedMinimal(TENANT_A),
    });

    const missingRunId = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'approvePayroll',
      payload: { decision: 'approve' },
    });
    expect(missingRunId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'payrollRunId is required for approvePayroll.',
    });

    const unsupported = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'runPayroll',
    });
    expect(unsupported).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported Payroll operation: bogusOperation.',
    });
  });
});
