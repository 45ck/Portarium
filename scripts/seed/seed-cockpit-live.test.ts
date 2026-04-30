import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readCockpitLiveSeedConfig } from './seed-cockpit-live.js';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('seed-cockpit-live config', () => {
  it('defaults to the live local workspace', () => {
    const config = readCockpitLiveSeedConfig({}, []);

    expect(config).toEqual({
      mode: 'seed',
      databaseUrl: 'postgresql://portarium:portarium@localhost:5432/portarium',
      tenantId: 'ws-local-dev',
      workspaceId: 'ws-local-dev',
    });
  });

  it('supports validate and workspace overrides', () => {
    const config = readCockpitLiveSeedConfig(
      {
        PORTARIUM_DATABASE_URL: 'postgresql://example/app',
        PORTARIUM_SEED_TENANT_ID: 'tenant-a',
        PORTARIUM_SEED_WORKSPACE_ID: 'workspace-a',
      },
      ['--validate'],
    );

    expect(config).toEqual({
      mode: 'validate',
      databaseUrl: 'postgresql://example/app',
      tenantId: 'tenant-a',
      workspaceId: 'workspace-a',
    });
  });

  it('rejects contradictory modes', () => {
    expect(() => readCockpitLiveSeedConfig({}, ['--dry-run', '--validate'])).toThrow(
      'Use either --dry-run or --validate',
    );
  });
});

describe('seed-cockpit-live dry-run CLI', () => {
  it('loads the seed bundle without requiring a database', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx/esm', 'scripts/seed/seed-cockpit-live.ts', '--dry-run'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, PORTARIUM_DATABASE_URL: '' },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"workspaceId": "ws-local-dev"');
    expect(result.stdout).toContain('"pendingApprovalId": "apr-live-001"');
    expect(result.stdout).toContain('Dry run complete');
  });
});
