import React from 'react';
import type { TriageModeProps } from '@/components/cockpit/triage-modes/index';
import type { TriageViewMode } from '@/stores/ui-store';
import { TrafficSignalsMode } from '@/components/cockpit/triage-modes/traffic-signals-mode';
import { BriefingMode } from '@/components/cockpit/triage-modes/briefing-mode';
import { RiskRadarMode } from '@/components/cockpit/triage-modes/risk-radar-mode';
import { BlastMapMode } from '@/components/cockpit/triage-modes/blast-map-mode';
import { DiffViewMode } from '@/components/cockpit/triage-modes/diff-view-mode';
import { ActionReplayMode } from '@/components/cockpit/triage-modes/action-replay-mode';
import { EvidenceChainMode } from '@/components/cockpit/triage-modes/evidence-chain-mode';
import { StoryTimelineMode } from '@/components/cockpit/triage-modes/story-timeline-mode';
import { RoboticsSafetyMode } from '@/components/cockpit/triage-modes/robotics-safety-mode';
import { FinanceImpactMode } from '@/components/cockpit/triage-modes/finance-impact-mode';
import { ComplianceChecklistMode } from '@/components/cockpit/triage-modes/compliance-checklist-mode';
import { AgentOverviewMode } from '@/components/cockpit/triage-modes/agent-overview-mode';

export const MODE_COMPONENTS: Partial<
  Record<TriageViewMode, React.ComponentType<TriageModeProps>>
> = {
  'traffic-signals': TrafficSignalsMode,
  briefing: BriefingMode,
  'risk-radar': RiskRadarMode,
  'blast-map': BlastMapMode,
  'diff-view': DiffViewMode,
  'action-replay': ActionReplayMode,
  'evidence-chain': EvidenceChainMode,
  'story-timeline': StoryTimelineMode,
  'robotics-safety': RoboticsSafetyMode,
  'finance-impact': FinanceImpactMode,
  'compliance-checklist': ComplianceChecklistMode,
  'agent-overview': AgentOverviewMode,
};

interface ModeErrorBoundaryProps {
  modeKey: string;
  children: React.ReactNode;
}

interface ModeErrorBoundaryState {
  hasError: boolean;
}

export class ModeErrorBoundary extends React.Component<
  ModeErrorBoundaryProps,
  ModeErrorBoundaryState
> {
  state: ModeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ModeErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ModeErrorBoundaryProps) {
    if (prevProps.modeKey !== this.props.modeKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
          <p className="text-sm font-medium text-destructive">This view encountered an error</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try switching to another mode or refreshing the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
