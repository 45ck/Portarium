import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const SHOWCASE_DIR = path.join(process.cwd(), 'examples/showcase/software-first-autonomy');
const MANIFEST_PATH = path.join(SHOWCASE_DIR, 'manifest.json');

describe('software-first autonomy multi-Project showcase', () => {
  it('declares one self-use micro-SaaS Project and one demo-only content Project', async () => {
    const manifest = await readManifest();

    expect(manifest.bead).toBe('bead-1104');
    expect(manifest.lane).toBe('showcase-demo-only');
    expect(manifest.status).toBe('recording-ready');

    const microSaas = manifest.projects.find(
      (project) => project.projectTypeId === 'micro-saas-agent-stack',
    );
    const content = manifest.projects.find(
      (project) => project.projectTypeId === 'content-artifact-loop',
    );

    expect(microSaas?.projectId).toBe('project-self-use-alpha-source-to-micro-saas');
    expect(microSaas?.productionClaim).toBe('self-use');
    expect(microSaas?.readinessLabel).toBe('self-use');
    expect(microSaas?.primaryArtifacts).toEqual(
      expect.arrayContaining(['research-dossier', 'product-brief', 'qa-evidence']),
    );

    expect(content?.projectId).toBe('project-demo-content-artifact-loop');
    expect(content?.productionClaim).toBe('demo-only');
    expect(content?.readinessLabel).toBe('demo-only');
    expect(content?.approvalPolicy).toContain('demo-only fixtures');
  });

  it('references existing assets and demo-machine specs from the manifest', async () => {
    const manifest = await readManifest();
    const referencedPaths = [
      ...manifest.assets,
      ...manifest.demoSpecs.map((spec) => spec.path),
      'examples/showcase/software-first-autonomy/showcase-manifest.schema.json',
      'examples/showcase/software-first-autonomy/README.md',
    ];

    for (const relativePath of referencedPaths) {
      const raw = await readFile(path.join(process.cwd(), relativePath), 'utf8');
      expect(raw.length, `${relativePath} should not be empty`).toBeGreaterThan(0);
    }
  });

  it('defines mobile approval/exception and desktop policy/evidence/intervention specs', async () => {
    const manifest = await readManifest();
    const mobile = manifest.demoSpecs.find((spec) => spec.id === 'mobile-approval-exception');
    const desktop = manifest.demoSpecs.find(
      (spec) => spec.id === 'desktop-project-switch-policy-evidence-intervention',
    );

    expect(mobile?.requiredBeats).toEqual(
      expect.arrayContaining(['mobile', 'approval', 'exception', 'evidence']),
    );
    expect(desktop?.requiredBeats).toEqual(
      expect.arrayContaining([
        'desktop',
        'project-switching',
        'policy',
        'evidence',
        'intervention',
      ]),
    );

    for (const spec of [mobile, desktop]) {
      expect(spec).toBeDefined();
      expect(spec!.projectIds).toEqual(
        expect.arrayContaining([
          'project-demo-content-artifact-loop',
          'project-self-use-alpha-source-to-micro-saas',
        ]),
      );
    }
  });

  it('enables required narration focus defaults in both demo-machine specs', async () => {
    const manifest = await readManifest();

    for (const specRef of manifest.demoSpecs) {
      const spec = await readDemoSpec(specRef.path);
      expect(spec.runner.command).toBe(manifest.runner.command);
      expect(spec.runner.url).toBe(manifest.runner.url);
      expect(spec.presentation.narrationFocus).toEqual({
        enabled: true,
        cursor: true,
        highlight: false,
        zoom: true,
        scale: 1.25,
        durationMs: 1600,
        transitionMs: 450,
      });
      expect(hasScreenshot(spec.chapters), specRef.path).toBe(true);
      expect(hasNarration(spec.chapters), specRef.path).toBe(true);
    }
  });

  it('uses stable showcase selectors for approval, policy, evidence, and intervention beats', async () => {
    const mobile = await readDemoSpec(
      'examples/showcase/software-first-autonomy/software-first-autonomy.mobile.demo.yaml',
    );
    const desktop = await readDemoSpec(
      'examples/showcase/software-first-autonomy/software-first-autonomy.desktop.demo.yaml',
    );
    const selectors = [...flattenSelectors(mobile), ...flattenSelectors(desktop)];

    expect(selectors).toEqual(
      expect.arrayContaining([
        "[data-testid='mobile-approval-panel']",
        "[data-testid='exception-summary']",
        "[data-testid='approve-with-exception']",
        "[data-testid='project-micro-saas']",
        "[data-testid='policy-panel']",
        "[data-testid='blocked-actions']",
        "[data-testid='evidence-panel']",
        "[data-testid='record-intervention']",
      ]),
    );
  });
});

async function readManifest(): Promise<ShowcaseManifest> {
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as ShowcaseManifest;
}

async function readDemoSpec(relativePath: string): Promise<DemoMachineSpec> {
  return parse(await readFile(path.join(process.cwd(), relativePath), 'utf8')) as DemoMachineSpec;
}

function hasScreenshot(chapters: DemoChapter[]): boolean {
  return chapters.some((chapter) => chapter.steps.some((step) => step.action === 'screenshot'));
}

function hasNarration(chapters: DemoChapter[]): boolean {
  return chapters.some((chapter) =>
    chapter.steps.some((step) => typeof step.narration === 'string' && step.narration.length > 0),
  );
}

function flattenSelectors(spec: DemoMachineSpec): string[] {
  return spec.chapters.flatMap((chapter) =>
    chapter.steps.flatMap((step) => [step.selector, step.focus?.selector].filter(isString)),
  );
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

interface ShowcaseManifest {
  bead: string;
  lane: string;
  status: string;
  runner: {
    command: string;
    url: string;
  };
  projects: ShowcaseProject[];
  demoSpecs: DemoSpecRef[];
  assets: string[];
}

interface ShowcaseProject {
  projectId: string;
  projectTypeId: string;
  readinessLabel: string;
  productionClaim: string;
  primaryArtifacts: string[];
  approvalPolicy: string;
}

interface DemoSpecRef {
  id: string;
  path: string;
  viewport: string;
  projectIds: string[];
  requiredBeats: string[];
}

interface DemoMachineSpec {
  runner: {
    command: string;
    url: string;
  };
  presentation: {
    narrationFocus: {
      enabled: boolean;
      cursor: boolean;
      highlight: boolean;
      zoom: boolean;
      scale: number;
      durationMs: number;
      transitionMs: number;
    };
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
  narration?: string;
  focus?: {
    selector?: string;
  };
}
