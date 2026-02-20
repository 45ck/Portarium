import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useState } from 'react'
import type {
  ApprovalDecision,
  ApprovalSummary,
  EvidenceEntry,
  RunSummary,
  WorkItemSummary,
} from '@portarium/cockpit-types'
import { AppShell } from '@/components/cockpit/AppShell'
import { ApprovalGatePanel } from '@/components/cockpit/ApprovalGatePanel'
import { ChainIntegrityBanner } from '@/components/cockpit/ChainIntegrityBanner'
import { EmptyState } from '@/components/cockpit/EmptyState'
import { EvidenceTimeline } from '@/components/cockpit/EvidenceTimeline'
import { FilterBar } from '@/components/cockpit/FilterBar'
import { KpiStat } from '@/components/cockpit/KpiStat'
import { RunStatusBadge } from '@/components/cockpit/RunStatusBadge'
import { StatusBar } from '@/components/cockpit/StatusBar'
import { TopBar } from '@/components/cockpit/TopBar'
import { WorkItemRow } from '@/components/cockpit/WorkItemRow'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import './index.css'

const WORKSPACE_ID = 'ws-demo'

type CockpitDataset = {
  workItems: WorkItemSummary[]
  runs: RunSummary[]
  approvals: ApprovalSummary[]
  evidence: EvidenceEntry[]
}

