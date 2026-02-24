import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.join(rootDir, 'docs/internal/ui/cockpit/media');
const framesDir = path.join(rootDir, 'qa-artifacts', 'openclaw-iphone-frames');
const mp4Path = path.join(outputDir, 'openclaw-tinder-approvals-iphone.mp4');
const gifPath = path.join(outputDir, 'openclaw-tinder-approvals-iphone.gif');
const metadataPath = path.join(outputDir, 'openclaw-tinder-approvals-iphone.json');

const host = '127.0.0.1';
const port = 5192;
const baseUrl = `http://${host}:${port}`;

const VIEWPORT = { width: 720, height: 1560 };
const CAPTURE_FPS = 30;
const CURSOR_DURATION_MS = 520;
const TYPE_DELAY_MS = 40;
const STEP_SETTLE_MS = 360;
const MODE_SETTLE_MS = 430;

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function waitForServer(url, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${url}/approvals`, { redirect: 'manual' });
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      // keep polling
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for dev server: ${url}`);
}

function resolveFfmpegBinary() {
  const direct = spawnSync('ffmpeg', ['-version'], { stdio: 'pipe', encoding: 'utf8' });
  if (direct.status === 0) return 'ffmpeg';

  const py = spawnSync(
    'python',
    ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],
    {
      stdio: 'pipe',
      encoding: 'utf8',
    },
  );
  if (py.status !== 0) return null;
  const ffmpegPath = py.stdout.trim();
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  return ffmpegPath;
}

function runFfmpeg(ffmpegBin, args, label) {
  const result = spawnSync(ffmpegBin, args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = result.stderr?.slice(-800) || result.stdout?.slice(-800) || 'unknown error';
    throw new Error(`${label} failed:\n${detail}`);
  }
}

