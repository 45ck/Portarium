import { format, formatDistanceToNow } from 'date-fns';
import type { ReactNode } from 'react';
import { ShieldCheck, Link2, Clock3, ArrowRight, Bot } from 'lucide-react';
import type { ApprovalSummary, EvidenceEntry, RunSummary } from '@portarium/cockpit-types';
import type { TriageViewMode } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  buildEvidencePanelSummary,
  buildPolicyPanelSummary,
  buildRunTimelinePanelSummary,
  buildAgentActionPanelSummary,
} from './lib/approval-context-panels-summary';

interface ApprovalContextPanelsProps {
  approval: ApprovalSummary;
  evidenceEntries: readonly EvidenceEntry[];
  run?: RunSummary;
  onOpenMode: (mode: TriageViewMode) => void;
  variant?: 'cards' | 'compact';
}

function ChainStatusBadge({ chainStatus }: { chainStatus: 'none' | 'verified' | 'broken' }) {
  const label =
    chainStatus === 'verified'
      ? 'Chain verified'
      : chainStatus === 'broken'
        ? 'Chain warning'
        : 'No evidence';
  const className =
    chainStatus === 'verified'
      ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
      : chainStatus === 'broken'
        ? 'bg-red-500/10 text-red-700 border-red-500/30'
        : 'bg-muted text-muted-foreground border-border';

  return (
    <Badge variant="outline" className={cn('text-[11px] h-5', className)}>
      {label}
    </Badge>
  );
}

