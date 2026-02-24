import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const defaultOutputDir = path.join(rootDir, 'qa-artifacts', 'openclaw-demo-videos', timestamp);
const args = process.argv.slice(2);

const VIEWPORT = { width: 1920, height: 1080 };
const CAPTURE_FPS = 30;
const CURSOR_DURATION_MS = 620;
const TYPE_DELAY_MS = 42;
const SETTLE_DELAY_MS = 430;
const VIEW_SETTLE_MS = 520;

const MODE_WALK_ORDER = [
  'briefing',
  'traffic-signals',
  'risk-radar',
  'blast-map',
  'diff-view',
  'action-replay',
  'evidence-chain',
  'story-timeline',
  'compliance-checklist',
  'agent-overview',
  'default',
];

function argValue(flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

const outputDir = path.resolve(argValue('--output', defaultOutputDir));
const port = Number(argValue('--port', '5190'));
const skipServer = args.includes('--skip-server');
const keepFrames = args.includes('--keep-frames');
const host = argValue('--host', '127.0.0.1');
const baseUrl = argValue('--base-url', `http://${host}:${port}`);

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

function runFfmpeg(ffmpegBin, argsList, label) {
  const result = spawnSync(ffmpegBin, argsList, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = result.stderr?.slice(-1000) || result.stdout?.slice(-1000) || 'unknown error';
    throw new Error(`${label} failed:\n${detail}`);
  }
}

function encodeFromFrames(ffmpegBin, framesDir, mp4Path, webmPath) {
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
    `MP4 encode (${path.basename(mp4Path)})`,
  );

  runFfmpeg(
    ffmpegBin,
    [
      '-y',
      '-framerate',
      String(CAPTURE_FPS),
      '-i',
      pattern,
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-an',
      webmPath,
    ],
    `WEBM encode (${path.basename(webmPath)})`,
  );
}

