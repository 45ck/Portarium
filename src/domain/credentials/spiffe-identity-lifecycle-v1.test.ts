/**
 * Tests for SPIFFE/SPIRE identity lifecycle domain model.
 *
 * Verifies parsing, state machine transitions, workspace boundary
 * enforcement, rotation policy validation, and SVID lifecycle consistency.
 *
 * Bead: bead-08gp
 */

import { describe, expect, it } from 'vitest';
import { WorkspaceId } from '../primitives/index.js';
import {
  parseSpiffeId,
  SpiffeIdParseError,
  isIdentityState,
  validateSvidLifecycle,
  isValidTransition,
  validNextStates,
  isSpiffeIdInWorkspace,
  isSpiffeIdInTrustDomain,
  validateRotationPolicy,
  shouldRotate,
  type SvidLifecycleRecord,
  type RotationPolicy,
} from './spiffe-identity-lifecycle-v1.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const WS_ID = WorkspaceId('ws-abc-123');

function makeRecord(overrides: Partial<SvidLifecycleRecord> = {}): SvidLifecycleRecord {
  return {
    spiffeId: 'spiffe://portarium.io/ns/portarium/ws/ws-abc-123/sa/runner',
    state: 'Active',
    workspaceId: WS_ID,
    issuedAt: '2025-01-01T00:00:00Z',
    expiresAt: '2025-01-01T01:00:00Z',
    rotationWindowStartsAt: '2025-01-01T00:45:00Z',
    lastRotatedAt: null,
    revokedAt: null,
    revocationReason: null,
    serialNumber: 'serial-001',
    ...overrides,
  };
}

// ── parseSpiffeId ───────────────────────────────────────────────────────────

describe('parseSpiffeId', () => {
  it('parses a valid SPIFFE ID', () => {
    const result = parseSpiffeId('spiffe://portarium.io/ns/portarium/ws/abc/sa/runner');
    expect(result.trustDomain).toBe('portarium.io');
    expect(result.workloadPath).toBe('ns/portarium/ws/abc/sa/runner');
  });

  it('parses a minimal path', () => {
    const result = parseSpiffeId('spiffe://example.com/workload');
    expect(result.trustDomain).toBe('example.com');
    expect(result.workloadPath).toBe('workload');
  });

  it.each([
    ['', 'empty string'],
    ['not-a-spiffe-id', 'no scheme'],
    ['spiffe://', 'no trust domain'],
    ['spiffe://domain', 'no path'],
    ['spiffe://domain/', 'empty path'],
    ['https://example.com/path', 'wrong scheme'],
  ])('rejects invalid input: %s (%s)', (input) => {
    expect(() => parseSpiffeId(input)).toThrow(SpiffeIdParseError);
  });
});

// ── isIdentityState ─────────────────────────────────────────────────────────

describe('isIdentityState', () => {
  it.each(['Pending', 'Active', 'Rotating', 'Revoked', 'Expired'])(
    'accepts valid state "%s"',
    (s) => {
      expect(isIdentityState(s)).toBe(true);
    },
  );

  it.each(['pending', 'active', 'ACTIVE', '', 'Unknown'])('rejects invalid state "%s"', (s) => {
    expect(isIdentityState(s)).toBe(false);
  });
});

// ── validateSvidLifecycle ───────────────────────────────────────────────────

