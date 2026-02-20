import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useRobots } from '@/hooks/queries/use-robots';
import { useMissions } from '@/hooks/queries/use-missions';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { RobotSummary, RobotClass } from '@/types/robotics';
import { Bot, Wifi, WifiOff, AlertTriangle, OctagonX } from 'lucide-react';

const CLASS_FILTERS: Array<{ label: string; value: RobotClass | 'All' }> = [
  { label: 'All', value: 'All' },
  { label: 'AMR', value: 'AMR' },
  { label: 'AGV', value: 'AGV' },
  { label: 'Manipulator', value: 'Manipulator' },
  { label: 'UAV', value: 'UAV' },
  { label: 'PLC', value: 'PLC' },
];

function RobotStatusBadge({ status }: { status: RobotSummary['status'] }) {
  const config = {
    Online: {
      label: 'Online',
      icon: <Wifi className="h-3 w-3" />,
      className: 'bg-success/10 text-success border-success/30',
    },
    Degraded: {
      label: 'Degraded',
      icon: <AlertTriangle className="h-3 w-3" />,
      className: 'bg-warning/10 text-warning border-warning/30',
    },
    'E-Stopped': {
      label: 'E-Stopped',
      icon: <OctagonX className="h-3 w-3" />,
      className: 'bg-destructive/10 text-destructive border-destructive/30',
    },
    Offline: {
      label: 'Offline',
      icon: <WifiOff className="h-3 w-3" />,
      className: 'bg-muted text-muted-foreground border-border',
    },
  }[status];

  return (
    <Badge
      variant="outline"
      className={cn('flex items-center gap-1 text-[11px]', config.className)}
      aria-label={status}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}

function heartbeatLabel(sec: number): string {
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

function RobotCard({
  robot,
  onDetail,
}: {
  robot: RobotSummary;
  onDetail: (r: RobotSummary) => void;
}) {
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
          <Badge variant="outline" className="text-[10px]">
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
        <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
          Test ↺
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={() => onDetail(robot)}
        >
          Detail →
        </Button>
      </div>
    </article>
  );
}

function RobotDetailSheet({
  robot,
  missionGoal,
  open,
  onClose,
}: {
  robot: RobotSummary | null;
  missionGoal?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  if (!robot) return null;
  const isEstopped = robot.status === 'E-Stopped';
  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            {robot.robotId}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Identity
            </h3>
            <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
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
              <dd className={cn(robot.batteryPct < 20 && 'text-red-600 font-medium')}>
                {robot.batteryPct}%
              </dd>
              <dt className="text-muted-foreground">Last heartbeat</dt>
              <dd>{heartbeatLabel(robot.lastHeartbeatSec)}</dd>
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
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Active Mission
            </h3>
            {robot.missionId ? (
              <p className="text-sm">
                <span className="font-mono text-xs">{robot.missionId}</span>
                {missionGoal && <span className="ml-2 text-muted-foreground">— {missionGoal}</span>}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No active mission</p>
            )}
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Actions
            </h3>
            {!showConfirm ? (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={isEstopped}
                  onClick={() => setShowConfirm(true)}
                  aria-label={`Send E-Stop to ${robot.robotId}`}
                >
                  Send E-Stop
                </Button>
                {isEstopped && (
                  <Button variant="outline" size="sm" className="flex-1">
                    Clear E-Stop (admin)
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-3">
                <p className="text-sm font-medium text-destructive">
                  Confirm E-Stop for {robot.robotId}?
                </p>
                <p className="text-xs text-muted-foreground">
                  This will immediately halt the robot. Action is logged.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowConfirm(false)}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RobotsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading } = useRobots(wsId);
  const { data: missionsData } = useMissions(wsId);
  const [classFilter, setClassFilter] = useState<RobotClass | 'All'>('All');
  const [selectedRobot, setSelectedRobot] = useState<RobotSummary | null>(null);

  const robots = data?.items ?? [];
  const missions = missionsData?.items ?? [];
  const filtered =
    classFilter === 'All' ? robots : robots.filter((r) => r.robotClass === classFilter);
  const stats = {
    total: robots.length,
    online: robots.filter((r) => r.status === 'Online').length,
    degraded: robots.filter((r) => r.status === 'Degraded').length,
    estop: robots.filter((r) => r.status === 'E-Stopped').length,
  };
  const selectedMission = selectedRobot?.missionId
    ? missions.find((m) => m.missionId === selectedRobot.missionId)
    : undefined;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Robots" description="Fleet overview and per-robot controls" />

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
            <RobotCard key={robot.robotId} robot={robot} onDetail={setSelectedRobot} />
          ))}
        </div>
      )}

      <RobotDetailSheet
        robot={selectedRobot}
        missionGoal={selectedMission?.goal}
        open={selectedRobot !== null}
        onClose={() => setSelectedRobot(null)}
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/robots',
  component: RobotsPage,
});
