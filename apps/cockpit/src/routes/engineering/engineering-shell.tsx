import { Link, useNavigate } from '@tanstack/react-router';
import { ExternalLink, FileText, GitPullRequest, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { BeadKanbanBoard } from '@/components/cockpit/bead-kanban-board';
import { BeadNavList } from '@/components/cockpit/bead-nav-list';
import { BeadThreadPanel } from '@/components/cockpit/bead-thread-panel';
import { BlastRadiusBadge } from '@/components/cockpit/blast-radius-badge';
import {
  buildEngineeringBeads,
  type EngineeringBead,
} from '@/components/cockpit/engineering-beads';
import { MissionControlHeader } from '@/components/cockpit/mission-control-header';
import { OfflineSyncBanner } from '@/components/cockpit/offline-sync-banner';
import { PolicyTierBadge } from '@/components/cockpit/policy-tier-badge';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Skeleton } from '@/components/ui/skeleton';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { useRuns } from '@/hooks/queries/use-runs';
import { useWorkItems } from '@/hooks/queries/use-work-items';
import { useUIStore } from '@/stores/ui-store';

const LinkComponent = Link as React.ComponentType<{
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  className?: string;
  children?: React.ReactNode;
}>;

function LoadingShell() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MissionControlHeader
        awaitingCount={0}
        runningCount={0}
        chainVerified
        lastChainCheckAt="Loading"
      />
      <div className="grid flex-1 gap-3 p-4 md:grid-cols-[240px_1fr_320px]">
        <Skeleton className="h-full min-h-80" />
        <Skeleton className="h-full min-h-80" />
        <Skeleton className="h-full min-h-80" />
      </div>
    </div>
  );
}

function DetailPanel({ bead }: { bead?: EngineeringBead }) {
  const navigate = useNavigate();
  const { activeWorkspaceId: wsId } = useUIStore();

  if (!bead) {
    return (
      <aside className="flex h-full min-h-0 flex-col border-l bg-background p-4">
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground">
          Select a bead to inspect agent activity, approvals, and policy context.
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l bg-background">
      <div className="border-b p-4">
        <div className="font-mono text-xs text-muted-foreground">{bead.beadId}</div>
        <h2 className="mt-1 text-base font-semibold leading-tight">{bead.title}</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <PolicyTierBadge tier={bead.policyTier} />
          <BlastRadiusBadge level={bead.blastRadius} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border bg-muted/30 p-2">
            <dt className="text-muted-foreground">Runs</dt>
            <dd className="font-medium">{bead.runIds.length}</dd>
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <dt className="text-muted-foreground">Approvals</dt>
            <dd className="font-medium">{bead.approvalIds.length}</dd>
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <dt className="text-muted-foreground">Evidence</dt>
            <dd className="font-medium">{bead.evidenceCount}</dd>
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{bead.column}</dd>
          </div>
        </dl>
        {bead.primaryApproval?.status === 'Pending' && (
          <LinkComponent
            to="/engineering/beads/$beadId/approval"
            params={{ beadId: bead.beadId }}
            search={{ approvalId: bead.primaryApproval.approvalId }}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <GitPullRequest className="h-4 w-4" />
            Review Approval
          </LinkComponent>
        )}
        {bead.primaryRun && (
          <div className="mt-2 grid grid-cols-1 gap-2">
            <Button variant="outline" className="w-full" asChild>
              <LinkComponent to="/runs/$runId" params={{ runId: bead.primaryRun.runId }}>
                <ExternalLink className="h-4 w-4" />
                Open Run
              </LinkComponent>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <LinkComponent
                to="/engineering/beads/$beadId/artifact"
                params={{ beadId: bead.beadId }}
              >
                <FileText className="h-4 w-4" />
                Run Artifact
              </LinkComponent>
            </Button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 p-3">
        <BeadThreadPanel
          workspaceId={wsId}
          beadId={bead.beadId}
          beadTitle={bead.title}
          onReviewApproval={(approvalId) =>
            navigate({
              to: '/engineering/beads/$beadId/approval' as string,
              params: { beadId: bead.beadId },
              search: { approvalId },
            })
          }
        />
      </div>
    </aside>
  );
}

export function EngineeringShell({ selectedBeadId }: { selectedBeadId?: string }) {
  const { activeWorkspaceId: wsId } = useUIStore();
  const workItems = useWorkItems(wsId);
  const runs = useRuns(wsId);
  const approvals = useApprovals(wsId);

  const beads = useMemo(
    () =>
      buildEngineeringBeads({
        workItems: workItems.data?.items ?? [],
        runs: runs.data?.items ?? [],
        approvals: approvals.data?.items ?? [],
      }),
    [approvals.data?.items, runs.data?.items, workItems.data?.items],
  );
  const selectedBead = selectedBeadId
    ? beads.find((bead) => bead.beadId === selectedBeadId)
    : undefined;
  const awaitingCount = beads.filter((bead) => bead.column === 'AwaitingApproval').length;
  const runningCount = beads.filter((bead) => bead.column === 'Running').length;
  const isLoading = workItems.isLoading || runs.isLoading || approvals.isLoading;
  const isError = workItems.isError || runs.isError || approvals.isError;

  if (isLoading) return <LoadingShell />;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <MissionControlHeader
        awaitingCount={awaitingCount}
        runningCount={runningCount}
        chainVerified={!isError}
        lastChainCheckAt={new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      />
      <div className="px-4 pt-3 md:px-6">
        <OfflineSyncBanner
          isOffline={workItems.offlineMeta.isOffline || runs.offlineMeta.isOffline}
          isStaleData={workItems.offlineMeta.isStaleData || runs.offlineMeta.isStaleData}
          lastSyncAtIso={workItems.offlineMeta.lastSyncAtIso ?? runs.offlineMeta.lastSyncAtIso}
        />
      </div>
      {isError ? (
        <div className="m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive md:m-6">
          Engineering Cockpit data could not be loaded.
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup orientation="horizontal" className="min-h-0">
            <ResizablePanel defaultSize={22} minSize={16} maxSize={32}>
              <BeadNavList beads={beads} selectedBeadId={selectedBeadId} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={32}>
              <BeadKanbanBoard beads={beads} selectedBeadId={selectedBeadId} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={28} minSize={22} maxSize={42}>
              <DetailPanel bead={selectedBead} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  );
}
