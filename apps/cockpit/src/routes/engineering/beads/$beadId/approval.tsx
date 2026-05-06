import { createRoute, redirect } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { ApprovalDecisionRequest, ApprovalSummary } from '@portarium/cockpit-types';
import { Route as rootRoute } from '../../../__root';
import { useUIStore } from '@/stores/ui-store';
import { useApprovals, useApprovalDecision } from '@/hooks/queries/use-approvals';
import { useBeadDiff } from '@/hooks/queries/use-bead-diff';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { DiffApprovalSurface } from '@/components/cockpit/diff-approval-surface';
import { EmptyState } from '@/components/cockpit/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { EntityIcon } from '@/components/domain/entity-icon';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';

interface BeadApprovalSearch {
  approvalId?: string;
}

function selectApproval(items: ApprovalSummary[], approvalId?: string): ApprovalSummary | null {
  if (approvalId) return items.find((approval) => approval.approvalId === approvalId) ?? null;
  return items.find((approval) => approval.status === 'Pending') ?? items[0] ?? null;
}

function BeadApprovalPage() {
  const { beadId } = Route.useParams();
  const search = Route.useSearch();
  const { activeWorkspaceId: wsId } = useUIStore();
  const diffQuery = useBeadDiff(wsId, beadId);
  const approvalsQuery = useApprovals(wsId);
  const evidenceQuery = useEvidence(wsId);
  const approval = selectApproval(approvalsQuery.data?.items ?? [], search.approvalId);
  const decision = useApprovalDecision(wsId, approval?.approvalId ?? '');

  if (diffQuery.isLoading || approvalsQuery.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }

  if (diffQuery.isError || approvalsQuery.isError) {
    return (
      <div className="p-6">
        <EmptyState
          title="Review unavailable"
          description="The approval diff could not be loaded."
          icon={<EntityIcon entityType="approval" size="lg" />}
        />
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="p-6">
        <EmptyState
          title="No approval found"
          description="No approval is available for this bead review."
          icon={<EntityIcon entityType="approval" size="lg" />}
        />
      </div>
    );
  }

  const selectedApproval = approval;
  const evidence = (evidenceQuery.data?.items ?? [])
    .filter(
      (entry) =>
        entry.links?.runId === selectedApproval.runId ||
        entry.links?.planId === selectedApproval.planId,
    )
    .slice(-3)
    .reverse();

  async function onDecide(
    nextDecision: 'Approved' | 'Denied' | 'RequestChanges',
    rationale: string,
  ) {
    const body: ApprovalDecisionRequest = { decision: nextDecision, rationale };
    await decision.mutateAsync(body);
    toast.success('Decision submitted', {
      description: `${nextDecision} recorded for ${selectedApproval.approvalId}.`,
    });
  }

  return (
    <DiffApprovalSurface
      beadId={beadId}
      approvalId={selectedApproval.approvalId}
      policyTier={
        (selectedApproval.policyRule?.tier as
          | 'Auto'
          | 'Assisted'
          | 'HumanApprove'
          | 'ManualOnly') ?? 'HumanApprove'
      }
      policyRationale={
        selectedApproval.agentActionProposal?.rationale ??
        selectedApproval.prompt ??
        'This bead has a proposed change that requires operator review.'
      }
      blastRadius={selectedApproval.policyRule?.blastRadius.join(', ') ?? 'Unknown scope'}
      isIrreversible={selectedApproval.policyRule?.irreversibility === 'full'}
      hunks={diffQuery.data ?? []}
      recentEvidence={evidence}
      sodEvaluation={selectedApproval.sodEvaluation}
      onDecide={onDecide}
      loading={decision.isPending}
    />
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/engineering/beads/$beadId/approval',
  beforeLoad: () => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({ to: '/dashboard' as string });
    }
  },
  component: BeadApprovalPage,
  validateSearch: (search: Record<string, unknown>): BeadApprovalSearch => ({
    approvalId: typeof search.approvalId === 'string' ? search.approvalId : undefined,
  }),
});
