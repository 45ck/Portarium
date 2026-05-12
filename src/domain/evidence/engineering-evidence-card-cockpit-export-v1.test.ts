import { describe, expect, it } from 'vitest';

/* cspell:ignore ollama rawpayload */

import {
  buildEngineeringEvidenceCardCockpitExportV1,
  ENGINEERING_EVIDENCE_CARD_COCKPIT_EXPORT_V1_CONTENT_TYPE,
  ENGINEERING_EVIDENCE_CARD_COCKPIT_EXPORT_V1_ROUTE_HINT,
} from './engineering-evidence-card-cockpit-export-v1.js';
import { EngineeringEvidenceCardParseError } from './engineering-evidence-card-v1.js';
import {
  GSLR_ENGINEERING_EVIDENCE_CARD_PROJECTION_INPUT_V1_SCHEMA_VERSION,
  projectGslrRouteEvidenceToEngineeringCardInputV1,
  type GslrEngineeringEvidenceCardProjectionInputV1,
} from './gslr-engineering-evidence-card-projection-v1.js';

function gslr8Card() {
  return projectGslrRouteEvidenceToEngineeringCardInputV1(gslr8Input());
}

function gslr7BlockedCard() {
  return projectGslrRouteEvidenceToEngineeringCardInputV1(
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
          blockingReviewDefects: [
            'accepted oracle command because normalized input was compared with unnormalized constants',
          ],
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
}

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

describe('buildEngineeringEvidenceCardCockpitExportV1', () => {
  it('exports the GSLR-8 research-only local-screen card for static Cockpit display', () => {
    const exportModel = buildEngineeringEvidenceCardCockpitExportV1(gslr8Card());

    expect(exportModel.contentType).toBe(ENGINEERING_EVIDENCE_CARD_COCKPIT_EXPORT_V1_CONTENT_TYPE);
    expect(exportModel.routeHint).toBe(ENGINEERING_EVIDENCE_CARD_COCKPIT_EXPORT_V1_ROUTE_HINT);
    expect(exportModel.title).toBe('gslr8-route-record-compiler');
    expect(exportModel.actionStatus).toBe('research-only');
    expect(exportModel.operatorDecision).toBe('research-only-no-action');
    expect(exportModel.routeBadge).toMatchObject({
      value: 'local-screen via local-only',
      tone: 'success',
    });
    expect(exportModel.modelBadge).toMatchObject({
      value: 'ollama/qwen3-coder:30b',
      tone: 'success',
    });
    expect(exportModel.metricRows).toContainEqual({
      key: 'frontierTokens',
      label: 'Frontier tokens',
      value: 0,
      unit: 'tokens',
      tone: 'success',
    });
    expect(exportModel.boundaryWarnings).toContain(
      'No live prompt-language manifest ingestion is implied by this export.',
    );
  });

  it('exports the GSLR-7 failed route-record evidence as blocked with failure rows', () => {
    const exportModel = buildEngineeringEvidenceCardCockpitExportV1(gslr7BlockedCard());

    expect(exportModel.actionStatus).toBe('blocked');
    expect(exportModel.operatorDecision).toBe('blocked-no-action');
    expect(exportModel.routeBadge).toMatchObject({
      value: 'frontier-baseline via local-only',
      tone: 'warning',
    });
    expect(exportModel.actionBadge).toMatchObject({
      value: 'blocked',
      tone: 'danger',
    });
    expect(exportModel.gateRows).toContainEqual({
      key: 'finalVerdict',
      label: 'Final verdict',
      value: 'fail',
      tone: 'danger',
      details: [],
    });
    expect(exportModel.gateRows[2]).toMatchObject({
      key: 'blockingReviewDefects',
      value: '1 blocking',
      tone: 'danger',
    });
  });

  it('rejects raw payload fields through the existing card parser before exporting', () => {
    expect(() =>
      buildEngineeringEvidenceCardCockpitExportV1({
        ...gslr8Card(),
        rawPayload: {
          studentName: 'not allowed',
        },
      }),
    ).toThrow(EngineeringEvidenceCardParseError);
  });

  it('returns a deeply frozen export model', () => {
    const exportModel = buildEngineeringEvidenceCardCockpitExportV1(gslr8Card());

    expect(Object.isFrozen(exportModel)).toBe(true);
    expect(Object.isFrozen(exportModel.routeBadge)).toBe(true);
    expect(Object.isFrozen(exportModel.metricRows)).toBe(true);
    expect(Object.isFrozen(exportModel.metricRows[0])).toBe(true);
    expect(Object.isFrozen(exportModel.gateRows[0])).toBe(true);
    expect(Object.isFrozen(exportModel.artifactRefs[0])).toBe(true);
    expect(Object.isFrozen(exportModel.boundaryWarnings)).toBe(true);
  });
});
