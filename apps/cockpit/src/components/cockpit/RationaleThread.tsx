import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface RationaleThreadProps {
  rationale?: string
  required: boolean
  minLength?: number
  onChange?: (value: string) => void
  readOnly?: boolean
}

export function RationaleThread({
  rationale = '',
  required,
  minLength = 20,
  onChange,
  readOnly = false,
}: RationaleThreadProps) {
  if (readOnly && rationale) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-bold">Rationale</p>
        <blockquote className="border-l-4 border-[rgb(var(--border))] pl-3 text-sm text-[rgb(var(--muted))]">
          {rationale}
        </blockquote>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <label htmlFor="rationale-thread" className="block text-sm font-bold">
        Rationale
        {required && <span className="ml-1 text-[rgb(var(--status-danger))]">*</span>}
      </label>
      <Textarea
        id="rationale-thread"
        value={rationale}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={`Enter rationale${required ? ` (min ${minLength} characters)` : ''}...`}
        aria-describedby="rationale-thread-hint"
        className="min-h-[80px]"
      />
      <div className="flex items-center justify-between">
        {required && (
          <p
            id="rationale-thread-hint"
            className={cn(
              'text-xs',
              rationale.length < minLength
                ? 'text-[rgb(var(--status-warn))]'
                : 'text-[rgb(var(--muted))]',
            )}
          >
            Required (min {minLength} characters)
          </p>
        )}
        <p
          className={cn(
            'ml-auto text-xs',
            required && rationale.length < minLength
              ? 'text-[rgb(var(--status-warn))]'
              : 'text-[rgb(var(--muted))]',
          )}
        >
          {rationale.length}/{minLength}
        </p>
      </div>
    </div>
  )
}
