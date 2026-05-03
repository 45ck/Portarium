import { createRoute, Link } from '@tanstack/react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { AlertCircle, CheckCircle2, CirclePause, ShieldAlert } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useProjects } from '@/hooks/queries/use-projects';
import { PageHeader } from '@/components/cockpit/page-header';
import { FreshnessBadge } from '@/components/cockpit/freshness-badge';
import { OfflineSyncBanner } from '@/components/cockpit/offline-sync-banner';
import { DataTable, type Column } from '@/components/cockpit/data-table';
import { KpiRow } from '@/components/cockpit/kpi-row';
import { EntityIcon } from '@/components/domain/entity-icon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ProjectSummary } from '@portarium/cockpit-types';

const POSTURE_VARIANT: Record<
  ProjectSummary['governancePosture'],
  'default' | 'secondary' | 'destructive'
> = {
  Clear: 'secondary',
  Attention: 'default',
  Blocked: 'destructive',
};

const STATUS_VARIANT: Record<ProjectSummary['status'], 'default' | 'secondary' | 'outline'> = {
  Active: 'default',
  Paused: 'secondary',
  Completed: 'outline',
  Archived: 'outline',
};

function ProjectsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading, isError, refetch, offlineMeta } = useProjects(wsId);
  const projects = data?.items ?? [];
  const selectedProject = selectGovernedProject(projects);
  const totals = summarizeProjects(projects);

  const columns: Column<ProjectSummary>[] = [
    {
      key: 'name',
      header: 'Project',
      render: (row) => (
        <div className="min-w-[220px]">
          <div className="font-medium">{row.name}</div>
          <div className="text-[11px] text-muted-foreground line-clamp-1">{row.summary}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row) => <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>,
    },
    {
      key: 'governancePosture',
      header: 'Posture',
      width: '120px',
      render: (row) => (
        <Badge variant={POSTURE_VARIANT[row.governancePosture]}>{row.governancePosture}</Badge>
      ),
    },
    {
      key: 'workItemCount',
      header: 'Work Items',
      width: '100px',
      render: (row) => row.metrics.workItemCount,
    },
    {
      key: 'activeRunCount',
      header: 'Active Runs',
      width: '100px',
      render: (row) => row.metrics.activeRunCount,
    },
    {
      key: 'pendingApprovalCount',
      header: 'Approvals',
      width: '100px',
      render: (row) => row.metrics.pendingApprovalCount,
    },
    {
      key: 'latestActivityAtIso',
      header: 'Latest',
      width: '130px',
      render: (row) => formatLatest(row.latestActivityAtIso),
    },
  ];

  if (isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Projects"
          description="Project portfolio for autonomous work grouped under governed containers."
          icon={<EntityIcon entityType="project" size="md" decorative />}
          status={<FreshnessBadge sourceLabel="Projects" offlineMeta={offlineMeta} />}
        />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load Projects</p>
            <p className="text-xs text-muted-foreground">
              The Project portfolio could not be fetched.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Projects"
        description="Project portfolio for autonomous work grouped under governed containers."
        icon={<EntityIcon entityType="project" size="md" decorative />}
        status={
          <FreshnessBadge sourceLabel="Projects" offlineMeta={offlineMeta} isFetching={isLoading} />
        }
      />
      <OfflineSyncBanner
        isOffline={offlineMeta.isOffline}
        isStaleData={offlineMeta.isStaleData}
        lastSyncAtIso={offlineMeta.lastSyncAtIso}
      />

      <KpiRow
        stats={[
          { label: 'Projects', value: totals.projectCount },
          { label: 'Active Runs', value: totals.activeRunCount },
          { label: 'Pending Approvals', value: totals.pendingApprovalCount },
          { label: 'Policy Violations', value: totals.policyViolationCount },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={projects}
              loading={isLoading}
              getRowKey={(row) => row.projectId}
              pagination={{ pageSize: 10 }}
            />
          </CardContent>
        </Card>

        <GovernanceSurface project={selectedProject} />
      </div>
    </div>
  );
}

function GovernanceSurface({ project }: { project: ProjectSummary | undefined }) {
  if (!project) {
    return (
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Governance Surface</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          No Project is available for governance review.
        </CardContent>
      </Card>
    );
  }

  const Icon =
    project.governancePosture === 'Blocked'
      ? ShieldAlert
      : project.status === 'Paused'
        ? CirclePause
        : CheckCircle2;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 text-primary" />
          <div className="min-w-0">
            <CardTitle className="text-sm">Governance Surface</CardTitle>
            <p className="text-xs text-muted-foreground truncate">{project.name}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={POSTURE_VARIANT[project.governancePosture]}>
            {project.governancePosture}
          </Badge>
          <Badge variant="outline">{project.governance.defaultExecutionTier}</Badge>
          <Badge variant="outline">{project.governance.evidenceDepth} evidence</Badge>
        </div>

        <KeyValue label="Owners" value={project.governance.ownerUserIds.join(', ')} />
        <KeyValue label="Policies" value={project.governance.policyIds.join(', ')} />
        <KeyValue
          label="Allowed Actions"
          value={project.governance.allowedActionClasses.join(', ')}
        />
        <KeyValue
          label="Blocked Actions"
          value={project.governance.blockedActionClasses.join(', ')}
        />

        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Work Items" value={project.metrics.workItemCount} />
          <Metric label="Evidence" value={project.metrics.evidenceCount} />
          <Metric label="Artifacts" value={project.metrics.artifactCount} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={'/work-items' as string}>Work Items</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={'/runs' as string}>Runs</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={'/evidence' as string}>Evidence</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs leading-relaxed">{value || '-'}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function selectGovernedProject(projects: readonly ProjectSummary[]): ProjectSummary | undefined {
  return (
    projects.find((project) => project.governancePosture === 'Blocked') ??
    projects.find((project) => project.governancePosture === 'Attention') ??
    projects[0]
  );
}

function summarizeProjects(projects: readonly ProjectSummary[]) {
  return projects.reduce(
    (total, project) => ({
      projectCount: total.projectCount + 1,
      activeRunCount: total.activeRunCount + project.metrics.activeRunCount,
      pendingApprovalCount: total.pendingApprovalCount + project.metrics.pendingApprovalCount,
      policyViolationCount: total.policyViolationCount + project.metrics.policyViolationCount,
    }),
    { projectCount: 0, activeRunCount: 0, pendingApprovalCount: 0, policyViolationCount: 0 },
  );
}

function formatLatest(value: string | undefined): string {
  if (!value) return '-';
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsPage,
});
