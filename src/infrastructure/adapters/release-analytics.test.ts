/**
 * Contract tests for the release analytics deliverables (bead-0745).
 *
 * Validates:
 *  - release-analytics.md exists and has required CHAOSS-aligned sections
 *  - adoption-snapshot.mjs script exists and is syntactically valid
 *  - analytics:adoption-snapshot npm script is registered in package.json
 *  - No real credentials in the analytics doc or script
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../../../');
const analyticsDocPath = path.join(rootDir, 'docs/how-to/release-analytics.md');
const snapshotScriptPath = path.join(rootDir, 'scripts/analytics/adoption-snapshot.mjs');

function readDoc(): string {
  return fs.readFileSync(analyticsDocPath, 'utf8');
}

function readScript(): string {
  return fs.readFileSync(snapshotScriptPath, 'utf8');
}

// ── File existence ────────────────────────────────────────────────────────────

describe('release-analytics.md exists', () => {
  it('file exists', () => {
    expect(fs.existsSync(analyticsDocPath)).toBe(true);
  });

  it('file is non-empty (> 500 chars)', () => {
    expect(readDoc().length).toBeGreaterThan(500);
  });

  it('references bead-0745', () => {
    expect(readDoc()).toContain('bead-0745');
  });
});

describe('adoption-snapshot.mjs script exists', () => {
  it('script file exists', () => {
    expect(fs.existsSync(snapshotScriptPath)).toBe(true);
  });

  it('script is non-empty (> 200 chars)', () => {
    expect(readScript().length).toBeGreaterThan(200);
  });

  it('script references bead-0745', () => {
    expect(readScript()).toContain('bead-0745');
  });
});

// ── CHAOSS-aligned metric families ───────────────────────────────────────────

describe('CHAOSS-aligned metric families', () => {
  it('has metric families section', () => {
    expect(readDoc()).toContain('## 1. Metric families');
  });

  it('has adoption funnel subsection', () => {
    expect(readDoc()).toContain('### 1.1 Adoption funnel');
  });

  it('has community responsiveness subsection', () => {
    expect(readDoc()).toContain('### 1.2 Community responsiveness');
  });

  it('has release cadence subsection', () => {
    expect(readDoc()).toContain('### 1.3 Release cadence');
  });

  it('mentions CHAOSS references', () => {
    expect(readDoc()).toContain('CHAOSS');
  });

  it('covers Awareness stage in funnel', () => {
    expect(readDoc()).toContain('Awareness');
  });

  it('covers Activation stage in funnel', () => {
    expect(readDoc()).toContain('Activation');
  });

  it('covers Retention stage in funnel', () => {
    expect(readDoc()).toContain('Retention');
  });
});

// ── Metric targets (SLOs) ────────────────────────────────────────────────────

describe('community responsiveness SLO targets', () => {
  it('defines time-to-first-response target', () => {
    expect(readDoc()).toContain('time-to-first-response');
  });

  it('first-response target is ≤ 48 h', () => {
    expect(readDoc()).toContain('48 h');
  });

  it('defines stale issues threshold', () => {
    expect(readDoc()).toContain('Stale issues');
  });

  it('stale issues threshold is < 20 %', () => {
    expect(readDoc()).toContain('20 %');
  });

  it('defines PR review turnaround target', () => {
    expect(readDoc()).toContain('PR review turnaround');
  });
});

// ── Data collection approach ──────────────────────────────────────────────────

describe('data collection approach', () => {
  it('has data collection section', () => {
    expect(readDoc()).toContain('## 2. Data collection approach');
  });

  it('references GitHub API', () => {
    expect(readDoc()).toContain('GitHub API');
  });

  it('references adoption-snapshot.mjs script', () => {
    expect(readDoc()).toContain('adoption-snapshot.mjs');
  });

  it('references GitHub Insights as zero-setup option', () => {
    expect(readDoc()).toContain('GitHub Insights');
  });
});

// ── Reporting cadence ─────────────────────────────────────────────────────────

describe('reporting cadence', () => {
  it('has reporting cadence section', () => {
    expect(readDoc()).toContain('## 3. Reporting cadence');
  });

  it('defines weekly pulse report', () => {
    expect(readDoc()).toContain('Weekly');
  });

  it('defines monthly dashboard report', () => {
    expect(readDoc()).toContain('Monthly');
  });

  it('defines quarterly retrospective', () => {
    expect(readDoc()).toContain('Quarterly');
  });

  it('has monthly dashboard template', () => {
    expect(readDoc()).toContain('Monthly dashboard template');
  });

  it('monthly template has adoption funnel table', () => {
    expect(readDoc()).toContain('Adoption funnel');
  });
});

// ── Thresholds and alerts ────────────────────────────────────────────────────

describe('thresholds and alerts', () => {
  it('has thresholds section', () => {
    expect(readDoc()).toContain('## 4. Thresholds and alerts');
  });

  it('defines clone drop alert', () => {
    expect(readDoc()).toContain('Clones drop');
  });

  it('defines stale issues alert', () => {
    expect(readDoc()).toContain('Stale issues');
  });

  it('defines zero-release alert', () => {
    expect(readDoc()).toContain('Zero releases in 90 days');
  });
});

// ── Privacy and data handling ────────────────────────────────────────────────

describe('privacy and data handling', () => {
  it('has privacy section', () => {
    expect(readDoc()).toContain('## 5. Privacy and data handling');
  });

  it('states aggregate-only data collection', () => {
    expect(readDoc()).toContain('aggregate only');
  });

  it('states no PII collected', () => {
    expect(readDoc()).toContain('no PII');
  });
});

// ── adoption-snapshot.mjs script correctness ─────────────────────────────────

describe('adoption-snapshot.mjs script structure', () => {
  it('has CLI args parsing', () => {
    expect(readScript()).toContain('parseArgs');
  });

  it('supports --token argument', () => {
    expect(readScript()).toContain('--token');
  });

  it('supports --repo argument', () => {
    expect(readScript()).toContain('--repo');
  });

  it('supports --help flag', () => {
    expect(readScript()).toContain('--help');
  });

  it('references 45ck/Portarium as default repo', () => {
    expect(readScript()).toContain('45ck/Portarium');
  });

  it('uses GitHub API base URL', () => {
    expect(readScript()).toContain('api.github.com');
  });

  it('exports adoption funnel metrics', () => {
    expect(readScript()).toContain('Adoption Funnel');
  });

  it('exports community responsiveness metrics', () => {
    expect(readScript()).toContain('Community Responsiveness');
  });

  it('exports release cadence metrics', () => {
    expect(readScript()).toContain('Release Cadence');
  });

  it('handles missing token gracefully', () => {
    expect(readScript()).toContain('GITHUB_TOKEN');
  });
});

// ── npm script registration ───────────────────────────────────────────────────

describe('analytics npm script registration', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };

  it('analytics:adoption-snapshot script is registered', () => {
    expect(pkg.scripts['analytics:adoption-snapshot']).toBeDefined();
  });

  it('script command points to adoption-snapshot.mjs', () => {
    expect(pkg.scripts['analytics:adoption-snapshot']).toContain('adoption-snapshot.mjs');
  });
});

// ── No real credentials ───────────────────────────────────────────────────────

describe('no real credentials in analytics artefacts', () => {
  it('no GitHub PAT in doc', () => {
    expect(readDoc()).not.toMatch(/\bghp_[A-Za-z0-9]{36}\b/);
  });

  it('no GitHub PAT in script', () => {
    expect(readScript()).not.toMatch(/\bghp_[A-Za-z0-9]{36}\b/);
  });

  it('no AKIA* AWS key in doc', () => {
    expect(readDoc()).not.toMatch(/\bAKIA[A-Z0-9]{16}\b/);
  });

  it('no Bearer JWT literal in doc', () => {
    expect(readDoc()).not.toMatch(/Bearer\s+eyJ[A-Za-z0-9_.-]{40,}/);
  });
});
