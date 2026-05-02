import type {
  ApprovalPolicyConversionAction,
  ApprovalPolicyConversionDiffEntry,
  ApprovalPolicyConversionFeedbackReason,
  ApprovalPolicyConversionProposal,
  ApprovalPolicyConversionScope,
  ApprovalSummary,
  EvidenceEntry,
  PlanEffect,
  PolicySummary,
  PolicyTier,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';

export const ONE_OFF_CONVERSION_ACTIONS: readonly ApprovalPolicyConversionAction[] = [
  'approve-once',
  'deny-once',
] as const;

export const FUTURE_CASE_CONVERSION_ACTIONS: readonly ApprovalPolicyConversionAction[] = [
  'approve-and-loosen-rule',
  'deny-and-create-rule',
  'require-more-evidence-next-time',
  'escalate-action-class',
] as const;

const TIER_ORDER: readonly PolicyTier[] = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];

const ACTION_LABELS: Record<ApprovalPolicyConversionAction, string> = {
  'approve-once': 'Approve once',
  'approve-and-loosen-rule': 'Approve and loosen rule',
  'deny-once': 'Deny once',
  'deny-and-create-rule': 'Deny and create rule',
  'require-more-evidence-next-time': 'Require more evidence next time',
  'escalate-action-class': 'Escalate this Action class',
};

type BuildApprovalPolicyConversionProposalInput = Readonly<{
  approval: ApprovalSummary;
  plannedEffects?: readonly PlanEffect[];
  evidenceEntries?: readonly EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
  policy?: PolicySummary;
  action: ApprovalPolicyConversionAction;
  scope?: ApprovalPolicyConversionScope;
  rationale?: string;
}>;

export function labelApprovalPolicyConversionAction(
  action: ApprovalPolicyConversionAction,
): string {
  return ACTION_LABELS[action];
}

export function defaultApprovalPolicyConversionScope(
  action: ApprovalPolicyConversionAction,
): ApprovalPolicyConversionScope {
  return ONE_OFF_CONVERSION_ACTIONS.includes(action) ? 'CurrentRunOnly' : 'FutureSimilarCases';
}

function isPolicyTier(value: unknown): value is PolicyTier {
  return (
    value === 'Auto' || value === 'Assisted' || value === 'HumanApprove' || value === 'ManualOnly'
  );
}

function tierAtOffset(tier: PolicyTier, offset: number): PolicyTier {
  const currentIndex = TIER_ORDER.indexOf(tier);
  const nextIndex = Math.min(Math.max(currentIndex + offset, 0), TIER_ORDER.length - 1);
  return TIER_ORDER[nextIndex]!;
}

function currentTier(
  approval: ApprovalSummary,
  run?: RunSummary,
  policy?: PolicySummary,
): PolicyTier {
  if (isPolicyTier(policy?.tier)) return policy.tier;
  if (isPolicyTier(approval.policyRule?.tier)) return approval.policyRule.tier;
  if (isPolicyTier(run?.executionTier)) return run.executionTier;
  if (isPolicyTier(approval.agentActionProposal?.blastRadiusTier)) {
    return approval.agentActionProposal.blastRadiusTier;
  }
  return 'HumanApprove';
}

function inferCapability(
  approval: ApprovalSummary,
  plannedEffects: readonly PlanEffect[],
  workflow?: WorkflowSummary,
): string {
  if (approval.agentActionProposal?.toolName) return approval.agentActionProposal.toolName;
  if (plannedEffects[0]?.target.portFamily) return plannedEffects[0].target.portFamily;
  if (workflow?.actions[0]) {
    return `${workflow.actions[0].portFamily}.${workflow.actions[0].operation}`;
  }
  return approval.policyRule?.trigger || 'workspace.Action';
}

function inferEnvironment(approval: ApprovalSummary, run?: RunSummary): string {
  const source = [
    approval.prompt,
    approval.policyRule?.trigger,
    approval.policyRule?.blastRadius.join(' '),
    run?.workflowId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\b(prod|production)\b/.test(source)) return 'production';
  if (/\bstaging\b/.test(source)) return 'staging';
  if (/\bsandbox\b/.test(source)) return 'sandbox';
  if (/\b(dev|development)\b/.test(source)) return 'development';
  return 'workspace-default';
}

