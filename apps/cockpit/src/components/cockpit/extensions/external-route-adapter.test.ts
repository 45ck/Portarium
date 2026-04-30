import { describe, expect, it } from 'vitest';
import { resolveCockpitExtensionRegistry } from '@/lib/extensions/registry';
import type { CockpitExtensionManifest } from '@/lib/extensions/types';
import { resolveExternalRoute } from './external-route-adapter';

const TEST_EXTENSION: CockpitExtensionManifest = {
  manifestVersion: 1,
  id: 'test.extension',
  owner: 'portarium',
  version: '0.0.1',
  displayName: 'Test Extension',
  description: 'Test extension manifest',
  packIds: ['test.extension'],
  personas: ['Operator', 'Admin'],
  requiredCapabilities: ['objects:read'],
  requiredApiScopes: ['extensions.read'],
  routes: [
    {
      id: 'test-overview',
      path: '/external/test/overview',
      title: 'Test Overview',
      guard: {
        personas: ['Operator', 'Admin'],
        requiredCapabilities: ['objects:read'],
        requiredApiScopes: ['extensions.read'],
      },
    },
    {
      id: 'test-detail',
      path: '/external/test/items/$itemId',
      title: 'Test Detail',
      guard: {
        personas: ['Admin'],
        requiredCapabilities: ['objects:read'],
        requiredApiScopes: ['extensions.read'],
      },
    },
  ],
  navItems: [],
  commands: [],
};

const TEST_ROUTE_LOADERS = {
  'test-overview': () => Promise.resolve({ default: () => null }),
  'test-detail': () => Promise.resolve({ default: () => null }),
};

const TEST_ACCESS_CONTEXT = {
  availableCapabilities: ['objects:read'],
  availableApiScopes: ['extensions.read'],
} as const;

describe('resolveExternalRoute', () => {
  it('fails closed when no workspace-scoped registry is provided', () => {
    const resolution = resolveExternalRoute({
      pathname: '/external/example-reference/overview',
      persona: 'Operator',
      availableCapabilities: ['extension:read'],
      availableApiScopes: ['extensions.read'],
    });

    expect(resolution).toEqual({
      kind: 'not-found',
      pathname: '/external/example-reference/overview',
    });
  });

  it('resolves an enabled route and extracts path params', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const resolution = resolveExternalRoute({
      pathname: '/external/test/items/item-123',
      persona: 'Admin',
      ...TEST_ACCESS_CONTEXT,
      registry,
    });

    expect(resolution.kind).toBe('active');
    if (resolution.kind !== 'active') throw new Error('Expected active route');
    expect(resolution.route.id).toBe('test-detail');
    expect(resolution.params).toEqual({ itemId: 'item-123' });
    expect(resolution.component).toBeNull();
  });

  it('returns forbidden when the persona is outside the route guard', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const resolution = resolveExternalRoute({
      pathname: '/external/test/items/item-123',
      persona: 'Operator',
      ...TEST_ACCESS_CONTEXT,
      registry,
    });

    expect(resolution.kind).toBe('forbidden');
  });

  it('returns forbidden when the caller lacks route capabilities or API scopes', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const resolution = resolveExternalRoute({
      pathname: '/external/test/overview',
      persona: 'Operator',
      availableCapabilities: [],
      availableApiScopes: [],
      registry,
    });

    expect(resolution.kind).toBe('forbidden');
  });

  it('fails closed when the matching extension is installed but disabled', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: [],
    });

    const resolution = resolveExternalRoute({
      pathname: '/external/test/overview',
      persona: 'Operator',
      registry,
    });

    expect(resolution).toEqual({
      kind: 'not-found',
      pathname: '/external/test/overview',
    });
  });

  it('returns not-found when no installed extension declares the path', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const resolution = resolveExternalRoute({
      pathname: '/external/unknown',
      persona: 'Admin',
      registry,
    });

    expect(resolution).toEqual({
      kind: 'not-found',
      pathname: '/external/unknown',
    });
  });

  it('normalizes external paths before matching', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const resolution = resolveExternalRoute({
      pathname: '/external/test/items/item-123/?tab=activity#latest',
      persona: 'Admin',
      ...TEST_ACCESS_CONTEXT,
      registry,
    });

    expect(resolution.kind).toBe('active');
    if (resolution.kind !== 'active') throw new Error('Expected active route');
    expect(resolution.params).toEqual({ itemId: 'item-123' });
  });

  it('decodes matched external path params without failing invalid escape sequences', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const decoded = resolveExternalRoute({
      pathname: '/external/test/items/item%20123',
      persona: 'Admin',
      ...TEST_ACCESS_CONTEXT,
      registry,
    });
    const invalidEscape = resolveExternalRoute({
      pathname: '/external/test/items/item%ZZ',
      persona: 'Admin',
      ...TEST_ACCESS_CONTEXT,
      registry,
    });

    expect(decoded.kind).toBe('active');
    if (decoded.kind !== 'active') throw new Error('Expected active decoded route');
    expect(decoded.params).toEqual({ itemId: 'item 123' });
    expect(invalidEscape.kind).toBe('active');
    if (invalidEscape.kind !== 'active') throw new Error('Expected active fallback route');
    expect(invalidEscape.params).toEqual({ itemId: 'item%ZZ' });
  });
});
