import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Portarium Cockpit E2E tests.
 *
 * Tests run against the Vite dev server (MSW mock API — no live backend needed).
 * Start the dev server first: cd apps/cockpit && npx vite
 *
 * Run smoke suite:  npm run test:e2e:smoke
 * Run matrix suite: npm run test:e2e:matrix
 *
 * Projects:
 *   Smoke projects  — chromium/firefox/webkit at desktop 1280×720 (default)
 *   Matrix projects — full cross-browser + responsive viewport grid
 *     Desktop 1920×1080: Chrome, Firefox, WebKit
 *     Tablet  768×1024:  Chrome
 *     Mobile  375×667  : Pixel 5 (Chrome)
 *     Mobile  414×896  : iPhone 13 (WebKit/Safari)
 *
 * Bead: bead-0828
 * Ref: ADR-0062 §viewport-matrix
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // -----------------------------------------------------------------------
    // Smoke projects — existing, used by test:e2e:smoke
    // -----------------------------------------------------------------------
    {
      name: 'chromium',
      testMatch: 'e2e/smoke/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testMatch: 'e2e/smoke/**/*.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: 'e2e/smoke/**/*.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },

    // -----------------------------------------------------------------------
    // Matrix projects — used by test:e2e:matrix (nightly)
    // Desktop at 1920×1080 across all three browser engines
    // -----------------------------------------------------------------------
    {
      name: 'matrix-desktop-chrome',
      testMatch: 'e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'matrix-desktop-firefox',
      testMatch: 'e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'matrix-desktop-webkit',
      testMatch: 'e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // -----------------------------------------------------------------------
    // Tablet — 768×1024 (boundary between mobile and desktop layouts;
    //   sidebar switches to Sheet overlay, dual-panel approvals hidden)
    // -----------------------------------------------------------------------
    {
      name: 'matrix-tablet-chrome',
      testMatch: 'e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        isMobile: false,
      },
    },

    // -----------------------------------------------------------------------
    // Mobile — Pixel 5 (375×667) and iPhone 13 (414×896)
    // -----------------------------------------------------------------------
    {
      name: 'matrix-mobile-pixel5',
      testMatch: 'e2e/**/*.spec.ts',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'matrix-mobile-iphone13',
      testMatch: 'e2e/**/*.spec.ts',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
