/* cspell:ignore ollama */

import { describe, expect, it } from 'vitest';

import {
  ENGINEERING_EVIDENCE_CARD_INPUT_V1_SCHEMA_VERSION,
  EngineeringEvidenceCardParseError,
  isEngineeringEvidenceCardInputV1,
  parseEngineeringEvidenceCardInputV1,
  type EngineeringEvidenceCardInputV1,
} from './engineering-evidence-card-v1.js';

function validCard(
  overrides: Partial<EngineeringEvidenceCardInputV1> = {},
): EngineeringEvidenceCardInputV1 {
  return {
    schemaVersion: ENGINEERING_EVIDENCE_CARD_INPUT_V1_SCHEMA_VERSION,
    source: {
      system: 'prompt-language',
      area: 'harness-arena',
      manifestSchemaVersion: 2,
    },
    workItem: {
      id: 'gslr3-policy-manifest-transform',
      runId: 'gslr3-policy-manifest-transform-live-2026-05-12-03-frontier-only',
      runGroupId: 'gslr3-policy-manifest-transform',
      policyVersion: 'gslr-v0.3-policy-manifest-transform-frontier-baseline',
    },
    route: {
      arm: 'frontier-only',
      decision: 'frontier-only',
      policyDecision: 'frontier-baseline',
      selectedModel: 'codex-default',
      selectedProvider: 'openai',
      reason: 'derived-from-harness-manifest',
    },
    gates: {
      finalVerdict: 'pass',
      privateOracle: 'pass',
      blockingReviewDefects: [],
    },
    cost: {
      frontierTokensTotal: 33913,
      cachedInputTokensTotal: 0,
      providerUsdTotal: 3,
      localWallSecondsTotal: 0,
    },
    actionBoundary: {
      status: 'research-only',
      reason: 'final verdict, private oracle, and review gates passed',
    },
    artifactRefs: {
      manifest: 'hybrid-routing-manifest.json',
      oracleStdout: 'private/oracle/stdout.txt',
      oracleStderr: 'private/oracle/stderr.txt',
    },
    ...overrides,
  };
}

describe('EngineeringEvidenceCardInputV1', () => {
  it('parses the GSLR-3 frontier-baseline static evidence-card shape', () => {
    const parsed = parseEngineeringEvidenceCardInputV1(validCard());

    expect(parsed.schemaVersion).toBe('portarium.evidence-card-input.v1');
    expect(parsed.route.policyDecision).toBe('frontier-baseline');
    expect(parsed.gates.privateOracle).toBe('pass');
    expect(parsed.cost.frontierTokensTotal).toBe(33913);
    expect(isEngineeringEvidenceCardInputV1(parsed)).toBe(true);
  });

  it('accepts blocked evidence cards for failed local/advisor runs', () => {
    const card = validCard({
      route: {
        arm: 'local-only',
        decision: 'local-only',
        policyDecision: 'frontier-baseline',
        selectedModel: 'qwen3-coder:30b',
        selectedProvider: 'ollama',
        reason: 'derived-from-harness-manifest',
      },
      gates: {
        finalVerdict: 'fail',
        privateOracle: 'fail',
        blockingReviewDefects: [],
      },
      cost: {
        frontierTokensTotal: 0,
        cachedInputTokensTotal: 0,
        providerUsdTotal: 0,
        localWallSecondsTotal: 60.55,
      },
      actionBoundary: {
        status: 'blocked',
        reason: 'local-only failed malformed array manifest gate',
      },
    });

    const parsed = parseEngineeringEvidenceCardInputV1(card);

    expect(parsed.actionBoundary.status).toBe('blocked');
    expect(parsed.route.selectedProvider).toBe('ollama');
    expect(parsed.cost.localWallSecondsTotal).toBe(60.55);
  });

  it('rejects research-only cards when blocking evidence is present', () => {
    const card = validCard({
      gates: {
        finalVerdict: 'fail',
        privateOracle: 'pass',
        blockingReviewDefects: [],
      },
      actionBoundary: {
        status: 'research-only',
        reason: 'incorrectly marked safe',
      },
    });

    expect(() => parseEngineeringEvidenceCardInputV1(card)).toThrow(
      /actionBoundary\.status must be blocked/,
    );
  });

  it('rejects raw payload and secret keys anywhere in the card', () => {
    const card = {
      ...validCard(),
      debug: {
        sourcePayload: {
          studentId: 'hidden',
        },
      },
    };

    expect(() => parseEngineeringEvidenceCardInputV1(card)).toThrow(
      EngineeringEvidenceCardParseError,
    );
  });

  it('rejects artifact refs with query strings or fragments', () => {
    const card = validCard({
      artifactRefs: {
        manifest: 'hybrid-routing-manifest.json?token=secret',
        oracleStdout: 'private/oracle/stdout.txt',
        oracleStderr: 'private/oracle/stderr.txt',
      },
    });

    expect(() => parseEngineeringEvidenceCardInputV1(card)).toThrow(/artifact reference/);
  });
});