const emptyDataset: CockpitDataset = {
  workItems: [],
  runs: [],
  approvals: [],
  evidence: [],
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

async function loadDataset(workspaceId: string): Promise<CockpitDataset> {
  const [workItemsRes, runsRes, approvalsRes, evidenceRes] = await Promise.all([
    fetchJson<{ items: WorkItemSummary[] }>(`/v1/workspaces/${workspaceId}/work-items`),
    fetchJson<{ items: RunSummary[] }>(`/v1/workspaces/${workspaceId}/runs`),
    fetchJson<{ items: ApprovalSummary[] }>(`/v1/workspaces/${workspaceId}/approvals`),
    fetchJson<{ items: EvidenceEntry[] }>(`/v1/workspaces/${workspaceId}/evidence`),
  ])
  return {
    workItems: workItemsRes.items,
    runs: runsRes.items,
    approvals: approvalsRes.items,
    evidence: evidenceRes.items,
  }
}

function appendAuditEvent(
  existing: EvidenceEntry[],
  decision: ApprovalDecision,
  approval: ApprovalSummary,
): EvidenceEntry[] {
  const previous = existing[existing.length - 1]
  const statusText =
    decision === 'Approved'
      ? 'Approved'
      : decision === 'Denied'
        ? 'Denied'
        : 'Request changes'

  const event: EvidenceEntry = {
    schemaVersion: 1,
    evidenceId: `evd-demo-${Date.now()}`,
    workspaceId: approval.workspaceId,
    occurredAtIso: new Date().toISOString(),
    category: 'Approval',
    summary: `Approval ${approval.approvalId} decision recorded: ${statusText}`,
    actor: { kind: 'User', userId: 'user-approver-dana' },
    links: {
      runId: approval.runId,
      workItemId: approval.workItemId,
      planId: approval.planId,
    },
    previousHash: previous?.hashSha256,
    hashSha256: `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  }
  return [...existing, event]
}

function mapWorkItemStatusFromDecision(
  currentStatus: WorkItemSummary['status'],
  decision: ApprovalDecision,
): WorkItemSummary['status'] {
  if (decision === 'Denied') {
    return 'Closed'
  }
  return currentStatus
}

function mapRunStatusFromDecision(decision: ApprovalDecision): RunSummary['status'] {
  if (decision === 'Approved') {
    return 'Running'
  }
  if (decision === 'Denied') {
    return 'Failed'
  }
  return 'Paused'
}

function CockpitDemoApp() {
  const [dataset, setDataset] = useState<CockpitDataset>(emptyDataset)
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null)
  const [activeFilters, setActiveFilters] = useState<string[]>(['open'])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const next = await loadDataset(WORKSPACE_ID)
      setDataset(next)
      setSelectedWorkItemId((current) => current ?? next.workItems[0]?.workItemId ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load demo data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const selectedWorkItem = useMemo(
    () => dataset.workItems.find((item) => item.workItemId === selectedWorkItemId) ?? null,
    [dataset.workItems, selectedWorkItemId],
  )

  const selectedRun = useMemo(() => {
    const runId = selectedWorkItem?.links?.runIds?.[0]
    if (!runId) {
      return null
    }
    return dataset.runs.find((run) => run.runId === runId) ?? null
  }, [dataset.runs, selectedWorkItem])

  const selectedApproval = useMemo(() => {
    if (selectedRun) {
      return (
        dataset.approvals.find(
          (approval) => approval.runId === selectedRun.runId && approval.status === 'Pending',
        ) ?? null
      )
    }
    return (
      dataset.approvals.find(
        (approval) =>
          approval.workItemId === selectedWorkItem?.workItemId && approval.status === 'Pending',
      ) ?? null
    )
  }, [dataset.approvals, selectedRun, selectedWorkItem])

  const selectedEvidence = useMemo(() => {
    const runId = selectedRun?.runId
    if (!runId) {
      return dataset.evidence
    }
    return dataset.evidence.filter((entry) => entry.links?.runId === runId)
  }, [dataset.evidence, selectedRun])

  const filteredWorkItems = useMemo(() => {
    if (activeFilters.length === 0) {
      return dataset.workItems
    }
    return dataset.workItems.filter((item) => {
      const approvalPending = (item.links?.approvalIds?.length ?? 0) > 0
      if (activeFilters.includes('open') && item.status === 'Open') {
        return true
      }
      if (activeFilters.includes('closed') && item.status === 'Closed') {
        return true
      }
      if (activeFilters.includes('approval') && approvalPending) {
        return true
      }
      return false
    })
  }, [activeFilters, dataset.workItems])

  const pendingApprovals = dataset.approvals.filter((approval) => approval.status === 'Pending')
  const activeRuns = dataset.runs.filter((run) =>
    ['Pending', 'Running', 'WaitingForApproval', 'Paused'].includes(run.status),
  )

  const handleToggleFilter = (id: string) => {
    setActiveFilters((current) =>
      current.includes(id) ? current.filter((filterId) => filterId !== id) : [...current, id],
    )
  }

  const handleDecision = async (decision: ApprovalDecision, rationale: string) => {
    if (!selectedApproval) {
      return
    }
    const response = await fetch(
      `/v1/workspaces/${WORKSPACE_ID}/approvals/${selectedApproval.approvalId}/decision`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, rationale }),
      },
    )
    if (!response.ok) {
      throw new Error(`Decision failed: ${response.status}`)
    }
    const updatedApproval = (await response.json()) as ApprovalSummary

    setDataset((current) => {
      const approvals = current.approvals.map((approval) =>
        approval.approvalId === updatedApproval.approvalId ? updatedApproval : approval,
      )
      const runs = current.runs.map((run) => {
        if (run.runId !== updatedApproval.runId) {
          return run
        }
        if (decision === 'Denied') {
          return {
            ...run,
            status: mapRunStatusFromDecision(decision),
            endedAtIso: new Date().toISOString(),
          }
        }
        return { ...run, status: mapRunStatusFromDecision(decision) }
      })
      const workItems = current.workItems.map((item) => {
        if (item.workItemId !== updatedApproval.workItemId) {
          return item
        }
        return { ...item, status: mapWorkItemStatusFromDecision(item.status, decision) }
      })
      return {
        workItems,
        runs,
        approvals,
        evidence: appendAuditEvent(current.evidence, decision, updatedApproval),
      }
    })
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[rgb(var(--background))] p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Demo failed to load</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[rgb(var(--muted))]">{error}</p>
            <Button onClick={() => void load()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <AppShell
      topbar={<TopBar workspaceId={WORKSPACE_ID} personaLabel="Demo Mode" />}
      statusbar={
        <StatusBar
          runCount={activeRuns.length}
          chainStatus="verified"
          streamStatus="live"
        />
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border-2 border-[rgb(var(--border))] bg-white p-3 shadow-[var(--shadow-card)]">
          <div>
            <p className="text-sm font-black">Cockpit demo (fixture-backed)</p>
            <p className="text-xs text-[rgb(var(--muted))]">
              Decisions mutate local state and append audit events.
            </p>
          </div>
          <Button onClick={() => void load()} disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Reset demo'}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <KpiStat label="Work items" value={dataset.workItems.length} />
          <KpiStat label="Active runs" value={activeRuns.length} status="warn" />
          <KpiStat label="Pending approvals" value={pendingApprovals.length} status="warn" />
          <KpiStat label="Evidence entries" value={dataset.evidence.length} status="ok" />
        </div>

        <ChainIntegrityBanner status="verified" />

        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FilterBar
              filters={[
                { id: 'open', label: 'Open' },
                { id: 'approval', label: 'Needs approval' },
                { id: 'closed', label: 'Closed' },
              ]}
              active={activeFilters}
              onToggle={handleToggleFilter}
            />
            <div className="space-y-2">
              {filteredWorkItems.length === 0 ? (
                <EmptyState
                  title="No matching work items"
                  description="Adjust filters or reset the demo dataset."
                />
              ) : (
                filteredWorkItems.map((workItem) => (
                  <WorkItemRow
                    key={workItem.workItemId}
                    workItem={workItem}
                    onOpen={() => setSelectedWorkItemId(workItem.workItemId)}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {selectedWorkItem ? (
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{selectedWorkItem.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase text-[rgb(var(--muted))]">Run status</span>
                  {selectedRun ? (
                    <RunStatusBadge status={selectedRun.status} />
                  ) : (
                    <span className="text-sm text-[rgb(var(--muted))]">No run linked</span>
                  )}
                </div>

                <div className="rounded-[var(--radius-sm)] border-2 border-[rgb(var(--border))] p-3">
                  <p className="text-xs uppercase text-[rgb(var(--muted))]">Narrative</p>
                  <p className="mt-1 text-sm">
                    Queue item {selectedWorkItem.workItemId} links to run{' '}
                    {selectedRun?.runId ?? 'n/a'}, approval gate{' '}
                    {selectedApproval?.approvalId ?? 'none'}, and evidence chain entries.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase text-[rgb(var(--muted))]">Evidence</p>
                  <EvidenceTimeline entries={selectedEvidence} />
                </div>
              </CardContent>
            </Card>

            <div>
              {selectedApproval ? (
                <ApprovalGatePanel approval={selectedApproval} onDecide={(d, r) => void handleDecision(d, r)} />
              ) : (
                <EmptyState
                  title="No pending approval"
                  description="This work item currently has no approval gate requiring action."
                />
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="No work item selected" description="Choose a work item from the queue." />
        )}
      </div>
    </AppShell>
  )
}

async function enableMocking() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser')
    return worker.start({ onUnhandledRequest: 'bypass' })
  }
}

enableMocking().then(() => {
  const root = document.getElementById('root')
  if (!root) throw new Error('Root element not found')
  createRoot(root).render(
    <StrictMode>
      <CockpitDemoApp />
    </StrictMode>,
  )
})
