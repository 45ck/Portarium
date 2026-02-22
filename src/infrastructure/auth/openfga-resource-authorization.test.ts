import { describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import {
  OpenFgaResourceAuthorization,
  type ResourceCheckInput,
} from './openfga-resource-authorization.js';

describe('OpenFgaResourceAuthorization', () => {
  function makeCtx(
    roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator'],
  ) {
    return toAppContext({
      tenantId: 'ws-1',
      principalId: 'user-1',
      roles,
      correlationId: 'corr-1',
    });
  }

  const agentRegister: ResourceCheckInput = {
    resourceType: 'agent',
    resourceId: 'agent-42',
    action: 'agent:register',
  };

  const runCreate: ResourceCheckInput = {
    resourceType: 'run',
    resourceId: 'run-99',
    action: 'run:create',
  };

  const machineControl: ResourceCheckInput = {
    resourceType: 'machine',
    resourceId: 'machine-7',
    action: 'machine:control',
  };

  it('denies when RBAC role gate fails for agent:register', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const authz = new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl,
    });

    const allowed = await authz.isAllowedOnResource(makeCtx(['auditor']), agentRegister);

    expect(allowed).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('denies when RBAC role gate fails for run:create', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const authz = new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl,
    });

    const allowed = await authz.isAllowedOnResource(makeCtx(['auditor']), runCreate);

    expect(allowed).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('allows when RBAC passes and OpenFGA check allows', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }),
    );
    const authz = new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      authorizationModelId: 'model-1',
      apiToken: 'fga-token',
      fetchImpl,
    });

    const allowed = await authz.isAllowedOnResource(makeCtx(['admin']), agentRegister);

    expect(allowed).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof requestBody === 'string' ? requestBody : '{}') as {
      tuple_key: { user: string; relation: string; object: string };
    };
    expect(body.tuple_key.user).toBe('user:user-1');
    expect(body.tuple_key.relation).toBe('agent_register');
    expect(body.tuple_key.object).toBe('agent:ws-1/agent-42');
  });

  it('denies when OpenFGA returns false', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ allowed: false }), { status: 200 }),
    );
    const authz = new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl,
    });

    const allowed = await authz.isAllowedOnResource(makeCtx(['admin']), machineControl);

    expect(allowed).toBe(false);
  });

  it('denies when OpenFGA endpoint fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('error', { status: 500 }));
    const authz = new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl,
    });

    const allowed = await authz.isAllowedOnResource(makeCtx(['operator']), runCreate);

    expect(allowed).toBe(false);
  });

  it('denies when fetch throws', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('network failure');
    });
    const authz = new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl,
    });

    const allowed = await authz.isAllowedOnResource(makeCtx(['operator']), runCreate);

    expect(allowed).toBe(false);
  });

  it('sends correct object ref for run resources', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }),
    );
    const authz = new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl,
    });

    await authz.isAllowedOnResource(makeCtx(['operator']), runCreate);

    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof requestBody === 'string' ? requestBody : '{}') as {
      tuple_key: { object: string };
    };
    expect(body.tuple_key.object).toBe('run:ws-1/run-99');
  });

  it('strips email domain from principalId in tuple key (PII guardrail)', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }),
    );
    const ctx = toAppContext({
      tenantId: 'ws-1',
      principalId: 'alice@example.com',
      roles: ['admin'],
      correlationId: 'corr-1',
    });
    const authz = new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      authorizationModelId: 'model-1',
      fetchImpl,
    });

    await authz.isAllowedOnResource(ctx, agentRegister);

    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof requestBody === 'string' ? requestBody : '{}') as {
      tuple_key: { user: string };
    };
    expect(body.tuple_key.user).toBe('user:alice');
  });

  it('emits a console.warn when authorizationModelId is not pinned in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl: vi.fn<typeof fetch>(),
      env: { NODE_ENV: 'development' },
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('authorizationModelId is not pinned'),
    );
    warn.mockRestore();
  });

  it('emits a console.warn when authorizationModelId is not pinned in test', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl: vi.fn<typeof fetch>(),
      env: { NODE_ENV: 'test' },
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('authorizationModelId is not pinned'),
    );
    warn.mockRestore();
  });

  it('throws a fatal error when authorizationModelId is not pinned in production', () => {
    expect(() => {
      new OpenFgaResourceAuthorization({
        apiUrl: 'http://openfga.local',
        storeId: 'store-1',
        fetchImpl: vi.fn<typeof fetch>(),
        env: { NODE_ENV: 'production' },
      });
    }).toThrow(/FATAL.*authorizationModelId.*not pinned/i);
  });

  it('throws a fatal error when authorizationModelId is not pinned and NODE_ENV=staging', () => {
    expect(() => {
      new OpenFgaResourceAuthorization({
        apiUrl: 'http://openfga.local',
        storeId: 'store-1',
        fetchImpl: vi.fn<typeof fetch>(),
        env: { NODE_ENV: 'staging' },
      });
    }).toThrow(/FATAL/i);
  });

  it('does not warn when authorizationModelId is pinned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    new OpenFgaResourceAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      authorizationModelId: 'model-pinned',
      fetchImpl: vi.fn<typeof fetch>(),
    });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
