import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RobotSummary } from '@/types/robotics';
import { Wifi, WifiOff, AlertTriangle, OctagonX } from 'lucide-react';

const CONFIG: Record<
  RobotSummary['status'],
  { label: string; icon: React.ReactNode; className: string }
> = {
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
};

export function RobotStatusBadge({ status }: { status: RobotSummary['status'] }) {
  const c = CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={cn('flex items-center gap-1 text-[11px]', c.className)}
      aria-label={status}
    >
      {c.icon}
      {c.label}
    </Badge>
  );
}
