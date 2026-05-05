import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AgentTurnResult, LLMAdapter } from '../lab-agent-adapter.js';
import type { GrowthStudioScoredProspectV1 } from './researcher-agent-loop.js';
import {
  assertGrowthStudioContentEvidenceChainV1,
  runGrowthStudioContentCreatorLoopV1,
  type GrowthStudioContentBriefV1,
  type GrowthStudioContentChannelV1,
} from './content-creator-agent-loop.js';

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

const SAMPLE_PROSPECT: GrowthStudioScoredProspectV1 = {
  accountName: 'Atlas Workflow Systems',
  accountDomain: 'atlas-workflow.example',
  targetRole: 'VP Operations',
  fitScore: 91,
  buyingSignals: [
    {
      signal: 'Published a public workflow governance article tied to AI-assisted operations.',
      sourceUrl: 'https://atlas-workflow.example/blog/ai-workflow-governance',
      observedAt: '2026-05-04T00:00:00.000Z',
    },
  ],
  exclusionCriteriaFound: [],
  evidenceArtifactIds: ['growth-research-ev-2'],
};

const SAMPLE_BRIEF: GrowthStudioContentBriefV1 = {
  campaignName: 'Auditable AI workflow pilot',
  objective:
    'Book discovery calls with operations leaders evaluating AI-assisted workflow governance.',
  primaryMessage:
    'Portarium helps teams research, create, approve, execute, and measure AI-assisted growth workflows with evidence attached to every Action.',
  offer: '30-minute workflow governance review',
  channels: ['email', 'linkedin', 'blog'],
  tone: 'direct, practical, evidence-backed',
  requiredClaims: [
    'research outputs include source citations',
    'externally effectful Actions require approval',
    'measurement feeds the next governed loop',
  ],
  prohibitedClaims: [
    'guaranteed revenue increase',
    'fully autonomous outbound without approval',
    'compliance certification not held by the workspace',
  ],
};

function makeContentPlanningAdapter(): LLMAdapter {
  return {
    provider: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    isAvailable: async () => true,
    startConversation: async (): Promise<AgentTurnResult> => ({
      stopReason: 'end_turn',
      textOutputs: [
        'Content plan: draft email, LinkedIn, and blog assets with citations before approval.',
      ],
      toolCalls: [],
    }),
    sendToolResults: async (): Promise<AgentTurnResult> => ({
      stopReason: 'end_turn',
      textOutputs: [],
      toolCalls: [],
    }),
  };
}

describe('Growth Studio ContentCreator agent loop', () => {
  it('creates approved email, LinkedIn, and blog drafts through HumanApprove gates', async () => {
    const decisionCounts = new Map<GrowthStudioContentChannelV1, number>();
    const outcome = await runGrowthStudioContentCreatorLoopV1({
      prospect: SAMPLE_PROSPECT,
      contentBrief: SAMPLE_BRIEF,
      proxyUrl,
      adapter: makeContentPlanningAdapter(),
      observedAtIso: '2026-05-04T00:00:00.000Z',
      operatorDecision: ({ channel }) => {
        const count = (decisionCounts.get(channel) ?? 0) + 1;
        decisionCounts.set(channel, count);

        if (channel === 'email' && count === 1) {
          return {
            decision: 'request_changes',
            rationale: 'Lead with the cited governance pain before the offer.',
          };
        }

        return {
          decision: 'approved',
          rationale: `Approved ${channel} draft for outbox.`,
        };
      },
    });

    expect(outcome.agentConfig).toMatchObject({
      llmProvider: 'openrouter',
      llmAdapter: 'lab-agent-adapter',
      pollIntervalMs: 5_000,
      approvalTimeoutMs: 15 * 60 * 1000,
      maxRetries: 3,
    });
    expect(outcome.llmTextOutputs).toContain(
      'Content plan: draft email, LinkedIn, and blog assets with citations before approval.',
    );
    expect(outcome.validation).toEqual({ valid: true, errors: [] });
    expect(outcome.approvedContent.map((content) => content.draft.channel).sort()).toEqual([
      'blog',
      'email',
      'linkedin',
    ]);
    expect(outcome.outbox).toHaveLength(3);
    expect(outcome.drafts.filter((draft) => draft.channel === 'email')).toHaveLength(2);
    expect(outcome.drafts.some((draft) => draft.status === 'needs_changes')).toBe(true);

    for (const content of outcome.approvedContent) {
      expect(content.draft.status).toBe('approved');
      expect(content.draft.citationMap).toHaveLength(SAMPLE_BRIEF.requiredClaims.length);
      expect(content.draft.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(content.approvalEvidenceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(content.executionEvidenceHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('records each draft approval pause with full draft and prospect context for triage', async () => {
    const outcome = await runGrowthStudioContentCreatorLoopV1({
      prospect: SAMPLE_PROSPECT,
      contentBrief: SAMPLE_BRIEF,
      proxyUrl,
      observedAtIso: '2026-05-04T00:00:00.000Z',
    });

    const submitted = outcome.evidenceChain.filter((entry) => entry.event === 'draft_submitted');
    expect(submitted.map((entry) => entry.toolName)).toEqual([
      'draft-email',
      'draft-linkedin-post',
      'draft-blog-article',
    ]);
    expect(submitted.every((entry) => entry.proxyStatus === 202)).toBe(true);
    expect(submitted.every((entry) => entry.requestedTier === 'Auto')).toBe(true);
    expect(submitted.every((entry) => entry.requiredTier === 'HumanApprove')).toBe(true);
    expect(submitted.every((entry) => entry.approvalStatus === 'pending')).toBe(true);

    for (const entry of submitted) {
      expect(entry.response['status']).toBe('awaiting_approval');
      expect(entry.response['minimumTier']).toBe('HumanApprove');
      const parameters = entry.request['parameters'] as Record<string, unknown>;
      const draft = parameters['draft'] as Record<string, unknown>;
      const prospectContext = parameters['prospectContext'] as Record<string, unknown>;
      const triageCard = parameters['triageCard'] as Record<string, unknown>;

      expect(draft['body']).toEqual(
        expect.stringContaining(SAMPLE_PROSPECT.buyingSignals[0]!.signal),
      );
      expect(prospectContext).toMatchObject({
        accountName: SAMPLE_PROSPECT.accountName,
        accountDomain: SAMPLE_PROSPECT.accountDomain,
        targetRole: SAMPLE_PROSPECT.targetRole,
        fitScore: SAMPLE_PROSPECT.fitScore,
      });
      expect(triageCard['fullDraftContent']).toBe(draft['body']);
      expect(triageCard['prospectContext']).toContain(SAMPLE_PROSPECT.accountName);
    }

    const decisions = outcome.evidenceChain.filter((entry) => entry.event === 'approval_decided');
    expect(decisions.every((entry) => entry.operatorDecision === 'approved')).toBe(true);
    expect(outcome.evidenceChain.filter((entry) => entry.event === 'draft_executed')).toHaveLength(
      3,
    );
    expect(() => assertGrowthStudioContentEvidenceChainV1(outcome.evidenceChain)).not.toThrow();
  });
});
