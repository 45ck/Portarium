import type { PolicySummary } from '@portarium/cockpit-types';
import type { ExecutionTier } from '@/components/cockpit/policy-live-preview';
import type { PolicyV1, ProposePolicyChangeRequest } from '@/lib/control-plane-client';

export type PolicyControllerDecision = 'allow' | 'sandbox' | 'approval' | 'deny';
export type PolicyControllerToolRiskCategory = 'ReadOnly' | 'Mutation' | 'Dangerous' | 'Unknown';

export type PolicyControllerActionClass = Readonly<{
  id: string;
  label: string;
  defaultDecision: PolicyControllerDecision;
}>;

export type PolicyControllerToolRoute = Readonly<{
  id: string;
  label: string;
  toolName: string;
  provider: string;
  actionClass: string;
  currentDecision: PolicyControllerDecision;
  decision: PolicyControllerDecision;
  description?: string;
  riskCategory?: PolicyControllerToolRiskCategory;
  minimumExecutionTier?: ExecutionTier;
  source?: 'catalog' | 'runtime-seed' | 'custom' | string;
  custom?: boolean;
}>;

export type PolicyControllerDraftInput = Readonly<{
  workspaceId: string;
  selectedPolicy: PolicySummary;
  currentTier: ExecutionTier;
  routes: Readonly<Record<string, PolicyControllerDecision>>;
  toolRoutes?: readonly PolicyControllerToolRoute[];
  actionClasses: readonly PolicyControllerActionClass[];
  strictEvidence: boolean;
  dryRunExecutors: boolean;
  rationale: string;
  now?: Date;
}>;

export type PolicyControllerDraftPacket = Readonly<{
  profile: string;
  routes: readonly Readonly<{
    actionClass: string;
    label: string;
    decision: PolicyControllerDecision;
    policyDecision: string;
    executionTier: ExecutionTier;
  }>[];
  toolRoutes?: readonly Readonly<{
    toolId: string;
    label: string;
    toolName: string;
    provider: string;
    actionClass: string;
    riskCategory?: PolicyControllerToolRiskCategory;
    minimumExecutionTier?: ExecutionTier;
    currentDecision: PolicyControllerDecision;
    decision: PolicyControllerDecision;
    policyDecision: string;
    executionTier: ExecutionTier;
    source?: string;
    custom: boolean;
  }>[];
  settings: Readonly<{
    strictEvidence: boolean;
    dryRunExecutors: boolean;
  }>;
}>;

const DECISION_POLICY: Record<PolicyControllerDecision, string> = {
  allow: 'allow',
  sandbox: 'allow_sandbox_only',
  approval: 'require_approval',
  deny: 'deny',
};

const DECISION_TIER: Record<PolicyControllerDecision, ExecutionTier> = {
  allow: 'Auto',
  sandbox: 'Assisted',
  approval: 'HumanApprove',
  deny: 'ManualOnly',
};

export function buildPolicyControllerDraftPacket(
  input: Pick<
    PolicyControllerDraftInput,
    'actionClasses' | 'routes' | 'toolRoutes' | 'strictEvidence' | 'dryRunExecutors'
  >,
): PolicyControllerDraftPacket {
  const routes = input.actionClasses.map((action) => {
    const decision = input.routes[action.id] ?? action.defaultDecision;
    return {
      actionClass: action.id,
      label: action.label,
      decision,
      policyDecision: DECISION_POLICY[decision],
      executionTier: DECISION_TIER[decision],
    };
  });

  return {
    profile: 'cockpit-policy-controller-v1',
    routes,
    ...(input.toolRoutes && input.toolRoutes.length > 0
      ? {
          toolRoutes: input.toolRoutes.map((tool) => ({
            toolId: tool.id,
            label: tool.label,
            toolName: tool.toolName,
            provider: tool.provider,
            actionClass: tool.actionClass,
            ...(tool.riskCategory ? { riskCategory: tool.riskCategory } : {}),
            ...(tool.minimumExecutionTier
              ? { minimumExecutionTier: tool.minimumExecutionTier }
              : {}),
            currentDecision: tool.currentDecision,
            decision: tool.decision,
            policyDecision: DECISION_POLICY[tool.decision],
            executionTier: DECISION_TIER[tool.decision],
            ...(tool.source ? { source: tool.source } : {}),
            custom: tool.custom === true,
          })),
        }
      : {}),
    settings: {
      strictEvidence: input.strictEvidence,
      dryRunExecutors: input.dryRunExecutors,
    },
  };
}

