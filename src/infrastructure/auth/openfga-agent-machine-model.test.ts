import { describe, it, expect, vi } from 'vitest';
import {
  OpenFgaResourceAuthorization,
  canRegisterAgent,
  canStartRun,
  canControlMachine,
  OPENFGA_RESOURCE_TYPES,
  OPENFGA_RESOURCE_RELATIONS,
  PORTARIUM_AUTHORIZATION_MODEL_DSL,
  type ResourceAuthorizationPort,
} from './openfga-agent-machine-model.js';
import { toAppContext } from '../../application/common/context.js';

function testCtx() {
  return toAppContext({
    tenantId: 'ws-1',
    principalId: 'user-42',
    roles: ['admin'],
    correlationId: 'corr-1',
  });
}

function mockFetch(allowed: boolean) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ allowed }),
  });
}

function failFetch() {
  return vi.fn().mockRejectedValue(new Error('network error'));
}

function notOkFetch() {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({}),
  });
}

describe('OpenFgaResourceAuthorization', () => {
  const baseConfig = {
    apiUrl: 'https://fga.example.com',
    storeId: 'store-1',
  };

  it('returns true when check is allowed', async () => {
    const fetch = mockFetch(true);
    const authz = new OpenFgaResourceAuthorization({ ...baseConfig, fetchImpl: fetch });
    const ctx = testCtx();

    const result = await authz.isResourceAllowed(ctx, {
      resourceType: 'agent',
      resourceId: 'agent-1',
      relation: 'register',
    });

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();

    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body.tuple_key).toEqual({
      user: 'user:user-42',
      relation: 'register',
      object: 'agent:agent-1',
    });
  });

  it('returns false when check is denied', async () => {
    const fetch = mockFetch(false);
    const authz = new OpenFgaResourceAuthorization({ ...baseConfig, fetchImpl: fetch });

    const result = await authz.isResourceAllowed(testCtx(), {
      resourceType: 'machine',
      resourceId: 'machine-5',
      relation: 'control',
    });

    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    const authz = new OpenFgaResourceAuthorization({
      ...baseConfig,
      fetchImpl: failFetch(),
    });

    const result = await authz.isResourceAllowed(testCtx(), {
      resourceType: 'run',
      resourceId: 'run-1',
      relation: 'start',
    });

    expect(result).toBe(false);
  });

  it('returns false on non-ok HTTP response', async () => {
    const authz = new OpenFgaResourceAuthorization({
      ...baseConfig,
      fetchImpl: notOkFetch(),
    });

    const result = await authz.isResourceAllowed(testCtx(), {
      resourceType: 'workflow',
      resourceId: 'wf-1',
      relation: 'execute',
    });

    expect(result).toBe(false);
  });

  it('includes authorization_model_id when configured', async () => {
    const fetch = mockFetch(true);
    const authz = new OpenFgaResourceAuthorization({
      ...baseConfig,
      authorizationModelId: 'model-abc',
      fetchImpl: fetch,
    });

    await authz.isResourceAllowed(testCtx(), {
      resourceType: 'agent',
      resourceId: 'agent-1',
      relation: 'view',
    });

    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body.authorization_model_id).toBe('model-abc');
  });

  it('includes bearer token when configured', async () => {
    const fetch = mockFetch(true);
    const authz = new OpenFgaResourceAuthorization({
      ...baseConfig,
      apiToken: 'secret-token',
      fetchImpl: fetch,
    });

    await authz.isResourceAllowed(testCtx(), {
      resourceType: 'agent',
      resourceId: 'agent-1',
      relation: 'view',
    });

    expect(fetch.mock.calls[0]![1].headers.authorization).toBe('Bearer secret-token');
  });

  it('sends POST to correct endpoint', async () => {
    const fetch = mockFetch(true);
    const authz = new OpenFgaResourceAuthorization({
      ...baseConfig,
      fetchImpl: fetch,
    });

    await authz.isResourceAllowed(testCtx(), {
      resourceType: 'agent',
      resourceId: 'a-1',
      relation: 'register',
    });

    const url = fetch.mock.calls[0]![0];
    expect(url).toBe('https://fga.example.com/stores/store-1/check');
  });

  it('strips email domain from principalId in tuple key (PII guardrail)', async () => {
    const fetch = mockFetch(true);
    const ctx = toAppContext({
      tenantId: 'ws-1',
      principalId: 'alice@example.com',
      roles: ['admin'],
      correlationId: 'corr-1',
    });
    const authz = new OpenFgaResourceAuthorization({
      ...baseConfig,
      authorizationModelId: 'model-1',
      fetchImpl: fetch,
    });

    await authz.isResourceAllowed(ctx, {
      resourceType: 'agent',
      resourceId: 'a-1',
      relation: 'register',
    });

    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body.tuple_key.user).toBe('user:alice');
  });

  it('emits console.warn when authorizationModelId is not pinned in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    new OpenFgaResourceAuthorization({
      ...baseConfig,
      fetchImpl: vi.fn<typeof fetch>(),
      env: { NODE_ENV: 'development' },
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('authorizationModelId is not pinned'),
    );
    warn.mockRestore();
  });

  it('emits console.warn when authorizationModelId is not pinned in test', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    new OpenFgaResourceAuthorization({
      ...baseConfig,
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
        ...baseConfig,
        fetchImpl: vi.fn<typeof fetch>(),
        env: { NODE_ENV: 'production' },
      });
    }).toThrow(/FATAL.*authorizationModelId.*not pinned/i);
  });

  it('throws a fatal error when authorizationModelId is not pinned in staging', () => {
    expect(() => {
      new OpenFgaResourceAuthorization({
        ...baseConfig,
        fetchImpl: vi.fn<typeof fetch>(),
        env: { NODE_ENV: 'staging' },
      });
    }).toThrow(/FATAL/i);
  });

  it('does not warn when authorizationModelId is pinned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    new OpenFgaResourceAuthorization({
      ...baseConfig,
      authorizationModelId: 'model-pinned',
      fetchImpl: vi.fn<typeof fetch>(),
    });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('convenience helpers', () => {
  function mockAuthz(allowed: boolean): ResourceAuthorizationPort {
    return {
      isResourceAllowed: vi.fn().mockResolvedValue(allowed),
    };
  }

  it('canRegisterAgent calls with correct resource', async () => {
    const authz = mockAuthz(true);
    const result = await canRegisterAgent(authz, testCtx(), 'agent-x');
    expect(result).toBe(true);
    expect(authz.isResourceAllowed).toHaveBeenCalledWith(testCtx(), {
      resourceType: 'agent',
      resourceId: 'agent-x',
      relation: 'register',
    });
  });

  it('canStartRun calls with correct resource', async () => {
    const authz = mockAuthz(false);
    const result = await canStartRun(authz, testCtx(), 'wf-1');
    expect(result).toBe(false);
    expect(authz.isResourceAllowed).toHaveBeenCalledWith(testCtx(), {
      resourceType: 'workflow',
      resourceId: 'wf-1',
      relation: 'execute',
    });
  });

  it('canControlMachine calls with correct resource', async () => {
    const authz = mockAuthz(true);
    const result = await canControlMachine(authz, testCtx(), 'machine-9');
    expect(result).toBe(true);
    expect(authz.isResourceAllowed).toHaveBeenCalledWith(testCtx(), {
      resourceType: 'machine',
      resourceId: 'machine-9',
      relation: 'control',
    });
  });
});

