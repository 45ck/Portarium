/**
 * Demo Media Pipeline (bead-0727)
 *
 * Renders MP4 + GIF previews for all demo-machine clip specs and
 * publishes a gallery manifest (gallery-index.json) listing every artifact.
 *
 * Usage:
 *   node scripts/qa/render-demo-gallery.mjs [--clips <glob>] [--output <dir>] [--dry-run]
 *
 * Outputs per clip:
 *   <output>/<clip-id>/frames/frame-NNN.png
 *   <output>/<clip-id>/<clip-id>.gif
 *   <output>/<clip-id>/<clip-id>.mp4      (when ffmpeg is available)
 *   <output>/<clip-id>/metadata.json
 *
 * Gallery:
 *   <output>/gallery-index.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clipsDir = path.join(rootDir, 'docs/ui/cockpit/demo-machine/clips');
const defaultOutputDir = path.join(rootDir, 'docs/ui/cockpit/demo-machine/gallery');
const cockpitHtmlPath = path.join(rootDir, 'docs/ui/cockpit/index.html');
const baseUrl = pathToFileURL(cockpitHtmlPath).href;

const VIEWPORT = { width: 1280, height: 720 };
const FRAME_DELAY_MS = 1500; // GIF frame duration

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const outputDir = (() => {
  const idx = args.indexOf('--output');
  return idx >= 0 ? path.resolve(args[idx + 1]) : defaultOutputDir;
})();
const clipGlob = (() => {
  const idx = args.indexOf('--clips');
  return idx >= 0 ? args[idx + 1] : null;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function hasPython() {
  for (const bin of ['python3', 'python']) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'pipe' });
      return bin;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Load a .demo.yaml clip spec from disk.
 * We avoid a full YAML parser dependency and parse the minimal subset we need.
 */
