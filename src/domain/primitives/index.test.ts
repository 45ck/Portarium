import { describe, expect, it } from 'vitest';

import {
  ActionId,
  AdapterId,
  ApprovalId,
  ArtifactId,
  EvidenceId,
  EffectId,
  HashSha256,
  MachineId,
  PackId,
  PORT_FAMILIES,
  PlanId,
  PolicyId,
  PortId,
  RunId,
  TenantId,
  WORKSPACE_USER_ROLES,
  UserId,
  WorkspaceId,
  WorkflowId,
  brand,
  isPortFamily,
  isWorkspaceUserRole,
  unbrand,
  WorkItemId,
} from './index.js';

describe('domain primitives', () => {
  it('brand is an identity function at runtime', () => {
    expect(brand('abc')).toBe('abc');
  });

  it('unbrand returns the underlying value', () => {
    const tenantId = TenantId('tenant-123');
    expect(unbrand(tenantId)).toBe('tenant-123');
  });

  it('ID factories return the same string at runtime', () => {
    const factories: ((value: string) => string)[] = [
      TenantId,
      WorkspaceId,
      WorkflowId,
      RunId,
      AdapterId,
      PortId,
      ActionId,
      PolicyId,
      ApprovalId,
      PlanId,
      EffectId,
      EvidenceId,
      WorkItemId,
      ArtifactId,
      HashSha256,
      MachineId,
      PackId,
      UserId,
    ];

    for (const factory of factories) {
      expect(factory('x')).toBe('x');
    }
  });

  it('isPortFamily accepts known families', () => {
    for (const f of PORT_FAMILIES) {
      expect(isPortFamily(f)).toBe(true);
    }
    expect(isPortFamily('NotARealPortFamily')).toBe(false);
  });

  it('isWorkspaceUserRole accepts known roles', () => {
    for (const role of WORKSPACE_USER_ROLES) {
      expect(isWorkspaceUserRole(role)).toBe(true);
    }
    expect(isWorkspaceUserRole('superAdmin')).toBe(false);
  });
});