function requiredRoles(approval: ApprovalSummary): string[] {
  const roles = approval.sodEvaluation?.rolesRequired ?? [];
  if (roles.length > 0) return roles;
  return approval.assigneeUserId ? [`approver:${approval.assigneeUserId}`] : ['approver'];
}

function policyIdFor(approval: ApprovalSummary, policy?: PolicySummary): string {
  return policy?.policyId ?? approval.policyRule?.ruleId ?? `policy-from-${approval.approvalId}`;
}

function policyNameFor(approval: ApprovalSummary, policy?: PolicySummary): string {
  return policy?.name ?? approval.policyRule?.trigger ?? 'Runtime precedent policy';
}

function decisionFor(
  action: ApprovalPolicyConversionAction,
): ApprovalPolicyConversionProposal['decision'] {
  if (action === 'deny-once' || action === 'deny-and-create-rule') return 'Denied';
  if (action === 'require-more-evidence-next-time') return 'RequestChanges';
  return 'Approved';
}

function proposedTierFor(action: ApprovalPolicyConversionAction, tier: PolicyTier): PolicyTier {
  if (action === 'approve-and-loosen-rule') return tierAtOffset(tier, -1);
  if (action === 'escalate-action-class') return tierAtOffset(tier, 1);
  if (action === 'deny-and-create-rule') return 'ManualOnly';
  if (action === 'require-more-evidence-next-time') return tierAtOffset(tier, 1);
  return tier;
}

function suggestedDimensionFor(
  action: ApprovalPolicyConversionAction,
): ApprovalPolicyConversionProposal['suggestedDimension'] {
  if (action === 'require-more-evidence-next-time') return 'evidence';
  if (action === 'deny-and-create-rule') return 'capability';
  if (action === 'escalate-action-class' || action === 'approve-and-loosen-rule') return 'tier';
  return 'environment';
}

function ruleTextFor(input: {
  capability: string;
  environment: string;
  requiredEvidenceCount: number;
  roles: readonly string[];
  proposedTier: PolicyTier;
  policyBlocked: boolean;
  action: ApprovalPolicyConversionAction;
}): string {
  const conditions = [`capability = "${input.capability}"`, `environment = "${input.environment}"`];
  if (input.action === 'require-more-evidence-next-time') {
    conditions.push(`evidence.count >= ${input.requiredEvidenceCount}`);
  }
  if (input.roles.length > 0) {
    conditions.push(`approver.role in [${input.roles.map((role) => `"${role}"`).join(', ')}]`);
  }
  const effect = input.policyBlocked ? 'DENY' : `ROUTE ${input.proposedTier}`;
  return `WHEN ${conditions.join(' AND ')} THEN ${effect}`;
}

function diffFor(input: {
  action: ApprovalPolicyConversionAction;
  currentTier: PolicyTier;
  proposedTier: PolicyTier;
  policyBlocked: boolean;
  requiredEvidenceCount: number;
  evidenceCount: number;
  rationale: string;
}): ApprovalPolicyConversionDiffEntry[] {
  if (input.action === 'approve-once' || input.action === 'deny-once') {
    return [
      {
        field: 'runEffect',
        fromValue: 'Policy unchanged',
        toValue: 'Current Run decision only',
        rationale: input.rationale,
      },
    ];
  }

  const diff: ApprovalPolicyConversionDiffEntry[] = [
    {
      field: 'tier',
      fromValue: input.currentTier,
      toValue: input.policyBlocked ? 'Denied' : input.proposedTier,
      rationale: input.rationale,
    },
  ];

  if (input.action === 'require-more-evidence-next-time') {
    diff.push({
      field: 'evidence.count',
      fromValue: String(input.evidenceCount),
      toValue: String(input.requiredEvidenceCount),
      rationale: input.rationale,
    });
  }

  return diff;
}

