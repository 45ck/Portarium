import { useState, useEffect } from 'react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

interface CommandEntry {
  id: string
  label: string
  category: 'Navigate' | 'Action' | 'Filter' | 'Settings'
  shortcut?: string
  onSelect: () => void
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const defaultCommands: CommandEntry[] = [
  // Navigate
  { id: 'nav-inbox', label: 'Go to Inbox', category: 'Navigate', shortcut: 'g i', onSelect: () => console.log('Navigate to:', 'Inbox') },
  { id: 'nav-work-items', label: 'Go to Work Items', category: 'Navigate', shortcut: 'g w', onSelect: () => console.log('Navigate to:', 'Work Items') },
  { id: 'nav-runs', label: 'Go to Runs', category: 'Navigate', shortcut: 'g u', onSelect: () => console.log('Navigate to:', 'Runs') },
  { id: 'nav-approvals', label: 'Go to Approvals', category: 'Navigate', shortcut: 'g a', onSelect: () => console.log('Navigate to:', 'Approvals') },
  { id: 'nav-evidence', label: 'Go to Evidence', category: 'Navigate', shortcut: 'g e', onSelect: () => console.log('Navigate to:', 'Evidence') },
  { id: 'nav-agents', label: 'Go to Agents', category: 'Navigate', shortcut: 'g n', onSelect: () => console.log('Navigate to:', 'Agents') },
  { id: 'nav-settings', label: 'Go to Settings', category: 'Navigate', shortcut: 'g s', onSelect: () => console.log('Navigate to:', 'Settings') },
  { id: 'nav-workflow-builder', label: 'Go to Workflow Builder', category: 'Navigate', shortcut: 'g b', onSelect: () => console.log('Navigate to:', 'Workflow Builder') },
  { id: 'nav-workforce', label: 'Go to Workforce', category: 'Navigate', shortcut: 'g f', onSelect: () => console.log('Navigate to:', 'Workforce') },
  { id: 'nav-robots', label: 'Go to Robots', category: 'Navigate', shortcut: 'g r', onSelect: () => console.log('Navigate to:', 'Robots') },
  { id: 'nav-missions', label: 'Go to Missions', category: 'Navigate', shortcut: 'g m', onSelect: () => console.log('Navigate to:', 'Missions') },
  { id: 'nav-safety', label: 'Go to Safety', category: 'Navigate', shortcut: 'g y', onSelect: () => console.log('Navigate to:', 'Safety') },
  // Action
  { id: 'act-create-work-item', label: 'Create Work Item', category: 'Action', shortcut: 'n', onSelect: () => console.log('Action:', 'Create Work Item') },
  { id: 'act-approval-triage', label: 'Start Approval Triage', category: 'Action', onSelect: () => console.log('Action:', 'Start Approval Triage') },
  { id: 'act-toggle-drawer', label: 'Toggle Context Drawer', category: 'Action', shortcut: 'c', onSelect: () => console.log('Action:', 'Toggle Context Drawer') },
  // Filter
  { id: 'filter-failed', label: 'Filter: Failed runs', category: 'Filter', onSelect: () => console.log('Filter:', 'Failed runs') },
  { id: 'filter-pending', label: 'Filter: Pending approvals', category: 'Filter', onSelect: () => console.log('Filter:', 'Pending approvals') },
  { id: 'filter-assigned', label: 'Filter: Assigned to me', category: 'Filter', onSelect: () => console.log('Filter:', 'Assigned to me') },
  // Settings
  { id: 'settings-persona', label: 'Switch Persona', category: 'Settings', onSelect: () => console.log('Settings:', 'Switch Persona') },
  { id: 'settings-shortcuts', label: 'Keyboard Shortcuts', category: 'Settings', shortcut: '?', onSelect: () => console.log('Settings:', 'Keyboard Shortcuts') },
]

const categories = ['Navigate', 'Action', 'Filter', 'Settings'] as const

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {categories.map((category, index) => {
          const items = defaultCommands.filter((cmd) => cmd.category === category)
          return (
            <div key={category}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={category}>
                {items.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    value={cmd.label}
                    onSelect={() => {
                      cmd.onSelect()
                      onOpenChange(false)
                    }}
                  >
                    {cmd.label}
                    {cmd.shortcut && (
                      <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          )
        })}
      </CommandList>
    </CommandDialog>
  )
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return { open, setOpen }
}