describe('model constants', () => {
  it('defines expected resource types', () => {
    expect(OPENFGA_RESOURCE_TYPES).toContain('agent');
    expect(OPENFGA_RESOURCE_TYPES).toContain('machine');
    expect(OPENFGA_RESOURCE_TYPES).toContain('run');
    expect(OPENFGA_RESOURCE_TYPES).toContain('workflow');
    expect(OPENFGA_RESOURCE_TYPES).toContain('workspace');
  });

  it('defines relations per resource type', () => {
    expect(OPENFGA_RESOURCE_RELATIONS.agent).toContain('register');
    expect(OPENFGA_RESOURCE_RELATIONS.machine).toContain('control');
    expect(OPENFGA_RESOURCE_RELATIONS.run).toContain('start');
    expect(OPENFGA_RESOURCE_RELATIONS.workflow).toContain('execute');
  });

  it('authorization model DSL is a non-empty string', () => {
    expect(PORTARIUM_AUTHORIZATION_MODEL_DSL.length).toBeGreaterThan(50);
    expect(PORTARIUM_AUTHORIZATION_MODEL_DSL).toContain('type agent');
    expect(PORTARIUM_AUTHORIZATION_MODEL_DSL).toContain('type machine');
    expect(PORTARIUM_AUTHORIZATION_MODEL_DSL).toContain('type run');
  });
});
