import { cn } from '@/lib/utils'
import type { ExternalObjectRef } from '@portarium/cockpit-types'

export function SorRefPill({ ref_ }: { ref_: ExternalObjectRef }) {
  const label = ref_.displayLabel ?? `${ref_.externalType}:${ref_.externalId}`
  const content = (
    <>
      <span className="text-[rgb(var(--muted))]">{ref_.sorName}</span>
      <span>{label}</span>
    </>
  )

  const classes = cn(
    'inline-flex items-center gap-1 rounded-full border-2 border-[rgb(var(--border))] px-2 py-0.5 text-xs font-black',
  )

  if (ref_.deepLinkUrl) {
    return (
      <a
        href={ref_.deepLinkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(classes, 'hover:bg-gray-50')}
      >
        {content}
      </a>
    )
  }

  return <span className={classes}>{content}</span>
}
