import { createHash } from 'node:crypto';

import type { LLMAdapter } from '../lab-agent-adapter.js';
import type {
  GrowthStudioApprovedContentV1,
  GrowthStudioContentChannelV1,
} from './content-creator-agent-loop.js';

export const GROWTH_STUDIO_OUTREACH_EXECUTOR_SYSTEM_PROMPT =
  'You are the Growth Studio OutreachExecutor. Execute only pre-approved content, require ManualOnly approval for externally visible actions, and record evidence for every handoff.';

export const GROWTH_STUDIO_OUTREACH_EXECUTOR_AGENT_CONFIG = {
  llmProvider: 'openrouter',
  llmAdapter: 'lab-agent-adapter',
  pollIntervalMs: 10_000,
  approvalTimeoutMs: 60 * 60 * 1000,
  output: 'ExecutionResult[]',
} as const;

export type GrowthStudioExecutionResultStatusV1 =
  | 'sent'
  | 'published'
  | 'skipped'
  | 'failed'
  | 'manual_required';

export interface GrowthStudioExecutionResultV1 {
  readonly executionId: string;
  readonly approvalId: string;
  readonly channel: GrowthStudioContentChannelV1;
  readonly result: GrowthStudioExecutionResultStatusV1;
  readonly receiptUrl?: string;
  readonly failureReason?: string;
  readonly evidenceArtifactIds: readonly string[];
}

export interface GrowthStudioOutreachEvidenceEntryV1 {
  readonly sequence: number;
  readonly evidenceId: string;
  readonly previousHash?: string;
  readonly hashSha256: string;
  readonly event:
    | 'execution_submitted'
    | 'execution_decided'
    | 'execution_completed'
    | 'crm_update_submitted'
    | 'crm_update_decided'
    | 'crm_update_completed'
    | 'execution_aborted';
  readonly channel: GrowthStudioContentChannelV1;
  readonly toolName:
    | 'send-email'
    | 'publish-linkedin-post'
    | 'publish-blog-article'
    | 'update-crm-contact';
  readonly requestedTier: 'Auto';
  readonly requiredTier: 'ManualOnly' | 'HumanApprove';
  readonly proxyStatus: number;
  readonly approvalId?: string;
  readonly approvalStatus?: 'pending' | 'approved' | 'denied';
  readonly operatorDecision?: 'approved' | 'denied' | 'timeout';
  readonly draftApprovalId: string;
  readonly draftApprovalEvidenceHash: string;
  readonly draftExecutionEvidenceHash: string;
  readonly approvedContentHash: string;
  readonly request: Readonly<Record<string, unknown>>;
  readonly response: Readonly<Record<string, unknown>>;
}

export interface GrowthStudioOutreachExecutorLoopResultV1 {
  readonly agentConfig: typeof GROWTH_STUDIO_OUTREACH_EXECUTOR_AGENT_CONFIG;
  readonly executionResults: readonly GrowthStudioExecutionResultV1[];
  readonly evidenceChain: readonly GrowthStudioOutreachEvidenceEntryV1[];
  readonly crmUpdates: readonly GrowthStudioOutreachEvidenceEntryV1[];
  readonly validation: {
    readonly valid: boolean;
    readonly errors: readonly string[];
  };
  readonly llmTextOutputs: readonly string[];
}

export type GrowthStudioOutreachOperatorDecisionV1 = Readonly<{
  decision: 'approved' | 'denied' | 'timeout';
  rationale: string;
}>;

export interface RunGrowthStudioOutreachExecutorLoopOptions {
  readonly approvedContent: readonly GrowthStudioApprovedContentV1[];
  readonly proxyUrl: string;
  readonly adapter?: LLMAdapter;
  readonly observedAtIso?: string;
  readonly operatorDecision?: (input: {
    readonly approvalId: string;
    readonly channel: GrowthStudioContentChannelV1;
    readonly toolName: 'send-email' | 'publish-linkedin-post' | 'publish-blog-article';
    readonly content: GrowthStudioApprovedContentV1;
  }) => Promise<GrowthStudioOutreachOperatorDecisionV1> | GrowthStudioOutreachOperatorDecisionV1;
  readonly crmOperatorDecision?: (input: {
    readonly approvalId: string;
    readonly channel: GrowthStudioContentChannelV1;
    readonly content: GrowthStudioApprovedContentV1;
    readonly executionResult: GrowthStudioExecutionResultV1;
  }) => Promise<GrowthStudioOutreachOperatorDecisionV1> | GrowthStudioOutreachOperatorDecisionV1;
}

