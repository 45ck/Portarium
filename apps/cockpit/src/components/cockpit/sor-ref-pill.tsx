import type { ExternalObjectRef } from '@portarium/cockpit-types'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'

interface SorRefPillProps {
  externalRef: ExternalObjectRef
}

export function SorRefPill({ externalRef }: SorRefPillProps) {
  const content = (
    <Badge variant="outline" className="text-[10px] gap-1">
      <span className="font-medium">{externalRef.sorName}</span>
      {externalRef.displayLabel && (
        <span className="text-muted-foreground">{externalRef.displayLabel}</span>
      )}
      {externalRef.deepLinkUrl && <ExternalLink className="h-2.5 w-2.5" />}
    </Badge>
  )

  if (externalRef.deepLinkUrl) {
    return (
      <a href={externalRef.deepLinkUrl} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }

  return content
}
