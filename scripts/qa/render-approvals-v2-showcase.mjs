import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const rootDir = process.cwd();
const outputDir = path.resolve(rootDir, 'docs/ui/cockpit/demo-machine/showcase');
const framesDir = path.join(outputDir, 'frames');
const gifPath = path.join(outputDir, 'approvals-v2-approval-gate.gif');
const metadataPath = path.join(outputDir, 'approvals-v2-approval-gate.json');

const htmlPath = path.resolve(rootDir, 'docs/ui/cockpit/index.html');
const baseUrl = pathToFileURL(htmlPath).href;

const FRAME_STEPS = [
  { file: 'frame-01.png', route: '#inbox', waitMs: 500 },
  { file: 'frame-02.png', route: '#approvals', waitMs: 700 },
  { file: 'frame-03.png', route: '#approvals', waitMs: 900, approve: true },
  { file: 'frame-04.png', route: '#runs', waitMs: 700 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureFrames() {
  fs.mkdirSync(framesDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1280, height: 720 },
  });

  const page = await browser.newPage();

  try {
    for (const step of FRAME_STEPS) {
      await page.goto(`${baseUrl}${step.route}`, { waitUntil: 'load' });
      await sleep(step.waitMs);

      if (step.route === '#inbox') {
        await page.select('#persona', 'approver');
        await sleep(250);

        const resetButton = await page.$('#demoResetButton');
        if (resetButton) {
          await resetButton.click();
          await sleep(400);
        }
      }

      if (step.approve) {
        await page.$eval('#approvalDecision', (selectEl) => {
          if (!(selectEl instanceof HTMLSelectElement)) return;
          selectEl.value = 'Approve';
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.waitForFunction(() => {
          const submit = document.querySelector('#submitDecision');
          return submit instanceof HTMLButtonElement && !submit.disabled;
        });
        await page.$eval('#submitDecision', (buttonEl) => {
          if (buttonEl instanceof HTMLButtonElement) {
            buttonEl.click();
          }
        });
        await sleep(800);
      }

      await page.screenshot({
        path: path.join(framesDir, step.file),
        fullPage: true,
      });
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  await captureFrames();

  const pythonCode = [
    'import glob, sys',
    'from PIL import Image',
    'pattern = sys.argv[1]',
    'gif = sys.argv[2]',
    'frame_paths = sorted(glob.glob(pattern))',
    'if not frame_paths:',
    '    raise SystemExit("No frames found for GIF render")',
    'frames = [Image.open(p).convert("P", palette=Image.ADAPTIVE) for p in frame_paths]',
    'frames[0].save(gif, save_all=True, append_images=frames[1:], duration=1500, loop=0, optimize=True)',
  ].join('\n');

  const pythonResult = spawnSync('python', ['-c', pythonCode, `${framesDir}/*.png`, gifPath], {
    cwd: outputDir,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (pythonResult.status !== 0) {
    const stderr = pythonResult.stderr?.trim() || '(no stderr)';
    throw new Error(`GIF render failed via python/Pillow:\n${stderr}`);
  }

  const metadata = {
    generatedAt: new Date().toISOString(),
    source: path.relative(rootDir, htmlPath).replaceAll('\\', '/'),
    outputs: {
      gif: path.relative(rootDir, gifPath).replaceAll('\\', '/'),
    },
    frames: FRAME_STEPS.map((step) => step.file),
  };

  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Generated approvals showcase:\n- ${path.relative(rootDir, gifPath)}`);
}

await main();
