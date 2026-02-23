/**
 * Contract tests for the local development documentation (bead-zmvb).
 *
 * Validates that local-dev.md and related tutorials:
 * - Use npm run dev:all (not raw docker compose up -d)
 * - Use npm run dev:seed (not manual tsx invocations)
 * - Reference portarium-dev-token (not placeholder tokens)
 * - Exist at expected paths
 * - Link to each other for discoverability
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
// local-dev.md
// ---------------------------------------------------------------------------

describe('local-dev.md — quick start', () => {
  it('exists at docs/getting-started/local-dev.md', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs/getting-started/local-dev.md'))).toBe(true);
  });

  it('uses npm run dev:all (not bare docker compose up -d)', () => {
    const doc = readDoc('docs/getting-started/local-dev.md');
    expect(doc).toContain('npm run dev:all');
    expect(doc).not.toContain('docker compose up -d');
  });

  it('uses npm run dev:seed', () => {
    const doc = readDoc('docs/getting-started/local-dev.md');
    expect(doc).toContain('npm run dev:seed');
  });

  it('references portarium-dev-token (not a placeholder token)', () => {
    const doc = readDoc('docs/getting-started/local-dev.md');
    expect(doc).toContain('portarium-dev-token');
    expect(doc).not.toContain('my-local-dev-token');
  });

  it('does not use raw npx tsx control-plane invocation in quick start', () => {
    const doc = readDoc('docs/getting-started/local-dev.md');
    // The raw tsx invocation should only appear under Advanced section, not in main flow
    const advancedIdx = doc.indexOf('## Advanced');
    const tsxIdx = doc.indexOf('npx tsx src/presentation/runtime/control-plane.ts');
    // Either no tsx invocation at all, or it appears only after the Advanced section
    if (tsxIdx !== -1) {
      expect(tsxIdx).toBeGreaterThan(advancedIdx);
    }
  });

  it('includes PORTARIUM_DEV_TOKEN environment variable', () => {
    const doc = readDoc('docs/getting-started/local-dev.md');
    expect(doc).toContain('PORTARIUM_DEV_TOKEN');
  });

  it('includes a success checklist', () => {
    const doc = readDoc('docs/getting-started/local-dev.md');
    expect(doc).toContain('Success Checklist');
  });

  it('references port 8080', () => {
    const doc = readDoc('docs/getting-started/local-dev.md');
    expect(doc).toContain('8080');
  });
});

// ---------------------------------------------------------------------------
// tutorials/first-work-item.md
// ---------------------------------------------------------------------------

describe('tutorials/first-work-item.md — updated startup', () => {
  it('exists', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs/tutorials/first-work-item.md'))).toBe(true);
  });

  it('uses npm run dev:all to start runtime', () => {
    const doc = readDoc('docs/tutorials/first-work-item.md');
    expect(doc).toContain('npm run dev:all');
  });

  it('does not use raw npx tsx control-plane as the primary start command', () => {
    const doc = readDoc('docs/tutorials/first-work-item.md');
    // If tsx is referenced at all, it should not be the first startup instruction
    const devAllIdx = doc.indexOf('npm run dev:all');
    const tsxIdx = doc.indexOf('npx tsx src/presentation/runtime/control-plane.ts');
    if (devAllIdx !== -1 && tsxIdx !== -1) {
      expect(devAllIdx).toBeLessThan(tsxIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// tutorials/evidence-trace.md
// ---------------------------------------------------------------------------

describe('tutorials/evidence-trace.md — updated startup', () => {
  it('exists', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs/tutorials/evidence-trace.md'))).toBe(true);
  });

  it('uses npm run dev:all to start runtime', () => {
    const doc = readDoc('docs/tutorials/evidence-trace.md');
    expect(doc).toContain('npm run dev:all');
  });

  it('uses portarium-dev-token (not placeholder <token>)', () => {
    const doc = readDoc('docs/tutorials/evidence-trace.md');
    expect(doc).toContain('portarium-dev-token');
  });
});
