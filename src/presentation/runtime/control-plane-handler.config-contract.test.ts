import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { err, ok } from '../../application/common/result.js';
import { TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import { parseAdapterRegistrationV1 } from '../../domain/adapters/index.js';
import { parsePolicyV1 } from '../../domain/policy/index.js';
import { parseWorkspaceUserV1 } from '../../domain/users/index.js';
import { InMemoryAdapterRegistrationStore } from '../../infrastructure/stores/in-memory-adapter-registration-store.js';
import { InMemoryPolicyStore } from '../../infrastructure/stores/in-memory-policy-store.js';
import { InMemoryWorkspaceUserStore } from '../../infrastructure/stores/in-memory-workspace-user-store.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

const WORKSPACE_ID = 'workspace-1';
const TENANT_ID = TenantId(WORKSPACE_ID);

type WorkspaceRole = 'admin' | 'operator' | 'approver' | 'auditor';

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx(roles: readonly WorkspaceRole[] = ['admin']) {
  return toAppContext({
    tenantId: WORKSPACE_ID,
    principalId: 'user-admin',
    roles,
    correlationId: 'corr-config-contract',
  });
}

async function startServer(
  overrides: Record<string, unknown>,
  options: { roles?: readonly WorkspaceRole[]; unauthorized?: boolean } = {},
) {
  const deps = {
    authentication: {
      authenticateBearerToken: async () =>
        options.unauthorized
          ? err({ kind: 'Unauthorized' as const, message: 'Missing token.' })
          : ok(makeCtx(options.roles ?? ['admin'])),
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

function makeWorkspaceUserStore() {
  const store = new InMemoryWorkspaceUserStore();
  return store;
}

function makeAdapterRegistrationStore() {
  const store = new InMemoryAdapterRegistrationStore();
  return store;
}

describe('config runtime contract routes', () => {
  it('lists workspace users using the canonical WorkspaceUserV1 shape', async () => {
    const workspaceUserStore = makeWorkspaceUserStore();
    await workspaceUserStore.saveWorkspaceUser(
      TENANT_ID,
      parseWorkspaceUserV1({
        userId: 'user-1',
        workspaceId: WORKSPACE_ID,
        email: 'user-1@example.com',
        displayName: 'User One',
        roles: ['operator'],
        active: true,
        createdAtIso: '2026-01-01T00:00:00Z',
      }),
    );
    await startServer({ workspaceUserStore });

    const res = await fetch(url(workspacePath('/users')));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { userId: string; roles: string[] }[] };
    expect(body.items).toEqual([
      expect.objectContaining({ userId: 'user-1', roles: ['operator'] }),
    ]);
  });

  it('creates workspace users on POST /users and rejects invalid user payloads', async () => {
    const workspaceUserStore = makeWorkspaceUserStore();
    await startServer({ workspaceUserStore });

    const invalid = await fetch(url(workspacePath('/users')), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', roles: ['operator'] }),
    });
    expect(invalid.status).toBe(400);

    const created = await fetch(url(workspacePath('/users')), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'new.user@example.com', roles: ['admin'], active: true }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { email: string; roles: string[]; active: boolean };
    expect(body).toEqual(
      expect.objectContaining({
        email: 'new.user@example.com',
        roles: ['admin'],
        active: true,
      }),
    );
  });

  it('denies workspace user mutation to non-admin roles', async () => {
    const workspaceUserStore = makeWorkspaceUserStore();
    await startServer({ workspaceUserStore }, { roles: ['auditor'] });

    const res = await fetch(url(workspacePath('/users')), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'auditor@example.com', roles: ['auditor'] }),
    });

    expect(res.status).toBe(403);
  });

  it('lists policies and validates list pagination parameters', async () => {
    const policyStore = makePolicyStore();
    await policyStore.savePolicy(
      TENANT_ID,
      WorkspaceId(WORKSPACE_ID),
      parsePolicyV1({
        schemaVersion: 1,
        policyId: 'policy-1',
        workspaceId: WORKSPACE_ID,
        name: 'Default Policy',
        active: true,
        priority: 1,
        version: 1,
        createdAtIso: '2026-01-01T00:00:00Z',
        createdByUserId: 'user-admin',
      }),
    );
    await startServer({ policyStore });

    const invalid = await fetch(url(workspacePath('/policies?limit=0')));
    expect(invalid.status).toBe(400);

    const res = await fetch(url(workspacePath('/policies?limit=10')));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { policyId: string }[] };
    expect(body.items).toEqual([expect.objectContaining({ policyId: 'policy-1' })]);
  });

  it('returns 401 for policy listing when unauthenticated', async () => {
    const policyStore = makePolicyStore();
    await startServer({ policyStore }, { unauthorized: true });

    const res = await fetch(url(workspacePath('/policies')));

    expect(res.status).toBe(401);
  });

  it('lists adapter registrations without exposing machine auth hints', async () => {
    const adapterRegistrationStore = makeAdapterRegistrationStore();
    await adapterRegistrationStore.saveRegistration(
      TENANT_ID,
      parseAdapterRegistrationV1({
        schemaVersion: 1,
        adapterId: 'adapter-1',
        workspaceId: WORKSPACE_ID,
        providerSlug: 'github',
        portFamily: 'SoftwareDev',
        enabled: true,
        capabilityMatrix: [{ operation: 'repository:read', requiresAuth: true }],
        executionPolicy: {
          tenantIsolationMode: 'PerTenantWorker',
          egressAllowlist: ['https://api.github.example'],
          credentialScope: 'capabilityMatrix',
          sandboxVerified: true,
          sandboxAvailable: true,
        },
        machineRegistrations: [
          {
            machineId: 'machine-1',
            endpointUrl: 'https://machine.example.com',
            active: true,
            displayName: 'Machine 1',
            authHint: 'secret-token',
          },
        ],
      }),
    );
    await startServer({ adapterRegistrationStore });

    const res = await fetch(url(workspacePath('/adapter-registrations')));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { machineRegistrations?: { authHint?: string }[] }[];
    };
    expect(body.items[0]?.machineRegistrations?.[0]?.authHint).toBeUndefined();
  });

  it('returns deterministic unsupported response for adapter registration mutations', async () => {
    await startServer({ adapterRegistrationStore: makeAdapterRegistrationStore() });

    const res = await fetch(url(workspacePath('/adapter-registrations')), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerSlug: 'github' }),
    });

    expect(res.status).toBe(501);
  });
});
