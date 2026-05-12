import { describe, expect, it } from 'vitest';

/* cspell:ignore ollama */

import {
  GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION,
  GslrEngineeringEvidenceCardProjectionError,
  projectGslrRouteEvidenceToEngineeringCardInputV1,
  type GslrEngineeringEvidenceCardProjectionInputV1,
} from './gslr-engineering-evidence-card-projection-v1.js';
import { parseEngineeringEvidenceCardInputV1 } from './engineering-evidence-card-v1.js';

function gslr8Input(
  overrides: Partial<GslrEngineeringEvidenceCardProjectionInputV1> = {},
): GslrEngineeringEvidenceCardProjectionInputV1 {
  return {
    schemaVersion: GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION,
    source: {
      manifestSchemaVersion: 2,
    },
    policyVersion: 'gslr-policy-schema-routing-v2',
    route: {
      task: 'gslr8-route-record-compiler',
      policyDecision: 'local-screen',
      selectedRun: {
        arm: 'local-only',
        runId: 'gslr8-route-record-compiler-live-2026-05-13-01-local-diagnostic',
        runGroupId: 'gslr8-route-record-compiler-local-repeats',
        finalVerdict: 'pass',
        privateOracle: 'pass',
        blockingReviewDefects: [],
        frontierTokens: 0,
        cachedInputTokens: 0,
        providerUsd: 0,
        localWallSeconds: 22.175,
        selectedModel: 'qwen3-coder:30b',
        selectedProvider: 'ollama',
        reason:
          'PL-owned scaffold owns route-record policy tables and output envelopes; local model filled predicate hooks',
      },
    },
    artifactRefs: {
      manifest: 'hybrid-routing-manifest.json',
      oracleStdout: 'private/oracle/stdout.txt',
      oracleStderr: 'private/oracle/stderr.txt',
    },
    ...overrides,
  };
}

describe('projectGslrRouteEvidenceToEngineeringCardInputV1', () => {
  it('projects the GSLR-8 positive local-screen evidence into a research-only card', () => {
    const card = projectGslrRouteEvidenceToEngineeringCardInputV1(gslr8Input());

    expect(card.schemaVersion).toBe('portarium.evidence-card-input.v1');
    expect(card.workItem.id).toBe('gslr8-route-record-compiler');
    expect(card.route.arm).toBe('local-only');
    expect(card.route.policyDecision).toBe('local-screen');
    expect(card.route.selectedProvider).toBe('ollama');
    expect(card.gates.privateOracle).toBe('pass');
    expect(card.actionBoundary.status).toBe('research-only');
    expect(card.cost.frontierTokensTotal).toBe(0);
    expect(card.cost.localWallSecondsTotal).toBe(22.175);
    expect(parseEngineeringEvidenceCardInputV1(card)).toEqual(card);
  });

  it('projects the GSLR-7 failed route-record evidence into a blocked card', () => {
    const card = projectGslrRouteEvidenceToEngineeringCardInputV1(
      gslr8Input({
        route: {
          task: 'gslr7-scaffolded-route-record',
          policyDecision: 'frontier-baseline',
          selectedRun: {
            arm: 'local-only',
            runId: 'gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat',
            runGroupId: 'gslr7-scaffolded-route-record-local-repeats-v2',
            finalVerdict: 'fail',
            privateOracle: 'fail',
            blockingReviewDefects: [],
            frontierTokens: 0,
            providerUsd: 0,
            localWallSeconds: 82.961,
            selectedModel: 'qwen3-coder:30b',
            selectedProvider: 'ollama',
            reason:
              'local route-record builder accepted oracle command after comparing normalized input against unnormalized constants',
          },
        },
      }),
    );

    expect(card.workItem.id).toBe('gslr7-scaffolded-route-record');
    expect(card.route.policyDecision).toBe('frontier-baseline');
    expect(card.gates.finalVerdict).toBe('fail');
    expect(card.actionBoundary.status).toBe('blocked');
    expect(card.actionBoundary.reason).toContain('final verdict is fail');
    expect(card.actionBoundary.reason).toContain('private oracle is fail');
    expect(parseEngineeringEvidenceCardInputV1(card)).toEqual(card);
  });

  it('keeps blocked review-defect evidence blocked even when verdict and oracle pass', () => {
    const card = projectGslrRouteEvidenceToEngineeringCardInputV1(
      gslr8Input({
        route: {
          ...gslr8Input().route,
          selectedRun: {
            ...gslr8Input().route.selectedRun,
            blockingReviewDefects: ['missing operator explanation'],
          },
        },
      }),
    );

    expect(card.actionBoundary.status).toBe('blocked');
    expect(card.actionBoundary.reason).toContain('blocking review defects');
  });

  it('rejects unsafe artifact references before card parsing', () => {
    expect(() =>
      projectGslrRouteEvidenceToEngineeringCardInputV1(
        gslr8Input({
          artifactRefs: {
            manifest: '../private/raw-dump.json',
            oracleStdout: 'private/oracle/stdout.txt',
            oracleStderr: 'private/oracle/stderr.txt',
          },
        }),
      ),
    ).toThrow(GslrEngineeringEvidenceCardProjectionError);
  });

  it('rejects malformed projection input schema versions', () => {
    expect(() =>
      projectGslrRouteEvidenceToEngineeringCardInputV1({
        ...gslr8Input(),
        schemaVersion:
          'wrong' as typeof GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION,
      }),
    ).toThrow(/schemaVersion must be/);
  });
});
