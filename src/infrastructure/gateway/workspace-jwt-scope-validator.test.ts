import { describe, expect, it } from 'vitest';
import { validateWorkspaceJwtScope } from './workspace-jwt-scope-validator.js';

const NOW_SEC = 1_700_000_000;
const clock = () => NOW_SEC;

function baseClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sub: 'spiffe://portarium.io/ns/portarium-agents/sa/agent-ocr/tenant/ws-1',
    aud: 'https://action-api.portarium.io',
    workspaceId: 'ws-1',
    tenantId: 'ws-1',
    exp: NOW_SEC + 300,
    iat: NOW_SEC - 10,
    ...overrides,
  };
}

describe('validateWorkspaceJwtScope', () => {
  // ── Happy path ────────────────────────────────────────────────────────────

  it('accepts a valid token matching workspace scope', () => {
    const result = validateWorkspaceJwtScope(baseClaims(), 'ws-1', { nowEpochSec: clock });
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.claims.workspaceId).toBe('ws-1');
    expect(result.claims.sub).toContain('agent-ocr');
  });

  it('accepts a token with scope and workflowRunId', () => {
    const result = validateWorkspaceJwtScope(
      baseClaims({ scope: ['execute:action', 'read:config'], workflowRunId: 'wfr-42' }),
      'ws-1',
      { nowEpochSec: clock },
    );
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.claims.scope).toEqual(['execute:action', 'read:config']);
    expect(result.claims.workflowRunId).toBe('wfr-42');
  });

  it('falls back to tenantId when workspaceId is absent', () => {
    const claims = baseClaims({ workspaceId: undefined, tenantId: 'ws-1' });
    delete claims['workspaceId'];
    const result = validateWorkspaceJwtScope(claims, 'ws-1', { nowEpochSec: clock });
    expect(result.valid).toBe(true);
  });

  // ── Subject validation ────────────────────────────────────────────────────

  it('rejects token with missing sub', () => {
    const claims = baseClaims();
    delete claims['sub'];
    const result = validateWorkspaceJwtScope(claims, 'ws-1', { nowEpochSec: clock });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.reason).toMatch(/sub/i);
  });

  it('rejects token with empty sub', () => {
    const result = validateWorkspaceJwtScope(baseClaims({ sub: '   ' }), 'ws-1', {
      nowEpochSec: clock,
    });
    expect(result.valid).toBe(false);
  });

  // ── Workspace scope mismatch ──────────────────────────────────────────────

  it('rejects token with workspace scope mismatch', () => {
    const result = validateWorkspaceJwtScope(baseClaims({ workspaceId: 'ws-2' }), 'ws-1', {
      nowEpochSec: clock,
    });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.reason).toMatch(/mismatch/i);
    expect(result.reason).toContain('ws-2');
    expect(result.reason).toContain('ws-1');
  });

  it('rejects token with no workspace or tenant claim', () => {
    const claims = baseClaims();
    delete claims['workspaceId'];
    delete claims['tenantId'];
    const result = validateWorkspaceJwtScope(claims, 'ws-1', { nowEpochSec: clock });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.reason).toMatch(/workspaceId|tenantId/i);
  });

  // ── Expiry ────────────────────────────────────────────────────────────────

  it('rejects expired token', () => {
    const result = validateWorkspaceJwtScope(baseClaims({ exp: NOW_SEC - 60 }), 'ws-1', {
      nowEpochSec: clock,
    });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.reason).toMatch(/expired/i);
  });

  it('accepts token within clock skew tolerance', () => {
    const result = validateWorkspaceJwtScope(baseClaims({ exp: NOW_SEC - 10 }), 'ws-1', {
      nowEpochSec: clock,
      clockSkewToleranceSec: 30,
    });
    expect(result.valid).toBe(true);
  });

  it('accepts token without exp claim (optional)', () => {
    const claims = baseClaims();
    delete claims['exp'];
    const result = validateWorkspaceJwtScope(claims, 'ws-1', { nowEpochSec: clock });
    expect(result.valid).toBe(true);
  });

  // ── Token age (iat) ───────────────────────────────────────────────────────

  it('rejects token exceeding max age (ADR-0100: 15 min)', () => {
    const result = validateWorkspaceJwtScope(baseClaims({ iat: NOW_SEC - 1000 }), 'ws-1', {
      nowEpochSec: clock,
      maxTokenAgeSec: 900,
    });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.reason).toMatch(/age/i);
  });

  it('accepts token within max age', () => {
    const result = validateWorkspaceJwtScope(baseClaims({ iat: NOW_SEC - 600 }), 'ws-1', {
      nowEpochSec: clock,
      maxTokenAgeSec: 900,
    });
    expect(result.valid).toBe(true);
  });

  // ── Audience ──────────────────────────────────────────────────────────────

  it('rejects token with wrong audience when expectedAudience is configured', () => {
    const result = validateWorkspaceJwtScope(
      baseClaims({ aud: 'https://other-service.example.com' }),
      'ws-1',
      { nowEpochSec: clock, expectedAudience: ['https://action-api.portarium.io'] },
    );
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.reason).toMatch(/audience/i);
  });

  it('accepts token when aud matches one of expectedAudience', () => {
    const result = validateWorkspaceJwtScope(
      baseClaims({ aud: ['https://action-api.portarium.io', 'https://other.io'] }),
      'ws-1',
      { nowEpochSec: clock, expectedAudience: ['https://action-api.portarium.io'] },
    );
    expect(result.valid).toBe(true);
  });

  it('skips audience check when expectedAudience is not configured', () => {
    const result = validateWorkspaceJwtScope(baseClaims({ aud: 'anything' }), 'ws-1', {
      nowEpochSec: clock,
    });
    expect(result.valid).toBe(true);
  });

  // ── Defaults ──────────────────────────────────────────────────────────────

  it('uses default max token age of 900 seconds', () => {
    const result = validateWorkspaceJwtScope(baseClaims({ iat: NOW_SEC - 960 }), 'ws-1', {
      nowEpochSec: clock,
    });
    expect(result.valid).toBe(false);
  });

  it('uses default clock skew tolerance of 30 seconds', () => {
    const result = validateWorkspaceJwtScope(baseClaims({ exp: NOW_SEC - 25 }), 'ws-1', {
      nowEpochSec: clock,
    });
    expect(result.valid).toBe(true);
  });
});
