import { describe, expect, it } from 'vitest';
import { NEUTRAL_OPS_EXTENSION } from './fixtures';
import { resolveCockpitExtensionRegistry } from './registry';
import type { CockpitExtensionManifest } from './types';

function cloneExtension(overrides: Partial<CockpitExtensionManifest> = {}): CockpitExtensionManifest {
  return {
    ...NEUTRAL_OPS_EXTENSION,
    routes: [...NEUTRAL_OPS_EXTENSION.routes],
    navItems: [...NEUTRAL_OPS_EXTENSION.navItems],
    commands: [...NEUTRAL_OPS_EXTENSION.commands],
    ...overrides,
  };
}

describe('cockpit extension registry', () => {
  it('resolves enabled extensions when pack activation is present', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_OPS_EXTENSION],
      activePackIds: ['example.ops-demo'],
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('enabled');
    expect(registry.routes).toHaveLength(2);
    expect(registry.navItems).toHaveLength(1);
    expect(registry.commands).toHaveLength(1);
  });

  it('hides installed extensions when pack activation is absent', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_OPS_EXTENSION],
      activePackIds: [],
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('disabled');
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed on duplicate extension, route, path, command, and shortcut ids', () => {
    const duplicate = cloneExtension({
      id: NEUTRAL_OPS_EXTENSION.id,
      owner: 'portarium-test',
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_OPS_EXTENSION, duplicate],
      activePackIds: ['example.ops-demo'],
    });

    expect(registry.extensions.every((extension) => extension.status === 'invalid')).toBe(true);
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining([
        'duplicate-extension-id',
        'duplicate-route-id',
        'duplicate-route-path',
        'duplicate-nav-id',
        'duplicate-command-id',
        'duplicate-shortcut',
      ]),
    );
    expect(registry.routes).toEqual([]);
  });

  it('fails closed on invalid surfaces and icons', () => {
    const invalid = cloneExtension({
      navItems: [
        {
          ...NEUTRAL_OPS_EXTENSION.navItems[0]!,
          icon: 'unknown-icon' as never,
          surfaces: ['sidebar', 'unknown-surface' as never],
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.ops-demo'],
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['invalid-icon', 'invalid-surface']),
    );
    expect(registry.navItems).toEqual([]);
  });

  it('fails closed when surfaced routes do not declare host guard metadata', () => {
    const invalid = cloneExtension({
      routes: [
        {
          ...NEUTRAL_OPS_EXTENSION.routes[0]!,
          guard: undefined as never,
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.ops-demo'],
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toContain('missing-route-guard');
    expect(registry.routes).toEqual([]);
  });

  it('fails closed on routes outside the external boundary and parameterized nav targets', () => {
    const invalid = cloneExtension({
      routes: [
        {
          ...NEUTRAL_OPS_EXTENSION.routes[0]!,
          path: '/config/settings',
        },
      ],
      navItems: [
        {
          ...NEUTRAL_OPS_EXTENSION.navItems[0]!,
          to: '/external/example-ops/actions/$proposalId',
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.ops-demo'],
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['invalid-external-path', 'invalid-direct-nav-target']),
    );
    expect(registry.routes).toEqual([]);
  });
});