export function ApprovalContextPanels({
  approval,
  evidenceEntries,
  run,
  onOpenMode,
  variant = 'cards',
}: ApprovalContextPanelsProps) {
  const policy = buildPolicyPanelSummary(approval);
  const evidence = buildEvidencePanelSummary(evidenceEntries);
  const timeline = buildRunTimelinePanelSummary(approval, run);
  const agentAction = buildAgentActionPanelSummary(approval);

  const gridCols = agentAction ? 'md:grid-cols-2 2xl:grid-cols-4' : 'md:grid-cols-3';

  if (variant === 'compact') {
    const latestEvidenceLabel = evidence.latestOccurredAtIso
      ? formatDistanceToNow(new Date(evidence.latestOccurredAtIso), { addSuffix: true })
      : 'N/A';

    return (
      <section
        aria-label="Cross-layer context"
        className="rounded-md border border-border bg-muted/10 px-2.5 py-2"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Context
          </span>
          <ContextChip
            icon={ShieldCheck}
            label="Policy"
            value={policy.tierLabel}
            title={`Trigger: ${policy.triggerLabel}`}
            onClick={() => onOpenMode('compliance-checklist')}
          />
          <ContextChip
            icon={Link2}
            label="Evidence"
            value={`${evidence.entryCount} entries`}
            title={`Latest: ${latestEvidenceLabel}`}
            onClick={() => onOpenMode('evidence-chain')}
          />
          <ContextChip
            icon={Clock3}
            label="Run"
            value={timeline.runStatusLabel}
            title={`Execution tier: ${timeline.executionTierLabel}`}
            onClick={() => onOpenMode('story-timeline')}
          />
          {agentAction && (
            <ContextChip
              icon={Bot}
              label="Agent"
              value={agentAction.categoryLabel}
              title={`${agentAction.toolName} via ${agentAction.agentId}`}
              onClick={() => onOpenMode('agent-overview')}
            />
          )}
          <ChainStatusBadge chainStatus={evidence.chainStatus} />
        </div>

        <details className="group mt-1">
          <summary className="inline-flex cursor-pointer select-none items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            Details
            <ArrowRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2">
            <CompactContextBlock
              icon={ShieldCheck}
              title="Policy Context"
              actionLabel="Compliance Review"
              onAction={() => onOpenMode('compliance-checklist')}
            >
              <ContextLine label="Tier" value={policy.tierLabel} />
              <ContextLine label="Trigger" value={policy.triggerLabel} />
              <ContextLine label="Risk" value={policy.irreversibilityLabel} />
              <ContextLine label="SoD" value={policy.sodLabel} />
            </CompactContextBlock>

            <CompactContextBlock
              icon={Link2}
              title="Evidence Context"
              actionLabel="Evidence Chain"
              onAction={() => onOpenMode('evidence-chain')}
              badge={<ChainStatusBadge chainStatus={evidence.chainStatus} />}
            >
              <ContextLine label="Entries" value={String(evidence.entryCount)} />
              <ContextLine label="Attachments" value={String(evidence.attachmentCount)} />
              <ContextLine label="Latest" value={latestEvidenceLabel} />
            </CompactContextBlock>

            <CompactContextBlock
              icon={Clock3}
              title="Run Timeline"
              actionLabel="Story Timeline"
              onAction={() => onOpenMode('story-timeline')}
            >
              <ContextLine label="Status" value={timeline.runStatusLabel} />
              <ContextLine label="Tier" value={timeline.executionTierLabel} />
              <ContextLine label="Revision cycles" value={String(timeline.cycleCount)} />
              <ContextLine
                label="Due"
                value={
                  approval.dueAtIso
                    ? `${format(new Date(approval.dueAtIso), 'MMM d, HH:mm')}${
                        timeline.isOverdue ? ' (overdue)' : ''
                      }`
                    : 'N/A'
                }
              />
            </CompactContextBlock>

            {agentAction && (
              <CompactContextBlock
                icon={Bot}
                title="Agent Action"
                actionLabel="Agent Overview"
                onAction={() => onOpenMode('agent-overview')}
                badge={
                  <Badge variant={agentAction.categoryVariant} className="h-5 text-[11px]">
                    {agentAction.categoryLabel}
                  </Badge>
                }
              >
                <ContextLine label="Tool" value={agentAction.toolName} mono />
                <ContextLine label="Agent" value={agentAction.agentId} mono />
                <ContextLine label="Tier" value={agentAction.tierLabel} />
                <ContextLine label="Reason" value={agentAction.rationale} />
              </CompactContextBlock>
            )}
          </div>
        </details>
      </section>
    );
  }

  return (
    <section
      aria-label="Cross-layer context"
      className={cn('grid min-w-0 gap-2 rounded-lg border border-border bg-muted/15 p-2', gridCols)}
    >
      <article className="min-w-0 rounded-md border border-border bg-background/80 p-3 space-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="min-w-0 text-xs font-semibold">Policy Context</h3>
        </div>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            Tier: <span className="font-medium text-foreground">{policy.tierLabel}</span>
          </p>
          <p className="truncate" title={policy.triggerLabel}>
            Trigger: <span className="font-medium text-foreground">{policy.triggerLabel}</span>
          </p>
          <p>
            Risk: <span className="font-medium text-foreground">{policy.irreversibilityLabel}</span>
          </p>
          <p>
            SoD: <span className="font-medium text-foreground">{policy.sodLabel}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onOpenMode('compliance-checklist')}
        >
          Compliance Review
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </article>

      <article className="min-w-0 rounded-md border border-border bg-background/80 p-3 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h3 className="min-w-0 text-xs font-semibold">Evidence Context</h3>
          </div>
          <ChainStatusBadge chainStatus={evidence.chainStatus} />
        </div>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            Entries: <span className="font-medium text-foreground">{evidence.entryCount}</span>
          </p>
          <p>
            Attachments:{' '}
            <span className="font-medium text-foreground">{evidence.attachmentCount}</span>
          </p>
          <p>
            Latest:{' '}
            <span className="font-medium text-foreground">
              {evidence.latestOccurredAtIso
                ? formatDistanceToNow(new Date(evidence.latestOccurredAtIso), { addSuffix: true })
                : 'N/A'}
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onOpenMode('evidence-chain')}
        >
          Evidence Chain
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </article>

      <article className="min-w-0 rounded-md border border-border bg-background/80 p-3 space-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" />
          <h3 className="min-w-0 text-xs font-semibold">Run Timeline</h3>
        </div>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            Status: <span className="font-medium text-foreground">{timeline.runStatusLabel}</span>
          </p>
          <p>
            Tier: <span className="font-medium text-foreground">{timeline.executionTierLabel}</span>
          </p>
          <p>
            Revision cycles:{' '}
            <span className="font-medium text-foreground">{timeline.cycleCount}</span>
          </p>
          <p>
            Due:{' '}
            <span className="font-medium text-foreground">
              {approval.dueAtIso ? format(new Date(approval.dueAtIso), 'MMM d, HH:mm') : 'N/A'}
              {timeline.isOverdue ? ' (overdue)' : ''}
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onOpenMode('story-timeline')}
        >
          Story Timeline
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </article>

      {agentAction && (
        <article className="min-w-0 rounded-md border border-border bg-background/80 p-3 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <h3 className="min-w-0 text-xs font-semibold">Agent Action</h3>
            </div>
            <Badge variant={agentAction.categoryVariant} className="text-[11px] h-5">
              {agentAction.categoryLabel}
            </Badge>
          </div>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <p>
              Tool:{' '}
              <span className="font-medium text-foreground font-mono">{agentAction.toolName}</span>
            </p>
            <p>
              Agent:{' '}
              <span className="font-medium text-foreground font-mono">{agentAction.agentId}</span>
            </p>
            <p>
              Tier: <span className="font-medium text-foreground">{agentAction.tierLabel}</span>
            </p>
            <p className="truncate" title={agentAction.rationale}>
              Reason: <span className="font-medium text-foreground">{agentAction.rationale}</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => onOpenMode('agent-overview')}
          >
            Agent Overview
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </article>
      )}
    </section>
  );
}

function ContextChip({
  icon: Icon,
  label,
  value,
  title,
  onClick,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="max-w-full justify-start bg-background/80 font-normal"
      title={title}
      onClick={onClick}
    >
      <Icon className="h-3 w-3 text-primary" />
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-36 truncate font-medium text-foreground">{value}</span>
    </Button>
  );
}

function CompactContextBlock({
  icon: Icon,
  title,
  actionLabel,
  onAction,
  badge,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  actionLabel: string;
  onAction: () => void;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-md border border-border bg-background/80 p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
        <h3 className="min-w-0 truncate text-xs font-semibold">{title}</h3>
        {badge && <div className="ml-auto shrink-0">{badge}</div>}
      </div>
      <div className="mt-2 space-y-1 text-muted-foreground">{children}</div>
      <Button variant="ghost" size="xs" className="mt-2 px-1.5" onClick={onAction}>
        {actionLabel}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </article>
  );
}

function ContextLine({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <p className="flex min-w-0 gap-1">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className={cn('min-w-0 truncate font-medium text-foreground', mono && 'font-mono')}>
        {value}
      </span>
    </p>
  );
}
