import { useState } from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useRobots } from '@/hooks/queries/use-robots';
import { PageHeader } from '@/components/cockpit/page-header';
import { RobotStatusBadge } from '@/components/domain/robot-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RobotSummary, RobotClass } from '@/types/robotics';
import { Bot, MapPin } from 'lucide-react';

const CLASS_FILTERS: Array<{ label: string; value: RobotClass | 'All' }> = [
  { label: 'All', value: 'All' },
  { label: 'AMR', value: 'AMR' },
  { label: 'AGV', value: 'AGV' },
  { label: 'Manipulator', value: 'Manipulator' },
  { label: 'UAV', value: 'UAV' },
  { label: 'PLC', value: 'PLC' },
];

function heartbeatLabel(sec: number): string {
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

function RobotCard({ robot }: { robot: RobotSummary }) {
  const isEstopped = robot.status === 'E-Stopped';
  return (
    <article
      className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors"
      aria-label={`Robot ${robot.robotId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{robot.robotId}</p>
          <p className="text-xs text-muted-foreground">{robot.name}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[11px]">
            {robot.robotClass}
          </Badge>
          <RobotStatusBadge status={robot.status} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="text-muted-foreground">Last heartbeat</div>
        <div
          className={cn(
            robot.lastHeartbeatSec > 30 && 'text-yellow-600',
            robot.lastHeartbeatSec > 300 && 'text-red-600',
          )}
        >
          {heartbeatLabel(robot.lastHeartbeatSec)}
        </div>
        <div className="text-muted-foreground">Battery</div>
        <div className={cn(robot.batteryPct < 20 && 'text-red-600')}>{robot.batteryPct}%</div>
        <div className="text-muted-foreground">Mission</div>
        <div className={cn('truncate', isEstopped && 'text-muted-foreground italic')}>
          {isEstopped ? 'Halted' : (robot.missionId ?? '—')}
        </div>
      </div>
      <div className="flex gap-2">
        <Link to={`/robotics/map?robotId=${robot.robotId}` as string} className="flex-1">
          <Button variant="outline" size="sm" className="h-7 text-xs w-full gap-1">
            <MapPin className="h-3 w-3" />
            Map
          </Button>
        </Link>
        <Link to={`/robotics/robots/${robot.robotId}` as string} className="flex-1">
          <Button variant="outline" size="sm" className="h-7 text-xs w-full">
            Detail &rarr;
          </Button>
        </Link>
      </div>
    </article>
  );
}

function RobotsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading } = useRobots(wsId);
  const [classFilter, setClassFilter] = useState<RobotClass | 'All'>('All');

  const robots = data?.items ?? [];
  const filtered =
    classFilter === 'All' ? robots : robots.filter((r) => r.robotClass === classFilter);
  const stats = {
    total: robots.length,
    online: robots.filter((r) => r.status === 'Online').length,
    degraded: robots.filter((r) => r.status === 'Degraded').length,
    estop: robots.filter((r) => r.status === 'E-Stopped').length,
  };
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Robots"
        description="Fleet overview and per-robot controls"
        breadcrumb={[{ label: 'Robotics', to: '/robotics' }, { label: 'Robots' }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: isLoading ? '—' : stats.total },
          { label: 'Online', value: isLoading ? '—' : stats.online },
          { label: 'Degraded', value: isLoading ? '—' : stats.degraded },
          { label: 'E-Stopped', value: isLoading ? '—' : stats.estop },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Filter by robot class">
        {CLASS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setClassFilter(f.value)}
            aria-pressed={classFilter === f.value}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              classFilter === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/40',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-lg border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bot className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No robots match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((robot) => (
            <RobotCard key={robot.robotId} robot={robot} />
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/robots',
  component: RobotsPage,
});
