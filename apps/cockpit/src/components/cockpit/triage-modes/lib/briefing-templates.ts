import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { hasChainBreak } from './chain-verification';

export interface BriefingSection {
  id: string;
  label: string;
  dotColor: string;
  content: string;
}

function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural ?? singular + 's'}`;
}

function buildWhoWhy(
  approval: ApprovalSummary,
  run?: RunSummary,
  workflow?: WorkflowSummary,
): string {
  const parts: string[] = [];

  if (workflow) {
    const triggerLabel: Record<string, string> = {
      Manual: 'manually triggered',
      Cron: 'triggered on schedule (cron)',
      Webhook: 'triggered via webhook',
      DomainEvent: 'triggered by a domain event',
    };
    parts.push(
      `The "${workflow.name}" workflow (v${workflow.version}) was ${triggerLabel[workflow.triggerKind ?? ''] ?? 'triggered'}`,
    );
    if (run) {
      parts.push(` by ${run.initiatedByUserId}`);
    }
    parts.push('. ');
  }

  if (run) {
    parts.push(
      `Run ${run.runId} is currently ${run.status
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase()}`,
    );
    const agentCount = run.agentIds?.length ?? 0;
    const robotCount = run.robotIds?.length ?? 0;
    if (agentCount > 0 || robotCount > 0) {
      const participants: string[] = [];
      if (agentCount > 0)
        participants.push(`${pluralize(agentCount, 'agent')} (${run.agentIds!.join(', ')})`);
      if (robotCount > 0)
        participants.push(`${pluralize(robotCount, 'robot')} (${run.robotIds!.join(', ')})`);
      parts.push(`, with ${participants.join(' and ')} participating`);
    }
    parts.push('. ');
  } else {
    parts.push(`This approval gate was triggered for run ${approval.runId}. `);
  }

  if (approval.workItemId) {
    parts.push(`Linked to work item ${approval.workItemId}. `);
  }

  parts.push(`Requested by ${approval.requestedByUserId}`);
  if (approval.assigneeUserId) {
    parts.push(`, assigned to ${approval.assigneeUserId}`);
  }

  if (run?.executionTier) {
    const tierLabel: Record<string, string> = {
      Auto: 'fully automated',
      Assisted: 'agent-assisted with human oversight',
      HumanApprove: 'requires explicit human approval',
      ManualOnly: 'manual-only execution',
    };
    parts.push(`. Execution tier: ${tierLabel[run.executionTier] ?? run.executionTier}`);
  }

  parts.push('.');
  return parts.join('');
}

function buildWhat(effects: PlanEffect[], workflow?: WorkflowSummary): string {
  if (effects.length === 0) return 'No planned effects are associated with this approval.';

  const bySor = new Map<string, PlanEffect[]>();
  for (const e of effects) {
    const list = bySor.get(e.target.sorName) ?? [];
    list.push(e);
    bySor.set(e.target.sorName, list);
  }

  const sorParts = Array.from(bySor.entries()).map(([sorName, sorEffects]) => {
    const ops = new Map<string, number>();
    for (const e of sorEffects) {
      ops.set(e.operation, (ops.get(e.operation) ?? 0) + 1);
    }
    const opStr = Array.from(ops.entries())
      .map(([op, count]) => `${count} ${op.toLowerCase()}`)
      .join(', ');

    // Try to match to workflow actions
    const matchedAction = workflow?.actions.find((a) =>
      sorEffects.some((e) => e.target.portFamily === a.portFamily),
    );
    const stepNote = matchedAction ? ` (workflow step ${matchedAction.order})` : '';

    return `${sorName}: ${opStr}${stepNote}`;
  });

  return `If approved, this will affect ${pluralize(bySor.size, 'system')}: ${sorParts.join('; ')}. Total of ${pluralize(effects.length, 'record')} affected.`;
}

function buildRisk(
  approval: ApprovalSummary,
  effects: PlanEffect[],
  evidenceEntries?: EvidenceEntry[],
): string {
  const points: string[] = [];
  let riskFactors = 0;

  const irr = approval.policyRule?.irreversibility;
  if (irr === 'full') {
    points.push('Fully irreversible — cannot be undone');
    riskFactors += 2;
  } else if (irr === 'partial') {
    points.push('Partially reversible');
    riskFactors += 1;
  } else points.push('Reversible');

  const sorNames = new Set(effects.map((e) => e.target.sorName));
  if (sorNames.size > 3) {
    points.push(`Wide blast radius: ${sorNames.size} SORs`);
    riskFactors += 1;
  }

  const sod = approval.sodEvaluation;
  if (sod) {
    if (sod.state === 'blocked-self') {
      points.push('SoD blocked: cannot approve own request');
      riskFactors += 2;
    } else if (sod.state === 'blocked-role') {
      points.push('SoD blocked: missing required role');
      riskFactors += 2;
    } else if (sod.state === 'n-of-m') {
      points.push(`Multi-approval: ${sod.nSoFar} of ${sod.nRequired} recorded`);
      riskFactors += 1;
    } else points.push('SoD clearance: eligible');
  }

  // Evidence chain health
  if (evidenceEntries && evidenceEntries.length > 0) {
    if (hasChainBreak(evidenceEntries)) {
      points.push('Evidence chain integrity broken');
      riskFactors += 2;
    }
  } else {
    points.push('No evidence collected');
    riskFactors += 1;
  }

  if (approval.dueAtIso) {
    const remaining = new Date(approval.dueAtIso).getTime() - Date.now();
    if (remaining <= 0) {
      points.push('OVERDUE');
      riskFactors += 1;
    } else {
      const hours = Math.ceil(remaining / (1000 * 60 * 60));
      points.push(
        hours > 24 ? `${Math.ceil(hours / 24)}d until deadline` : `${hours}h until deadline`,
      );
    }
  }

  const deleteCount = effects.filter((e) => e.operation === 'Delete').length;
  if (deleteCount > 0) {
    points.push(`${pluralize(deleteCount, 'destructive operation')}`);
    riskFactors += 1;
  }

  const cycles = (approval.decisionHistory ?? []).filter(
    (h) => h.type === 'changes_requested',
  ).length;
  if (cycles > 0) {
    points.push(`${pluralize(cycles, 'prior rejection cycle')}`);
    riskFactors += 1;
  }

  const level =
    riskFactors >= 4 ? 'Critical' : riskFactors >= 2 ? 'High' : riskFactors >= 1 ? 'Medium' : 'Low';
  return `Risk level: ${level}. ${points.join('. ')}.`;
}

function buildEvidence(evidenceEntries?: EvidenceEntry[]): string {
  if (!evidenceEntries || evidenceEntries.length === 0) {
    return 'No evidence has been collected for this approval. Evidence entries are recorded as actions occur — approvals, artifact uploads, and system checks will appear as a tamper-proof chain.';
  }

  const actorSet = new Set(
    evidenceEntries.map((e) => {
      switch (e.actor.kind) {
        case 'User':
          return e.actor.userId;
        case 'Machine':
          return e.actor.machineId;
        case 'Adapter':
          return e.actor.adapterId;
        case 'System':
          return 'System';
      }
    }),
  );

  const categories = new Set(evidenceEntries.map((e) => e.category));
  const attachmentCount = evidenceEntries.reduce((sum, e) => sum + (e.payloadRefs?.length ?? 0), 0);

  const chainLabel = hasChainBreak(evidenceEntries) ? 'chain broken' : 'chain verified';

  const parts = [
    `${pluralize(evidenceEntries.length, 'entry', 'entries')} from ${pluralize(actorSet.size, 'actor')}`,
    chainLabel,
    `${categories.size}/5 categories covered`,
  ];
  if (attachmentCount > 0) {
    parts.push(`${pluralize(attachmentCount, 'attachment')}`);
  }

  return parts.join(', ') + '.';
}

function buildTimeline(approval: ApprovalSummary, run?: RunSummary): string {
  const parts: string[] = [];

  const requestedAt = new Date(approval.requestedAtIso);
  const now = new Date();
  const ageMs = now.getTime() - requestedAt.getTime();
  const ageHours = Math.round(ageMs / (1000 * 60 * 60));

  if (ageHours < 1) {
    parts.push('Requested less than an hour ago');
  } else if (ageHours < 24) {
    parts.push(`Requested ${ageHours}h ago`);
  } else {
    parts.push(`Requested ${Math.round(ageHours / 24)}d ago`);
  }

  if (run?.startedAtIso) {
    const runAge = now.getTime() - new Date(run.startedAtIso).getTime();
    const runHours = Math.round(runAge / (1000 * 60 * 60));
    if (runHours < 1) {
      parts.push('run started less than an hour ago');
    } else if (runHours < 24) {
      parts.push(`run started ${runHours}h ago`);
    } else {
      parts.push(`run started ${Math.round(runHours / 24)}d ago`);
    }
  }

  if (approval.dueAtIso) {
    const due = new Date(approval.dueAtIso);
    const remaining = due.getTime() - now.getTime();
    if (remaining <= 0) {
      const overdueHours = Math.round(Math.abs(remaining) / (1000 * 60 * 60));
      parts.push(
        `OVERDUE by ${overdueHours < 24 ? `${overdueHours}h` : `${Math.round(overdueHours / 24)}d`}`,
      );
    } else {
      const hours = Math.round(remaining / (1000 * 60 * 60));
      parts.push(hours < 24 ? `deadline in ${hours}h` : `deadline in ${Math.round(hours / 24)}d`);
    }
  }

  const rejections = (approval.decisionHistory ?? []).filter((h) => h.type === 'changes_requested');
  if (rejections.length > 0) {
    const lastRejection = rejections[rejections.length - 1]!;
    const rejMs = now.getTime() - new Date(lastRejection.timestamp).getTime();
    const rejHours = Math.round(rejMs / (1000 * 60 * 60));
    parts.push(
      `last rejection ${rejHours < 24 ? `${rejHours}h` : `${Math.round(rejHours / 24)}d`} ago`,
    );
  }

  return parts.join(', ') + '.';
}

function buildRecommendation(
  approval: ApprovalSummary,
  effects: PlanEffect[],
  evidenceEntries?: EvidenceEntry[],
  run?: RunSummary,
): string {
  const irr = approval.policyRule?.irreversibility;
  const sod = approval.sodEvaluation;
  const deleteCount = effects.filter((e) => e.operation === 'Delete').length;
  const cycles = (approval.decisionHistory ?? []).filter(
    (h) => h.type === 'changes_requested',
  ).length;
  const isOverdue = Boolean(approval.dueAtIso && new Date(approval.dueAtIso) < new Date());
  const isBlocked = sod && (sod.state === 'blocked-self' || sod.state === 'blocked-role');

  if (isBlocked)
    return 'Cannot approve — SoD policy blocks this action. Escalate to an eligible approver.';

  const evidenceOk = evidenceEntries && evidenceEntries.length >= 3;
  const sodClear = !sod || sod.state === 'eligible';

  const lowRisk =
    (irr === 'none' || !irr) &&
    effects.length <= 3 &&
    deleteCount === 0 &&
    cycles === 0 &&
    !isOverdue &&
    evidenceOk &&
    sodClear;

  if (lowRisk)
    return 'Low risk: reversible, narrow blast radius, evidence chain verified, SoD clear, no prior rejections — recommend approve.';

  const concerns: string[] = [];
  if (irr === 'full') concerns.push('irreversible');
  if (deleteCount > 2) concerns.push(`${deleteCount} destructive operations`);
  if (cycles >= 2) concerns.push(`${cycles} revision cycles`);
  if (isOverdue) concerns.push('overdue');
  if (!evidenceOk) concerns.push('thin evidence');
  if (!sodClear && sod?.state === 'n-of-m') concerns.push('pending multi-approval');
  if (run?.executionTier === 'ManualOnly') concerns.push('manual-only tier');

  if (concerns.length === 0) return 'Standard review recommended before approval.';
  return `Elevated scrutiny recommended: ${concerns.join(', ')}. Review all evidence before deciding.`;
}

export function generateBriefing(
  approval: ApprovalSummary,
  effects: PlanEffect[],
  evidenceEntries?: EvidenceEntry[],
  run?: RunSummary,
  workflow?: WorkflowSummary,
): BriefingSection[] {
  return [
    {
      id: 'who-why',
      label: 'WHO & WHY',
      dotColor: 'bg-blue-500',
      content: buildWhoWhy(approval, run, workflow),
    },
    {
      id: 'what',
      label: 'WHAT WILL HAPPEN',
      dotColor: 'bg-orange-500',
      content: buildWhat(effects, workflow),
    },
    {
      id: 'risk',
      label: 'RISK ASSESSMENT',
      dotColor: 'bg-red-500',
      content: buildRisk(approval, effects, evidenceEntries),
    },
    {
      id: 'evidence',
      label: 'EVIDENCE STATUS',
      dotColor: 'bg-violet-500',
      content: buildEvidence(evidenceEntries),
    },
    {
      id: 'timeline',
      label: 'TIMELINE',
      dotColor: 'bg-sky-500',
      content: buildTimeline(approval, run),
    },
    {
      id: 'recommendation',
      label: 'RECOMMENDATION',
      dotColor: 'bg-emerald-500',
      content: buildRecommendation(approval, effects, evidenceEntries, run),
    },
  ];
}
