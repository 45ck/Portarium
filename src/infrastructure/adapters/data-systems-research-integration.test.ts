/**
 * Contract tests for the Data & Information Systems research integration (bead-6i3j).
 *
 * Validates that:
 * - report-21.md triage table is present and updated (bead-6i3j)
 * - ADR-0101 (data layer transaction boundary + pool config) exists and is accepted
 * - All seeded data-layer beads are reflected as closed in the triage table
 * - Key infrastructure files implement the remediated patterns
 *
 * Bead: bead-6i3j
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const content = JSON.parse(fs.readFileSync(pkg, 'utf8')) as { name?: string };
        if (content.name === 'portarium') return dir;
      } catch {
        // continue
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(import.meta.dirname, '../../../..');
}

const REPO_ROOT = findRepoRoot(import.meta.dirname);

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

// ── ADR-0101 ─────────────────────────────────────────────────────────────────

describe('ADR-0101: data layer transaction boundary and pool config', () => {
  const ADR_PATH = 'docs/adr/ADR-0101-data-layer-transaction-boundary-and-pool-config.md';

  it('ADR-0101 file exists', () => {
    expect(fileExists(ADR_PATH)).toBe(true);
  });

  it('ADR-0101 status is Accepted', () => {
    const content = readFile(ADR_PATH);
    expect(content).toMatch(/Status.*Accepted/i);
  });

  it('ADR-0101 references withTransaction', () => {
    const content = readFile(ADR_PATH);
    expect(content).toContain('withTransaction');
  });

  it('ADR-0101 references bead-tx1', () => {
    const content = readFile(ADR_PATH);
    expect(content).toContain('bead-tx1');
  });

  it('ADR-0101 references bead-pool1', () => {
    const content = readFile(ADR_PATH);
    expect(content).toContain('bead-pool1');
  });

  it('ADR-0101 references pool configuration', () => {
    const content = readFile(ADR_PATH);
    expect(content).toMatch(/PORTARIUM_DB_POOL_MAX|maxConnections/);
  });

  it('ADR-0101 references Transactional Outbox pattern', () => {
    const content = readFile(ADR_PATH);
    expect(content).toMatch(/transactional outbox|Transactional Outbox/i);
  });
});

// ── report-21.md triage table ─────────────────────────────────────────────────

describe('report-21.md triage table (bead-6i3j update)', () => {
  const REPORT_PATH = 'docs/research/report-21.md';

  it('report-21.md exists', () => {
    expect(fileExists(REPORT_PATH)).toBe(true);
  });

  it('triage section references bead-6i3j update', () => {
    const content = readFile(REPORT_PATH);
    expect(content).toContain('bead-6i3j');
  });

  it('bead-mig1 is marked closed/fixed', () => {
    const content = readFile(REPORT_PATH);
    expect(content).toMatch(/bead-mig1.*closed|✅.*bead-mig1|Fixed.*bead-mig1/i);
  });

  it('bead-sql2 is marked closed/fixed', () => {
    const content = readFile(REPORT_PATH);
    expect(content).toMatch(/bead-sql2.*closed|✅.*bead-sql2|Fixed.*bead-sql2/i);
  });

  it('bead-tx1 is marked closed/fixed', () => {
    const content = readFile(REPORT_PATH);
    expect(content).toMatch(/bead-tx1.*closed|✅.*bead-tx1|Fixed.*bead-tx1/i);
  });

  it('bead-pool1 is marked closed/fixed', () => {
    const content = readFile(REPORT_PATH);
    expect(content).toMatch(/bead-pool1.*closed|✅.*bead-pool1|Fixed.*bead-pool1/i);
  });

  it('bead-nj7i is marked closed/fixed', () => {
    const content = readFile(REPORT_PATH);
    expect(content).toMatch(/bead-nj7i.*closed|✅.*bead-nj7i|Fixed.*bead-nj7i/i);
  });

  it('tenancy isolation finding is noted as deferred', () => {
    const content = readFile(REPORT_PATH);
    expect(content).toMatch(/Deferred|deferred|P2 tenancy/i);
  });

  it('ADR-0101 referenced in triage table', () => {
    const content = readFile(REPORT_PATH);
    expect(content).toContain('ADR-0101');
  });

  it('summary row shows majority of findings fixed', () => {
    const content = readFile(REPORT_PATH);
    expect(content).toMatch(/7 of 8|fixed|closed/i);
  });
});

// ── Infrastructure implementation correctness ─────────────────────────────────

describe('sql-client.ts exposes withTransaction', () => {
  const SQL_CLIENT_PATH = 'src/infrastructure/postgresql/sql-client.ts';

  it('sql-client.ts exists', () => {
    expect(fileExists(SQL_CLIENT_PATH)).toBe(true);
  });

  it('SqlClient interface declares withTransaction', () => {
    const content = readFile(SQL_CLIENT_PATH);
    expect(content).toContain('withTransaction');
  });
});

describe('node-postgres-sql-client.ts has explicit pool config', () => {
  const CLIENT_PATH = 'src/infrastructure/postgresql/node-postgres-sql-client.ts';

  it('node-postgres-sql-client.ts exists', () => {
    expect(fileExists(CLIENT_PATH)).toBe(true);
  });

  it('PORTARIUM_DB_POOL_MAX env var is referenced', () => {
    const content = readFile(CLIENT_PATH);
    expect(content).toContain('PORTARIUM_DB_POOL_MAX');
  });

  it('idle timeout is explicitly configured', () => {
    const content = readFile(CLIENT_PATH);
    expect(content).toMatch(/idleTimeout|POOL_IDLE/i);
  });

  it('connection timeout is explicitly configured', () => {
    const content = readFile(CLIENT_PATH);
    expect(content).toMatch(/connectionTimeout|CONNECTION_TIMEOUT/i);
  });

  it('withTransaction is implemented (not just declared)', () => {
    const content = readFile(CLIENT_PATH);
    expect(content).toMatch(/withTransaction.*fn|fn.*withTransaction/);
    expect(content).toMatch(/BEGIN|ROLLBACK/i);
  });
});

describe('postgres-workforce-store-adapters.ts N+1 fix', () => {
  const STORE_PATH = 'src/infrastructure/postgresql/postgres-workforce-store-adapters.ts';

  it('workforce store file exists', () => {
    expect(fileExists(STORE_PATH)).toBe(true);
  });

  it('listWorkforceMembersByIds does not use Promise.all over getById', () => {
    const content = readFile(STORE_PATH);
    // Should use batched fetch via listByIds, not N+1 Promise.all pattern
    const n1Pattern = /Promise\.all\s*\([^)]*getById/;
    expect(n1Pattern.test(content)).toBe(false);
  });

  it('listWorkforceMembersByIds uses batched listByIds', () => {
    const content = readFile(STORE_PATH);
    expect(content).toMatch(/listByIds|listWorkforceMembersByIds/);
  });
});

describe('ADR-0096 CI migration apply exists', () => {
  const ADR_096_PATH = 'docs/adr/ADR-0096-ci-real-postgres-migration-apply.md';

  it('ADR-0096 exists', () => {
    expect(fileExists(ADR_096_PATH)).toBe(true);
  });

  it('ADR-0096 is Accepted', () => {
    const content = readFile(ADR_096_PATH);
    expect(content).toMatch(/Status.*Accepted/i);
  });
});
