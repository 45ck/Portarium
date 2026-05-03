import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ExecutionTier } from '../../src/domain/primitives/index.js';
import {
  coerceVerificationFindingIdsV1,
  parseVerificationSamplingRuleV1,
  routeVerificationAuditFindingV1,
  summarizeVerificationCoverageV1,
  type VerificationCoverageObservationV1,
  type VerificationOutcomeV1,
} from '../../src/domain/policy/delegated-autonomy-verification-sampling-v1.js';

const COVERAGE_ARTIFACT_RELATIVE_PATH =
  'docs/internal/governance/contained-pilot-verification-sampling-coverage.json';
const COVERAGE_ARTIFACT_PATH = path.join(process.cwd(), COVERAGE_ARTIFACT_RELATIVE_PATH);
const SELF_USE_ALPHA_PATH = path.join(
  process.cwd(),
  'docs/internal/governance/source-to-micro-saas-self-use-alpha.json',
);
const PILOT_REPORT_MARKDOWN_PATH = path.join(
  process.cwd(),
  'docs/internal/governance/pilot-readiness-decision-report.md',
);
const PILOT_REPORT_JSON_PATH = path.join(
  process.cwd(),
  'docs/internal/governance/pilot-readiness-decision-report.json',
);

const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;
const OUTCOMES = [
  'correct',
  'risky-but-allowed',
  'should-have-escalated',
  'policy-too-strict',
  'evidence-insufficient',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`${key} must be a string.`);
  return value;
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number') throw new Error(`${key} must be a number.`);
  return value;
}

function recordArrayField(record: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`${key} must be an array of records.`);
  }
  return value;
}

function stringArrayField(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${key} must be an array of strings.`);
  }
  return value;
}

function normalizeExecutionTier(value: string): ExecutionTier {
  if (value === 'Human-approve') return 'HumanApprove';
  if (value === 'Manual-only') return 'ManualOnly';
  if ((EXECUTION_TIERS as readonly string[]).includes(value)) return value as ExecutionTier;
  throw new Error(`Unsupported Execution Tier: ${value}`);
}

async function loadJson(filePath: string): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) throw new Error(`${filePath} must contain a JSON object.`);
  return parsed;
}

function toCoverageObservation(record: Record<string, unknown>): VerificationCoverageObservationV1 {
  return {
    actionClass: stringField(record, 'actionClass'),
    executionTier: normalizeExecutionTier(stringField(record, 'executionTier')),
    completedCount: numberField(record, 'completedCount'),
    sampledCount: numberField(record, 'sampledCount'),
    defectFindingCount: numberField(record, 'defectFindingCount'),
  };
}

function toOutcome(value: string): VerificationOutcomeV1 {
  if ((OUTCOMES as readonly string[]).includes(value)) return value as VerificationOutcomeV1;
  throw new Error(`Unsupported verification outcome: ${value}`);
}

describe('contained pilot verification-sampling coverage artifact', () => {
  it('configures sampling rules for every self-use alpha controlled Action class', async () => {
    const artifact = await loadJson(COVERAGE_ARTIFACT_PATH);
    const alpha = await loadJson(SELF_USE_ALPHA_PATH);

    const controlledActions = recordArrayField(alpha, 'controlledActions').map((action) => ({
      actionClass: stringField(action, 'actionClass'),
      executionTier: normalizeExecutionTier(stringField(action, 'executionTier')),
    }));
    const parsedRules = recordArrayField(artifact, 'samplingRules').map((rule) =>
      parseVerificationSamplingRuleV1(rule),
    );

    for (const action of controlledActions) {
      const matchingRule = parsedRules.find(
        (rule) =>
          rule.actionClassScope.kind === 'exact' &&
          rule.actionClassScope.actionClass === action.actionClass &&
          rule.executionTiers?.includes(action.executionTier),
      );

      expect(matchingRule, action.actionClass).toBeDefined();
      expect(matchingRule?.minBlastRadius, action.actionClass).toBeDefined();
      expect(matchingRule?.novelty?.length, action.actionClass).toBeGreaterThan(0);
      expect(matchingRule?.trackRecord?.length, action.actionClass).toBeGreaterThan(0);
    }
  });

  it('publishes computed completed, sampled, defect, and confidence coverage', async () => {
    const artifact = await loadJson(COVERAGE_ARTIFACT_PATH);
    const observations = recordArrayField(artifact, 'coverageObservations').map(
      toCoverageObservation,
    );
    const expectedSummaries = summarizeVerificationCoverageV1(observations);

    expect(recordArrayField(artifact, 'coverageByActionClass')).toEqual(expectedSummaries);
    expect(
      expectedSummaries.every((summary) => summary.sampledCount <= summary.completedCount),
    ).toBe(true);
    expect(expectedSummaries.every((summary) => summary.sampledCount > 0)).toBe(true);
  });

  it('routes every non-correct finding to existing concrete Beads', async () => {
    const artifact = await loadJson(COVERAGE_ARTIFACT_PATH);
    const routes = new Map(
      recordArrayField(artifact, 'findingRoutes').map((route) => [
        stringField(route, 'findingId'),
        route,
      ]),
    );

    for (const finding of recordArrayField(artifact, 'findings')) {
      const expectedRoute = routeVerificationAuditFindingV1(
        coerceVerificationFindingIdsV1({
          workspaceId: stringField(finding, 'workspaceId'),
          reviewedAtIso: stringField(finding, 'reviewedAtIso'),
          findingId: stringField(finding, 'findingId'),
          queueItemId: stringField(finding, 'queueItemId'),
          actionClass: stringField(finding, 'actionClass'),
          executionTier: normalizeExecutionTier(stringField(finding, 'executionTier')),
          outcome: toOutcome(stringField(finding, 'outcome')),
          evidenceIds: stringArrayField(finding, 'evidenceIds'),
          summary: stringField(finding, 'summary'),
        }),
      );
      const route = routes.get(expectedRoute.findingId);

      expect(route).toMatchObject(expectedRoute);
      if (expectedRoute.outcome !== 'correct') {
        const routedBeads = recordArrayField(route ?? {}, 'routedBeads');
        expect(routedBeads.length, expectedRoute.findingId).toBeGreaterThan(0);
        expect(routedBeads.every((bead) => /^bead-\d+$/.test(stringField(bead, 'id')))).toBe(true);
      }
    }
  });

  it('links the coverage artifact from the pilot report before broader-use claims', async () => {
    const reportMarkdown = await fs.readFile(PILOT_REPORT_MARKDOWN_PATH, 'utf8');
    const reportJson = await loadJson(PILOT_REPORT_JSON_PATH);

    expect(reportMarkdown).toContain(COVERAGE_ARTIFACT_RELATIVE_PATH);
    expect(stringArrayField(reportJson, 'keyEvidence')).toContain(COVERAGE_ARTIFACT_RELATIVE_PATH);
  });
});
