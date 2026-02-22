/**
 * Contract tests for the demo media pipeline (bead-0727).
 *
 * Validates:
 *  - gallery-index.json schema shape
 *  - clip spec YAML parsing contract
 *  - metadata.json per-clip shape
 *  - MP4/GIF output path conventions
 *  - dry-run mode produces gallery-index without browser
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = path.resolve(__dirname, '../../../');
const clipsDir = path.join(rootDir, 'docs/ui/cockpit/demo-machine/clips');
const galleryScript = path.join(rootDir, 'scripts/qa/render-demo-gallery.mjs');
const dryRunOutputDir = path.join(rootDir, 'tmp/demo-gallery-test');

// ---------------------------------------------------------------------------
// Gallery index schema
// ---------------------------------------------------------------------------

interface GalleryClip {
  id: string;
  title: string;
  tags: string[];
  generatedAt: string;
  outputs: { gif?: string; mp4?: string };
  frameCount: number;
}

interface GalleryIndex {
  $schema: string;
  version: string;
  generatedAt: string;
  generator: string;
  clips: GalleryClip[];
}

// ---------------------------------------------------------------------------
// Clip spec inventory
// ---------------------------------------------------------------------------

describe('demo clip specs', () => {
  it('has exactly 6 clip YAML files', () => {
    const files = fs.readdirSync(clipsDir).filter((f) => f.endsWith('.demo.yaml'));
    expect(files).toHaveLength(6);
  });

  it('all clip files follow the NNN-slug.demo.yaml naming convention', () => {
    const files = fs.readdirSync(clipsDir).filter((f) => f.endsWith('.demo.yaml'));
    for (const f of files) {
      expect(f).toMatch(/^\d{2}-[a-z0-9-]+\.demo\.yaml$/);
    }
  });

  it('each clip YAML contains required top-level sections', () => {
    const files = fs
      .readdirSync(clipsDir)
      .filter((f) => f.endsWith('.demo.yaml'))
      .map((f) => path.join(clipsDir, f));

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content, `${path.basename(file)} missing meta section`).toContain('meta:');
      expect(content, `${path.basename(file)} missing runner section`).toContain('runner:');
      expect(content, `${path.basename(file)} missing chapters section`).toContain('chapters:');
      expect(content, `${path.basename(file)} missing pacing section`).toContain('pacing:');
    }
  });

  it('each clip YAML has a meta.title', () => {
    const files = fs
      .readdirSync(clipsDir)
      .filter((f) => f.endsWith('.demo.yaml'))
      .map((f) => path.join(clipsDir, f));

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const titleMatch = content.match(/title:\s*['"](.+?)['"]/);
      expect(titleMatch, `${path.basename(file)} missing meta.title`).not.toBeNull();
      const titleValue: string = titleMatch?.[1] ?? '';
      expect(titleValue.length, `${path.basename(file)} title is empty`).toBeGreaterThan(0);
    }
  });

  it('each clip YAML includes at least one screenshot step', () => {
    const files = fs
      .readdirSync(clipsDir)
      .filter((f) => f.endsWith('.demo.yaml'))
      .map((f) => path.join(clipsDir, f));

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content, `${path.basename(file)} has no screenshot action`).toContain(
        'action: screenshot',
      );
    }
  });

  it('each clip has a Precondition Reset and Cleanup Reset chapter', () => {
    const files = fs
      .readdirSync(clipsDir)
      .filter((f) => f.endsWith('.demo.yaml'))
      .map((f) => path.join(clipsDir, f));

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content, `${path.basename(file)} missing Precondition Reset`).toContain(
        'Precondition Reset',
      );
      expect(content, `${path.basename(file)} missing Cleanup Reset`).toContain('Cleanup Reset');
    }
  });
});

// ---------------------------------------------------------------------------
// Render script existence
// ---------------------------------------------------------------------------

describe('render-demo-gallery.mjs script', () => {
  it('script file exists', () => {
    expect(fs.existsSync(galleryScript)).toBe(true);
  });

  it('script is valid ES module (starts with import or comment)', () => {
    const content = fs.readFileSync(galleryScript, 'utf8');
    const firstLine = content.split('\n')[0];
    // Allow comment block or import
    expect(firstLine).toMatch(/^\/\*\*|^\/\/|^import/);
  });

  it('script exports no module (runs as main entrypoint)', () => {
    const content = fs.readFileSync(galleryScript, 'utf8');
    // Should call main at end, not export it
    expect(content).toContain('await main()');
  });

  it('script references gallery-index.json output', () => {
    const content = fs.readFileSync(galleryScript, 'utf8');
    expect(content).toContain('gallery-index.json');
  });

  it('script supports --dry-run flag', () => {
    const content = fs.readFileSync(galleryScript, 'utf8');
    expect(content).toContain('--dry-run');
  });

  it('script renders both GIF and MP4 outputs', () => {
    const content = fs.readFileSync(galleryScript, 'utf8');
    expect(content).toContain('.gif');
    expect(content).toContain('.mp4');
  });
});

// ---------------------------------------------------------------------------
// Dry-run execution
// ---------------------------------------------------------------------------

describe('dry-run gallery render', () => {
  let galleryIndex: GalleryIndex | null = null;

  it('dry-run exits 0 and writes gallery-index.json', () => {
    // Clean output dir
    if (fs.existsSync(dryRunOutputDir)) {
      fs.rmSync(dryRunOutputDir, { recursive: true, force: true });
    }

    const result = spawnSync('node', [galleryScript, '--dry-run', '--output', dryRunOutputDir], {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    if (result.status !== 0) {
      console.error('stdout:', result.stdout);
      console.error('stderr:', result.stderr);
    }
    expect(result.status).toBe(0);

    const galleryPath = path.join(dryRunOutputDir, 'gallery-index.json');
    expect(fs.existsSync(galleryPath)).toBe(true);

    galleryIndex = JSON.parse(fs.readFileSync(galleryPath, 'utf8')) as GalleryIndex;
  });

  it('gallery-index.json has required top-level fields', () => {
    expect(galleryIndex).not.toBeNull();
    expect(galleryIndex!.version).toBe('1.0.0');
    expect(galleryIndex!.generator).toContain('render-demo-gallery.mjs');
    expect(galleryIndex!.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Array.isArray(galleryIndex!.clips)).toBe(true);
  });

  it('gallery-index.json lists all 6 clips', () => {
    expect(galleryIndex).not.toBeNull();
    expect(galleryIndex!.clips).toHaveLength(6);
  });

  it('each clip entry has id, title, tags, generatedAt, outputs, frameCount', () => {
    expect(galleryIndex).not.toBeNull();
    for (const clip of galleryIndex!.clips) {
      expect(typeof clip.id).toBe('string');
      expect(clip.id.length).toBeGreaterThan(0);
      expect(typeof clip.title).toBe('string');
      expect(clip.title.length).toBeGreaterThan(0);
      expect(Array.isArray(clip.tags)).toBe(true);
      expect(clip.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(typeof clip.outputs).toBe('object');
      expect(typeof clip.frameCount).toBe('number');
      expect(clip.frameCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('dry-run clip ids match clip file basenames', () => {
    expect(galleryIndex).not.toBeNull();
    const expectedIds = fs
      .readdirSync(clipsDir)
      .filter((f) => f.endsWith('.demo.yaml'))
      .sort()
      .map((f) => f.replace('.demo.yaml', ''));

    const actualIds = galleryIndex!.clips.map((c) => c.id).sort();
    expect(actualIds).toEqual(expectedIds);
  });

  it('gallery-index schema file is written', () => {
    const schemaPath = path.join(dryRunOutputDir, 'gallery-index.schema.json');
    expect(fs.existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    expect(schema.$schema).toContain('json-schema.org');
    expect(schema.title).toContain('Gallery Index');
  });

  it('per-clip output directories are created', () => {
    expect(galleryIndex).not.toBeNull();
    for (const clip of galleryIndex!.clips) {
      const clipDir = path.join(dryRunOutputDir, clip.id);
      expect(fs.existsSync(clipDir), `missing clip dir: ${clip.id}`).toBe(true);
    }
  });

  it('per-clip metadata.json is written', () => {
    expect(galleryIndex).not.toBeNull();
    for (const clip of galleryIndex!.clips) {
      const metaPath = path.join(dryRunOutputDir, clip.id, 'metadata.json');
      expect(fs.existsSync(metaPath), `missing metadata.json for: ${clip.id}`).toBe(true);
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      expect(meta.id).toBe(clip.id);
      expect(meta.title).toBe(clip.title);
      expect(Array.isArray(meta.frames)).toBe(true);
      expect(typeof meta.outputs).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// Package.json scripts registration
// ---------------------------------------------------------------------------

describe('npm script registration', () => {
  it('package.json has cockpit:demo:gallery script', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts['cockpit:demo:gallery']).toBeDefined();
    expect(pkg.scripts['cockpit:demo:gallery']).toContain('render-demo-gallery.mjs');
  });

  it('package.json has cockpit:demo:gallery:dry-run script', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts['cockpit:demo:gallery:dry-run']).toBeDefined();
    expect(pkg.scripts['cockpit:demo:gallery:dry-run']).toContain('--dry-run');
  });
});
