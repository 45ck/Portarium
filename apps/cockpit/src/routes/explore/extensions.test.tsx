// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { EXAMPLE_REFERENCE_EXTENSION } from '@/lib/extensions/example-reference/manifest';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

const installedRegistryTestState = vi.hoisted(() => ({
  resolveRegistry: undefined as undefined | ((input: unknown) => unknown),
}));

vi.mock('@/lib/extensions/installed', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/extensions/installed')>();

  return {
    ...actual,
    resolveInstalledCockpitExtensionRegistry: (
      input: Parameters<typeof actual.resolveInstalledCockpitExtensionRegistry>[0],
    ) =>
      (installedRegistryTestState.resolveRegistry?.(input) as
        | ReturnType<typeof actual.resolveInstalledCockpitExtensionRegistry>
        | undefined) ?? actual.resolveInstalledCockpitExtensionRegistry(input),
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
            availablePersonas: ['Operator'],
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
  installedRegistryTestState.resolveRegistry = undefined;
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
    availablePersonas: ['Operator'],
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

describe('external extensions route', () => {
  it('renders enabled registry metadata and surfaces compiled extension routes in shell navigation', async () => {
    await renderRoute('/explore/extensions');

    expect(await screen.findByRole('heading', { name: 'External Extensions' })).toBeTruthy();
    expect(screen.getByText('Reference Extension')).toBeTruthy();
    expect(screen.getByText('Host Rules')).toBeTruthy();
    expect(screen.getByText('Activation Context')).toBeTruthy();
    expect(screen.getByText('activation ready')).toBeTruthy();
    expect(screen.getAllByText('example.reference').length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText('Installed extensions')).getByText('1')).toBeTruthy();
    expect(within(screen.getByLabelText('Enabled extensions')).getByText('1')).toBeTruthy();
    expect(within(screen.getByLabelText('Disabled extensions')).getByText('0')).toBeTruthy();
    expect(within(screen.getByLabelText('Quarantined extensions')).getByText('0')).toBeTruthy();
    expect(within(screen.getByLabelText('Invalid extensions')).getByText('0')).toBeTruthy();
    expect(screen.getByText('installed')).toBeTruthy();
    expect(screen.getByText('enabled')).toBeTruthy();
    expect(screen.getByText('Navigation')).toBeTruthy();
    expect(screen.getByText('/external/example-reference/overview')).toBeTruthy();
    expect(
      screen.getByText('/external/example-reference/overview (sidebar, mobile-more, command)'),
    ).toBeTruthy();
    expect(screen.getByText('/external/example-reference/details/$itemId')).toBeTruthy();
    expect(screen.getByText('Open extension reference')).toBeTruthy();
    expect(screen.getByText('G X')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Open Reference Overview' }).length).toBe(2);
    const detailLink = screen.getByRole('link', {
      name: 'Open sample Reference Detail',
    }) as HTMLAnchorElement;
    expect(detailLink.getAttribute('href')).toBe(
      '/external/example-reference/details/sample-itemId',
    );
    expect(screen.getByText('Read reference extension overview data')).toBeTruthy();
    expect(screen.getByText('Inspect reference extension details')).toBeTruthy();
    expect(screen.getAllByText(/audit: enable, disable, upgrade/).length).toBeGreaterThan(0);

    const primaryNavigation = screen.getByLabelText('Primary navigation');
    expect(
      within(primaryNavigation).getByRole('link', { name: 'Reference Overview' }),
    ).toBeTruthy();
  });

  it('keeps core Cockpit usable while installed extensions are disabled by workspace activation', async () => {
    queryClient.setQueryData(['cockpit-extension-context', 'ws-demo', 'user-1'], {
      schemaVersion: 1,
      workspaceId: 'ws-demo',
      principalId: 'user-1',
      persona: 'Operator',
      availablePersonas: ['Operator'],
      availableCapabilities: ['extension:read', 'extension:inspect'],
      availableApiScopes: ['extensions.read', 'extensions.inspect'],
      availablePrivacyClasses: ['internal', 'restricted'],
      activePackIds: [],
      quarantinedExtensionIds: [],
      issuedAtIso: '2026-04-30T02:00:00.000Z',
      expiresAtIso: '2999-04-30T02:05:00.000Z',
    });

    await renderRoute('/explore/extensions');

    expect(await screen.findByRole('heading', { name: 'External Extensions' })).toBeTruthy();
    expect(screen.getByText('Reference Extension')).toBeTruthy();
    expect(within(screen.getByLabelText('Installed extensions')).getByText('1')).toBeTruthy();
    expect(within(screen.getByLabelText('Enabled extensions')).getByText('0')).toBeTruthy();
    expect(within(screen.getByLabelText('Disabled extensions')).getByText('1')).toBeTruthy();
    expect(within(screen.getByLabelText('Quarantined extensions')).getByText('0')).toBeTruthy();
    expect(within(screen.getByLabelText('Invalid extensions')).getByText('0')).toBeTruthy();
    expect(screen.getByText('disabled')).toBeTruthy();
    expect(screen.getByText('API Scopes')).toBeTruthy();
    expect(screen.getByText('workspace-pack-inactive')).toBeTruthy();
    expect(screen.getAllByText('example.reference').length).toBeGreaterThan(0);
    expect(screen.queryByText('Reference Overview')).toBeNull();
    expect(screen.queryByText('/external/example-reference/overview')).toBeNull();
    expect(screen.queryByText('Open extension reference')).toBeNull();
    expect(screen.queryByText('G X')).toBeNull();

    const primaryNavigation = screen.getByLabelText('Primary navigation');
    expect(within(primaryNavigation).getByRole('link', { name: 'Extensions' })).toBeTruthy();
    expect(
      within(primaryNavigation).queryByRole('link', { name: 'Reference Overview' }),
    ).toBeNull();
  });

  it('shows emergency-disabled plugins as disabled and keeps their permissions auditable', async () => {
    queryClient.setQueryData(['cockpit-extension-context', 'ws-demo', 'user-1'], {
      schemaVersion: 1,
      workspaceId: 'ws-demo',
      principalId: 'user-1',
      persona: 'Operator',
      availablePersonas: ['Operator'],
      availableCapabilities: ['extension:read', 'extension:inspect'],
      availableApiScopes: ['extensions.read', 'extensions.inspect'],
      availablePrivacyClasses: ['internal', 'restricted'],
      activePackIds: ['example.reference'],
      quarantinedExtensionIds: [],
      emergencyDisabledExtensionIds: ['example.reference'],
      issuedAtIso: '2026-04-30T02:00:00.000Z',
      expiresAtIso: '2999-04-30T02:05:00.000Z',
    });

    await renderRoute('/explore/extensions');

    expect(await screen.findByRole('heading', { name: 'External Extensions' })).toBeTruthy();
    expect(within(screen.getByLabelText('Enabled extensions')).getByText('0')).toBeTruthy();
    expect(
      within(screen.getByLabelText('Emergency Disabled extensions')).getByText('1'),
    ).toBeTruthy();
    expect(screen.getAllByText('emergency-disabled').length).toBeGreaterThan(0);
    expect(screen.getByText('Read reference extension overview data')).toBeTruthy();
    expect(screen.queryByText('/external/example-reference/overview')).toBeNull();
    expect(screen.queryByText('Open extension reference')).toBeNull();
  });

  it('distinguishes quarantined extensions from disabled activation state', async () => {
    queryClient.setQueryData(['cockpit-extension-context', 'ws-demo', 'user-1'], {
      schemaVersion: 1,
      workspaceId: 'ws-demo',
      principalId: 'user-1',
      persona: 'Operator',
      availablePersonas: ['Operator'],
      availableCapabilities: ['extension:read', 'extension:inspect'],
      availableApiScopes: ['extensions.read', 'extensions.inspect'],
      availablePrivacyClasses: ['internal', 'restricted'],
      activePackIds: ['example.reference'],
      quarantinedExtensionIds: ['example.reference'],
      emergencyDisabledExtensionIds: [],
      issuedAtIso: '2026-04-30T02:00:00.000Z',
      expiresAtIso: '2999-04-30T02:05:00.000Z',
    });

    await renderRoute('/explore/extensions');

    expect(await screen.findByRole('heading', { name: 'External Extensions' })).toBeTruthy();
    expect(within(screen.getByLabelText('Enabled extensions')).getByText('0')).toBeTruthy();
    expect(within(screen.getByLabelText('Disabled extensions')).getByText('0')).toBeTruthy();
    expect(within(screen.getByLabelText('Quarantined extensions')).getByText('1')).toBeTruthy();
    expect(screen.getAllByText('quarantined').length).toBeGreaterThan(0);
    expect(screen.getByText('security-quarantine')).toBeTruthy();
    expect(screen.queryByText('workspace-pack-inactive')).toBeNull();
    expect(screen.queryByText('/external/example-reference/overview')).toBeNull();
  });

  it('distinguishes invalid effective registry state from disabled activation state', async () => {
    installedRegistryTestState.resolveRegistry = () => ({
      extensions: [
        {
          manifest: EXAMPLE_REFERENCE_EXTENSION,
          status: 'invalid',
          disableReasons: [],
          problems: [
            {
              code: 'missing-route-module',
              message: 'Reference detail route is missing its host-owned route module.',
              extensionId: 'example.reference',
              itemId: 'example-reference-detail',
            },
          ],
        },
      ],
      routes: [],
      navItems: [],
      commands: [],
      problems: [
        {
          code: 'missing-route-module',
          message: 'Reference detail route is missing its host-owned route module.',
          extensionId: 'example.reference',
          itemId: 'example-reference-detail',
        },
      ],
    });

    await renderRoute('/explore/extensions');

    expect(await screen.findByRole('heading', { name: 'External Extensions' })).toBeTruthy();
    expect(within(screen.getByLabelText('Installed extensions')).getByText('1')).toBeTruthy();
    expect(within(screen.getByLabelText('Enabled extensions')).getByText('0')).toBeTruthy();
    expect(within(screen.getByLabelText('Disabled extensions')).getByText('0')).toBeTruthy();
    expect(within(screen.getByLabelText('Invalid extensions')).getByText('1')).toBeTruthy();
    expect(screen.getAllByText('Registry Problems').length).toBeGreaterThan(0);
    expect(screen.getByText('Suppressed Surfaces')).toBeTruthy();
    expect(screen.getByText('invalid')).toBeTruthy();
    expect(screen.getAllByText('missing-route-module').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/example-reference-detail/).length).toBeGreaterThan(0);
    expect(screen.queryByText('workspace-pack-inactive')).toBeNull();
    expect(screen.queryByText('Open extension reference')).toBeNull();
  });
});
