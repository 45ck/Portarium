import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { format } from 'date-fns';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useGateways } from '@/hooks/queries/use-gateways';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { GatewaySummary } from '@portarium/cockpit-types';

const statusClassName: Record<string, string> = {
  Online: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  Offline: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950',
  Degraded: 'text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-950',
};

function GatewaysPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading } = useGateways(wsId);
  const [selected, setSelected] = useState<GatewaySummary | null>(null);

  const gateways = data?.items ?? [];

  const columns = [
    {
      key: 'gatewayId',
      header: 'Gateway ID',
      render: (row: GatewaySummary) => (
        <span className="font-mono text-[11px]">{row.gatewayId}</span>
      ),
    },
    {
      key: 'url',
      header: 'URL',
      render: (row: GatewaySummary) => (
        <span className="font-mono text-[11px] text-muted-foreground">{row.url}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row: GatewaySummary) => (
        <Badge variant="secondary" className={statusClassName[row.status]}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'connectedRobots',
      header: 'Robots',
      width: '80px',
      render: (row: GatewaySummary) => (
        <Badge variant="secondary">{row.connectedRobots}</Badge>
      ),
    },
    {
      key: 'lastHeartbeatIso',
      header: 'Last Heartbeat',
      width: '160px',
      render: (row: GatewaySummary) =>
        format(new Date(row.lastHeartbeatIso), 'MMM d, yyyy HH:mm'),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Gateways"
        description="Robotics gateway connections and status"
        icon={<EntityIcon entityType="port" size="md" decorative />}
      />

      <DataTable
        columns={columns}
        data={gateways}
        loading={isLoading}
        getRowKey={(row) => row.gatewayId}
        onRowClick={(row) => setSelected(row)}
        pagination={{ pageSize: 20 }}
      />

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected?.gatewayId}</SheetTitle>
            <SheetDescription>{selected?.url}</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-4">
              <div>
                <div className="text-xs font-medium mb-1">Status</div>
                <Badge variant="secondary" className={statusClassName[selected.status]}>
                  {selected.status}
                </Badge>
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Region</div>
                <span className="text-sm">{selected.region}</span>
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Connected Robots</div>
                <span className="text-sm">{selected.connectedRobots}</span>
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Last Heartbeat</div>
                <span className="text-sm">
                  {format(new Date(selected.lastHeartbeatIso), 'MMM d, yyyy HH:mm:ss')}
                </span>
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
  path: '/robotics/gateways',
  component: GatewaysPage,
});
