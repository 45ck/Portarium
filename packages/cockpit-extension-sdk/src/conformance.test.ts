import { describe, expect, it } from 'vitest';
import {
  CockpitExtensionManifestConformanceError,
  assertCockpitExtensionManifestV1Conforms,
  createCockpitExtensionRegistrationV1,
  createCockpitExtensionManifestV1ConformanceReport,
  type CockpitExtensionManifestV1,
} from './index.js';

const digest = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const manifest = {
  manifestVersion: 1,
  id: 'example.extension',
  owner: 'example-publisher',
  version: '0.1.0',
  displayName: 'Example Extension',
  description: 'Adds reviewed external Cockpit routes.',
  packIds: ['example.extension'],
  personas: ['Operator'],
  requiredCapabilities: ['extension:read', 'extension:inspect'],
  requiredApiScopes: ['extensions.read', 'extensions.inspect'],
  routes: [
    {
      id: 'example-overview',
      path: '/external/example/overview',
      title: 'Overview',
      guard: {
        personas: ['Operator'],
        requiredCapabilities: ['extension:read'],
        requiredApiScopes: ['extensions.read'],
        privacyClasses: ['internal'],
      },
      permissionGrantIds: ['example.read'],
    },
    {
      id: 'example-detail',
      path: '/external/example/detail/$itemId',
      title: 'Detail',
      guard: {
        personas: ['Operator'],
        requiredCapabilities: ['extension:read', 'extension:inspect'],
        requiredApiScopes: ['extensions.read', 'extensions.inspect'],
        privacyClasses: ['internal', 'restricted'],
      },
      permissionGrantIds: ['example.inspect'],
    },
  ],
  navItems: [
    {
      id: 'example-overview-nav',
      title: 'Example',
      routeId: 'example-overview',
      to: '/external/example/overview',
      icon: 'plug',
      surfaces: ['sidebar', 'mobile-more'],
      personas: ['Operator'],
    },
  ],
  commands: [
    {
      id: 'example-open-overview',
      title: 'Open Example',
      routeId: 'example-overview',
      guard: {
        personas: ['Operator'],
        requiredCapabilities: ['extension:read'],
        requiredApiScopes: ['extensions.read'],
        privacyClasses: ['internal'],
      },
      permissionGrantIds: ['example.read'],
      shortcut: 'G E',
    },
  ],
  widgets: [
    {
      id: 'example-summary-widget',
      title: 'Example summary',
      surface: 'dashboard',
      routeId: 'example-overview',
      guard: {
        personas: ['Operator'],
        requiredCapabilities: ['extension:read'],
        requiredApiScopes: ['extensions.read'],
        privacyClasses: ['internal'],
      },
      permissionGrantIds: ['example.read'],
      dataScopeIds: ['example.summary'],
    },
  ],
  dataScopes: [
    {
      id: 'example.summary',
      title: 'Example summary',
      resource: 'example.summary',
      access: 'read',
      guard: {
        personas: ['Operator'],
        requiredCapabilities: ['extension:read'],
        requiredApiScopes: ['extensions.read'],
        privacyClasses: ['internal'],
      },
      permissionGrantIds: ['example.read'],
    },
  ],
  governance: {
    identity: {
      publisher: 'example-publisher',
      attestation: {
        kind: 'source-review',
        subject: 'reviewed-source',
        digestSha256: digest,
      },
    },
    versionPin: {
      packageName: '@example/cockpit-extension',
      version: '0.1.0',
    },
    permissions: [
      {
        id: 'example.read',
        kind: 'data-query',
        title: 'Read extension data',
        requiredCapabilities: ['extension:read'],
        requiredApiScopes: ['extensions.read'],
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['cockpit.extension.data.read'],
      },
      {
        id: 'example.inspect',
        kind: 'data-query',
        title: 'Inspect extension data',
        requiredCapabilities: ['extension:read', 'extension:inspect'],
        requiredApiScopes: ['extensions.read', 'extensions.inspect'],
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['cockpit.extension.data.inspect'],
      },
    ],
    lifecycle: {
      emergencyDisable: {
        mode: 'activation-source',
        suppresses: ['routes', 'navigation', 'commands', 'shortcuts', 'data-loading'],
      },
      rollback: {
        mode: 'disable-only',
      },
      auditEvents: ['install', 'enable', 'disable', 'emergency-disable'],
    },
  },
} satisfies CockpitExtensionManifestV1;

