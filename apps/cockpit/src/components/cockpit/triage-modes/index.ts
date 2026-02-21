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
} from 'lucide-react';
import type { TriageViewMode } from '@/stores/ui-store';
import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';

export interface TriageModeDefinition {
  id: TriageViewMode;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
}

export const TRIAGE_MODES: TriageModeDefinition[] = [
  {
    id: 'default',
    label: 'Default',
    shortLabel: 'Default',
    icon: FileText,
    description: 'Standard text-based triage view',
  },
  {
    id: 'traffic-signals',
    label: 'Traffic Signals',
    shortLabel: 'Signals',
    icon: TrafficCone,
    description: 'Go/no-go dashboard with 8 signal cards',
  },
  {
    id: 'briefing',
    label: 'Briefing',
    shortLabel: 'Brief',
    icon: ScrollText,
    description: '6-section executive briefing with full domain context',
  },
  {
    id: 'risk-radar',
    label: 'Risk Radar',
    shortLabel: 'Radar',
    icon: Radar,
    description: 'Spider chart with 8-axis risk assessment',
  },
  {
    id: 'blast-map',
    label: 'Entity Graph',
    shortLabel: 'Graph',
    icon: Network,
    description: 'Entity relationship graph centered on the approval gate',
  },
  {
    id: 'diff-view',
    label: 'Before / After',
    shortLabel: 'Diff',
    icon: Columns2,
    description: 'Side-by-side diff of current vs. post-approval state',
  },
  {
    id: 'action-replay',
    label: 'Action Replay',
    shortLabel: 'Replay',
    icon: Play,
    description: 'Step-through simulation of planned effects',
  },
  {
    id: 'evidence-chain',
    label: 'Evidence Chain',
    shortLabel: 'Chain',
    icon: Link2,
    description: 'Blockchain-style audit trail integrity view',
  },
  {
    id: 'story-timeline',
    label: 'Story Timeline',
    shortLabel: 'Story',
    icon: Clock,
    description: 'Horizontal chronology of the approval lifecycle',
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

export interface TriageModeProps {
  approval: ApprovalSummary;
  plannedEffects: PlanEffect[];
  evidenceEntries?: EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
}
