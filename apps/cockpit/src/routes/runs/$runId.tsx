import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useRun } from '@/hooks/queries/use-runs'
import { useApprovals, useApprovalDecision } from '@/hooks/queries/use-approvals'
import { useEvidence } from '@/hooks/queries/use-evidence'
import { PageHeader } from '@/components/cockpit/page-header'
import { RunStatusBadge } from '@/components/cockpit/run-status-badge'
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge'
import { ChainIntegrityBanner } from '@/components/cockpit/chain-integrity-banner'
import { StepList } from '@/components/cockpit/step-list'
import { EffectsList } from '@/components/cockpit/effects-list'
import { EvidenceTimeline } from '@/components/cockpit/evidence-timeline'
import { ApprovalGatePanel } from '@/components/cockpit/approval-gate-panel'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { RunStatus } from '@portarium/cockpit-types'
import type { Step } from '@/components/cockpit/step-list'

function deriveSteps(status: RunStatus): Step[] {
  const base: Array<{ stepId: string; name: string }> = [
    { stepId: 'step-init', name: 'Initialize' },
    { stepId: 'step-exec', name: 'Execute' },
    { stepId: 'step-finalize', name: 'Finalize' },
  ]

  switch (status) {
    case 'Pending':
      return base.map((s) => ({ ...s, status: 'pending' as const }))
    case 'Running':
      return [
        { ...base[0]!, status: 'succeeded' as const },
        { ...base[1]!, status: 'running' as const },
        { ...base[2]!, status: 'pending' as const },
      ]
    case 'WaitingForApproval':
    case 'Paused':
      return [
        { ...base[0]!, status: 'succeeded' as const },
        { ...base[1]!, status: 'running' as const },
        { ...base[2]!, status: 'pending' as const },
      ]
    case 'Succeeded':
      return base.map((s) => ({ ...s, status: 'succeeded' as const }))
    case 'Failed':
      return [
        { ...base[0]!, status: 'succeeded' as const },
        { ...base[1]!, status: 'failed' as const },
        { ...base[2]!, status: 'skipped' as const },
      ]
    case 'Cancelled':
      return [
        { ...base[0]!, status: 'succeeded' as const },
        { ...base[1]!, status: 'skipped' as const },
        { ...base[2]!, status: 'skipped' as const },
      ]
  }
}

function RunDetailPage() {
  const { runId } = Route.useParams()
  const { activeWorkspaceId: wsId } = useUIStore()

  const { data: run, isLoading: runLoading } = useRun(wsId, runId)
  const approvals = useApprovals(wsId)
  const evidence = useEvidence(wsId)

  const pendingApproval = (approvals.data?.items ?? []).find(
    (a) => a.runId === runId && a.status === 'Pending',
  )

  const approvalDecision = useApprovalDecision(
    wsId,
    pendingApproval?.approvalId ?? '',
  )

  const evidenceForRun = (evidence.data?.items ?? []).filter(
    (e) => e.links?.runId === runId,
  )

  if (runLoading || !run) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const steps = deriveSteps(run.status)

  const mockPlannedEffects = [
    {
      effectId: `eff-${run.workflowId}-1`,
      operation: 'Update' as const,
      target: {
        sorName: 'ServiceNow',
        portFamily: 'itsm',
        externalId: 'INC-001',
        externalType: 'incident',
      },
      summary: `Update incident status for workflow ${run.workflowId}`,
    },
    {
      effectId: `eff-${run.workflowId}-2`,
      operation: 'Create' as const,
      target: {
        sorName: 'Jira',
        portFamily: 'project',
        externalId: 'PROJ-100',
        externalType: 'issue',
      },
      summary: `Create follow-up issue for workflow ${run.workflowId}`,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`Run: ${runId}`}
        breadcrumb={[
          { label: 'Runs', to: '/runs' },
          { label: runId },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <RunStatusBadge status={run.status} />
        <ExecutionTierBadge tier={run.executionTier} />
      </div>

      <ChainIntegrityBanner status="verified" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <Tabs defaultValue="steps">
          <TabsList>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="effects">Effects</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
          </TabsList>

          <TabsContent value="steps">
            <Card className="shadow-none mt-2">
              <CardContent className="pt-4">
                <StepList steps={steps} currentStep={steps.find((s) => s.status === 'running')?.stepId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="effects">
            <Card className="shadow-none mt-2">
              <CardContent className="pt-4">
                <EffectsList planned={mockPlannedEffects} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidence">
            <Card className="shadow-none mt-2">
              <CardContent className="pt-4">
                <EvidenceTimeline
                  entries={evidenceForRun}
                  loading={evidence.isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {run.status === 'WaitingForApproval' && pendingApproval && (
          <div className="lg:sticky lg:top-6 self-start">
            <ApprovalGatePanel
              approval={pendingApproval}
              onDecide={(decision, rationale) =>
                approvalDecision.mutate({ decision, rationale })
              }
              loading={approvalDecision.isPending}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs/$runId',
  component: RunDetailPage,
})