function feedbackReasonsFor(input: {
  scope: ApprovalPolicyConversionScope;
  suggestedDimension: ApprovalPolicyConversionProposal['suggestedDimension'];
  currentTier: PolicyTier;
  proposedTier: PolicyTier;
  policyBlocked: boolean;
  evidenceCount: number;
  requiredEvidenceCount: number;
  roles: readonly string[];
}): ApprovalPolicyConversionFeedbackReason[] {
  const reasons: ApprovalPolicyConversionFeedbackReason[] = [
    {
      code:
        input.scope === 'CurrentRunOnly'
          ? 'runtime-decision.current-run-only'
          : 'runtime-decision.future-similar-cases',
      label:
        input.scope === 'CurrentRunOnly'
          ? 'Decision applies only to this Run'
          : 'Decision should affect future similar cases',
      dimension: input.scope === 'CurrentRunOnly' ? 'environment' : input.suggestedDimension,
    },
  ];

  if (input.policyBlocked) {
    reasons.push({
      code: 'policy.block-matching-actions',
      label: 'Matching future Actions should be policy-blocked',
      dimension: 'capability',
    });
  } else if (input.currentTier !== input.proposedTier) {
    reasons.push({
      code: 'policy.tier-change',
      label: `${input.currentTier} to ${input.proposedTier}`,
      dimension: 'tier',
    });
  }

  if (input.requiredEvidenceCount > input.evidenceCount) {
    reasons.push({
      code: 'evidence.minimum-count',
      label: `Require ${input.requiredEvidenceCount} evidence entries`,
      dimension: 'evidence',
    });
  }

  if (input.roles.length > 0) {
    reasons.push({
      code: 'role.approver-constraint',
      label: `Approver role: ${input.roles.join(', ')}`,
      dimension: 'role',
    });
  }

  return reasons;
}

export function buildApprovalPolicyConversionProposal(
  input: BuildApprovalPolicyConversionProposalInput,
): ApprovalPolicyConversionProposal {
  const plannedEffects = input.plannedEffects ?? [];
  const evidenceEntries = input.evidenceEntries ?? [];
  const scope = input.scope ?? defaultApprovalPolicyConversionScope(input.action);
  const tier = currentTier(input.approval, input.run, input.policy);
  const proposedTier = proposedTierFor(input.action, tier);
  const policyBlocked = input.action === 'deny-and-create-rule';
  const capability = inferCapability(input.approval, plannedEffects, input.workflow);
  const environment = inferEnvironment(input.approval, input.run);
  const roles = requiredRoles(input.approval);
  const suggestedDimension = suggestedDimensionFor(input.action);
  const requiredEvidenceCount =
    input.action === 'require-more-evidence-next-time'
      ? Math.max(2, evidenceEntries.length + 1)
      : evidenceEntries.length;
  const rationale =
    input.rationale?.trim() ||
    input.approval.rationale?.trim() ||
    input.approval.agentActionProposal?.rationale.trim() ||
    `Runtime decision from ${input.approval.approvalId}.`;
  const ruleText = ruleTextFor({
    capability,
    environment,
    requiredEvidenceCount,
    roles,
    proposedTier,
    policyBlocked,
    action: input.action,
  });
  const policyId = policyIdFor(input.approval, input.policy);
  const replaySubjectIds = [
    input.approval.approvalId,
    input.approval.runId,
    ...(input.workflow?.workflowId ? [input.workflow.workflowId] : []),
  ];

  return {
    schemaVersion: 1,
    action: input.action,
    scope,
    decision: decisionFor(input.action),
    policyMutation: scope === 'FutureSimilarCases',
    policyId,
    policyName: policyNameFor(input.approval, input.policy),
    suggestedDimension,
    capability,
    environment,
    requiredEvidenceCount,
    requiredRoles: roles,
    currentTier: tier,
    proposedTier,
    policyBlocked,
    ruleText,
    rationale,
    feedbackReasons: feedbackReasonsFor({
      scope,
      suggestedDimension,
      currentTier: tier,
      proposedTier,
      policyBlocked,
      evidenceCount: evidenceEntries.length,
      requiredEvidenceCount,
      roles,
    }),
    diff: diffFor({
      action: input.action,
      currentTier: tier,
      proposedTier,
      policyBlocked,
      requiredEvidenceCount,
      evidenceCount: evidenceEntries.length,
      rationale,
    }),
    auditLink: {
      source: 'runtime-precedent',
      approvalId: input.approval.approvalId,
      runId: input.approval.runId,
      planId: input.approval.planId,
      ...(input.approval.workItemId ? { workItemId: input.approval.workItemId } : {}),
      evidenceIds: evidenceEntries.map((entry) => entry.evidenceId),
    },
    simulation: {
      policyId,
      triggerAction: capability,
      triggerCondition: `environment = "${environment}"`,
      tier: proposedTier,
      policyBlocked,
      replaySubjectIds,
    },
  };
}
