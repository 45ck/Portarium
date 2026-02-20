import { describe, expect, it } from 'vitest';

import {
  TENANT_ISOLATED_PORT_FAMILIES_V1,
  createTenantIsolatedPortFixtureBundleV1,
} from './tenant-isolated-port-fixtures-v1.js';

describe('tenant isolated port fixtures v1', () => {
  it('generates fixtures for every port family', () => {
    const fixtures = createTenantIsolatedPortFixtureBundleV1({ tenantSuffix: 'tenant-a' });
    expect(Object.keys(fixtures).sort()).toEqual([...TENANT_ISOLATED_PORT_FAMILIES_V1].sort());
  });

  it('keeps every seeded tenantId scoped to the requested tenant', () => {
    const fixtures = createTenantIsolatedPortFixtureBundleV1({ tenantSuffix: 'tenant-a' });

    for (const portFamily of TENANT_ISOLATED_PORT_FAMILIES_V1) {
      const tenantIds = collectTenantIds(fixtures[portFamily]);
      expect(tenantIds.size).toBeGreaterThan(0);
      expect(Array.from(tenantIds)).toEqual(['tenant-tenant-a']);
    }
  });

  it('does not leak tenant ids across two fixture bundles', () => {
    const tenantA = createTenantIsolatedPortFixtureBundleV1({ tenantSuffix: 'tenant-a' });
    const tenantB = createTenantIsolatedPortFixtureBundleV1({ tenantSuffix: 'tenant-b' });

    for (const portFamily of TENANT_ISOLATED_PORT_FAMILIES_V1) {
      const aTenantIds = collectTenantIds(tenantA[portFamily]);
      const bTenantIds = collectTenantIds(tenantB[portFamily]);
      expect(Array.from(aTenantIds)).toEqual(['tenant-tenant-a']);
      expect(Array.from(bTenantIds)).toEqual(['tenant-tenant-b']);
    }
  });
});

function collectTenantIds(value: unknown): Set<string> {
  const results = new Set<string>();
  visitNode(value, results);
  return results;
}

function visitNode(value: unknown, results: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      visitNode(item, results);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const tenantIdValue = value['tenantId'];
  if (typeof tenantIdValue === 'string') {
    results.add(tenantIdValue);
  }

  for (const child of Object.values(value)) {
    visitNode(child, results);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
