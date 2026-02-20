import { describe, expect, it } from 'vitest';

import { parseApprovalV1 } from '../approvals/approval-v1.js';
import { appendEvidenceEntryV1 } from '../evidence/evidence-chain-v1.js';
import type { EvidenceHasher } from '../evidence/evidence-hasher.js';
import { HashSha256 } from '../primitives/index.js';
import { parsePolicyV1 } from '../policy/policy-v1.js';
import { parseRunV1 } from '../runs/run-v1.js';
import { parseWorkItemV1 } from '../work-items/work-item-v1.js';
import { parseWorkspaceV1 } from '../workspaces/workspace-v1.js';
import { createTenantIsolatedAggregateFixtureBundleV1 } from './tenant-isolated-aggregate-fixtures-v1.js';

const testHasher: EvidenceHasher = {
  sha256Hex(input: string) {
    void input;
    return HashSha256('cd'.repeat(32));
  },
};

describe('tenant isolated aggregate fixtures v1', () => {
  it('creates parseable aggregate fixtures with consistent references', () => {
    const fixtures = createTenantIsolatedAggregateFixtureBundleV1({ tenantSuffix: 'tenant-a' });

    expect(() => parseWorkspaceV1(fixtures.workspace)).not.toThrow();
    expect(() => parsePolicyV1(fixtures.policy)).not.toThrow();
    expect(() => parseRunV1(fixtures.run)).not.toThrow();
    expect(() => parseWorkItemV1(fixtures.workItem)).not.toThrow();
    expect(() => parseApprovalV1(fixtures.approval)).not.toThrow();

    const appended = appendEvidenceEntryV1({
      previous: undefined,
      next: fixtures.evidence,
      hasher: testHasher,
    });

    expect(fixtures.workspace.tenantId).toBe(fixtures.context.tenantId);
    expect(fixtures.policy.workspaceId).toBe(fixtures.context.workspaceId);
    expect(fixtures.run.workspaceId).toBe(fixtures.context.workspaceId);
    expect(fixtures.workItem.workspaceId).toBe(fixtures.context.workspaceId);
    expect(fixtures.approval.workspaceId).toBe(fixtures.context.workspaceId);
    expect(fixtures.evidence.workspaceId).toBe(fixtures.context.workspaceId);
    expect(appended.links?.runId).toBe(fixtures.context.runId);
    expect(appended.links?.workItemId).toBe(fixtures.context.workItemId);
  });

  it('isolates fixture ids between tenants', () => {
    const tenantA = createTenantIsolatedAggregateFixtureBundleV1({ tenantSuffix: 'tenant-a' });
    const tenantB = createTenantIsolatedAggregateFixtureBundleV1({ tenantSuffix: 'tenant-b' });

    expect(tenantA.context.tenantId).not.toBe(tenantB.context.tenantId);
    expect(tenantA.context.workspaceId).not.toBe(tenantB.context.workspaceId);
    expect(tenantA.context.runId).not.toBe(tenantB.context.runId);
    expect(tenantA.context.workItemId).not.toBe(tenantB.context.workItemId);
    expect(tenantA.context.approvalId).not.toBe(tenantB.context.approvalId);

    expect(tenantA.workspace.tenantId).toBe(tenantA.context.tenantId);
    expect(tenantB.workspace.tenantId).toBe(tenantB.context.tenantId);
    expect(tenantA.workspace.tenantId).not.toBe(tenantB.workspace.tenantId);
  });
});
