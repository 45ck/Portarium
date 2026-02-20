import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border-2 px-2 py-0.5 text-xs font-black transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-[rgb(var(--border))] bg-white text-[rgb(var(--foreground))]',
        ok: 'border-[rgb(var(--status-ok))] bg-white text-[rgb(var(--status-ok))]',
        warn: 'border-[rgb(var(--status-warn))] bg-white text-[rgb(var(--status-warn))]',
        danger:
          'border-[rgb(var(--status-danger))] bg-white text-[rgb(var(--status-danger))]',
        info: 'border-[rgb(var(--status-info))] bg-white text-[rgb(var(--status-info))]',
        muted:
          'border-[rgb(var(--border-soft))] bg-transparent text-[rgb(var(--muted))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
