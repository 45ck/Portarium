import type { ReactNode } from 'react'

interface NavGroupProps {
  label: string
  children: ReactNode
}

export function NavGroup({ label, children }: NavGroupProps) {
  return (
    <nav aria-label={label} className="space-y-1">
      <p className="px-3 py-1 text-xs font-black uppercase tracking-wider text-[rgb(var(--muted))]">
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </nav>
  )
}
