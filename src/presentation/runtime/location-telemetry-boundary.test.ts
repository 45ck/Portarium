import { describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import {
  DEFAULT_LOCATION_TELEMETRY_POLICY,
  enforceLocationTelemetryBoundary,
} from './location-telemetry-boundary.js';

const now = new Date('2026-02-19T12:00:00.000Z');

function ctx(roles: readonly string[]) {
  return toAppContext({
    tenantId: 'ws-1',
    principalId: 'user-1',
    roles,
    scopes: [],
    correlationId: 'corr-1',
  });
}

describe('enforceLocationTelemetryBoundary', () => {
  it('rejects unauthorized live telemetry access when actor lacks required role', () => {
    const result = enforceLocationTelemetryBoundary(
      ctx(['approver']),
      {
        mode: 'history',
        purpose: 'incident-response',
        fromIso: '2026-02-18T11:00:00.000Z',
        toIso: '2026-02-18T11:30:00.000Z',
      },
      DEFAULT_LOCATION_TELEMETRY_POLICY,
      now,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected forbidden result.');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/Role does not allow history/i);
  });

  it('rejects requests outside retention window', () => {
    const result = enforceLocationTelemetryBoundary(
      ctx(['auditor']),
      {
        mode: 'history',
        purpose: 'compliance-audit',
        fromIso: '2025-12-01T00:00:00.000Z',
        toIso: '2025-12-01T01:00:00.000Z',
      },
      DEFAULT_LOCATION_TELEMETRY_POLICY,
      now,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected retention rejection.');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/retention window/i);
  });

  it('allows valid in-window history access for authorized roles', () => {
    const result = enforceLocationTelemetryBoundary(
      ctx(['operator']),
      {
        mode: 'history',
        purpose: 'incident-response',
        fromIso: '2026-02-19T10:00:00.000Z',
        toIso: '2026-02-19T11:00:00.000Z',
      },
      DEFAULT_LOCATION_TELEMETRY_POLICY,
      now,
    );

    expect(result).toEqual({ ok: true });
  });

  it('rejects download mode with operations purpose', () => {
    const result = enforceLocationTelemetryBoundary(
      ctx(['admin']),
      {
        mode: 'download',
        purpose: 'operations',
        fromIso: '2026-02-19T10:00:00.000Z',
        toIso: '2026-02-19T11:00:00.000Z',
      },
      DEFAULT_LOCATION_TELEMETRY_POLICY,
      now,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected purpose rejection.');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/not allowed for telemetry export/i);
  });
});
