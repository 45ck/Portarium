import { describe, expect, it } from 'vitest';

import { buildEnvCockpitExtensionActivationSource } from './env-cockpit-extension-activation-source.js';

describe('EnvCockpitExtensionActivationSource', () => {
  it('normalizes matching workspace activation grants from environment JSON', async () => {
    const source = buildEnvCockpitExtensionActivationSource({
      PORTARIUM_COCKPIT_EXTENSION_GRANTS_JSON: JSON.stringify([
        {
          workspaceIds: ['ws-1', ' ws-1 '],
          principalIds: ['user-1'],
          roleIncludes: ['admin'],
          scopeIncludes: ['extensions.read'],
          activePackIds: [' demo.pack', 'demo.pack', 'other.pack'],
          quarantinedExtensionIds: ['demo.extension'],
          availableCapabilities: ['objects:read', 'incidents:read'],
          availableApiScopes: ['extensions.read', 'approvals.read'],
        },
        {
          workspaceIds: ['ws-2'],
          activePackIds: ['other-workspace.pack'],
        },
        {
          activePackIds: ['unscoped.pack'],
        },
      ]),
    });

    await expect(
      source.getActivationState({
        workspaceId: 'ws-1',
        principalId: 'user-1',
        roles: ['admin'],
        scopes: ['extensions.read'],
        correlationId: 'corr-1',
        traceparent: '00-00000000000000000000000000000000-0000000000000000-01',
      }),
    ).resolves.toEqual({
      activePackIds: ['demo.pack', 'other.pack'],
      quarantinedExtensionIds: ['demo.extension'],
      availableCapabilities: ['objects:read', 'incidents:read'],
      availableApiScopes: ['extensions.read', 'approvals.read'],
    });
  });

  it('fails closed when no scoped grant matches the caller', async () => {
    const source = buildEnvCockpitExtensionActivationSource({
      PORTARIUM_COCKPIT_EXTENSION_GRANTS_JSON: JSON.stringify([
        {
          workspaceIds: ['ws-1'],
          principalIds: ['user-1'],
          activePackIds: ['demo.pack'],
        },
      ]),
    });

    await expect(
      source.getActivationState({
        workspaceId: 'ws-1',
        principalId: 'user-2',
        roles: ['admin'],
        scopes: ['extensions.read'],
        correlationId: 'corr-1',
        traceparent: '00-00000000000000000000000000000000-0000000000000000-01',
      }),
    ).resolves.toEqual({
      activePackIds: [],
      quarantinedExtensionIds: [],
      availableCapabilities: [],
      availableApiScopes: [],
    });
  });

  it('ignores principal-only grants because activation must be workspace-scoped', async () => {
    const source = buildEnvCockpitExtensionActivationSource({
      PORTARIUM_COCKPIT_EXTENSION_GRANTS_JSON: JSON.stringify([
        {
          principalIds: ['user-1'],
          activePackIds: ['cross-workspace.pack'],
        },
      ]),
    });

    await expect(
      source.getActivationState({
        workspaceId: 'ws-1',
        principalId: 'user-1',
        roles: ['admin'],
        scopes: ['extensions.read'],
        correlationId: 'corr-1',
        traceparent: '00-00000000000000000000000000000000-0000000000000000-01',
      }),
    ).resolves.toEqual({
      activePackIds: [],
      quarantinedExtensionIds: [],
      availableCapabilities: [],
      availableApiScopes: [],
    });
  });
});
