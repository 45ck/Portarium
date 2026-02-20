import { createRoute, useNavigate, Link } from '@tanstack/react-router';
import { format } from 'date-fns';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useWorkItem, useUpdateWorkItem } from '@/hooks/queries/use-work-items';
import { useRuns } from '@/hooks/queries/use-runs';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { useWorkforceMembers } from '@/hooks/queries/use-workforce';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { SorRefPill } from '@/components/cockpit/sor-ref-pill';
import { EvidenceTimeline } from '@/components/cockpit/evidence-timeline';
import { OwnerPicker } from '@/components/cockpit/owner-picker';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { User } from 'lucide-react';
import type { RunSummary } from '@portarium/cockpit-types';

function WorkItemDetailPage() {
  const { workItemId } = Route.useParams();
  const { activeWorkspaceId: wsId } = useUIStore();
  const navigate = useNavigate();

  const { data: item, isLoading: itemLoading, isError: itemError } = useWorkItem(wsId, workItemId);
  const runs = useRuns(wsId);
  const approvals = useApprovals(wsId);
  const evidence = useEvidence(wsId);
  const { data: membersData } = useWorkforceMembers(wsId);
  const updateWorkItem = useUpdateWorkItem(wsId, workItemId);
  const workforceMembers = membersData?.items ?? [];
  const ownerMember = workforceMembers.find((m) => m.linkedUserId === item?.ownerUserId);

  if (itemLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (itemError || !item) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Work Item Not Found"
          icon={<EntityIcon entityType="work-item" size="md" decorative />}
          breadcrumb={[{ label: 'Work Items', to: '/work-items' }]}
        />
        <p className="text-sm text-muted-foreground">
          The work item <span className="font-mono">{workItemId}</span> does not exist or could not
          be loaded.
        </p>
      </div>
    );
  }

  const linkedRunIds = new Set(item.links?.runIds ?? []);
  const linkedApprovalIds = new Set(item.links?.approvalIds ?? []);
  const linkedEvidenceIds = new Set(item.links?.evidenceIds ?? []);

  const linkedRuns = (runs.data?.items ?? []).filter((r) => linkedRunIds.has(r.runId));
  const linkedApprovals = (approvals.data?.items ?? []).filter((a) =>
    linkedApprovalIds.has(a.approvalId),
  );
  const linkedEvidence = (evidence.data?.items ?? []).filter((e) =>
    linkedEvidenceIds.has(e.evidenceId),
  );

  const runColumns = [
    {
      key: 'runId',
      header: 'Run ID',
      width: '120px',
      render: (row: RunSummary) => <span className="font-mono">{row.runId.slice(0, 12)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (row: RunSummary) => <RunStatusBadge status={row.status} />,
    },
    {
      key: 'executionTier',
      header: 'Tier',
      width: '140px',
      render: (row: RunSummary) => <ExecutionTierBadge tier={row.executionTier} />,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={item.title}
        icon={<EntityIcon entityType="work-item" size="md" decorative />}
        breadcrumb={[{ label: 'Work Items', to: '/work-items' }, { label: item.title }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: metadata */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                variant={item.status === 'Open' ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {item.status}
              </Badge>
            </div>
            <div className="text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created by</span>
                <span>{item.createdByUserId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Owner</span>
                <div className="flex items-center gap-2">
                  {item.ownerUserId ? (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {ownerMember?.displayName ?? item.ownerUserId}
                    </span>
                  ) : null}
                  <OwnerPicker
                    members={workforceMembers}
                    currentMemberId={ownerMember?.workforceMemberId}
                    onSelect={(memberId) => {
                      const member = workforceMembers.find((m) => m.workforceMemberId === memberId);
                      if (member) {
                        updateWorkItem.mutate({ ownerUserId: member.linkedUserId });
                      }
                    }}
                    label={item.ownerUserId ? 'Change' : 'Assign owner'}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(item.createdAtIso), 'MMM d, yyyy HH:mm')}</span>
              </div>
              {item.sla?.dueAtIso && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SLA Due</span>
                  <span>{format(new Date(item.sla.dueAtIso), 'MMM d, yyyy HH:mm')}</span>
                </div>
              )}
            </div>
            {item.links?.externalRefs && item.links.externalRefs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">External References</p>
                <div className="flex flex-wrap gap-1">
                  {item.links.externalRefs.map((ref, i) => (
                    <SorRefPill key={i} externalRef={ref} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: linked data */}
        <div className="space-y-4">
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Linked Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {linkedRuns.length === 0 ? (
                <p className="text-xs text-muted-foreground">No linked runs</p>
              ) : (
                <DataTable
                  columns={runColumns}
                  data={linkedRuns}
                  loading={runs.isLoading}
                  getRowKey={(row) => row.runId}
                  onRowClick={(row) =>
                    navigate({ to: '/runs/$runId' as string, params: { runId: row.runId } })
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Linked Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {linkedApprovals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No linked approvals</p>
              ) : (
                <div className="space-y-2">
                  {linkedApprovals.map((a) => (
                    <Link
                      key={a.approvalId}
                      to={'/approvals/$approvalId' as string}
                      params={{ approvalId: a.approvalId }}
                      className="flex items-start justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs truncate">{a.prompt}</p>
                      </div>
                      <ApprovalStatusBadge status={a.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Evidence timeline */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceTimeline entries={linkedEvidence} loading={evidence.isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work-items/$workItemId',
  component: WorkItemDetailPage,
});
