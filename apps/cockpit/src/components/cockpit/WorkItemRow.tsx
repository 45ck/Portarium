import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WorkItemSummary } from '@portarium/cockpit-types'
import { SorRefPill } from './SorRefPill'

function formatRelativeDate(isoString: string): string {
  const now = new Date()
  const date = new Date(isoString)
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < -1) return `overdue by ${Math.abs(diffDays)} days`
  if (diffDays === -1) return 'overdue by 1 day'
  if (diffDays === 0) return 'due today'
  if (diffDays === 1) return 'due in 1 day'
  return `due in ${diffDays} days`
}

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short' }).format(
    new Date(isoString),
  )
}

export function WorkItemRow({
  workItem,
  onOpen,
}: {
  workItem: WorkItemSummary
  onOpen: () => void
}) {
  const slaText = workItem.sla?.dueAtIso
    ? formatRelativeDate(workItem.sla.dueAtIso)
    : null
  const isOverdue = slaText?.startsWith('overdue')
  const externalRefs = (workItem.links?.externalRefs ?? []).slice(0, 2)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="flex cursor-pointer items-center justify-between rounded-[var(--radius)] border-2 border-[rgb(var(--border))] bg-white p-3 shadow-[var(--shadow-card)] transition-colors hover:bg-gray-50"
    >
      <div className="min-w-0 flex-1">
        <div className="font-black">{workItem.title}</div>
        <div className="text-xs text-[rgb(var(--muted))]">
          {workItem.ownerUserId && <span>{workItem.ownerUserId}</span>}
          {workItem.ownerUserId && ' \u00b7 '}
          <span>{formatDate(workItem.createdAtIso)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {slaText && (
          <Badge variant={isOverdue ? 'danger' : 'warn'}>
            {slaText}
          </Badge>
        )}
        <Badge variant={workItem.status === 'Open' ? 'ok' : 'muted'}>
          {workItem.status}
        </Badge>
        {externalRefs.map((ref) => (
          <SorRefPill key={`${ref.sorName}:${ref.externalId}`} ref_={ref} />
        ))}
      </div>
    </div>
  )
}
