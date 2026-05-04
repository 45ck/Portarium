import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report/live-stack', open: 'never' }], ['list']],
  outputDir: '../../qa-artifacts/playwright-live-stack',
  webServer: {
    command: 'npm run cockpit:dev:e2e:live',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'live-chromium',
      testMatch: /cockpit-live-stack\.spec\.ts/,
    },
  ],
});
