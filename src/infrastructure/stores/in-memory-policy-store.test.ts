import { describe, expect, it } from 'vitest';

import { PolicyId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import { parsePolicyV1 } from '../../domain/policy/policy-v1.js';
import { InMemoryPolicyStore } from './in-memory-policy-store.js';

const T = TenantId('t-1');
const WS = WorkspaceId('ws-1');

function makePolicy(id: string) {
  return parsePolicyV1({
    schemaVersion: 1,
    policyId: id,
    workspaceId: 'ws-1',
    name: `Policy ${id}`,
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-01-01T00:00:00Z',
    createdByUserId: 'user-1',
  });
}

describe('InMemoryPolicyStore', () => {
  it('returns null for unknown policy', async () => {
    const store = new InMemoryPolicyStore();
    expect(await store.getPolicyById(T, WS, PolicyId('nope'))).toBeNull();
  });

  it('saves and retrieves a policy', async () => {
    const store = new InMemoryPolicyStore();
    const policy = makePolicy('pol-1');
    await store.savePolicy(T, WS, policy);
    const found = await store.getPolicyById(T, WS, PolicyId('pol-1'));
    expect(found).not.toBeNull();
    expect(found!.policyId).toBe('pol-1');
    expect(found!.name).toBe('Policy pol-1');
  });

  it('isolates by tenant and workspace', async () => {
    const store = new InMemoryPolicyStore();
    const policy = makePolicy('pol-x');
    await store.savePolicy(T, WS, policy);
    expect(await store.getPolicyById(TenantId('other'), WS, PolicyId('pol-x'))).toBeNull();
    expect(await store.getPolicyById(T, WorkspaceId('other'), PolicyId('pol-x'))).toBeNull();
  });
});
