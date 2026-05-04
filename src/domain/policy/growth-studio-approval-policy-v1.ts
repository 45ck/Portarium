import { classifyOpenClawToolBlastRadiusV1 } from '../machines/openclaw-tool-blast-radius-v1.js';
import {
  PolicyId,
  UserId,
  WorkspaceId,
  type ExecutionTier,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

import type { PolicyInlineRuleV1, PolicyV1 } from './policy-v1.js';
import type { SodConstraintV1 } from './sod-constraints-v1.js';

export const GROWTH_STUDIO_READ_ONLY_TOOLS = [
  'web-search',
  'scrape-website',
  'read-crm-contact',
  'read-analytics',
] as const;

export const GROWTH_STUDIO_HUMAN_APPROVAL_TOOLS = [
  'draft-email',
  'draft-linkedin-post',
  'draft-blog-article',
  'update-crm-contact',
  'schedule-content',
] as const;

export const GROWTH_STUDIO_MANUAL_ONLY_TOOLS = [
  'send-email',
  'publish-linkedin-post',
  'publish-blog-article',
  'delete-crm-contact',
] as const;

export const GROWTH_STUDIO_DRAFT_APPROVAL_DUTY = 'growth-studio:draft-approval';
export const GROWTH_STUDIO_PUBLISH_APPROVAL_DUTY = 'growth-studio:publish-approval';

export type GrowthStudioApprovalExpiryActionV1 = 'DenyAndNotifyOperator' | 'DenyAndEscalateToAdmin';

export type GrowthStudioApprovalTimeoutV1 = Readonly<{
  tier: Extract<ExecutionTier, 'HumanApprove' | 'ManualOnly'>;
  timeoutMs: number;
  onExpiry: GrowthStudioApprovalExpiryActionV1;
}>;

export const GROWTH_STUDIO_HUMAN_APPROVAL_TIMEOUT_V1: GrowthStudioApprovalTimeoutV1 = {
  tier: 'HumanApprove',
  timeoutMs: 15 * 60 * 1000,
  onExpiry: 'DenyAndNotifyOperator',
};

export const GROWTH_STUDIO_MANUAL_ONLY_TIMEOUT_V1: GrowthStudioApprovalTimeoutV1 = {
  tier: 'ManualOnly',
  timeoutMs: 60 * 60 * 1000,
  onExpiry: 'DenyAndEscalateToAdmin',
};

export const GROWTH_STUDIO_BASE_SOD_CONSTRAINTS: readonly SodConstraintV1[] = [
  { kind: 'MakerChecker' },
];

export const GROWTH_STUDIO_PUBLISH_SOD_CONSTRAINTS: readonly SodConstraintV1[] = [
  { kind: 'DistinctApprovers', minimumApprovers: 2 },
  {
    kind: 'IncompatibleDuties',
    dutyKeys: [GROWTH_STUDIO_DRAFT_APPROVAL_DUTY, GROWTH_STUDIO_PUBLISH_APPROVAL_DUTY],
  },
];

export const GROWTH_STUDIO_APPROVAL_POLICY_RULES: readonly PolicyInlineRuleV1[] = [
  {
    ruleId: 'growth-studio-readonly-auto',
    condition: 'isReadOnlyTool == true && requestedTier == "Auto"',
    effect: 'Allow',
  },
  {
    ruleId: 'growth-studio-draft-human-approve',
    condition:
      'isDraftTool == true && requestedTier != "HumanApprove" && requestedTier != "ManualOnly"',
    effect: 'Deny',
  },
  {
    ruleId: 'growth-studio-mutation-human-approve',
    condition:
      'isHumanApprovalTool == true && requestedTier != "HumanApprove" && requestedTier != "ManualOnly"',
    effect: 'Deny',
  },
  {
    ruleId: 'growth-studio-publish-send-manual-only',
    condition: 'isPublishOrSendTool == true && requestedTier != "ManualOnly"',
    effect: 'Deny',
  },
  {
    ruleId: 'growth-studio-batch-manual-only',
    condition: 'contactCount > 5 && requestedTier != "ManualOnly"',
    effect: 'Deny',
  },
  {
    ruleId: 'growth-studio-budget-manual-only',
    condition: 'estimatedCostUsd > 50 && requestedTier != "ManualOnly"',
    effect: 'Deny',
  },
  {
    ruleId: 'growth-studio-publish-requires-draft-approval',
    condition: 'isPublishAction == true && draftApproved == false',
    effect: 'Deny',
  },
];

export type GrowthStudioApprovalPolicyInputV1 = Readonly<{
  toolName: string;
  requestedTier?: ExecutionTier;
  contactCount?: number;
  estimatedCostUsd?: number;
  draftApproved?: boolean;
}>;

export type GrowthStudioApprovalPolicyEvaluationV1 = Readonly<{
  toolName: string;
  requiredTier: ExecutionTier;
  requestedTier: ExecutionTier;
  matchedRuleIds: readonly string[];
  timeout?: GrowthStudioApprovalTimeoutV1;
  sodConstraints: readonly SodConstraintV1[];
}>;

export function createGrowthStudioApprovalPolicyV1(params: {
  workspaceId: WorkspaceIdType;
  createdByUserId: UserIdType;
  createdAtIso: string;
}): PolicyV1 {
  return {
    schemaVersion: 1,
    policyId: PolicyId('growth-studio-approval-policy-v1'),
    workspaceId: params.workspaceId,
    name: 'Growth Studio approval policy',
    description: 'Approval tier guards for Growth Studio prospecting and content actions.',
    active: true,
    priority: 100,
    version: 1,
    createdAtIso: params.createdAtIso,
    createdByUserId: params.createdByUserId,
    sodConstraints: GROWTH_STUDIO_BASE_SOD_CONSTRAINTS,
    rules: GROWTH_STUDIO_APPROVAL_POLICY_RULES,
  };
}

export function makeGrowthStudioApprovalPolicyFixtureV1(): PolicyV1 {
  return createGrowthStudioApprovalPolicyV1({
    workspaceId: WorkspaceId('ws-growth-studio'),
    createdByUserId: UserId('policy-author-growth-studio'),
    createdAtIso: '2026-05-04T00:00:00.000Z',
  });
}

export function evaluateGrowthStudioApprovalPolicyV1(
  input: GrowthStudioApprovalPolicyInputV1,
): GrowthStudioApprovalPolicyEvaluationV1 {
  const normalizedToolName = normalizeToolName(input.toolName);
  const requestedTier = input.requestedTier ?? 'Auto';
  const ruleContext = makeGrowthStudioPolicyRuleContextV1({
    ...input,
    toolName: normalizedToolName,
    requestedTier,
  });

  const matchedRuleIds: string[] = [];
  let requiredTier = baseRequiredTierForGrowthStudioTool(normalizedToolName);

  if (ruleContext.isReadOnlyTool) {
    matchedRuleIds.push('growth-studio-readonly-auto');
  }

  if (ruleContext.isDraftTool) {
    matchedRuleIds.push('growth-studio-draft-human-approve');
  }

  if (ruleContext.isHumanApprovalTool && !ruleContext.isDraftTool) {
    matchedRuleIds.push('growth-studio-mutation-human-approve');
  }

  if (ruleContext.isPublishOrSendTool) {
    requiredTier = 'ManualOnly';
    matchedRuleIds.push('growth-studio-publish-send-manual-only');
  }

  if (ruleContext.contactCount > 5) {
    requiredTier = 'ManualOnly';
    matchedRuleIds.push('growth-studio-batch-manual-only');
  }

  if (ruleContext.estimatedCostUsd > 50) {
    requiredTier = 'ManualOnly';
    matchedRuleIds.push('growth-studio-budget-manual-only');
  }

  if (ruleContext.isPublishAction && !ruleContext.draftApproved) {
    requiredTier = 'ManualOnly';
    matchedRuleIds.push('growth-studio-publish-requires-draft-approval');
  }

  const timeout = timeoutForGrowthStudioApprovalTierV1(requiredTier);

  return {
    toolName: normalizedToolName,
    requiredTier,
    requestedTier,
    matchedRuleIds,
    ...(timeout ? { timeout } : {}),
    sodConstraints: getGrowthStudioSodConstraintsForToolV1(normalizedToolName),
  };
}

export function makeGrowthStudioPolicyRuleContextV1(input: GrowthStudioApprovalPolicyInputV1): {
  readonly toolName: string;
  readonly requestedTier: ExecutionTier;
  readonly contactCount: number;
  readonly estimatedCostUsd: number;
  readonly draftApproved: boolean;
  readonly isReadOnlyTool: boolean;
  readonly isDraftTool: boolean;
  readonly isHumanApprovalTool: boolean;
  readonly isPublishAction: boolean;
  readonly isPublishOrSendTool: boolean;
} {
  const toolName = normalizeToolName(input.toolName);
  const classification = classifyOpenClawToolBlastRadiusV1(toolName);
  const requestedTier = input.requestedTier ?? classification.minimumTier;
  const isDraftTool = toolName.startsWith('draft-');
  const isPublishAction = toolName.startsWith('publish-');
  const isPublishOrSendTool = isPublishAction || toolName.startsWith('send-');

  return {
    toolName,
    requestedTier,
    contactCount: input.contactCount ?? 0,
    estimatedCostUsd: input.estimatedCostUsd ?? 0,
    draftApproved: input.draftApproved ?? false,
    isReadOnlyTool: classification.category === 'ReadOnly',
    isDraftTool,
    isHumanApprovalTool:
      classification.category === 'Mutation' || isGrowthStudioHumanApprovalTool(toolName),
    isPublishAction,
    isPublishOrSendTool,
  };
}

export function getGrowthStudioSodConstraintsForToolV1(
  toolName: string,
): readonly SodConstraintV1[] {
  const normalizedToolName = normalizeToolName(toolName);
  if (normalizedToolName.startsWith('publish-') || normalizedToolName.startsWith('send-')) {
    return [...GROWTH_STUDIO_BASE_SOD_CONSTRAINTS, ...GROWTH_STUDIO_PUBLISH_SOD_CONSTRAINTS];
  }
  return GROWTH_STUDIO_BASE_SOD_CONSTRAINTS;
}

export function timeoutForGrowthStudioApprovalTierV1(
  tier: ExecutionTier,
): GrowthStudioApprovalTimeoutV1 | undefined {
  if (tier === 'HumanApprove') return GROWTH_STUDIO_HUMAN_APPROVAL_TIMEOUT_V1;
  if (tier === 'ManualOnly') return GROWTH_STUDIO_MANUAL_ONLY_TIMEOUT_V1;
  return undefined;
}

function baseRequiredTierForGrowthStudioTool(toolName: string): ExecutionTier {
  if (isGrowthStudioManualOnlyTool(toolName)) return 'ManualOnly';
  if (isGrowthStudioHumanApprovalTool(toolName)) return 'HumanApprove';
  return classifyOpenClawToolBlastRadiusV1(toolName).minimumTier;
}

function isGrowthStudioHumanApprovalTool(toolName: string): boolean {
  return (GROWTH_STUDIO_HUMAN_APPROVAL_TOOLS as readonly string[]).includes(toolName);
}

function isGrowthStudioManualOnlyTool(toolName: string): boolean {
  return (GROWTH_STUDIO_MANUAL_ONLY_TOOLS as readonly string[]).includes(toolName);
}

function normalizeToolName(toolName: string): string {
  return toolName.trim();
}
