import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
} from '@portarium/cockpit-types';

export type SignalColor = 'green' | 'yellow' | 'red';

export interface Signal {
  id: string;
  label: string;
  color: SignalColor;
  explanation: string;
}

export function evaluateSodClearance(approval: ApprovalSummary): Signal {
  const sod = approval.sodEvaluation;
  if (!sod || sod.state === 'eligible') {
    return {
      id: 'sod',
      label: 'SoD Clearance',
      color: 'green',
      explanation: 'You are eligible to approve',
    };
  }
  if (sod.state === 'n-of-m') {
    const remaining = (sod.nRequired ?? 0) - (sod.nSoFar ?? 0);
    return {
      id: 'sod',
      label: 'SoD Clearance',
      color: 'yellow',
      explanation: `${sod.nSoFar} of ${sod.nRequired} approvals recorded — ${remaining} more needed`,
    };
  }
  return {
    id: 'sod',
    label: 'SoD Clearance',
    color: 'red',
    explanation:
      sod.state === 'blocked-self' ? 'Cannot approve your own request' : 'Missing required role',
  };
}

export function evaluateBlastRadius(approval: ApprovalSummary, effects: PlanEffect[]): Signal {
  const sorNames = new Set(effects.map((e) => e.target.sorName));
  const sorCount = sorNames.size;
  const recordCount = effects.length;

  if (sorCount <= 1 && recordCount <= 3) {
    return {
      id: 'blast',
      label: 'Blast Radius',
      color: 'green',
      explanation: `${sorCount} SOR, ${recordCount} records`,
    };
  }
  if (sorCount <= 3 && recordCount <= 10) {
    return {
      id: 'blast',
      label: 'Blast Radius',
      color: 'yellow',
      explanation: `${sorCount} SORs, ${recordCount} records`,
    };
  }
  return {
    id: 'blast',
    label: 'Blast Radius',
    color: 'red',
    explanation: `${sorCount} SORs, ${recordCount} records — wide impact`,
  };
}

export function evaluateReversibility(approval: ApprovalSummary): Signal {
  const irr = approval.policyRule?.irreversibility;
  if (!irr || irr === 'none') {
    return {
      id: 'reversibility',
      label: 'Reversibility',
      color: 'green',
      explanation: 'Fully reversible',
    };
  }
  if (irr === 'partial') {
    return {
      id: 'reversibility',
      label: 'Reversibility',
      color: 'yellow',
      explanation: 'Partially reversible',
    };
  }
  return {
    id: 'reversibility',
    label: 'Reversibility',
    color: 'red',
    explanation: 'Irreversible — cannot be undone',
  };
}

export function evaluateDeadline(approval: ApprovalSummary): Signal {
  if (!approval.dueAtIso) {
    return { id: 'deadline', label: 'Deadline', color: 'green', explanation: 'No deadline set' };
  }
  const remaining = new Date(approval.dueAtIso).getTime() - Date.now();
  if (remaining <= 0) {
    return { id: 'deadline', label: 'Deadline', color: 'red', explanation: 'Overdue' };
  }
  const hours = remaining / (1000 * 60 * 60);
  if (hours < 4) {
    return {
      id: 'deadline',
      label: 'Deadline',
      color: 'red',
      explanation: `${Math.ceil(hours)}h remaining`,
    };
  }
  if (hours < 24) {
    return {
      id: 'deadline',
      label: 'Deadline',
      color: 'yellow',
      explanation: `${Math.ceil(hours)}h remaining`,
    };
  }
  const days = Math.ceil(hours / 24);
  return { id: 'deadline', label: 'Deadline', color: 'green', explanation: `${days}d remaining` };
}

export function evaluateHistory(approval: ApprovalSummary): Signal {
  const cycles = (approval.decisionHistory ?? []).filter(
    (h) => h.type === 'changes_requested',
  ).length;
  if (cycles === 0) {
    return { id: 'history', label: 'History', color: 'green', explanation: 'First submission' };
  }
  if (cycles === 1) {
    return {
      id: 'history',
      label: 'History',
      color: 'yellow',
      explanation: '1 prior revision cycle',
    };
  }
  return {
    id: 'history',
    label: 'History',
    color: 'red',
    explanation: `${cycles} revision cycles`,
  };
}

