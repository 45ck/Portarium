import { useState } from 'react';
import { createRoute, Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useRobot } from '@/hooks/queries/use-robots';
import { useMissions } from '@/hooks/queries/use-missions';
import { useRobotLocations } from '@/hooks/queries/use-robot-locations';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { RelatedEntities } from '@/components/cockpit/related-entities';
import type { RelatedEntity } from '@/components/cockpit/related-entities';
import { MapView } from '@/components/cockpit/operations-map/map-view';
import { DataTable } from '@/components/cockpit/data-table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { RobotStatusBadge } from '@/components/domain/robot-status-badge';
import { MissionStatusBadge } from '@/components/domain/mission-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { MissionSummary } from '@/types/robotics';
import type { LayerVisibility } from '@/components/cockpit/operations-map/layer-toggles';
import { Target, MapPin } from 'lucide-react';

function RobotDetailPage() {
  const { robotId } = Route.useParams();
  const { activeWorkspaceId: wsId } = useUIStore();
  const navigate = useNavigate();
  const [estopDialogOpen, setEstopDialogOpen] = useState(false);
  const [layers, setLayers] = useState<LayerVisibility>({
    geofences: true,
    trails: true,
    halos: true,
  });

  const { data: robot, isLoading, isError } = useRobot(wsId, robotId);
  const { data: missionsData } = useMissions(wsId);
  const { data: locationsData } = useRobotLocations(wsId);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !robot) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Robot Not Found"
          icon={<EntityIcon entityType="robot" size="md" decorative />}
        />
        <p className="text-sm text-muted-foreground">The robot could not be loaded.</p>
        <Link to={'/robotics/robots' as string}>
          <Button variant="outline" size="sm">
            Back to Robots
          </Button>
        </Link>
      </div>
    );
  }

  const isEstopped = robot.status === 'E-Stopped';
  const robotMissions = (missionsData?.items ?? []).filter((m) => m.robotId === robotId);
  const robotLocations = (locationsData?.items ?? []).filter((l) => l.robotId === robotId);
  const geofences = locationsData?.geofences ?? [];

  const relatedEntities: RelatedEntity[] = [];
  if (robot.missionId) {
    relatedEntities.push({
      type: 'workflow',
      id: robot.missionId,
      label: robot.missionId,
      href: `/robotics/missions/${robot.missionId}`,
      sublabel: 'Active mission',
    });
  }
  relatedEntities.push({
    type: 'adapter',
    id: robot.gatewayUrl,
    label: robot.gatewayUrl,
    href: '/robotics/gateways',
    sublabel: 'Gateway',
  });
  relatedEntities.push({
    type: 'robot',
    id: 'safety',
    label: 'Safety Constraints',
    href: '/robotics/safety',
  });

  const missionColumns = [
    {
      key: 'missionId',
      header: 'ID',
      width: '110px',
      render: (row: MissionSummary) => (
        <Link
          to={`/robotics/missions/${row.missionId}` as string}
          className="font-mono text-xs text-primary hover:underline"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {row.missionId}
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
      key: 'priority',
      header: 'Priority',
      width: '80px',
      render: (row: MissionSummary) => <span className="text-xs">{row.priority}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={robot.name}
        icon={<EntityIcon entityType="robot" size="md" decorative />}
        breadcrumb={[
          { label: 'Robotics', to: '/robotics' },
          { label: 'Robots', to: '/robotics/robots' },
          { label: robot.name },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <RobotStatusBadge status={robot.status} />
        <Badge variant="outline" className="text-[11px]">
          {robot.robotClass}
        </Badge>
        {!isEstopped && (
          <Button variant="destructive" size="sm" onClick={() => setEstopDialogOpen(true)}>
            Send E-Stop
          </Button>
        )}
        {isEstopped && (
          <Button variant="outline" size="sm">
            Clear E-Stop (admin)
          </Button>
        )}
      </div>

      <AlertDialog open={estopDialogOpen} onOpenChange={setEstopDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send E-Stop to {robot.robotId}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately halt {robot.name}. This action is logged in the evidence chain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                toast.success(`E-Stop sent to ${robot.robotId}`);
                setEstopDialogOpen(false);
              }}
            >
              Confirm E-Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="missions">Missions ({robotMissions.length})</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="shadow-none mt-2">
              <CardContent className="pt-4 space-y-6">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Identity
                  </h3>
                  <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
                    <dt className="text-muted-foreground">Robot ID</dt>
                    <dd className="font-mono text-xs">{robot.robotId}</dd>
                    <dt className="text-muted-foreground">Class</dt>
                    <dd>{robot.robotClass}</dd>
                    <dt className="text-muted-foreground">SPIFFE SVID</dt>
                    <dd className="font-mono text-xs break-all">{robot.spiffeSvid}</dd>
                    <dt className="text-muted-foreground">Gateway</dt>
                    <dd className="font-mono text-xs break-all">{robot.gatewayUrl}</dd>
                  </dl>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Status
                  </h3>
                  <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <RobotStatusBadge status={robot.status} />
                    </dd>
                    <dt className="text-muted-foreground">Battery</dt>
                    <dd>
                      <div className="flex items-center gap-2">
                        <span className={cn(robot.batteryPct < 20 && 'text-red-600 font-medium')}>
                          {robot.batteryPct}%
                        </span>
                        <Progress value={robot.batteryPct} className="h-1.5 w-24" />
                      </div>
                    </dd>
                    <dt className="text-muted-foreground">Last heartbeat</dt>
                    <dd>
                      {robot.lastHeartbeatSec < 60
                        ? `${robot.lastHeartbeatSec}s ago`
                        : `${Math.floor(robot.lastHeartbeatSec / 60)}m ago`}
                    </dd>
                    <dt className="text-muted-foreground">Active mission</dt>
                    <dd>
                      {robot.missionId ? (
                        <Link
                          to={`/robotics/missions/${robot.missionId}` as string}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {robot.missionId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground italic">None</span>
                      )}
                    </dd>
                  </dl>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Capabilities
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {robot.capabilities.map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-xs">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </section>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="missions">
            <Card className="shadow-none mt-2">
              <CardContent className="pt-4">
                {robotMissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Target className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No missions recorded for this robot.</p>
                    <Link to={'/robotics/missions' as string} className="mt-2">
                      <Button variant="outline" size="sm" className="text-xs">
                        View all missions
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <DataTable
                    columns={missionColumns}
                    data={robotMissions}
                    loading={false}
                    getRowKey={(row) => row.missionId}
                    onRowClick={(row) => {
                      navigate({ to: `/robotics/missions/${row.missionId}` as string });
                    }}
                    pagination={{ pageSize: 10 }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map">
            <Card className="shadow-none mt-2">
              <CardContent className="pt-4">
                {robotLocations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MapPin className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No location data available for this robot.</p>
                    <Link to={'/robotics/map' as string} className="mt-2">
                      <Button variant="outline" size="sm" className="text-xs">
                        Open full map
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="h-[400px] rounded-lg overflow-hidden border border-border">
                    <MapView
                      locations={robotLocations}
                      geofences={geofences}
                      selectedRobotId={robotId}
                      onSelectRobot={() => {}}
                      layers={layers}
                      onLayersChange={setLayers}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <RelatedEntities entities={relatedEntities} />
        </div>
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/robots/$robotId',
  component: RobotDetailPage,
});
