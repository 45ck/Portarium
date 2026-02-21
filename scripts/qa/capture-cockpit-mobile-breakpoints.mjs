import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const HTML_PATH = path.resolve(ROOT, 'docs/ui/cockpit/index.html');
const BASE_URL = pathToFileURL(HTML_PATH).href;
const OUTPUT_DIR = path.resolve(ROOT, 'docs/review/artifacts/bead-0716/mobile-breakpoints');

const SCREENS = [
  { id: 'approvals', target: 'Approvals' },
  { id: 'work-items', target: 'Work Items' },
  { id: 'runs', target: 'Runs' },
  { id: 'workflow-builder', target: 'Workflow Builder' },
];

const VIEWPORTS = [
  { id: 'mobile', width: 390, height: 844 },
  { id: 'desktop', width: 1280, height: 900 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gotoScreen(page, screenId) {
  await page.goto(`${BASE_URL}#${screenId}`, { waitUntil: 'load' });
  await page.waitForFunction(
    (targetId) => {
      const target = document.getElementById(targetId);
      return Boolean(target && target.classList.contains('is-active'));
    },
    {},
    `screen-${screenId}`,
  );
  await sleep(180);
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1280, height: 900 },
});

const page = await browser.newPage();
const captures = [];

try {
  for (const viewport of VIEWPORTS) {
    await page.setViewport({ width: viewport.width, height: viewport.height });
    for (const screen of SCREENS) {
      await gotoScreen(page, screen.id);
      const fileName = `${screen.id}-${viewport.id}.png`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      await page.screenshot({ path: filePath, fullPage: true });

      captures.push({
        screen: screen.id,
        label: screen.target,
        viewport: viewport.id,
        width: viewport.width,
        height: viewport.height,
        file: `docs/review/artifacts/bead-0716/mobile-breakpoints/${fileName}`,
      });
    }
  }

  const metadata = {
    generatedAt: new Date().toISOString(),
    source: HTML_PATH,
    screens: SCREENS,
    viewports: VIEWPORTS,
    captures,
  };
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'index.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8',
  );

  console.log(`Captured ${captures.length} screenshots in ${OUTPUT_DIR}`);
} finally {
  await browser.close();
}
