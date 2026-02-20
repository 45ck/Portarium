import { cn } from '@/lib/utils'

interface NavItemProps {
  href?: string
  label: string
  icon?: React.ReactNode
  active?: boolean
  onClick?: () => void
}

export function NavItem({ href, label, icon, active, onClick }: NavItemProps) {
  const Comp = href ? 'a' : 'button'

  return (
    <Comp
      href={href}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-[var(--radius-sm)] border-2 border-[rgb(var(--border))] bg-white px-3 py-2 text-left text-sm font-bold shadow-[var(--shadow-card)] transition-colors hover:bg-gray-50',
        active && 'outline outline-2 outline-offset-1 outline-[rgb(var(--primary))]',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {label}
    </Comp>
  )
}
