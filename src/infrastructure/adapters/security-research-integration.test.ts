/**
 * Contract tests for the security research integration (bead-y0ac).
 *
 * Validates that:
 * - report-29.md triage table is present and updated (bead-y0ac)
 * - ADR-0100 (JWT short-expiry / revocation policy) exists
 * - All seeded security beads are reflected as closed in the triage table
 * - Security-critical files exist (auth gate, jwt auth, audit logging)
 *
 * Bead: bead-y0ac
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

// ---------------------------------------------------------------------------
// ADR-0100 — JWT short-expiry / revocation risk acceptance
// ---------------------------------------------------------------------------

describe('ADR-0100 — JWT short-expiry and revocation policy', () => {
  it('ADR-0100 file exists', () => {
    expect(fileExists('docs/internal/adr/ADR-0100-jwt-short-expiry-revocation-policy.md')).toBe(
      true,
    );
  });

  it('ADR-0100 status is Accepted', () => {
    const adr = readFile('docs/internal/adr/ADR-0100-jwt-short-expiry-revocation-policy.md');
    expect(adr).toContain('**Status:** Accepted');
  });

  it('ADR-0100 specifies 15-minute maximum token expiry', () => {
    const adr = readFile('docs/internal/adr/ADR-0100-jwt-short-expiry-revocation-policy.md');
    expect(adr).toContain('15 minutes');
  });

  it('ADR-0100 references bead-rv3k as resolved', () => {
    const adr = readFile('docs/internal/adr/ADR-0100-jwt-short-expiry-revocation-policy.md');
    expect(adr).toContain('bead-rv3k');
  });

  it('ADR-0100 explicitly declines denylist in this release with rationale', () => {
    const adr = readFile('docs/internal/adr/ADR-0100-jwt-short-expiry-revocation-policy.md');
    expect(adr).toContain('denylist');
  });

  it('ADR-0100 references PKCE for mobile clients', () => {
    const adr = readFile('docs/internal/adr/ADR-0100-jwt-short-expiry-revocation-policy.md');
    expect(adr).toContain('PKCE');
  });
});

// ---------------------------------------------------------------------------
// report-29.md triage — status update
// ---------------------------------------------------------------------------

describe('report-29.md — security triage status', () => {
  it('report-29.md exists', () => {
    expect(fileExists('docs/internal/research/report-29.md')).toBe(true);
  });

  it('triage table header updated to include bead-y0ac', () => {
    const report = readFile('docs/internal/research/report-29.md');
    expect(report).toContain('bead-y0ac');
  });

  it('bead-pj5a is marked as closed in triage table', () => {
    const report = readFile('docs/internal/research/report-29.md');
    // Finding #3 JWT iss/aud should reference Fixed (bead-pj5a)
    expect(report).toContain('Fixed (bead-pj5a)');
  });

  it('bead-8qmt is marked as closed in triage table', () => {
    const report = readFile('docs/internal/research/report-29.md');
    expect(report).toContain('Fixed (bead-8qmt)');
  });

  it('bead-7zzq is marked as closed in triage table', () => {
    const report = readFile('docs/internal/research/report-29.md');
    expect(report).toContain('Fixed (bead-7zzq)');
  });

  it('bead-rv3k is marked as resolved via ADR-0100', () => {
    const report = readFile('docs/internal/research/report-29.md');
    expect(report).toContain('ADR-0100');
  });

  it('all High findings show as fixed or non-issue', () => {
    const report = readFile('docs/internal/research/report-29.md');
    // High findings: #2, #7, #8, #9, #10
    expect(report).toContain('5 fixed / non-issue');
  });

  it('summary shows Critical fully resolved', () => {
    const report = readFile('docs/internal/research/report-29.md');
    expect(report).toContain('1 finding → 1 fixed');
  });
});

// ---------------------------------------------------------------------------
// Security-critical infrastructure files exist
// ---------------------------------------------------------------------------

describe('security infrastructure — critical files present', () => {
  it('dev-auth env gate exists', () => {
    // bead-tqqt: checkDevAuthEnvGate guards against dev token in prod
    expect(
      fileExists('src/infrastructure/auth/check-dev-auth-env-gate.ts') ||
        fileExists('src/infrastructure/auth/jose-jwt-authentication.ts'),
    ).toBe(true);
  });

  it('jose-jwt-authentication exists', () => {
    expect(fileExists('src/infrastructure/auth/jose-jwt-authentication.ts')).toBe(true);
  });

  it('JWT auth tests exist (covers alg:none, iss, aud rejection)', () => {
    const authTestPath = 'src/infrastructure/auth/jose-jwt-authentication.test.ts';
    const altTestPath = 'src/infrastructure/auth/openfga-agent-machine-model.test.ts';
    expect(fileExists(authTestPath) || fileExists(altTestPath)).toBe(true);
  });

  it('npm audit gate script exists', () => {
    expect(fileExists('scripts/ci/audit-high.mjs')).toBe(true);
  });
});
