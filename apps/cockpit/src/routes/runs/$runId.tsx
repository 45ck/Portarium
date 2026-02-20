import { useState } from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useRun } from '@/hooks/queries/use-runs';
import { useWorkItems } from '@/hooks/queries/use-work-items';
import { useApprovals, useApprovalDecision } from '@/hooks/queries/use-approvals';
import { usePlan } from '@/hooks/queries/use-plan';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { useAgents } from '@/hooks/queries/use-agents';
import { useWorkforceMembers } from '@/hooks/queries/use-workforce';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { ChainIntegrityBanner } from '@/components/cockpit/chain-integrity-banner';
import { StepList } from '@/components/cockpit/step-list';
import { EffectsList } from '@/components/cockpit/effects-list';
import { EvidenceTimeline } from '@/components/cockpit/evidence-timeline';
import { ApprovalGatePanel } from '@/components/cockpit/approval-gate-panel';
import { RelatedEntities } from '@/components/cockpit/related-entities';
import type { RelatedEntity } from '@/components/cockpit/related-entities';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { RunStatus } from '@portarium/cockpit-types';
import type { Step } from '@/components/cockpit/step-list';

function deriveSteps(status: RunStatus): Step[] {
  const base: Array<{ stepId: string; name: string }> = [
    { stepId: 'step-init', name: 'Initialize' },
    { stepId: 'step-exec', name: 'Execute' },
    { stepId: 'step-finalize', name: 'Finalize' },
  ];

  switch (status) {
    case 'Pending':
      return base.map((s) => ({ ...s, status: 'pending' as const }));
    case 'Running':
      return [
        { ...base[0]!, status: 'succeeded' as const },
        { ...base[1]!, status: 'running' as const },
        { ...base[2]!, status: 'pending' as const },
      ];
    case 'WaitingForApproval':
    case 'Paused':
      return [
        { ...base[0]!, status: 'succeeded' as const },
        { ...base[1]!, status: 'running' as const },
        { ...base[2]!, status: 'pending' as const },
      ];
    case 'Succeeded':
      return base.map((s) => ({ ...s, status: 'succeeded' as const }));
    case 'Failed':
      return [
        { ...base[0]!, status: 'succeeded' as const },
        { ...base[1]!, status: 'failed' as const },
        { ...base[2]!, status: 'skipped' as const },
      ];
    case 'Cancelled':
      return [
        { ...base[0]!, status: 'succeeded' as const },
        { ...base[1]!, status: 'skipped' as const },
        { ...base[2]!, status: 'skipped' as const },
      ];
  }
}

