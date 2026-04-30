import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_REFRESH_TOKEN_KEY, readStoredBearerToken } from '@/lib/auth-token';
import { QUERY_CACHE_STORAGE_KEY, queryClient } from '@/lib/query-client';
import { useAuthStore } from './auth-store';

const nativeBridgeMock = vi.hoisted(() => {
  const secureStore = new Map<string, string>();
  return {
    secureStore,
    native: true,
    secureGet: vi.fn((key: string) => Promise.resolve(secureStore.get(key) ?? null)),
    secureSet: vi.fn((key: string, value: string) => {
      secureStore.set(key, value);
      return Promise.resolve();
    }),
    secureRemove: vi.fn((key: string) => {
      secureStore.delete(key);
      return Promise.resolve();
    }),
    openInAppBrowser: vi.fn(() => Promise.resolve()),
    closeInAppBrowser: vi.fn(() => Promise.resolve()),
    onDeepLink: vi.fn(() => Promise.resolve(() => undefined)),
    isNative: vi.fn(() => nativeBridgeMock.native),
  };
});

const oidcMock = vi.hoisted(() => {
  class TestOidcError extends Error {
    public readonly code: string;

    public constructor(message: string, code: string) {
      super(message);
      this.name = 'OidcError';
      this.code = code;
    }
  }

  const jwtPayloads = new Map<string, Record<string, unknown>>();
  return {
    jwtPayloads,
    configured: true,
    loadOidcConfig: vi.fn(() => ({ issuer: 'https://idp.test', clientId: 'client-1' })),
    isOidcConfigured: vi.fn(() => oidcMock.configured),
    prepareLoginSession: vi.fn(() =>
      Promise.resolve({ authorizationUrl: 'https://idp.test/auth' }),
    ),
    exchangeCode: vi.fn(() =>
      Promise.resolve({ access_token: 'fresh-token', refresh_token: 'fresh-refresh-token' }),
    ),
    parseCallbackUrl: vi.fn(() => ({ code: 'code-1', state: 'state-1' })),
    decodeJwtPayload: vi.fn((jwt: string) => {
      const payload = jwtPayloads.get(jwt);
      if (!payload) throw new TestOidcError('Invalid JWT', 'invalid_jwt');
      return payload;
    }),
    OidcError: TestOidcError,
  };
});

const webSessionMock = vi.hoisted(() => ({
  currentSession: null as null | {
    authenticated: true;
    claims: {
      sub: string;
      workspaceId: string;
      roles: string[];
      personas: string[];
      capabilities: string[];
      apiScopes: string[];
    };
  },
  fetchCurrentWebSession: vi.fn(() => Promise.resolve(webSessionMock.currentSession)),
  establishWebSession: vi.fn(() =>
    Promise.resolve({
      authenticated: true as const,
      claims: {
        sub: 'web-user',
        workspaceId: 'web-ws',
        roles: ['operator'],
        personas: [],
        capabilities: [],
        apiScopes: [],
      },
    }),
  ),
  createDevelopmentWebSession: vi.fn(() =>
    Promise.resolve({
      authenticated: true as const,
      claims: {
        sub: 'dev-user',
        workspaceId: 'dev-ws',
        roles: ['admin'],
        personas: [],
        capabilities: [],
        apiScopes: [],
      },
    }),
  ),
  logoutWebSession: vi.fn(() => Promise.resolve()),
}));

const dataRetentionMock = vi.hoisted(() => {
  const livePolicy = {
    runtimeMode: 'live' as const,
    usesLiveTenantData: true,
    allowOfflineTenantData: false,
    persistTenantQueryCache: false,
    serviceWorkerTenantApiCache: false,
  };

  const demoPolicy = {
    runtimeMode: 'demo' as const,
    usesLiveTenantData: false,
    allowOfflineTenantData: true,
    persistTenantQueryCache: true,
    serviceWorkerTenantApiCache: true,
  };

  return {
    livePolicy,
    demoPolicy,
    getCockpitDataRetentionPolicy: vi.fn<() => typeof livePolicy | typeof demoPolicy>(
      () => livePolicy,
    ),
  };
});

vi.mock('@/lib/native-bridge', () => ({
  secureGet: nativeBridgeMock.secureGet,
  secureSet: nativeBridgeMock.secureSet,
  secureRemove: nativeBridgeMock.secureRemove,
  openInAppBrowser: nativeBridgeMock.openInAppBrowser,
  closeInAppBrowser: nativeBridgeMock.closeInAppBrowser,
  onDeepLink: nativeBridgeMock.onDeepLink,
  isNative: nativeBridgeMock.isNative,
}));