describe('validateSvidLifecycle', () => {
  it('accepts a valid record', () => {
    expect(validateSvidLifecycle(makeRecord())).toEqual({ valid: true });
  });

  it('rejects invalid SPIFFE ID', () => {
    const result = validateSvidLifecycle(makeRecord({ spiffeId: 'bad-id' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('Invalid SPIFFE ID');
  });

  it('rejects invalid issuedAt', () => {
    const result = validateSvidLifecycle(makeRecord({ issuedAt: 'not-a-date' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('issuedAt');
  });

  it('rejects invalid expiresAt', () => {
    const result = validateSvidLifecycle(makeRecord({ expiresAt: 'not-a-date' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('expiresAt');
  });

  it('rejects invalid rotationWindowStartsAt', () => {
    const result = validateSvidLifecycle(makeRecord({ rotationWindowStartsAt: 'not-a-date' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('rotationWindowStartsAt');
  });

  it('rejects issuedAt >= expiresAt', () => {
    const result = validateSvidLifecycle(
      makeRecord({ issuedAt: '2025-01-01T02:00:00Z', expiresAt: '2025-01-01T01:00:00Z' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('issuedAt must be before expiresAt');
  });

  it('rejects rotation window before issuedAt', () => {
    const result = validateSvidLifecycle(
      makeRecord({ rotationWindowStartsAt: '2024-12-31T23:00:00Z' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('rotationWindowStartsAt');
  });

  it('rejects rotation window after expiresAt', () => {
    const result = validateSvidLifecycle(
      makeRecord({ rotationWindowStartsAt: '2025-01-01T02:00:00Z' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('rotationWindowStartsAt');
  });

  it('rejects Revoked state without revokedAt', () => {
    const result = validateSvidLifecycle(makeRecord({ state: 'Revoked', revokedAt: null }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('revokedAt');
  });

  it('accepts Revoked state with revokedAt', () => {
    const result = validateSvidLifecycle(
      makeRecord({ state: 'Revoked', revokedAt: '2025-01-01T00:30:00Z' }),
    );
    expect(result).toEqual({ valid: true });
  });

  it('rejects empty serialNumber', () => {
    const result = validateSvidLifecycle(makeRecord({ serialNumber: '' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('serialNumber');
  });

  it('rejects whitespace-only serialNumber', () => {
    const result = validateSvidLifecycle(makeRecord({ serialNumber: '   ' }));
    expect(result.valid).toBe(false);
  });
});

// ── isValidTransition ───────────────────────────────────────────────────────

describe('isValidTransition', () => {
  it.each([
    ['Pending', 'Active'],
    ['Pending', 'Revoked'],
    ['Active', 'Rotating'],
    ['Active', 'Revoked'],
    ['Active', 'Expired'],
    ['Rotating', 'Active'],
    ['Rotating', 'Revoked'],
    ['Rotating', 'Expired'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  it.each([
    ['Pending', 'Rotating'],
    ['Pending', 'Expired'],
    ['Active', 'Pending'],
    ['Rotating', 'Pending'],
    ['Revoked', 'Active'],
    ['Revoked', 'Pending'],
    ['Expired', 'Active'],
    ['Expired', 'Pending'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(isValidTransition(from, to)).toBe(false);
  });
});

// ── validNextStates ─────────────────────────────────────────────────────────

describe('validNextStates', () => {
  it('returns Active and Revoked for Pending', () => {
    expect(validNextStates('Pending')).toEqual(['Active', 'Revoked']);
  });

  it('returns empty array for terminal states', () => {
    expect(validNextStates('Revoked')).toEqual([]);
    expect(validNextStates('Expired')).toEqual([]);
  });
});

// ── isSpiffeIdInWorkspace ───────────────────────────────────────────────────

describe('isSpiffeIdInWorkspace', () => {
  it('matches when workspace ID is in the path', () => {
    expect(
      isSpiffeIdInWorkspace('spiffe://portarium.io/ns/portarium/ws/ws-abc-123/sa/runner', WS_ID),
    ).toBe(true);
  });

  it('rejects when workspace ID does not match', () => {
    expect(
      isSpiffeIdInWorkspace('spiffe://portarium.io/ns/portarium/ws/ws-other/sa/runner', WS_ID),
    ).toBe(false);
  });

  it('throws for invalid SPIFFE ID', () => {
    expect(() => isSpiffeIdInWorkspace('bad-id', WS_ID)).toThrow(SpiffeIdParseError);
  });
});

// ── isSpiffeIdInTrustDomain ─────────────────────────────────────────────────

describe('isSpiffeIdInTrustDomain', () => {
  it('matches the correct trust domain', () => {
    expect(isSpiffeIdInTrustDomain('spiffe://portarium.io/workload', 'portarium.io')).toBe(true);
  });

  it('rejects mismatched trust domain', () => {
    expect(isSpiffeIdInTrustDomain('spiffe://portarium.io/workload', 'other.io')).toBe(false);
  });
});

// ── validateRotationPolicy ──────────────────────────────────────────────────

describe('validateRotationPolicy', () => {
  const validPolicy: RotationPolicy = {
    ttlSeconds: 3600,
    rotationLeadSeconds: 600,
    maxConcurrentSvids: 2,
  };

  it('accepts a valid rotation policy', () => {
    expect(validateRotationPolicy(validPolicy)).toEqual({ valid: true });
  });

  it('rejects ttlSeconds <= 0', () => {
    const result = validateRotationPolicy({ ...validPolicy, ttlSeconds: 0 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('ttlSeconds');
  });

  it('rejects rotationLeadSeconds <= 0', () => {
    const result = validateRotationPolicy({ ...validPolicy, rotationLeadSeconds: 0 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('rotationLeadSeconds');
  });

  it('rejects rotationLeadSeconds >= ttlSeconds', () => {
    const result = validateRotationPolicy({ ...validPolicy, rotationLeadSeconds: 3600 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('rotationLeadSeconds');
  });

  it('rejects maxConcurrentSvids < 1', () => {
    const result = validateRotationPolicy({ ...validPolicy, maxConcurrentSvids: 0 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('maxConcurrentSvids');
  });
});

// ── shouldRotate ────────────────────────────────────────────────────────────

describe('shouldRotate', () => {
  const policy: RotationPolicy = {
    ttlSeconds: 3600,
    rotationLeadSeconds: 900, // 15 min before expiry
    maxConcurrentSvids: 2,
  };

  it('returns true when within rotation window', () => {
    const record = makeRecord({ expiresAt: '2025-01-01T01:00:00Z' });
    // 10 min before expiry = within 15 min lead
    const nowMs = Date.parse('2025-01-01T00:50:00Z');
    expect(shouldRotate(record, nowMs, policy)).toBe(true);
  });

  it('returns false when before rotation window', () => {
    const record = makeRecord({ expiresAt: '2025-01-01T01:00:00Z' });
    // 20 min before expiry = outside 15 min lead
    const nowMs = Date.parse('2025-01-01T00:40:00Z');
    expect(shouldRotate(record, nowMs, policy)).toBe(false);
  });

  it('returns false for non-Active states', () => {
    const record = makeRecord({ state: 'Pending', expiresAt: '2025-01-01T01:00:00Z' });
    const nowMs = Date.parse('2025-01-01T00:50:00Z');
    expect(shouldRotate(record, nowMs, policy)).toBe(false);
  });

  it('returns true at exact rotation threshold', () => {
    const record = makeRecord({ expiresAt: '2025-01-01T01:00:00Z' });
    // Exactly 15 min (900s) before expiry
    const nowMs = Date.parse('2025-01-01T00:45:00Z');
    expect(shouldRotate(record, nowMs, policy)).toBe(true);
  });

  it('returns false for Revoked state even in rotation window', () => {
    const record = makeRecord({
      state: 'Revoked',
      revokedAt: '2025-01-01T00:30:00Z',
      expiresAt: '2025-01-01T01:00:00Z',
    });
    const nowMs = Date.parse('2025-01-01T00:50:00Z');
    expect(shouldRotate(record, nowMs, policy)).toBe(false);
  });
});
