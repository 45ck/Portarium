import type { HumanTaskStatus } from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, UserCheck, Play, CheckCircle2, AlertTriangle } from 'lucide-react';

interface HumanTaskStatusBadgeProps {
  status: HumanTaskStatus;
}

const config: Record<
  HumanTaskStatus,
  {
    icon: React.ElementType;
    label: string;
    variant: 'default' | 'destructive' | 'outline' | 'secondary';
    className: string;
  }
> = {
  pending: {
    icon: Clock,
    label: 'Pending',
    variant: 'outline',
    className: 'border-warning text-warning',
  },
  assigned: {
    icon: UserCheck,
    label: 'Assigned',
    variant: 'outline',
    className: 'border-info text-info',
  },
  'in-progress': {
    icon: Play,
    label: 'In Progress',
    variant: 'default',
    className: 'bg-info text-info-foreground',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    variant: 'default',
    className: 'bg-success text-success-foreground',
  },
  escalated: {
    icon: AlertTriangle,
    label: 'Escalated',
    variant: 'destructive',
    className: '',
  },
};

export function HumanTaskStatusBadge({ status }: HumanTaskStatusBadgeProps) {
  const { icon: Icon, label, variant, className } = config[status];
  return (
    <Badge variant={variant} className={cn('text-[11px]', className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
