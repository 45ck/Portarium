/**
 * Iteration 2: cited source-to-artifact loop for content and micro-SaaS candidates.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('source-to-artifact-citation-loop experiment', () => {
  it('preserves citations from source snapshots through content and micro-SaaS artifacts', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-source-to-artifact-'));
    tempDirs.push(resultsDir);

    const mod =
      // @ts-expect-error The experiment is a checked .mjs runtime script.
      await import('../../experiments/iteration-2/scenarios/source-to-artifact-citation-loop/run.mjs');
    const outcome = await mod.runSourceToArtifactCitationLoop({
      resultsDir,
      log: () => {},
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace['comparesTo']).toBe('micro-saas-toolchain-redo');
    expect(trace['sourceSnapshots']).toHaveLength(3);
    expect(trace['dossier'].claims).toHaveLength(4);
    expect(
      trace['dossier'].claims.every(
        (claim: { citations: unknown[]; confidence: string }) =>
          claim.citations.length > 0 && claim.confidence !== 'unknown',
      ),
    ).toBe(true);

    const artifacts = trace['artifacts'] as {
      artifactClass: string;
      sourceSnapshotIds: string[];
      claimIdsUsed: string[];
      confidenceContext: Record<string, unknown>;
      readiness: string;
    }[];
    expect(artifacts.map((artifact) => artifact.artifactClass).sort()).toEqual([
      'content',
      'micro-saas',
    ]);
    expect(artifacts.every((artifact) => artifact.sourceSnapshotIds.length === 3)).toBe(true);
    expect(
      artifacts.every((artifact) =>
        artifact.claimIdsUsed.every((claimId) => artifact.confidenceContext[claimId] != null),
      ),
    ).toBe(true);
    expect(artifacts.find((artifact) => artifact.artifactClass === 'content')?.readiness).toBe(
      'internal-draft-only',
    );
    expect(artifacts.find((artifact) => artifact.artifactClass === 'micro-saas')?.readiness).toBe(
      'planning-ready-with-approval',
    );

    expect(trace['interventions'].map((item: { kind: string }) => item.kind).sort()).toEqual([
      'evidence-quality',
      'scope-correction',
      'taste-feedback',
    ]);
    expect(trace['citationProvenance'].sufficiency.contentPublication).toBe(
      'blocked-pending-more-evidence',
    );
    expect(trace['queueMetrics'].metrics.request_changes_count).toBe(2);
    expect(trace['queueMetrics'].metrics.successful_resume_count).toBe(2);

    for (const artifactName of [
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'report.md',
      'source-snapshots.json',
      'research-dossier.json',
      'downstream-artifacts.json',
      'operator-interventions.json',
      'citation-provenance.json',
    ]) {
      expect(existsSync(join(resultsDir, artifactName))).toBe(true);
    }

    const downstreamArtifacts = JSON.parse(
      readFileSync(join(resultsDir, 'downstream-artifacts.json'), 'utf8'),
    ) as { artifacts: { claimIdsUsed: string[]; sourceSnapshotIds: string[] }[] };
    expect(downstreamArtifacts.artifacts).toHaveLength(2);
    expect(
      downstreamArtifacts.artifacts.every(
        (artifact) => artifact.claimIdsUsed.length > 0 && artifact.sourceSnapshotIds.length === 3,
      ),
    ).toBe(true);

    const report = readFileSync(join(resultsDir, 'report.md'), 'utf8');
    expect(report).toContain('Source To Artifact Loop');
    expect(report).toContain('Artifact Profiles');
    expect(report).toContain('blocked-pending-more-evidence');
  });
});
