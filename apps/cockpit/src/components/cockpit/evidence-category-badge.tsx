import type { EvidenceCategory } from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EvidenceCategoryBadgeProps {
  category: EvidenceCategory;
}

const config: Record<EvidenceCategory, { label: string; className: string }> = {
  Plan: { label: 'Plan', className: 'bg-primary/10 text-primary' },
  Action: { label: 'Action', className: 'bg-info/10 text-info' },
  Approval: { label: 'Approval', className: 'bg-warning/10 text-warning' },
  Policy: { label: 'Policy', className: 'bg-destructive/10 text-destructive' },
  PolicyViolation: {
    label: 'Policy Violation',
    className: 'bg-destructive text-destructive-foreground',
  },
  System: { label: 'System', className: 'bg-muted text-muted-foreground' },
};

export function EvidenceCategoryBadge({ category }: EvidenceCategoryBadgeProps) {
  const { label, className } = config[category];
  return (
    <Badge variant="secondary" className={cn('text-[10px]', className)}>
      {label}
    </Badge>
  );
}

export const EVIDENCE_CATEGORY_COLORS = config;
