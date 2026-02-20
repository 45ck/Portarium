import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryHrisHcmAdapter } from './in-memory-hris-hcm-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryHrisHcmAdapter', () => {
  it('returns tenant-scoped employees', async () => {
    const adapter = new InMemoryHrisHcmAdapter({
      seed: {
        ...InMemoryHrisHcmAdapter.seedMinimal(TENANT_A),
        employees: [
          ...InMemoryHrisHcmAdapter.seedMinimal(TENANT_A).employees!,
          ...InMemoryHrisHcmAdapter.seedMinimal(TENANT_B).employees!,
        ],
      },
    });

    const result = await adapter.execute({ tenantId: TENANT_A, operation: 'listEmployees' });
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'employees') return;
    expect(result.result.employees).toHaveLength(1);
    expect(result.result.employees[0]?.tenantId).toBe(TENANT_A);
  });

  it('creates, updates, and terminates an employee', async () => {
    const adapter = new InMemoryHrisHcmAdapter({
      seed: InMemoryHrisHcmAdapter.seedMinimal(TENANT_A),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createEmployee',
      payload: { displayName: 'Alice Johnson' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'employee') return;
    const partyId = created.result.employee.partyId;

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateEmployee',
      payload: { partyId, displayName: 'Alice Jones' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'employee') return;
    expect(updated.result.employee.displayName).toBe('Alice Jones');

    const terminated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'terminateEmployee',
      payload: { partyId, reason: 'offboarding' },
    });
    expect(terminated).toEqual({
      ok: true,
      result: { kind: 'accepted', operation: 'terminateEmployee' },
    });
  });

  it('lists and retrieves department references', async () => {
    const adapter = new InMemoryHrisHcmAdapter({
      seed: InMemoryHrisHcmAdapter.seedMinimal(TENANT_A),
    });

    const listed = await adapter.execute({ tenantId: TENANT_A, operation: 'listDepartments' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'externalRefs') return;
    expect(listed.result.externalRefs).toHaveLength(1);

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getDepartment',
      payload: { departmentId: listed.result.externalRefs[0]!.externalId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'externalRef') return;
    expect(fetched.result.externalRef.externalType).toBe('department');
  });

  it('handles time off and org structure operations', async () => {
    const adapter = new InMemoryHrisHcmAdapter({
      seed: InMemoryHrisHcmAdapter.seedMinimal(TENANT_A),
    });

    const requested = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'requestTimeOff',
      payload: { label: 'Annual Leave' },
    });
    expect(requested.ok).toBe(true);
    if (!requested.ok || requested.result.kind !== 'externalRef') return;

    const fetchedTimeOff = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getTimeOff',
      payload: { timeOffId: requested.result.externalRef.externalId },
    });
    expect(fetchedTimeOff.ok).toBe(true);
    if (!fetchedTimeOff.ok || fetchedTimeOff.result.kind !== 'externalRef') return;
    expect(fetchedTimeOff.result.externalRef.externalType).toBe('time_off_request');

    const structure = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getCompanyStructure',
    });
    expect(structure.ok).toBe(true);
    if (!structure.ok || structure.result.kind !== 'externalRef') return;
    expect(structure.result.externalRef.externalType).toBe('org_structure');
  });

  it('lists benefit enrolments', async () => {
    const adapter = new InMemoryHrisHcmAdapter({
      seed: InMemoryHrisHcmAdapter.seedMinimal(TENANT_A),
    });
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listBenefitEnrolments',
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'benefits') return;
    expect(result.result.benefits).toHaveLength(1);
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryHrisHcmAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listEmployees',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported HrisHcm operation: bogusOperation.',
    });
  });
});
