/**
 * Screenshot all cockpit routes to verify they render without errors.
 * Usage: npx playwright test --config=qa/screenshot-pages.mjs
 * Or:    node qa/screenshot-pages.mjs  (self-running with puppeteer)
 */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:5199';
const OUT_DIR = path.resolve('qa-artifacts/screenshots');

// All pages to verify (new + modified)
const PAGES = [
  // New pages
  { path: '/workflows/builder', label: 'workflow-builder' },
  { path: '/robotics/map', label: 'robotics-map' },
  { path: '/config/users', label: 'config-users' },

  // Modified pages
  { path: '/', label: 'index-redirect' },
  { path: '/inbox', label: 'inbox-human-tasks' },
  { path: '/dashboard', label: 'dashboard-new-run' },
  { path: '/work-items', label: 'work-items-list' },
  { path: '/work-items/wi-1001', label: 'work-item-detail-owner' },
  { path: '/runs', label: 'runs-list' },
  { path: '/runs/run-2001', label: 'run-detail-cancel' },
  { path: '/workflows', label: 'workflows-list' },
  { path: '/workflows/wf-invoice-remediation', label: 'workflow-detail' },
  { path: '/approvals', label: 'approvals-list' },
  { path: '/approvals/apr-3001', label: 'approval-detail' },
  { path: '/evidence', label: 'evidence-list' },
  { path: '/workforce', label: 'workforce-members' },
  { path: '/workforce/queues', label: 'workforce-queues' },
  { path: '/config/agents', label: 'config-agents-register' },
  { path: '/config/adapters', label: 'config-adapters' },
  { path: '/config/credentials', label: 'config-credentials' },
  { path: '/config/settings', label: 'config-settings' },
  { path: '/explore/objects', label: 'explore-objects' },
  { path: '/explore/events', label: 'explore-events' },
  { path: '/explore/observability', label: 'explore-observability' },
  { path: '/explore/governance', label: 'explore-governance-live' },
  { path: '/robotics', label: 'robotics-index' },
  { path: '/robotics/robots', label: 'robotics-robots' },
  { path: '/robotics/missions', label: 'robotics-missions' },
  { path: '/robotics/safety', label: 'robotics-safety' },
  { path: '/robotics/gateways', label: 'robotics-gateways-live' },
];

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const results = [];
  const errors = [];

  for (const page of PAGES) {
    const tab = await browser.newPage();
    const consoleErrors = [];

    tab.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    tab.on('pageerror', (err) => {
      consoleErrors.push(`PAGE ERROR: ${err.message}`);
    });

    try {
      const url = `${BASE}${page.path}`;
      console.log(`  Navigating to ${page.path} ...`);

      await tab.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

      // Wait a bit for React to hydrate and data to load
      await new Promise((r) => setTimeout(r, 1500));

      const screenshotPath = path.join(OUT_DIR, `${page.label}.png`);
      await tab.screenshot({ path: screenshotPath, fullPage: false });

      // Check for critical render failures
      const bodyText = await tab.evaluate(() => document.body.innerText);
      const hasPortarium = bodyText.includes('Portarium');
      const hasError = bodyText.includes('Something went wrong') || bodyText.includes('Cannot read properties');

      const criticalConsoleErrors = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('ResizeObserver') && !e.includes('Warning:')
      );

      const status = hasPortarium && !hasError ? 'OK' : 'FAIL';

      results.push({
        path: page.path,
        label: page.label,
        status,
        hasPortarium,
        hasError,
        consoleErrors: criticalConsoleErrors.length,
        screenshot: screenshotPath,
      });

      if (status === 'FAIL' || criticalConsoleErrors.length > 0) {
        errors.push({
          path: page.path,
          label: page.label,
          consoleErrors: criticalConsoleErrors,
          hasPortarium,
          hasError,
        });
      }

      console.log(`  ${status} ${page.path} (console errors: ${criticalConsoleErrors.length})`);
    } catch (err) {
      console.log(`  FAIL ${page.path}: ${err.message}`);
      results.push({
        path: page.path,
        label: page.label,
        status: 'FAIL',
        error: err.message,
      });
      errors.push({
        path: page.path,
        label: page.label,
        error: err.message,
      });
    } finally {
      await tab.close();
    }
  }

  await browser.close();

  // Write summary report
  const reportPath = path.join(OUT_DIR, 'render-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ results, errors, timestamp: new Date().toISOString() }, null, 2));

  console.log('\n=== RENDER VERIFICATION REPORT ===');
  console.log(`Total pages: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.status === 'OK').length}`);
  console.log(`Failed: ${results.filter((r) => r.status === 'FAIL').length}`);

  if (errors.length > 0) {
    console.log('\n--- FAILURES ---');
    for (const e of errors) {
      console.log(`  ${e.path} (${e.label})`);
      if (e.error) console.log(`    Error: ${e.error}`);
      if (e.consoleErrors?.length) {
        for (const ce of e.consoleErrors) {
          console.log(`    Console: ${ce.substring(0, 200)}`);
        }
      }
    }
  }

  console.log(`\nScreenshots saved to: ${OUT_DIR}`);
  console.log(`Report saved to: ${reportPath}`);

  process.exit(errors.length > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(2);
});
