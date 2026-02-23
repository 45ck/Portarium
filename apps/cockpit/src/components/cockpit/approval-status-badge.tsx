import type { ApprovalStatus } from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
}

const config: Record<
  ApprovalStatus,
  {
    icon: React.ElementType;
    label: string;
    variant: 'default' | 'destructive' | 'outline';
    className: string;
  }
> = {
  Pending: {
    icon: Clock,
    label: 'Pending',
    variant: 'outline',
    className: 'border-warning text-warning',
  },
  Approved: {
    icon: CheckCircle2,
    label: 'Approved',
    variant: 'default',
    className: 'bg-success text-success-foreground',
  },
  Denied: { icon: XCircle, label: 'Denied', variant: 'destructive', className: '' },
  RequestChanges: {
    icon: RefreshCw,
    label: 'Request Changes',
    variant: 'outline',
    className: 'border-orange-400 text-orange-600',
  },
};

const fallback = {
  icon: Clock,
  label: 'Unknown',
  variant: 'outline' as const,
  className: '',
};

export function ApprovalStatusBadge({ status }: ApprovalStatusBadgeProps) {
  const { icon: Icon, label, variant, className } = config[status] ?? fallback;
  return (
    <Badge variant={variant} className={cn('text-[11px]', className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