function encodeArtifacts(ffmpegBin) {
  const pattern = path.join(framesDir, 'frame-%06d.png');

  runFfmpeg(
    ffmpegBin,
    [
      '-y',
      '-framerate',
      String(CAPTURE_FPS),
      '-i',
      pattern,
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '14',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      mp4Path,
    ],
    'iPhone MP4 encode',
  );

  const palettePath = path.join(framesDir, 'palette.png');
  runFfmpeg(
    ffmpegBin,
    [
      '-y',
      '-framerate',
      '12',
      '-i',
      pattern,
      '-vf',
      `fps=12,scale=${VIEWPORT.width}:-1:flags=lanczos,palettegen`,
      palettePath,
    ],
    'GIF palette generation',
  );

  runFfmpeg(
    ffmpegBin,
    [
      '-y',
      '-framerate',
      '12',
      '-i',
      pattern,
      '-i',
      palettePath,
      '-lavfi',
      `fps=12,scale=${VIEWPORT.width}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
      gifPath,
    ],
    'iPhone GIF encode',
  );
}

async function findVisibleLocator(page, selector, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const candidates = page.locator(selector);
    const count = await candidates.count();
    for (let i = 0; i < count; i += 1) {
      const candidate = candidates.nth(i);
      if (await candidate.isVisible()) return candidate;
    }
    await sleep(120);
  }
  throw new Error(`Timed out waiting for visible selector: ${selector}`);
}

async function getTargetPoint(page, selector) {
  const locator = await findVisibleLocator(page, selector, 20_000);
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Could not resolve bounds for selector: ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

async function installDemoCursor(page) {
  await page.addStyleTag({
    content: `
      html, body { cursor: none !important; }
      #dm-cursor {
        position: fixed;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.97);
        border: 2px solid rgba(17, 24, 39, 0.96);
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        z-index: 2147483647;
        transform: translate(-50%, -50%);
      }
      #dm-cursor.dm-click {
        transform: translate(-50%, -50%) scale(0.86);
      }
    `,
  });

  await page.evaluate(() => {
    let cursor = document.getElementById('dm-cursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = 'dm-cursor';
      cursor.style.left = '24px';
      cursor.style.top = '24px';
      document.body.appendChild(cursor);
    }
  });
}

async function updateCursor(page, x, y) {
  await page.evaluate(
    ({ cx, cy }) => {
      const cursor = document.getElementById('dm-cursor');
      if (!cursor) return;
      cursor.style.left = `${cx}px`;
      cursor.style.top = `${cy}px`;
    },
    { cx: x, cy: y },
  );
}

async function pulseCursor(page) {
  await page.evaluate(() => {
    const cursor = document.getElementById('dm-cursor');
    if (!cursor) return;
    cursor.classList.add('dm-click');
    setTimeout(() => cursor.classList.remove('dm-click'), 140);
  });
}

async function moveCursor(page, cursorState, toX, toY, durationMs = CURSOR_DURATION_MS) {
  const fromX = cursorState.x;
  const fromY = cursorState.y;
  const steps = Math.max(14, Math.round(durationMs / 16));
  for (let i = 1; i <= steps; i += 1) {
    const progress = i / steps;
    const eased = easeInOutCubic(progress);
    const x = fromX + (toX - fromX) * eased;
    const y = fromY + (toY - fromY) * eased;
    await page.mouse.move(x, y);
    await updateCursor(page, x, y);
    await sleep(durationMs / steps);
  }
  cursorState.x = toX;
  cursorState.y = toY;
}

async function smoothType(page, cursorState, selector, text) {
  const { x, y } = await getTargetPoint(page, selector);
  await moveCursor(page, cursorState, x, y);
  await pulseCursor(page);
  await page.mouse.click(x, y);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text, { delay: TYPE_DELAY_MS });
  await sleep(STEP_SETTLE_MS);
}

async function smoothClickLocator(page, cursorState, locator, settleMs = STEP_SETTLE_MS) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Could not resolve bounds for target locator');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await moveCursor(page, cursorState, x, y);
  await pulseCursor(page);
  await page.mouse.click(x, y);
  await sleep(settleMs);
}

function parseApprovalId(ariaLabel) {
  if (!ariaLabel) return null;
  const prefix = 'Decision rationale for approval ';
  if (!ariaLabel.startsWith(prefix)) return null;
  return ariaLabel.slice(prefix.length);
}

async function focusApprovalCard(page, approvalId, maxSkips = 8) {
  for (let i = 0; i <= maxSkips; i += 1) {
    const rationale = await findVisibleLocator(
      page,
      "textarea[aria-label^='Decision rationale for approval']",
      20_000,
    );
    const label = await rationale.getAttribute('aria-label');
    const currentId = parseApprovalId(label);
    if (currentId === approvalId) return approvalId;
    if (i === maxSkips) break;
    const skip = await findVisibleLocator(
      page,
      "[role='group'][aria-label='Make approval decision'] button[title='Skip (S)']",
      15_000,
    );
    await skip.click();
    await sleep(220);
  }
  throw new Error(`Could not focus expected approval card: ${approvalId}`);
}

async function waitForNextApprovalRationale(page, previousApprovalId, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const rationale = await findVisibleLocator(
      page,
      "textarea[aria-label^='Decision rationale for approval']",
      12_000,
    );
    const label = await rationale.getAttribute('aria-label');
    const currentId = parseApprovalId(label);
    if (currentId && currentId !== previousApprovalId) {
      return { locator: rationale, approvalId: currentId };
    }
    await sleep(120);
  }
  throw new Error(`Timed out waiting for next approval card after ${previousApprovalId}`);
}

function decisionButtonForRationale(rationaleLocator, title) {
  return rationaleLocator.locator(
    `xpath=ancestor::div[contains(@class,'space-y-3')][1]//button[@title='${title}']`,
  );
}

async function smoothClickMode(page, cursorState, modeId) {
  const candidates = page.locator(`[data-triage-mode='${modeId}']`);
  if ((await candidates.count()) === 0) return false;
  const target = candidates.first();
  await target.scrollIntoViewIfNeeded().catch(() => {});
  if (!(await target.isVisible())) return false;
  const box = await target.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await moveCursor(page, cursorState, x, y);
  await pulseCursor(page);
  await page.mouse.click(x, y);
  await sleep(MODE_SETTLE_MS);
  return true;
}

async function walkModes(page, cursorState, ids) {
  for (const id of ids) {
    await smoothClickMode(page, cursorState, id);
  }
}

async function startFrameCapture(page) {
  ensureDir(framesDir);
  const cdp = await page.context().newCDPSession(page);
  let frameCount = 0;
  const writes = new Set();

  const onFrame = (payload) => {
    frameCount += 1;
    const framePath = path.join(framesDir, `frame-${String(frameCount).padStart(6, '0')}.png`);
    cdp.send('Page.screencastFrameAck', { sessionId: payload.sessionId }).catch(() => {});
    const data = Buffer.from(payload.data, 'base64');
    let writeOp = Promise.resolve();
    writeOp = fsp.writeFile(framePath, data).finally(() => writes.delete(writeOp));
    writes.add(writeOp);
  };

  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', {
    format: 'png',
    quality: 100,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
    everyNthFrame: 1,
  });

  return async () => {
    await sleep(120);
    await cdp.send('Page.stopScreencast').catch(() => {});
    cdp.off('Page.screencastFrame', onFrame);
    await Promise.allSettled([...writes]);
    return frameCount;
  };
}