function RunDetailPage() {
  const { runId } = Route.useParams();
  const { activeWorkspaceId: wsId } = useUIStore();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const qc = useQueryClient();

  const { data: run, isLoading: runLoading, isError: runError } = useRun(wsId, runId);

  const cancelRun = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/workspaces/${wsId}/runs/${runId}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to cancel run');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runs', wsId] });
      qc.invalidateQueries({ queryKey: ['runs', wsId, runId] });
      setCancelDialogOpen(false);
    },
  });
  const workItems = useWorkItems(wsId);
  const approvals = useApprovals(wsId);
  const evidence = useEvidence(wsId);
  const { data: agentsData } = useAgents(wsId);
  const { data: workforceData } = useWorkforceMembers(wsId);

  const pendingApproval = (approvals.data?.items ?? []).find(
    (a) => a.runId === runId && a.status === 'Pending',
  );

  const planId = (approvals.data?.items ?? []).find((a) => a.runId === runId)?.planId;
  const { data: plan } = usePlan(wsId, planId);

  const approvalDecision = useApprovalDecision(wsId, pendingApproval?.approvalId ?? '');

  const evidenceForRun = (evidence.data?.items ?? []).filter((e) => e.links?.runId === runId);

  if (runLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (runError || !run) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Run Not Found"
          icon={<EntityIcon entityType="run" size="md" decorative />}
        />
        <p className="text-sm text-muted-foreground">The run could not be loaded.</p>
        <Link to={'/runs' as string}>
          <Button variant="outline" size="sm">
            Back to Runs
          </Button>
        </Link>
      </div>
    );
  }

  const steps = deriveSteps(run.status);

  const agents = agentsData?.items ?? [];
  const workforceMembers = workforceData?.items ?? [];
  const allApprovals = approvals.data?.items ?? [];
  const runApprovals = allApprovals.filter((a) => a.runId === runId);

  // Find linked work item
  const linkedWorkItem = (workItems.data?.items ?? []).find((wi) =>
    wi.links?.runIds?.includes(runId),
  );

  const relatedEntities: RelatedEntity[] = [];

  if (linkedWorkItem) {
    relatedEntities.push({
      type: 'workitem',
      id: linkedWorkItem.workItemId,
      label: linkedWorkItem.title,
      href: `/work-items/${linkedWorkItem.workItemId}`,
      badge: linkedWorkItem.status,
    });
  }

  relatedEntities.push({
    type: 'workflow',
    id: run.workflowId,
    label: run.workflowId,
    href: `/workflows/${run.workflowId}`,
  });

  for (const agentId of run.agentIds ?? []) {
    const agent = agents.find((a) => a.agentId === agentId);
    relatedEntities.push({
      type: 'agent',
      id: agentId,
      label: agent?.name ?? agentId,
      href: `/config/agents/${agentId}`,
    });
  }

  for (const robotId of run.robotIds ?? []) {
    relatedEntities.push({
      type: 'robot',
      id: robotId,
      label: robotId,
      href: '/robotics/robots',
    });
  }

  for (const memberId of run.workforceMemberIds ?? []) {
    const member = workforceMembers.find((m) => m.workforceMemberId === memberId);
    relatedEntities.push({
      type: 'workforce',
      id: memberId,
      label: member?.displayName ?? memberId,
      href: `/workforce/${memberId}`,
      badge: member?.availabilityStatus,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`Run: ${runId}`}
        icon={<EntityIcon entityType="run" size="md" decorative />}
        breadcrumb={[{ label: 'Runs', to: '/runs' }, { label: runId }]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <RunStatusBadge status={run.status} />
        <ExecutionTierBadge tier={run.executionTier} />
        {(run.status === 'Running' || run.status === 'WaitingForApproval' || run.status === 'Paused') && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setCancelDialogOpen(true)}
            disabled={cancelRun.isPending}
          >
            Cancel Run
          </Button>
        )}
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel run {runId}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelRun.isPending}>Keep Running</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelRun.isPending}
              onClick={(e) => {
                e.preventDefault();
                cancelRun.mutate();
              }}
            >
              {cancelRun.isPending ? 'Cancelling...' : 'Confirm Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChainIntegrityBanner status={evidence.isLoading ? 'pending' : 'verified'} />

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
                <StepList
                  steps={steps}
                  currentStep={steps.find((s) => s.status === 'running')?.stepId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="effects">
            <Card className="shadow-none mt-2">
              <CardContent className="pt-4">
                <EffectsList planned={plan?.plannedEffects ?? []} predicted={plan?.predictedEffects} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidence">
            <Card className="shadow-none mt-2">
              <CardContent className="pt-4">
                <EvidenceTimeline entries={evidenceForRun} loading={evidence.isLoading} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {run.status === 'WaitingForApproval' && pendingApproval && (
          <div className="lg:sticky lg:top-6 self-start">
            <ApprovalGatePanel
              approval={pendingApproval}
              onDecide={(decision, rationale) => approvalDecision.mutate({ decision, rationale }, {
                onSuccess: () => toast.success('Decision submitted'),
                onError: () => toast.error('Failed to submit decision'),
              })}
              loading={approvalDecision.isPending}
            />
          </div>
        )}
      </div>

      {runApprovals.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {runApprovals.map((a) => (
              <Link
                key={a.approvalId}
                to={'/approvals/$approvalId' as string}
                params={{ approvalId: a.approvalId }}
                className="flex items-start justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate">{a.prompt}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{a.approvalId}</p>
                </div>
                <ApprovalStatusBadge status={a.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <RelatedEntities entities={relatedEntities} />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs/$runId',
  component: RunDetailPage,
});