vi.mock('@/lib/oidc-client', () => ({
  loadOidcConfig: oidcMock.loadOidcConfig,
  isOidcConfigured: oidcMock.isOidcConfigured,
  prepareLoginSession: oidcMock.prepareLoginSession,
  exchangeCode: oidcMock.exchangeCode,
  parseCallbackUrl: oidcMock.parseCallbackUrl,
  decodeJwtPayload: oidcMock.decodeJwtPayload,
  OidcError: oidcMock.OidcError,
}));

vi.mock('@/lib/web-session-auth', () => ({
  fetchCurrentWebSession: webSessionMock.fetchCurrentWebSession,
  establishWebSession: webSessionMock.establishWebSession,
  createDevelopmentWebSession: webSessionMock.createDevelopmentWebSession,
  logoutWebSession: webSessionMock.logoutWebSession,
}));

vi.mock('@/lib/cockpit-data-retention', () => ({
  getCockpitDataRetentionPolicy: dataRetentionMock.getCockpitDataRetentionPolicy,
}));

const TOKEN_KEY = 'portarium_cockpit_bearer_token';
const REFRESH_TOKEN_KEY = 'portarium_cockpit_refresh_token';

function seedCache() {
  localStorage.setItem(QUERY_CACHE_STORAGE_KEY, '{"cached":true}');
  localStorage.setItem(
    'portarium:cockpit:offline:approvals:ws-1',
    JSON.stringify({ items: [{ approvalId: 'ap-1' }] }),
  );
  localStorage.setItem(
    'portarium:cockpit:approval-outbox:v1:ws-1',
    JSON.stringify([{ approvalId: 'ap-1' }]),
  );
  sessionStorage.setItem('portarium_pkce_state', '{"codeVerifier":"secret"}');
  queryClient.setQueryData(['runs', 'ws-1'], { items: [{ runId: 'run-1' }] });
}

function expectCacheCleared() {
  expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  expect(localStorage.getItem('portarium:cockpit:offline:approvals:ws-1')).toBeNull();
  expect(localStorage.getItem('portarium:cockpit:approval-outbox:v1:ws-1')).toBeNull();
  expect(sessionStorage.getItem('portarium_pkce_state')).toBeNull();
  expect(queryClient.getQueryData(['runs', 'ws-1'])).toBeUndefined();
}

beforeEach(() => {
  vi.clearAllMocks();
  nativeBridgeMock.secureStore.clear();
  nativeBridgeMock.native = true;
  oidcMock.configured = true;
  oidcMock.jwtPayloads.clear();
  webSessionMock.currentSession = null;
  dataRetentionMock.getCockpitDataRetentionPolicy.mockReturnValue(dataRetentionMock.livePolicy);
  localStorage.clear();
  sessionStorage.clear();
  queryClient.clear();
  useAuthStore.setState({
    status: 'initializing',
    token: null,
    claims: null,
    error: null,
  });
});

