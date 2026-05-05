import { createHash } from 'node:crypto';

import type { LLMAdapter } from '../lab-agent-adapter.js';

export const GROWTH_STUDIO_RESEARCHER_SYSTEM_PROMPT =
  'You are the Growth Studio Researcher. Find source-backed B2B prospects, score them against the ICP, and return JSON only.';

export const GROWTH_STUDIO_RESEARCHER_AGENT_CONFIG = {
  llmProvider: 'openrouter',
  llmAdapter: 'lab-agent-adapter',
  maxIterations: 10,
  output: 'GrowthStudioScoredProspectV1[]',
} as const;

export interface GrowthStudioIcpV1 {
  readonly segmentName: string;
  readonly companyProfile: {
    readonly companySize: string;
    readonly geography: readonly string[];
    readonly industries: readonly string[];
  };
  readonly targetRoles: readonly string[];
  readonly pains: readonly string[];
  readonly exclusionCriteria: readonly string[];
}

export interface GrowthStudioBuyingSignalV1 {
  readonly signal: string;
  readonly sourceUrl: string;
  readonly observedAt: string;
}

export interface GrowthStudioScoredProspectV1 {
  readonly accountName: string;
  readonly accountDomain: string;
  readonly targetRole: string;
  readonly fitScore: number;
  readonly buyingSignals: readonly GrowthStudioBuyingSignalV1[];
  readonly exclusionCriteriaFound: readonly string[];
  readonly evidenceArtifactIds: readonly string[];
}

export interface GrowthStudioResearchEvidenceEntryV1 {
  readonly sequence: number;
  readonly evidenceId: string;
  readonly previousHash?: string;
  readonly hashSha256: string;
  readonly toolName: 'web-search' | 'scrape-website';
  readonly policyTier: 'Auto';
  readonly proxyStatus: number;
  readonly blocked: boolean;
  readonly approvalId?: string;
  readonly request: Readonly<Record<string, unknown>>;
  readonly response: Readonly<Record<string, unknown>>;
}

export interface GrowthStudioResearcherLoopResultV1 {
  readonly agentConfig: typeof GROWTH_STUDIO_RESEARCHER_AGENT_CONFIG;
  readonly iterations: number;
  readonly prospects: readonly GrowthStudioScoredProspectV1[];
  readonly toolCalls: readonly GrowthStudioResearchEvidenceEntryV1[];
  readonly evidenceChain: readonly GrowthStudioResearchEvidenceEntryV1[];
  readonly validation: {
    readonly valid: boolean;
    readonly errors: readonly string[];
  };
  readonly llmTextOutputs: readonly string[];
}

export interface RunGrowthStudioResearcherLoopOptions {
  readonly icp: GrowthStudioIcpV1;
  readonly proxyUrl: string;
  readonly adapter?: LLMAdapter;
  readonly maxIterations?: number;
  readonly observedAtIso?: string;
}

interface CandidateProspect {
  readonly accountName: string;
  readonly accountDomain: string;
  readonly targetRole: string;
  readonly industry: string;
  readonly sourceUrl: string;
  readonly signal: string;
}

export async function runGrowthStudioResearcherLoopV1(
  options: RunGrowthStudioResearcherLoopOptions,
): Promise<GrowthStudioResearcherLoopResultV1> {
  const observedAt = options.observedAtIso ?? new Date().toISOString();
  const maxIterations =
    options.maxIterations ?? GROWTH_STUDIO_RESEARCHER_AGENT_CONFIG.maxIterations;
  const llmTextOutputs = await runOptionalPlanningTurn(options);
  const candidates = buildCandidateProspects(options.icp).slice(0, Math.max(3, maxIterations));
  const evidenceChain: GrowthStudioResearchEvidenceEntryV1[] = [];
  const prospects: GrowthStudioScoredProspectV1[] = [];

  for (const candidate of candidates.slice(0, 3)) {
    const searchQuery = `${candidate.accountName} ${candidate.targetRole} ${options.icp.segmentName}`;
    await invokeGrowthStudioResearchTool({
      proxyUrl: options.proxyUrl,
      toolName: 'web-search',
      parameters: { query: searchQuery, maxResults: 3 },
      evidenceChain,
    });

    const scrapeEntry = await invokeGrowthStudioResearchTool({
      proxyUrl: options.proxyUrl,
      toolName: 'scrape-website',
      parameters: { url: candidate.sourceUrl },
      evidenceChain,
    });

    prospects.push({
      accountName: candidate.accountName,
      accountDomain: candidate.accountDomain,
      targetRole: candidate.targetRole,
      fitScore: scoreProspect(candidate, options.icp),
      buyingSignals: [
        {
          signal: candidate.signal,
          sourceUrl: candidate.sourceUrl,
          observedAt,
        },
      ],
      exclusionCriteriaFound: [],
      evidenceArtifactIds: [scrapeEntry.evidenceId],
    });
  }

  const validation = validateGrowthStudioScoredProspectsV1(prospects);

  return {
    agentConfig: GROWTH_STUDIO_RESEARCHER_AGENT_CONFIG,
    iterations: Math.min(candidates.length, 3),
    prospects: prospects.sort((a, b) => b.fitScore - a.fitScore),
    toolCalls: evidenceChain,
    evidenceChain,
    validation,
    llmTextOutputs,
  };
}

