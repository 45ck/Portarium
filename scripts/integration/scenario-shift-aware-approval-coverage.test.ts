/**
 * Iteration 2: deterministic shift-aware approval routing and coverage.
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

describe('shift-aware-approval-coverage experiment', () => {
  it('records delegation windows, assignment evidence, escalation, SoD, and comparison report', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-shift-coverage-'));
    tempDirs.push(resultsDir);

    const mod =
      // @ts-expect-error The experiment is a checked .mjs runtime script.
      await import('../../experiments/iteration-2/scenarios/shift-aware-approval-coverage/run.mjs');
    const outcome = await mod.runShiftAwareApprovalCoverage({
      resultsDir,
      log: () => {},
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace['comparesTo']).toBe('micro-saas-agent-stack-v2');
    expect(trace['approvals']).toHaveLength(4);
    expect(trace['approvals'].every((approval: any) => approval.status === 'approved')).toBe(true);
    expect(trace['assignmentChanges']).toHaveLength(5);
    expect(trace['queueMetrics'].metrics.escalation_count).toBe(1);
    expect(trace['queueMetrics'].metrics.successful_resume_count).toBe(4);

    const evidenceKinds = new Set(
      trace['evidenceEvents'].map((event: { kind: string }) => event.kind),
    );
    expect(evidenceKinds).toEqual(
      new Set([
        'delegation_window_opened',
        'assignment_changed',
        'approval_decision',
        'run_resumed',
        'eligibility_rejected',
        'delegation_window_closed',
        'escalation_recorded',
      ]),
    );

    const sodRejection = trace['evidenceEvents'].find(
      (event: { kind: string; approvalId?: string }) =>
        event.kind === 'eligibility_rejected' && event.approvalId === 'appr-shift-04',
    );
    expect(sodRejection?.metadata.sodPreserved).toBe(true);

    const comparison = trace['comparison'] as Record<string, any>;
    expect(comparison['comparesTo']).toBe('micro-saas-agent-stack-v2');
    expect(comparison['metricComparison'].shiftAwareEscalationCount).toBe(1);
    expect(comparison['afterHoursBehavior']).toContain('bounded delegation');

    for (const artifactName of [
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'assignment-evidence.json',
      'report.md',
    ]) {
      expect(existsSync(join(resultsDir, artifactName))).toBe(true);
    }

    const assignmentEvidence = JSON.parse(
      readFileSync(join(resultsDir, 'assignment-evidence.json'), 'utf8'),
    ) as Record<string, any>;
    expect(assignmentEvidence['delegationWindow'].grantId).toBe('grant-after-hours-coverage-1');
    expect(assignmentEvidence['evidenceEvents']).toHaveLength(trace['evidenceEvents'].length);

    const report = readFileSync(join(resultsDir, 'report.md'), 'utf8');
    expect(report).toContain('After-Hours Coverage Comparison');
    expect(report).toContain('micro-saas-agent-stack-v2');
    expect(report).toContain('bounded delegation');
  });
});
