import type { LucideIcon } from 'lucide-react';
import {
  Radar,
  FileText,
  ScrollText,
  Network,
  Columns2,
  Play,
  Link2,
  TrafficCone,
  Clock,
  ShieldCheck,
  DollarSign,
  ClipboardCheck,
  Bot,
} from 'lucide-react';
import type { TriageViewMode } from '@/stores/ui-store';
import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import type { ApprovalContext } from './lib/approval-context';

export type ModeRelevance = 'recommended' | 'available' | 'hidden';

export interface TriageModeDefinition {
  id: TriageViewMode;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  relevance: (ctx: ApprovalContext) => ModeRelevance;
}

/** Finance port families for relevance checks. */
const FINANCE_FAMILIES = new Set(['FinanceAccounting', 'PaymentsBilling', 'Invoicing', 'Treasury']);

export const TRIAGE_MODES: TriageModeDefinition[] = [
  {
    id: 'default',
    label: 'Default',
    shortLabel: 'Default',
    icon: FileText,
    description: 'Standard text-based triage view',
    relevance: () => 'available',
  },
  {
    id: 'traffic-signals',
    label: 'Traffic Signals',
    shortLabel: 'Signals',
    icon: TrafficCone,
    description: 'Go/no-go dashboard with 8 signal cards',
    relevance: () => 'available',
  },
  {
    id: 'briefing',
    label: 'Briefing',
    shortLabel: 'Brief',
    icon: ScrollText,
    description: '6-section executive briefing with full domain context',
    relevance: () => 'available',
  },
  {
    id: 'risk-radar',
    label: 'Risk Radar',
    shortLabel: 'Radar',
    icon: Radar,
    description: 'Spider chart with 8-axis risk assessment',
    relevance: () => 'available',
  },
  {
    id: 'blast-map',
    label: 'Entity Graph',
    shortLabel: 'Graph',
    icon: Network,
    description: 'Entity relationship graph centered on the approval gate',
    relevance: () => 'available',
  },
  {
    id: 'diff-view',
    label: 'Before / After',
    shortLabel: 'Diff',
    icon: Columns2,
    description: 'Side-by-side diff of current vs. post-approval state',
    relevance: (ctx) => (ctx.hasEffects ? 'available' : 'hidden'),
  },
  {
    id: 'action-replay',
    label: 'Action Replay',
    shortLabel: 'Replay',
    icon: Play,
    description: 'Step-through simulation of planned effects',
    relevance: (ctx) => (ctx.hasEffects ? 'available' : 'hidden'),
  },
  {
    id: 'evidence-chain',
    label: 'Evidence Chain',
    shortLabel: 'Chain',
    icon: Link2,
    description: 'Blockchain-style audit trail integrity view',
    relevance: (ctx) => (ctx.hasEvidence ? 'available' : 'hidden'),
  },
  {
    id: 'story-timeline',
    label: 'Story Timeline',
    shortLabel: 'Story',
    icon: Clock,
    description: 'Horizontal chronology of the approval lifecycle',
    relevance: () => 'available',
  },
  {
    id: 'robotics-safety',
    label: 'Safety & Mission',
    shortLabel: 'Safety',
    icon: ShieldCheck,
    description: 'Robotics safety constraints and mission context',
    relevance: (ctx) => (ctx.domain === 'robotics' ? 'recommended' : 'hidden'),
  },
  {
    id: 'finance-impact',
    label: 'Financial Impact',
    shortLabel: 'Finance',
    icon: DollarSign,
    description: 'Financial impact summary with irreversibility and SoD',
    relevance: (ctx) => {
      if (ctx.domain === 'finance') return 'recommended';
      for (const pf of ctx.portFamilies) {
        if (FINANCE_FAMILIES.has(pf)) return 'available';
      }
      return 'hidden';
    },
  },
  {
    id: 'compliance-checklist',
    label: 'Compliance Review',
    shortLabel: 'Comply',
    icon: ClipboardCheck,
    description: 'Regulatory and compliance review with SoD and evidence',
    relevance: (ctx) => {
      if (ctx.domain === 'compliance') return 'recommended';
      // Show as available when there's a policy rule (indicated by non-general domain or effects)
      return 'available';
    },
  },
  {
    id: 'agent-overview',
    label: 'Agent & Workflow',
    shortLabel: 'Agents',
    icon: Bot,
    description: 'Agent details, workflow pipeline, and planned effects',
    relevance: (ctx) => (ctx.hasAgents ? 'recommended' : 'hidden'),
  },
];

export const TRIAGE_MODE_ORDER: TriageViewMode[] = TRIAGE_MODES.map((m) => m.id);

export function getNextMode(current: TriageViewMode): TriageViewMode {
  const idx = TRIAGE_MODE_ORDER.indexOf(current);
  return TRIAGE_MODE_ORDER[(idx + 1) % TRIAGE_MODE_ORDER.length]!;
}

export function getPrevMode(current: TriageViewMode): TriageViewMode {
  const idx = TRIAGE_MODE_ORDER.indexOf(current);
  return TRIAGE_MODE_ORDER[(idx - 1 + TRIAGE_MODE_ORDER.length) % TRIAGE_MODE_ORDER.length]!;
}

/**
 * Returns modes filtered and ordered by relevance:
 * recommended first, then available. Hidden modes are excluded.
 * When no context is provided, all modes are returned (backwards-compatible).
 */
export function getRelevantModes(ctx?: ApprovalContext): TriageModeDefinition[] {
  if (!ctx) return TRIAGE_MODES;

  const recommended: TriageModeDefinition[] = [];
  const available: TriageModeDefinition[] = [];

  for (const mode of TRIAGE_MODES) {
    const r = mode.relevance(ctx);
    if (r === 'recommended') recommended.push(mode);
    else if (r === 'available') available.push(mode);
  }

  return [...recommended, ...available];
}

/**
 * Cycles forward to the next visible mode, skipping hidden ones.
 */
export function getNextRelevantMode(
  current: TriageViewMode,
  ctx?: ApprovalContext,
): TriageViewMode {
  const modes = getRelevantModes(ctx);
  if (modes.length === 0) return 'default';
  const idx = modes.findIndex((m) => m.id === current);
  if (idx === -1) return modes[0]!.id;
  return modes[(idx + 1) % modes.length]!.id;
}

/**
 * Cycles backward to the previous visible mode, skipping hidden ones.
 */
export function getPrevRelevantMode(
  current: TriageViewMode,
  ctx?: ApprovalContext,
): TriageViewMode {
  const modes = getRelevantModes(ctx);
  if (modes.length === 0) return 'default';
  const idx = modes.findIndex((m) => m.id === current);
  if (idx === -1) return modes[0]!.id;
  return modes[(idx - 1 + modes.length) % modes.length]!.id;
}

export interface TriageModeProps {
  approval: ApprovalSummary;
  plannedEffects: PlanEffect[];
  evidenceEntries?: EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
}
