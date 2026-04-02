import { describe, expect, it, vi } from 'vitest';

import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import type { EvidenceLogPort } from '../../application/ports/evidence-log.js';
import {
  createRuntimeMirroredEvidenceLog,
  getJoseAuthConfigWarnings,
  toRuntimeEvidenceRecord,
} from './control-plane-handler.bootstrap.js';

describe('getJoseAuthConfigWarnings', () => {
  it('returns no warnings when both issuer and audience are set', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
      PORTARIUM_JWT_AUDIENCE: 'portarium-api',
    });
    expect(warnings).toHaveLength(0);
  });

  it('returns a warning when PORTARIUM_JWT_ISSUER is absent', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_AUDIENCE: 'portarium-api',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_ISSUER/);
    expect(warnings[0]).toMatch(/issuer/i);
  });

  it('returns a warning when PORTARIUM_JWT_AUDIENCE is absent', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_AUDIENCE/);
    expect(warnings[0]).toMatch(/audience/i);
  });

  it('returns two warnings when both issuer and audience are absent', () => {
    const warnings = getJoseAuthConfigWarnings({});
    expect(warnings).toHaveLength(2);
    const text = warnings.join('\n');
    expect(text).toMatch(/PORTARIUM_JWT_ISSUER/);
    expect(text).toMatch(/PORTARIUM_JWT_AUDIENCE/);
  });

  it('returns a warning when PORTARIUM_JWT_ISSUER is whitespace-only', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: '   ',
      PORTARIUM_JWT_AUDIENCE: 'portarium-api',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_ISSUER/);
  });

  it('returns a warning when PORTARIUM_JWT_AUDIENCE is whitespace-only', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
      PORTARIUM_JWT_AUDIENCE: '  ',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_AUDIENCE/);
  });

  it('warnings include guidance on what value to set', () => {
    const warnings = getJoseAuthConfigWarnings({});
    expect(warnings[0]).toMatch(/Set PORTARIUM_JWT_ISSUER/);
    expect(warnings[1]).toMatch(/Set PORTARIUM_JWT_AUDIENCE/);
  });

  it('returns a readonly array', () => {
    const warnings = getJoseAuthConfigWarnings({});
    expect(Array.isArray(warnings)).toBe(true);
  });
});

describe('runtime evidence mirroring', () => {
  it('converts domain evidence entries into runtime evidence records', () => {
    const entry = {
      schemaVersion: 1,
      evidenceId: 'evi-1' as never,
      workspaceId: 'ws-1' as never,
      correlationId: 'corr-1' as never,
      occurredAtIso: '2026-04-02T05:10:00.000Z',
      category: 'PolicyViolation' as const,
      summary: 'Policy violation recorded.',
      actor: { kind: 'User', userId: 'usr-1' as never },
      links: {
        runId: 'run-1' as never,
        planId: 'plan-1' as never,
        workItemId: 'wi-1' as never,
        approvalId: 'app-1' as never,
      },
      hashSha256: 'sha256:abc123' as never,
    } satisfies EvidenceEntryV1;

    expect(toRuntimeEvidenceRecord(entry)).toEqual({
      schemaVersion: 1,
      evidenceId: 'evi-1',
      workspaceId: 'ws-1',
      occurredAtIso: '2026-04-02T05:10:00.000Z',
      category: 'Policy',
      summary: 'Policy violation recorded.',
      actor: { kind: 'User', userId: 'usr-1' },
      links: {
        runId: 'run-1',
        planId: 'plan-1',
        workItemId: 'wi-1',
      },
      hashSha256: 'sha256:abc123',
    });
  });

  it('mirrors appended evidence entries into the runtime sink', async () => {
    const appended = {
      schemaVersion: 1,
      evidenceId: 'evi-2' as never,
      workspaceId: 'ws-2' as never,
      correlationId: 'corr-2' as never,
      occurredAtIso: '2026-04-02T05:15:00.000Z',
      category: 'Approval' as const,
      summary: 'Approval recorded.',
      actor: { kind: 'System' as const },
      hashSha256: 'sha256:def456' as never,
    } satisfies EvidenceEntryV1;
    const base: EvidenceLogPort = {
      appendEntry: vi.fn(async () => appended),
    };
    const sink = vi.fn();

    const mirrored = createRuntimeMirroredEvidenceLog(base, sink);
    const result = await mirrored.appendEntry('tenant-1' as never, appended);

    expect(result).toBe(appended);
    expect(base.appendEntry).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith({
      schemaVersion: 1,
      evidenceId: 'evi-2',
      workspaceId: 'ws-2',
      occurredAtIso: '2026-04-02T05:15:00.000Z',
      category: 'Approval',
      summary: 'Approval recorded.',
      actor: { kind: 'System' },
      hashSha256: 'sha256:def456',
    });
  });
});
