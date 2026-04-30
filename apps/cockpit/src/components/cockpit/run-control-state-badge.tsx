import { AlertTriangle, Clock, Lock, ShieldAlert, UserCheck } from 'lucide-react';
import type { ElementType } from 'react';
import type { RunControlState } from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RunControlStateBadgeProps {
  state: RunControlState | undefined;
}

const config: Record<
  RunControlState,
  {
    icon: ElementType;
    label: string;
    className: string;
    variant: 'secondary' | 'destructive' | 'outline';
  }
> = {
  waiting: {
    icon: Clock,
    label: 'Waiting',
    variant: 'outline',
    className: 'border-warning text-warning',
  },
  blocked: {
    icon: Lock,
    label: 'Blocked',
    variant: 'destructive',
    className: '',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degraded',
    variant: 'outline',
    className: 'border-warning text-warning',
  },
  frozen: {
    icon: ShieldAlert,
    label: 'Frozen',
    variant: 'destructive',
    className: '',
  },
  'operator-owned': {
    icon: UserCheck,
    label: 'Operator-owned',
    variant: 'secondary',
    className: '',
  },
};

export function RunControlStateBadge({ state }: RunControlStateBadgeProps) {
  if (!state) return null;
  const { icon: Icon, label, variant, className } = config[state];
  return (
    <Badge variant={variant} className={cn('text-[11px]', className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
