import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

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
  requiredMetricNames: readonly string[];
  scenarios: readonly Readonly<{
    scenarioId: string;
    beadId: string;
    status: string;
    blockedBy: readonly string[];
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
    expect(manifest.status).toBe('planned');
    expect(manifest.scenarios.every((scenario) => scenario.status === 'planned')).toBe(true);
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

  it('pins the shared metrics required by the dependent telemetry pack', () => {
    const manifest = readManifest();

    expect(new Set(manifest.requiredMetricNames)).toEqual(
      new Set([
        'approval_count_by_tier',
        'approval_count_by_session',
        'pending_age_ms_p50',
        'pending_age_ms_p95',
        'pending_age_ms_max',
        'resume_latency_ms',
        'blocked_duration_ms',
        'queue_depth_over_time',
        'denial_count',
        'request_changes_count',
        'escalation_count',
        'expiry_count',
        'duplicate_execution_count',
        'evidence_completeness_count',
        'restart_count',
        'successful_resume_count',
      ]),
    );
  });

  it('defines every dependent scenario contract and leaves it blocked on telemetry', () => {
    const manifest = readManifest();
    const scenarioByBead = new Map(
      manifest.scenarios.map((scenario) => [scenario.beadId, scenario]),
    );

    for (const beadId of ['bead-1042', 'bead-1043', 'bead-1044', 'bead-1045']) {
      const scenario = scenarioByBead.get(beadId);
      expect(scenario).toBeDefined();
      expect(scenario?.blockedBy).toContain('bead-1041');
      expect(scenario?.validates.length).toBeGreaterThanOrEqual(4);
      expect(existsSync(join(repoRoot, scenario?.contractPath ?? 'missing'))).toBe(true);
    }
  });
});
