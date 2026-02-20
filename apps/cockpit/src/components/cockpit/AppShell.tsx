import type { ReactNode } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface AppShellProps {
  sidebar?: ReactNode
  topbar?: ReactNode
  statusbar?: ReactNode
  children: ReactNode
}

export function AppShell({ sidebar, topbar, statusbar, children }: AppShellProps) {
  return (
    <div
      className={cn(
        'grid h-screen',
        'grid-cols-[var(--sidebar-width)_1fr]',
        'grid-rows-[var(--topbar-height)_1fr_var(--statusbar-height)]',
        'max-[980px]:grid-cols-[1fr]',
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-[var(--radius-sm)] focus:bg-[rgb(var(--primary))] focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to main content
      </a>

      {topbar && (
        <header className="col-span-full border-b-2 border-[rgb(var(--border))]">
          {topbar}
        </header>
      )}

      {sidebar && (
        <aside className="overflow-hidden border-r-2 border-[rgb(var(--border))] max-[980px]:hidden">
          <ScrollArea className="h-full">{sidebar}</ScrollArea>
        </aside>
      )}

      <main id="main-content" className="overflow-auto p-4">
        {children}
      </main>

      {statusbar && (
        <footer className="col-span-full border-t-2 border-[rgb(var(--border))]">
          {statusbar}
        </footer>
      )}
    </div>
  )
}
