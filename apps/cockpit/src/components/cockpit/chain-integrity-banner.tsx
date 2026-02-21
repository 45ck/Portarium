import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

interface ChainIntegrityBannerProps {
  status: 'verified' | 'broken' | 'pending';
}

const config: Record<
  ChainIntegrityBannerProps['status'],
  {
    icon: React.ElementType;
    label: string;
    colorClasses: string;
    iconColor: string;
  }
> = {
  verified: {
    icon: ShieldCheck,
    label: 'Chain verified — all hashes valid',
    colorClasses: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    iconColor: 'text-emerald-600',
  },
  broken: {
    icon: ShieldAlert,
    label: 'Chain BROKEN — hash verification failed',
    colorClasses: 'bg-red-50 border-red-200 text-red-800',
    iconColor: 'text-red-600',
  },
  pending: {
    icon: ShieldQuestion,
    label: 'Chain verification pending',
    colorClasses: 'bg-muted/30 border-border text-muted-foreground',
    iconColor: 'text-muted-foreground',
  },
};

export function ChainIntegrityBanner({ status }: ChainIntegrityBannerProps) {
  const { icon: Icon, label, colorClasses, iconColor } = config[status];
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium',
        colorClasses,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', iconColor)} />
      <span>{label}</span>
    </div>
  );
}
