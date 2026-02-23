import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useUIStore } from '@/stores/ui-store';

interface ShortcutDef {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  label: string;
  shortcuts: ShortcutDef[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'Navigation',
    shortcuts: [
      { keys: ['G', 'I'], description: 'Go to Inbox' },
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'W'], description: 'Go to Work Items' },
      { keys: ['G', 'R'], description: 'Go to Runs' },
      { keys: ['G', 'A'], description: 'Go to Approvals' },
      { keys: ['G', 'E'], description: 'Go to Evidence' },
    ],
  },
  {
    label: 'Actions',
    shortcuts: [{ keys: ['Ctrl', 'K'], description: 'Open command palette' }],
  },
  {
    label: 'UI',
    shortcuts: [{ keys: ['?'], description: 'Show keyboard shortcuts' }],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono">
      {children}
    </kbd>
  );
}

function KeyboardCheatsheet() {
  const { keyboardCheatsheetOpen, setKeyboardCheatsheetOpen } = useUIStore();

  return (
    <Dialog open={keyboardCheatsheetOpen} onOpenChange={setKeyboardCheatsheetOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Navigate the cockpit faster with keyboard shortcuts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </h4>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground text-xs">+</span>}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { KeyboardCheatsheet };