async function runScenario(page) {
  const cursorState = { x: 24, y: 24 };
  await page.mouse.move(cursorState.x, cursorState.y);
  await updateCursor(page, cursorState.x, cursorState.y);

  await page.goto(`${baseUrl}/approvals`, { waitUntil: 'domcontentloaded' });
  await findVisibleLocator(page, "textarea[aria-label^='Decision rationale for approval']", 20_000);

  // Move to the destructive safety card for the core policy demo.
  await focusApprovalCard(page, 'apr-oc-3203');

  await installDemoCursor(page);
  await sleep(420);
  const stopCapture = await startFrameCapture(page);

  // Summary-first review, then click through core context views.
  await walkModes(page, cursorState, [
    'briefing',
    'agent-overview',
    'compliance-checklist',
    'evidence-chain',
    'story-timeline',
  ]);
  await smoothClickMode(page, cursorState, 'briefing');

  // Attempt blocked approval: policy stops destructive action.
  const destructiveRationale = await findVisibleLocator(
    page,
    "textarea[aria-label^='Decision rationale for approval']",
    20_000,
  );
  const activeRationaleLabel = await destructiveRationale.getAttribute('aria-label');
  const destructiveApprovalId = parseApprovalId(activeRationaleLabel);
  if (!destructiveApprovalId) {
    throw new Error('Could not determine active approval id for destructive card');
  }

  const destructiveApprove = decisionButtonForRationale(destructiveRationale, 'Approve (A)');
  if (await destructiveApprove.isDisabled()) {
    await smoothClickLocator(page, cursorState, destructiveApprove);
  }

  // Deny with rationale.
  await smoothType(
    page,
    cursorState,
    `textarea[aria-label='Decision rationale for approval ${destructiveApprovalId}']`,
    'Denied: destructive mailbox wipe blocked by policy.',
  );
  const destructiveDeny = decisionButtonForRationale(destructiveRationale, 'Deny (D)');
  await smoothClickLocator(page, cursorState, destructiveDeny);

  // Next card: allow a non-destructive proposal.
  const { locator: nextRationale, approvalId: nextApprovalId } = await waitForNextApprovalRationale(
    page,
    destructiveApprovalId,
  );
  await smoothType(
    page,
    cursorState,
    `textarea[aria-label='Decision rationale for approval ${nextApprovalId}']`,
    'Approved: morning brief can proceed with human governance.',
  );
  const nextApprove = decisionButtonForRationale(nextRationale, 'Approve (A)');
  await smoothClickLocator(page, cursorState, nextApprove);

  await sleep(800);
  return stopCapture;
}

async function main() {
  ensureDir(outputDir);
  await fsp.rm(framesDir, { recursive: true, force: true });
  ensureDir(framesDir);

  const ffmpegBin = resolveFfmpegBinary();
  if (!ffmpegBin) {
    throw new Error('ffmpeg not found. Install ffmpeg or python imageio_ffmpeg.');
  }

  log('[iphone-showcase] starting OpenClaw demo server...');
  const server = spawn(
    'node',
    ['scripts/qa/start-cockpit-openclaw-demo.mjs', '--e2e', '--host', host, '--port', String(port)],
    {
      cwd: rootDir,
      stdio: 'ignore',
    },
  );

  let frameCount = 0;
  try {
    await waitForServer(baseUrl);

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        colorScheme: 'light',
      });
      await context.addInitScript(() => {
        localStorage.setItem('portarium-triage-view', 'briefing');
      });
      const page = await context.newPage();

      const stopCapture = await runScenario(page);
      frameCount = await stopCapture();

      await context.close();
    } finally {
      await browser.close().catch(() => {});
    }
  } finally {
    if (!server.killed) server.kill('SIGTERM');
  }

  encodeArtifacts(ffmpegBin);

  const metadata = {
    generatedAt: new Date().toISOString(),
    source: 'scripts/qa/render-openclaw-iphone-showcase.mjs',
    baseUrl,
    viewport: VIEWPORT,
    captureFps: CAPTURE_FPS,
    frameCount,
    outputs: {
      mp4: path.relative(rootDir, mp4Path).replaceAll('\\', '/'),
      gif: path.relative(rootDir, gifPath).replaceAll('\\', '/'),
    },
  };
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  await fsp.rm(framesDir, { recursive: true, force: true });

  log('[iphone-showcase] complete');
  log(`  mp4 : ${path.relative(rootDir, mp4Path).replaceAll('\\', '/')}`);
  log(`  gif : ${path.relative(rootDir, gifPath).replaceAll('\\', '/')}`);
}

await main();
