import { describe, expect, it } from 'vitest';
import type { EvidenceEntry } from '@portarium/cockpit-types';
import {
  filterAuditEntries,
  getPolicyScope,
  getPolicyTier,
  getRuleCount,
  normalizeAuditCategory,
} from './governance.utils';

describe('governance utils', () => {
  it('derives policy presentation fields from policy payload', () => {
    const policy = {
      policyId: 'pol-1',
      name: 'p',
      description: 'd',
      status: 'Active' as const,
      ruleText: 'WHEN x THEN DENY',
      conditions: [
        { field: 'actor.role', operator: 'in' as const, value: 'Admin' },
        { field: 'action.type', operator: 'eq' as const, value: 'write:external' },
      ],
    };

    expect(getPolicyTier(policy)).toBe('Unspecified');
    expect(getPolicyScope(policy)).toBe('actor, action');
    expect(getRuleCount(policy)).toBe(2);
  });

  it('respects explicit policy metadata when provided by API', () => {
    const policy = {
      policyId: 'pol-2',
      name: 'p',
      description: 'd',
      status: 'Active' as const,
      tier: 'HumanApprove',
      scope: 'finance',
      ruleCount: 9,
      ruleText: 'WHEN x THEN DENY',
      conditions: [],
    };

    expect(getPolicyTier(policy)).toBe('HumanApprove');
    expect(getPolicyScope(policy)).toBe('finance');
    expect(getRuleCount(policy)).toBe(9);
  });

  it('normalizes policy violations from explicit and inferred categories', () => {
    const explicit: EvidenceEntry = {
      schemaVersion: 1,
      evidenceId: 'evd-1',
      workspaceId: 'ws',
      occurredAtIso: '2026-02-20T00:00:00Z',
      category: 'PolicyViolation',
      summary: 'Policy violation detected',
      actor: { kind: 'System' },
      hashSha256: 'x',
    };
    const inferred: EvidenceEntry = {
      schemaVersion: 1,
      evidenceId: 'evd-2',
      workspaceId: 'ws',
      occurredAtIso: '2026-02-20T00:00:00Z',
      category: 'Policy',
      summary: 'Denied by policy engine',
      actor: { kind: 'System' },
      hashSha256: 'y',
    };

    expect(normalizeAuditCategory(explicit)).toBe('PolicyViolation');
    expect(normalizeAuditCategory(inferred)).toBe('PolicyViolation');
    expect(filterAuditEntries([explicit, inferred], 'PolicyViolation')).toHaveLength(2);
  });
});
