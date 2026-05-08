import {
  AlertTriangle,
  Database,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCockpitDataSourceStatus } from '@/hooks/use-cockpit-data-source-status';
import { cn } from '@/lib/utils';
import type { CockpitDataSourceState } from '@/lib/cockpit-data-source-status';

const STATE_CLASS: Record<CockpitDataSourceState, string> = {
  live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  demo: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  cached: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  offline: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  stale: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  unauthorized: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  degraded: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  connecting: 'border-border bg-muted text-muted-foreground',
};

function iconForState(state: CockpitDataSourceState) {
  const className = 'h-3.5 w-3.5';
  if (state === 'live') return <Wifi className={className} aria-hidden="true" />;
  if (state === 'demo') return <Sparkles className={className} aria-hidden="true" />;
  if (state === 'offline') return <WifiOff className={className} aria-hidden="true" />;
  if (state === 'cached' || state === 'stale') {
    return <Database className={className} aria-hidden="true" />;
  }
  if (state === 'unauthorized') return <ShieldAlert className={className} aria-hidden="true" />;
  return <AlertTriangle className={className} aria-hidden="true" />;
}

export function RuntimeStatusDetails({ className }: { className?: string }) {
  const status = useCockpitDataSourceStatus();

  return (
    <div className={cn('space-y-2 text-xs', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium',
            STATE_CLASS[status.state],
          )}
        >
          {iconForState(status.state)}
          {status.label}
        </span>
        <span className="text-muted-foreground">{status.modeLabel}</span>
        <span className="font-mono text-muted-foreground">{status.workspaceId}</span>
      </div>
      <p className="text-muted-foreground">{status.detail}</p>
      {status.pendingOutboxCount > 0 ? (
        <p className="font-medium text-amber-700 dark:text-amber-300">
          {status.pendingOutboxCount} approval decision
          {status.pendingOutboxCount === 1 ? '' : 's'} queued
        </p>
      ) : null}
    </div>
  );
}

export function RuntimeStatusStrip({ className }: { className?: string }) {
  const status = useCockpitDataSourceStatus();
  const absoluteUpdatedAt = status.lastUpdatedAtMs
    ? new Date(status.lastUpdatedAtMs).toLocaleString()
    : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'mx-4 mt-2 flex flex-wrap items-center gap-2 rounded-md border border-border/80 bg-card px-3 py-2 text-xs shadow-sm',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium',
          STATE_CLASS[status.state],
        )}
      >
        {iconForState(status.state)}
        {status.label}
      </span>
      <span className="text-muted-foreground">{status.modeLabel}</span>
      <span className="font-mono text-muted-foreground">{status.workspaceId}</span>
      <span className="min-w-[8rem] flex-1 text-muted-foreground">{status.detail}</span>
      {status.ageLabel ? (
        <span className="shrink-0 whitespace-nowrap text-muted-foreground" title={absoluteUpdatedAt}>
          {status.ageLabel}
        </span>
      ) : null}
      {status.pendingOutboxCount > 0 ? (
        <span className="rounded-md bg-amber-500/10 px-2 py-1 font-medium text-amber-700 dark:text-amber-300">
          {status.pendingOutboxCount} pending
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={status.refresh}
        aria-label="Refresh workspace data"
      >
        <RefreshCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
