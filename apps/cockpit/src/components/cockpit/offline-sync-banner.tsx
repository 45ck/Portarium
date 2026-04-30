import { formatDistanceToNow } from 'date-fns';
import { CloudOff, Clock3, RefreshCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface OfflineSyncBannerProps {
  isOffline: boolean;
  isStaleData: boolean;
  lastSyncAtIso?: string;
  pendingOutboxCount?: number;
  decisionContext?: 'approval-review';
}

function lastSyncText(lastSyncAtIso?: string): string {
  if (!lastSyncAtIso) return 'Never synced';
  const relative = formatDistanceToNow(new Date(lastSyncAtIso), { addSuffix: true });
  return `Last sync ${relative}`;
}

export function OfflineSyncBanner({
  isOffline,
  isStaleData,
  lastSyncAtIso,
  pendingOutboxCount = 0,
  decisionContext,
}: OfflineSyncBannerProps) {
  // Suppress stale-data banner in demo/MSW mode — there is no real server to
  // be out of sync with, so showing "cached data" is misleading.
  const isDemoMode =
    import.meta.env.VITE_DEMO_MODE === 'true' || Boolean(import.meta.env.VITE_PORTARIUM_ENABLE_MSW);
  const effectiveStale = isStaleData && !isDemoMode;

  if (!isOffline && !effectiveStale && pendingOutboxCount === 0) return null;

  const title = isOffline
    ? 'Offline mode active'
    : effectiveStale
      ? 'Showing cached data'
      : 'Sync pending';

  return (
    <Alert
      variant={isOffline || effectiveStale ? 'warning' : 'info'}
      className="border border-border/70"
    >
      {isOffline ? <CloudOff /> : pendingOutboxCount > 0 ? <RefreshCcw /> : <Clock3 />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{lastSyncText(lastSyncAtIso)}</p>
        {pendingOutboxCount > 0 ? (
          <p>
            {pendingOutboxCount} queued approval decision{pendingOutboxCount === 1 ? '' : 's'} will
            replay when connection returns.
          </p>
        ) : null}
        {decisionContext === 'approval-review' && (isOffline || effectiveStale) ? (
          <p>
            Approval context may have changed since this data was synced. Reconnect or refresh
            before approving high-impact actions.
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
