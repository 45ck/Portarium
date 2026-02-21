import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { EntityIcon } from '@/components/domain/entity-icon';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Bot,
  Workflow,
  Zap,
  Clock,
  Radio,
  Globe,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Cog,
} from 'lucide-react';
import type {
  RunSummary,
  WorkflowSummary,
  ApprovalSummary,
  DecisionHistoryEntry,
} from '@portarium/cockpit-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TRIGGER_ICON: Record<string, typeof Zap> = {
  Manual: User,
  Cron: Clock,
  Webhook: Globe,
  DomainEvent: Radio,
};

const TRIGGER_LABEL: Record<string, string> = {
  Manual: 'Manually triggered',
  Cron: 'Scheduled (cron)',
  Webhook: 'Webhook callback',
  DomainEvent: 'Domain event',
};

const RUN_STATUS_STYLE: Record<string, { color: string; Icon: typeof Play }> = {
  Pending: { color: 'text-muted-foreground', Icon: Clock },
  Running: { color: 'text-blue-600', Icon: Play },
  WaitingForApproval: { color: 'text-amber-600', Icon: Pause },
  Paused: { color: 'text-yellow-600', Icon: Pause },
  Succeeded: { color: 'text-emerald-600', Icon: CheckCircle2 },
  Failed: { color: 'text-red-600', Icon: XCircle },
  Cancelled: { color: 'text-muted-foreground', Icon: XCircle },
};

const TIER_STYLE: Record<string, string> = {
  Auto: 'bg-success/10 text-success border-success/30',
  Assisted: 'bg-info/10 text-info border-info/30',
  HumanApprove: 'bg-warning/10 text-warning border-warning/30',
  ManualOnly: 'bg-destructive/10 text-destructive border-destructive/30',
};

function inferActorKind(userId: string): { label: string; Icon: typeof User } {
  const lower = userId.toLowerCase();
  if (lower === 'system' || lower.startsWith('sys-')) return { label: 'System', Icon: Cog };
  if (lower.startsWith('agent-') || lower.startsWith('bot-')) return { label: 'Agent', Icon: Bot };
  if (lower.startsWith('wf-') || lower.startsWith('workflow-'))
    return { label: 'Workflow', Icon: Workflow };
  return { label: 'User', Icon: User };
}

// ---------------------------------------------------------------------------
// Step component
// ---------------------------------------------------------------------------

interface StepProps {
  icon: React.ReactNode;
  title: string;
  detail?: React.ReactNode;
  isLast?: boolean;
  highlight?: boolean;
}

