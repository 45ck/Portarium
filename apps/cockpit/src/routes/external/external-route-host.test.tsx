// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

const externalRouteHostTestState = vi.hoisted(() => ({
  omitHostedComponents: false,
  overviewRouteLoader: vi.fn(),
  detailRouteLoader: vi.fn(),
}));

vi.mock('@/lib/extensions/example-reference/route-loaders', () => ({
  EXAMPLE_REFERENCE_ROUTE_LOADERS: {
    'example-reference-overview': externalRouteHostTestState.overviewRouteLoader,
    'example-reference-detail': externalRouteHostTestState.detailRouteLoader,
  },
}));

vi.mock('@/components/cockpit/extensions/external-route-adapter', async (importActual) => {
  const actual =
    await importActual<typeof import('@/components/cockpit/extensions/external-route-adapter')>();

  return {
    ...actual,
    resolveExternalRoute: (input: Parameters<typeof actual.resolveExternalRoute>[0]) =>
      actual.resolveExternalRoute({
        ...input,
        components: externalRouteHostTestState.omitHostedComponents ? {} : input.components,
      }),
  };
});

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

async function renderRoute(path: string) {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  render(<RouterProvider router={router} />);
  await router.load();
}

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  }));
  vi.stubGlobal('localStorage', createMemoryStorage());
  if (typeof ResizeObserver === 'undefined') {
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  }
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    if (url.pathname === '/v1/workspaces') {
      return Promise.resolve(
        new Response(JSON.stringify({ items: [{ workspaceId: 'ws-demo', name: 'Demo' }] }), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(url.pathname)) {
      return Promise.resolve(
        new Response(JSON.stringify({ items: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    if (/^\/v1\/workspaces\/[^/]+\/cockpit\/extension-context$/.test(url.pathname)) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            workspaceId: 'ws-demo',
            principalId: 'user-1',
            persona: 'Operator',
            availablePersonas: ['Operator', 'Admin'],
            availableCapabilities: ['extension:read', 'extension:inspect'],
            availableApiScopes: ['extensions.read', 'extensions.inspect'],
            availablePrivacyClasses: ['internal', 'restricted'],
            activePackIds: ['example.reference'],
            quarantinedExtensionIds: [],
            issuedAtIso: '2026-04-30T02:00:00.000Z',
            expiresAtIso: '2999-04-30T02:05:00.000Z',
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ error: 'not-found' }), { status: 404 }));
  });
});

