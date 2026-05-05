import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AgentTurnResult, LLMAdapter } from '../lab-agent-adapter.js';
import type { GrowthStudioApprovedContentV1 } from './content-creator-agent-loop.js';
import {
  assertGrowthStudioOutreachEvidenceChainV1,
  runGrowthStudioOutreachExecutorLoopV1,
} from './outreach-executor-agent-loop.js';

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

const APPROVED_CONTENT: readonly GrowthStudioApprovedContentV1[] = [
  makeApprovedContent('email', 'growth-content-email-1', 'send-ready email body'),
  makeApprovedContent('linkedin', 'growth-content-linkedin-1', 'approved LinkedIn post'),
  makeApprovedContent('blog', 'growth-content-blog-1', 'approved article body'),
];

function makeExecutionPlanningAdapter(): LLMAdapter {
  return {
    provider: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    isAvailable: async () => true,
    startConversation: async (): Promise<AgentTurnResult> => ({
      stopReason: 'end_turn',
      textOutputs: [
        'Execution plan: request ManualOnly approvals, publish approved content, then update CRM.',
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

describe('Growth Studio OutreachExecutor agent loop', () => {
  it('executes only pre-approved content through ManualOnly gates and CRM updates', async () => {
    const outcome = await runGrowthStudioOutreachExecutorLoopV1({
      approvedContent: APPROVED_CONTENT,
      proxyUrl,
      adapter: makeExecutionPlanningAdapter(),
      observedAtIso: '2026-05-04T00:00:00.000Z',
    });

    expect(outcome.agentConfig).toMatchObject({
      llmProvider: 'openrouter',
      llmAdapter: 'lab-agent-adapter',
      pollIntervalMs: 10_000,
      approvalTimeoutMs: 60 * 60 * 1000,
    });
    expect(outcome.llmTextOutputs).toContain(
      'Execution plan: request ManualOnly approvals, publish approved content, then update CRM.',
    );
    expect(outcome.validation).toEqual({ valid: true, errors: [] });
    expect(outcome.executionResults.map((result) => result.result)).toEqual([
      'sent',
      'published',
      'published',
    ]);
    expect(
      outcome.crmUpdates.filter((entry) => entry.event === 'crm_update_completed'),
    ).toHaveLength(3);

    for (const result of outcome.executionResults) {
      expect(result.receiptUrl).toMatch(/^https:\/\//);
      expect(result.evidenceArtifactIds).toHaveLength(3);
      expect(result.evidenceArtifactIds[0]).toMatch(/^[a-f0-9]{64}$/);
      expect(result.evidenceArtifactIds[1]).toMatch(/^[a-f0-9]{64}$/);
      expect(result.evidenceArtifactIds[2]).toMatch(/^growth-outreach-ev-/);
    }
  });

  it('logs ManualOnly approval pauses and preserves draft-to-execution evidence lineage', async () => {
    const outcome = await runGrowthStudioOutreachExecutorLoopV1({
      approvedContent: APPROVED_CONTENT,
      proxyUrl,
      observedAtIso: '2026-05-04T00:00:00.000Z',
    });

    const submitted = outcome.evidenceChain.filter(
      (entry) => entry.event === 'execution_submitted',
    );
    expect(submitted.map((entry) => entry.toolName)).toEqual([
      'send-email',
      'publish-linkedin-post',
      'publish-blog-article',
    ]);
    expect(submitted.every((entry) => entry.proxyStatus === 202)).toBe(true);
    expect(submitted.every((entry) => entry.requestedTier === 'Auto')).toBe(true);
    expect(submitted.every((entry) => entry.requiredTier === 'ManualOnly')).toBe(true);
    expect(submitted.every((entry) => entry.response['minimumTier'] === 'ManualOnly')).toBe(true);

    for (const content of APPROVED_CONTENT) {
      const lineage = outcome.evidenceChain.filter(
        (entry) => entry.approvedContentHash === content.draft.contentHash,
      );
      expect(lineage.length).toBeGreaterThanOrEqual(6);
      expect(lineage.every((entry) => entry.draftApprovalId === content.approvalId)).toBe(true);
      expect(
        lineage.every((entry) => entry.draftApprovalEvidenceHash === content.approvalEvidenceHash),
      ).toBe(true);
      expect(
        lineage.every(
          (entry) => entry.draftExecutionEvidenceHash === content.executionEvidenceHash,
        ),
      ).toBe(true);
    }

    const crmSubmitted = outcome.evidenceChain.filter(
      (entry) => entry.event === 'crm_update_submitted',
    );
    expect(crmSubmitted).toHaveLength(3);
    expect(crmSubmitted.every((entry) => entry.toolName === 'update-crm-contact')).toBe(true);
    expect(crmSubmitted.every((entry) => entry.requiredTier === 'HumanApprove')).toBe(true);
    expect(crmSubmitted.every((entry) => entry.response['minimumTier'] === 'HumanApprove')).toBe(
      true,
    );

    expect(() => assertGrowthStudioOutreachEvidenceChainV1(outcome.evidenceChain)).not.toThrow();
  });

  it('aborts gracefully when the operator denies a ManualOnly action', async () => {
    const outcome = await runGrowthStudioOutreachExecutorLoopV1({
      approvedContent: [APPROVED_CONTENT[0]!],
      proxyUrl,
      observedAtIso: '2026-05-04T00:00:00.000Z',
      operatorDecision: () => ({
        decision: 'denied',
        rationale: 'Recipient list is not ready.',
      }),
    });

    expect(outcome.executionResults).toEqual([
      expect.objectContaining({
        channel: 'email',
        result: 'skipped',
        failureReason: 'Recipient list is not ready.',
      }),
    ]);
    expect(outcome.crmUpdates).toHaveLength(0);
    expect(outcome.evidenceChain.some((entry) => entry.event === 'execution_aborted')).toBe(true);
  });

  it('rejects content without prior draft approval evidence', async () => {
    const invalid = {
      ...APPROVED_CONTENT[0]!,
      draft: { ...APPROVED_CONTENT[0]!.draft, status: 'draft' as const },
    };

    const outcome = await runGrowthStudioOutreachExecutorLoopV1({
      approvedContent: [invalid as unknown as GrowthStudioApprovedContentV1],
      proxyUrl,
    });

    expect(outcome.executionResults).toHaveLength(0);
    expect(outcome.evidenceChain).toHaveLength(0);
    expect(outcome.validation.valid).toBe(false);
    expect(outcome.validation.errors).toContain(
      'approvedContent[0].draft.status must be approved before execution',
    );
  });
});

function makeApprovedContent(
  channel: 'email' | 'linkedin' | 'blog',
  draftId: string,
  body: string,
): GrowthStudioApprovedContentV1 {
  const draftWithoutHash = {
    draftId,
    channel,
    title: `${channel} approved title`,
    body,
    citationMap: [
      {
        claim: 'externally effectful Actions require approval',
        sourceUrl: 'https://atlas-workflow.example/blog/ai-workflow-governance',
      },
    ],
    status: 'approved' as const,
    revision: 0,
  };
  const contentHash = hashFixture(draftWithoutHash);
  return {
    draft: {
      ...draftWithoutHash,
      contentHash,
    },
    approvalId: `draft-approval-${channel}`,
    approvedAt: '2026-05-04T00:00:00.000Z',
    approvalEvidenceHash: hashFixture({ kind: 'draft-approval', channel }),
    executionEvidenceHash: hashFixture({ kind: 'draft-execution', channel }),
  };
}

function hashFixture(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
