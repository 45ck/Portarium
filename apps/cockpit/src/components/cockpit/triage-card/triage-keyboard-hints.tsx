import { AnimatePresence, motion } from 'framer-motion';

const HINT_KEYS = [
  { key: 'A', label: 'approve' },
  { key: 'D', label: 'deny' },
  { key: 'R', label: 'changes' },
  { key: 'S', label: 'skip' },
  { key: 'V', label: 'view mode' },
] as const;

export interface TriageKeyboardHintsProps {
  rationaleHasFocus: boolean;
  undoAvailable: boolean;
}

export function TriageKeyboardHints({
  rationaleHasFocus,
  undoAvailable,
}: TriageKeyboardHintsProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={rationaleHasFocus ? 'focus' : undoAvailable ? 'undo' : 'default'}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-4 text-[11px] text-muted-foreground"
      >
        <span className="hidden sm:inline">Keyboard:</span>
        {rationaleHasFocus ? (
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[11px] font-mono border border-border">
              Esc
            </kbd>
            exit
          </span>
        ) : (
          <>
            {HINT_KEYS.map(({ key, label }) => (
              <span key={key} className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[11px] font-mono border border-border">
                  {key}
                </kbd>
                {label}
              </span>
            ))}
            {undoAvailable && (
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[11px] font-mono border border-border">
                  Z
                </kbd>
                undo
              </span>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
