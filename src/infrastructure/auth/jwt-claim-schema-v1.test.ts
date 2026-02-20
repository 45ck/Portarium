import { describe, it, expect } from 'vitest';
import {
  parsePortariumJwtClaims,
  hasWorkspaceScope,
  JwtClaimValidationError,
} from './jwt-claim-schema-v1.js';

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sub: 'user-123',
    iss: 'https://auth.portarium.io',
    aud: 'portarium-api',
    workspaceId: 'ws-abc',
    roles: ['admin'],
    ...overrides,
  };
}

describe('parsePortariumJwtClaims', () => {
  it('parses a minimal valid claim set', () => {
    const result = parsePortariumJwtClaims(validPayload());
    expect(result.sub).toBe('user-123');
    expect(result.iss).toBe('https://auth.portarium.io');
    expect(result.aud).toBe('portarium-api');
    expect(result.workspaceId).toBe('ws-abc');
    expect(result.tenantId).toBe('ws-abc');
    expect(result.roles).toEqual(['admin']);
    expect(result.agentId).toBeUndefined();
    expect(result.machineId).toBeUndefined();
    expect(result.capabilities).toBeUndefined();
  });

  it('accepts aud as an array', () => {
    const result = parsePortariumJwtClaims(validPayload({ aud: ['api', 'web'] }));
    expect(result.aud).toEqual(['api', 'web']);
  });

  it('falls back to tenantId when workspaceId is absent', () => {
    const payload = validPayload();
    delete payload['workspaceId'];
    payload['tenantId'] = 'tenant-xyz';
    const result = parsePortariumJwtClaims(payload);
    expect(result.workspaceId).toBe('tenant-xyz');
    expect(result.tenantId).toBe('tenant-xyz');
  });

  it('prefers workspaceId over tenantId', () => {
    const result = parsePortariumJwtClaims(
      validPayload({ workspaceId: 'ws-1', tenantId: 'tenant-2' }),
    );
    expect(result.workspaceId).toBe('ws-1');
  });

  it('parses optional agentId', () => {
    const result = parsePortariumJwtClaims(validPayload({ agentId: 'agent-42' }));
    expect(result.agentId).toBe('agent-42');
  });

  it('parses optional machineId', () => {
    const result = parsePortariumJwtClaims(validPayload({ machineId: 'machine-7' }));
    expect(result.machineId).toBe('machine-7');
  });

  it('parses optional capabilities', () => {
    const result = parsePortariumJwtClaims(
      validPayload({ capabilities: ['invoice:read', 'order:write'] }),
    );
    expect(result.capabilities).toEqual(['invoice:read', 'order:write']);
  });

  it('accepts multiple valid roles', () => {
    const result = parsePortariumJwtClaims(
      validPayload({ roles: ['admin', 'operator', 'auditor'] }),
    );
    expect(result.roles).toEqual(['admin', 'operator', 'auditor']);
  });

  // --- Rejection cases ---

  it('rejects null payload', () => {
    expect(() => parsePortariumJwtClaims(null)).toThrow(JwtClaimValidationError);
  });

  it('rejects non-object payload', () => {
    expect(() => parsePortariumJwtClaims('string')).toThrow(JwtClaimValidationError);
  });

  it('rejects array payload', () => {
    expect(() => parsePortariumJwtClaims([])).toThrow(JwtClaimValidationError);
  });

  it('rejects missing sub', () => {
    const payload = validPayload();
    delete payload['sub'];
    expect(() => parsePortariumJwtClaims(payload)).toThrow(JwtClaimValidationError);
    expect(() => parsePortariumJwtClaims(payload)).toThrow("Claim 'sub'");
  });

  it('rejects empty sub', () => {
    expect(() => parsePortariumJwtClaims(validPayload({ sub: '  ' }))).toThrow(
      JwtClaimValidationError,
    );
  });

  it('rejects missing iss', () => {
    const payload = validPayload();
    delete payload['iss'];
    expect(() => parsePortariumJwtClaims(payload)).toThrow("Claim 'iss'");
  });

  it('rejects missing aud', () => {
    const payload = validPayload();
    delete payload['aud'];
    expect(() => parsePortariumJwtClaims(payload)).toThrow("Claim 'aud'");
  });

  it('rejects empty aud array', () => {
    expect(() => parsePortariumJwtClaims(validPayload({ aud: [] }))).toThrow("Claim 'aud'");
  });

  it('rejects missing workspaceId and tenantId', () => {
    const payload = validPayload();
    delete payload['workspaceId'];
    expect(() => parsePortariumJwtClaims(payload)).toThrow('workspaceId');
  });

  it('rejects empty workspaceId without tenantId', () => {
    const payload = validPayload({ workspaceId: '' });
    expect(() => parsePortariumJwtClaims(payload)).toThrow('workspaceId');
  });

  it('rejects missing roles', () => {
    const payload = validPayload();
    delete payload['roles'];
    expect(() => parsePortariumJwtClaims(payload)).toThrow("Claim 'roles'");
  });

  it('rejects empty roles array', () => {
    expect(() => parsePortariumJwtClaims(validPayload({ roles: [] }))).toThrow(
      "Claim 'roles'",
    );
  });

  it('rejects invalid role value', () => {
    expect(() =>
      parsePortariumJwtClaims(validPayload({ roles: ['superuser'] })),
    ).toThrow('not a valid workspace role');
  });

  it('rejects duplicate roles', () => {
    expect(() =>
      parsePortariumJwtClaims(validPayload({ roles: ['admin', 'admin'] })),
    ).toThrow('duplicate role');
  });

  it('rejects non-string agentId', () => {
    expect(() => parsePortariumJwtClaims(validPayload({ agentId: 42 }))).toThrow(
      JwtClaimValidationError,
    );
  });

  it('rejects empty agentId', () => {
    expect(() => parsePortariumJwtClaims(validPayload({ agentId: '' }))).toThrow(
      JwtClaimValidationError,
    );
  });

  it('rejects non-array capabilities', () => {
    expect(() =>
      parsePortariumJwtClaims(validPayload({ capabilities: 'invoice:read' })),
    ).toThrow(JwtClaimValidationError);
  });

  it('rejects capabilities with empty string entries', () => {
    expect(() =>
      parsePortariumJwtClaims(validPayload({ capabilities: ['invoice:read', ''] })),
    ).toThrow(JwtClaimValidationError);
  });
});

describe('hasWorkspaceScope', () => {
  it('returns true when workspaceId is present', () => {
    expect(hasWorkspaceScope({ workspaceId: 'ws-1' })).toBe(true);
  });

  it('returns true when tenantId is present', () => {
    expect(hasWorkspaceScope({ tenantId: 'tenant-1' })).toBe(true);
  });

  it('returns false when neither is present', () => {
    expect(hasWorkspaceScope({})).toBe(false);
  });

  it('returns false for empty workspaceId', () => {
    expect(hasWorkspaceScope({ workspaceId: '' })).toBe(false);
  });

  it('returns false for whitespace-only workspaceId', () => {
    expect(hasWorkspaceScope({ workspaceId: '  ' })).toBe(false);
  });
});