function Step({ icon, title, detail, isLast, highlight }: StepProps) {
  return (
    <div className="flex gap-3 relative">
      {/* Vertical connector line */}
      {!isLast && <div className="absolute left-[11px] top-[24px] bottom-0 w-px bg-border" />}
      {/* Dot */}
      <div
        className={cn(
          'relative z-10 flex items-center justify-center w-6 h-6 rounded-full border shrink-0',
          highlight
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background border-border',
        )}
      >
        {icon}
      </div>
      {/* Content */}
      <div className={cn('pb-3 min-w-0', isLast && 'pb-0')}>
        <p className={cn('text-xs font-semibold leading-6', highlight && 'text-primary')}>
          {title}
        </p>
        {detail && <div className="mt-0.5">{detail}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ProvenanceJourneyProps {
  approval: ApprovalSummary;
  run?: RunSummary;
  workflow?: WorkflowSummary;
}

export function ProvenanceJourney({ approval, run, workflow }: ProvenanceJourneyProps) {
  const initiator = run?.initiatedByUserId ?? approval.requestedByUserId;
  const { label: actorLabel, Icon: ActorIcon } = inferActorKind(initiator);
  const triggerKind = workflow?.triggerKind ?? 'Manual';
  const TriggerIcon = TRIGGER_ICON[triggerKind] ?? Zap;
  const triggerLabel = TRIGGER_LABEL[triggerKind] ?? triggerKind;
  const runStatus = run?.status ?? 'WaitingForApproval';
  const statusStyle = RUN_STATUS_STYLE[runStatus] ?? RUN_STATUS_STYLE['Pending']!;
  const history = approval.decisionHistory ?? [];

  const agentCount = run?.agentIds?.length ?? 0;
  const robotCount = run?.robotIds?.length ?? 0;
  const hasParticipants = agentCount > 0 || robotCount > 0;

  // Workflow actions count (steps before approval gate)
  const actionCount = workflow?.actions?.length ?? 0;

  return (
    <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        How we got here
      </p>

      <div className="space-y-0">
        {/* 1. Trigger */}
        <Step
          icon={<TriggerIcon className="h-3 w-3" />}
          title={triggerLabel}
          detail={
            <p className="text-[11px] text-muted-foreground">
              {run?.createdAtIso
                ? formatDistanceToNow(new Date(run.createdAtIso), { addSuffix: true })
                : formatDistanceToNow(new Date(approval.requestedAtIso), { addSuffix: true })}
            </p>
          }
        />

        {/* 2. Initiator */}
        <Step
          icon={<ActorIcon className="h-3 w-3" />}
          title={`${actorLabel}: ${initiator}`}
          detail={
            workflow && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] h-4 px-1.5',
                    TIER_STYLE[run?.executionTier ?? workflow.executionTier],
                  )}
                >
                  {run?.executionTier ?? workflow.executionTier}
                </Badge>
              </div>
            )
          }
        />

        {/* 3. Workflow */}
        {workflow && (
          <Step
            icon={<Workflow className="h-3 w-3" />}
            title={workflow.name}
            detail={
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px]">{workflow.workflowId}</span>
                <span>v{workflow.version}</span>
                {actionCount > 0 && (
                  <span>
                    {actionCount} step{actionCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            }
          />
        )}

        {/* 4. Participants (agents + robots) */}
        {hasParticipants && (
          <Step
            icon={<Bot className="h-3 w-3" />}
            title={[
              agentCount > 0 ? `${agentCount} agent${agentCount !== 1 ? 's' : ''}` : '',
              robotCount > 0 ? `${robotCount} robot${robotCount !== 1 ? 's' : ''}` : '',
            ]
              .filter(Boolean)
              .join(', ')}
            detail={
              <div className="flex flex-wrap gap-1">
                {run?.agentIds?.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 text-[10px] font-mono bg-background border border-border rounded px-1.5 py-0.5"
                  >
                    <Bot className="h-2.5 w-2.5 text-violet-500" />
                    {id}
                  </span>
                ))}
                {run?.robotIds?.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 text-[10px] font-mono bg-background border border-border rounded px-1.5 py-0.5"
                  >
                    <Cog className="h-2.5 w-2.5 text-sky-500" />
                    {id}
                  </span>
                ))}
              </div>
            }
          />
        )}

        {/* 5. Run status */}
        {run && (
          <Step
            icon={<statusStyle.Icon className={cn('h-3 w-3', statusStyle.color)} />}
            title={`Run: ${runStatus.replace(/([A-Z])/g, ' $1').trim()}`}
            detail={
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px]">{run.runId}</span>
                {run.startedAtIso && (
                  <span>started {format(new Date(run.startedAtIso), 'MMM d, HH:mm')}</span>
                )}
              </div>
            }
          />
        )}

        {/* 6. Decision history entries (if any prior cycles) */}
        {history.map((entry, i) => {
          const dotCls: Record<DecisionHistoryEntry['type'], string> = {
            requested: 'text-muted-foreground',
            changes_requested: 'text-yellow-600',
            resubmitted: 'text-blue-600',
          };
          const entryIcon: Record<DecisionHistoryEntry['type'], typeof AlertTriangle> = {
            requested: Clock,
            changes_requested: AlertTriangle,
            resubmitted: Play,
          };
          const EntryIcon = entryIcon[entry.type] ?? Clock;
          return (
            <Step
              key={`${entry.timestamp}-${i}`}
              icon={<EntryIcon className={cn('h-3 w-3', dotCls[entry.type])} />}
              title={`${entry.type.replace(/_/g, ' ')} by ${entry.actor}`}
              detail={
                <p className="text-[11px] text-muted-foreground line-clamp-2">{entry.message}</p>
              }
            />
          );
        })}

        {/* 7. YOU ARE HERE — approval gate */}
        <Step
          icon={<EntityIcon entityType="approval" size="xs" decorative />}
          title="Approval Gate"
          highlight
          isLast
          detail={
            <p className="text-[11px] text-muted-foreground">
              Waiting for your decision
              {approval.assigneeUserId && <span> (assigned to {approval.assigneeUserId})</span>}
            </p>
          }
        />
      </div>
    </div>
  );
}
