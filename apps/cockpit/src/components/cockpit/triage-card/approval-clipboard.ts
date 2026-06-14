import type {
  ApprovalSummary,
  EvidenceEntry,
  PlanEffect,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { getAgentActionCategoryPresentation } from '@/lib/agent-action-category';

export interface BuildApprovalClipboardTextInput {
  approval: ApprovalSummary;
  plannedEffects: PlanEffect[];
  evidenceEntries: EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
}

function optionalValue(value: string | undefined): string {
  return value && value.trim().length > 0 ? value : 'Not set';
}

function formatTarget(effect: PlanEffect): string {
  const display = effect.target.displayLabel ?? effect.target.externalId;
  return `${effect.target.sorName} ${effect.target.externalType} ${display}`;
}

export function buildApprovalClipboardText({
  approval,
  plannedEffects,
  evidenceEntries,
  run,
  workflow,
}: BuildApprovalClipboardTextInput): string {
  const lines = [
    'Approval Gate',
    `Approval ID: ${approval.approvalId}`,
    `Status: ${approval.status}`,
    `Prompt: ${approval.prompt}`,
    `Requested by: ${approval.requestedByUserId}`,
    `Assignee: ${optionalValue(approval.assigneeUserId)}`,
    `Requested at: ${approval.requestedAtIso}`,
    `Due at: ${optionalValue(approval.dueAtIso)}`,
    `Run ID: ${approval.runId}`,
    `Plan ID: ${approval.planId}`,
    `Work Item ID: ${optionalValue(approval.workItemId)}`,
  ];

  if (run) {
    lines.push(
      '',
      'Run',
      `Workflow ID: ${run.workflowId}`,
      `Execution tier: ${run.executionTier}`,
      `Run status: ${run.status}`,
      `Initiated by: ${run.initiatedByUserId}`,
      `Agents: ${run.agentIds && run.agentIds.length > 0 ? run.agentIds.join(', ') : 'None'}`,
    );
  }

  if (workflow) {
    lines.push('', 'Workflow', `Name: ${workflow.name}`, `Version: ${workflow.version}`);
  }

  if (approval.policyRule) {
    lines.push(
      '',
      'Policy Rule',
      `Rule ID: ${approval.policyRule.ruleId}`,
      `Trigger: ${approval.policyRule.trigger}`,
      `Tier: ${approval.policyRule.tier}`,
      `Blast radius: ${approval.policyRule.blastRadius.join(', ') || 'Not declared'}`,
      `Irreversibility: ${approval.policyRule.irreversibility}`,
    );
  }

  if (approval.agentActionProposal) {
    const proposal = approval.agentActionProposal;
    const category = getAgentActionCategoryPresentation(proposal.toolCategory);
    lines.push(
      '',
      'Agent Action Proposal',
      `Proposal ID: ${proposal.proposalId}`,
      `Agent ID: ${proposal.agentId}`,
      `Machine ID: ${optionalValue(proposal.machineId)}`,
      `Tool: ${proposal.toolName}`,
      `Category: ${category.label}`,
      `Blast-radius tier: ${proposal.blastRadiusTier}`,
      `Rationale: ${proposal.rationale}`,
    );
  }

  if (plannedEffects.length > 0) {
    lines.push('', 'Planned Effects');
    plannedEffects.forEach((effect, index) => {
      lines.push(
        `${index + 1}. ${effect.operation}: ${effect.summary}`,
        `   Target: ${formatTarget(effect)}`,
      );
    });
  }

  lines.push('', `Evidence linked: ${evidenceEntries.length}`);
  if (evidenceEntries.length > 0) {
    evidenceEntries.slice(0, 5).forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry.summary} (${entry.evidenceId})`);
    });
    if (evidenceEntries.length > 5) {
      lines.push(`... ${evidenceEntries.length - 5} more evidence entries`);
    }
  }

  return lines.join('\n');
}
