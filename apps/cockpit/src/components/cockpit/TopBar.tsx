import { Command } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TopBarProps {
  workspaceId?: string
  personaLabel?: string
  onCommandPaletteOpen?: () => void
}

export function TopBar({ workspaceId, personaLabel, onCommandPaletteOpen }: TopBarProps) {
  return (
    <div className="flex h-[var(--topbar-height)] items-center justify-between border-b-2 border-[rgb(var(--border))] bg-white px-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border-2 border-[rgb(var(--border))] bg-[rgb(var(--foreground))] font-black text-white">
          P
        </div>
        <span className="text-sm font-black tracking-tight">Portarium</span>
        {workspaceId && (
          <>
            <span className="text-[rgb(var(--muted))]">/</span>
            <span className="text-sm text-[rgb(var(--muted))]">{workspaceId}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {personaLabel && (
          <Badge variant="default">{personaLabel}</Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onCommandPaletteOpen}
          aria-label="Open command palette"
          className="gap-1 text-xs text-[rgb(var(--muted))]"
        >
          <Command className="h-3 w-3" />
          <kbd className="rounded border border-[rgb(var(--border))] bg-gray-50 px-1 py-0.5 font-mono text-[10px]">
            Ctrl+K
          </kbd>
        </Button>
      </div>
    </div>
  )
}
