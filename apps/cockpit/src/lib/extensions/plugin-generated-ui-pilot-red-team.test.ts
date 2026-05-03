import { describe, expect, it, vi } from 'vitest';

import {
  createCockpitExtensionFetch,
  resolveCockpitExtensionBrowserEgressDecision,
} from './browser-egress-policy';
import {
  INSTALLED_COCKPIT_EXTENSION_MODULES,
  resolveInstalledCockpitExtensionRegistry,
} from './installed';
import {
  canAccessExtensionRoute,
  selectExtensionCommands,
  selectExtensionNavItems,
  selectExtensionRoutes,
} from './registry';

const accessContext = {
  availableCapabilities: ['extension:read', 'extension:inspect'],
  availableApiScopes: ['extensions.read', 'extensions.inspect'],
  availablePrivacyClasses: ['internal', 'restricted'],
} as const;

const egressContext = {
  extensionId: 'example.reference',
  routeId: 'example-reference-overview',
  workspaceId: 'ws-pilot-red-team',
  principalId: 'user-operator',
  correlationId: 'corr-pilot-red-team',
} as const;

const egressPolicy = {
  policyId: 'cockpit-extension-browser-egress',
  policyVersion: '1',
  allowedOrigins: ['https://cockpit.pilot.test'],
  allowedPathPrefixes: ['/auth/', '/v1/'],
} as const;

describe('pilot red-team: Cockpit extension host path', () => {
  it('enables only a pinned governed extension with host guards and declared grants', () => {
    const [installed] = INSTALLED_COCKPIT_EXTENSION_MODULES;
    if (!installed) throw new Error('Expected an installed extension fixture.');

    expect(installed.packageRef).toMatchObject({
      packageName: installed.manifest.governance.versionPin.packageName,
      version: installed.manifest.governance.versionPin.version,
    });
    expect(installed.workspacePackRefs.map((ref) => ref.packId).sort()).toEqual(
      [...installed.manifest.packIds].sort(),
    );
    expect(installed.manifest.governance.permissions).not.toHaveLength(0);

    const registry = resolveInstalledCockpitExtensionRegistry({
      activePackIds: ['example.reference'],
      ...accessContext,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('enabled');
    expect(selectExtensionRoutes(registry, { persona: 'Operator', ...accessContext })).toHaveLength(
      2,
    );
    expect(selectExtensionNavItems(registry, 'sidebar', 'Operator', accessContext)).toHaveLength(1);
    expect(selectExtensionCommands(registry, 'Operator', accessContext)).toHaveLength(1);
  });

  it('fails route and command guards closed when authority context is missing or weaker', () => {
    const registry = resolveInstalledCockpitExtensionRegistry({
      activePackIds: ['example.reference'],
      ...accessContext,
    });
    const detailRoute = registry.routes.find((route) => route.id === 'example-reference-detail');
    if (!detailRoute) throw new Error('Expected the detail route to be enabled.');

    expect(canAccessExtensionRoute(detailRoute, { persona: 'Operator' })).toEqual({
      allowed: false,
      denials: [
        { code: 'missing-capability', missing: ['extension:inspect'] },
        { code: 'missing-api-scope', missing: ['extensions.inspect'] },
        { code: 'missing-privacy-class', missing: ['internal', 'restricted'] },
      ],
    });
    expect(
      selectExtensionCommands(registry, 'Operator', {
        availableCapabilities: ['extension:read'],
        availableApiScopes: ['extensions.read'],
        availablePrivacyClasses: ['internal'],
      }),
    ).toHaveLength(1);
    expect(
      selectExtensionRoutes(registry, {
        persona: 'Operator',
        availableCapabilities: ['extension:read'],
        availableApiScopes: ['extensions.read'],
        availablePrivacyClasses: ['internal'],
      }).map((route) => route.id),
    ).toEqual(['example-reference-overview']);
  });

  it('suppresses every executable surface when the activation source emergency-disables it', () => {
    const registry = resolveInstalledCockpitExtensionRegistry({
      activePackIds: ['example.reference'],
      emergencyDisabledExtensionIds: ['example.reference'],
      ...accessContext,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('emergency-disabled');
    expect(registry.extensions[0]?.disableReasons).toEqual([
      expect.objectContaining({ code: 'emergency-disabled' }),
    ]);
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('denies external Browser Egress before dispatch and keeps audit context linkable', async () => {
    const decision = resolveCockpitExtensionBrowserEgressDecision({
      url: 'https://provider.example.test/v1/records?token=secret',
      method: 'POST',
      context: egressContext,
      policy: egressPolicy,
      baseOrigin: 'https://cockpit.pilot.test',
      nowIso: '2026-05-03T11:00:00.000Z',
    });

    expect(decision).toEqual({
      allowed: false,
      audit: {
        decision: 'deny',
        reason: 'forbidden-origin',
        surface: 'extension-browser-egress',
        policyId: 'cockpit-extension-browser-egress',
        policyVersion: '1',
        extensionId: 'example.reference',
        routeId: 'example-reference-overview',
        workspaceId: 'ws-pilot-red-team',
        principalId: 'user-operator',
        correlationId: 'corr-pilot-red-team',
        requestKind: 'fetch',
        method: 'POST',
        attemptedOrigin: 'https://provider.example.test',
        attemptedPath: '/v1/records',
        attemptedUrl: 'https://provider.example.test/v1/records',
        allowedOrigins: ['https://cockpit.pilot.test'],
        allowedPathPrefixes: ['/auth/', '/v1/'],
        timestampIso: '2026-05-03T11:00:00.000Z',
      },
    });

    const fetchImpl = vi.fn(async () => new Response('{}'));
    const extensionFetch = createCockpitExtensionFetch(egressContext, {
      policy: egressPolicy,
      baseOrigin: 'https://cockpit.pilot.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      extensionFetch('https://provider.example.test/v1/records?token=secret'),
    ).rejects.toMatchObject({
      name: 'CockpitExtensionBrowserEgressError',
      audit: {
        decision: 'deny',
        reason: 'forbidden-origin',
        extensionId: 'example.reference',
        routeId: 'example-reference-overview',
        workspaceId: 'ws-pilot-red-team',
        principalId: 'user-operator',
        correlationId: 'corr-pilot-red-team',
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
