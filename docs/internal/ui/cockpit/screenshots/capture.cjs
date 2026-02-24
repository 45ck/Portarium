/**
 * Playwright screenshot capture for Nielsen heuristic evaluation.
 * Captures Workforce integration screens + related surfaces.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = 'file:///D:/Visual%20Studio%20Projects/VAOP/docs/internal/ui/cockpit/index.html';
const OUT = path.join(__dirname);

async function shot(page, name, fn) {
  await fn(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `heuristic-${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(FILE, { waitUntil: 'networkidle' });

  // Helper: navigate via sidebar link
  const nav = (hash) =>
    page.evaluate((h) => {
      document.querySelector(`a[href="${h}"]`)?.click();
    }, hash);

  // Helper: set persona
  const persona = (val) => page.selectOption('#persona', val);

  console.log('Capturing Workforce integration screens...');

  // 1. Sidebar — show Workforce section label
  await shot(page, '01-sidebar-workforce', async (p) => {
    await nav('#inbox');
  });

  // 2. Inbox — Operator persona (should show HumanTask cards)
  await shot(page, '02-inbox-operator', async (p) => {
    await persona('operator');
    await nav('#inbox');
  });

  // 3. Inbox — Approver persona
  await shot(page, '03-inbox-approver', async (p) => {
    await persona('approver');
    await nav('#inbox');
  });

  // 4. Workforce directory screen
  await shot(page, '04-workforce-directory', async (p) => {
    await persona('operator');
    await nav('#workforce');
  });

  // 5. Workforce — click Bob Chen card (master-detail)
  await shot(page, '05-workforce-bob-detail', async (p) => {
    await nav('#workforce');
    await p.waitForTimeout(200);
    const cards = await p.$$('.workforce-card');
    if (cards[1]) await cards[1].click();
  });

  // 6. Queues screen
  await shot(page, '06-queues', async (p) => {
    await nav('#queues');
  });

  // 7. Queues — click second queue card (master-detail)
  await shot(page, '07-queues-detail', async (p) => {
    await nav('#queues');
    await p.waitForTimeout(200);
    const cards = await p.$$('.queue-card');
    if (cards[1]) await cards[1].click();
  });

  // 8. Work Items list
  await shot(page, '08-work-items', async (p) => {
    await persona('operator');
    await nav('#work-items');
  });

  // 9. Work Item detail — owner picker open
  await shot(page, '09-work-item-owner-picker', async (p) => {
    await nav('#work-items');
    await p.waitForTimeout(200);
    // Open first work item detail
    const firstItem = await p.$('.work-item-row, .table__row[data-href], tr[data-href]');
    if (firstItem) await firstItem.click();
    await p.waitForTimeout(300);
    // Open owner picker
    const picker = await p.$('.owner-picker__trigger, [data-action="open-owner-picker"]');
    if (picker) await picker.click();
  });

  // 10. Approvals table — assignee column
  await shot(page, '10-approvals', async (p) => {
    await persona('approver');
    await nav('#approvals');
  });

  // 11. Run detail — step timeline with workforce assignee
  await shot(page, '11-run-detail-timeline', async (p) => {
    await persona('operator');
    await nav('#runs');
    await p.waitForTimeout(200);
    const firstRun = await p.$('tr[data-href], .table__row[data-href]');
    if (firstRun) await firstRun.click();
  });

  // 12. Settings — Workforce tab
  await shot(page, '12-settings-workforce', async (p) => {
    await persona('admin');
    await nav('#settings');
    await p.waitForTimeout(200);
    const wfTab = await p.$(
      '[data-tab="workforce"], [href="#settings-workforce"], .tab[data-value="workforce"]',
    );
    if (wfTab) await wfTab.click();
  });

  // 13. Triage screen (if accessible)
  await shot(page, '13-triage', async (p) => {
    await persona('operator');
    await nav('#triage');
  });

  // 14. Full-width — Admin persona, Workforce
  await shot(page, '14-workforce-admin', async (p) => {
    await persona('admin');
    await nav('#workforce');
  });

  await browser.close();
  console.log('\nDone. Screenshots saved to:', OUT);
})();
