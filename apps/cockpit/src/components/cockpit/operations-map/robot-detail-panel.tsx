import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { RobotLocation } from '@/mocks/fixtures/robot-locations';
import type { RobotStatus } from '@/types/robotics';
import {
  X,
  Wifi,
  WifiOff,
  AlertTriangle,
  OctagonX,
  Battery,
  Navigation,
  MapPin,
  ExternalLink,
} from 'lucide-react';

const STATUS_ICON: Record<RobotStatus, React.ReactNode> = {
  Online: <Wifi className="h-3 w-3" />,
  Degraded: <AlertTriangle className="h-3 w-3" />,
  'E-Stopped': <OctagonX className="h-3 w-3" />,
  Offline: <WifiOff className="h-3 w-3" />,
};

const STATUS_BADGE_CLASS: Record<RobotStatus, string> = {
  Online: 'bg-green-100 text-green-800 border-green-200',
  Degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'E-Stopped': 'bg-red-100 text-red-800 border-red-200',
  Offline: 'bg-muted text-muted-foreground border-border',
};

interface RobotDetailPanelProps {
  robot: RobotLocation;
  onClose: () => void;
}

export function RobotDetailPanel({ robot, onClose }: RobotDetailPanelProps) {
  return (
    <div className="border-t border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h3 className="text-sm font-semibold">{robot.name}</h3>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <Badge
            variant="outline"
            className={cn(
              'mt-1 flex w-fit items-center gap-1 text-[11px]',
              STATUS_BADGE_CLASS[robot.status],
            )}
          >
            {STATUS_ICON[robot.status]}
            {robot.status}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Battery
          </p>
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-1.5 text-sm">
              <Battery className="h-3.5 w-3.5 text-muted-foreground" />
              <span className={cn(robot.batteryPct < 20 && 'text-red-600 font-medium')}>
                {robot.batteryPct}%
              </span>
            </div>
            <Progress value={robot.batteryPct} className="h-1.5" />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Class
          </p>
          <Badge variant="secondary" className="mt-1 text-[11px]">
            {robot.robotClass}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Speed
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-sm">
            <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
            {robot.speedMps > 0 ? `${robot.speedMps.toFixed(1)} m/s` : 'Stationary'}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Position
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-mono text-xs">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            {robot.lat.toFixed(5)}, {robot.lng.toFixed(5)}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Mission
          </p>
          <p className="mt-1 text-sm">
            {robot.missionId ? (
              <Link
                to={`/robotics/missions/${robot.missionId}` as string}
                className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                {robot.missionId}
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            ) : (
              <span className="text-muted-foreground italic">None</span>
            )}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Last Updated
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(robot.updatedAtIso).toLocaleString()}
          </p>
        </div>
        <div className="col-span-2">
          <Link
            to={`/robotics/robots/${robot.robotId}` as string}
            className="inline-flex items-center gap-1"
          >
            <Button variant="outline" size="sm" className="h-7 text-xs w-full gap-1">
              Open Robot Page
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
