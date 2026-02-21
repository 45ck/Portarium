import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const CLIPS_DIR = path.join(process.cwd(), 'docs/ui/cockpit/demo-machine/clips');

const EXPECTED_CLIPS = [
  '01-approval-gate-unblocks-run.demo.yaml',
  '02-evidence-chain-update-on-decision.demo.yaml',
  '03-correlation-context-traversal.demo.yaml',
  '04-capability-matrix-connector-posture.demo.yaml',
  '05-degraded-realtime-safety-ux.demo.yaml',
  '06-agent-integration-quickstart.demo.yaml',
] as const;

describe('cockpit demo-machine showcase scripts', () => {
  it('defines exactly six deterministic clip specs for bead-0726 storylines', async () => {
    const files = (await readdir(CLIPS_DIR)).filter((file) => file.endsWith('.demo.yaml')).sort();
    expect(files).toEqual([...EXPECTED_CLIPS]);
  });

  it('enforces reproducible precondition and cleanup reset handling per clip', async () => {
    for (const clip of EXPECTED_CLIPS) {
      const clipPath = path.join(CLIPS_DIR, clip);
      const raw = await readFile(clipPath, 'utf8');
      const doc = parse(raw) as DemoMachineSpec;

      expect(doc.runner.command).toBe('npx --yes http-server docs/ui/cockpit -p 4174');
      expect(doc.runner.url).toBe('http://localhost:4174');

      expect(doc.chapters.length).toBeGreaterThan(0);
      const firstChapter = doc.chapters[0]!;
      const lastChapter = doc.chapters[doc.chapters.length - 1]!;
      expect(firstChapter.title).toBe('Precondition Reset');
      expect(lastChapter.title).toBe('Cleanup Reset');

      expect(hasResetClick(firstChapter.steps)).toBe(true);
      expect(hasResetClick(lastChapter.steps)).toBe(true);
      expect(hasScreenshot(doc.chapters)).toBe(true);
      expect(doc.meta.tags).toContain('bead-0726');
    }
  });
});

function hasResetClick(steps: DemoStep[]): boolean {
  return steps.some((step) => step.action === 'click' && step.selector === '#demoResetButton');
}

function hasScreenshot(chapters: DemoChapter[]): boolean {
  return chapters.some((chapter) => chapter.steps.some((step) => step.action === 'screenshot'));
}

interface DemoMachineSpec {
  meta: {
    tags: string[];
  };
  runner: {
    command: string;
    url: string;
  };
  chapters: DemoChapter[];
}

interface DemoChapter {
  title: string;
  steps: DemoStep[];
}

interface DemoStep {
  action: string;
  selector?: string;
}