export async function runGrowthStudioOutreachExecutorLoopV1(
  options: RunGrowthStudioOutreachExecutorLoopOptions,
): Promise<GrowthStudioOutreachExecutorLoopResultV1> {
  const observedAt = options.observedAtIso ?? new Date().toISOString();
  const validationBeforeRun = validateApprovedContentForExecution(options.approvedContent);
  if (!validationBeforeRun.valid) {
    return {
      agentConfig: GROWTH_STUDIO_OUTREACH_EXECUTOR_AGENT_CONFIG,
      executionResults: [],
      evidenceChain: [],
      crmUpdates: [],
      validation: validationBeforeRun,
      llmTextOutputs: [],
    };
  }

  const llmTextOutputs = await runOptionalExecutionPlanningTurn(options);
  const evidenceChain: GrowthStudioOutreachEvidenceEntryV1[] = [];
  const executionResults: GrowthStudioExecutionResultV1[] = [];
  const crmUpdates: GrowthStudioOutreachEvidenceEntryV1[] = [];

  for (const content of options.approvedContent) {
    const toolName = toolForChannel(content.draft.channel);
    const submitEntry = await submitExecutionForManualApproval({
      proxyUrl: options.proxyUrl,
      content,
      toolName,
      evidenceChain,
    });
    const approvalId = requireApprovalId(submitEntry);
    const operatorDecision = await decideExecutionApproval({
      proxyUrl: options.proxyUrl,
      approvalId,
      content,
      toolName,
      operatorDecision: options.operatorDecision,
    });

    appendEvidenceEntry({
      chain: evidenceChain,
      event: 'execution_decided',
      channel: content.draft.channel,
      toolName,
      requiredTier: 'ManualOnly',
      proxyStatus: operatorDecision.proxyStatus,
      approvalId,
      approvalStatus: operatorDecision.approvalStatus,
      operatorDecision: operatorDecision.decision,
      content,
      request: operatorDecision.request,
      response: operatorDecision.response,
    });

    if (operatorDecision.decision !== 'approved') {
      const aborted = appendEvidenceEntry({
        chain: evidenceChain,
        event: 'execution_aborted',
        channel: content.draft.channel,
        toolName,
        requiredTier: 'ManualOnly',
        proxyStatus: 0,
        approvalId,
        approvalStatus: operatorDecision.approvalStatus,
        operatorDecision: operatorDecision.decision,
        content,
        request: { reason: operatorDecision.rationale },
        response: { result: 'manual_required' },
      });
      executionResults.push({
        executionId: `growth-outreach-${content.draft.channel}-${executionResults.length + 1}`,
        approvalId,
        channel: content.draft.channel,
        result: operatorDecision.decision === 'timeout' ? 'manual_required' : 'skipped',
        failureReason: operatorDecision.rationale,
        evidenceArtifactIds: [
          content.approvalEvidenceHash,
          content.executionEvidenceHash,
          aborted.evidenceId,
        ],
      });
      continue;
    }

    const completedEntry = await executeApprovedOutboundAction({
      proxyUrl: options.proxyUrl,
      approvalId,
      content,
      toolName,
      evidenceChain,
    });
    const executionResult: GrowthStudioExecutionResultV1 = {
      executionId: `growth-outreach-${content.draft.channel}-${executionResults.length + 1}`,
      approvalId,
      channel: content.draft.channel,
      result: content.draft.channel === 'email' ? 'sent' : 'published',
      receiptUrl: receiptUrlFor(content, observedAt),
      evidenceArtifactIds: [
        content.approvalEvidenceHash,
        content.executionEvidenceHash,
        completedEntry.evidenceId,
      ],
    };
    executionResults.push(executionResult);

    const crmUpdate = await updateCrmAfterExecution({
      proxyUrl: options.proxyUrl,
      content,
      executionResult,
      evidenceChain,
      crmOperatorDecision: options.crmOperatorDecision,
    });
    crmUpdates.push(...crmUpdate);
  }

  const validation = validateGrowthStudioExecutionResultsV1(
    executionResults,
    options.approvedContent,
    evidenceChain,
  );

  return {
    agentConfig: GROWTH_STUDIO_OUTREACH_EXECUTOR_AGENT_CONFIG,
    executionResults,
    evidenceChain,
    crmUpdates,
    validation,
    llmTextOutputs,
  };
}

