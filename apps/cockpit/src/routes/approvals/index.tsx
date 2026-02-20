import { useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useApprovals, useApprovalDecision } from '@/hooks/queries/use-approvals';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { ApprovalTriageCard, type TriageAction } from '@/components/cockpit/approval-triage-card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/cockpit/empty-state';
import { CheckSquare } from 'lucide-react';
import type { ApprovalSummary } from '@portarium/cockpit-types';

function ApprovalsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const navigate = useNavigate();
  const { data, isLoading } = useApprovals(wsId);
  const items = data?.items ?? [];
  const pendingItems = items.filter((a) => a.status === 'Pending');

  // Triage card index — skip over items that have been actioned in this session
  const [triageIndex, setTriageIndex] = useState(0);
  const [triageSkipped, setTriageSkipped] = useState<Set<string>>(new Set());

  // Get pending items not yet actioned/skipped in this triage session
  const triageQueue = pendingItems.filter((a) => !triageSkipped.has(a.approvalId));
  const currentApproval = triageQueue[triageIndex] ?? triageQueue[0] ?? null;

  const { mutate: decide, isPending: deciding } = useApprovalDecision(
    wsId,
    currentApproval?.approvalId ?? '',
  );

  function handleTriageAction(approvalId: string, action: TriageAction, rationale: string) {
    if (action === 'Skip') {
      setTriageSkipped((prev) => new Set([...prev, approvalId]));
      return;
    }
    decide(
      { decision: action as 'Approved' | 'Denied' | 'RequestChanges', rationale },
      {
        onSuccess: () => {
          setTriageSkipped((prev) => new Set([...prev, approvalId]));
        },
      },
    );
  }

  const columns = [
    {
      key: 'approvalId',
      header: 'ID',
      width: '120px',
      render: (row: ApprovalSummary) => (
        <span className="font-mono">{row.approvalId.slice(0, 12)}</span>
      ),
    },
    {
      key: 'runId',
      header: 'Run',
      width: '120px',
      render: (row: ApprovalSummary) => <span className="font-mono">{row.runId.slice(0, 12)}</span>,
    },
    {
      key: 'prompt',
      header: 'Prompt',
      render: (row: ApprovalSummary) => (
        <span className="truncate block max-w-[300px]">
          {row.prompt.length > 60 ? `${row.prompt.slice(0, 60)}...` : row.prompt}
        </span>
      ),
    },
    {
      key: 'assigneeUserId',
      header: 'Assignee',
      width: '120px',
      render: (row: ApprovalSummary) => row.assigneeUserId ?? 'Unassigned',
    },
    {
      key: 'dueAtIso',
      header: 'Due',
      width: '140px',
      render: (row: ApprovalSummary) =>
        row.dueAtIso ? format(new Date(row.dueAtIso), 'MMM d, yyyy HH:mm') : '\u2014',
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (row: ApprovalSummary) => <ApprovalStatusBadge status={row.status} />,
    },
  ];

  const handleRowClick = (row: ApprovalSummary) => {
    navigate({
      to: '/approvals/$approvalId' as string,
      params: { approvalId: row.approvalId },
    });
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Approvals"
        icon={<EntityIcon entityType="approval" size="md" decorative />}
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {pendingItems.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 font-medium">
                {pendingItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="triage">
            Triage
            {pendingItems.length > 0 && (
              <span className="ml-1.5 rounded-full bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 font-medium">
                {triageQueue.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <DataTable
            columns={columns}
            data={pendingItems}
            loading={isLoading}
            getRowKey={(row) => row.approvalId}
            onRowClick={handleRowClick}
          />
        </TabsContent>

        <TabsContent value="triage">
          <div className="py-6">
            {isLoading ? (
              <div className="max-w-xl mx-auto h-64 rounded-xl bg-muted/30 animate-pulse" />
            ) : triageQueue.length === 0 ? (
              <EmptyState
                title="All caught up"
                description="No pending approvals left in the triage queue."
                icon={<CheckSquare className="h-12 w-12" />}
              />
            ) : (
              <ApprovalTriageCard
                key={currentApproval?.approvalId}
                approval={currentApproval!}
                index={pendingItems.length - triageQueue.length}
                total={pendingItems.length}
                onAction={handleTriageAction}
                loading={deciding}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="all">
          <DataTable
            columns={columns}
            data={items}
            loading={isLoading}
            getRowKey={(row) => row.approvalId}
            onRowClick={handleRowClick}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/approvals',
  component: ApprovalsPage,
});
