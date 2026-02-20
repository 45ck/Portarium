import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PlanEffect, PredictedPlanEffect } from '@portarium/cockpit-types'
import { SorRefPill } from './SorRefPill'

const operationVariant: Record<string, 'ok' | 'info' | 'danger' | 'warn'> = {
  Create: 'ok',
  Update: 'info',
  Delete: 'danger',
  Upsert: 'warn',
}

function EffectRow({
  effect,
  confidence,
}: {
  effect: PlanEffect
  confidence?: number
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[rgb(var(--border)/0.2)] py-2 last:border-b-0">
      <Badge variant={operationVariant[effect.operation] ?? 'default'}>
        {effect.operation}
      </Badge>
      <SorRefPill ref_={effect.target} />
      <span className="flex-1 text-sm">{effect.summary}</span>
      {confidence != null && (
        <span className="text-xs text-[rgb(var(--muted))]">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  )
}

function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 py-1 text-sm font-black hover:text-[rgb(var(--primary))]"
      >
        {open ? (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        )}
        {title}
        <span className={cn('text-xs font-normal text-[rgb(var(--muted))]')}>
          ({count})
        </span>
      </button>
      {open && <div className="pl-5">{children}</div>}
    </div>
  )
}

export function EffectsList({
  planned,
  predicted,
  verified,
}: {
  planned: PlanEffect[]
  predicted?: PredictedPlanEffect[]
  verified?: PlanEffect[]
}) {
  return (
    <div>
      <CollapsibleSection title="Planned" count={planned.length}>
        {planned.length === 0 ? (
          <p className="py-2 text-sm text-[rgb(var(--muted))]">No planned effects.</p>
        ) : (
          planned.map((e) => <EffectRow key={e.effectId} effect={e} />)
        )}
      </CollapsibleSection>

      {predicted && (
        <CollapsibleSection title="Predicted" count={predicted.length}>
          {predicted.length === 0 ? (
            <p className="py-2 text-sm text-[rgb(var(--muted))]">No predicted effects.</p>
          ) : (
            predicted.map((e) => (
              <EffectRow key={e.effectId} effect={e} confidence={e.confidence} />
            ))
          )}
        </CollapsibleSection>
      )}

      {verified && (
        <CollapsibleSection title="Verified" count={verified.length}>
          {verified.length === 0 ? (
            <p className="py-2 text-sm text-[rgb(var(--muted))]">No verified effects.</p>
          ) : (
            verified.map((e) => <EffectRow key={e.effectId} effect={e} />)
          )}
        </CollapsibleSection>
      )}
    </div>
  )
}
