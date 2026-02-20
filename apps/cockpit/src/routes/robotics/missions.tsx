import { useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { isToday, format } from 'date-fns'
import { toast } from 'sonner'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useMissions, useCancelMission, usePreemptMission, useRetryMission } from '@/hooks/queries/use-missions'
import { PageHeader } from '@/components/cockpit/page-header'
import { DataTable } from '@/components/cockpit/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { MissionSummary } from '@/types/robotics'
import { Map, Circle, RotateCcw, CheckCircle2, XCircle, OctagonX } from 'lucide-react'

function MissionStatusBadge({ status }: { status: MissionSummary['status'] }) {
  const config: Record<MissionSummary['status'], { label: string; icon: React.ReactNode; className: string }> = {
    Pending: { label: 'Pending', icon: <Circle className="h-3 w-3" />, className: 'bg-muted text-muted-foreground border-border' },
    Executing: { label: 'Executing', icon: <RotateCcw className="h-3 w-3 animate-spin" />, className: 'bg-blue-100 text-blue-800 border-blue-200' },
    Completed: { label: 'Completed', icon: <CheckCircle2 className="h-3 w-3" />, className: 'bg-green-100 text-green-800 border-green-200' },
    Failed: { label: 'Failed', icon: <XCircle className="h-3 w-3" />, className: 'bg-red-100 text-red-800 border-red-200' },
    Cancelled: { label: 'Cancelled', icon: <OctagonX className="h-3 w-3" />, className: 'bg-red-100 text-red-800 border-red-200' },
  }
  const c = config[status]
  return <Badge variant="outline" className={cn('flex items-center gap-1 text-[11px]', c.className)} aria-label={status}>{c.icon}{c.label}</Badge>
}

