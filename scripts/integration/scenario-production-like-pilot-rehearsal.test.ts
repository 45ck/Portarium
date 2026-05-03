/**
 * Scenario: production-like pilot rehearsal for governed approval queues.
 *
 * Bead: bead-1146
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('production-like pilot rehearsal experiment', () => {
  it('captures SLOs, restart persistence, browser evidence, redaction, divergence, and Cockpit flow path', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-pilot-rehearsal-'));
    tempDirs.push(resultsDir);

    const mod =
      // @ts-expect-error The experiment is a checked .mjs runtime script.
      await import('../../experiments/iteration-2/scenarios/production-like-pilot-rehearsal/run.mjs');
    const outcome = await mod.runProductionLikePilotRehearsal({
      resultsDir,
      log: () => {},
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace['queueMetrics'].metrics.pending_age_ms_p95).toBeLessThanOrEqual(300_000);
    expect(trace['queueMetrics'].metrics.duplicate_execution_count).toBe(0);
    expect(trace['restartPersistence'].persistenceVerdict).toBe('survived-restart');
    expect(trace['browserQaEvidence'].commands).toContain(
      'npm run ab -- open http://cockpit.localhost:1355 --headed',
    );
    expect(trace['redactionAudit'].redacted).toBe(true);
    expect(trace['redactionAudit'].forbiddenFragmentsFound).toEqual([]);
    expect(
      trace['divergenceClassification'].divergences.some(
        (item: { classification: string }) => item.classification === 'product-defect',
      ),
    ).toBe(false);
    expect(
      trace['externalSorStubs'].effects.every(
        (effect: { mode: string }) => effect.mode === 'stubbed-external-sor-effect',
      ),
    ).toBe(true);

    for (const artifactName of [
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'report.md',
      'restart-persistence.json',
      'browser-qa-evidence.json',
      'redaction-audit.json',
      'divergence-classification.json',
      'external-sor-stubs.json',
    ]) {
      expect(existsSync(join(resultsDir, artifactName))).toBe(true);
    }
  });
});
