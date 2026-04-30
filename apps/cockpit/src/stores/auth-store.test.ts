import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const TOKEN_KEY = 'portarium_cockpit_bearer_token';
const REFRESH_TOKEN_KEY = 'portarium_cockpit_refresh_token';

function seedCache() {
  localStorage.setItem(QUERY_CACHE_STORAGE_KEY, '{"cached":true}');
  queryClient.setQueryData(['runs', 'ws-1'], { items: [{ runId: 'run-1' }] });
}

function expectCacheCleared() {
  expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  expect(queryClient.getQueryData(['runs', 'ws-1'])).toBeUndefined();
}

beforeEach(() => {
  vi.clearAllMocks();
  nativeBridgeMock.secureStore.clear();
  nativeBridgeMock.native = true;
  oidcMock.configured = true;
  oidcMock.jwtPayloads.clear();
  localStorage.clear();
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
});
