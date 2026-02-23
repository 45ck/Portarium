import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Plus, AlertCircle, RotateCcw, Wifi, WifiOff, Activity } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useMachines } from '@/hooks/queries/use-machines';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RegisterMachineDialog } from '@/components/cockpit/register-machine-dialog';
import type { MachineV1, MachineStatus } from '@portarium/cockpit-types';

function statusVariant(status: MachineStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'Online':
      return 'default';
    case 'Degraded':
      return 'secondary';
    case 'Offline':
      return 'destructive';
  }
}

function StatusIcon({ status }: { status: MachineStatus }) {
  switch (status) {
    case 'Online':
      return <Wifi className="h-3.5 w-3.5 text-green-500 shrink-0" aria-hidden="true" />;
    case 'Degraded':
      return <Activity className="h-3.5 w-3.5 text-yellow-500 shrink-0" aria-hidden="true" />;
    case 'Offline':
      return <WifiOff className="h-3.5 w-3.5 text-destructive shrink-0" aria-hidden="true" />;
  }
}

function MachinesPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading, isError, refetch } = useMachines(wsId);
  const [registerOpen, setRegisterOpen] = useState(false);

  const machines = data?.items ?? [];

  const columns = [
    {
      key: 'hostname',
      header: 'Hostname',
      render: (row: MachineV1) => (
        <span className="flex items-center gap-2">
          <EntityIcon entityType="machine" size="sm" decorative />
          <span className="font-medium font-mono text-sm">{row.hostname}</span>
        </span>
      ),
    },
    {
      key: 'machineId',
      header: 'Machine ID',
      render: (row: MachineV1) => (
        <span className="text-muted-foreground font-mono text-[11px]">{row.machineId}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row: MachineV1) => (
        <span className="flex items-center gap-1.5">
          <StatusIcon status={row.status} />
          <Badge variant={statusVariant(row.status)} className="text-xs">
            {row.status}
          </Badge>
        </span>
      ),
    },
    {
      key: 'osImage',
      header: 'OS',
      width: '150px',
      render: (row: MachineV1) => (
        <span className="text-muted-foreground text-sm">{row.osImage ?? '—'}</span>
      ),
    },
    {
      key: 'activeRunCount',
      header: 'Active Runs',
      width: '110px',
      render: (row: MachineV1) => <Badge variant="secondary">{row.activeRunCount ?? 0}</Badge>,
    },
    {
      key: 'lastHeartbeat',
      header: 'Last Heartbeat',
      render: (row: MachineV1) => {
        if (!row.lastHeartbeatAtIso) return <span className="text-muted-foreground">—</span>;
        const d = new Date(row.lastHeartbeatAtIso);
        return (
          <span className="text-muted-foreground text-sm" title={row.lastHeartbeatAtIso}>
            {d.toLocaleString()}
          </span>
        );
      },
    },
  ];

  if (isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Machines"
          description="Edge machines and gateways registered in this workspace"
          icon={<EntityIcon entityType="machine" size="md" decorative />}
        />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load machines</p>
            <p className="text-xs text-muted-foreground">An error occurred while fetching data.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Machines"
        description="Edge machines and gateways registered in this workspace"
        icon={<EntityIcon entityType="machine" size="md" decorative />}
        action={
          <Button variant="outline" size="sm" onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Register Machine
          </Button>
        }
      />

      <RegisterMachineDialog open={registerOpen} onOpenChange={setRegisterOpen} />

      <DataTable
        columns={columns}
        data={machines}
        loading={isLoading}
        getRowKey={(row) => row.machineId}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/machines',
  component: MachinesPage,
});
