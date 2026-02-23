/**
 * Contract tests for the Hello Governed Workflow tutorial and role-based
 * onboarding tracks (bead-0744).
 *
 * Validates that:
 * - hello-governed-workflow.md uses npm run dev:all + npm run dev:seed (not seed:local)
 * - hello-governed-workflow.md uses npm run test (not npx vitest run)
 * - hello-governed-workflow.md specifies Node.js >= 22
 * - sre-track.md uses npm run test (not npx vitest run)
 * - onboarding tracks exist and are linked from docs/index.md
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

function readDoc(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

// ---------------------------------------------------------------------------
// hello-governed-workflow.md
// ---------------------------------------------------------------------------

describe('hello-governed-workflow.md — bootstrap commands', () => {
  it('exists', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs/tutorials/hello-governed-workflow.md'))).toBe(
      true,
    );
  });

  it('uses npm run dev:all to start the stack (not seed:local)', () => {
    const doc = readDoc('docs/tutorials/hello-governed-workflow.md');
    expect(doc).toContain('npm run dev:all');
  });

  it('uses npm run dev:seed to seed demo data', () => {
    const doc = readDoc('docs/tutorials/hello-governed-workflow.md');
    expect(doc).toContain('npm run dev:seed');
  });

  it('does not reference seed:local as the bootstrap command', () => {
    const doc = readDoc('docs/tutorials/hello-governed-workflow.md');
    // seed:local must not appear as a bootstrap step
    // (it may appear in the seed script itself but not as the tutorial command)
    expect(doc).not.toContain('npm run seed:local');
  });

  it('uses npm run test (not npx vitest run) for smoke test', () => {
    const doc = readDoc('docs/tutorials/hello-governed-workflow.md');
    expect(doc).toContain('npm run test');
    expect(doc).not.toContain('npx vitest run');
  });

  it('specifies Node.js >= 22 (not 18)', () => {
    const doc = readDoc('docs/tutorials/hello-governed-workflow.md');
    expect(doc).toContain('22');
    expect(doc).not.toContain('≥ 18');
  });

  it('references governed-run-smoke.test.ts for verification', () => {
    const doc = readDoc('docs/tutorials/hello-governed-workflow.md');
    expect(doc).toContain('governed-run-smoke.test.ts');
  });

  it('links to role-based onboarding tracks', () => {
    const doc = readDoc('docs/tutorials/hello-governed-workflow.md');
    expect(doc).toContain('dev-track.md');
    expect(doc).toContain('sre-track.md');
    expect(doc).toContain('secops-track.md');
  });
});

// ---------------------------------------------------------------------------
// Onboarding tracks exist
// ---------------------------------------------------------------------------

describe('onboarding tracks — file presence', () => {
  it('dev-track.md exists', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs/onboarding/dev-track.md'))).toBe(true);
  });

  it('sre-track.md exists', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs/onboarding/sre-track.md'))).toBe(true);
  });

  it('secops-track.md exists', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs/onboarding/secops-track.md'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sre-track.md — updated commands
// ---------------------------------------------------------------------------

describe('sre-track.md — npm scripts', () => {
  it('uses npm run test (not npx vitest run)', () => {
    const doc = readDoc('docs/onboarding/sre-track.md');
    expect(doc).toContain('npm run test');
    expect(doc).not.toContain('npx vitest run');
  });
});

// ---------------------------------------------------------------------------
// docs/index.md discoverability
// ---------------------------------------------------------------------------

describe('docs/index.md — tutorial navigation', () => {
  it('links to hello-governed-workflow.md', () => {
    const doc = readDoc('docs/index.md');
    expect(doc).toContain('hello-governed-workflow.md');
  });

  it('links to dev-track.md', () => {
    const doc = readDoc('docs/index.md');
    expect(doc).toContain('dev-track.md');
  });

  it('links to sre-track.md', () => {
    const doc = readDoc('docs/index.md');
    expect(doc).toContain('sre-track.md');
  });

  it('links to secops-track.md', () => {
    const doc = readDoc('docs/index.md');
    expect(doc).toContain('secops-track.md');
  });
});