export function buildPolicyControllerProposal(
  input: PolicyControllerDraftInput,
): ProposePolicyChangeRequest {
  const packet = buildPolicyControllerDraftPacket(input);
  const now = input.now ?? new Date();
  const effectiveFromIso = new Date(now.getTime() + 60_000).toISOString();
  const proposedPolicy = buildProposedPolicy(input, packet, now.toISOString());
  const highRisk = requiresHighRiskPolicyApproval(packet);

  return {
    policyId: input.selectedPolicy.policyId,
    operation: 'Update',
    risk: highRisk ? 'High' : 'Standard',
    scope: { targetKind: 'Workspace', workspaceId: input.workspaceId },
    proposedPolicy,
    rationale: input.rationale.trim() || 'Cockpit Policy Controller tool routing update.',
    diff: [
      {
        path: '/cockpitPolicyController',
        before: {
          policyId: input.selectedPolicy.policyId,
          name: input.selectedPolicy.name,
          ruleText: input.selectedPolicy.ruleText,
          currentTier: input.currentTier,
        },
        after: packet,
      },
    ],
    runEffect: 'FutureRunsOnly',
    effectiveFromIso,
    approvalRequired: highRisk,
    replayReportRequired: false,
  };
}

function requiresHighRiskPolicyApproval(packet: PolicyControllerDraftPacket): boolean {
  const routeRequiresApproval = (actionClass: string, decision: PolicyControllerDecision) => {
    if (actionClass === 'external-executor') return decision !== 'deny';
    if (actionClass === 'browser-query') return decision === 'allow';
    return false;
  };
  const toolRiskRequiresApproval = (
    riskCategory: PolicyControllerToolRiskCategory | undefined,
    minimumExecutionTier: ExecutionTier | undefined,
    decision: PolicyControllerDecision,
  ) => {
    if (riskCategory === 'Dangerous') return decision !== 'deny';
    if (minimumExecutionTier === 'ManualOnly') return decision !== 'deny';
    if (riskCategory === 'Mutation') return decision === 'allow' || decision === 'sandbox';
    if (minimumExecutionTier === 'HumanApprove') {
      return decision === 'allow' || decision === 'sandbox';
    }
    return false;
  };

  return (
    packet.routes.some((route) => routeRequiresApproval(route.actionClass, route.decision)) ||
    (packet.toolRoutes ?? []).some(
      (tool) =>
        routeRequiresApproval(tool.actionClass, tool.decision) ||
        toolRiskRequiresApproval(tool.riskCategory, tool.minimumExecutionTier, tool.decision),
    )
  );
}

function buildProposedPolicy(
  input: PolicyControllerDraftInput,
  packet: PolicyControllerDraftPacket,
  createdAtIso: string,
): PolicyV1 {
  return {
    schemaVersion: 1,
    policyId: input.selectedPolicy.policyId,
    workspaceId: input.workspaceId,
    name: input.selectedPolicy.name,
    description: input.selectedPolicy.description || 'Cockpit Policy Controller tool routing.',
    active: input.selectedPolicy.status !== 'Archived',
    priority: 1,
    version: 2,
    createdAtIso,
    createdByUserId: 'cockpit-policy-controller',
    rules: [
      ...packet.routes.map((route) => ({
        ruleId: `controller-${route.actionClass}`,
        condition: [
          `controller.profile == "${packet.profile}"`,
          `controller.actionClass == "${route.actionClass}"`,
          `controller.decision == "${route.policyDecision}"`,
        ].join(' AND '),
        effect: policyEffect(route.decision),
      })),
      ...(packet.toolRoutes ?? []).map((tool) => ({
        ruleId: `controller-tool-${slugForRuleId(tool.toolName)}`,
        condition: [
          `controller.profile == "${packet.profile}"`,
          `tool.name == "${tool.toolName}"`,
          `controller.decision == "${tool.policyDecision}"`,
        ].join(' AND '),
        effect: policyEffect(tool.decision),
      })),
    ],
  };
}

function policyEffect(decision: PolicyControllerDecision): 'Allow' | 'Deny' {
  return decision === 'deny' ? 'Deny' : 'Allow';
}

function slugForRuleId(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'custom-tool';
}
