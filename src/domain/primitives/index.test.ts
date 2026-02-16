import { describe, expect, it } from 'vitest';

import {
  ActionId,
  AdapterId,
  ApprovalId,
  ArtifactId,
  EvidenceId,
  MachineId,
  PackId,
  PolicyId,
  PortId,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
  WorkflowId,
  brand,
  unbrand,
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
      EvidenceId,
      ArtifactId,
      MachineId,
      PackId,
      UserId,
    ];

    for (const factory of factories) {
      expect(factory('x')).toBe('x');
    }
  });
});