beforeEach(() => {
  externalRouteHostTestState.omitHostedComponents = false;
  externalRouteHostTestState.overviewRouteLoader.mockReset();
  externalRouteHostTestState.detailRouteLoader.mockReset();
  externalRouteHostTestState.overviewRouteLoader.mockResolvedValue({
    default: () => (
      <div>
        <h1>Reference Overview</h1>
        <p>Extension Boundary</p>
        <p>Route Loader Spy: overview</p>
      </div>
    ),
  });
  externalRouteHostTestState.detailRouteLoader.mockResolvedValue({
    default: () => (
      <div>
        <h1>Reference Detail</h1>
        <p>Detail Contract</p>
        <p>Route Loader Spy: detail</p>
      </div>
    ),
  });
  queryClient.clear();
  localStorage.clear();
  document.documentElement.className = '';
  useUIStore.setState({ activePersona: 'Operator', activeWorkspaceId: 'ws-demo' });
  useAuthStore.setState({
    status: 'authenticated',
    token: 'token-1',
    claims: {
      sub: 'user-1',
      workspaceId: 'ws-demo',
      roles: ['operator'],
      personas: ['Operator'],
      capabilities: ['extension:read', 'extension:inspect'],
      apiScopes: ['extensions.read', 'extensions.inspect'],
    },
    error: null,
  });
  queryClient.setQueryData(['cockpit-extension-context', 'ws-demo', 'user-1'], {
    schemaVersion: 1,
    workspaceId: 'ws-demo',
    principalId: 'user-1',
    persona: 'Operator',
    availablePersonas: ['Operator', 'Admin'],
    availableCapabilities: ['extension:read', 'extension:inspect'],
    availableApiScopes: ['extensions.read', 'extensions.inspect'],
    availablePrivacyClasses: ['internal', 'restricted'],
    activePackIds: ['example.reference'],
    quarantinedExtensionIds: [],
    issuedAtIso: '2026-04-30T02:00:00.000Z',
    expiresAtIso: '2999-04-30T02:05:00.000Z',
  });
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('external route host', () => {
  it('loads the neutral overview route through the compiled external host', async () => {
    await renderRoute('/external/example-reference/overview');

    expect(await screen.findByRole('heading', { name: 'Reference Overview' })).toBeTruthy();
    expect(await screen.findByText('Extension Boundary')).toBeTruthy();
    expect(await screen.findByText('Route Loader Spy: overview')).toBeTruthy();
    expect(screen.queryByText('Host Fallback')).toBeNull();
    expect(externalRouteHostTestState.overviewRouteLoader).toHaveBeenCalledTimes(1);
    expect(externalRouteHostTestState.detailRouteLoader).not.toHaveBeenCalled();
  });

  it('loads parameterized neutral routes declared by the extension manifest', async () => {
    await renderRoute('/external/example-reference/details/item-123');

    expect(await screen.findByRole('heading', { name: 'Reference Detail' })).toBeTruthy();
    expect(await screen.findByText('Detail Contract')).toBeTruthy();
    expect(screen.queryByText('External Route Not Found')).toBeNull();
    expect(externalRouteHostTestState.detailRouteLoader).toHaveBeenCalledTimes(1);
  });

  it('fails closed when no installed extension declares the external path', async () => {
    await renderRoute('/external/example-reference/unknown');

    expect(await screen.findByRole('heading', { name: 'External Route Not Found' })).toBeTruthy();
    expect(screen.getByText('No enabled extension route matches this external path.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View extension registry' })).toBeTruthy();
  });

  it('does not render extension content for undeclared external subpaths matched by the catch-all route', async () => {
    await renderRoute('/external/example-reference/overview/extra');

    expect(await screen.findByRole('heading', { name: 'External Route Not Found' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Reference Overview' })).toBeNull();
    expect(screen.queryByText('Extension Boundary')).toBeNull();
  });

  it('fails closed when the workspace has no active extension packs', async () => {
    queryClient.setQueryData(['cockpit-extension-context', 'ws-demo', 'user-1'], {
      schemaVersion: 1,
      workspaceId: 'ws-demo',
      principalId: 'user-1',
      persona: 'Operator',
      availablePersonas: ['Operator', 'Admin'],
      availableCapabilities: ['extension:read', 'extension:inspect'],
      availableApiScopes: ['extensions.read', 'extensions.inspect'],
      availablePrivacyClasses: ['internal', 'restricted'],
      activePackIds: [],
      quarantinedExtensionIds: [],
      issuedAtIso: '2026-04-30T02:00:00.000Z',
      expiresAtIso: '2999-04-30T02:05:00.000Z',
    });

    await renderRoute('/external/example-reference/overview');

    expect(await screen.findByRole('heading', { name: 'External Route Not Found' })).toBeTruthy();
    expect(screen.getByText('No enabled extension route matches this external path.')).toBeTruthy();
    expect(screen.queryByText('Reference Overview')).toBeNull();
    expect(screen.queryByText('Extension Boundary')).toBeNull();
    expect(externalRouteHostTestState.overviewRouteLoader).not.toHaveBeenCalled();
    expect(externalRouteHostTestState.detailRouteLoader).not.toHaveBeenCalled();
  });

  it('fails closed when the active persona is forbidden from the external route', async () => {
    useUIStore.setState({ activePersona: 'Guest' as never });

    await renderRoute('/external/example-reference/overview');

    expect(await screen.findByRole('heading', { name: 'Extension Route Restricted' })).toBeTruthy();
    expect(
      screen.getByText('This route is not available for the current server-issued guard context.'),
    ).toBeTruthy();
    expect(screen.getByText('Host Fallback')).toBeTruthy();
    expect(screen.getByText('restricted')).toBeTruthy();
    expect(screen.getByText('route-forbidden')).toBeTruthy();
    expect(screen.getByText('persona')).toBeTruthy();
    expect(screen.queryByText('Extension Boundary')).toBeNull();
    expect(externalRouteHostTestState.overviewRouteLoader).not.toHaveBeenCalled();
    expect(externalRouteHostTestState.detailRouteLoader).not.toHaveBeenCalled();
  });

  it('fails closed without importing route content when route privacy grants are missing', async () => {
    queryClient.setQueryData(['cockpit-extension-context', 'ws-demo', 'user-1'], {
      schemaVersion: 1,
      workspaceId: 'ws-demo',
      principalId: 'user-1',
      persona: 'Operator',
      availablePersonas: ['Operator', 'Admin'],
      availableCapabilities: ['extension:read', 'extension:inspect'],
      availableApiScopes: ['extensions.read', 'extensions.inspect'],
      availablePrivacyClasses: [],
      activePackIds: ['example.reference'],
      quarantinedExtensionIds: [],
      issuedAtIso: '2026-04-30T02:00:00.000Z',
      expiresAtIso: '2999-04-30T02:05:00.000Z',
    });

    await renderRoute('/external/example-reference/overview');

    expect(await screen.findByRole('heading', { name: 'Extension Route Restricted' })).toBeTruthy();
    expect(screen.getByText('route-forbidden')).toBeTruthy();
    expect(screen.getByText('missing-privacy-class')).toBeTruthy();
    expect(screen.queryByText('Extension Boundary')).toBeNull();
    expect(screen.queryByText('Reference Overview')).toBeNull();
    expect(externalRouteHostTestState.overviewRouteLoader).not.toHaveBeenCalled();
    expect(externalRouteHostTestState.detailRouteLoader).not.toHaveBeenCalled();
  });

  it('fails closed without route metadata when an active external route has no host-owned renderer', async () => {
    externalRouteHostTestState.omitHostedComponents = true;

    await renderRoute('/external/example-reference/details/item-123');

    expect(await screen.findByRole('heading', { name: 'External Route Not Found' })).toBeTruthy();
    expect(screen.getByText('No enabled extension route matches this external path.')).toBeTruthy();
    expect(screen.getByText('Host Fallback')).toBeTruthy();
    expect(screen.getByText('/external/example-reference/details/item-123')).toBeTruthy();
    expect(screen.queryByText('Reference Detail')).toBeNull();
    expect(screen.queryByText('Reference Extension')).toBeNull();
    expect(screen.queryByText('example-reference-detail')).toBeNull();
    expect(screen.queryByText('itemId=item-123')).toBeNull();
    expect(screen.queryByText('Detail Contract')).toBeNull();
    expect(externalRouteHostTestState.overviewRouteLoader).not.toHaveBeenCalled();
    expect(externalRouteHostTestState.detailRouteLoader).not.toHaveBeenCalled();
  });
});
