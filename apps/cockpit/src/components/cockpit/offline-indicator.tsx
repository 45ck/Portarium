/**
 * OfflineIndicator — shows connectivity status and pending queue count.
 *
 * Renders an inline badge in the cockpit header area when the browser is
 * offline or when there are pending approval decisions queued for replay.
 * Hidden entirely when online with zero pending items.
 *
 * Bead: bead-0946
 */

import { WifiOff, CloudOff } from 'lucide-react';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { cn } from '@/lib/utils';

export function OfflineIndicator({ className }: { className?: string }) {
  const { isOnline, pendingCount } = useOfflineQueue();

  // Nothing to show when online with empty queue
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        isOnline
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-destructive/10 text-destructive',
        className,
      )}
    >
      {isOnline ? (
        <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>
        {isOnline
          ? `${pendingCount} pending`
          : `Offline${pendingCount > 0 ? ` \u2013 ${pendingCount} pending` : ''}`}
      </span>
    </div>
  );
}
