import { createRoute, Link, useNavigate } from '@tanstack/react-router';
import { isToday, format } from 'date-fns';
import { toast } from 'sonner';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import {
  useMissions,
  useCancelMission,
  usePreemptMission,
  useRetryMission,
} from '@/hooks/queries/use-missions';
import { PageHeader } from '@/components/cockpit/page-header';
import { DataTable } from '@/components/cockpit/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MissionSummary } from '@/types/robotics';
import { Circle, RotateCcw, CheckCircle2, XCircle, OctagonX } from 'lucide-react';

function MissionStatusBadge({ status }: { status: MissionSummary['status'] }) {
  const config: Record<
    MissionSummary['status'],
    { label: string; icon: React.ReactNode; className: string }
  > = {
    Pending: {
      label: 'Pending',
      icon: <Circle className="h-3 w-3" />,
      className: 'bg-muted text-muted-foreground border-border',
    },
    Executing: {
      label: 'Executing',
      icon: <RotateCcw className="h-3 w-3 animate-spin" />,
      className: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    Completed: {
      label: 'Completed',
      icon: <CheckCircle2 className="h-3 w-3" />,
      className: 'bg-green-100 text-green-800 border-green-200',
    },
    Failed: {
      label: 'Failed',
      icon: <XCircle className="h-3 w-3" />,
      className: 'bg-red-100 text-red-800 border-red-200',
    },
    Cancelled: {
      label: 'Cancelled',
      icon: <OctagonX className="h-3 w-3" />,
      className: 'bg-red-100 text-red-800 border-red-200',
    },
  };
  const c = config[status];
  return (
    <Badge
      variant="outline"
      className={cn('flex items-center gap-1 text-[11px]', c.className)}
      aria-label={status}
    >
      {c.icon}
      {c.label}
    </Badge>
  );
}

function MissionsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading } = useMissions(wsId);
  const cancelMission = useCancelMission(wsId);
  const preemptMission = usePreemptMission(wsId);
  const retryMission = useRetryMission(wsId);
  const navigate = useNavigate();
  const missionsList = data?.items ?? [];
  const stats = {
    active: missionsList.filter((m) => m.status === 'Executing').length,
    pending: missionsList.filter((m) => m.status === 'Pending').length,
    completedToday: missionsList.filter(
      (m) => m.status === 'Completed' && m.completedAtIso && isToday(new Date(m.completedAtIso)),
    ).length,
    failed: missionsList.filter((m) => m.status === 'Failed').length,
  };

  function handleCancel(missionId: string) {
    cancelMission.mutate(missionId, {
      onSuccess: () => toast.success(`Mission ${missionId} cancelled`),
    });
  }
  function handlePreempt(missionId: string) {
    preemptMission.mutate(missionId, {
      onSuccess: () => toast.success(`Mission ${missionId} pre-empted`),
    });
  }
  function handleRetry(missionId: string) {
    retryMission.mutate(missionId, {
      onSuccess: () => toast.success(`Mission ${missionId} queued for retry`),
    });
  }

  const columns = [
    {
      key: 'missionId',
      header: 'ID',
      width: '110px',
      render: (row: MissionSummary) => <span className="font-mono text-xs">{row.missionId}</span>,
    },
    {
      key: 'robotId',
      header: 'Robot',
      width: '110px',
      render: (row: MissionSummary) => (
        <Link
          to={`/robotics/robots/${row.robotId}` as string}
          className="font-mono text-xs text-primary hover:underline"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {row.robotId}
        </Link>
      ),
    },
    {
      key: 'goal',
      header: 'Goal',
      render: (row: MissionSummary) => (
        <span className="truncate block max-w-[200px]">{row.goal}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (row: MissionSummary) => <MissionStatusBadge status={row.status} />,
    },
    {
      key: 'dispatchedAtIso',
      header: 'Dispatched',
      width: '100px',
      render: (row: MissionSummary) =>
        row.dispatchedAtIso ? format(new Date(row.dispatchedAtIso), 'HH:mm') : '—',
    },
    {
      key: 'actions',
      header: '',
      width: '90px',
      render: (row: MissionSummary) => {
        if (row.status === 'Executing')
          return (
            <Link
              to={`/robotics/missions/${row.missionId}` as string}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <Button variant="outline" size="sm" className="h-6 text-xs">
                Pre-empt
              </Button>
            </Link>
          );
        if (row.status === 'Failed')
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleRetry(row.missionId);
              }}
            >
              Retry
            </Button>
          );
        if (row.status === 'Pending')
          return (
            <Link
              to={`/robotics/missions/${row.missionId}` as string}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs text-destructive hover:text-destructive"
              >
                Cancel
              </Button>
            </Link>
          );
        return null;
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Missions"
        description="Robot mission dispatch and monitoring"
        breadcrumb={[{ label: 'Robotics', to: '/robotics' }, { label: 'Missions' }]}
      />
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
      <DataTable
        columns={columns}
        data={missionsList}
        loading={isLoading}
        getRowKey={(row) => row.missionId}
        onRowClick={(row) => {
          navigate({ to: `/robotics/missions/${row.missionId}` as string });
        }}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/missions',
  component: MissionsPage,
});
