import { createRoute } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useWorkforceMembers } from '@/hooks/queries/use-workforce'
import { PageHeader } from '@/components/cockpit/page-header'
import { EmptyState } from '@/components/cockpit/empty-state'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'

const statusColor: Record<string, string> = {
  available: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  busy: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950',
  offline: 'text-muted-foreground bg-muted',
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function WorkforceMemberDetailPage() {
  const { memberId } = Route.useParams()
  const { activeWorkspaceId: wsId } = useUIStore()
  const { data, isLoading } = useWorkforceMembers(wsId)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const member = (data?.items ?? []).find((m) => m.workforceMemberId === memberId)

  if (!member) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Member not found"
          breadcrumb={[{ label: 'Workforce', to: '/workforce' }]}
        />
        <EmptyState
          title="Member not found"
          description="The workforce member you are looking for does not exist or has been removed."
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={member.displayName}
        breadcrumb={[
          { label: 'Workforce', to: '/workforce' },
          { label: member.displayName },
        ]}
      />

      <Card className="shadow-none">
        <CardHeader className="pb-2" />
        <CardContent className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-sm">{initials(member.displayName)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">{member.displayName}</h2>
            <p className="text-xs text-muted-foreground">{member.linkedUserId}</p>
            <Badge variant="secondary" className={statusColor[member.availabilityStatus]}>
              {member.availabilityStatus}
            </Badge>
            <p className="text-xs text-muted-foreground">
              Joined: {format(new Date(member.createdAtIso), 'MMM d, yyyy')}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Capabilities</h3>
        <div className="flex flex-wrap gap-1.5">
          {member.capabilities.map((cap) => (
            <Badge key={cap} variant="secondary">
              {cap}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Queue Memberships</h3>
        <div className="flex flex-wrap gap-1.5">
          {member.queueMemberships.length === 0 ? (
            <p className="text-xs text-muted-foreground">No queue memberships</p>
          ) : (
            member.queueMemberships.map((queueId) => (
              <Badge key={queueId} variant="outline">
                {queueId}
              </Badge>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workforce/$memberId',
  component: WorkforceMemberDetailPage,
})
