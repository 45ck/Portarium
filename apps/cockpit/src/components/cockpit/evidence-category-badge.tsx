import type { EvidenceCategory } from '@portarium/cockpit-types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface EvidenceCategoryBadgeProps {
  category: EvidenceCategory
}

const config: Record<EvidenceCategory, { label: string; className: string }> = {
  Plan:     { label: 'Plan',     className: 'bg-purple-100 text-purple-700' },
  Action:   { label: 'Action',   className: 'bg-blue-100 text-blue-700' },
  Approval: { label: 'Approval', className: 'bg-yellow-100 text-yellow-700' },
  Policy:   { label: 'Policy',   className: 'bg-orange-100 text-orange-700' },
  System:   { label: 'System',   className: 'bg-gray-100 text-gray-700' },
}

export function EvidenceCategoryBadge({ category }: EvidenceCategoryBadgeProps) {
  const { label, className } = config[category]
  return (
    <Badge variant="secondary" className={cn('text-[10px]', className)}>
      {label}
    </Badge>
  )
}

export const EVIDENCE_CATEGORY_COLORS = config
