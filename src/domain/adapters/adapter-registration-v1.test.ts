import { describe, expect, it } from 'vitest';

import { parseAdapterRegistrationV1 } from './adapter-registration-v1.js';

describe('parseAdapterRegistrationV1', () => {
  const validExecutionPolicy = {
    tenantIsolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://api.quickbooks.example'],
    credentialScope: 'capabilityMatrix',
    sandboxVerified: true,
    sandboxAvailable: true,
  } as const;

  const validCapability = {
    operation: 'invoice:list',
    requiresAuth: true,
  };

  const validMachine = {
    machineId: 'machine-1',
    endpointUrl: 'https://api.example.com/v1',
    active: true,
    displayName: 'Production',
  };

  const validFull = {
    schemaVersion: 1,
    adapterId: 'adapter-1',
    workspaceId: 'ws-1',
    providerSlug: 'quickbooks',
    portFamily: 'FinanceAccounting',
    enabled: true,
    capabilityMatrix: [validCapability],
    executionPolicy: validExecutionPolicy,
    machineRegistrations: [validMachine],
  };

  it('parses a valid registration with capabilities and machines', () => {
    const reg = parseAdapterRegistrationV1(validFull);

    expect(reg.schemaVersion).toBe(1);
    expect(reg.adapterId).toBe('adapter-1');
    expect(reg.workspaceId).toBe('ws-1');
    expect(reg.providerSlug).toBe('quickbooks');
    expect(reg.portFamily).toBe('FinanceAccounting');
    expect(reg.enabled).toBe(true);
    expect(reg.capabilityMatrix).toHaveLength(1);
    expect(reg.capabilityMatrix[0]!.operation).toBe('invoice:list');
    expect(reg.executionPolicy.tenantIsolationMode).toBe('PerTenantWorker');
    expect(reg.executionPolicy.egressAllowlist).toEqual(['https://api.quickbooks.example']);
    expect(reg.machineRegistrations).toBeDefined();
    expect(reg.machineRegistrations).toHaveLength(1);
    expect(reg.machineRegistrations![0]!.machineId).toBe('machine-1');
    expect(reg.machineRegistrations![0]!.endpointUrl).toBe('https://api.example.com/v1');
  });

  it('parses canonical capability and mirrors it into operation', () => {
    const reg = parseAdapterRegistrationV1({
      ...validFull,
      capabilityMatrix: [
        {
          capability: 'invoice:write',
          requiresAuth: false,
        },
      ],
    });

    expect(reg.capabilityMatrix).toHaveLength(1);
    expect(reg.capabilityMatrix[0]!.capability).toBe('invoice:write');
    expect(reg.capabilityMatrix[0]!.operation).toBe('invoice:write');
  });

  it('parses minimal registration without machines', () => {
    const minimal = { ...validFull } as Record<string, unknown>;
    delete minimal['machineRegistrations'];
    const reg = parseAdapterRegistrationV1(minimal);

    expect(reg.machineRegistrations).toBeUndefined();
    expect(reg.capabilityMatrix).toHaveLength(1);
  });

  it('rejects non-object values', () => {
    expect(() => parseAdapterRegistrationV1(null)).toThrow(/must be an object/);
    expect(() => parseAdapterRegistrationV1([])).toThrow(/must be an object/);
  });

  it('rejects invalid portFamily', () => {
    expect(() => parseAdapterRegistrationV1({ ...validFull, portFamily: 'InvalidFamily' })).toThrow(
      /Invalid portFamily: "InvalidFamily"/,
    );
  });

  it('rejects empty capabilityMatrix', () => {
    expect(() => parseAdapterRegistrationV1({ ...validFull, capabilityMatrix: [] })).toThrow(
      /capabilityMatrix must be a non-empty array/,
    );
  });

  it('rejects invalid operation format', () => {
    expect(() =>
      parseAdapterRegistrationV1({
        ...validFull,
        capabilityMatrix: [{ operation: 'INVALID', requiresAuth: false }],
      }),
    ).toThrow(/operation must match "entity:verb" format/);
  });

  it('rejects capability and operation mismatch when both are provided', () => {
    expect(() =>
      parseAdapterRegistrationV1({
        ...validFull,
        capabilityMatrix: [
          {
            capability: 'invoice:read',
            operation: 'invoice:write',
            requiresAuth: true,
          },
        ],
      }),
    ).toThrow(/operation must match capability when both are provided/);
  });

  it('rejects invalid endpointUrl', () => {
    expect(() =>
      parseAdapterRegistrationV1({
        ...validFull,
        machineRegistrations: [{ ...validMachine, endpointUrl: 'ftp://bad.example.com' }],
      }),
    ).toThrow(/endpointUrl must start with http:\/\/ or https:\/\//);
  });

  it('rejects missing executionPolicy', () => {
    const invalid = { ...validFull } as Record<string, unknown>;
    delete invalid['executionPolicy'];
    expect(() => parseAdapterRegistrationV1(invalid)).toThrow(/executionPolicy must be an object/i);
  });

  it('rejects unverified sandbox policy', () => {
    expect(() =>
      parseAdapterRegistrationV1({
        ...validFull,
        executionPolicy: {
          ...validExecutionPolicy,
          sandboxVerified: false,
        },
      }),
    ).toThrow(/sandboxVerified must be true/i);
  });

  it('rejects non-https egress entries', () => {
    expect(() =>
      parseAdapterRegistrationV1({
        ...validFull,
        executionPolicy: {
          ...validExecutionPolicy,
          egressAllowlist: ['http://insecure.example'],
        },
      }),
    ).toThrow(/egressAllowlist entries must use https urls/i);
  });
});
