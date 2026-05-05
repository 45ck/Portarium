import { createHash } from 'node:crypto';

import type { LLMAdapter } from '../lab-agent-adapter.js';
import type { GrowthStudioScoredProspectV1 } from './researcher-agent-loop.js';

export const GROWTH_STUDIO_CONTENT_CREATOR_SYSTEM_PROMPT =
  'You are the Growth Studio ContentCreator. Draft cited B2B outreach content and wait for operator approval before marking drafts ready for execution.';

export const GROWTH_STUDIO_CONTENT_CREATOR_AGENT_CONFIG = {
  llmProvider: 'openrouter',
  llmAdapter: 'lab-agent-adapter',
  pollIntervalMs: 5_000,
  approvalTimeoutMs: 15 * 60 * 1000,
  maxRetries: 3,
  output: 'ApprovedContent[]',
} as const;

export type GrowthStudioContentChannelV1 = 'email' | 'linkedin' | 'blog';

export interface GrowthStudioContentBriefV1 {
  readonly campaignName: string;
  readonly objective: string;
  readonly primaryMessage: string;
  readonly offer: string;
  readonly channels: readonly GrowthStudioContentChannelV1[];
  readonly tone: string;
  readonly requiredClaims: readonly string[];
  readonly prohibitedClaims: readonly string[];
}

export interface GrowthStudioContentDraftV1 {
  readonly draftId: string;
  readonly channel: GrowthStudioContentChannelV1;
  readonly title: string;
  readonly body: string;
  readonly citationMap: readonly {
    readonly claim: string;
    readonly sourceUrl: string;
  }[];
  readonly contentHash: string;
  readonly status: 'draft' | 'needs_changes' | 'approved' | 'rejected';
  readonly revision: number;
}

export interface GrowthStudioApprovedContentV1 {
  readonly draft: GrowthStudioContentDraftV1 & { readonly status: 'approved' };
  readonly approvalId: string;
  readonly approvedAt: string;
  readonly approvalEvidenceHash: string;
  readonly executionEvidenceHash: string;
}

export interface GrowthStudioContentEvidenceEntryV1 {
  readonly sequence: number;
  readonly evidenceId: string;
  readonly previousHash?: string;
  readonly hashSha256: string;
  readonly event: 'draft_submitted' | 'approval_decided' | 'draft_executed';
  readonly channel: GrowthStudioContentChannelV1;
  readonly toolName: 'draft-email' | 'draft-linkedin-post' | 'draft-blog-article';
  readonly attempt: number;
  readonly requestedTier: 'Auto';
  readonly requiredTier: 'HumanApprove';
  readonly proxyStatus: number;
  readonly approvalId?: string;
  readonly approvalStatus?: 'pending' | 'approved' | 'denied';
  readonly operatorDecision?: 'approved' | 'denied' | 'request_changes';
  readonly request: Readonly<Record<string, unknown>>;
  readonly response: Readonly<Record<string, unknown>>;
}

export interface GrowthStudioContentCreatorLoopResultV1 {
  readonly agentConfig: typeof GROWTH_STUDIO_CONTENT_CREATOR_AGENT_CONFIG;
  readonly approvedContent: readonly GrowthStudioApprovedContentV1[];
  readonly drafts: readonly GrowthStudioContentDraftV1[];
  readonly outbox: readonly GrowthStudioApprovedContentV1[];
  readonly evidenceChain: readonly GrowthStudioContentEvidenceEntryV1[];
  readonly approvalEvidenceHashes: readonly string[];
  readonly validation: {
    readonly valid: boolean;
    readonly errors: readonly string[];
  };
  readonly llmTextOutputs: readonly string[];
}

export type GrowthStudioContentOperatorDecisionV1 = Readonly<{
  decision: 'approved' | 'denied' | 'request_changes';
  rationale: string;
}>;

export interface RunGrowthStudioContentCreatorLoopOptions {
  readonly prospect: GrowthStudioScoredProspectV1;
  readonly contentBrief: GrowthStudioContentBriefV1;
  readonly proxyUrl: string;
  readonly adapter?: LLMAdapter;
  readonly maxRetries?: number;
  readonly observedAtIso?: string;
  readonly operatorDecision?: (input: {
    readonly approvalId: string;
    readonly channel: GrowthStudioContentChannelV1;
    readonly attempt: number;
    readonly draft: GrowthStudioContentDraftV1;
  }) => Promise<GrowthStudioContentOperatorDecisionV1> | GrowthStudioContentOperatorDecisionV1;
}