function MissionDetailSheet({
  mission,
  open,
  onClose,
  onCancel,
  onPreempt,
  onRetry,
}: {
  mission: MissionSummary | null
  open: boolean
  onClose: () => void
  onCancel: (id: string) => void
  onPreempt: (id: string) => void
  onRetry: (id: string) => void
}) {
  const [confirmAction, setConfirmAction] = useState<'preempt' | 'cancel' | null>(null)
  if (!mission) return null
  const isTerminal = ['Completed', 'Failed', 'Cancelled'].includes(mission.status)
  const activeIdx = mission.status === 'Pending' ? 0 : mission.status === 'Executing' ? 2 : 3
  const terminalLabel = mission.status === 'Completed' ? 'Succeeded' : mission.status === 'Failed' ? 'Failed' : 'Cancelled'
  const TIMELINE = ['Pending', 'Dispatched', 'Executing', terminalLabel]

  function handleConfirm() {
    if (!mission) return
    if (confirmAction === 'cancel') onCancel(mission.missionId)
    else if (confirmAction === 'preempt') onPreempt(mission.missionId)
    setConfirmAction(null)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Map className="h-4 w-4" />{mission.missionId}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Details</h3>
            <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Goal</dt><dd>{mission.goal}</dd>
              <dt className="text-muted-foreground">Robot</dt><dd className="font-mono text-xs">{mission.robotId}</dd>
              <dt className="text-muted-foreground">Action type</dt><dd>{mission.actionType}</dd>
              <dt className="text-muted-foreground">Priority</dt><dd>{mission.priority}</dd>
              <dt className="text-muted-foreground">Tier</dt><dd>{mission.executionTier}</dd>
              <dt className="text-muted-foreground">Status</dt><dd><MissionStatusBadge status={mission.status} /></dd>
              {mission.dispatchedAtIso && <><dt className="text-muted-foreground">Dispatched</dt><dd>{format(new Date(mission.dispatchedAtIso), 'HH:mm:ss')}</dd></>}
              {mission.completedAtIso && <><dt className="text-muted-foreground">Completed</dt><dd>{format(new Date(mission.completedAtIso), 'HH:mm:ss')}</dd></>}
            </dl>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Execution Timeline</h3>
            <ol className="relative border-l border-border ml-2 space-y-4 pl-4">
              {TIMELINE.map((label, idx) => (
                <li key={label} className="flex items-center gap-3">
                  <div className={cn('absolute -left-1.5 h-3 w-3 rounded-full border-2',
                    idx < activeIdx ? 'bg-green-500 border-green-500' :
                    idx === activeIdx ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/30')} />
                  <span className={cn('text-sm', idx <= activeIdx ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                </li>
              ))}
            </ol>
          </section>
          {!isTerminal && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Actions</h3>
              {confirmAction ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-3">
                  <p className="text-sm font-medium text-destructive">Confirm {confirmAction === 'preempt' ? 'Pre-empt' : 'Cancel'} {mission.missionId}?</p>
                  <p className="text-xs text-muted-foreground">This action will be logged in the evidence chain.</p>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" className="flex-1" onClick={handleConfirm}>Confirm</Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmAction(null)}>Go back</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {mission.status === 'Executing' && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmAction('preempt')} aria-label={`Pre-empt mission ${mission.missionId}`}>Pre-empt</Button>
                  )}
                  <Button variant="destructive" size="sm" className="flex-1" onClick={() => setConfirmAction('cancel')} aria-label={`Cancel mission ${mission.missionId}`}>Cancel</Button>
                </div>
              )}
            </section>
          )}
          {mission.status === 'Failed' && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => { onRetry(mission.missionId); onClose() }}>
              Retry Mission
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MissionsPage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const { data, isLoading } = useMissions(wsId)
  const cancelMission = useCancelMission(wsId)
  const preemptMission = usePreemptMission(wsId)
  const retryMission = useRetryMission(wsId)
  const [selectedMission, setSelectedMission] = useState<MissionSummary | null>(null)
  const missionsList = data?.items ?? []
  const stats = {
    active: missionsList.filter((m) => m.status === 'Executing').length,
    pending: missionsList.filter((m) => m.status === 'Pending').length,
    completedToday: missionsList.filter(
      (m) => m.status === 'Completed' && m.completedAtIso && isToday(new Date(m.completedAtIso)),
    ).length,
    failed: missionsList.filter((m) => m.status === 'Failed').length,
  }

  function handleCancel(missionId: string) {
    cancelMission.mutate(missionId, { onSuccess: () => toast.success(`Mission ${missionId} cancelled`) })
  }
  function handlePreempt(missionId: string) {
    preemptMission.mutate(missionId, { onSuccess: () => toast.success(`Mission ${missionId} pre-empted`) })
  }
  function handleRetry(missionId: string) {
    retryMission.mutate(missionId, { onSuccess: () => toast.success(`Mission ${missionId} queued for retry`) })
  }

  const columns = [
    { key: 'missionId', header: 'ID', width: '110px', render: (row: MissionSummary) => <span className="font-mono text-xs">{row.missionId}</span> },
    { key: 'robotId', header: 'Robot', width: '110px', render: (row: MissionSummary) => <span className="font-mono text-xs">{row.robotId}</span> },
    { key: 'goal', header: 'Goal', render: (row: MissionSummary) => <span className="truncate block max-w-[200px]">{row.goal}</span> },
    { key: 'status', header: 'Status', width: '120px', render: (row: MissionSummary) => <MissionStatusBadge status={row.status} /> },
    { key: 'dispatchedAtIso', header: 'Dispatched', width: '100px', render: (row: MissionSummary) => row.dispatchedAtIso ? format(new Date(row.dispatchedAtIso), 'HH:mm') : '—' },
    {
      key: 'actions', header: '', width: '90px',
      render: (row: MissionSummary) => {
        if (row.status === 'Executing') return <Button variant="outline" size="sm" className="h-6 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedMission(row) }}>Pre-empt</Button>
        if (row.status === 'Failed') return <Button variant="outline" size="sm" className="h-6 text-xs" onClick={(e) => { e.stopPropagation(); handleRetry(row.missionId) }}>Retry</Button>
        if (row.status === 'Pending') return <Button variant="outline" size="sm" className="h-6 text-xs text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setSelectedMission(row) }}>Cancel</Button>
        return null
      },
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Missions" description="Robot mission dispatch and monitoring" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active', value: isLoading ? '—' : stats.active },
          { label: 'Pending', value: isLoading ? '—' : stats.pending },
          { label: 'Done Today', value: isLoading ? '—' : stats.completedToday },
          { label: 'Failed', value: isLoading ? '—' : stats.failed },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>
      <DataTable columns={columns} data={missionsList} loading={isLoading} getRowKey={(row) => row.missionId} onRowClick={setSelectedMission} pagination={{ pageSize: 20 }} />
      <MissionDetailSheet
        mission={selectedMission}
        open={selectedMission !== null}
        onClose={() => setSelectedMission(null)}
        onCancel={handleCancel}
        onPreempt={handlePreempt}
        onRetry={handleRetry}
      />
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/missions',
  component: MissionsPage,
})
