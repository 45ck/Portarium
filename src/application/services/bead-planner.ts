import type { PlanV1, PlannedEffectV1 } from '../../domain/plan/index.js';
import type { BeadProposalV1, ProjectIntentV1 } from '../../domain/beads/index.js';
import { EffectId, PlanId } from '../../domain/primitives/index.js';

const MAX_BEADS_PER_INTENT = 20;
const DEFAULT_SPEC_REF =
  'docs/internal/engineering-layer/build-plan.md#phase-7--intent-trigger-full-loop';

export type BeadPlannerResult = Readonly<{
  plan: PlanV1;
  proposals: readonly BeadProposalV1[];
  artifact: Readonly<{
    schemaVersion: 1;
    artifactId: string;
    title: string;
    markdown: string;
  }>;
}>;

export type BeadPlannerDeps = Readonly<{
  idGenerator: { generateId: () => string };
}>;

export function planBeadsForIntent(
  intent: ProjectIntentV1,
  deps: BeadPlannerDeps,
): BeadPlannerResult {
  const goals = decomposeGoal(intent.normalizedGoal).slice(0, MAX_BEADS_PER_INTENT);
  const proposals = goals.map((goal, index): BeadProposalV1 => {
    const proposalId = `proposal-${deps.idGenerator.generateId()}`;
    const effectId = `effect-${proposalId}`;
    return {
      schemaVersion: 1,
      proposalId,
      title: titleForGoal(goal, index),
      body: buildProposalBody(intent, goal),
      executionTier: index === 0 ? 'HumanApprove' : 'Assisted',
      specRef: DEFAULT_SPEC_REF,
      dependsOnProposalIds: [],
      plannedEffectIds: [effectId],
    };
  });

  const normalizedProposals = proposals.map((proposal, index) => ({
    ...proposal,
    dependsOnProposalIds:
      index === 0 ? [] : [proposals[index - 1]?.proposalId ?? proposals[0]!.proposalId],
  }));

  const plannedEffects: PlannedEffectV1[] = normalizedProposals.map((proposal) => ({
    effectId: EffectId(proposal.plannedEffectIds[0]!),
    operation: 'Create',
    target: {
      sorName: 'Portarium',
      portFamily: 'ProjectsWorkMgmt',
      externalId: proposal.proposalId,
      externalType: 'BeadProposal',
      displayLabel: proposal.title,
    },
    summary: proposal.title,
    idempotencyKey: `${intent.intentId}:${proposal.proposalId}`,
  }));

  const plan: PlanV1 = {
    schemaVersion: 1,
    planId: PlanId(`plan-${intent.intentId}`),
    workspaceId: intent.workspaceId,
    createdAtIso: intent.createdAtIso,
    createdByUserId: intent.createdByUserId,
    plannedEffects,
  };

  return {
    plan,
    proposals: normalizedProposals,
    artifact: {
      schemaVersion: 1,
      artifactId: `plan-artifact-${intent.intentId}`,
      title: `Plan: ${intent.normalizedGoal}`,
      markdown: renderPlanArtifact(intent, normalizedProposals),
    },
  };
}

function decomposeGoal(goal: string): string[] {
  const parts = goal
    .split(/\n+|;|\band then\b|\bthen\b/iu)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [goal];
}

function titleForGoal(goal: string, index: number): string {
  const trimmed = goal.length > 72 ? `${goal.slice(0, 69).trim()}...` : goal;
  return `${index + 1}. ${sentenceCase(trimmed)}`;
}

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildProposalBody(intent: ProjectIntentV1, goal: string): string {
  const constraints =
    intent.constraints.length > 0
      ? `\n\nConstraints:\n${intent.constraints.map((c) => `- ${c}`).join('\n')}`
      : '';
  return `Implement this slice of the operator intent: ${goal}.${constraints}`;
}

function renderPlanArtifact(intent: ProjectIntentV1, proposals: readonly BeadProposalV1[]): string {
  const rows = proposals
    .map((proposal, index) => `${index + 1}. ${proposal.title} [${proposal.executionTier}]`)
    .join('\n');
  const deps = proposals
    .filter((proposal) => proposal.dependsOnProposalIds.length > 0)
    .map((proposal) => `${proposal.dependsOnProposalIds.join(', ')} -> ${proposal.proposalId}`)
    .join('\n');

  return [
    `# Plan: "${intent.normalizedGoal}"`,
    '',
    `Decomposed into ${proposals.length} bead proposal${proposals.length === 1 ? '' : 's'} by BeadPlanner.`,
    '',
    '## Beads',
    '',
    rows,
    '',
    '## Dependencies',
    '',
    deps || 'None',
    '',
    '## Confirmation',
    '',
    'Human approval is required before any worktree is created.',
  ].join('\n');
}