export async function runGrowthStudioContentCreatorLoopV1(
  options: RunGrowthStudioContentCreatorLoopOptions,
): Promise<GrowthStudioContentCreatorLoopResultV1> {
  const maxRetries = options.maxRetries ?? GROWTH_STUDIO_CONTENT_CREATOR_AGENT_CONFIG.maxRetries;
  const observedAt = options.observedAtIso ?? new Date().toISOString();
  const llmTextOutputs = await runOptionalContentPlanningTurn(options);
  const evidenceChain: GrowthStudioContentEvidenceEntryV1[] = [];
  const drafts: GrowthStudioContentDraftV1[] = [];
  const approvedContent: GrowthStudioApprovedContentV1[] = [];

  for (const channel of requestedChannels(options.contentBrief)) {
    let lastFeedback: string | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const draft = buildDraft({
        prospect: options.prospect,
        contentBrief: options.contentBrief,
        channel,
        revision: attempt - 1,
        ...(lastFeedback ? { feedback: lastFeedback } : {}),
      });
      drafts.push(draft);

      const submitEntry = await submitDraftForApproval({
        proxyUrl: options.proxyUrl,
        prospect: options.prospect,
        contentBrief: options.contentBrief,
        draft,
        attempt,
        evidenceChain,
      });

      const approvalId = requireApprovalId(submitEntry);
      const operatorDecision = await decideApproval({
        proxyUrl: options.proxyUrl,
        approvalId,
        channel,
        attempt,
        draft,
        operatorDecision: options.operatorDecision,
      });

      const decisionEntry = appendEvidenceEntry({
        chain: evidenceChain,
        event: 'approval_decided',
        channel,
        toolName: toolForChannel(channel),
        attempt,
        proxyStatus: operatorDecision.proxyStatus,
        approvalId,
        approvalStatus: operatorDecision.approvalStatus,
        operatorDecision: operatorDecision.decision,
        request: operatorDecision.request,
        response: operatorDecision.response,
      });

      if (operatorDecision.decision !== 'approved') {
        lastFeedback = operatorDecision.rationale;
        if (attempt > maxRetries) break;
        continue;
      }

      const executionEntry = await executeApprovedDraft({
        proxyUrl: options.proxyUrl,
        approvalId,
        prospect: options.prospect,
        contentBrief: options.contentBrief,
        draft,
        attempt,
        evidenceChain,
      });

      approvedContent.push({
        draft: { ...draft, status: 'approved' },
        approvalId,
        approvedAt: observedAt,
        approvalEvidenceHash: decisionEntry.hashSha256,
        executionEvidenceHash: executionEntry.hashSha256,
      });
      break;
    }
  }

  const validation = validateGrowthStudioApprovedContentV1(approvedContent, options.contentBrief);

  return {
    agentConfig: GROWTH_STUDIO_CONTENT_CREATOR_AGENT_CONFIG,
    approvedContent,
    drafts,
    outbox: approvedContent,
    evidenceChain,
    approvalEvidenceHashes: approvedContent.map((content) => content.approvalEvidenceHash),
    validation,
    llmTextOutputs,
  };
}

