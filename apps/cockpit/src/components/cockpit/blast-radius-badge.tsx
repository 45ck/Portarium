import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BlastRadiusLevel } from '@/components/cockpit/engineering-beads';

const BLAST_CLASS: Record<BlastRadiusLevel, string> = {
  low: 'border-border bg-muted text-muted-foreground',
  medium:
    'border-yellow-300 bg-yellow-100 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  high: 'border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300',
  critical: 'border-destructive/40 bg-destructive/10 text-destructive dark:border-destructive/60',
};

export function BlastRadiusBadge({
  level,
  className,
}: {
  level: BlastRadiusLevel;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn('h-5 text-[11px]', BLAST_CLASS[level], className)}>
      {level}
    </Badge>
  );
}
