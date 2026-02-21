import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MissionSummary } from '@/types/robotics';
import { Circle, RotateCcw, CheckCircle2, XCircle, OctagonX } from 'lucide-react';

const CONFIG: Record<
  MissionSummary['status'],
  { label: string; icon: React.ReactNode; className: string }
> = {
  Pending: {
    label: 'Pending',
    icon: <Circle className="h-3 w-3" />,
    className: 'bg-muted text-muted-foreground border-border',
  },
  Executing: {
    label: 'Executing',
    icon: <RotateCcw className="h-3 w-3 animate-spin" />,
    className: 'bg-info/10 text-info border-info/30',
  },
  Completed: {
    label: 'Completed',
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: 'bg-success/10 text-success border-success/30',
  },
  Failed: {
    label: 'Failed',
    icon: <XCircle className="h-3 w-3" />,
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  Cancelled: {
    label: 'Cancelled',
    icon: <OctagonX className="h-3 w-3" />,
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
};

export function MissionStatusBadge({ status }: { status: MissionSummary['status'] }) {
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
