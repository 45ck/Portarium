import { Button } from '@/components/ui/button'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border-2 border-dashed border-[rgb(var(--border))] px-6 py-10 text-center">
      <h3 className="mb-1 font-black">{title}</h3>
      <p className="mb-4 text-sm text-[rgb(var(--muted))]">{description}</p>
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
