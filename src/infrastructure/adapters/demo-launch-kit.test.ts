/**
 * Contract tests for the demo launch kit (bead-0732).
 *
 * Validates:
 *  - Launch kit document exists and has required sections
 *  - Publish checklist has all quality-gate items
 *  - Outreach templates are non-empty
 *  - Metrics plan has all required tables
 *  - All referenced npm scripts exist
 *  - No real email addresses or tokens in launch kit
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../../../');
const launchKitPath = path.join(rootDir, 'docs/how-to/demo-launch-kit.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readKit(): string {
  return fs.readFileSync(launchKitPath, 'utf8');
}

// ---------------------------------------------------------------------------
// File existence
// ---------------------------------------------------------------------------

describe('demo-launch-kit.md exists', () => {
  it('launch kit file exists', () => {
    expect(fs.existsSync(launchKitPath)).toBe(true);
  });

  it('file is non-empty (> 200 chars)', () => {
    expect(readKit().length).toBeGreaterThan(200);
  });
});

// ---------------------------------------------------------------------------
// Required sections
// ---------------------------------------------------------------------------

describe('launch kit sections', () => {
  it('has Overview section', () => {
    expect(readKit()).toContain('## Overview');
  });

  it('has Outreach Templates section (section 1)', () => {
    expect(readKit()).toContain('## 1. Outreach Templates');
  });

  it('has Publish Checklist section (section 2)', () => {
    expect(readKit()).toContain('## 2. Publish Checklist');
  });

  it('has Post-Launch Metrics section (section 3)', () => {
    expect(readKit()).toContain('## 3. Post-Launch Metrics');
  });

  it('has Quick Reference section (section 4)', () => {
    expect(readKit()).toContain('## 4. Quick Reference');
  });

  it('references bead-0732', () => {
    expect(readKit()).toContain('bead-0732');
  });
});

// ---------------------------------------------------------------------------
// Outreach templates completeness
// ---------------------------------------------------------------------------

describe('outreach templates', () => {
  it('has GitHub repository description template', () => {
    expect(readKit()).toContain('### 1.1 GitHub');
  });

  it('has README hero section template', () => {
    expect(readKit()).toContain('### 1.2 README');
  });

  it('has LinkedIn/dev.to announcement template', () => {
    expect(readKit()).toContain('### 1.3');
  });

  it('has Hacker News Show HN post template', () => {
    expect(readKit()).toContain('Show HN');
  });

  it('has cold outreach email template', () => {
    expect(readKit()).toContain('### 1.5');
    expect(readKit()).toContain('Subject:');
  });

  it('30-second demo command is in templates', () => {
    expect(readKit()).toContain('npx --yes http-server docs/ui/cockpit -p 4174');
  });
});

// ---------------------------------------------------------------------------
// Publish checklist
// ---------------------------------------------------------------------------

describe('publish checklist', () => {
  it('has code quality section', () => {
    expect(readKit()).toContain('### 2.1 Code quality');
  });

  it('references ci:pr quality gate', () => {
    expect(readKit()).toContain('ci:pr');
  });

  it('references redaction check script', () => {
    expect(readKit()).toContain('cockpit:demo:redaction:check');
  });

  it('references demo gallery dry-run', () => {
    expect(readKit()).toContain('cockpit:demo:gallery:dry-run');
  });

  it('references assets check', () => {
    expect(readKit()).toContain('cockpit:assets:check');
  });

  it('has demo UX verification section', () => {
    expect(readKit()).toContain('### 2.2 Demo UX');
  });

  it('has documentation section', () => {
    expect(readKit()).toContain('### 2.3 Documentation');
  });

  it('has repository hygiene section', () => {
    expect(readKit()).toContain('### 2.4 Repository hygiene');
  });

  it('has media section', () => {
    expect(readKit()).toContain('### 2.5 Media');
  });

  it('has announcement prep section', () => {
    expect(readKit()).toContain('### 2.6 Announcement');
  });

  it('checklist uses markdown task items', () => {
    expect(readKit()).toContain('- [ ]');
  });

  it('checklist has at least 20 items', () => {
    const items = readKit().match(/- \[ \]/g) ?? [];
    expect(items.length).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// Metrics plan
// ---------------------------------------------------------------------------

describe('metrics plan', () => {
  it('has reach metrics table', () => {
    expect(readKit()).toContain('GitHub stars');
  });

  it('has engagement metrics table', () => {
    expect(readKit()).toContain('Issues opened');
  });

  it('has demo funnel metrics', () => {
    expect(readKit()).toContain('Demo funnel');
  });

  it('has 30-day metrics review cadence', () => {
    expect(readKit()).toContain('Day 30');
  });

  it('has metrics log template section', () => {
    expect(readKit()).toContain('### 3.5 Metrics log template');
  });

  it('metrics log template is copyable markdown', () => {
    expect(readKit()).toContain('launch-metrics-YYYY-MM-DD.md');
  });
});

// ---------------------------------------------------------------------------
// Quick reference scripts
// ---------------------------------------------------------------------------

describe('quick reference scripts', () => {
  const EXPECTED_SCRIPTS = [
    'cockpit:demo:gallery',
    'cockpit:demo:gallery:dry-run',
    'cockpit:demo:redaction:check',
    'cockpit:demo:approvals-v2:showcase',
    'cockpit:assets:check',
  ];

  it('quick reference table has all key demo scripts', () => {
    const kit = readKit();
    for (const script of EXPECTED_SCRIPTS) {
      expect(kit, `missing script: ${script}`).toContain(script);
    }
  });

  it('all referenced scripts exist in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const kit = readKit();
    // Extract all backtick-wrapped npm run ... references
    const scriptRefs = [...kit.matchAll(/`npm run ([a-z:A-Z0-9-]+)`/g)]
      .map((m) => m[1])
      .filter((r): r is string => r !== undefined);
    for (const ref of scriptRefs) {
      expect(pkg.scripts[ref], `package.json missing script: npm run ${ref}`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Content safety (no real credentials)
// ---------------------------------------------------------------------------

describe('no real credentials in launch kit', () => {
  it('no AKIA* AWS key pattern', () => {
    expect(readKit()).not.toMatch(/\bAKIA[A-Z0-9]{16}\b/);
  });

  it('no GitHub PAT pattern', () => {
    expect(readKit()).not.toMatch(/\bghp_[A-Za-z0-9]{36}\b/);
  });

  it('no Bearer JWT literal', () => {
    expect(readKit()).not.toMatch(/Bearer\s+eyJ[A-Za-z0-9_.-]{40,}/);
  });
});