describe('useAuthStore cache isolation', () => {
  it('clears cached tenant data when stored token claims are invalid', async () => {
    nativeBridgeMock.secureStore.set(TOKEN_KEY, 'invalid-token');
    seedCache();

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(nativeBridgeMock.secureRemove).toHaveBeenCalledWith(TOKEN_KEY);
    expectCacheCleared();
  });

  it('clears cached tenant data when login starts', async () => {
    seedCache();

    await useAuthStore.getState().login();

    expect(useAuthStore.getState().status).toBe('authenticating');
    expect(nativeBridgeMock.openInAppBrowser).toHaveBeenCalledWith('https://idp.test/auth');
    expectCacheCleared();
  });

  it('clears cached tenant data when callback succeeds', async () => {
    oidcMock.jwtPayloads.set('fresh-token', {
      sub: 'user-1',
      workspaceId: 'ws-1',
      roles: ['operator'],
    });
    seedCache();

    await useAuthStore.getState().handleCallback('portarium://auth/callback?code=code-1');

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().token).toBe('fresh-token');
    expect(nativeBridgeMock.secureSet).toHaveBeenCalledWith(TOKEN_KEY, 'fresh-token');
    expect(nativeBridgeMock.secureSet).toHaveBeenCalledWith(
      REFRESH_TOKEN_KEY,
      'fresh-refresh-token',
    );
    expectCacheCleared();
  });

  it('initializes web auth from the HttpOnly web session endpoint', async () => {
    nativeBridgeMock.native = false;
    webSessionMock.currentSession = {
      authenticated: true,
      claims: {
        sub: 'web-user',
        workspaceId: 'web-ws',
        roles: ['operator'],
        personas: [],
        capabilities: [],
        apiScopes: [],
      },
    };

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      token: null,
      claims: { sub: 'web-user', workspaceId: 'web-ws' },
    });
    expect(nativeBridgeMock.secureGet).not.toHaveBeenCalled();
  });

  it('clears legacy browser tokens when no web session exists', async () => {
    nativeBridgeMock.native = false;
    localStorage.setItem(TOKEN_KEY, 'legacy-local-token');
    sessionStorage.setItem(TOKEN_KEY, 'legacy-session-token');
    sessionStorage.setItem(AUTH_REFRESH_TOKEN_KEY, 'legacy-refresh-token');
    seedCache();

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState()).toMatchObject({
      status: 'unauthenticated',
      token: null,
      claims: null,
    });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_REFRESH_TOKEN_KEY)).toBeNull();
    expect(nativeBridgeMock.secureGet).not.toHaveBeenCalled();
    expectCacheCleared();
  });

  it('keeps demo fixture tenant data when no web session exists', async () => {
    nativeBridgeMock.native = false;
    dataRetentionMock.getCockpitDataRetentionPolicy.mockReturnValue(dataRetentionMock.demoPolicy);
    localStorage.setItem(TOKEN_KEY, 'legacy-local-token');
    seedCache();

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState()).toMatchObject({
      status: 'unauthenticated',
      token: null,
      claims: null,
    });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem('portarium:cockpit:offline:approvals:ws-1')).not.toBeNull();
    expect(localStorage.getItem('portarium:cockpit:approval-outbox:v1:ws-1')).not.toBeNull();
    expect(queryClient.getQueryData(['runs', 'ws-1'])).toEqual({
      items: [{ runId: 'run-1' }],
    });
  });

  it('establishes web auth via the session endpoint without storing tokens', async () => {
    nativeBridgeMock.native = false;
    seedCache();

    await useAuthStore.getState().handleCallback('https://app.test/auth/callback?code=code-1');

    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      token: null,
      claims: { sub: 'web-user', workspaceId: 'web-ws' },
    });
    expect(webSessionMock.establishWebSession).toHaveBeenCalledWith({
      code: 'code-1',
      state: 'state-1',
    });
    expect(oidcMock.exchangeCode).not.toHaveBeenCalled();
    expect(nativeBridgeMock.secureSet).not.toHaveBeenCalled();
    expectCacheCleared();
  });

  it('clears cached tenant data on logout', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      token: 'token-1',
      claims: {
        sub: 'user-1',
        workspaceId: 'ws-1',
        roles: ['operator'],
        personas: [],
        capabilities: [],
        apiScopes: [],
      },
      error: null,
    });
    seedCache();

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(nativeBridgeMock.secureRemove).toHaveBeenCalledWith(TOKEN_KEY);
    expect(nativeBridgeMock.secureRemove).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
    expectCacheCleared();
  });

  it('clears the native in-memory bearer when native storage no longer has a valid token', async () => {
    oidcMock.jwtPayloads.set('fresh-token', {
      sub: 'user-1',
      workspaceId: 'ws-1',
      roles: ['operator'],
    });

    await useAuthStore.getState().handleCallback('portarium://auth/callback?code=code-1');
    expect(readStoredBearerToken()).toBe('fresh-token');

    nativeBridgeMock.secureStore.clear();
    await useAuthStore.getState().initialize();

    expect(readStoredBearerToken()).toBeUndefined();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('logs out web sessions via the session endpoint', async () => {
    nativeBridgeMock.native = false;
    useAuthStore.setState({
      status: 'authenticated',
      token: null,
      claims: {
        sub: 'web-user',
        workspaceId: 'web-ws',
        roles: ['operator'],
        personas: [],
        capabilities: [],
        apiScopes: [],
      },
      error: null,
    });
    seedCache();

    await useAuthStore.getState().logout();

    expect(webSessionMock.logoutWebSession).toHaveBeenCalled();
    expect(nativeBridgeMock.secureRemove).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expectCacheCleared();
  });

  it('purges local tenant data even when web logout endpoint fails', async () => {
    nativeBridgeMock.native = false;
    webSessionMock.logoutWebSession.mockRejectedValueOnce(new Error('network down'));
    useAuthStore.setState({
      status: 'authenticated',
      token: null,
      claims: {
        sub: 'web-user',
        workspaceId: 'web-ws',
        roles: ['operator'],
        personas: [],
        capabilities: [],
        apiScopes: [],
      },
      error: null,
    });
    seedCache();

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expectCacheCleared();
  });
});
