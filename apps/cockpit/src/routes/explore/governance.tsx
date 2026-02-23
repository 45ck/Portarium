import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { usePolicies, useSodConstraints } from '@/hooks/queries/use-policies';
import { useWorkflows } from '@/hooks/queries/use-workflows';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { KpiRow } from '@/components/cockpit/kpi-row';
import { DataTable } from '@/components/cockpit/data-table';
import { FilterBar } from '@/components/cockpit/filter-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import type { SodConstraint } from '@portarium/cockpit-types';
import {
  filterAuditEntries,
  normalizeAuditCategory,
  getAffectedWorkflowIds,
  getPolicyScope,
  getPolicyTier,
  getRuleCount,
  type GovernanceAuditFilter,
  type GovernancePolicy,
} from './governance.utils';

const policyStatusClassName: Record<string, string> = {
  Active: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  Draft: 'text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-950',
  Archived: 'text-muted-foreground bg-muted',
};

const sodStatusClassName: Record<string, string> = {
  Active: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  Inactive: 'text-muted-foreground bg-muted',
};

const operatorLabel: Record<string, string> = {
  eq: '=',
  neq: '!=',
  in: 'in',
  gt: '>',
  lt: '<',
};

function deriveSodRolePair(constraint: SodConstraint): string {
  return constraint.rolePair ?? constraint.name;
}

function deriveSodForbiddenAction(constraint: SodConstraint): string {
  return constraint.forbiddenAction ?? constraint.description;
}

function deriveSodScope(constraint: SodConstraint, policies: GovernancePolicy[]): string {
  if (constraint.scope) return constraint.scope;
  const linkedPolicy = policies.find((policy) =>
    constraint.relatedPolicyIds.includes(policy.policyId),
  );
  return linkedPolicy ? getPolicyScope(linkedPolicy) : 'workspace';
}