export function validateGrowthStudioApprovedContentV1(
  approvedContent: readonly GrowthStudioApprovedContentV1[],
  contentBrief: GrowthStudioContentBriefV1,
): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  const expectedChannels = requestedChannels(contentBrief);

  for (const channel of expectedChannels) {
    if (!approvedContent.some((content) => content.draft.channel === channel)) {
      errors.push(`approvedContent must include an approved ${channel} draft`);
    }
  }

  approvedContent.forEach((content, index) => {
    const prefix = `approvedContent[${index}]`;
    if (content.draft.status !== 'approved') errors.push(`${prefix}.draft.status must be approved`);
    if (!content.approvalId.trim()) errors.push(`${prefix}.approvalId is required`);
    if (!isSha256(content.approvalEvidenceHash)) {
      errors.push(`${prefix}.approvalEvidenceHash must be a sha256 hash`);
    }
    if (!isSha256(content.executionEvidenceHash)) {
      errors.push(`${prefix}.executionEvidenceHash must be a sha256 hash`);
    }
    if (!isSha256(content.draft.contentHash)) {
      errors.push(`${prefix}.draft.contentHash must be a sha256 hash`);
    }
    if (content.draft.citationMap.length === 0) {
      errors.push(`${prefix}.draft.citationMap must include at least one cited claim`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function assertGrowthStudioContentEvidenceChainV1(
  chain: readonly GrowthStudioContentEvidenceEntryV1[],
): void {
  for (let index = 1; index < chain.length; index++) {
    const previous = chain[index - 1]!;
    const current = chain[index]!;
    if (current.previousHash !== previous.hashSha256) {
      throw new Error(
        `Growth Studio content evidence chain broken at ${index}: ${String(
          current.previousHash,
        )} does not match ${previous.hashSha256}`,
      );
    }
  }
}

async function runOptionalContentPlanningTurn(
  options: RunGrowthStudioContentCreatorLoopOptions,
): Promise<readonly string[]> {
  if (!options.adapter) return [];

  const turn = await options.adapter.startConversation(
    GROWTH_STUDIO_CONTENT_CREATOR_SYSTEM_PROMPT,
    buildContentCreatorUserPrompt(options.prospect, options.contentBrief),
  );
  return turn.textOutputs;
}

function buildContentCreatorUserPrompt(
  prospect: GrowthStudioScoredProspectV1,
  brief: GrowthStudioContentBriefV1,
): string {
  return [
    `Prospect: ${prospect.accountName} (${prospect.accountDomain})`,
    `Target role: ${prospect.targetRole}`,
    `Campaign: ${brief.campaignName}`,
    `Objective: ${brief.objective}`,
    `Tone: ${brief.tone}`,
    `Channels: ${brief.channels.join(', ')}`,
    `Required claims: ${brief.requiredClaims.join(', ')}`,
    `Prohibited claims: ${brief.prohibitedClaims.join(', ')}`,
    'Draft each channel with citations and wait for Portarium approval before marking output ready.',
  ].join('\n');
}

async function submitDraftForApproval(params: {
  readonly proxyUrl: string;
  readonly prospect: GrowthStudioScoredProspectV1;
  readonly contentBrief: GrowthStudioContentBriefV1;
  readonly draft: GrowthStudioContentDraftV1;
  readonly attempt: number;
  readonly evidenceChain: GrowthStudioContentEvidenceEntryV1[];
}): Promise<GrowthStudioContentEvidenceEntryV1> {
  const request = makeDraftToolRequest(params);
  const response = await fetch(`${params.proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as Record<string, unknown>;
  const approvalId = typeof body['approvalId'] === 'string' ? body['approvalId'] : undefined;

  if (response.status !== 202 || body['status'] !== 'awaiting_approval' || !approvalId) {
    throw new Error(
      `Growth Studio ${params.draft.channel} draft should pause at HumanApprove gate.`,
    );
  }

  return appendEvidenceEntry({
    chain: params.evidenceChain,
    event: 'draft_submitted',
    channel: params.draft.channel,
    toolName: toolForChannel(params.draft.channel),
    attempt: params.attempt,
    proxyStatus: response.status,
    approvalId,
    approvalStatus: 'pending',
    request,
    response: body,
  });
}

async function decideApproval(params: {
  readonly proxyUrl: string;
  readonly approvalId: string;
  readonly channel: GrowthStudioContentChannelV1;
  readonly attempt: number;
  readonly draft: GrowthStudioContentDraftV1;
  readonly operatorDecision?: RunGrowthStudioContentCreatorLoopOptions['operatorDecision'];
}): Promise<{
  readonly decision: 'approved' | 'denied' | 'request_changes';
  readonly rationale: string;
  readonly proxyStatus: number;
  readonly approvalStatus: 'approved' | 'denied';
  readonly request: Readonly<Record<string, unknown>>;
  readonly response: Readonly<Record<string, unknown>>;
}> {
  const decision =
    (await params.operatorDecision?.({
      approvalId: params.approvalId,
      channel: params.channel,
      attempt: params.attempt,
      draft: params.draft,
    })) ??
    ({
      decision: 'approved',
      rationale: 'Approved for Growth Studio demo outbox.',
    } satisfies GrowthStudioContentOperatorDecisionV1);
  const proxyDecision = decision.decision === 'approved' ? 'approved' : 'denied';
  const request = {
    decision: proxyDecision,
    rationale: decision.rationale,
    channel: params.channel,
    attempt: params.attempt,
  };
  const response = await fetch(`${params.proxyUrl}/approvals/${params.approvalId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (response.status !== 200) {
    throw new Error(`Approval decision failed for ${params.approvalId}: ${JSON.stringify(body)}`);
  }

  return {
    decision: decision.decision,
    rationale: decision.rationale,
    proxyStatus: response.status,
    approvalStatus: proxyDecision,
    request,
    response: body,
  };
}

async function executeApprovedDraft(params: {
  readonly proxyUrl: string;
  readonly approvalId: string;
  readonly prospect: GrowthStudioScoredProspectV1;
  readonly contentBrief: GrowthStudioContentBriefV1;
  readonly draft: GrowthStudioContentDraftV1;
  readonly attempt: number;
  readonly evidenceChain: GrowthStudioContentEvidenceEntryV1[];
}): Promise<GrowthStudioContentEvidenceEntryV1> {
  const request = {
    ...makeDraftToolRequest(params),
    approvalId: params.approvalId,
  };
  const response = await fetch(`${params.proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (response.status !== 200 || body['allowed'] !== true || body['approvedByHuman'] !== true) {
    throw new Error(`Approved draft execution failed: ${JSON.stringify(body)}`);
  }

  return appendEvidenceEntry({
    chain: params.evidenceChain,
    event: 'draft_executed',
    channel: params.draft.channel,
    toolName: toolForChannel(params.draft.channel),
    attempt: params.attempt,
    proxyStatus: response.status,
    approvalId: params.approvalId,
    approvalStatus: 'approved',
    request,
    response: body,
  });
}

function makeDraftToolRequest(params: {
  readonly prospect: GrowthStudioScoredProspectV1;
  readonly contentBrief: GrowthStudioContentBriefV1;
  readonly draft: GrowthStudioContentDraftV1;
}) {
  return {
    toolName: toolForChannel(params.draft.channel),
    policyTier: 'Auto',
    parameters: {
      draft: params.draft,
      prospectContext: {
        accountName: params.prospect.accountName,
        accountDomain: params.prospect.accountDomain,
        targetRole: params.prospect.targetRole,
        fitScore: params.prospect.fitScore,
        buyingSignals: params.prospect.buyingSignals,
      },
      contentBrief: params.contentBrief,
      triageCard: {
        title: params.draft.title,
        fullDraftContent: params.draft.body,
        prospectContext: `${params.prospect.targetRole} at ${params.prospect.accountName}`,
        citations: params.draft.citationMap,
      },
    },
  } as const;
}

function appendEvidenceEntry(params: {
  readonly chain: GrowthStudioContentEvidenceEntryV1[];
  readonly event: GrowthStudioContentEvidenceEntryV1['event'];
  readonly channel: GrowthStudioContentChannelV1;
  readonly toolName: GrowthStudioContentEvidenceEntryV1['toolName'];
  readonly attempt: number;
  readonly proxyStatus: number;
  readonly approvalId?: string;
  readonly approvalStatus?: 'pending' | 'approved' | 'denied';
  readonly operatorDecision?: GrowthStudioContentEvidenceEntryV1['operatorDecision'];
  readonly request: Readonly<Record<string, unknown>>;
  readonly response: Readonly<Record<string, unknown>>;
}): GrowthStudioContentEvidenceEntryV1 {
  const previous = params.chain.at(-1);
  const sequence = params.chain.length + 1;
  const baseEntry = {
    sequence,
    evidenceId: `growth-content-ev-${sequence}`,
    ...(previous ? { previousHash: previous.hashSha256 } : {}),
    event: params.event,
    channel: params.channel,
    toolName: params.toolName,
    attempt: params.attempt,
    requestedTier: 'Auto' as const,
    requiredTier: 'HumanApprove' as const,
    proxyStatus: params.proxyStatus,
    ...(params.approvalId ? { approvalId: params.approvalId } : {}),
    ...(params.approvalStatus ? { approvalStatus: params.approvalStatus } : {}),
    ...(params.operatorDecision ? { operatorDecision: params.operatorDecision } : {}),
    request: params.request,
    response: params.response,
  };
  const hashSha256 = hashEvidence(baseEntry);
  const entry = { ...baseEntry, hashSha256 };
  params.chain.push(entry);
  return entry;
}

function buildDraft(params: {
  readonly prospect: GrowthStudioScoredProspectV1;
  readonly contentBrief: GrowthStudioContentBriefV1;
  readonly channel: GrowthStudioContentChannelV1;
  readonly revision: number;
  readonly feedback?: string;
}): GrowthStudioContentDraftV1 {
  const signal = params.prospect.buyingSignals[0];
  const sourceUrl = signal?.sourceUrl ?? 'https://example.com/source';
  const citedSignal = signal?.signal ?? 'source-backed operational governance signal';
  const revisionSuffix =
    params.revision > 0
      ? ` Revision ${params.revision}: ${params.feedback ?? 'operator edits'}.`
      : '';
  const title = titleForChannel(params.channel, params.prospect, params.contentBrief);
  const body = bodyForChannel(
    params.channel,
    params.prospect,
    params.contentBrief,
    citedSignal,
  ).concat(revisionSuffix);
  const citationMap = params.contentBrief.requiredClaims.map((claim) => ({
    claim,
    sourceUrl,
  }));
  const draftWithoutHash = {
    draftId: `growth-content-${params.channel}-${params.revision + 1}`,
    channel: params.channel,
    title,
    body,
    citationMap,
    status: params.revision > 0 ? ('needs_changes' as const) : ('draft' as const),
    revision: params.revision,
  };

  return {
    ...draftWithoutHash,
    contentHash: hashEvidence(draftWithoutHash),
  };
}

function bodyForChannel(
  channel: GrowthStudioContentChannelV1,
  prospect: GrowthStudioScoredProspectV1,
  brief: GrowthStudioContentBriefV1,
  citedSignal: string,
): string {
  if (channel === 'email') {
    return [
      `Hi ${prospect.targetRole},`,
      `${citedSignal} That is why ${brief.primaryMessage}`,
      `Would a ${brief.offer} be useful next week?`,
    ].join('\n\n');
  }

  if (channel === 'linkedin') {
    return `${brief.primaryMessage} Teams like ${prospect.accountName} are already showing the signal: ${citedSignal} ${brief.offer}.`;
  }

  return [
    `# ${brief.campaignName}: ${prospect.accountName}`,
    `${brief.objective}`,
    `${brief.primaryMessage}`,
    `Source-backed signal: ${citedSignal}`,
    `Offer: ${brief.offer}`,
  ].join('\n\n');
}

function titleForChannel(
  channel: GrowthStudioContentChannelV1,
  prospect: GrowthStudioScoredProspectV1,
  brief: GrowthStudioContentBriefV1,
): string {
  if (channel === 'email') return `${brief.offer} for ${prospect.accountName}`;
  if (channel === 'linkedin') return `${brief.campaignName} LinkedIn draft`;
  return `${brief.campaignName}: cited workflow governance article`;
}

function requestedChannels(
  brief: GrowthStudioContentBriefV1,
): readonly GrowthStudioContentChannelV1[] {
  const channels =
    brief.channels.length > 0 ? brief.channels : (['email', 'linkedin', 'blog'] as const);
  return channels.filter((channel, index) => channels.indexOf(channel) === index);
}

function toolForChannel(
  channel: GrowthStudioContentChannelV1,
): GrowthStudioContentEvidenceEntryV1['toolName'] {
  if (channel === 'email') return 'draft-email';
  if (channel === 'linkedin') return 'draft-linkedin-post';
  return 'draft-blog-article';
}

function requireApprovalId(entry: GrowthStudioContentEvidenceEntryV1): string {
  if (!entry.approvalId) {
    throw new Error(`Expected approvalId on ${entry.event} for ${entry.channel}`);
  }
  return entry.approvalId;
}

function hashEvidence(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
