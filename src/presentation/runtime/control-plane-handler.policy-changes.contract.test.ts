import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { err, ok } from '../../application/common/result.js';
import { PolicyId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import { parsePolicyV1 } from '../../domain/policy/index.js';
import { InMemoryEvidenceLog } from '../../infrastructure/stores/in-memory-evidence-log.js';
import { InMemoryPolicyStore } from '../../infrastructure/stores/in-memory-policy-store.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

const WORKSPACE_ID = 'workspace-1';
const TENANT_ID = TenantId(WORKSPACE_ID);
const NOW = '2026-05-01T00:00:00.000Z';

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx(principalId = 'user-admin') {
  return toAppContext({
    tenantId: WORKSPACE_ID,
    principalId,
    roles: ['admin'],
    correlationId: 'corr-policy-change-contract',
  });
}

async function startServer(overrides: Record<string, unknown>, unauthorized = false) {
  const deps = {
    authentication: {
      authenticateBearerToken: async () =>
        unauthorized
          ? err({ kind: 'Unauthorized' as const, message: 'Missing token.' })
          : ok(makeCtx()),
    },
    authorization: { isAllowed: async () => true },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: async () => null,
      saveRun: async () => undefined,
    },
    unitOfWork: { execute: async <T>(fn: () => Promise<T>) => fn() },
    eventPublisher: { publish: async () => undefined },
    evidenceLog: new InMemoryEvidenceLog(),
    clock: () => new Date(NOW),
    ...overrides,
  };

  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(
      deps as unknown as Parameters<typeof createControlPlaneHandler>[0],
    ),
  });
}

function url(path: string): string {
  return `http://${handle!.host}:${handle!.port}${path}`;
}

function workspacePath(path: string): string {
  return `/v1/workspaces/${WORKSPACE_ID}${path}`;
}

function makePolicyStore() {
  const store = new InMemoryPolicyStore();
  return store;
}

function existingPolicy() {
  return parsePolicyV1({
    schemaVersion: 1,
    policyId: 'pol-live-approval',
    workspaceId: WORKSPACE_ID,
    name: 'Local human approval gate',
    description: 'Requires human review.',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-04-30T00:00:00.000Z',
    createdByUserId: 'user-admin',
    rules: [
      {
        ruleId: 'rule-live-approval-001',
        condition: 'run.executionTier == "HumanApprove"',
        effect: 'Allow',
      },
    ],
  });
}

function proposalBody() {
  return {
    policyId: 'pol-live-approval',
    operation: 'Update',
    risk: 'High',
    scope: { targetKind: 'Workspace', workspaceId: WORKSPACE_ID },
    proposedPolicy: {
      schemaVersion: 1,
      policyId: 'pol-live-approval',
      workspaceId: WORKSPACE_ID,
      name: 'Local human approval gate',
      description: 'Cockpit Policy Controller matrix.',
      active: true,
      priority: 1,
      version: 2,
      createdAtIso: NOW,
      createdByUserId: 'cockpit-policy-controller',
      rules: [
        {
          ruleId: 'controller-external-executor',
          condition: 'controller.actionClass == "external-executor"',
          effect: 'Deny',
        },
      ],
    },
    rationale: 'Keep external executor actions approval-gated or denied.',
    diff: [
      {
        path: '/cockpitPolicyController',
        before: { ruleText: 'ALLOW WHEN run.executionTier == "HumanApprove"' },
        after: { routes: [{ actionClass: 'external-executor', decision: 'deny' }] },
      },
    ],
    runEffect: 'FutureRunsOnly',
    effectiveFromIso: '2026-05-01T00:01:00.000Z',
    approvalRequired: true,
    replayReportRequired: false,
  };
}

describe('policy change runtime contract routes', () => {
  it('proposes, lists, and reads a pending policy change', async () => {
    const policyStore = makePolicyStore();
    await policyStore.savePolicy(TENANT_ID, WorkspaceId(WORKSPACE_ID), existingPolicy());
    await startServer({ policyStore });

    const proposed = await fetch(url(workspacePath('/policy-changes')), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(proposalBody()),
    });

    expect(proposed.status).toBe(202);
    const proposedBody = (await proposed.json()) as {
      policyChangeId: string;
      status: string;
      approvalRequired: boolean;
    };
    expect(proposedBody).toEqual(
      expect.objectContaining({ status: 'PendingApproval', approvalRequired: true }),
    );

    const list = await fetch(
      url(workspacePath('/policy-changes?policyId=pol-live-approval&limit=10')),
    );
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { items: { policyChangeId: string }[] };
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0]?.policyChangeId).toBe(proposedBody.policyChangeId);

    const read = await fetch(url(workspacePath(`/policy-changes/${proposedBody.policyChangeId}`)));
    expect(read.status).toBe(200);
    const readBody = (await read.json()) as { status: string; proposedPolicy: { version: number } };
    expect(readBody.status).toBe('PendingApproval');
    expect(readBody.proposedPolicy.version).toBe(2);
  });

  it('approves a pending policy change and applies the proposed policy', async () => {
    const policyStore = makePolicyStore();
    await policyStore.savePolicy(TENANT_ID, WorkspaceId(WORKSPACE_ID), existingPolicy());
    let principalId = 'maker-admin';
    await startServer({
      policyStore,
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(principalId)),
      },
    });

    const proposed = await fetch(url(workspacePath('/policy-changes')), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(proposalBody()),
    });
    expect(proposed.status).toBe(202);
    const proposedBody = (await proposed.json()) as {
      policyChangeId: string;
      status: string;
    };
    expect(proposedBody.status).toBe('PendingApproval');

    principalId = 'checker-admin';
    const approved = await fetch(
      url(workspacePath(`/policy-changes/${proposedBody.policyChangeId}/approve`)),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          approvalId: 'approval-policy-controller-contract',
          rationale: 'Checker reviewed the policy-controller diff.',
        }),
      },
    );

    expect(approved.status).toBe(200);
    const approvedBody = (await approved.json()) as { status: string };
    expect(approvedBody.status).toBe('Applied');
    const current = await policyStore.getPolicyById(
      TENANT_ID,
      WorkspaceId(WORKSPACE_ID),
      PolicyId('pol-live-approval'),
    );
    expect(current?.version).toBe(2);
  });

  it('validates list query parameters', async () => {
    await startServer({ policyStore: makePolicyStore() });

    const missingPolicy = await fetch(url(workspacePath('/policy-changes')));
    expect(missingPolicy.status).toBe(400);

    const invalidLimit = await fetch(
      url(workspacePath('/policy-changes?policyId=pol-live-approval&limit=0')),
    );
    expect(invalidLimit.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    await startServer({ policyStore: makePolicyStore() }, true);

    const res = await fetch(
      url(workspacePath('/policy-changes?policyId=pol-live-approval&limit=10')),
    );

    expect(res.status).toBe(401);
  });

  it('returns 503 when policy change workflow dependencies are missing', async () => {
    await startServer({ policyStore: undefined });

    const res = await fetch(url(workspacePath('/policy-changes')), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(proposalBody()),
    });

    expect(res.status).toBe(503);
  });
});