describe('cockpit extension SDK conformance', () => {
  it('lets external packages import manifest types and assert conformance', () => {
    const report = assertCockpitExtensionManifestV1Conforms({
      manifest,
      packageRef: {
        packageName: '@example/cockpit-extension',
        version: '0.1.0',
      },
      workspacePackRefs: [{ packId: 'example.extension' }],
      routeModuleIds: ['example-overview', 'example-detail'],
    });

    expect(report.conforms).toBe(true);
    expect(report.problems).toEqual([]);
    expect(report.routeProjection).toEqual([
      {
        extensionId: 'example.extension',
        routeId: 'example-detail',
        path: '/external/example/detail/$itemId',
      },
      {
        extensionId: 'example.extension',
        routeId: 'example-overview',
        path: '/external/example/overview',
      },
    ]);
  });

  it('reports manifest, activation, guard, install-boundary, and projection blockers together', () => {
    const report = createCockpitExtensionManifestV1ConformanceReport({
      manifest: {
        ...manifest,
        manifestVersion: 2 as never,
        packIds: [],
        routes: [
          {
            ...manifest.routes[0]!,
            path: '/internal/example/overview',
            permissionGrantIds: ['example.inspect'],
          },
        ],
        navItems: [
          {
            ...manifest.navItems[0]!,
            to: '/external/example/detail/$itemId',
          },
        ],
      },
      packageRef: {
        packageName: '@example/other-extension',
        version: '0.1.0',
      },
      workspacePackRefs: [{ packId: 'wrong.pack' }],
      routeModuleIds: [],
    });

    expect(report.conforms).toBe(false);
    expect(report.routeProjection).toEqual([]);
    expect(report.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining([
        'invalid-manifest-version',
        'missing-pack-activation',
        'permission-bypass-risk',
        'invalid-external-path',
        'missing-route-module',
        'invalid-direct-nav-target',
        'governance-package-ref-mismatch',
        'install-pack-ref-mismatch',
      ]),
    );
  });

  it('throws a typed error for test-runner assertions', () => {
    expect(() =>
      assertCockpitExtensionManifestV1Conforms({
        manifest: {
          ...manifest,
          routes: [
            {
              ...manifest.routes[0]!,
              guard: undefined as never,
            },
          ],
        },
      }),
    ).toThrow(CockpitExtensionManifestConformanceError);
  });

  it('registers a conforming external package and projects read-only permission metadata', () => {
    const registration = createCockpitExtensionRegistrationV1({
      manifest,
      packageRef: {
        packageName: '@example/cockpit-extension',
        version: '0.1.0',
      },
      workspacePackRefs: [{ packId: 'example.extension' }],
      routeModules: [
        {
          routeId: 'example-overview',
          loadModule: () => Promise.resolve({}),
        },
        {
          routeId: 'example-detail',
          loadModule: () => Promise.resolve({}),
        },
      ],
    });

    expect(registration.conformance.conforms).toBe(true);
    expect(registration.readOnlyPermissions).toEqual([
      {
        extensionId: 'example.extension',
        dataScopeId: 'example.summary',
        permissionGrantId: 'example.read',
        title: 'Example summary',
        resource: 'example.summary',
        requiredCapabilities: ['extension:read'],
        requiredApiScopes: ['extensions.read'],
        privacyClasses: ['internal'],
        auditEventTypes: ['cockpit.extension.data.read'],
      },
    ]);
  });

  it('reports widget and read-only data scope contract blockers', () => {
    const report = createCockpitExtensionManifestV1ConformanceReport({
      manifest: {
        ...manifest,
        widgets: [
          {
            ...manifest.widgets[0]!,
            surface: 'unknown' as never,
            routeId: 'missing-route',
            dataScopeIds: ['missing-scope'],
          },
        ],
        dataScopes: [
          {
            ...manifest.dataScopes[0]!,
            access: 'write' as never,
            permissionGrantIds: ['example.governed'],
          },
        ],
        governance: {
          ...manifest.governance,
          permissions: [
            ...manifest.governance.permissions,
            {
              id: 'example.governed',
              kind: 'governed-action',
              title: 'Propose governed action',
              requiredCapabilities: ['extension:read'],
              requiredApiScopes: ['extensions.read'],
              policySemantics: 'policy-approval-evidence-required',
              evidenceSemantics: 'evidence-required-before-response',
              auditEventTypes: ['cockpit.extension.action.propose'],
            },
          ],
        },
      },
    });

    expect(report.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining([
        'invalid-widget-surface',
        'missing-route',
        'missing-data-scope',
        'invalid-data-scope-access',
        'invalid-data-scope-permission',
      ]),
    );
  });

  it('rejects executable and browser egress manifest fields', () => {
    const report = createCockpitExtensionManifestV1ConformanceReport({
      manifest: {
        ...manifest,
        remoteUrl: 'https://example.invalid/extension.js',
        allowedOrigins: ['https://example.invalid'],
      } as never,
    });

    expect(report.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'forbidden-manifest-key', itemId: 'manifest.remoteUrl' }),
        expect.objectContaining({
          code: 'forbidden-manifest-key',
          itemId: 'manifest.allowedOrigins',
        }),
      ]),
    );
  });
});
