// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { installLiveFetchShim, resetLiveFetchShimForTest } from '@/lib/live-fetch-shim';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetLiveFetchShimForTest();
});

describe('installLiveFetchShim', () => {
  it('forwards Cockpit auth and live API requests to the configured live API origin', async () => {
    vi.stubEnv('VITE_PORTARIUM_API_BASE_URL', 'http://127.0.0.1:18080');
    const nativeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', nativeFetch);

    installLiveFetchShim();

    await window.fetch('/auth/dev-session', {
      method: 'POST',
    });
    expect(nativeFetch.mock.calls[0]?.[0]).toBe('http://localhost:18080/auth/dev-session');
    expect(nativeFetch.mock.calls[0]?.[1]?.credentials).toBe('include');
    expect(new Headers(nativeFetch.mock.calls[0]?.[1]?.headers).get('X-Portarium-Request')).toBe(
      '1',
    );

    await window.fetch('/v1/workspaces/ws-experiment/agents');
    expect(nativeFetch.mock.calls[1]?.[0]).toBe(
      'http://localhost:18080/v1/workspaces/ws-experiment/agents',
    );
    expect(nativeFetch.mock.calls[1]?.[1]?.credentials).toBe('include');
  });
});
