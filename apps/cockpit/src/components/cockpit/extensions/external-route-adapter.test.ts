import { describe, expect, it, vi } from 'vitest';
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
    {
      id: 'test-restricted',
      path: '/external/test/restricted',
      title: 'Test Restricted',
      guard: {
        personas: ['Operator'],
        requiredCapabilities: ['objects:read'],
        requiredApiScopes: ['extensions.read'],
        privacyClasses: ['restricted'],
      },
    },
  ],
  navItems: [],
  commands: [],
};

const TEST_ROUTE_LOADERS = {
  'test-overview': () => Promise.resolve({ default: () => null }),
  'test-detail': () => Promise.resolve({ default: () => null }),
  'test-restricted': () => Promise.resolve({ default: () => null }),
};

const TEST_COMPONENTS = {
  'test-overview': () => null,
  'test-detail': () => null,
  'test-restricted': () => null,
};

const TEST_ACCESS_CONTEXT = {
  availableCapabilities: ['objects:read'],
  availableApiScopes: ['extensions.read'],
  availablePrivacyClasses: [],
} as const;

describe('resolveExternalRoute', () => {
  it('fails closed when no workspace-scoped registry is provided', () => {
    const resolution = resolveExternalRoute({
      pathname: '/external/example-reference/overview',
      persona: 'Operator',
      availableCapabilities: ['extension:read'],
      availableApiScopes: ['extensions.read'],
    });

    expect(resolution).toMatchObject({
      kind: 'not-found',
      pathname: '/external/example-reference/overview',
      audit: { decision: 'deny', reason: 'extension-disabled', surface: 'external-route' },
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
      components: TEST_COMPONENTS,
    });

    expect(resolution.kind).toBe('active');
    if (resolution.kind !== 'active') throw new Error('Expected active route');
    expect(resolution.route.id).toBe('test-detail');
    expect(resolution.params).toEqual({ itemId: 'item-123' });
    expect(resolution.component).toBe(TEST_COMPONENTS['test-detail']);
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
    if (resolution.kind !== 'forbidden') throw new Error('Expected forbidden route');
    expect(resolution.denials).toEqual([{ code: 'persona' }]);
    expect(resolution.audit).toMatchObject({
      decision: 'deny',
      reason: 'route-forbidden',
      surface: 'external-route',
      pathname: '/external/test/items/item-123',
      extensionId: 'test.extension',
      routeId: 'test-detail',
      matchedPath: '/external/test/items/$itemId',
      extensionStatus: 'enabled',
      disableReasons: [],
      denials: [{ code: 'persona' }],
    });
  });

  it('returns forbidden when active persona is not server-available', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const resolution = resolveExternalRoute({
      pathname: '/external/test/overview',
      persona: 'Operator',
      availablePersonas: ['Admin'],
      ...TEST_ACCESS_CONTEXT,
      registry,
      components: TEST_COMPONENTS,
    });

    expect(resolution.kind).toBe('forbidden');
    if (resolution.kind !== 'forbidden') throw new Error('Expected forbidden route');
    expect(resolution.denials).toEqual([{ code: 'persona' }]);
    expect(resolution.audit.denials).toEqual([{ code: 'persona' }]);
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
    if (resolution.kind !== 'forbidden') throw new Error('Expected forbidden route');
    expect(resolution.denials).toEqual([
      { code: 'missing-capability', missing: ['objects:read'] },
      { code: 'missing-api-scope', missing: ['extensions.read'] },
    ]);
  });

  it('returns forbidden when route guard denies privacy class access', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const resolution = resolveExternalRoute({
      pathname: '/external/test/restricted',
      persona: 'Operator',
      ...TEST_ACCESS_CONTEXT,
      registry,
      components: TEST_COMPONENTS,
    });

    expect(resolution.kind).toBe('forbidden');
    if (resolution.kind !== 'forbidden') throw new Error('Expected forbidden route');
    expect(resolution.denials).toEqual([
      { code: 'missing-privacy-class', missing: ['restricted'] },
    ]);
    expect(resolution.audit).toMatchObject({
      decision: 'deny',
      reason: 'route-forbidden',
      matchedPath: '/external/test/restricted',
      extensionStatus: 'enabled',
      disableReasons: [],
      denials: [{ code: 'missing-privacy-class', missing: ['restricted'] }],
    });
  });

  it('fails closed with audit metadata when the host has no route renderer', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const resolution = resolveExternalRoute({
      pathname: '/external/test/overview',
      persona: 'Operator',
      ...TEST_ACCESS_CONTEXT,
      registry,
    });

    expect(resolution).toMatchObject({
      kind: 'not-found',
      pathname: '/external/test/overview',
      audit: {
        decision: 'deny',
        reason: 'missing-renderer',
        surface: 'external-route',
        pathname: '/external/test/overview',
        extensionId: 'test.extension',
        routeId: 'test-overview',
        matchedPath: '/external/test/overview',
        extensionStatus: 'enabled',
        disableReasons: [],
      },
    });
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

    expect(resolution).toMatchObject({
      kind: 'not-found',
      pathname: '/external/test/overview',
      audit: {
        decision: 'deny',
        reason: 'extension-disabled',
        surface: 'external-route',
        extensionId: 'test.extension',
        routeId: 'test-overview',
        matchedPath: '/external/test/overview',
        extensionStatus: 'disabled',
        disableReasons: [expect.objectContaining({ code: 'workspace-pack-inactive' })],
      },
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

    expect(resolution).toMatchObject({
      kind: 'not-found',
      pathname: '/external/unknown',
      audit: { decision: 'deny', reason: 'not-found', surface: 'external-route' },
    });
    expect(resolution.audit).not.toHaveProperty('extensionId');
    expect(resolution.audit).not.toHaveProperty('routeId');
    expect(resolution.audit).not.toHaveProperty('matchedPath');
    expect(resolution.audit).not.toHaveProperty('denials');
  });

  it('ignores renderer entries for routes not declared by the enabled registry', () => {
    const undeclaredRenderer = vi.fn(() => null);
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const resolution = resolveExternalRoute({
      pathname: '/external/test/undeclared',
      persona: 'Admin',
      ...TEST_ACCESS_CONTEXT,
      registry,
      components: {
        ...TEST_COMPONENTS,
        'test-undeclared': undeclaredRenderer,
      },
    });

    expect(resolution).toMatchObject({
      kind: 'not-found',
      pathname: '/external/test/undeclared',
      audit: { decision: 'deny', reason: 'not-found', surface: 'external-route' },
    });
    expect(undeclaredRenderer).not.toHaveBeenCalled();
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
      components: TEST_COMPONENTS,
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
      components: TEST_COMPONENTS,
    });
    const invalidEscape = resolveExternalRoute({
      pathname: '/external/test/items/item%ZZ',
      persona: 'Admin',
      ...TEST_ACCESS_CONTEXT,
      registry,
      components: TEST_COMPONENTS,
    });

    expect(decoded.kind).toBe('active');
    if (decoded.kind !== 'active') throw new Error('Expected active decoded route');
    expect(decoded.params).toEqual({ itemId: 'item 123' });
    expect(invalidEscape.kind).toBe('active');
    if (invalidEscape.kind !== 'active') throw new Error('Expected active fallback route');
    expect(invalidEscape.params).toEqual({ itemId: 'item%ZZ' });
  });

  it.each([
    '/external/test/items/item%2F123',
    '/external/test/items/item%5C123',
    '/external/test/items/%00',
    '/external/test/items/%0A',
    '/external/test/items/%2e%2e',
  ])('fails closed when an external route param decodes to an unsafe segment: %s', (pathname) => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [TEST_EXTENSION],
      activePackIds: ['test.extension'],
      ...TEST_ACCESS_CONTEXT,
      routeLoaders: TEST_ROUTE_LOADERS,
    });

    const resolution = resolveExternalRoute({
      pathname,
      persona: 'Admin',
      ...TEST_ACCESS_CONTEXT,
      registry,
      components: TEST_COMPONENTS,
    });

    expect(resolution).toMatchObject({
      kind: 'not-found',
      pathname,
      audit: { decision: 'deny', reason: 'not-found', surface: 'external-route' },
    });
  });
});
