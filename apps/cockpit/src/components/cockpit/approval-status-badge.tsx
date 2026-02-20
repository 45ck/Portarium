import type { ApprovalStatus } from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
}

const config: Record<
  ApprovalStatus,
  { label: string; variant: 'default' | 'destructive' | 'outline'; className: string }
> = {
  Pending: { label: 'Pending', variant: 'outline', className: 'border-warning text-warning' },
  Approved: {
    label: 'Approved',
    variant: 'default',
    className: 'bg-success text-success-foreground',
  },
  Denied: { label: 'Denied', variant: 'destructive', className: '' },
  RequestChanges: {
    label: 'Request Changes',
    variant: 'outline',
    className: 'border-orange-400 text-orange-600',
  },
};

const fallback = { label: 'Unknown', variant: 'outline' as const, className: '' };

export function ApprovalStatusBadge({ status }: ApprovalStatusBadgeProps) {
  const { label, variant, className } = config[status] ?? fallback;
  return (
    <Badge variant={variant} className={cn('text-[10px]', className)}>
      {label}
    </Badge>
  );
}
