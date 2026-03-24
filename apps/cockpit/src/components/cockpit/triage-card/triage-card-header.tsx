import { format, formatDistanceToNow } from 'date-fns';
import type {
  ApprovalSummary,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { EntityIcon } from '@/components/domain/entity-icon';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, Bot, Clock, Mail, Calendar, MessageSquare, Paperclip, User } from 'lucide-react';
import { ActorBadge } from './actor-badge';
import { SorBadge } from './sor-badge';
import { HeaderProvenanceTrail } from './header-provenance-trail';

// ---------------------------------------------------------------------------
// Agent display name resolution (demo-friendly)
// ---------------------------------------------------------------------------

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  'agent-openclaw-001': 'OpenClaw Watchtower',
  'agent-openclaw-watchtower-001': 'OpenClaw Watchtower',
};

function resolveAgentDisplayName(agentId: string): string {
  return AGENT_DISPLAY_NAMES[agentId] ?? agentId;
}

// ---------------------------------------------------------------------------
// Target SoR icon mapping
// ---------------------------------------------------------------------------

const SOR_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Gmail: Mail,
  'Google Calendar': Calendar,
  Slack: MessageSquare,
};

function SorTargetPill({ name }: { name: string }) {
  const Icon = SOR_ICON_MAP[name];
  if (Icon) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-2 py-0.5">
        <Icon className="h-3 w-3 shrink-0" />
        {name}
      </span>
    );
  }
  // Fall back to SorBadge for unknown SoRs (only if it looks like a system name, not a quantity)
  if (/^\d/.test(name)) return null;
  return <SorBadge name={name} />;
}

export interface TriageCardHeaderProps {
  approval: ApprovalSummary;
  evidenceEntries: EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
  isOverdue: boolean;
}

export function TriageCardHeader({
  approval,
  evidenceEntries,
  run,
  workflow,
  isOverdue,
}: TriageCardHeaderProps) {
  const policyRule = approval.policyRule;
  return (
    <>
      {/* Overdue stripe */}
      {isOverdue && (
        <div className="bg-red-500 px-5 py-1.5 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-white" />
          <span className="text-[11px] font-bold text-white uppercase tracking-wide">Overdue</span>
          <span className="text-[11px] text-red-100 ml-auto">
            Due {format(new Date(approval.dueAtIso!), 'MMM d, HH:mm')}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-muted/20 px-5 pt-5 pb-4 border-b border-border/50 shrink-0">
        <div className="flex items-start gap-4">
          {/* Icon box */}
          <div className="shrink-0 rounded-xl bg-background border border-border p-3 w-16 h-16 flex items-center justify-center">
            <EntityIcon entityType="approval" size="xl" decorative />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Approval Gate
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {approval.approvalId}
              </span>
              {policyRule && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">
                  {policyRule.tier}
                </Badge>
              )}
              {approval.agentActionProposal && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0 gap-0.5">
                  <Bot className="h-2.5 w-2.5" />
                  Agent Action
                </Badge>
              )}
            </div>

            {/* Agent identity + target SoR */}
            {run?.agentIds && run.agentIds.length > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Bot className="h-3 w-3 shrink-0 text-primary" />
                  <span className="font-medium text-foreground">
                    {resolveAgentDisplayName(run.agentIds[0]!)}
                  </span>
                </span>
                {policyRule?.blastRadius && policyRule.blastRadius.length > 0 && (
                  <>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    {policyRule.blastRadius.slice(0, 2).map((sor) => (
                      <SorTargetPill key={sor} name={sor} />
                    ))}
                  </>
                )}
              </div>
            )}

            <p className="text-sm font-semibold leading-snug">{approval.prompt}</p>

            {/* Requested by */}
            <div className="flex items-center gap-2 mt-2">
              <ActorBadge userId={approval.requestedByUserId} />
              {approval.assigneeUserId && (
                <>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="font-medium text-foreground">{approval.assigneeUserId}</span>
                  </span>
                </>
              )}
              <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                {formatDistanceToNow(new Date(approval.requestedAtIso), { addSuffix: true })}
              </span>
            </div>

            {/* Metadata pills */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-2.5 py-0.5 hover:border-primary/40 transition-colors cursor-default"
                title={`Run: ${approval.runId}`}
              >
                <EntityIcon entityType="run" size="xs" decorative />
                {approval.runId.slice(0, 12)}
              </span>
              {approval.workItemId && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-2.5 py-0.5 hover:border-primary/40 transition-colors cursor-default"
                  title={`Work Item: ${approval.workItemId}`}
                >
                  <EntityIcon entityType="work-item" size="xs" decorative />
                  {approval.workItemId.slice(0, 12)}
                </span>
              )}
              {approval.dueAtIso && !isOverdue && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Due {format(new Date(approval.dueAtIso), 'MMM d')}
                </span>
              )}
              {evidenceEntries.length > 0 &&
                (() => {
                  const totalAttachments = evidenceEntries.reduce(
                    (s, e) => s + (e.payloadRefs?.length ?? 0),
                    0,
                  );
                  return totalAttachments > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-2.5 py-0.5">
                      <Paperclip className="h-3 w-3" />
                      {totalAttachments} file{totalAttachments !== 1 ? 's' : ''}
                    </span>
                  ) : null;
                })()}
            </div>

            <HeaderProvenanceTrail run={run} workflow={workflow} />
          </div>
        </div>
      </div>
    </>
  );
}
