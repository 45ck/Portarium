import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { usePolicies, useSodConstraints } from '@/hooks/queries/use-policies';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { KpiRow } from '@/components/cockpit/kpi-row';
import { DataTable } from '@/components/cockpit/data-table';
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
import type { PolicySummary, SodConstraint } from '@/mocks/fixtures/policies';

const policyStatusClassName: Record<string, string> = {
  Active: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  Draft: 'text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-950',
  Archived: 'text-muted-foreground bg-muted',
};

const sodStatusClassName: Record<string, string> = {
  Active: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  Inactive: 'text-muted-foreground bg-muted',
};

function ExploreGovernancePage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data: evidenceData, isLoading: evidenceLoading } = useEvidence(wsId);
  const { data: policiesData, isLoading: policiesLoading } = usePolicies(wsId);
  const { data: sodData, isLoading: sodLoading } = useSodConstraints(wsId);

  const [selectedPolicy, setSelectedPolicy] = useState<PolicySummary | null>(null);

  const policies = policiesData?.items ?? [];
  const sodConstraints = sodData?.items ?? [];
  const recentAuditEntries = (evidenceData?.items ?? []).slice(0, 10);

  const activePolicies = policies.filter((p) => p.status === 'Active').length;
  const activeSod = sodConstraints.filter((c) => c.status === 'Active').length;

  const policyColumns = [
    {
      key: 'name',
      header: 'Policy',
      render: (row: PolicySummary) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (row: PolicySummary) => (
        <span className="text-muted-foreground">{row.description}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row: PolicySummary) => (
        <Badge variant="secondary" className={policyStatusClassName[row.status]}>
          {row.status}
        </Badge>
      ),
    },
  ];

  const sodColumns = [
    { key: 'name', header: 'Constraint' },
    { key: 'description', header: 'Description' },
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
    {
      key: 'relatedPolicyIds',
      header: 'Policies',
      width: '120px',
      render: (row: SodConstraint) => (
        <Badge variant="secondary">{row.relatedPolicyIds.length} linked</Badge>
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
                      <div className="text-[10px] text-muted-foreground mb-2">
                        {constraint.description}
                      </div>
                      {constraint.relatedPolicyIds.map((polId) => {
                        const policy = policies.find((p) => p.policyId === polId);
                        return (
                          <div
                            key={polId}
                            className="flex items-center gap-1 text-[10px] text-primary"
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
                <Badge
                  variant="secondary"
                  className={policyStatusClassName[selectedPolicy.status]}
                >
                  {selectedPolicy.status}
                </Badge>
              </div>

              <div>
                <div className="text-xs font-medium mb-1">DSL Rule</div>
                <pre className="bg-muted rounded-md p-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
                  {selectedPolicy.ruleText}
                </pre>
              </div>

              <div>
                <div className="text-xs font-medium mb-2">Condition Tree</div>
                <div className="space-y-1 pl-2 border-l-2 border-primary/30">
                  {selectedPolicy.conditions.map((cond, i) => (
                    <div key={i} className="flex items-center gap-1 text-[11px] font-mono">
                      <span className="text-primary">{cond.field}</span>
                      <span className="text-muted-foreground">{cond.operator}</span>
                      <span className="text-foreground">{cond.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-2">Linked SoD Constraints</div>
                {sodConstraints
                  .filter((c) =>
                    c.relatedPolicyIds.includes(selectedPolicy.policyId),
                  )
                  .map((c) => (
                    <div
                      key={c.constraintId}
                      className="flex items-center gap-2 text-xs py-1"
                    >
                      <Badge variant="secondary" className="text-[10px]">
                        {c.constraintId}
                      </Badge>
                      <span>{c.name}</span>
                    </div>
                  ))}
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
