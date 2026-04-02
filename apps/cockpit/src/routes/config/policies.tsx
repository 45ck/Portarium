import { createRoute, useNavigate } from '@tanstack/react-router';
import { Plus, ShieldCheck } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { SorBadge } from '@/components/cockpit/triage-card/sor-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { POLICIES } from '@/mocks/fixtures/openclaw-demo';

// ---------------------------------------------------------------------------
// Types for display
// ---------------------------------------------------------------------------

type ExecutionTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
type Irreversibility = 'full' | 'partial' | 'none';

interface GovernancePolicyRow {
  policyId: string;
  name: string;
  trigger: string;
  tier: ExecutionTier;
  blastRadius: string[];
  irreversibility: Irreversibility;
  status: 'Active' | 'Paused';
}

// ---------------------------------------------------------------------------
// Transform fixture data into display rows
// ---------------------------------------------------------------------------

const POLICY_ROWS: GovernancePolicyRow[] = POLICIES.map((p) => ({
  policyId: p.policyId,
  name: p.name,
  trigger: p.trigger,
  tier: p.tier as ExecutionTier,
  blastRadius: p.blastRadius.map((b) => b.system),
  irreversibility: p.irreversibility as Irreversibility,
  status: p.status === 'active' ? 'Active' : 'Paused',
}));

// ---------------------------------------------------------------------------
// Irreversibility colour mapping
// ---------------------------------------------------------------------------

const IRREVERSIBILITY_CLS: Record<Irreversibility, string> = {
  none: 'text-green-700 dark:text-green-400',
  partial: 'text-yellow-700 dark:text-yellow-400',
  full: 'text-red-600 dark:text-red-400 font-medium',
};

const IRREVERSIBILITY_LABEL: Record<Irreversibility, string> = {
  none: 'None',
  partial: 'Partial',
  full: 'Full',
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function PoliciesPage() {
  const navigate = useNavigate();
  const policies = POLICY_ROWS;

  const columns = [
    {
      key: 'policyId',
      header: 'Policy ID',
      width: '120px',
      render: (row: GovernancePolicyRow) => (
        <span className="text-muted-foreground font-mono text-[11px]">{row.policyId}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row: GovernancePolicyRow) => (
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="font-medium">{row.name}</span>
        </span>
      ),
    },
    {
      key: 'trigger',
      header: 'Trigger',
      render: (row: GovernancePolicyRow) => (
        <span className="font-mono text-[11px] text-muted-foreground">{row.trigger}</span>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      width: '150px',
      render: (row: GovernancePolicyRow) => <ExecutionTierBadge tier={row.tier} />,
    },
    {
      key: 'blastRadius',
      header: 'Blast Radius',
      render: (row: GovernancePolicyRow) =>
        row.blastRadius.length === 0 ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.blastRadius.map((sor) => (
              <span
                key={sor}
                className="inline-flex items-center gap-1 text-[11px] border border-border rounded-full px-2 py-0.5 bg-background"
              >
                <SorBadge name={sor} />
                {sor}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: 'irreversibility',
      header: 'Irreversibility',
      width: '120px',
      render: (row: GovernancePolicyRow) => (
        <span className={`text-xs ${IRREVERSIBILITY_CLS[row.irreversibility]}`}>
          {IRREVERSIBILITY_LABEL[row.irreversibility]}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row: GovernancePolicyRow) => (
        <Badge variant={row.status === 'Active' ? 'default' : 'secondary'} className="text-[11px]">
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Governance Policies"
        description="Policy rules that govern agent actions and approval workflows"
        icon={<EntityIcon entityType="policy" size="md" decorative />}
        action={
          <Button variant="outline" size="sm" disabled>
            <Plus className="h-4 w-4 mr-1" />
            Create Policy
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={policies}
        loading={false}
        getRowKey={(row) => row.policyId}
        pagination={{ pageSize: 20 }}
        onRowClick={(row) => {
          void navigate({
            to: '/config/policies/$policyId' as string,
            params: { policyId: row.policyId },
          });
        }}
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/policies',
  component: PoliciesPage,
});
