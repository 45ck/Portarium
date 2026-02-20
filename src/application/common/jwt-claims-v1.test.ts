import { describe, expect, it } from 'vitest';

import {
  assertWorkspaceScoped,
  validatePortariumJwtClaimsV1,
} from './jwt-claims-v1.js';

describe('validatePortariumJwtClaimsV1', () => {
  const validClaims = {
    sub: 'user-1',
    iss: 'https://idp.portarium.io',
    aud: 'portarium-api',
    workspaceId: 'ws-1',
    roles: ['operator'],
  };

  it('returns validated claims for a complete payload', () => {
    const result = validatePortariumJwtClaimsV1(validClaims);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.value.sub).toBe('user-1');
    expect(result.value.iss).toBe('https://idp.portarium.io');
    expect(result.value.aud).toBe('portarium-api');
    expect(result.value.workspaceId).toBe('ws-1');
    expect(result.value.tenantId).toBe('ws-1');
    expect(result.value.roles).toEqual(['operator']);
  });

  it('includes optional agentId and machineId when present', () => {
    const result = validatePortariumJwtClaimsV1({
      ...validClaims,
      agentId: 'agent-1',
      machineId: 'machine-1',
      capabilities: ['invoice:read', 'invoice:write'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.value.agentId).toBe('agent-1');
    expect(result.value.machineId).toBe('machine-1');
    expect(result.value.capabilities).toEqual(['invoice:read', 'invoice:write']);
  });

  it('rejects when sub is missing', () => {
    const result = validatePortariumJwtClaimsV1({ ...validClaims, sub: '' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.kind).toBe('Unauthorized');
    expect(result.error.message).toContain('sub');
  });

  it('rejects when iss is missing', () => {
    const result = validatePortariumJwtClaimsV1({ ...validClaims, iss: undefined });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toContain('iss');
  });

  it('rejects when aud is missing', () => {
    const result = validatePortariumJwtClaimsV1({ ...validClaims, aud: undefined });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toContain('aud');
  });

  it('rejects when workspaceId is missing and no tenantId fallback', () => {
    const result = validatePortariumJwtClaimsV1({
      ...validClaims,
      workspaceId: undefined,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toContain('workspaceId');
  });

  it('falls back to tenantId when workspaceId is missing', () => {
    const { workspaceId: _, ...rest } = validClaims;
    const result = validatePortariumJwtClaimsV1({ ...rest, tenantId: 'tenant-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.value.workspaceId).toBe('tenant-1');
  });

  it('rejects when roles is empty', () => {
    const result = validatePortariumJwtClaimsV1({ ...validClaims, roles: [] });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toContain('roles');
  });

  it('rejects when roles contains only invalid entries', () => {
    const result = validatePortariumJwtClaimsV1({
      ...validClaims,
      roles: ['unknown-role', 'another-bad'],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toContain('roles');
  });

  it('filters out invalid roles but keeps valid ones', () => {
    const result = validatePortariumJwtClaimsV1({
      ...validClaims,
      roles: ['admin', 'unknown-role', 'operator'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.value.roles).toEqual(['admin', 'operator']);
  });

  it('accepts audience as string array', () => {
    const result = validatePortariumJwtClaimsV1({
      ...validClaims,
      aud: ['portarium-api', 'portarium-worker'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.value.aud).toEqual(['portarium-api', 'portarium-worker']);
  });

  it('accepts Keycloak-style realm_access.roles', () => {
    const result = validatePortariumJwtClaimsV1({
      ...validClaims,
      roles: undefined,
      realm_access: { roles: ['operator', 'offline_access'] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.value.roles).toEqual(['operator']);
  });

  it('reports multiple missing fields at once', () => {
    const result = validatePortariumJwtClaimsV1({});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toContain('sub');
    expect(result.error.message).toContain('iss');
    expect(result.error.message).toContain('aud');
    expect(result.error.message).toContain('workspaceId');
    expect(result.error.message).toContain('roles');
  });
});

describe('assertWorkspaceScoped', () => {
  it('returns workspaceId when present', () => {
    const result = assertWorkspaceScoped({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.value).toBe('ws-1');
  });

  it('falls back to tenantId', () => {
    const result = assertWorkspaceScoped({ tenantId: 'tenant-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.value).toBe('tenant-1');
  });

  it('rejects when both are missing', () => {
    const result = assertWorkspaceScoped({});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.kind).toBe('Unauthorized');
  });

  it('rejects empty string workspaceId', () => {
    const result = assertWorkspaceScoped({ workspaceId: '  ' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.kind).toBe('Unauthorized');
  });
});
