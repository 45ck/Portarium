import { afterEach, describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';
import { InMemoryCockpitWebSessionStore } from './cockpit-web-session.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx() {
  return toAppContext({
    tenantId: 'tenant-1',
    principalId: 'user-1',
    roles: ['operator'],
    scopes: ['runs.read'],
    capabilities: ['objects:read'],
    correlationId: 'corr-web-session',
  });
}

function makeDeps(overrides: Partial<ControlPlaneDeps> = {}): ControlPlaneDeps {
  return {
    authentication: {
      authenticateBearerToken: vi.fn(async () => ok(makeCtx())),
    },
    authorization: {
      isAllowed: vi.fn(async () => true),
    },
    workspaceStore: {
      getWorkspaceById: vi.fn(async () => null),
      getWorkspaceByName: vi.fn(async () => null),
      saveWorkspace: vi.fn(async () => undefined),
    },
    runStore: {
      getRunById: vi.fn(async () => null),
      saveRun: vi.fn(async () => undefined),
    },
    runQueryStore: {
      listRuns: vi.fn(async () => ({ items: [] })),
    },
    cockpitWebSessionStore: new InMemoryCockpitWebSessionStore(),
    cockpitWebSessionConfig: {
      allowDevelopmentSession: true,
      developmentBearerToken: 'dev-token',
      ttlSeconds: 60,
    },
    clock: () => new Date('2026-04-30T02:00:00.000Z'),
    ...overrides,
  };
}

async function startWith(deps: ControlPlaneDeps): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(deps),
  });
}

function url(path: string): string {
  return `http://${handle!.host}:${handle!.port}${path}`;
}

function cookiePair(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('Expected Set-Cookie header.');
  return setCookie.split(';')[0]!;
}

describe('createControlPlaneHandler cockpit web sessions', () => {
  it('returns no-store 401 for missing web session cookies', async () => {
    await startWith(makeDeps());

    const res = await fetch(url('/auth/session'));

    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { title: string; detail: string };
    expect(body.title).toBe('Unauthorized');
    expect(body.detail).toBe('Cockpit web session is not authenticated.');
  });

  it('requires the request marker before creating a development web session', async () => {
    await startWith(makeDeps());

    const res = await fetch(url('/auth/dev-session'), { method: 'POST' });

    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toContain('X-Portarium-Request');
  });

  it('creates, reads, and logs out a development web session without exposing tokens', async () => {
    const auth = vi.fn(async () => ok(makeCtx()));
    const deps = makeDeps({
      authentication: { authenticateBearerToken: auth },
    });
    await startWith(deps);

    const created = await fetch(url('/auth/dev-session'), {
      method: 'POST',
      headers: { 'x-portarium-request': '1' },
    });

    expect(created.status).toBe(200);
    expect(auth).toHaveBeenCalledWith(
      expect.objectContaining({ authorizationHeader: 'Bearer dev-token' }),
    );
    const setCookie = created.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('portarium_cockpit_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=60');
    expect(setCookie).toContain('Secure');
    expect(created.headers.get('cache-control')).toBe('no-store');
    const createdBodyText = await created.text();
    expect(createdBodyText).toContain('"authenticated":true');
    expect(createdBodyText).not.toContain('access_token');
    expect(createdBodyText).not.toContain('refresh_token');

    const cookie = cookiePair(created);
    const session = await fetch(url('/auth/session'), { headers: { cookie } });
    expect(session.status).toBe(200);
    expect(auth).toHaveBeenCalledTimes(1);
    const sessionBody = (await session.json()) as {
      authenticated: true;
      claims: { sub: string; workspaceId: string };
    };
    expect(sessionBody.claims).toMatchObject({ sub: 'user-1', workspaceId: 'tenant-1' });

    const runs = await fetch(url('/v1/workspaces/tenant-1/runs'), { headers: { cookie } });
    expect(runs.status).toBe(200);
    expect(auth).toHaveBeenCalledTimes(1);

    const mismatch = await fetch(url('/v1/workspaces/other-tenant/runs'), {
      headers: { cookie },
    });
    expect(mismatch.status).toBe(401);

    const logout = await fetch(url('/auth/logout'), {
      method: 'POST',
      headers: { cookie, 'x-portarium-request': '1' },
    });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(logout.headers.get('cache-control')).toBe('no-store');

    const afterLogout = await fetch(url('/auth/session'), { headers: { cookie } });
    expect(afterLogout.status).toBe(401);
  });

  it('exchanges an OIDC callback server-side and caps session ttl to token expiry', async () => {
    const fetchImpl = vi.fn(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const requestUrl = String(input);
        if (requestUrl.endsWith('/.well-known/openid-configuration')) {
          return new Response(
            JSON.stringify({ token_endpoint: 'https://issuer.test/oauth/token' }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        expect(requestUrl).toBe('https://issuer.test/oauth/token');
        expect(init?.method).toBe('POST');
        expect(String(init?.body)).toContain('code=code-1');
        expect(String(init?.body)).toContain('code_verifier=verifier-1');
        return new Response(
          JSON.stringify({
            access_token: 'oidc-access-token',
            token_type: 'Bearer',
            expires_in: 30,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    );
    const auth = vi.fn(async () => ok(makeCtx()));
    await startWith(
      makeDeps({
        authentication: { authenticateBearerToken: auth },
        cockpitWebSessionConfig: {
          oidcIssuer: 'https://issuer.test',
          oidcClientId: 'cockpit-client',
          oidcRedirectUri: 'https://cockpit.test/auth/callback',
          ttlSeconds: 120,
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      }),
    );

    const res = await fetch(url('/auth/oidc/callback'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-portarium-request': '1',
      },
      body: JSON.stringify({
        code: 'code-1',
        state: 'state-1',
        codeVerifier: 'verifier-1',
      }),
    });

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(auth).toHaveBeenCalledWith(
      expect.objectContaining({ authorizationHeader: 'Bearer oidc-access-token' }),
    );
    expect(res.headers.get('set-cookie')).toContain('Max-Age=30');
    const bodyText = await res.text();
    expect(bodyText).toContain('"authenticated":true');
    expect(bodyText).not.toContain('oidc-access-token');
  });

  it('rejects malformed OIDC callback payloads', async () => {
    await startWith(makeDeps());

    const res = await fetch(url('/auth/oidc/callback'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-portarium-request': '1',
      },
      body: JSON.stringify({ code: 'code-1' }),
    });

    expect(res.status).toBe(422);
  });
});
