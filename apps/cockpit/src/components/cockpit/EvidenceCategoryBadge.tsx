import { Badge } from '@/components/ui/badge'
import { ClipboardList, Cog, Play, Scale, ShieldCheck } from 'lucide-react'
import type { EvidenceCategory } from '@portarium/cockpit-types'

const categoryConfig: Record<
  EvidenceCategory,
  {
    variant: 'info' | 'ok' | 'warn' | 'danger' | 'muted'
    icon: typeof ClipboardList
  }
> = {
  Plan: { variant: 'info', icon: ClipboardList },
  Action: { variant: 'ok', icon: Play },
  Approval: { variant: 'warn', icon: ShieldCheck },
  Policy: { variant: 'danger', icon: Scale },
  System: { variant: 'muted', icon: Cog },
}

export function EvidenceCategoryBadge({ category }: { category: EvidenceCategory }) {
  const { variant, icon: Icon } = categoryConfig[category]

  return (
    <Badge variant={variant} aria-label={`Evidence category: ${category}`}>
      <Icon className="mr-1 inline-block h-3 w-3" aria-hidden="true" />
      {category}
    </Badge>
  )
}
