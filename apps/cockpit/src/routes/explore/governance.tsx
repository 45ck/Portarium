import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useEvidence } from '@/hooks/queries/use-evidence'
import { PageHeader } from '@/components/cockpit/page-header'
import { KpiRow } from '@/components/cockpit/kpi-row'
import { DataTable } from '@/components/cockpit/data-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'

interface SodConstraint {
  constraintId: string
  name: string
  description: string
  status: string
}

const SOD_CONSTRAINTS: SodConstraint[] = [
  {
    constraintId: 'sod-001',
    name: 'Approve \u2260 Initiate',
    description: 'Approval actor must differ from run initiator',
    status: 'Active',
  },
  {
    constraintId: 'sod-002',
    name: 'Finance Dual Control',
    description: 'Finance changes require 2 approvers',
    status: 'Active',
  },
  {
    constraintId: 'sod-003',
    name: 'IAM Review Independence',
    description: 'IAM reviewer cannot be a Finance team member',
    status: 'Active',
  },
]

const POLICIES = [
  'SOC 2 CC6.1 \u2014 Logical access controls',
  'GDPR Art. 25 \u2014 Data minimization',
  'ISO 27001 A.9 \u2014 Access management',
]

const sodColumns = [
  { key: 'name', header: 'Constraint' },
  { key: 'description', header: 'Description' },
  { key: 'status', header: 'Status', width: '100px' },
]

function ExploreGovernancePage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const { data: evidenceData, isLoading } = useEvidence(wsId)

  const recentAuditEntries = (evidenceData?.items ?? []).slice(0, 10)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Governance"
        description="Policy compliance and segregation of duties"
      />

      <KpiRow
        stats={[
          { label: 'SoD Constraints Active', value: 3 },
          { label: 'Policies Compliant', value: 12 },
          { label: 'Audit Entries (7d)', value: 4 },
        ]}
      />

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Segregation of Duties Constraints</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={sodColumns}
            data={SOD_CONSTRAINTS}
            getRowKey={(row) => row.constraintId}
          />
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Policy Compliance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {POLICIES.map((policy) => (
              <li key={policy} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>{policy}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Audit Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
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
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore/governance',
  component: ExploreGovernancePage,
})
