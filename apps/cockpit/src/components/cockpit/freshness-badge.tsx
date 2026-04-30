import { AlertTriangle, Clock3, Database, RefreshCcw, Wifi, WifiOff } from 'lucide-react';
import { deriveFreshnessState } from '@/lib/cockpit-data-source-status';
import { cn } from '@/lib/utils';
import type { OfflineQueryMeta } from '@/hooks/queries/use-offline-query';

const STATE_CLASS = {
  live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  demo: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  cached: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  offline: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  stale: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  unauthorized: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  degraded: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  connecting: 'border-border bg-muted text-muted-foreground',
} as const;

function iconForState(state: keyof typeof STATE_CLASS) {
  const className = 'h-3.5 w-3.5';
  if (state === 'live') return <Wifi className={className} aria-hidden="true" />;
  if (state === 'offline') return <WifiOff className={className} aria-hidden="true" />;
  if (state === 'cached') return <Database className={className} aria-hidden="true" />;
  if (state === 'stale') return <Clock3 className={className} aria-hidden="true" />;
  if (state === 'degraded' || state === 'unauthorized') {
    return <AlertTriangle className={className} aria-hidden="true" />;
  }
  return <RefreshCcw className={className} aria-hidden="true" />;
}

export function FreshnessBadge({
  offlineMeta,
  isFetching = false,
  sourceLabel,
  className,
}: {
  offlineMeta: OfflineQueryMeta;
  isFetching?: boolean;
  sourceLabel?: string;
  className?: string;
}) {
  const status = deriveFreshnessState(offlineMeta);
  const label = isFetching && status.state === 'live' ? 'Refreshing' : status.label;
  const title = offlineMeta.lastSyncAtIso
    ? `${sourceLabel ? `${sourceLabel}: ` : ''}${label}. Last sync ${new Date(
        offlineMeta.lastSyncAtIso,
      ).toLocaleString()}`
    : `${sourceLabel ? `${sourceLabel}: ` : ''}${label}. ${status.detail}`;

  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
        STATE_CLASS[status.state],
        className,
      )}
      title={title}
      aria-label={title}
    >
      {iconForState(status.state)}
      {sourceLabel ? <span>{sourceLabel}</span> : null}
      <span>{label}</span>
      <span className="text-current/70">{status.ageLabel ?? status.detail}</span>
    </span>
  );
}
