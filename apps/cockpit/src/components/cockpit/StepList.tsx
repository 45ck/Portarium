import { cn } from '@/lib/utils'

export function StepList({
  steps,
  currentStepIndex,
}: {
  steps: { id: string; label: string; portFamily?: string }[]
  currentStepIndex?: number
}) {
  const activeIdx = currentStepIndex ?? -1

  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Steps">
      {steps.map((step, idx) => {
        const isDone = idx < activeIdx || (activeIdx === -1 && steps.length > 0)
        const isActive = idx === activeIdx
        const isPending = idx > activeIdx && activeIdx !== -1

        return (
          <div
            key={step.id}
            role="listitem"
            aria-current={isActive ? 'step' : undefined}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-black transition-colors',
              isDone && activeIdx !== -1 &&
                'border-[rgb(var(--border-soft))] text-[rgb(var(--muted))] opacity-60',
              isActive &&
                'border-[rgb(var(--primary))] text-[rgb(var(--primary))]',
              isPending &&
                'border-[rgb(var(--border))] text-[rgb(var(--foreground))]',
              !isDone && !isActive && !isPending &&
                'border-[rgb(var(--border))] text-[rgb(var(--foreground))]',
            )}
          >
            <span className="text-[rgb(var(--muted))]">{idx + 1}</span>
            {step.label}
            {step.portFamily && (
              <span className="text-[rgb(var(--muted))]">{step.portFamily}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
