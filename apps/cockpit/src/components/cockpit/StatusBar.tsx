import { cn } from '@/lib/utils'

interface StatusBarProps {
  runCount?: number
  chainStatus?: 'verified' | 'failed' | 'pending'
  streamStatus?: 'live' | 'degraded' | 'offline'
  onOpenCommandPalette?: () => void
  onOpenCheatsheet?: () => void
}

const chainColors: Record<NonNullable<StatusBarProps['chainStatus']>, string> = {
  verified: 'bg-[rgb(var(--status-ok))]',
  failed: 'bg-[rgb(var(--status-danger))]',
  pending: 'bg-[rgb(var(--status-warn))]',
}

const chainLabels: Record<NonNullable<StatusBarProps['chainStatus']>, string> = {
  verified: 'Chain verified',
  failed: 'Chain integrity failed',
  pending: 'Chain verification pending',
}

const streamColors: Record<NonNullable<StatusBarProps['streamStatus']>, string> = {
  live: 'text-[rgb(var(--status-ok))]',
  degraded: 'text-[rgb(var(--status-warn))]',
  offline: 'text-[rgb(var(--status-danger))]',
}

const streamLabels: Record<NonNullable<StatusBarProps['streamStatus']>, string> = {
  live: 'Stream live',
  degraded: 'Stream degraded',
  offline: 'Stream offline',
}

export function StatusBar({
  runCount,
  chainStatus = 'verified',
  streamStatus = 'live',
  onOpenCommandPalette,
  onOpenCheatsheet,
}: StatusBarProps) {
  return (
    <div className="flex h-[var(--statusbar-height)] items-center justify-between border-t-2 border-[rgb(var(--border))] bg-white px-3 text-xs">
      <div className="flex items-center gap-2">
        {runCount !== undefined && runCount > 0 ? (
          <span className="font-bold text-[rgb(var(--foreground))]">
            {runCount} run{runCount !== 1 ? 's' : ''} active
          </span>
        ) : (
          <span className="text-[rgb(var(--muted))]">No active runs</span>
        )}
      </div>

      <div className="flex items-center gap-1.5" aria-label={chainLabels[chainStatus]}>
        <span
          className={cn('h-2 w-2 rounded-full', chainColors[chainStatus])}
          role="status"
          aria-label={chainLabels[chainStatus]}
        />
        <span className="text-[rgb(var(--muted))]">Chain</span>
      </div>

      <div className="flex items-center gap-3">
        <span className={cn('font-bold', streamColors[streamStatus])}>
          {streamLabels[streamStatus]}
        </span>

        <button
          onClick={onOpenCommandPalette}
          className="rounded border border-[rgb(var(--border))] bg-gray-50 px-1 py-0.5 font-mono text-[10px] text-[rgb(var(--muted))] hover:bg-gray-100"
          aria-label="Open command palette"
        >
          Ctrl+K
        </button>

        <button
          onClick={onOpenCheatsheet}
          className="flex h-5 w-5 items-center justify-center rounded border border-[rgb(var(--border))] bg-gray-50 font-mono text-[10px] text-[rgb(var(--muted))] hover:bg-gray-100"
          aria-label="Open keyboard shortcuts"
        >
          ?
        </button>
      </div>
    </div>
  )
}
