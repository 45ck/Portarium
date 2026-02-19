import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryHrisHcmAdapter } from './in-memory-hris-hcm-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryHrisHcmAdapter integration', () => {
  it('supports employee create/get/update/terminate/list flow', async () => {
    const adapter = new InMemoryHrisHcmAdapter({
      seed: InMemoryHrisHcmAdapter.seedMinimal(TENANT),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createEmployee',
      payload: { displayName: 'Jordan Lee', email: 'jordan@example.com' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'employee') return;
    const partyId = created.result.employee.partyId;

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getEmployee',
      payload: { partyId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'employee') return;
    expect(fetched.result.employee.displayName).toBe('Jordan Lee');

    const updated = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateEmployee',
      payload: { partyId, displayName: 'Jordan L.' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'employee') return;
    expect(updated.result.employee.displayName).toBe('Jordan L.');

    const terminated = await adapter.execute({
      tenantId: TENANT,
      operation: 'terminateEmployee',
      payload: { partyId, reason: 'offboarding' },
    });
    expect(terminated).toEqual({
      ok: true,
      result: { kind: 'accepted', operation: 'terminateEmployee' },
    });

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listEmployees' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'employees') return;
    expect(listed.result.employees.some((employee) => employee.partyId === partyId)).toBe(true);
  });

  it('supports department and job-position listing/lookup', async () => {
    const adapter = new InMemoryHrisHcmAdapter({
      seed: InMemoryHrisHcmAdapter.seedMinimal(TENANT),
    });

    const departments = await adapter.execute({ tenantId: TENANT, operation: 'listDepartments' });
    expect(departments.ok).toBe(true);
    if (!departments.ok || departments.result.kind !== 'externalRefs') return;
    expect(departments.result.externalRefs).toHaveLength(1);

    const fetchedDepartment = await adapter.execute({
      tenantId: TENANT,
      operation: 'getDepartment',
      payload: { departmentId: departments.result.externalRefs[0]!.externalId },
    });
    expect(fetchedDepartment.ok).toBe(true);
    if (!fetchedDepartment.ok || fetchedDepartment.result.kind !== 'externalRef') return;
    expect(fetchedDepartment.result.externalRef.externalType).toBe('department');

    const positions = await adapter.execute({ tenantId: TENANT, operation: 'listJobPositions' });
    expect(positions.ok).toBe(true);
    if (!positions.ok || positions.result.kind !== 'externalRefs') return;
    expect(positions.result.externalRefs).toHaveLength(1);
  });

  it('supports time-off request/get and company structure read', async () => {
    const adapter = new InMemoryHrisHcmAdapter({
      seed: InMemoryHrisHcmAdapter.seedMinimal(TENANT),
    });

    const requested = await adapter.execute({
      tenantId: TENANT,
      operation: 'requestTimeOff',
      payload: { label: 'Parental leave' },
    });
    expect(requested.ok).toBe(true);
    if (!requested.ok || requested.result.kind !== 'externalRef') return;
    const timeOffId = requested.result.externalRef.externalId;

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getTimeOff',
      payload: { timeOffId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'externalRef') return;
    expect(fetched.result.externalRef.externalId).toBe(timeOffId);

    const structure = await adapter.execute({ tenantId: TENANT, operation: 'getCompanyStructure' });
    expect(structure.ok).toBe(true);
    if (!structure.ok || structure.result.kind !== 'externalRef') return;
    expect(structure.result.externalRef.externalType).toBe('org_structure');
  });

  it('supports benefit enrolment listing', async () => {
    const adapter = new InMemoryHrisHcmAdapter({
      seed: InMemoryHrisHcmAdapter.seedMinimal(TENANT),
    });

    const result = await adapter.execute({
      tenantId: TENANT,
      operation: 'listBenefitEnrolments',
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'benefits') return;
    expect(result.result.benefits).toHaveLength(1);
    expect(result.result.benefits[0]!.planName).toBe('Health Plan A');
  });
});
