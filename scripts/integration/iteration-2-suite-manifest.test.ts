import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ITERATION2_REQUIRED_METRIC_NAMES } from '../../experiments/shared/iteration2-telemetry.js';

type Iteration2Manifest = Readonly<{
  schemaVersion: number;
  suiteId: string;
  iteration: number;
  beadId: string;
  status: string;
  immutablePredecessors: readonly string[];
  resultPolicy: Readonly<{
    appendOnly: boolean;
    resultRoot: string;
    attemptDirectoryPattern: string;
    requiredArtifacts: readonly string[];
  }>;
  telemetryPack: Readonly<{
    beadId: string;
    helperPath: string;
    typeDefinitionsPath: string;
    writesArtifacts: readonly string[];
  }>;
  requiredMetricNames: readonly string[];
  scenarios: readonly Readonly<{
    scenarioId: string;
    beadId: string;
    status: string;
    blockedBy: readonly string[];
    runnerPath?: string;
    contractPath: string;
    comparesTo: string;
    validates: readonly string[];
  }>[];
}>;

const repoRoot = process.cwd();
const manifestPath = join(repoRoot, 'experiments', 'iteration-2', 'suite.manifest.json');

function readManifest(): Iteration2Manifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as Iteration2Manifest;
}

describe('Iteration 2 governed experiment suite manifest', () => {
  it('declares the bead-1040 suite without claiming dependent live runs are done', () => {
    const manifest = readManifest();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.suiteId).toBe('iteration-2-governed-business-scale');
    expect(manifest.iteration).toBe(2);
    expect(manifest.beadId).toBe('bead-1040');
    expect(manifest.status).toBe('telemetry-ready');
    expect(
      manifest.scenarios
        .filter(
          (scenario) =>
            scenario.scenarioId !== 'approval-backlog-soak' &&
            scenario.scenarioId !== 'micro-saas-agent-stack-v2',
        )
        .every((scenario) => scenario.status === 'planned'),
    ).toBe(true);
  });

  it('keeps prior experiment bundles immutable and writes v2 attempts append-only', () => {
    const manifest = readManifest();

    expect(manifest.immutablePredecessors).toEqual([
      'experiments/exp-A-transparency',
      'experiments/exp-B-fail-closed',
      'experiments/exp-C-approval-lifecycle',
    ]);
    expect(manifest.resultPolicy.appendOnly).toBe(true);
    expect(manifest.resultPolicy.resultRoot).toBe('experiments/iteration-2/results');
    expect(manifest.resultPolicy.attemptDirectoryPattern).toBe('<scenario-id>/<attempt-id>');
    expect(manifest.resultPolicy.requiredArtifacts).toEqual([
      'outcome.json',
      'evidence-summary.json',
      'queue-metrics.json',
      'report.md',
    ]);
  });

  it('pins the shared metrics implemented by the telemetry pack', () => {
    const manifest = readManifest();

    expect(new Set(manifest.requiredMetricNames)).toEqual(
      new Set(ITERATION2_REQUIRED_METRIC_NAMES),
    );
    expect(manifest.telemetryPack).toEqual({
      beadId: 'bead-1041',
      helperPath: 'experiments/shared/iteration2-telemetry.js',
      typeDefinitionsPath: 'experiments/shared/iteration2-telemetry.ts',
      writesArtifacts: ['queue-metrics.json', 'evidence-summary.json', 'report.md'],
    });
    expect(existsSync(join(repoRoot, manifest.telemetryPack.helperPath))).toBe(true);
    expect(existsSync(join(repoRoot, manifest.telemetryPack.typeDefinitionsPath))).toBe(true);
  });

  it('defines every dependent scenario contract', () => {
    const manifest = readManifest();
    const scenarioByBead = new Map(
      manifest.scenarios.map((scenario) => [scenario.beadId, scenario]),
    );

    for (const beadId of ['bead-1042', 'bead-1043', 'bead-1044', 'bead-1045']) {
      const scenario = scenarioByBead.get(beadId);
      expect(scenario).toBeDefined();
      expect(scenario?.validates.length).toBeGreaterThanOrEqual(4);
      expect(existsSync(join(repoRoot, scenario?.contractPath ?? 'missing'))).toBe(true);
    }
  });

  it('marks approval-backlog-soak as runnable with a checked runner', () => {
    const manifest = readManifest();
    const scenario = manifest.scenarios.find(
      (candidate) => candidate.scenarioId === 'approval-backlog-soak',
    );

    expect(scenario?.status).toBe('runnable-deterministic');
    expect(scenario?.runnerPath).toBe(
      'experiments/iteration-2/scenarios/approval-backlog-soak/run.mjs',
    );
    expect(existsSync(join(repoRoot, scenario?.runnerPath ?? 'missing'))).toBe(true);
  });

  it('marks micro-saas-agent-stack-v2 as runnable with a checked runner', () => {
    const manifest = readManifest();
    const scenario = manifest.scenarios.find(
      (candidate) => candidate.scenarioId === 'micro-saas-agent-stack-v2',
    );

    expect(scenario?.status).toBe('runnable-deterministic');
    expect(scenario?.runnerPath).toBe(
      'experiments/iteration-2/scenarios/micro-saas-agent-stack-v2/run.mjs',
    );
    expect(existsSync(join(repoRoot, scenario?.runnerPath ?? 'missing'))).toBe(true);
  });
});
