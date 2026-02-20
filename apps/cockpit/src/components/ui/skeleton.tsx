import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[var(--radius-sm)] bg-[rgba(27,27,27,0.08)]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
