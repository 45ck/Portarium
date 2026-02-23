import { Badge } from '@/components/ui/badge';
import { Zap, Users, UserCheck, Hand } from 'lucide-react';

interface ExecutionTierBadgeProps {
  tier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
}

const config: Record<ExecutionTierBadgeProps['tier'], { icon: React.ElementType; label: string }> =
  {
    Auto: { icon: Zap, label: 'Auto' },
    Assisted: { icon: Users, label: 'Assisted' },
    HumanApprove: { icon: UserCheck, label: 'Human Approve' },
    ManualOnly: { icon: Hand, label: 'Manual Only' },
  };

const fallback = { icon: Zap, label: 'Unknown' };

export function ExecutionTierBadge({ tier }: ExecutionTierBadgeProps) {
  const { icon: Icon, label } = config[tier] ?? fallback;
  return (
    <Badge variant="secondary" className="text-[11px]">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
