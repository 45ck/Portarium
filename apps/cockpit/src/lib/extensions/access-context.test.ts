import { describe, expect, it } from 'vitest';
import { resolveCockpitExtensionAccessContext } from './access-context';
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
});
