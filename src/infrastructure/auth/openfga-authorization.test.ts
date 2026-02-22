import { describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { APP_ACTIONS } from '../../application/common/actions.js';
import { OpenFgaAuthorization, sanitizePrincipalForTuple } from './openfga-authorization.js';

describe('OpenFgaAuthorization', () => {
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

  it('denies when local role gate fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const authz = new OpenFgaAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl,
    });

    const allowed = await authz.isAllowed(makeCtx(['auditor']), APP_ACTIONS.runStart);

    expect(allowed).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('allows when OpenFGA check allows', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }),
    );
    const authz = new OpenFgaAuthorization({
      apiUrl: 'http://openfga.local/',
      storeId: 'store-1',
      authorizationModelId: 'model-1',
      apiToken: 'token-1',
      fetchImpl,
    });

    const allowed = await authz.isAllowed(makeCtx(['operator']), APP_ACTIONS.runStart);

    expect(allowed).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://openfga.local/stores/store-1/check',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          authorization: 'Bearer token-1',
        }),
      }),
    );
    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const bodyText = typeof requestBody === 'string' ? requestBody : '';
    const body = JSON.parse(bodyText) as {
      tuple_key: { relation: string; object: string; user: string };
      authorization_model_id: string;
    };
    expect(body.tuple_key.user).toBe('user:user-1');
    expect(body.tuple_key.object).toBe('workspace:ws-1');
    expect(body.tuple_key.relation).toBe('run_start');
    expect(body.authorization_model_id).toBe('model-1');
  });

  it('denies when OpenFGA check endpoint fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('boom', { status: 500 }));
    const authz = new OpenFgaAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl,
    });

    const allowed = await authz.isAllowed(makeCtx(['operator']), APP_ACTIONS.runRead);

    expect(allowed).toBe(false);
  });

  it('emits a console.warn when authorizationModelId is not pinned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    new OpenFgaAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      fetchImpl: vi.fn<typeof fetch>(),
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('authorizationModelId is not pinned'),
    );
    warn.mockRestore();
  });

  it('does not warn when authorizationModelId is pinned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    new OpenFgaAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      authorizationModelId: 'model-pinned',
      fetchImpl: vi.fn<typeof fetch>(),
    });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('strips email domain from principalId in tuple key (PII guardrail)', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }),
    );
    const ctx = toAppContext({
      tenantId: 'ws-1',
      principalId: 'alice@example.com',
      roles: ['operator'],
      correlationId: 'corr-1',
    });
    const authz = new OpenFgaAuthorization({
      apiUrl: 'http://openfga.local',
      storeId: 'store-1',
      authorizationModelId: 'model-1',
      fetchImpl,
    });

    await authz.isAllowed(ctx, APP_ACTIONS.runStart);

    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof requestBody === 'string' ? requestBody : '') as {
      tuple_key: { user: string };
    };
    expect(body.tuple_key.user).toBe('user:alice');
  });
});

describe('sanitizePrincipalForTuple', () => {
  it('strips email domain', () => {
    expect(sanitizePrincipalForTuple('alice@example.com')).toBe('alice');
  });

  it('returns plain id unchanged', () => {
    expect(sanitizePrincipalForTuple('user-abc-123')).toBe('user-abc-123');
  });

  it('handles id with no @ character', () => {
    expect(sanitizePrincipalForTuple('principal')).toBe('principal');
  });
});
