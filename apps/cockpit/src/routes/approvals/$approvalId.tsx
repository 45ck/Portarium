import { createRoute, Link } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useApproval, useApprovalDecision } from '@/hooks/queries/use-approvals';
import { useRuns } from '@/hooks/queries/use-runs';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { usePlan } from '@/hooks/queries/use-plan';
import { useAgents } from '@/hooks/queries/use-agents';
import { useWorkforceMembers } from '@/hooks/queries/use-workforce';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { ApprovalGatePanel } from '@/components/cockpit/approval-gate-panel';
import { EffectsList } from '@/components/cockpit/effects-list';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { EvidenceTimeline } from '@/components/cockpit/evidence-timeline';
import { RelatedEntities } from '@/components/cockpit/related-entities';
import type { RelatedEntity } from '@/components/cockpit/related-entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { ApprovalStatus } from '@portarium/cockpit-types';

function ApprovalDetailPage() {
  const { approvalId } = Route.useParams();
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data: approval, isLoading: approvalLoading, isError } = useApproval(wsId, approvalId);
  const mutation = useApprovalDecision(wsId, approvalId);
  const { data: runsData } = useRuns(wsId);
  const { data: evidenceData, isLoading: evidenceLoading } = useEvidence(wsId);
  const { data: plan, isLoading: planLoading } = usePlan(wsId, approval?.planId);
  const { data: agentsData } = useAgents(wsId);
  const { data: workforceData } = useWorkforceMembers(wsId);

  const handleDecide = (decision: 'Approved' | 'Denied' | 'RequestChanges', rationale: string) => {
    mutation.mutate({ decision, rationale });
  };

  if (approvalLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (isError || !approval) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Approval Not Found"
          icon={<EntityIcon entityType="approval" size="md" decorative />}
        />
        <p className="text-sm text-muted-foreground">The approval request could not be loaded.</p>
        <Link to={'/approvals' as string}>
          <Button variant="outline" size="sm">
            Back to Approvals
          </Button>
        </Link>
      </div>
    );
  }

  const linkedRun = runsData?.items.find((r) => r.runId === approval.runId);
  const relatedEvidence = (evidenceData?.items ?? []).filter(
    (e) => e.links?.runId === approval.runId,
  );

  const agents = agentsData?.items ?? [];
  const workforceMembers = workforceData?.items ?? [];

  const relatedEntities: RelatedEntity[] = [];

  if (linkedRun) {
    relatedEntities.push({
      type: 'run',
      id: linkedRun.runId,
      label: linkedRun.runId.slice(0, 12),
      href: `/runs/${linkedRun.runId}`,
      badge: linkedRun.status,
    });
  }

  if (approval.workItemId) {
    relatedEntities.push({
      type: 'workitem',
      id: approval.workItemId,
      label: approval.workItemId.slice(0, 12),
      href: `/work-items/${approval.workItemId}`,
    });
  }

  if (linkedRun) {
    relatedEntities.push({
      type: 'workflow',
      id: linkedRun.workflowId,
      label: linkedRun.workflowId,
    });

    for (const agentId of linkedRun.agentIds ?? []) {
      const agent = agents.find((a) => a.agentId === agentId);
      relatedEntities.push({
        type: 'agent',
        id: agentId,
        label: agent?.name ?? agentId,
        href: `/config/agents/${agentId}`,
      });
    }

    for (const robotId of linkedRun.robotIds ?? []) {
      relatedEntities.push({
        type: 'robot',
        id: robotId,
        label: robotId,
        href: '/robotics/robots',
      });
    }
  }

  if (approval.decidedByUserId) {
    const decider = workforceMembers.find(
      (m) => m.linkedUserId === approval.decidedByUserId,
    );
    if (decider) {
      relatedEntities.push({
        type: 'workforce',
        id: decider.workforceMemberId,
        label: decider.displayName,
        href: `/workforce/${decider.workforceMemberId}`,
        sublabel: 'Decided',
      });
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <PageHeader
            title="Approval Request"
            icon={<EntityIcon entityType="approval" size="md" decorative />}
            breadcrumb={[
              { label: 'Approvals', to: '/approvals' },
              { label: approvalId.slice(0, 12) },
            ]}
          />
        </div>
        <ApprovalStatusBadge status={approval.status} />
      </div>

      {linkedRun && (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Linked Run</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono">{linkedRun.runId.slice(0, 12)}</span>
              <span className="text-muted-foreground">{linkedRun.workflowId}</span>
              <RunStatusBadge status={linkedRun.status} />
              <ExecutionTierBadge tier={linkedRun.executionTier} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Planned Effects</CardTitle>
        </CardHeader>
        <CardContent>
          {planLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : plan && plan.plannedEffects.length > 0 ? (
            <EffectsList
              planned={plan.plannedEffects}
              predicted={plan.predictedEffects}
            />
          ) : (
            <p className="text-xs text-muted-foreground italic">No plan attached to this approval.</p>
          )}
        </CardContent>
      </Card>

      <ApprovalGatePanel approval={approval} onDecide={handleDecide} loading={mutation.isPending} />

      {relatedEvidence.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evidence Trail</CardTitle>
          </CardHeader>
          <CardContent>
            <EvidenceTimeline entries={relatedEvidence} loading={evidenceLoading} />
          </CardContent>
        </Card>
      )}

      <RelatedEntities entities={relatedEntities} />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/approvals/$approvalId',
  component: ApprovalDetailPage,
});
