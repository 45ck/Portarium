import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_REFRESH_TOKEN_KEY,
  AUTH_TOKEN_KEY,
  readBearerToken,
  readStoredBearerToken,
  shouldBlockUnauthenticatedApiAccess,
} from '@/lib/auth-token';
import { clearLegacyBrowserBearerTokens } from '@/lib/auth-token-provider';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

describe('auth token helpers', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not use browser storage tokens for web control-plane auth', () => {
    const session = createMemoryStorage();
    const local = createMemoryStorage();
    session.setItem(AUTH_TOKEN_KEY, 'session-token');
    local.setItem(AUTH_TOKEN_KEY, 'local-token');
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('window', { sessionStorage: session, localStorage: local });

    expect(readStoredBearerToken()).toBeUndefined();
    expect(readBearerToken()).toBeUndefined();
  });

  it('clears legacy browser bearer tokens from local and session storage', () => {
    const session = createMemoryStorage();
    const local = createMemoryStorage();
    session.setItem(AUTH_TOKEN_KEY, 'session-token');
    session.setItem(AUTH_REFRESH_TOKEN_KEY, 'refresh-token');
    local.setItem('portarium_bearer_token', 'legacy-token');
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('window', { sessionStorage: session, localStorage: local });

    clearLegacyBrowserBearerTokens();

    expect(session.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(session.getItem(AUTH_REFRESH_TOKEN_KEY)).toBeNull();
    expect(local.getItem('portarium_bearer_token')).toBeNull();
  });

  it('does not locally block browser OIDC requests because cookie auth is server mediated', () => {
    const session = createMemoryStorage();
    const local = createMemoryStorage();
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('window', { sessionStorage: session, localStorage: local });

    expect(shouldBlockUnauthenticatedApiAccess()).toBe(false);
  });
});
