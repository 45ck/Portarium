/**
 * Contract tests for the integration ladder documentation (bead-0705).
 *
 * Validates that the integration ladder doc and demo walkthrough:
 * - Exist at the expected paths
 * - Cover all four levels (L0–L3)
 * - Reference correct npm scripts (not outdated manual commands)
 * - Are linked from docs/index.md
 * - Do not reference removed demo-secret token
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
  return path.resolve(__dirname, '../../../..');
}

const REPO_ROOT = findRepoRoot(__dirname);

function readDoc(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

// ---------------------------------------------------------------------------
// Integration ladder document
// ---------------------------------------------------------------------------

describe('integration-ladder.md — structure', () => {
  it('exists at docs/integration/integration-ladder.md', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs/integration/integration-ladder.md'))).toBe(
      true,
    );
  });

  it('defines all four maturity levels (L0–L3)', () => {
    const doc = readDoc('docs/integration/integration-ladder.md');
    expect(doc).toContain('Level 0');
    expect(doc).toContain('Level 1');
    expect(doc).toContain('Level 2');
    expect(doc).toContain('Level 3');
  });

  it('specifies acceptance criteria for each level', () => {
    const doc = readDoc('docs/integration/integration-ladder.md');
    expect(doc).toContain('Acceptance');
    expect(doc).toContain('npm run ci:pr');
  });

  it('references npm run test (not raw vitest invocation)', () => {
    const doc = readDoc('docs/integration/integration-ladder.md');
    expect(doc).toContain('npm run test');
  });
});

// ---------------------------------------------------------------------------
// Demo walkthrough document
// ---------------------------------------------------------------------------

describe('demo-walkthrough.md — structure', () => {
  it('exists at docs/integration/demo-walkthrough.md', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs/integration/demo-walkthrough.md'))).toBe(true);
  });

  it('uses npm run dev:all to start the stack (not docker compose up directly)', () => {
    const doc = readDoc('docs/integration/demo-walkthrough.md');
    expect(doc).toContain('npm run dev:all');
  });

  it('references portarium-dev-token (not demo-secret)', () => {
    const doc = readDoc('docs/integration/demo-walkthrough.md');
    expect(doc).not.toContain('demo-secret');
    expect(doc).toContain('portarium-dev-token');
  });

  it('covers all four integration ladder levels', () => {
    const doc = readDoc('docs/integration/demo-walkthrough.md');
    expect(doc).toContain('Level 0');
    expect(doc).toContain('Level 1');
    expect(doc).toContain('Level 2');
    expect(doc).toContain('Level 3');
  });

  it('references governed-run smoke test for L3', () => {
    const doc = readDoc('docs/integration/demo-walkthrough.md');
    expect(doc).toContain('governed-run-smoke.test.ts');
  });

  it('links to the integration-ladder document', () => {
    const doc = readDoc('docs/integration/demo-walkthrough.md');
    expect(doc).toContain('integration-ladder');
  });
});

// ---------------------------------------------------------------------------
// docs/index.md discoverability
// ---------------------------------------------------------------------------

describe('docs/index.md — integration docs navigation', () => {
  it('links to integration-ladder.md', () => {
    const doc = readDoc('docs/index.md');
    expect(doc).toContain('integration-ladder.md');
  });

  it('links to demo-walkthrough.md', () => {
    const doc = readDoc('docs/index.md');
    expect(doc).toContain('demo-walkthrough.md');
  });

  it('has an integration-focused navigation section', () => {
    const doc = readDoc('docs/index.md');
    expect(doc).toMatch(/integration/i);
  });
});
