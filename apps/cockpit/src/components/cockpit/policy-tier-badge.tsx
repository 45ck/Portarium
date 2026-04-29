import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RunSummary } from '@portarium/cockpit-types';

const TIER_CLASS: Record<RunSummary['executionTier'], string> = {
  Auto: 'border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-300',
  Assisted:
    'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300',
  HumanApprove:
    'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300',
  ManualOnly: 'border-destructive/40 bg-destructive/10 text-destructive dark:border-destructive/60',
};

const TIER_LABEL: Record<RunSummary['executionTier'], string> = {
  Auto: 'AUTO',
  Assisted: 'ASSISTED',
  HumanApprove: 'HUMAN-APPROVE',
  ManualOnly: 'MANUAL-ONLY',
};

export function PolicyTierBadge({
  tier,
  className,
}: {
  tier: RunSummary['executionTier'];
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn('h-5 text-[11px]', TIER_CLASS[tier], className)}>
      {TIER_LABEL[tier]}
    </Badge>
  );
}
