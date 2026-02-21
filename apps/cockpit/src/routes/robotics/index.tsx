import { createRoute, Link } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useRobots } from '@/hooks/queries/use-robots';
import { useMissions } from '@/hooks/queries/use-missions';
import { useRobotLocations } from '@/hooks/queries/use-robot-locations';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, MapPin, Target, ShieldCheck, Radio, Info } from 'lucide-react';

const ROBOTICS_SECTIONS = [
  {
    title: 'Robots',
    description: 'Fleet status, battery levels, and live heartbeats for all registered robots.',
    href: '/robotics/robots',
    icon: <Bot className="h-5 w-5" />,
  },
  {
    title: 'Operations Map',
    description: 'Real-time geofenced map of robot locations across all warehouse sites.',
    href: '/robotics/map',
    icon: <MapPin className="h-5 w-5" />,
  },
  {
    title: 'Missions',
    description: 'Dispatched mission queue with status tracking and execution-tier breakdown.',
    href: '/robotics/missions',
    icon: <Target className="h-5 w-5" />,
  },
  {
    title: 'Safety',
    description: 'Speed constraints, approval thresholds, and E-Stop audit log.',
    href: '/robotics/safety',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: 'Gateways',
    description: 'OpenClaw gateway connectivity and SPIFFE/X.509 attestation status.',
    href: '/robotics/gateways',
    icon: <Radio className="h-5 w-5" />,
  },
];

function RoboticsIndexPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data: robotsData } = useRobots(wsId);
  const { data: missionsData } = useMissions(wsId);
  const { data: locData } = useRobotLocations(wsId);

  const robots = robotsData?.items ?? [];
  const missions = missionsData?.items ?? [];
  const alerts = locData?.alerts ?? [];

  const onlineCount = robots.filter((r) => r.status === 'Online').length;
  const activeMissions = missions.filter((m) => m.status === 'Executing').length;
  const alertCount = alerts.length;

  const stats = [
    { label: 'Robots Online', value: onlineCount, total: robots.length },
    { label: 'Active Missions', value: activeMissions },
    { label: 'Spatial Alerts', value: alertCount },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Robotics"
        description="Fleet management, mission control, and safety governance"
        icon={<EntityIcon entityType="robot" size="md" decorative />}
      />

      {/* Live stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">
              {s.value}
              {s.total != null && (
                <span className="text-sm font-normal text-muted-foreground"> / {s.total}</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Robot-workflow relationship callout */}
      <div className="rounded-md border border-info/30 bg-info/5 px-4 py-3 flex gap-3">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How robots connect to workflows</p>
          <p>
            Workflows dispatch missions to robots via the <strong>RoboticsActuation</strong> port.
            Each mission produces evidence in the governance chain. Both domains share the same
            governance model — policies, approvals, execution tiers, and audit.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROBOTICS_SECTIONS.map((section) => (
          <Link key={section.href} to={section.href as string}>
            <Card className="shadow-none hover:bg-muted/40 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{section.icon}</span>
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">{section.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics',
  component: RoboticsIndexPage,
});
