import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AgentTurnResult, LLMAdapter } from '../lab-agent-adapter.js';
import {
  assertGrowthStudioEvidenceChainV1,
  runGrowthStudioResearcherLoopV1,
  type GrowthStudioIcpV1,
} from './researcher-agent-loop.js';

let proxyUrl: string;
let closeProxy: () => void;

beforeAll(async () => {
  // @ts-expect-error -- demo proxy is an untyped ESM module.
  const proxyMod = await import('../../demo/portarium-tool-proxy.mjs');
  const handle = await proxyMod.startPolicyProxy(0);
  proxyUrl = handle.url;
  closeProxy = handle.close;
});

afterAll(() => {
  closeProxy?.();
});

const SAMPLE_ICP: GrowthStudioIcpV1 = {
  segmentName: 'Mid-market operations teams adopting AI-assisted workflows',
  companyProfile: {
    companySize: '200-1500 employees',
    geography: ['United States', 'Canada', 'United Kingdom'],
    industries: ['B2B software', 'professional services', 'marketplaces'],
  },
  targetRoles: ['VP Operations', 'Head of Enablement', 'RevOps Director'],
  pains: [
    'manual research slows campaign planning',
    'approval evidence is scattered across tools',
    'teams need auditable AI assistance before outbound execution',
  ],
  exclusionCriteria: ['consumer-only business model'],
};

function makePlanningAdapter(): LLMAdapter {
  return {
    provider: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    isAvailable: async () => true,
    startConversation: async (): Promise<AgentTurnResult> => ({
      stopReason: 'end_turn',
      textOutputs: ['Research plan: search public sources, scrape citations, score ICP fit.'],
      toolCalls: [],
    }),
    sendToolResults: async (): Promise<AgentTurnResult> => ({
      stopReason: 'end_turn',
      textOutputs: [],
      toolCalls: [],
    }),
  };
}

describe('Growth Studio Researcher agent loop', () => {
  it('finds and validates at least 3 scored prospects through Auto-tier proposal flow', async () => {
    const outcome = await runGrowthStudioResearcherLoopV1({
      icp: SAMPLE_ICP,
      proxyUrl,
      adapter: makePlanningAdapter(),
      observedAtIso: '2026-05-04T00:00:00.000Z',
    });

    expect(outcome.agentConfig).toMatchObject({
      llmProvider: 'openrouter',
      llmAdapter: 'lab-agent-adapter',
      maxIterations: 10,
    });
    expect(outcome.llmTextOutputs).toContain(
      'Research plan: search public sources, scrape citations, score ICP fit.',
    );
    expect(outcome.prospects).toHaveLength(3);
    expect(outcome.validation).toEqual({ valid: true, errors: [] });

    for (const prospect of outcome.prospects) {
      expect(prospect.accountName).toEqual(expect.any(String));
      expect(prospect.accountDomain).toEqual(expect.stringContaining('.example'));
      expect(prospect.fitScore).toBeGreaterThanOrEqual(80);
      expect(prospect.buyingSignals).toHaveLength(1);
      expect(prospect.buyingSignals[0]!.sourceUrl).toMatch(/^https:\/\//);
      expect(prospect.evidenceArtifactIds).toHaveLength(1);
    }
  });

  it('logs every web-search and scrape-website call in a valid evidence chain', async () => {
    const outcome = await runGrowthStudioResearcherLoopV1({
      icp: SAMPLE_ICP,
      proxyUrl,
      observedAtIso: '2026-05-04T00:00:00.000Z',
    });

    expect(outcome.toolCalls.map((call) => call.toolName)).toEqual([
      'web-search',
      'scrape-website',
      'web-search',
      'scrape-website',
      'web-search',
      'scrape-website',
    ]);
    expect(outcome.toolCalls.every((call) => call.policyTier === 'Auto')).toBe(true);
    expect(outcome.toolCalls.every((call) => call.proxyStatus === 200)).toBe(true);
    expect(outcome.toolCalls.every((call) => call.blocked === false)).toBe(true);
    expect(outcome.toolCalls.every((call) => call.response['decision'] === 'Allow')).toBe(true);

    expect(() => assertGrowthStudioEvidenceChainV1(outcome.evidenceChain)).not.toThrow();
  });
});
