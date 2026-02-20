import { describe, expect, it } from 'vitest';

import {
  ActionId,
  AdapterId,
  AgentId,
  ApprovalId,
  ArtifactId,
  CorrelationId,
  FloorId,
  FleetId,
  EvidenceId,
  EffectId,
  GatewayId,
  HumanTaskId,
  HashSha256,
  LocationEventId,
  MapLayerId,
  MachineId,
  PackId,
  PORT_FAMILIES,
  PlanId,
  PolicyId,
  PortId,
  RunId,
  MissionId,
  TenantId,
  WORKSPACE_USER_ROLES,
  UserId,
  WorkspaceId,
  WorkflowId,
  WorkforceMemberId,
  WorkforceQueueId,
  RobotId,
  SiteId,
  SourceStreamId,
  brand,
  isPortFamily,
  isWorkspaceUserRole,
  unbrand,
  WorkItemId,
  WORKSPACE_ID_ALIAS_GUARD,
  type WorkspaceIdEqualsTenantId,
} from './index.js';

// Compile-time assertion: WORKSPACE_ID_ALIAS_GUARD is typed as WorkspaceIdEqualsTenantId.
// If the alias breaks, the assignment in index.ts (true as WorkspaceIdEqualsTenantId) becomes a TS error.
type AssertTrue<T extends true> = T;
const _workspaceAliasCompileTimeCheck: AssertTrue<WorkspaceIdEqualsTenantId> = true;
// Deliberate violation: guard is `true`, never `false`.
// @ts-expect-error WorkspaceId/TenantId alias guard must not be false.
const _workspaceAliasDeliberateViolation: false = WORKSPACE_ID_ALIAS_GUARD;
void _workspaceAliasCompileTimeCheck;
void _workspaceAliasDeliberateViolation;

describe('domain primitives', () => {
  it('WorkspaceId is a compile-time alias for TenantId (guard is true at runtime)', () => {
    expect(WORKSPACE_ID_ALIAS_GUARD).toBe(true);
  });

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
      CorrelationId,
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
      AgentId,
      PackId,
      UserId,
      LocationEventId,
      SourceStreamId,
      MapLayerId,
      SiteId,
      FloorId,
      RobotId,
      FleetId,
      MissionId,
      GatewayId,
      WorkforceMemberId,
      WorkforceQueueId,
      HumanTaskId,
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
