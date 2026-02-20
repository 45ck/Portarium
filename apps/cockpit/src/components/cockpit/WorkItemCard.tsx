import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { WorkItemSummary } from '@portarium/cockpit-types'
import { SorRefPill } from './SorRefPill'

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short' }).format(
    new Date(isoString),
  )
}

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

export function WorkItemCard({ workItem }: { workItem: WorkItemSummary }) {
  const externalRefs = workItem.links?.externalRefs ?? []
  const runCount = workItem.links?.runIds?.length ?? 0
  const approvalCount = workItem.links?.approvalIds?.length ?? 0
  const evidenceCount = workItem.links?.evidenceIds?.length ?? 0
  const slaText = workItem.sla?.dueAtIso
    ? formatRelativeDate(workItem.sla.dueAtIso)
    : null
  const isOverdue = slaText?.startsWith('overdue')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{workItem.title}</CardTitle>
          <Badge variant={workItem.status === 'Open' ? 'ok' : 'muted'}>
            {workItem.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-2 text-xs text-[rgb(var(--muted))]">
          {workItem.ownerUserId && (
            <span>Owner: {workItem.ownerUserId}</span>
          )}
          {workItem.ownerUserId && ' \u00b7 '}
          Created {formatDate(workItem.createdAtIso)}
        </div>

        {externalRefs.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {externalRefs.map((ref) => (
              <SorRefPill key={`${ref.sorName}:${ref.externalId}`} ref_={ref} />
            ))}
          </div>
        )}

        {slaText && (
          <div className="mb-2">
            <Badge variant={isOverdue ? 'danger' : 'warn'}>
              {slaText}
            </Badge>
          </div>
        )}

        {(runCount > 0 || approvalCount > 0 || evidenceCount > 0) && (
          <div className="flex gap-3 text-xs text-[rgb(var(--muted))]">
            {runCount > 0 && <span>{runCount} run{runCount !== 1 ? 's' : ''}</span>}
            {approvalCount > 0 && (
              <span>{approvalCount} approval{approvalCount !== 1 ? 's' : ''}</span>
            )}
            {evidenceCount > 0 && (
              <span>{evidenceCount} evidence</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
