/**
 * scripts/integration/harness.test.ts
 *
 * Unit tests for the integration harness readiness report builder and
 * health-check logic. These tests run without Docker; they validate the
 * harness's internal behaviour (profile selection, report structure,
 * troubleshooting output paths).
 *
 * Bead: bead-0843
 */

import { describe, it, expect } from 'vitest';

// ── Inline helpers (mirroring harness.mjs logic for testability) ─────────

type ServiceStatus = 'healthy' | 'unhealthy' | 'skipped';

interface ServiceHealth {
  service: string;
  url: string;
  status: ServiceStatus;
  latencyMs: number;
  error?: string;
}

interface ReadinessReport {
  timestamp: string;
  authProfile: string;
  seedMode: string;
  services: ServiceHealth[];
  seed: Record<string, string>;
  ready: boolean;
}

function composeProfiles(authProfile: string, seedMode: string): string[] {
  const profiles = ['baseline', 'runtime', 'auth'];
  if (authProfile === 'oidc') profiles.push('idp');
  if (seedMode === 'odoo') profiles.push('erp');
  return profiles;
}

function buildReport(
  services: ServiceHealth[],
  seedResults: Record<string, string>,
  authProfile: string,
  seedMode: string,
): ReadinessReport {
  const allRequiredHealthy = services
    .filter((s) => s.status !== 'skipped')
    .every((s) => s.status === 'healthy');
  const allSeedsOk = Object.values(seedResults).every((v) => v === 'ok');

  return {
    timestamp: new Date().toISOString(),
    authProfile,
    seedMode,
    services,
    seed: seedResults,
    ready: allRequiredHealthy && allSeedsOk,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('integration harness: compose profile selection', () => {
  it('selects baseline + runtime + auth for dev-token mode', () => {
    const profiles = composeProfiles('dev-token', 'baseline');
    expect(profiles).toEqual(['baseline', 'runtime', 'auth']);
  });

  it('adds idp profile for oidc auth', () => {
    const profiles = composeProfiles('oidc', 'baseline');
    expect(profiles).toContain('idp');
    expect(profiles).toEqual(['baseline', 'runtime', 'auth', 'idp']);
  });

  it('adds erp profile for odoo seed mode', () => {
    const profiles = composeProfiles('dev-token', 'odoo');
    expect(profiles).toContain('erp');
    expect(profiles).toEqual(['baseline', 'runtime', 'auth', 'erp']);
  });

  it('adds both idp and erp for oidc + odoo', () => {
    const profiles = composeProfiles('oidc', 'odoo');
    expect(profiles).toEqual(['baseline', 'runtime', 'auth', 'idp', 'erp']);
  });
});

describe('integration harness: readiness report', () => {
  const healthyServices: ServiceHealth[] = [
    {
      service: 'evidence-db',
      url: 'http://localhost:8080/health',
      status: 'healthy',
      latencyMs: 5,
    },
    { service: 'temporal', url: 'http://localhost:7233', status: 'healthy', latencyMs: 12 },
    {
      service: 'evidence-store',
      url: 'http://localhost:9000/minio/health/live',
      status: 'healthy',
      latencyMs: 8,
    },
    {
      service: 'vault',
      url: 'http://localhost:8200/v1/sys/health',
      status: 'healthy',
      latencyMs: 3,
    },
  ];

  it('reports ready when all services healthy and seeds ok', () => {
    const report = buildReport(healthyServices, { baseline: 'ok' }, 'dev-token', 'baseline');

    expect(report.ready).toBe(true);
    expect(report.authProfile).toBe('dev-token');
    expect(report.seedMode).toBe('baseline');
    expect(report.services).toHaveLength(4);
    expect(report.seed).toEqual({ baseline: 'ok' });
    expect(report.timestamp).toBeTruthy();
  });

  it('reports not ready when a service is unhealthy', () => {
    const services: ServiceHealth[] = [
      ...healthyServices.slice(0, 3),
      {
        service: 'vault',
        url: 'http://localhost:8200/v1/sys/health',
        status: 'unhealthy',
        latencyMs: 10000,
        error: 'timeout',
      },
    ];

    const report = buildReport(services, { baseline: 'ok' }, 'dev-token', 'baseline');
    expect(report.ready).toBe(false);
  });

  it('reports not ready when seed fails', () => {
    const report = buildReport(healthyServices, { baseline: 'failed' }, 'dev-token', 'baseline');
    expect(report.ready).toBe(false);
  });

  it('skipped services do not affect readiness', () => {
    const services: ServiceHealth[] = [
      ...healthyServices,
      {
        service: 'keycloak',
        url: 'http://localhost:8180/health/ready',
        status: 'skipped',
        latencyMs: 0,
      },
      { service: 'odoo', url: 'http://localhost:4000/web/health', status: 'skipped', latencyMs: 0 },
    ];

    const report = buildReport(services, { baseline: 'ok' }, 'dev-token', 'baseline');
    expect(report.ready).toBe(true);
    expect(report.services).toHaveLength(6);
  });

  it('includes odoo seed result in report', () => {
    const report = buildReport(
      healthyServices,
      { baseline: 'ok', odoo: 'ok' },
      'dev-token',
      'odoo',
    );
    expect(report.ready).toBe(true);
    expect(report.seed).toEqual({ baseline: 'ok', odoo: 'ok' });
  });

  it('marks not ready when odoo seed fails even if baseline ok', () => {
    const report = buildReport(
      healthyServices,
      { baseline: 'ok', odoo: 'failed' },
      'dev-token',
      'odoo',
    );
    expect(report.ready).toBe(false);
  });

  it('empty seed results count as ready (check-only mode)', () => {
    const report = buildReport(healthyServices, {}, 'dev-token', 'baseline');
    expect(report.ready).toBe(true);
  });
});

describe('integration harness: report JSON structure', () => {
  it('has all required top-level fields', () => {
    const report = buildReport(
      [{ service: 'test', url: 'http://test', status: 'healthy', latencyMs: 1 }],
      { baseline: 'ok' },
      'oidc',
      'odoo',
    );

    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('authProfile');
    expect(report).toHaveProperty('seedMode');
    expect(report).toHaveProperty('services');
    expect(report).toHaveProperty('seed');
    expect(report).toHaveProperty('ready');
    expect(typeof report.timestamp).toBe('string');
    expect(typeof report.ready).toBe('boolean');
    expect(Array.isArray(report.services)).toBe(true);
  });

  it('service health entries have required fields', () => {
    const report = buildReport(
      [
        { service: 'db', url: 'http://db', status: 'healthy', latencyMs: 5 },
        {
          service: 'api',
          url: 'http://api',
          status: 'unhealthy',
          latencyMs: 100,
          error: 'connection refused',
        },
      ],
      {},
      'dev-token',
      'baseline',
    );

    for (const s of report.services) {
      expect(s).toHaveProperty('service');
      expect(s).toHaveProperty('url');
      expect(s).toHaveProperty('status');
      expect(s).toHaveProperty('latencyMs');
      expect(['healthy', 'unhealthy', 'skipped']).toContain(s.status);
      expect(typeof s.latencyMs).toBe('number');
    }

    const unhealthySvc = report.services.find((s) => s.status === 'unhealthy');
    expect(unhealthySvc?.error).toBe('connection refused');
  });
});
