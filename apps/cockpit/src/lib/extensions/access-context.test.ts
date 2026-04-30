import { describe, expect, it } from 'vitest';
import {
  resolveCockpitExtensionAccessContext,
  resolveCockpitExtensionServerAccess,
} from './access-context';
import type { ParsedAuthClaims } from '@/stores/auth-store';

const fallback = {
  availableCapabilities: ['objects:read'],
  availableApiScopes: ['extensions.read'],
} as const;

describe('cockpit extension access context', () => {
  it('uses the local fallback only when no authenticated claims are available', () => {
    expect(
      resolveCockpitExtensionAccessContext({
        claims: null,
        persona: 'Operator',
        fallback,
      }),
    ).toEqual({
      persona: 'Operator',
      ...fallback,
    });
  });

  it('uses authenticated claim grants instead of the local fallback', () => {
    const claims: ParsedAuthClaims = {
      sub: 'user-1',
      workspaceId: 'ws-1',
      roles: ['operator'],
      personas: ['Auditor'],
      capabilities: ['evidence:read'],
      apiScopes: ['audit.read'],
    };

    expect(
      resolveCockpitExtensionAccessContext({
        claims,
        persona: 'Auditor',
        fallback,
      }),
    ).toEqual({
      persona: 'Auditor',
      availablePersonas: ['Auditor'],
      availableCapabilities: ['evidence:read'],
      availableApiScopes: ['audit.read'],
    });
  });

  it('uses non-expired server context as the extension authority', () => {
    expect(
      resolveCockpitExtensionServerAccess({
        workspaceId: 'ws-1',
        now: new Date('2026-04-30T02:00:00.000Z'),
        serverContext: {
          schemaVersion: 1,
          workspaceId: 'ws-1',
          principalId: 'user-1',
          persona: 'Operator',
          availablePersonas: ['Operator'],
          availableCapabilities: ['objects:read'],
          availableApiScopes: ['extensions.read'],
          activePackIds: ['demo.pack'],
          quarantinedExtensionIds: [],
          issuedAtIso: '2026-04-30T01:59:00.000Z',
          expiresAtIso: '2026-04-30T02:04:00.000Z',
        },
      }),
    ).toEqual({
      activePackIds: ['demo.pack'],
      quarantinedExtensionIds: [],
      accessContext: {
        persona: 'Operator',
        availablePersonas: ['Operator'],
        availableCapabilities: ['objects:read'],
        availableApiScopes: ['extensions.read'],
      },
      usable: true,
    });
  });

  it('fails closed when server context is unavailable, mismatched, or expired', () => {
    const emptyAccess = {
      activePackIds: [],
      quarantinedExtensionIds: [],
      accessContext: {
        availablePersonas: [],
        availableCapabilities: [],
        availableApiScopes: [],
      },
      usable: false,
    };

    const serverContext = {
      schemaVersion: 1 as const,
      workspaceId: 'ws-1',
      principalId: 'user-1',
      availablePersonas: ['Operator'],
      availableCapabilities: ['objects:read'],
      availableApiScopes: ['extensions.read'],
      activePackIds: ['demo.pack'],
      quarantinedExtensionIds: [],
      issuedAtIso: '2026-04-30T01:59:00.000Z',
      expiresAtIso: '2026-04-30T02:04:00.000Z',
    };

    expect(
      resolveCockpitExtensionServerAccess({
        workspaceId: 'ws-1',
        serverContext: null,
      }),
    ).toEqual(emptyAccess);
    expect(
      resolveCockpitExtensionServerAccess({
        workspaceId: 'ws-2',
        serverContext,
      }),
    ).toEqual(emptyAccess);
    expect(
      resolveCockpitExtensionServerAccess({
        workspaceId: 'ws-1',
        now: new Date('2026-04-30T02:05:00.000Z'),
        serverContext,
      }),
    ).toEqual(emptyAccess);
  });

  it('fails closed when server context has malformed authority fields', () => {
    expect(
      resolveCockpitExtensionServerAccess({
        workspaceId: 'ws-1',
        serverContext: {
          schemaVersion: 1,
          workspaceId: 'ws-1',
          principalId: 'user-1',
          availablePersonas: ['Operator'],
          availableCapabilities: ['objects:read'],
          availableApiScopes: ['extensions.read'],
          activePackIds: 'demo.pack',
          quarantinedExtensionIds: [],
          issuedAtIso: '2026-04-30T01:59:00.000Z',
          expiresAtIso: '2026-04-30T02:04:00.000Z',
        } as never,
      }),
    ).toEqual({
      activePackIds: [],
      quarantinedExtensionIds: [],
      accessContext: {
        availablePersonas: [],
        availableCapabilities: [],
        availableApiScopes: [],
      },
      usable: false,
    });
  });
});
