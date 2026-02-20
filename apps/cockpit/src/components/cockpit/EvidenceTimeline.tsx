import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { EvidenceEntry } from '@portarium/cockpit-types'
import { EvidenceCategoryBadge } from './EvidenceCategoryBadge'

function formatRelativeTime(isoString: string): string {
  const now = new Date()
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function formatActorLabel(actor: EvidenceEntry['actor']): string {
  switch (actor.kind) {
    case 'User':
      return actor.userId
    case 'Machine':
      return `Machine: ${actor.machineId}`
    case 'Adapter':
      return `Adapter: ${actor.adapterId}`
    case 'System':
      return 'System'
  }
}

function TimelineEntry({ entry }: { entry: EvidenceEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      {/* Spine line */}
      <div className="absolute left-[7px] top-4 -bottom-2 w-0.5 bg-[rgb(var(--border))] last:hidden" />

      {/* Node circle */}
      <div
        className={cn(
          'relative z-10 mt-1 h-4 w-4 flex-shrink-0 rounded-full border-2',
          'border-[rgb(var(--status-ok))] bg-white',
        )}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="w-full text-left"
        >
          <div className="flex items-center gap-2">
            <EvidenceCategoryBadge category={entry.category} />
            <span className="text-xs text-[rgb(var(--muted))]">
              {formatRelativeTime(entry.occurredAtIso)}
            </span>
          </div>
          <p className="mt-1 text-sm">{entry.summary}</p>
          <p className="text-xs text-[rgb(var(--muted))]">
            {formatActorLabel(entry.actor)}
          </p>
        </button>

        {expanded && (
          <div className="mt-2 rounded-[var(--radius-sm)] border border-[rgb(var(--border)/0.3)] bg-gray-50 p-2 text-xs">
            <div className="mb-1">
              <span className="font-black">Hash:</span>{' '}
              <code className="break-all">{entry.hashSha256}</code>
            </div>
            {entry.previousHash && (
              <div className="mb-1">
                <span className="font-black">Previous hash:</span>{' '}
                <code className="break-all">{entry.previousHash}</code>
              </div>
            )}
            <div>
              <span className="font-black">Actor:</span>{' '}
              {entry.actor.kind} {entry.actor.kind !== 'System' && `(${formatActorLabel(entry.actor)})`}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function EvidenceTimeline({ entries }: { entries: EvidenceEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-[rgb(var(--muted))]">
        No evidence entries.
      </p>
    )
  }

  const sorted = [...entries].sort(
    (a, b) =>
      new Date(a.occurredAtIso).getTime() - new Date(b.occurredAtIso).getTime(),
  )

  return (
    <div className="relative pl-0" role="list" aria-label="Evidence timeline">
      {sorted.map((entry) => (
        <div key={entry.evidenceId} role="listitem">
          <TimelineEntry entry={entry} />
        </div>
      ))}
    </div>
  )
}