export function evaluateDestructiveness(effects: PlanEffect[]): Signal {
  const deleteCount = effects.filter((e) => e.operation === 'Delete').length;
  if (deleteCount === 0) {
    return {
      id: 'destructiveness',
      label: 'Destructiveness',
      color: 'green',
      explanation: 'No deletions',
    };
  }
  if (deleteCount <= 2) {
    return {
      id: 'destructiveness',
      label: 'Destructiveness',
      color: 'yellow',
      explanation: `${deleteCount} deletion${deleteCount > 1 ? 's' : ''}`,
    };
  }
  return {
    id: 'destructiveness',
    label: 'Destructiveness',
    color: 'red',
    explanation: `${deleteCount} deletions — high impact`,
  };
}

export function evaluateEvidenceChain(evidenceEntries?: EvidenceEntry[]): Signal {
  if (!evidenceEntries || evidenceEntries.length === 0) {
    return {
      id: 'evidence-chain',
      label: 'Evidence Chain',
      color: 'red',
      explanation: 'No evidence collected',
    };
  }

  // Check chain integrity
  const sorted = [...evidenceEntries].sort(
    (a, b) => new Date(a.occurredAtIso).getTime() - new Date(b.occurredAtIso).getTime(),
  );
  const hasBroken = sorted.some((entry, i) => {
    if (i === 0) return false;
    return entry.previousHash !== sorted[i - 1]!.hashSha256;
  });

  if (hasBroken) {
    return {
      id: 'evidence-chain',
      label: 'Evidence Chain',
      color: 'red',
      explanation: 'Chain integrity broken',
    };
  }
  if (evidenceEntries.length < 3) {
    return {
      id: 'evidence-chain',
      label: 'Evidence Chain',
      color: 'yellow',
      explanation: `Thin evidence — only ${evidenceEntries.length} entries`,
    };
  }
  return {
    id: 'evidence-chain',
    label: 'Evidence Chain',
    color: 'green',
    explanation: `${evidenceEntries.length} entries, chain verified`,
  };
}

export function evaluateExecutionTier(run?: RunSummary): Signal {
  if (!run) {
    return {
      id: 'execution-tier',
      label: 'Execution Tier',
      color: 'yellow',
      explanation: 'No run context available',
    };
  }
  const tier = run.executionTier;
  if (tier === 'Auto') {
    return {
      id: 'execution-tier',
      label: 'Execution Tier',
      color: 'green',
      explanation: 'Fully automated — policy escalated to human',
    };
  }
  if (tier === 'Assisted') {
    return {
      id: 'execution-tier',
      label: 'Execution Tier',
      color: 'green',
      explanation: 'Agent-assisted with human oversight',
    };
  }
  if (tier === 'HumanApprove') {
    return {
      id: 'execution-tier',
      label: 'Execution Tier',
      color: 'yellow',
      explanation: 'Requires explicit human approval',
    };
  }
  return {
    id: 'execution-tier',
    label: 'Execution Tier',
    color: 'red',
    explanation: 'Manual-only execution — highest scrutiny',
  };
}

export function evaluateAllSignals(
  approval: ApprovalSummary,
  effects: PlanEffect[],
  evidenceEntries?: EvidenceEntry[],
  run?: RunSummary,
): Signal[] {
  return [
    evaluateSodClearance(approval),
    evaluateBlastRadius(approval, effects),
    evaluateReversibility(approval),
    evaluateDeadline(approval),
    evaluateHistory(approval),
    evaluateDestructiveness(effects),
    evaluateEvidenceChain(evidenceEntries),
    evaluateExecutionTier(run),
  ];
}

export function computeOverallSignal(signals: Signal[]): { label: string; color: SignalColor } {
  const hasRed = signals.some((s) => s.color === 'red');
  const hasYellow = signals.some((s) => s.color === 'yellow');
  if (hasRed) return { label: 'ATTENTION REQUIRED', color: 'red' };
  if (hasYellow) return { label: 'REVIEW RECOMMENDED', color: 'yellow' };
  return { label: 'ALL CLEAR', color: 'green' };
}
