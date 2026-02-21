import { useMemo, useState } from 'react';
import { createRoute, Link, useNavigate } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useWorkflows } from '@/hooks/queries/use-workflows';
import { useRuns } from '@/hooks/queries/use-runs';
import { PageHeader } from '@/components/cockpit/page-header';
import { FilterBar } from '@/components/cockpit/filter-bar';
import { DataTable } from '@/components/cockpit/data-table';
import { EntityIcon } from '@/components/domain/entity-icon';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WorkflowSummary } from '@portarium/cockpit-types';

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const TRIGGER_OPTIONS = [
  { label: 'Manual', value: 'Manual' },
  { label: 'Cron', value: 'Cron' },
  { label: 'Webhook', value: 'Webhook' },
  { label: 'Domain Event', value: 'DomainEvent' },
];

function WorkflowsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, string>>({
    status: 'all',
    triggerKind: 'all',
  });

  const workflows = useWorkflows(wsId);
  const runs = useRuns(wsId);

  const runCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const run of runs.data?.items ?? []) {
      counts.set(run.workflowId, (counts.get(run.workflowId) ?? 0) + 1);
    }
    return counts;
  }, [runs.data?.items]);

  const items = (workflows.data?.items ?? []).filter((workflow) => {
    if (filters.status === 'active' && !workflow.active) return false;
    if (filters.status === 'inactive' && workflow.active) return false;
    if (
      filters.triggerKind !== 'all' &&
      (workflow.triggerKind ?? 'Manual') !== filters.triggerKind
    ) {
      return false;
    }
    return true;
  });

  const columns = [
    {
      key: 'workflowId',
      header: 'Workflow ID',
      width: '180px',
      render: (row: WorkflowSummary) => (
        <Link
          to={'/workflows/$workflowId' as string}
          params={{ workflowId: row.workflowId }}
          className="font-mono text-[11px] text-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.workflowId}
        </Link>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row: WorkflowSummary) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'version',
      header: 'Version',
      width: '90px',
      render: (row: WorkflowSummary) => <span>v{row.version}</span>,
    },
    {
      key: 'triggerKind',
      header: 'Trigger',
      width: '120px',
      render: (row: WorkflowSummary) => <span>{row.triggerKind ?? 'Manual'}</span>,
    },
    {
      key: 'executionTier',
      header: 'Tier',
      width: '130px',
      render: (row: WorkflowSummary) => <ExecutionTierBadge tier={row.executionTier} />,
    },
    {
      key: 'actionCount',
      header: 'Actions',
      width: '90px',
      render: (row: WorkflowSummary) => <Badge variant="secondary">{row.actions.length}</Badge>,
    },
    {
      key: 'linkedRuns',
      header: 'Linked Runs',
      width: '110px',
      render: (row: WorkflowSummary) => (
        <Badge variant="outline">{runCounts.get(row.workflowId) ?? 0}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row: WorkflowSummary) => (
        <Badge variant={row.active ? 'default' : 'secondary'}>
          {row.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
      render: (row: WorkflowSummary) => (
        <Button asChild size="sm" variant="outline">
          <Link
            to={'/workflows/$workflowId/edit' as string}
            params={{ workflowId: row.workflowId }}
            onClick={(event) => event.stopPropagation()}
          >
            Edit
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Workflows"
        description="Runbook definitions and execution metadata"
        icon={<EntityIcon entityType="workflow" size="md" decorative />}
        action={
          <Button asChild>
            <Link to="/workflows/builder">New Workflow</Link>
          </Button>
        }
      />

      <FilterBar
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
          { key: 'triggerKind', label: 'Trigger', options: TRIGGER_OPTIONS },
        ]}
        values={filters}
        onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={workflows.isLoading || runs.isLoading}
        getRowKey={(row) => row.workflowId}
        pagination={{ pageSize: 20 }}
        onRowClick={(row) =>
          navigate({
            to: '/workflows/$workflowId' as string,
            params: { workflowId: row.workflowId },
          })
        }
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workflows',
  component: WorkflowsPage,
});
