import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';

export type ApprovalDomain =
  | 'robotics'
  | 'finance'
  | 'compliance'
  | 'logistics'
  | 'itsm'
  | 'agent-task'
  | 'general';

export interface ApprovalContext {
  domain: ApprovalDomain;
  portFamilies: Set<string>;
  hasRobots: boolean;
  hasAgents: boolean;
  hasEffects: boolean;
  hasEvidence: boolean;
  sorCount: number;
  executionTier: string;
}

/**
 * Maps port-family strings to approval domains.
 * A port family may appear in WorkflowActionSummary.portFamily
 * or PlanEffect.target.portFamily.
 */
const PORT_FAMILY_DOMAIN: Record<string, ApprovalDomain> = {
  FinanceAccounting: 'finance',
  PaymentsBilling: 'finance',
  Invoicing: 'finance',
  Treasury: 'finance',
  RegulatoryCompliance: 'compliance',
  AuditReporting: 'compliance',
  PolicyEnforcement: 'compliance',
  QualityManagement: 'compliance',
  Logistics: 'logistics',
  WarehouseManagement: 'logistics',
  ShippingFreight: 'logistics',
  InventoryManagement: 'logistics',
  ITSM: 'itsm',
  IncidentManagement: 'itsm',
  ServiceDesk: 'itsm',
};

/**
 * Collects all port families mentioned in effects and workflow actions.
 */
function collectPortFamilies(effects: PlanEffect[], workflow?: WorkflowSummary): Set<string> {
  const families = new Set<string>();
  for (const e of effects) {
    if (e.target.portFamily) families.add(e.target.portFamily);
  }
  if (workflow) {
    for (const a of workflow.actions) {
      if (a.portFamily) families.add(a.portFamily);
    }
  }
  return families;
}

/**
 * Determines the approval domain via port-family vote-counting with a
 * robot/agent override. Pure and synchronous — derived from existing props.
 */
function classifyDomain(
  portFamilies: Set<string>,
  hasRobots: boolean,
  hasAgents: boolean,
): ApprovalDomain {
  // Robot override: if robots are involved, it's robotics regardless
  if (hasRobots) return 'robotics';

  // Count votes per domain
  const votes = new Map<ApprovalDomain, number>();
  for (const pf of portFamilies) {
    const domain = PORT_FAMILY_DOMAIN[pf];
    if (domain) votes.set(domain, (votes.get(domain) ?? 0) + 1);
  }

  if (votes.size === 0) {
    return hasAgents ? 'agent-task' : 'general';
  }

  // Pick the domain with the most votes
  let best: ApprovalDomain = 'general';
  let bestCount = 0;
  for (const [domain, count] of votes) {
    if (count > bestCount) {
      best = domain;
      bestCount = count;
    }
  }

  return best;
}

/**
 * Resolves the full approval context from existing props.
 * No API calls needed — everything is derived from already-fetched data.
 */
export function resolveApprovalContext(
  approval: ApprovalSummary,
  effects: PlanEffect[],
  evidenceEntries: EvidenceEntry[],
  run?: RunSummary,
  workflow?: WorkflowSummary,
): ApprovalContext {
  const portFamilies = collectPortFamilies(effects, workflow);
  const hasRobots = (run?.robotIds?.length ?? 0) > 0;
  const hasAgents = (run?.agentIds?.length ?? 0) > 0;
  const hasEffects = effects.length > 0;
  const hasEvidence = evidenceEntries.length > 0;
  const sorNames = new Set(effects.map((e) => e.target.sorName));
  const executionTier = run?.executionTier ?? 'Auto';

  return {
    domain: classifyDomain(portFamilies, hasRobots, hasAgents),
    portFamilies,
    hasRobots,
    hasAgents,
    hasEffects,
    hasEvidence,
    sorCount: sorNames.size,
    executionTier,
  };
}
