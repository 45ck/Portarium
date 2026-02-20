/**
 * Screenshot all cockpit routes at localhost:5173
 * Run: node apps/cockpit/scripts/screenshot-all-routes.mjs
 */
import { chromium } from 'playwright-core';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const BASE = 'http://localhost:5173';
const OUT = 'apps/cockpit/screenshots';

const ROUTES = [
  { name: '00-inbox', path: '/inbox' },
  { name: '01-dashboard', path: '/dashboard' },
  { name: '02-work-items', path: '/work-items' },
  { name: '03-work-item-detail', path: '/work-items/wi-1001' },
  { name: '04-runs', path: '/runs' },
  { name: '05-run-detail', path: '/runs/run-2001' },
  { name: '06-approvals', path: '/approvals' },
  { name: '07-approvals-triage', path: '/approvals?tab=triage' },
  { name: '08-approval-detail', path: '/approvals/apr-3001' },
  { name: '09-evidence', path: '/evidence' },
  { name: '10-workforce', path: '/workforce' },
  { name: '11-workforce-member', path: '/workforce/wfm-001' },
  { name: '12-workforce-queues', path: '/workforce/queues' },
  { name: '13-config-agents', path: '/config/agents' },
  { name: '14-config-agent-detail', path: '/config/agents/agent-order-router' },
  { name: '15-config-adapters', path: '/config/adapters' },
  { name: '16-config-settings', path: '/config/settings' },
  { name: '17-explore-observability', path: '/explore/observability' },
  { name: '18-explore-events', path: '/explore/events' },
  { name: '19-explore-governance', path: '/explore/governance' },
  { name: '20-explore-objects', path: '/explore/objects' },
  { name: '21-robotics-robots', path: '/robotics/robots' },
  { name: '22-robotics-missions', path: '/robotics/missions' },
  { name: '23-robotics-safety', path: '/robotics/safety' },
  { name: '24-robotics-gateways', path: '/robotics/gateways' },
];

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // Pre-set Meridian demo dataset so MSW loads with data
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE,
          localStorage: [
            { name: 'portarium-dataset', value: 'meridian-demo' },
            { name: 'portarium-theme', value: 'default' },
          ],
        },
      ],
    },
  });

  const results = [];

  for (const route of ROUTES) {
    const page = await context.newPage();
    let status = 'ok';
    let error = null;

    try {
      const response = await page.goto(`${BASE}${route.path}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // Wait a bit extra for MSW + React Query to settle
      await page.waitForTimeout(1500);

      // Check for visible error text
      const bodyText = await page.textContent('body');
      if (bodyText?.includes('Something went wrong') || bodyText?.includes('Unhandled Error')) {
        status = 'error-boundary';
      }

      // Check no blank white page (main content should exist)
      const main = await page.$('#main-content');
      if (!main) status = 'missing-main-id';

      const path = join(OUT, `${route.name}.png`);
      await page.screenshot({ path, fullPage: true });
      console.log(`✅ ${route.name} → ${path}`);
    } catch (e) {
      status = 'crash';
      error = e.message;
      console.error(`❌ ${route.name}: ${e.message}`);
      try {
        const path = join(OUT, `${route.name}-ERROR.png`);
        await page.screenshot({ path });
      } catch {}
    }

    results.push({ ...route, status, error });
    await page.close();
  }

  await browser.close();

  // Print summary
  console.log('\n── SUMMARY ─────────────────────────────────');
  const ok = results.filter((r) => r.status === 'ok');
  const warn = results.filter((r) => r.status !== 'ok' && r.status !== 'crash');
  const crash = results.filter((r) => r.status === 'crash');

  console.log(`✅ OK:      ${ok.length}`);
  console.log(`⚠️  Warn:   ${warn.length}  ${warn.map((r) => r.name).join(', ')}`);
  console.log(`❌ Crash:   ${crash.length}  ${crash.map((r) => r.name).join(', ')}`);
  console.log(`\nScreenshots saved to ${OUT}/`);
}

main().catch(console.error);