function loadClipSpec(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  // Extract meta.title
  const titleMatch = raw.match(/title:\s*['"](.+?)['"]/);
  const title = titleMatch ? titleMatch[1] : path.basename(filePath, '.demo.yaml');

  // Extract meta.tags
  const tagsSection = raw.match(/tags:\s*([\s\S]*?)(?=\n\S)/);
  const tags = tagsSection
    ? tagsSection[1]
        .split('\n')
        .map((l) => l.trim().replace(/^-\s*/, ''))
        .filter(Boolean)
    : [];

  // Extract runner.url
  const urlMatch = raw.match(/url:\s*['"](.+?)['"]/);
  const url = urlMatch ? urlMatch[1] : 'http://localhost:4174';

  // Extract chapter titles (for labelling frames)
  const chapterTitles = [...raw.matchAll(/- title:\s*['"](.+?)['"]/g)].map((m) => m[1]);

  // Extract screenshot names
  const screenshotNames = [
    ...raw.matchAll(/action:\s*screenshot[\s\S]*?name:\s*['"](.+?)['"]/g),
  ].map((m) => m[1]);

  // Build flat step list for execution
  const steps = parseSteps(raw);

  return { title, tags, url, chapterTitles, screenshotNames, steps };
}

/**
 * Parse steps from the YAML clips into a flat action list.
 * Only supports the action types used in the 6 standard clips.
 */
function parseSteps(raw) {
  const steps = [];
  // Find all step blocks: each starts with `- action: <type>`
  const stepBlocks = [
    ...raw.matchAll(/- action:\s*(\S+)([\s\S]*?)(?=\n\s+- action:|\n  - title:|\nchapters:|\z)/g),
  ];
  for (const block of stepBlocks) {
    const actionType = block[1].trim();
    const body = block[2];
    const step = { action: actionType };

    const urlMatch = body.match(/url:\s*['"](.+?)['"]/);
    const selectorMatch = body.match(/selector:\s*['"](.+?)['"]/);
    const keyMatch = body.match(/key:\s*['"](.+?)['"]/);
    const timeoutMatch = body.match(/timeout:\s*(\d+)/);
    const nameMatch = body.match(/name:\s*['"](.+?)['"]/);

    if (urlMatch) step.url = urlMatch[1];
    if (selectorMatch) step.selector = selectorMatch[1];
    if (keyMatch) step.key = keyMatch[1];
    if (timeoutMatch) step.timeout = Number(timeoutMatch[1]);
    if (nameMatch) step.name = nameMatch[1];

    steps.push(step);
  }
  return steps;
}

/**
 * Execute a parsed step list against a Puppeteer page, returning frame paths.
 */
async function executeSteps(page, steps, framesDir, clipId) {
  const framePaths = [];
  let frameCounter = 0;

  for (const step of steps) {
    switch (step.action) {
      case 'navigate':
        await page.goto(step.url, { waitUntil: 'load' }).catch(() => {});
        await sleep(step.timeout ?? 500);
        break;

      case 'wait':
        await sleep(step.timeout ?? 500);
        break;

      case 'click': {
        const el = await page.$(step.selector).catch(() => null);
        if (el) {
          await el.click().catch(() => {});
        }
        await sleep(300);
        break;
      }

      case 'press':
        await page.keyboard.press(step.key ?? 'Enter').catch(() => {});
        await sleep(200);
        break;

      case 'assert':
        // Soft assert — just waits for selector to be present (best-effort)
        await page.waitForSelector(step.selector, { timeout: 3000 }).catch(() => {});
        break;

      case 'screenshot': {
        frameCounter += 1;
        const frameName = `frame-${String(frameCounter).padStart(3, '0')}-${step.name ?? 'shot'}.png`;
        const framePath = path.join(framesDir, frameName);
        await page.screenshot({ path: framePath, clip: { x: 0, y: 0, ...VIEWPORT } });
        framePaths.push(framePath);
        break;
      }

      default:
        // Unknown action — skip
        break;
    }
  }

  // If no explicit screenshots, take a final summary frame
  if (framePaths.length === 0) {
    frameCounter += 1;
    const framePath = path.join(
      framesDir,
      `frame-${String(frameCounter).padStart(3, '0')}-final.png`,
    );
    await page.screenshot({ path: framePath, clip: { x: 0, y: 0, ...VIEWPORT } });
    framePaths.push(framePath);
  }

  return framePaths;
}

/**
 * Render a GIF from frame PNGs using Python/Pillow.
 * Returns the gif path or null on failure.
 */
function renderGif(framesDir, gifPath, pythonBin) {
  const pythonCode = [
    'import glob, sys',
    'from PIL import Image',
    'pattern = sys.argv[1]',
    'gif = sys.argv[2]',
    `delay = int(sys.argv[3]) if len(sys.argv) > 3 else ${FRAME_DELAY_MS}`,
    'frame_paths = sorted(glob.glob(pattern))',
    'if not frame_paths:',
    '    raise SystemExit("No frames found")',
    'frames = [Image.open(p).convert("RGB").quantize(256) for p in frame_paths]',
    'frames[0].save(gif, save_all=True, append_images=frames[1:], duration=delay, loop=0, optimize=True)',
  ].join('\n');

  const result = spawnSync(
    pythonBin,
    ['-c', pythonCode, `${framesDir}/*.png`, gifPath, String(FRAME_DELAY_MS)],
    {
      cwd: framesDir,
      stdio: 'pipe',
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    console.warn(`  [warn] GIF render failed: ${result.stderr?.trim()}`);
    return null;
  }

  return gifPath;
}

/**
 * Render an MP4 from frame PNGs using ffmpeg.
 * Returns the mp4 path or null when ffmpeg is unavailable/fails.
 */
function renderMp4(framesDir, mp4Path) {
  if (!hasFfmpeg()) return null;

  // ffmpeg glob input: frame-%03d-*.png doesn't work for mixed names, use a file list
  const frameFiles = fs
    .readdirSync(framesDir)
    .filter((f) => f.endsWith('.png'))
    .sort()
    .map((f) => `file '${path.join(framesDir, f).replaceAll("'", "'\\''")}'`);

  if (frameFiles.length === 0) return null;

  const listPath = path.join(framesDir, 'ffmpeg-input.txt');
  fs.writeFileSync(listPath, frameFiles.join('\n') + '\n');

  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-vf',
      `fps=1,scale=${VIEWPORT.width}:${VIEWPORT.height}`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '23',
      mp4Path,
    ],
    { stdio: 'pipe', encoding: 'utf8' },
  );

  if (result.status !== 0) {
    console.warn(`  [warn] MP4 render failed: ${result.stderr?.slice(-300)}`);
    return null;
  }

  return mp4Path;
}

// ---------------------------------------------------------------------------
// Per-clip pipeline
// ---------------------------------------------------------------------------

async function renderClip(clipFile, puppeteer, pythonBin) {
  const clipId = path.basename(clipFile, '.demo.yaml');
  const spec = loadClipSpec(clipFile);

  const clipOutputDir = path.join(outputDir, clipId);
  const framesDir = path.join(clipOutputDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  console.log(`\n[clip] ${clipId}`);
  console.log(`  title : ${spec.title}`);

  if (dryRun) {
    console.log(`  [dry-run] skipping browser execution`);
    return buildMetadata(clipId, spec, clipOutputDir, [], null, null);
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: VIEWPORT,
  });

  let framePaths = [];
  try {
    const page = await browser.newPage();

    // Best-effort: navigate to base URL first so the page is hydrated
    await page.goto(baseUrl, { waitUntil: 'load', timeout: 15_000 }).catch(() => {});
    await sleep(600);

    framePaths = await executeSteps(page, spec.steps, framesDir, clipId);
    console.log(`  frames: ${framePaths.length}`);
  } finally {
    await browser.close();
  }

  // GIF
  const gifPath = path.join(clipOutputDir, `${clipId}.gif`);
  const gifResult = pythonBin ? renderGif(framesDir, gifPath, pythonBin) : null;
  if (gifResult) console.log(`  gif   : ${path.relative(rootDir, gifResult)}`);

  // MP4
  const mp4Path = path.join(clipOutputDir, `${clipId}.mp4`);
  const mp4Result = renderMp4(framesDir, mp4Path);
  if (mp4Result) console.log(`  mp4   : ${path.relative(rootDir, mp4Result)}`);

  return buildMetadata(clipId, spec, clipOutputDir, framePaths, gifResult, mp4Result);
}

function buildMetadata(clipId, spec, clipOutputDir, framePaths, gifPath, mp4Path) {
  const outputs = {};
  if (gifPath && fs.existsSync(gifPath)) {
    outputs.gif = path.relative(rootDir, gifPath).replaceAll('\\', '/');
  }
  if (mp4Path && fs.existsSync(mp4Path)) {
    outputs.mp4 = path.relative(rootDir, mp4Path).replaceAll('\\', '/');
  }

  const meta = {
    id: clipId,
    title: spec.title,
    tags: spec.tags,
    chapters: spec.chapterTitles,
    generatedAt: new Date().toISOString(),
    frames: framePaths.map((p) => path.relative(rootDir, p).replaceAll('\\', '/')),
    outputs,
  };

  const metaPath = path.join(clipOutputDir, 'metadata.json');
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  return meta;
}

// ---------------------------------------------------------------------------
// Gallery index
// ---------------------------------------------------------------------------

function writeGalleryIndex(clipsMetadata) {
  const galleryPath = path.join(outputDir, 'gallery-index.json');
  const gallery = {
    $schema: './gallery-index.schema.json',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    generator: 'scripts/qa/render-demo-gallery.mjs',
    clips: clipsMetadata.map((m) => ({
      id: m.id,
      title: m.title,
      tags: m.tags,
      generatedAt: m.generatedAt,
      outputs: m.outputs,
      frameCount: m.frames.length,
    })),
  };

  fs.writeFileSync(galleryPath, `${JSON.stringify(gallery, null, 2)}\n`);
  console.log(`\n[gallery] ${path.relative(rootDir, galleryPath)}`);
  return galleryPath;
}

function writeGallerySchema() {
  const schemaPath = path.join(outputDir, 'gallery-index.schema.json');
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Portarium Demo Gallery Index',
    type: 'object',
    required: ['version', 'generatedAt', 'generator', 'clips'],
    properties: {
      version: { type: 'string' },
      generatedAt: { type: 'string', format: 'date-time' },
      generator: { type: 'string' },
      clips: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'title', 'tags', 'generatedAt', 'outputs', 'frameCount'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            generatedAt: { type: 'string', format: 'date-time' },
            outputs: {
              type: 'object',
              properties: {
                gif: { type: 'string' },
                mp4: { type: 'string' },
              },
            },
            frameCount: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
  };
  fs.writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[demo-gallery] render-demo-gallery.mjs');
  console.log(`  outputDir : ${outputDir}`);
  console.log(`  dryRun    : ${dryRun}`);

  if (!dryRun && !fs.existsSync(cockpitHtmlPath)) {
    console.error(`[error] Cockpit HTML not found: ${cockpitHtmlPath}`);
    process.exit(1);
  }

  // Collect clip files
  let clipFiles = fs
    .readdirSync(clipsDir)
    .filter((f) => f.endsWith('.demo.yaml'))
    .sort()
    .map((f) => path.join(clipsDir, f));

  if (clipGlob) {
    clipFiles = clipFiles.filter((f) => path.basename(f).includes(clipGlob));
  }

  if (clipFiles.length === 0) {
    console.error(`[error] No clip specs found in ${clipsDir}`);
    process.exit(1);
  }

  console.log(`  clips     : ${clipFiles.length}`);

  fs.mkdirSync(outputDir, { recursive: true });
  writeGallerySchema();

  // Lazily import puppeteer (optional dep)
  let puppeteer;
  if (!dryRun) {
    try {
      const require = createRequire(import.meta.url);
      puppeteer = require('puppeteer');
    } catch {
      try {
        puppeteer = (await import('puppeteer')).default;
      } catch {
        console.error('[error] puppeteer not installed. Run: npm install puppeteer');
        process.exit(1);
      }
    }
  }

  const pythonBin = dryRun ? null : hasPython();
  if (!dryRun && !pythonBin) {
    console.warn('[warn] Python/Pillow not found — GIF rendering disabled');
  }
  if (!dryRun && hasFfmpeg()) {
    console.log('[info] ffmpeg found — MP4 rendering enabled');
  } else if (!dryRun) {
    console.warn('[warn] ffmpeg not found — MP4 rendering disabled');
  }

  const allMeta = [];
  for (const clipFile of clipFiles) {
    const meta = await renderClip(clipFile, puppeteer, pythonBin);
    allMeta.push(meta);
  }

  writeGalleryIndex(allMeta);

  const gifCount = allMeta.filter((m) => m.outputs.gif).length;
  const mp4Count = allMeta.filter((m) => m.outputs.mp4).length;

  console.log(`\n[done] ${allMeta.length} clips, ${gifCount} GIFs, ${mp4Count} MP4s`);
  console.log(`       gallery-index: docs/ui/cockpit/demo-machine/gallery/gallery-index.json`);
}

await main();
