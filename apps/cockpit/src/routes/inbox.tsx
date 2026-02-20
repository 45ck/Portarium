import { createRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Route as rootRoute } from './__root'
import { useUIStore } from '@/stores/ui-store'
import { useApprovals } from '@/hooks/queries/use-approvals'
import { useRuns } from '@/hooks/queries/use-runs'
import { PageHeader } from '@/components/cockpit/page-header'
import { EntityIcon } from '@/components/domain/entity-icon'
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge'
import { RunStatusBadge } from '@/components/cockpit/run-status-badge'
import { SystemStateBanner } from '@/components/cockpit/system-state-banner'
import { KpiRow } from '@/components/cockpit/kpi-row'
import { Button } from '@/components/ui/button'
import type { ApprovalSummary, RunSummary } from '@portarium/cockpit-types'
import { CheckSquare, AlertCircle, ShieldAlert, Clock } from 'lucide-react'

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-primary/10 text-primary text-[10px] px-2 py-0.5 font-medium">
          {count}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pending approval rows
// ---------------------------------------------------------------------------
function PendingApprovalRow({ approval, onClick }: { approval: ApprovalSummary; onClick: () => void }) {
  const isOverdue = approval.dueAtIso && new Date(approval.dueAtIso) < new Date()
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-3 py-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
    >
      <CheckSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm truncate">{approval.prompt}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{approval.approvalId}</span>
          {approval.assigneeUserId && <span>Assignee: {approval.assigneeUserId}</span>}
          {approval.dueAtIso && (
            <span className={isOverdue ? 'text-red-600 font-medium' : undefined}>
              <Clock className="inline h-3 w-3 mr-0.5" />
              Due {format(new Date(approval.dueAtIso), 'MMM d, HH:mm')}
              {isOverdue ? ' — overdue' : ''}
            </span>
          )}
        </div>
      </div>
      <ApprovalStatusBadge status={approval.status} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Failed / blocked run rows
// ---------------------------------------------------------------------------
function BlockedRunRow({ run, onClick }: { run: RunSummary; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-3 py-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
    >
      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm truncate font-mono">{run.runId}</p>
        <p className="text-xs text-muted-foreground">
          Workflow: {run.workflowId} · Tier: {run.executionTier}
          {run.startedAtIso && ` · Started ${format(new Date(run.startedAtIso), 'MMM d, HH:mm')}`}
        </p>
      </div>
      <RunStatusBadge status={run.status} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Mock policy violations (in production these come from evidence/governance)
// ---------------------------------------------------------------------------
const MOCK_VIOLATIONS = [
  {
    id: 'pv-001',
    title: 'CRM dedup run exceeded write:external quota (run-2004)',
    severity: 'Medium',
    detectedAt: '2026-02-19T11:38:55Z',
  },
  {
    id: 'pv-002',
    title: 'IAM access change without SoD-compliant approver (wi-1005)',
    severity: 'High',
    detectedAt: '2026-02-17T14:30:00Z',
  },
]

function PolicyViolationRow({ violation }: { violation: typeof MOCK_VIOLATIONS[number] }) {
  const severityCls = violation.severity === 'High'
    ? 'bg-red-100 text-red-800 border-red-200'
    : 'bg-yellow-100 text-yellow-800 border-yellow-200'

  return (
    <div className="flex items-start gap-3 px-3 py-3 rounded-md border border-transparent hover:bg-muted/50 transition-colors">
      <ShieldAlert className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm">{violation.title}</p>
        <p className="text-xs text-muted-foreground">
          Detected {format(new Date(violation.detectedAt), 'MMM d, HH:mm')}
        </p>
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${severityCls}`}>
        {violation.severity}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inbox page
// ---------------------------------------------------------------------------
function InboxPage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const navigate = useNavigate()
  const { data: approvalsData, isLoading: approvalsLoading } = useApprovals(wsId)
  const { data: runsData, isLoading: runsLoading } = useRuns(wsId)

  const pendingApprovals = (approvalsData?.items ?? []).filter((a) => a.status === 'Pending')
  const blockedRuns = (runsData?.items ?? []).filter(
    (r) => r.status === 'Failed' || r.status === 'WaitingForApproval' || r.status === 'Paused',
  )

  const totalItems = pendingApprovals.length + blockedRuns.length + MOCK_VIOLATIONS.length

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Inbox"
        description="Your workspace triage surface — approvals, blocked runs, and policy alerts"
        icon={<EntityIcon entityType="queue" size="md" decorative />}
      />

      <SystemStateBanner state="healthy" />

      <KpiRow
        stats={[
          { label: 'Pending Approvals', value: approvalsLoading ? '—' : pendingApprovals.length },
          { label: 'Blocked Runs', value: runsLoading ? '—' : blockedRuns.length },
          { label: 'Policy Violations', value: MOCK_VIOLATIONS.length },
          { label: 'Total Actions', value: approvalsLoading || runsLoading ? '—' : totalItems },
        ]}
      />

      {/* Section 1: Pending approval gates */}
      <section>
        <SectionHeader
          icon={<CheckSquare className="h-4 w-4" />}
          title="Pending Approval Gates"
          count={pendingApprovals.length}
        />
        <div className="rounded-md border border-border divide-y divide-border">
          {approvalsLoading ? (
            <div className="p-4 text-sm text-muted-foreground animate-pulse">Loading…</div>
          ) : pendingApprovals.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground italic">No pending approvals.</div>
          ) : (
            pendingApprovals.map((a) => (
              <PendingApprovalRow
                key={a.approvalId}
                approval={a}
                onClick={() =>
                  navigate({
                    to: '/approvals/$approvalId' as string,
                    params: { approvalId: a.approvalId },
                  })
                }
              />
            ))
          )}
          {pendingApprovals.length > 0 && (
            <div className="px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => navigate({ to: '/approvals' as string })}
              >
                Open triage view →
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Failed / blocked runs */}
      <section>
        <SectionHeader
          icon={<AlertCircle className="h-4 w-4" />}
          title="Failed & Blocked Runs"
          count={blockedRuns.length}
        />
        <div className="rounded-md border border-border divide-y divide-border">
          {runsLoading ? (
            <div className="p-4 text-sm text-muted-foreground animate-pulse">Loading…</div>
          ) : blockedRuns.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground italic">No failed or blocked runs.</div>
          ) : (
            blockedRuns.map((r) => (
              <BlockedRunRow
                key={r.runId}
                run={r}
                onClick={() =>
                  navigate({
                    to: '/runs/$runId' as string,
                    params: { runId: r.runId },
                  })
                }
              />
            ))
          )}
        </div>
      </section>

      {/* Section 3: Policy violations */}
      <section>
        <SectionHeader
          icon={<ShieldAlert className="h-4 w-4" />}
          title="Policy Violations"
          count={MOCK_VIOLATIONS.length}
        />
        <div className="rounded-md border border-border divide-y divide-border">
          {MOCK_VIOLATIONS.map((v) => (
            <PolicyViolationRow key={v.id} violation={v} />
          ))}
        </div>
      </section>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  component: InboxPage,
})
