/**
 * Contract tests for the first-run local integrations guide (bead-0738).
 *
 * Validates that the guide covers all four required services, has correct
 * structure, and references valid npm scripts and files.
 *
 * Bead: bead-0738
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      const content = fs.readFileSync(pkg, 'utf8');
      if (content.includes('"portarium"')) return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(import.meta.dirname, '../../../../');
}

const REPO_ROOT = findRepoRoot(import.meta.dirname);
const GUIDE_PATH = path.join(REPO_ROOT, 'docs/how-to/first-run-local-integrations.md');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const DOCKER_COMPOSE_PATH = path.join(REPO_ROOT, 'docker-compose.local.yml');

function readGuide(): string {
  return fs.readFileSync(GUIDE_PATH, 'utf8');
}

function readPackageJson(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// File presence
// ---------------------------------------------------------------------------

describe('first-run guide — file presence', () => {
  it('guide file exists', () => {
    expect(fs.existsSync(GUIDE_PATH)).toBe(true);
  });

  it('docker-compose.local.yml exists', () => {
    expect(fs.existsSync(DOCKER_COMPOSE_PATH)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Guide structure
// ---------------------------------------------------------------------------

describe('first-run guide — structure', () => {
  it('has a title heading', () => {
    expect(readGuide()).toMatch(/^# First-Run Guide/m);
  });

  it('has prerequisites section', () => {
    expect(readGuide()).toContain('## Prerequisites');
  });

  it('has a next steps section', () => {
    expect(readGuide()).toContain('## ');
    expect(readGuide()).toContain('Next steps');
  });

  it('has environment variables reference', () => {
    expect(readGuide()).toContain('Environment variables');
  });

  it('has stop/reset instructions', () => {
    expect(readGuide()).toContain('docker compose');
    expect(readGuide()).toContain('down');
  });
});

// ---------------------------------------------------------------------------
// Service coverage — all four required services
// ---------------------------------------------------------------------------

describe('first-run guide — service coverage', () => {
  it('covers Keycloak', () => {
    expect(readGuide()).toContain('Keycloak');
  });

  it('covers OpenFGA', () => {
    expect(readGuide()).toContain('OpenFGA');
  });

  it('covers Odoo', () => {
    expect(readGuide()).toContain('Odoo');
  });

  it('covers OpenClaw', () => {
    expect(readGuide()).toContain('OpenClaw');
  });

  it('has a section heading for each service', () => {
    const guide = readGuide();
    expect(guide).toMatch(/## \d+\. Keycloak/);
    expect(guide).toMatch(/## \d+\. OpenFGA/);
    expect(guide).toMatch(/## \d+\. Odoo/);
    expect(guide).toMatch(/## \d+\. OpenClaw/);
  });
});

// ---------------------------------------------------------------------------
// Port numbers
// ---------------------------------------------------------------------------

describe('first-run guide — port references', () => {
  it('references Keycloak on port 8080', () => {
    expect(readGuide()).toContain('8080');
  });

  it('references OpenFGA on port 8888', () => {
    expect(readGuide()).toContain('8888');
  });

  it('references Odoo on port 4000', () => {
    expect(readGuide()).toContain('4000');
  });

  it('references Portarium API on port 3000', () => {
    expect(readGuide()).toContain('3000');
  });
});

// ---------------------------------------------------------------------------
// Verify steps
// ---------------------------------------------------------------------------

describe('first-run guide — verify steps', () => {
  it('includes curl health check commands', () => {
    expect(readGuide()).toContain('curl');
    expect(readGuide()).toContain('/health');
  });

  it('includes Keycloak token endpoint verification', () => {
    expect(readGuide()).toContain('openid-connect/token');
  });

  it('includes OpenFGA store check', () => {
    expect(readGuide()).toContain('/stores');
  });

  it('includes integration smoke test command', () => {
    expect(readGuide()).toContain('GOVERNED_RUN_INTEGRATION=true');
    expect(readGuide()).toContain('governed-run-smoke.test.ts');
  });
});

// ---------------------------------------------------------------------------
// npm scripts referenced in guide
// ---------------------------------------------------------------------------

describe('first-run guide — npm script references', () => {
  it('dev:all script exists in package.json', () => {
    const pkg = readPackageJson();
    const scripts = pkg['scripts'] as Record<string, string> | undefined;
    expect(scripts?.['dev:all']).toBeDefined();
  });

  it('test script exists in package.json', () => {
    const pkg = readPackageJson();
    const scripts = pkg['scripts'] as Record<string, string> | undefined;
    expect(scripts?.['test']).toBeDefined();
  });

  it('ci:pr script exists in package.json', () => {
    const pkg = readPackageJson();
    const scripts = pkg['scripts'] as Record<string, string> | undefined;
    expect(scripts?.['ci:pr']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Troubleshooting sections
// ---------------------------------------------------------------------------

describe('first-run guide — troubleshooting', () => {
  it('has troubleshooting for each service', () => {
    const guide = readGuide();
    const sections = guide.split('### Troubleshooting');
    // Title + at least 3 service troubleshooting sections
    expect(sections.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// No credentials leak
// ---------------------------------------------------------------------------

describe('first-run guide — no real credentials', () => {
  it('does not contain AWS keys', () => {
    expect(readGuide()).not.toMatch(/AKIA[0-9A-Z]{16}/);
  });

  it('does not contain GitHub PATs', () => {
    expect(readGuide()).not.toMatch(/ghp_[A-Za-z0-9]{36}/);
  });

  it('uses only demo email domains', () => {
    const emails = readGuide().match(/[a-z.]+@[a-z.]+\.[a-z]+/g) ?? [];
    const forbidden = emails.filter(
      (e) =>
        !e.endsWith('.example.com') &&
        !e.endsWith('acme.example.com') &&
        !e.endsWith('portarium.dev') &&
        !e.endsWith('acme.com'),
    );
    expect(forbidden).toEqual([]);
  });
});