export function validateGrowthStudioExecutionResultsV1(
  executionResults: readonly GrowthStudioExecutionResultV1[],
  approvedContent: readonly GrowthStudioApprovedContentV1[],
  evidenceChain: readonly GrowthStudioOutreachEvidenceEntryV1[],
): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  if (executionResults.length !== approvedContent.length) {
    errors.push('executionResults must include one result for each approved content item');
  }

  executionResults.forEach((result, index) => {
    const prefix = `executionResults[${index}]`;
    if (!result.executionId.trim()) errors.push(`${prefix}.executionId is required`);
    if (!result.approvalId.trim()) errors.push(`${prefix}.approvalId is required`);
    if (result.evidenceArtifactIds.length < 3) {
      errors.push(`${prefix}.evidenceArtifactIds must include draft, approval, and execution refs`);
    }
    if (
      (result.result === 'sent' || result.result === 'published') &&
      !result.receiptUrl?.startsWith('https://')
    ) {
      errors.push(`${prefix}.receiptUrl must be an HTTPS URL after execution`);
    }
    if (
      (result.result === 'failed' ||
        result.result === 'skipped' ||
        result.result === 'manual_required') &&
      !result.failureReason
    ) {
      errors.push(`${prefix}.failureReason is required for non-success results`);
    }
  });

  for (const content of approvedContent) {
    const hasOutbound = evidenceChain.some(
      (entry) =>
        entry.approvedContentHash === content.draft.contentHash &&
        entry.event === 'execution_submitted' &&
        entry.requiredTier === 'ManualOnly',
    );
    if (!hasOutbound) {
      errors.push(`approved content ${content.draft.draftId} was not submitted to ManualOnly`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertGrowthStudioOutreachEvidenceChainV1(
  chain: readonly GrowthStudioOutreachEvidenceEntryV1[],
): void {
  for (let index = 1; index < chain.length; index++) {
    const previous = chain[index - 1]!;
    const current = chain[index]!;
    if (current.previousHash !== previous.hashSha256) {
      throw new Error(
        `Growth Studio outreach evidence chain broken at ${index}: ${String(
          current.previousHash,
        )} does not match ${previous.hashSha256}`,
      );
    }
  }
}

async function runOptionalExecutionPlanningTurn(
  options: RunGrowthStudioOutreachExecutorLoopOptions,
): Promise<readonly string[]> {
  if (!options.adapter) return [];

  const turn = await options.adapter.startConversation(
    GROWTH_STUDIO_OUTREACH_EXECUTOR_SYSTEM_PROMPT,
    [
      `Approved content count: ${options.approvedContent.length}`,
      `Channels: ${options.approvedContent.map((content) => content.draft.channel).join(', ')}`,
      'Plan ManualOnly send/publish approvals, then HumanApprove CRM activity updates.',
    ].join('\n'),
  );
  return turn.textOutputs;
}

async function submitExecutionForManualApproval(params: {
  readonly proxyUrl: string;
  readonly content: GrowthStudioApprovedContentV1;
  readonly toolName: 'send-email' | 'publish-linkedin-post' | 'publish-blog-article';
  readonly evidenceChain: GrowthStudioOutreachEvidenceEntryV1[];
}): Promise<GrowthStudioOutreachEvidenceEntryV1> {
  const request = makeOutboundToolRequest(params.content, params.toolName);
  const response = await fetch(`${params.proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as Record<string, unknown>;
  const approvalId = typeof body['approvalId'] === 'string' ? body['approvalId'] : undefined;

  if (response.status !== 202 || body['status'] !== 'awaiting_approval' || !approvalId) {
    throw new Error(`${params.toolName} should pause at ManualOnly approval gate.`);
  }

  return appendEvidenceEntry({
    chain: params.evidenceChain,
    event: 'execution_submitted',
    channel: params.content.draft.channel,
    toolName: params.toolName,
    requiredTier: 'ManualOnly',
    proxyStatus: response.status,
    approvalId,
    approvalStatus: 'pending',
    content: params.content,
    request,
    response: body,
  });
}

async function decideExecutionApproval(params: {
  readonly proxyUrl: string;
  readonly approvalId: string;
  readonly content: GrowthStudioApprovedContentV1;
  readonly toolName: 'send-email' | 'publish-linkedin-post' | 'publish-blog-article';
  readonly operatorDecision?: RunGrowthStudioOutreachExecutorLoopOptions['operatorDecision'];
}) {
  const decision =
    (await params.operatorDecision?.({
      approvalId: params.approvalId,
      channel: params.content.draft.channel,
      toolName: params.toolName,
      content: params.content,
    })) ??
    ({
      decision: 'approved',
      rationale: 'Manual operator approved externally visible Growth Studio action.',
    } satisfies GrowthStudioOutreachOperatorDecisionV1);
  return submitProxyDecision({
    proxyUrl: params.proxyUrl,
    approvalId: params.approvalId,
    decision,
    requestContext: {
      channel: params.content.draft.channel,
      toolName: params.toolName,
      approvedContentHash: params.content.draft.contentHash,
    },
  });
}

async function executeApprovedOutboundAction(params: {
  readonly proxyUrl: string;
  readonly approvalId: string;
  readonly content: GrowthStudioApprovedContentV1;
  readonly toolName: 'send-email' | 'publish-linkedin-post' | 'publish-blog-article';
  readonly evidenceChain: GrowthStudioOutreachEvidenceEntryV1[];
}): Promise<GrowthStudioOutreachEvidenceEntryV1> {
  const request = {
    ...makeOutboundToolRequest(params.content, params.toolName),
    approvalId: params.approvalId,
  };
  const response = await fetch(`${params.proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (response.status !== 200 || body['allowed'] !== true || body['approvedByHuman'] !== true) {
    throw new Error(`Approved ${params.toolName} execution failed: ${JSON.stringify(body)}`);
  }

  return appendEvidenceEntry({
    chain: params.evidenceChain,
    event: 'execution_completed',
    channel: params.content.draft.channel,
    toolName: params.toolName,
    requiredTier: 'ManualOnly',
    proxyStatus: response.status,
    approvalId: params.approvalId,
    approvalStatus: 'approved',
    content: params.content,
    request,
    response: body,
  });
}

async function updateCrmAfterExecution(params: {
  readonly proxyUrl: string;
  readonly content: GrowthStudioApprovedContentV1;
  readonly executionResult: GrowthStudioExecutionResultV1;
  readonly evidenceChain: GrowthStudioOutreachEvidenceEntryV1[];
  readonly crmOperatorDecision?: RunGrowthStudioOutreachExecutorLoopOptions['crmOperatorDecision'];
}): Promise<readonly GrowthStudioOutreachEvidenceEntryV1[]> {
  const submitted = await submitCrmUpdateForApproval(params);
  const approvalId = requireApprovalId(submitted);
  const decision =
    (await params.crmOperatorDecision?.({
      approvalId,
      channel: params.content.draft.channel,
      content: params.content,
      executionResult: params.executionResult,
    })) ??
    ({
      decision: 'approved',
      rationale: 'Approve CRM activity note after successful Growth Studio execution.',
    } satisfies GrowthStudioOutreachOperatorDecisionV1);
  const proxyDecision = await submitProxyDecision({
    proxyUrl: params.proxyUrl,
    approvalId,
    decision,
    requestContext: {
      channel: params.content.draft.channel,
      toolName: 'update-crm-contact',
      executionId: params.executionResult.executionId,
    },
  });
  const decided = appendEvidenceEntry({
    chain: params.evidenceChain,
    event: 'crm_update_decided',
    channel: params.content.draft.channel,
    toolName: 'update-crm-contact',
    requiredTier: 'HumanApprove',
    proxyStatus: proxyDecision.proxyStatus,
    approvalId,
    approvalStatus: proxyDecision.approvalStatus,
    operatorDecision: proxyDecision.decision,
    content: params.content,
    request: proxyDecision.request,
    response: proxyDecision.response,
  });

  if (decision.decision !== 'approved') return [submitted, decided];

  const completed = await executeApprovedCrmUpdate({
    proxyUrl: params.proxyUrl,
    approvalId,
    content: params.content,
    executionResult: params.executionResult,
    evidenceChain: params.evidenceChain,
  });
  return [submitted, decided, completed];
}

async function submitCrmUpdateForApproval(params: {
  readonly proxyUrl: string;
  readonly content: GrowthStudioApprovedContentV1;
  readonly executionResult: GrowthStudioExecutionResultV1;
  readonly evidenceChain: GrowthStudioOutreachEvidenceEntryV1[];
}): Promise<GrowthStudioOutreachEvidenceEntryV1> {
  const request = makeCrmUpdateToolRequest(params.content, params.executionResult);
  const response = await fetch(`${params.proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as Record<string, unknown>;
  const approvalId = typeof body['approvalId'] === 'string' ? body['approvalId'] : undefined;

  if (response.status !== 202 || body['status'] !== 'awaiting_approval' || !approvalId) {
    throw new Error('update-crm-contact should pause at HumanApprove approval gate.');
  }

  return appendEvidenceEntry({
    chain: params.evidenceChain,
    event: 'crm_update_submitted',
    channel: params.content.draft.channel,
    toolName: 'update-crm-contact',
    requiredTier: 'HumanApprove',
    proxyStatus: response.status,
    approvalId,
    approvalStatus: 'pending',
    content: params.content,
    request,
    response: body,
  });
}

async function executeApprovedCrmUpdate(params: {
  readonly proxyUrl: string;
  readonly approvalId: string;
  readonly content: GrowthStudioApprovedContentV1;
  readonly executionResult: GrowthStudioExecutionResultV1;
  readonly evidenceChain: GrowthStudioOutreachEvidenceEntryV1[];
}): Promise<GrowthStudioOutreachEvidenceEntryV1> {
  const request = {
    ...makeCrmUpdateToolRequest(params.content, params.executionResult),
    approvalId: params.approvalId,
  };
  const response = await fetch(`${params.proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (response.status !== 200 || body['allowed'] !== true || body['approvedByHuman'] !== true) {
    throw new Error(`Approved CRM update failed: ${JSON.stringify(body)}`);
  }

  return appendEvidenceEntry({
    chain: params.evidenceChain,
    event: 'crm_update_completed',
    channel: params.content.draft.channel,
    toolName: 'update-crm-contact',
    requiredTier: 'HumanApprove',
    proxyStatus: response.status,
    approvalId: params.approvalId,
    approvalStatus: 'approved',
    content: params.content,
    request,
    response: body,
  });
}

async function submitProxyDecision(params: {
  readonly proxyUrl: string;
  readonly approvalId: string;
  readonly decision: GrowthStudioOutreachOperatorDecisionV1;
  readonly requestContext: Readonly<Record<string, unknown>>;
}): Promise<{
  readonly decision: 'approved' | 'denied' | 'timeout';
  readonly rationale: string;
  readonly proxyStatus: number;
  readonly approvalStatus: 'approved' | 'denied';
  readonly request: Readonly<Record<string, unknown>>;
  readonly response: Readonly<Record<string, unknown>>;
}> {
  const proxyDecision = params.decision.decision === 'approved' ? 'approved' : 'denied';
  const request = {
    decision: proxyDecision,
    rationale: params.decision.rationale,
    ...params.requestContext,
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
    decision: params.decision.decision,
    rationale: params.decision.rationale,
    proxyStatus: response.status,
    approvalStatus: proxyDecision,
    request,
    response: body,
  };
}

function makeOutboundToolRequest(
  content: GrowthStudioApprovedContentV1,
  toolName: 'send-email' | 'publish-linkedin-post' | 'publish-blog-article',
) {
  return {
    toolName,
    policyTier: 'Auto',
    parameters: {
      approvedDraft: content.draft,
      draftApproval: {
        approvalId: content.approvalId,
        approvedAt: content.approvedAt,
        approvalEvidenceHash: content.approvalEvidenceHash,
        executionEvidenceHash: content.executionEvidenceHash,
      },
      target: targetFor(content),
      contentHash: content.draft.contentHash,
    },
  } as const;
}

function makeCrmUpdateToolRequest(
  content: GrowthStudioApprovedContentV1,
  executionResult: GrowthStudioExecutionResultV1,
) {
  return {
    toolName: 'update-crm-contact',
    policyTier: 'Auto',
    parameters: {
      contactRef: targetFor(content),
      activityNote: `${content.draft.channel} ${executionResult.result}: ${content.draft.title}`,
      executionId: executionResult.executionId,
      receiptUrl: executionResult.receiptUrl,
      approvedContentHash: content.draft.contentHash,
    },
  } as const;
}

function appendEvidenceEntry(params: {
  readonly chain: GrowthStudioOutreachEvidenceEntryV1[];
  readonly event: GrowthStudioOutreachEvidenceEntryV1['event'];
  readonly channel: GrowthStudioContentChannelV1;
  readonly toolName: GrowthStudioOutreachEvidenceEntryV1['toolName'];
  readonly requiredTier: GrowthStudioOutreachEvidenceEntryV1['requiredTier'];
  readonly proxyStatus: number;
  readonly approvalId?: string;
  readonly approvalStatus?: 'pending' | 'approved' | 'denied';
  readonly operatorDecision?: GrowthStudioOutreachEvidenceEntryV1['operatorDecision'];
  readonly content: GrowthStudioApprovedContentV1;
  readonly request: Readonly<Record<string, unknown>>;
  readonly response: Readonly<Record<string, unknown>>;
}): GrowthStudioOutreachEvidenceEntryV1 {
  const previous = params.chain.at(-1);
  const sequence = params.chain.length + 1;
  const baseEntry = {
    sequence,
    evidenceId: `growth-outreach-ev-${sequence}`,
    ...(previous ? { previousHash: previous.hashSha256 } : {}),
    event: params.event,
    channel: params.channel,
    toolName: params.toolName,
    requestedTier: 'Auto' as const,
    requiredTier: params.requiredTier,
    proxyStatus: params.proxyStatus,
    ...(params.approvalId ? { approvalId: params.approvalId } : {}),
    ...(params.approvalStatus ? { approvalStatus: params.approvalStatus } : {}),
    ...(params.operatorDecision ? { operatorDecision: params.operatorDecision } : {}),
    draftApprovalId: params.content.approvalId,
    draftApprovalEvidenceHash: params.content.approvalEvidenceHash,
    draftExecutionEvidenceHash: params.content.executionEvidenceHash,
    approvedContentHash: params.content.draft.contentHash,
    request: params.request,
    response: params.response,
  };
  const hashSha256 = hashEvidence(baseEntry);
  const entry = { ...baseEntry, hashSha256 };
  params.chain.push(entry);
  return entry;
}

function validateApprovedContentForExecution(
  approvedContent: readonly GrowthStudioApprovedContentV1[],
): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  if (approvedContent.length === 0) errors.push('approvedContent must not be empty');

  approvedContent.forEach((content, index) => {
    const prefix = `approvedContent[${index}]`;
    if (content.draft.status !== 'approved') {
      errors.push(`${prefix}.draft.status must be approved before execution`);
    }
    if (!isSha256(content.draft.contentHash)) {
      errors.push(`${prefix}.draft.contentHash must be a sha256 hash`);
    }
    if (!isSha256(content.approvalEvidenceHash)) {
      errors.push(`${prefix}.approvalEvidenceHash must be a sha256 hash`);
    }
    if (!isSha256(content.executionEvidenceHash)) {
      errors.push(`${prefix}.executionEvidenceHash must be a sha256 hash`);
    }
  });

  return { valid: errors.length === 0, errors };
}

function toolForChannel(
  channel: GrowthStudioContentChannelV1,
): 'send-email' | 'publish-linkedin-post' | 'publish-blog-article' {
  if (channel === 'email') return 'send-email';
  if (channel === 'linkedin') return 'publish-linkedin-post';
  return 'publish-blog-article';
}

function receiptUrlFor(content: GrowthStudioApprovedContentV1, observedAt: string): string {
  const stamp = observedAt.slice(0, 10);
  return `https://receipts.growth-studio.example/${content.draft.channel}/${content.draft.draftId}/${stamp}`;
}

function targetFor(content: GrowthStudioApprovedContentV1): string {
  if (content.draft.channel === 'email') return 'vp-operations@atlas-workflow.example';
  if (content.draft.channel === 'linkedin') return 'linkedin:company/atlas-workflow';
  return 'blog:portarium-growth-studio';
}

function requireApprovalId(entry: GrowthStudioOutreachEvidenceEntryV1): string {
  if (!entry.approvalId) throw new Error(`Expected approvalId on ${entry.event}`);
  return entry.approvalId;
}

function hashEvidence(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
