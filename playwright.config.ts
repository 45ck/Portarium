import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Playwright configuration for Portarium Cockpit E2E tests.
 *
 * Tests run against the Vite dev server (MSW mock API — no live backend needed).
 * Start the dev server first: cd apps/cockpit && npx vite
 *
 * Run smoke suite:     npm run test:e2e:smoke
 * Run matrix suite:    npm run test:e2e:matrix
 * Run quarantine:      npm run test:e2e:quarantine
 *
 * Projects:
 *   Smoke projects  — chromium/firefox/webkit at desktop 1280×720 (default)
 *   Matrix projects — full cross-browser + responsive viewport grid
 *     Desktop 1920×1080: Chrome, Firefox, WebKit
 *     Tablet  768×1024:  Chrome
 *     Mobile  375×667  : Pixel 5 (Chrome)
 *     Mobile  414×896  : iPhone 13 (WebKit/Safari)
 *   Quarantine      — known-flaky tests run in isolation, don't block CI
 *
 * Bead: bead-0828, bead-0830
 * Ref: ADR-0062 §viewport-matrix, §flaky-test-policy
 */

// ---------------------------------------------------------------------------
// Quarantine list — tests with >5% flake rate are listed in quarantine.json.
// Excluded from smoke/matrix runs; run separately via test:e2e:quarantine.
// ---------------------------------------------------------------------------

interface QuarantineEntry {
  title: string;
  file: string;
  quarantinedAt: string;
  reason: string;
}

function loadQuarantinedTests(): QuarantineEntry[] {
  const quarantinePath = resolve(__dirname, 'e2e/quarantine.json');
  if (!existsSync(quarantinePath)) return [];
  try {
    const raw = readFileSync(quarantinePath, 'utf8');
    const parsed = JSON.parse(raw) as { tests?: QuarantineEntry[] };
    return parsed.tests ?? [];
  } catch {
    return [];
  }
}

const quarantinedTests = loadQuarantinedTests();

/** Build a grep-invert regex that excludes all quarantined test titles */
function buildQuarantineExclusion(): RegExp | undefined {
  if (quarantinedTests.length === 0) return undefined;
  const escaped = quarantinedTests.map((t) => t.title.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&'));
  return new RegExp(escaped.join('|'));
}

/** Build a grep regex that selects only quarantined test titles */
function buildQuarantineInclusion(): RegExp | undefined {
  if (quarantinedTests.length === 0) return /^$/; // match nothing when empty
  const escaped = quarantinedTests.map((t) => t.title.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&'));
  return new RegExp(escaped.join('|'));
}

const grepInvert = buildQuarantineExclusion();
const grepQuarantine = buildQuarantineInclusion();

// ---------------------------------------------------------------------------
// Reporters — HTML + list always; JSON when PLAYWRIGHT_JSON_OUTPUT is set
// (used by scripts/qa/analyze-flake-rates.mjs for flake tracking)
// ---------------------------------------------------------------------------

type ReporterEntry =
  | ['html', { outputFolder: string; open: string }]
  | ['list']
  | ['json', { outputFile: string }];

const reporters: ReporterEntry[] = [
  ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ['list'],
];
if (process.env['PLAYWRIGHT_JSON_OUTPUT']) {
  reporters.push(['json', { outputFile: process.env['PLAYWRIGHT_JSON_OUTPUT'] }]);
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: reporters,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // -----------------------------------------------------------------------
    // Smoke projects — used by test:e2e:smoke (excludes quarantined tests)
    // -----------------------------------------------------------------------
    {
      name: 'chromium',
      testMatch: 'e2e/smoke/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      grepInvert,
    },
    {
      name: 'firefox',
      testMatch: 'e2e/smoke/**/*.spec.ts',
      use: { ...devices['Desktop Firefox'] },
      grepInvert,
    },
    {
      name: 'webkit',
      testMatch: 'e2e/smoke/**/*.spec.ts',
      use: { ...devices['Desktop Safari'] },
      grepInvert,
    },

    // -----------------------------------------------------------------------
    // Matrix projects — used by test:e2e:matrix (nightly, excludes quarantined)
    // Desktop at 1920×1080 across all three browser engines
    // -----------------------------------------------------------------------
    {
      name: 'matrix-desktop-chrome',
      testMatch: 'e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      grepInvert,
    },
    {
      name: 'matrix-desktop-firefox',
      testMatch: 'e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
      grepInvert,
    },
    {
      name: 'matrix-desktop-webkit',
      testMatch: 'e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
      grepInvert,
    },

    // -----------------------------------------------------------------------
    // Tablet — 768×1024 (boundary between mobile and desktop layouts)
    // -----------------------------------------------------------------------
    {
      name: 'matrix-tablet-chrome',
      testMatch: 'e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        isMobile: false,
      },
      grepInvert,
    },

    // -----------------------------------------------------------------------
    // Mobile — Pixel 5 (375×667) and iPhone 13 (414×896)
    // -----------------------------------------------------------------------
    {
      name: 'matrix-mobile-pixel5',
      testMatch: 'e2e/**/*.spec.ts',
      use: { ...devices['Pixel 5'] },
      grepInvert,
    },
    {
      name: 'matrix-mobile-iphone13',
      testMatch: 'e2e/**/*.spec.ts',
      use: { ...devices['iPhone 13'] },
      grepInvert,
    },

    // -----------------------------------------------------------------------
    // Quarantine project — known-flaky tests run in isolation, don't block CI.
    // Run via: npm run test:e2e:quarantine
    // Tests are selected by title match (see e2e/quarantine.json).
    // -----------------------------------------------------------------------
    {
      name: 'quarantine',
      testMatch: 'e2e/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      grep: grepQuarantine,
      retries: 3,
    },
  ],
});