function ExploreGovernancePage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data: evidenceData, isLoading: evidenceLoading } = useEvidence(wsId);
  const { data: policiesData, isLoading: policiesLoading } = usePolicies(wsId);
  const { data: sodData, isLoading: sodLoading } = useSodConstraints(wsId);
  const { data: workflowsData } = useWorkflows(wsId);

  const [selectedPolicy, setSelectedPolicy] = useState<GovernancePolicy | null>(null);
  const [auditFilter, setAuditFilter] = useState<GovernanceAuditFilter>('all');

  const policies = (policiesData?.items ?? []) as GovernancePolicy[];
  const sodConstraints = sodData?.items ?? [];
  const allRecentAuditEntries = (evidenceData?.items ?? []).slice(0, 20);
  const recentAuditEntries = filterAuditEntries(allRecentAuditEntries, auditFilter).slice(0, 10);
  const workflowsById = new Map((workflowsData?.items ?? []).map((wf) => [wf.workflowId, wf]));

  const activePolicies = policies.filter((p) => p.status === 'Active').length;
  const activeSod = sodConstraints.filter((c) => c.status === 'Active').length;

  const policyColumns = [
    {
      key: 'policyId',
      header: 'Policy ID',
      width: '120px',
      render: (row: GovernancePolicy) => (
        <Badge variant="secondary" className="font-mono text-[11px]">
          {row.policyId}
        </Badge>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row: GovernancePolicy) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'tier',
      header: 'Tier',
      width: '120px',
      render: (row: GovernancePolicy) => (
        <span className="text-muted-foreground">{getPolicyTier(row)}</span>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (row: GovernancePolicy) => (
        <span className="text-muted-foreground">{getPolicyScope(row)}</span>
      ),
    },
    {
      key: 'ruleCount',
      header: 'Rules',
      width: '90px',
      render: (row: GovernancePolicy) => (
        <Badge variant="secondary">{getRuleCount(row).toString()}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row: GovernancePolicy) => (
        <Badge variant="secondary" className={policyStatusClassName[row.status]}>
          {row.status}
        </Badge>
      ),
    },
  ];

  const sodColumns = [
    {
      key: 'rolePair',
      header: 'Role Pair',
      render: (row: SodConstraint) => <span className="font-medium">{deriveSodRolePair(row)}</span>,
    },
    {
      key: 'forbiddenAction',
      header: 'Forbidden Action',
      render: (row: SodConstraint) => (
        <span className="text-muted-foreground">{deriveSodForbiddenAction(row)}</span>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      width: '140px',
      render: (row: SodConstraint) => (
        <Badge variant="secondary" className="font-mono text-[11px]">
          {deriveSodScope(row, policies)}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row: SodConstraint) => (
        <Badge variant="secondary" className={sodStatusClassName[row.status]}>
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Governance"
        description="Policy compliance and segregation of duties"
        icon={<EntityIcon entityType="policy" size="md" decorative />}
      />

      <KpiRow
        stats={[
          { label: 'Policies Active', value: activePolicies },
          { label: 'SoD Constraints Active', value: activeSod },
          { label: 'Audit Entries (7d)', value: recentAuditEntries.length },
        ]}
      />

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={policyColumns}
            data={policies}
            loading={policiesLoading}
            getRowKey={(row) => row.policyId}
            onRowClick={(row) => setSelectedPolicy(row)}
          />
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Segregation of Duties Constraints</CardTitle>
        </CardHeader>
        <CardContent>
          {sodLoading ? (
            <Skeleton className="h-4 w-1/2" />
          ) : (
            <>
              <DataTable
                columns={sodColumns}
                data={sodConstraints}
                getRowKey={(row) => row.constraintId}
              />
              {sodConstraints.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-4">
                  {sodConstraints.map((constraint) => (
                    <div
                      key={constraint.constraintId}
                      className="relative border border-border rounded-lg p-3 min-w-[180px]"
                    >
                      <div className="text-xs font-medium mb-1">{constraint.name}</div>
                      <div className="text-[11px] text-muted-foreground mb-2">
                        {constraint.description}
                      </div>
                      {constraint.relatedPolicyIds.map((polId) => {
                        const policy = policies.find((p) => p.policyId === polId);
                        return (
                          <div
                            key={polId}
                            className="flex items-center gap-1 text-[11px] text-primary"
                          >
                            <span className="w-2 h-px bg-primary inline-block" />
                            {policy?.name ?? polId}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Audit Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <FilterBar
              filters={[
                {
                  key: 'category',
                  label: 'Category',
                  options: [
                    { label: 'All', value: 'all' },
                    { label: 'Policy Violation', value: 'PolicyViolation' },
                    { label: 'Policy', value: 'Policy' },
                    { label: 'Approval', value: 'Approval' },
                    { label: 'Action', value: 'Action' },
                    { label: 'Plan', value: 'Plan' },
                    { label: 'System', value: 'System' },
                  ],
                },
              ]}
              values={{ category: auditFilter }}
              onChange={(_key, value) => setAuditFilter(value as GovernanceAuditFilter)}
            />
          </div>
          {evidenceLoading ? (
            <Skeleton className="h-4 w-1/2" />
          ) : recentAuditEntries.length === 0 ? (
            <div className="text-xs text-muted-foreground">No audit events</div>
          ) : (
            <ul className="space-y-2">
              {recentAuditEntries.map((entry) => (
                <li key={entry.evidenceId} className="flex items-start gap-3 text-xs">
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {format(new Date(entry.occurredAtIso), 'MMM d, HH:mm')}
                  </span>
                  <Badge variant="secondary" className="text-[11px]">
                    {normalizeAuditCategory(entry)}
                  </Badge>
                  <span>{entry.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Policy Detail Sheet */}
      <Sheet
        open={selectedPolicy !== null}
        onOpenChange={(open) => !open && setSelectedPolicy(null)}
      >
        <SheetContent className="w-[480px] sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>{selectedPolicy?.name}</SheetTitle>
            <SheetDescription>{selectedPolicy?.description}</SheetDescription>
          </SheetHeader>
          {selectedPolicy && (
            <div className="mt-6 space-y-5">
              <div>
                <div className="text-xs font-medium mb-1">Status</div>
                <Badge variant="secondary" className={policyStatusClassName[selectedPolicy.status]}>
                  {selectedPolicy.status}
                </Badge>
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Tier</div>
                <div className="text-xs text-muted-foreground">{getPolicyTier(selectedPolicy)}</div>
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Scope</div>
                <div className="text-xs text-muted-foreground">
                  {getPolicyScope(selectedPolicy)}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-1">DSL Rule</div>
                <pre className="bg-muted rounded-md p-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
                  {selectedPolicy.ruleText}
                </pre>
              </div>

              <div>
                <div className="text-xs font-medium mb-2">Condition Tree</div>
                {selectedPolicy.conditions.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No conditions declared.</div>
                ) : (
                  <div className="space-y-1 pl-2 border-l-2 border-primary/30">
                    {selectedPolicy.conditions.map((cond, i) => (
                      <div key={i} className="flex items-center gap-1 text-[11px] font-mono">
                        <span className="text-foreground">
                          {cond.field} {operatorLabel[cond.operator] ?? cond.operator} {cond.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium mb-2">Linked SoD Constraints</div>
                {sodConstraints.filter((c) => c.relatedPolicyIds.includes(selectedPolicy.policyId))
                  .length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    No SoD constraints linked to this policy.
                  </div>
                ) : (
                  sodConstraints
                    .filter((c) => c.relatedPolicyIds.includes(selectedPolicy.policyId))
                    .map((c) => (
                      <div key={c.constraintId} className="flex items-center gap-2 text-xs py-1">
                        <Badge variant="secondary" className="text-[11px]">
                          {c.constraintId}
                        </Badge>
                        <span>{deriveSodRolePair(c)}</span>
                      </div>
                    ))
                )}
              </div>

              <div>
                <div className="text-xs font-medium mb-2">Affected Workflows</div>
                {getAffectedWorkflowIds(selectedPolicy).length === 0 ? (
                  <div className="text-xs text-muted-foreground">No workflows linked.</div>
                ) : (
                  getAffectedWorkflowIds(selectedPolicy).map((workflowId) => (
                    <div key={workflowId} className="flex items-center gap-2 text-xs py-1">
                      <Badge variant="secondary" className="text-[11px] font-mono">
                        {workflowId}
                      </Badge>
                      <span>{workflowsById.get(workflowId)?.name ?? workflowId}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore/governance',
  component: ExploreGovernancePage,
});