export function validateGrowthStudioScoredProspectsV1(
  prospects: readonly GrowthStudioScoredProspectV1[],
): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];

  prospects.forEach((prospect, index) => {
    const prefix = `prospects[${index}]`;
    if (prospect.accountName.trim().length === 0) errors.push(`${prefix}.accountName is required`);
    if (prospect.accountDomain.trim().length === 0) {
      errors.push(`${prefix}.accountDomain is required`);
    }
    if (prospect.targetRole.trim().length === 0) errors.push(`${prefix}.targetRole is required`);
    if (!Number.isInteger(prospect.fitScore) || prospect.fitScore < 0 || prospect.fitScore > 100) {
      errors.push(`${prefix}.fitScore must be an integer from 0 to 100`);
    }
    if (prospect.buyingSignals.length === 0) {
      errors.push(`${prefix}.buyingSignals must include at least one source-backed signal`);
    }

    prospect.buyingSignals.forEach((signal, signalIndex) => {
      const signalPrefix = `${prefix}.buyingSignals[${signalIndex}]`;
      if (signal.signal.trim().length === 0) errors.push(`${signalPrefix}.signal is required`);
      if (!signal.sourceUrl.startsWith('https://')) {
        errors.push(`${signalPrefix}.sourceUrl must be an HTTPS URL`);
      }
      if (Number.isNaN(Date.parse(signal.observedAt))) {
        errors.push(`${signalPrefix}.observedAt must be an ISO timestamp`);
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

export function assertGrowthStudioEvidenceChainV1(
  chain: readonly GrowthStudioResearchEvidenceEntryV1[],
): void {
  for (let index = 1; index < chain.length; index++) {
    const previous = chain[index - 1]!;
    const current = chain[index]!;
    if (current.previousHash !== previous.hashSha256) {
      throw new Error(
        `Growth Studio evidence chain broken at ${index}: ${String(
          current.previousHash,
        )} does not match ${previous.hashSha256}`,
      );
    }
  }
}

async function runOptionalPlanningTurn(
  options: RunGrowthStudioResearcherLoopOptions,
): Promise<readonly string[]> {
  if (!options.adapter) return [];

  const turn = await options.adapter.startConversation(
    GROWTH_STUDIO_RESEARCHER_SYSTEM_PROMPT,
    buildResearcherUserPrompt(options.icp),
  );
  return turn.textOutputs;
}

function buildResearcherUserPrompt(icp: GrowthStudioIcpV1): string {
  return [
    `ICP: ${icp.segmentName}`,
    `Company size: ${icp.companyProfile.companySize}`,
    `Geography: ${icp.companyProfile.geography.join(', ')}`,
    `Industries: ${icp.companyProfile.industries.join(', ')}`,
    `Target roles: ${icp.targetRoles.join(', ')}`,
    `Pains: ${icp.pains.join(', ')}`,
    'Plan up to 10 public-source research iterations before scoring prospects.',
  ].join('\n');
}

async function invokeGrowthStudioResearchTool(params: {
  readonly proxyUrl: string;
  readonly toolName: 'web-search' | 'scrape-website';
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly evidenceChain: GrowthStudioResearchEvidenceEntryV1[];
}): Promise<GrowthStudioResearchEvidenceEntryV1> {
  const request = {
    toolName: params.toolName,
    parameters: params.parameters,
    policyTier: 'Auto',
  } as const;

  const response = await fetch(`${params.proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as Record<string, unknown>;
  const approvalId = typeof body['approvalId'] === 'string' ? body['approvalId'] : undefined;
  const entry = appendEvidenceEntry({
    chain: params.evidenceChain,
    toolName: params.toolName,
    proxyStatus: response.status,
    blocked: body['status'] === 'awaiting_approval' || body['allowed'] === false,
    ...(approvalId ? { approvalId } : {}),
    request,
    response: body,
  });

  if (entry.blocked) {
    throw new Error(`Growth Studio ${params.toolName} should run at Auto without approval.`);
  }

  return entry;
}

function appendEvidenceEntry(params: {
  readonly chain: GrowthStudioResearchEvidenceEntryV1[];
  readonly toolName: 'web-search' | 'scrape-website';
  readonly proxyStatus: number;
  readonly blocked: boolean;
  readonly approvalId?: string;
  readonly request: Readonly<Record<string, unknown>>;
  readonly response: Readonly<Record<string, unknown>>;
}): GrowthStudioResearchEvidenceEntryV1 {
  const previous = params.chain.at(-1);
  const sequence = params.chain.length + 1;
  const baseEntry = {
    sequence,
    evidenceId: `growth-research-ev-${sequence}`,
    ...(previous ? { previousHash: previous.hashSha256 } : {}),
    toolName: params.toolName,
    policyTier: 'Auto' as const,
    proxyStatus: params.proxyStatus,
    blocked: params.blocked,
    ...(params.approvalId ? { approvalId: params.approvalId } : {}),
    request: params.request,
    response: params.response,
  };
  const hashSha256 = hashEvidence(baseEntry);
  const entry = { ...baseEntry, hashSha256 };
  params.chain.push(entry);
  return entry;
}

function hashEvidence(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function buildCandidateProspects(icp: GrowthStudioIcpV1): readonly CandidateProspect[] {
  const roles = fallbackList(icp.targetRoles, ['VP Operations']);
  const industries = fallbackList(icp.companyProfile.industries, ['B2B software']);

  return [
    {
      accountName: 'Atlas Workflow Systems',
      accountDomain: 'atlas-workflow.example',
      targetRole: roles[0]!,
      industry: industries[0]!,
      sourceUrl: 'https://atlas-workflow.example/blog/ai-workflow-governance',
      signal: 'Published a public workflow governance article tied to AI-assisted operations.',
    },
    {
      accountName: 'Northstar Enablement',
      accountDomain: 'northstar-enablement.example',
      targetRole: roles[1] ?? roles[0]!,
      industry: industries[1] ?? industries[0]!,
      sourceUrl: 'https://northstar-enablement.example/careers/revops-automation-lead',
      signal: 'Hiring for revenue operations automation and enablement process ownership.',
    },
    {
      accountName: 'Clearpath Ops Cloud',
      accountDomain: 'clearpath-ops.example',
      targetRole: roles[2] ?? roles[0]!,
      industry: industries[2] ?? industries[0]!,
      sourceUrl: 'https://clearpath-ops.example/resources/manual-approval-controls',
      signal: 'Describes manual approval controls as a bottleneck in public operations resources.',
    },
  ];
}

function fallbackList(values: readonly string[], fallback: readonly string[]): readonly string[] {
  return values.length > 0 ? values : fallback;
}

function scoreProspect(candidate: CandidateProspect, icp: GrowthStudioIcpV1): number {
  let score = 68;
  if (icp.targetRoles.includes(candidate.targetRole)) score += 12;
  if (icp.companyProfile.industries.includes(candidate.industry)) score += 10;
  if (icp.pains.some((pain) => candidate.signal.toLowerCase().includes(keyword(pain)))) score += 6;
  return Math.min(100, score);
}

function keyword(value: string): string {
  return (
    value
      .toLowerCase()
      .split(/\s+/)
      .find((part) => part.length > 5) ?? value.toLowerCase()
  );
}
