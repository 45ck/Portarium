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
    artifactExpectations?: Readonly<{
      requiredArtifacts: readonly string[];
      redactedArtifacts: readonly string[];
      forbiddenFragments: readonly string[];
    }>;
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
            scenario.scenarioId !== 'growth-studio-openclaw-live-v2' &&
            scenario.scenarioId !== 'openclaw-concurrent-sessions' &&
            scenario.scenarioId !== 'approval-backlog-soak' &&
            scenario.scenarioId !== 'micro-saas-agent-stack-v2' &&
            scenario.scenarioId !== 'micro-saas-toolchain-redo' &&
            scenario.scenarioId !== 'governed-resume-recovery' &&
            scenario.scenarioId !== 'shift-aware-approval-coverage' &&
            scenario.scenarioId !== 'execution-reservation-recovery' &&
            scenario.scenarioId !== 'production-like-pilot-rehearsal',
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

    for (const beadId of [
      'bead-1042',
      'bead-1043',
      'bead-1044',
      'bead-1045',
      'bead-1046',
      'bead-1059',
      'bead-1069',
      'bead-1142',
      'bead-1146',
    ]) {
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

  it('marks micro-saas-toolchain-redo as runnable with toolchain artifacts', () => {
    const manifest = readManifest();
    const scenario = manifest.scenarios.find(
      (candidate) => candidate.scenarioId === 'micro-saas-toolchain-redo',
    );

    expect(scenario?.status).toBe('runnable-deterministic');
    expect(scenario?.beadId).toBe('bead-1046');
    expect(scenario?.runnerPath).toBe(
      'experiments/iteration-2/scenarios/micro-saas-toolchain-redo/run.mjs',
    );
    expect(scenario?.comparesTo).toBe('micro-saas-agent-stack-v2');
    expect(existsSync(join(repoRoot, scenario?.runnerPath ?? 'missing'))).toBe(true);
    expect(scenario?.artifactExpectations?.requiredArtifacts).toEqual([
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'report.md',
      'toolchain-preflight.json',
      'tool-usage-evidence.json',
      'content-machine-output.json',
      'external-effect-stubs.json',
    ]);
  });

  it('marks growth-studio-openclaw-live-v2 as runnable with a checked runner', () => {
    const manifest = readManifest();
    const scenario = manifest.scenarios.find(
      (candidate) => candidate.scenarioId === 'growth-studio-openclaw-live-v2',
    );

    expect(scenario?.status).toBe('runnable-deterministic');
    expect(scenario?.runnerPath).toBe(
      'experiments/iteration-2/scenarios/growth-studio-openclaw-live-v2/run.mjs',
    );
    expect(existsSync(join(repoRoot, scenario?.runnerPath ?? 'missing'))).toBe(true);
  });

  it('marks openclaw-concurrent-sessions as runnable with a checked runner', () => {
    const manifest = readManifest();
    const scenario = manifest.scenarios.find(
      (candidate) => candidate.scenarioId === 'openclaw-concurrent-sessions',
    );

    expect(scenario?.status).toBe('runnable-deterministic');
    expect(scenario?.runnerPath).toBe(
      'experiments/iteration-2/scenarios/openclaw-concurrent-sessions/run.mjs',
    );
    expect(existsSync(join(repoRoot, scenario?.runnerPath ?? 'missing'))).toBe(true);
  });

  it('marks governed-resume-recovery as runnable with a checked runner', () => {
    const manifest = readManifest();
    const scenario = manifest.scenarios.find(
      (candidate) => candidate.scenarioId === 'governed-resume-recovery',
    );

    expect(scenario?.status).toBe('runnable-deterministic');
    expect(scenario?.beadId).toBe('bead-1059');
    expect(scenario?.runnerPath).toBe(
      'experiments/iteration-2/scenarios/governed-resume-recovery/run.mjs',
    );
    expect(scenario?.comparesTo).toBe('growth-studio-openclaw-live-v2');
    expect(existsSync(join(repoRoot, scenario?.runnerPath ?? 'missing'))).toBe(true);
  });

  it('marks execution-reservation-recovery as runnable with a checked runner', () => {
    const manifest = readManifest();
    const scenario = manifest.scenarios.find(
      (candidate) => candidate.scenarioId === 'execution-reservation-recovery',
    );

    expect(scenario?.status).toBe('runnable-deterministic');
    expect(scenario?.beadId).toBe('bead-1142');
    expect(scenario?.runnerPath).toBe(
      'experiments/iteration-2/scenarios/execution-reservation-recovery/run.mjs',
    );
    expect(scenario?.comparesTo).toBe('governed-resume-recovery');
    expect(existsSync(join(repoRoot, scenario?.runnerPath ?? 'missing'))).toBe(true);
    expect(scenario?.artifactExpectations?.requiredArtifacts).toEqual([
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'report.md',
      'reservation-ledger-redacted.json',
      'dispatch-attempts-redacted.json',
      'recovery-decisions-redacted.json',
    ]);
    expect(scenario?.artifactExpectations?.redactedArtifacts).toEqual([
      'reservation-ledger-redacted.json',
      'dispatch-attempts-redacted.json',
      'recovery-decisions-redacted.json',
    ]);
    expect(scenario?.artifactExpectations?.forbiddenFragments).toEqual([
      'Bearer source-authorization-value',
      'source-oauth-token',
      'operator@example.test',
      'customer@example.test',
      'https://api.vendor.example/customers/private-123',
    ]);
  });

  it('marks shift-aware-approval-coverage as runnable with assignment evidence expectations', () => {
    const manifest = readManifest();
    const scenario = manifest.scenarios.find(
      (candidate) => candidate.scenarioId === 'shift-aware-approval-coverage',
    );

    expect(scenario?.status).toBe('runnable-deterministic');
    expect(scenario?.beadId).toBe('bead-1069');
    expect(scenario?.runnerPath).toBe(
      'experiments/iteration-2/scenarios/shift-aware-approval-coverage/run.mjs',
    );
    expect(scenario?.comparesTo).toBe('micro-saas-agent-stack-v2');
    expect(existsSync(join(repoRoot, scenario?.runnerPath ?? 'missing'))).toBe(true);
    expect(scenario?.artifactExpectations?.requiredArtifacts).toEqual([
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'report.md',
      'assignment-evidence.json',
    ]);
  });

  it('marks production-like-pilot-rehearsal as runnable with pilot evidence expectations', () => {
    const manifest = readManifest();
    const scenario = manifest.scenarios.find(
      (candidate) => candidate.scenarioId === 'production-like-pilot-rehearsal',
    );

    expect(scenario?.status).toBe('runnable-deterministic');
    expect(scenario?.beadId).toBe('bead-1146');
    expect(scenario?.blockedBy).toEqual(['bead-1047']);
    expect(scenario?.runnerPath).toBe(
      'experiments/iteration-2/scenarios/production-like-pilot-rehearsal/run.mjs',
    );
    expect(scenario?.comparesTo).toBe('iteration-2-governed-business-scale');
    expect(existsSync(join(repoRoot, scenario?.runnerPath ?? 'missing'))).toBe(true);
    expect(scenario?.artifactExpectations?.requiredArtifacts).toEqual([
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'report.md',
      'restart-persistence.json',
      'browser-qa-evidence.json',
      'redaction-audit.json',
      'divergence-classification.json',
      'external-sor-stubs.json',
    ]);
    expect(scenario?.artifactExpectations?.redactedArtifacts).toContain('external-sor-stubs.json');
  });
});
