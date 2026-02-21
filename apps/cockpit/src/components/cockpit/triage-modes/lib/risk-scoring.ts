import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
} from '@portarium/cockpit-types';

export interface RiskAxes {
  blastRadius: number;
  recordVolume: number;
  destructiveness: number;
  irreversibility: number;
  urgency: number;
  evidenceHealth: number;
  executionTier: number;
  sodStatus: number;
}

export interface RiskScore {
  axes: RiskAxes;
  composite: number;
  label: 'Low' | 'Medium' | 'High' | 'Critical';
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function scoreBlastRadius(approval: ApprovalSummary, effects: PlanEffect[]): number {
  const sorNames = new Set(effects.map((e) => e.target.sorName));
  const policyRadius = approval.policyRule?.blastRadius ?? [];
  const sorCount = Math.max(
    sorNames.size,
    policyRadius.filter((b) => !b.includes('record')).length,
  );
  return clamp(sorCount * 25, 0, 100);
}

function scoreRecordVolume(effects: PlanEffect[]): number {
  const count = effects.length;
  if (count === 0) return 0;
  if (count <= 2) return 15;
  if (count <= 5) return 35;
  if (count <= 10) return 60;
  if (count <= 20) return 80;
  return 100;
}

function scoreDestructiveness(effects: PlanEffect[]): number {
  const weights: Record<string, number> = { Delete: 4, Upsert: 2, Update: 1, Create: 0.5 };
  const total = effects.reduce((sum, e) => sum + (weights[e.operation] ?? 0), 0);
  return clamp(total * 8, 0, 100);
}

function scoreIrreversibility(approval: ApprovalSummary): number {
  const irr = approval.policyRule?.irreversibility;
  if (irr === 'full') return 100;
  if (irr === 'partial') return 50;
  return 10;
}

function scoreUrgency(approval: ApprovalSummary): number {
  if (!approval.dueAtIso) return 10;
  const remaining = new Date(approval.dueAtIso).getTime() - Date.now();
  if (remaining <= 0) return 100;
  const hours = remaining / (1000 * 60 * 60);
  if (hours < 4) return 85;
  if (hours < 24) return 55;
  if (hours < 72) return 30;
  return 10;
}

function scoreEvidenceHealth(entries?: EvidenceEntry[]): number {
  if (!entries || entries.length === 0) return 90;
  const sorted = [...entries].sort(
    (a, b) => new Date(a.occurredAtIso).getTime() - new Date(b.occurredAtIso).getTime(),
  );
  const hasBroken = sorted.some((entry, i) => {
    if (i === 0) return false;
    return entry.previousHash !== sorted[i - 1]!.hashSha256;
  });
  if (hasBroken) return 100;
  if (entries.length < 3) return 50;
  return 10;
}

function scoreExecutionTier(run?: RunSummary): number {
  if (!run) return 50;
  const tier = run.executionTier;
  if (tier === 'Auto') return 15;
  if (tier === 'Assisted') return 30;
  if (tier === 'HumanApprove') return 55;
  return 80;
}

function scoreSodStatus(approval: ApprovalSummary): number {
  const sod = approval.sodEvaluation;
  if (!sod || sod.state === 'eligible') return 10;
  if (sod.state === 'n-of-m') {
    const remaining = (sod.nRequired ?? 0) - (sod.nSoFar ?? 0);
    return clamp(25 * remaining, 0, 100);
  }
  return 100;
}

export function computeRiskScore(
  approval: ApprovalSummary,
  effects: PlanEffect[],
  evidenceEntries?: EvidenceEntry[],
  run?: RunSummary,
): RiskScore {
  const axes: RiskAxes = {
    blastRadius: scoreBlastRadius(approval, effects),
    recordVolume: scoreRecordVolume(effects),
    destructiveness: scoreDestructiveness(effects),
    irreversibility: scoreIrreversibility(approval),
    urgency: scoreUrgency(approval),
    evidenceHealth: scoreEvidenceHealth(evidenceEntries),
    executionTier: scoreExecutionTier(run),
    sodStatus: scoreSodStatus(approval),
  };

  const axisValues = Object.values(axes) as number[];
  const composite = Math.round(axisValues.reduce((a, b) => a + b, 0) / axisValues.length);

  const label: RiskScore['label'] =
    composite >= 75 ? 'Critical' : composite >= 50 ? 'High' : composite >= 25 ? 'Medium' : 'Low';

  return { axes, composite, label };
}

export const RISK_AXIS_LABELS: Record<keyof RiskAxes, string> = {
  blastRadius: 'Blast',
  recordVolume: 'Volume',
  destructiveness: 'Destruct.',
  irreversibility: 'Irrevers.',
  urgency: 'Urgency',
  evidenceHealth: 'Evidence',
  executionTier: 'Exec Tier',
  sodStatus: 'SoD',
};