async function installDemoCursor(page) {
  await page.addStyleTag({
    content: `
      html, body { cursor: none !important; }
      #dm-cursor {
        position: fixed;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.96);
        border: 2px solid rgba(17, 24, 39, 0.95);
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.28);
        pointer-events: none;
        z-index: 2147483647;
        transform: translate(-50%, -50%);
      }
      #dm-cursor.dm-click {
        transform: translate(-50%, -50%) scale(0.84);
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

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

async function getTargetPoint(page, selector) {
  const locator = await findVisibleLocator(page, selector, 20_000);
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Could not resolve target bounds: ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, locator };
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
  const steps = Math.max(18, Math.round(durationMs / 16));
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

async function smoothClick(page, cursorState, selector) {
  const target = await getTargetPoint(page, selector);
  await moveCursor(page, cursorState, target.x, target.y, CURSOR_DURATION_MS);
  await pulseCursor(page);
  await page.mouse.click(target.x, target.y);
  await sleep(SETTLE_DELAY_MS);
}

async function smoothType(page, cursorState, selector, text) {
  const target = await getTargetPoint(page, selector);
  await moveCursor(page, cursorState, target.x, target.y, CURSOR_DURATION_MS);
  await pulseCursor(page);
  await page.mouse.click(target.x, target.y);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text, { delay: TYPE_DELAY_MS });
  await sleep(SETTLE_DELAY_MS);
}

async function assertApproveBlocked(page) {
  const btn = await findVisibleLocator(
    page,
    "[role='group'][aria-label='Make approval decision'] button[title='Approve (A)']",
    15_000,
  );
  const blocked = await btn.isDisabled();
  if (!blocked) throw new Error('Expected Approve to be blocked by policy, but button is enabled');
}

async function openApprovals(page) {
  await page.goto(`${baseUrl}/approvals`, { waitUntil: 'domcontentloaded' });
  await findVisibleLocator(page, "textarea[aria-label^='Decision rationale for approval']");
  await sleep(700);
}

async function quickSkip(page, count) {
  for (let i = 0; i < count; i += 1) {
    const skip = await findVisibleLocator(
      page,
      "[role='group'][aria-label='Make approval decision'] button[title='Skip (S)']",
      15_000,
    );
    await skip.click();
    await sleep(220);
  }
}

async function smoothClickMode(page, cursorState, modeId) {
  const selector = `[data-triage-mode='${modeId}']`;
  const candidates = page.locator(selector);
  if ((await candidates.count()) === 0) return false;

  const target = candidates.first();
  await target.scrollIntoViewIfNeeded().catch(() => {});
  if (!(await target.isVisible())) return false;

  const box = await target.boundingBox();
  if (!box) return false;

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await moveCursor(page, cursorState, x, y, CURSOR_DURATION_MS);
  await pulseCursor(page);
  await page.mouse.click(x, y);
  await sleep(VIEW_SETTLE_MS);
  return true;
}

async function walkTriageViews(page, cursorState, sequence = MODE_WALK_ORDER) {
  const visited = [];
  for (const modeId of sequence) {
    if (await smoothClickMode(page, cursorState, modeId)) {
      visited.push(modeId);
    }
  }
  return visited;
}

async function startFrameCapture(page, framesDir) {
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

const CLIPS = [
  {
    id: '01-heartbeat-watchtower',
    title: 'Heartbeat Watchtower triage loop',
    setupSkips: 0,
    expectedApprovalId: 'apr-oc-3201',
    run: async (page, cursorState) => {
      await sleep(450);
      await walkTriageViews(page, cursorState, [
        'briefing',
        'traffic-signals',
        'risk-radar',
        'diff-view',
        'evidence-chain',
        'agent-overview',
      ]);
      // Return to briefing before decision, so the clip shows summary-first review.
      await smoothClickMode(page, cursorState, 'briefing');

      await smoothType(
        page,
        cursorState,
        "textarea[aria-label^='Decision rationale for approval']",
        'Approved: low-risk heartbeat draft response.',
      );
      await smoothClick(
        page,
        cursorState,
        "[role='group'][aria-label='Make approval decision'] button[title='Approve (A)']",
      );

      await smoothType(
        page,
        cursorState,
        "textarea[aria-label^='Decision rationale for approval']",
        'Approved: schedule follow-up call for next 48h.',
      );
      await smoothClick(
        page,
        cursorState,
        "[role='group'][aria-label='Make approval decision'] button[title='Approve (A)']",
      );
      await sleep(1000);
    },
  },
  {
    id: '02-destructive-blocked',
    title: 'Destructive delete-all-emails blocked',
    setupSkips: 2,
    expectedApprovalId: 'apr-oc-3203',
    run: async (page, cursorState) => {
      await sleep(420);
      await walkTriageViews(page, cursorState, [
        'briefing',
        'evidence-chain',
        'compliance-checklist',
        'agent-overview',
      ]);
      await smoothClickMode(page, cursorState, 'briefing');
      await smoothClick(
        page,
        cursorState,
        "[role='group'][aria-label='Make approval decision'] button[title='Approve (A)']",
      );
      await assertApproveBlocked(page);
      await smoothType(
        page,
        cursorState,
        "textarea[aria-label^='Decision rationale for approval']",
        'Denied: destructive bulk delete is blocked by policy.',
      );
      await smoothClick(
        page,
        cursorState,
        "[role='group'][aria-label='Make approval decision'] button[title='Deny (D)']",
      );
      await sleep(1000);
    },
  },
  {
    id: '03-persistent-cron-and-subagent',
    title: 'Persistent automation blocked; sub-agent proposal approved',
    setupSkips: 4,
    expectedApprovalId: 'apr-oc-3205',
    run: async (page, cursorState) => {
      await sleep(420);
      await walkTriageViews(page, cursorState, [
        'briefing',
        'agent-overview',
        'blast-map',
        'diff-view',
        'evidence-chain',
      ]);
      await smoothClickMode(page, cursorState, 'briefing');
      await smoothClick(
        page,
        cursorState,
        "[role='group'][aria-label='Make approval decision'] button[title='Approve (A)']",
      );
      await assertApproveBlocked(page);
      await smoothType(
        page,
        cursorState,
        "textarea[aria-label^='Decision rationale for approval']",
        'Denied: persistent cron creation requires admin escalation.',
      );
      await smoothClick(
        page,
        cursorState,
        "[role='group'][aria-label='Make approval decision'] button[title='Deny (D)']",
      );

      await smoothType(
        page,
        cursorState,
        "textarea[aria-label^='Decision rationale for approval']",
        'Approved: apply sub-agent thread triage output.',
      );
      await smoothClick(
        page,
        cursorState,
        "[role='group'][aria-label='Make approval decision'] button[title='Approve (A)']",
      );
      await sleep(1000);
    },
  },
];

async function renderClip(browser, ffmpegBin, clip) {
  const clipDir = path.join(outputDir, clip.id);
  const framesDir = path.join(clipDir, 'frames');
  ensureDir(clipDir);

  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: 'light',
  });
  await context.addInitScript(() => {
    // Force summary-first default during demo capture.
    localStorage.setItem('portarium-triage-view', 'briefing');
  });
  const page = await context.newPage();

  let frameCount = 0;
  try {
    await openApprovals(page);
    if (clip.setupSkips > 0) {
      await quickSkip(page, clip.setupSkips);
    }
    await findVisibleLocator(
      page,
      `textarea[aria-label='Decision rationale for approval ${clip.expectedApprovalId}']`,
      20_000,
    );
    await installDemoCursor(page);

    const cursorState = { x: 32, y: 32 };
    await updateCursor(page, cursorState.x, cursorState.y);
    await page.mouse.move(cursorState.x, cursorState.y);

    const stopCapture = await startFrameCapture(page, framesDir);
    await clip.run(page, cursorState);
    frameCount = await stopCapture();
  } finally {
    await context.close().catch(() => {});
  }

  const mp4Path = path.join(clipDir, `${clip.id}.mp4`);
  const webmPath = path.join(clipDir, `${clip.id}.webm`);
  encodeFromFrames(ffmpegBin, framesDir, mp4Path, webmPath);

  if (!keepFrames) {
    await fsp.rm(framesDir, { recursive: true, force: true });
  }

  return {
    id: clip.id,
    title: clip.title,
    frameCount,
    outputs: {
      webm: path.relative(rootDir, webmPath).replaceAll('\\', '/'),
      mp4: path.relative(rootDir, mp4Path).replaceAll('\\', '/'),
      ...(keepFrames ? { framesDir: path.relative(rootDir, framesDir).replaceAll('\\', '/') } : {}),
    },
  };
}

async function main() {
  ensureDir(outputDir);

  const ffmpegBin = resolveFfmpegBinary();
  if (!ffmpegBin) {
    throw new Error('ffmpeg not found. Install ffmpeg or python imageio_ffmpeg first.');
  }

  let server = null;
  if (!skipServer) {
    log('[openclaw-demo] starting dev server...');
    server = spawn(
      'node',
      [
        'scripts/qa/start-cockpit-openclaw-demo.mjs',
        '--e2e',
        '--host',
        host,
        '--port',
        String(port),
      ],
      {
        cwd: rootDir,
        stdio: 'ignore',
      },
    );
    await waitForServer(baseUrl);
  } else {
    await waitForServer(baseUrl, 30_000);
  }

  const browser = await chromium.launch({ headless: true });
  const clips = [];
  try {
    for (const clip of CLIPS) {
      log(`[clip] ${clip.id}`);
      const rendered = await renderClip(browser, ffmpegBin, clip);
      clips.push(rendered);
    }
  } finally {
    await browser.close().catch(() => {});
    if (server && !server.killed) {
      server.kill('SIGTERM');
    }
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewport: VIEWPORT,
    captureFps: CAPTURE_FPS,
    pacing: {
      cursorDurationMs: CURSOR_DURATION_MS,
      typeDelayMs: TYPE_DELAY_MS,
      settleDelayMs: SETTLE_DELAY_MS,
    },
    clips,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  log('[openclaw-demo] complete');
  log(`  output  : ${path.relative(rootDir, outputDir).replaceAll('\\', '/')}`);
  for (const clip of clips) {
    log(`  - ${clip.id}`);
    log(`    mp4 : ${clip.outputs.mp4}`);
    log(`    webm: ${clip.outputs.webm}`);
  }
}

await main();
