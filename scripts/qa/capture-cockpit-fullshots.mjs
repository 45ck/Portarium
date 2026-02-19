import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const root = process.cwd();
const htmlPath = path.resolve(root, 'docs/ui/cockpit/index.html');
const baseUrl = pathToFileURL(htmlPath).href;

const screens = [
  'inbox',
  'project',
  'work-items',
  'runs',
  'workflow-builder',
  'work-item',
  'run',
  'approvals',
  'evidence',
  'agents',
  'settings',
  'onboarding',
  'objects',
  'events',
  'adapters',
  'components',
  'observability',
  'governance',
  'loading',
  'robots',
  'robot',
  'missions',
  'mission',
  'safety',
  'gateways',
  'workforce',
  'queues',
];

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(root, `qa-artifacts/cockpit-fullshots-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function gotoScreen(page, screen) {
  const url = `${baseUrl}#${screen}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(
    (targetId) => {
      const target = document.getElementById(targetId);
      return Boolean(target && target.classList.contains('is-active'));
    },
    {},
    `screen-${screen}`
  );
  await sleep(120);
}

async function capture(page, name) {
  const filePath = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();

const captured = [];
try {
  for (const screen of screens) {
    await gotoScreen(page, screen);
    captured.push(await capture(page, `screen-${screen}`));
  }

  await gotoScreen(page, 'approvals');

  const tableBtn = await page.$('#screen-approvals .js-triage-mode[data-mode="table"]');
  if (tableBtn) {
    await tableBtn.click();
    await sleep(120);
    captured.push(await capture(page, 'screen-approvals-table-mode'));
  }

  const triageBtn = await page.$('#screen-approvals .js-triage-mode[data-mode="triage"]');
  if (triageBtn) {
    await triageBtn.click();
    await sleep(120);
    captured.push(await capture(page, 'screen-approvals-triage-mode'));

    const swipeBtn = await page.$('#screen-approvals .js-triage-layout[data-layout="swipe"]');
    if (swipeBtn) {
      await swipeBtn.click();
      await sleep(120);
      captured.push(await capture(page, 'screen-approvals-triage-swipe-mode'));
    }

    const splitBtn = await page.$('#screen-approvals .js-triage-layout[data-layout="split"]');
    if (splitBtn) {
      await splitBtn.click();
      await sleep(120);
      captured.push(await capture(page, 'screen-approvals-triage-split-mode'));
    }
  }

  const metadata = {
    generatedAt: new Date().toISOString(),
    source: htmlPath,
    totalScreenshots: captured.length,
    screenshots: captured.map((p) => path.relative(root, p).replace(/\\/g, '/')),
  };
  fs.writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(`Captured ${captured.length} screenshots to ${path.relative(root, outDir)}`);
} finally {
  await browser.close();
}
