import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X } from 'lucide-react';

interface NotificationBannerProps {
  /** Number of pending actions to display in the body */
  pendingCount: number;
  /** Called when the banner is tapped / dismissed */
  onTap?: () => void;
}

export function NotificationBanner({ pendingCount, onTap }: NotificationBannerProps) {
  const [visible, setVisible] = useState(true);

  const dismiss = useCallback(() => {
    setVisible(false);
    onTap?.();
  }, [onTap]);

  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 3_000);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-sm lg:hidden"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          onClick={dismiss}
        >
          <div className="flex items-start gap-3 rounded-2xl border border-white/20 bg-black/60 px-4 py-3 shadow-xl backdrop-blur-xl cursor-pointer">
            {/* App icon */}
            <div className="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/90">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-white">OpenClaw</span>
                <span className="text-[11px] text-white/50">now</span>
              </div>
              <p className="text-[13px] leading-snug text-white/80 mt-0.5">
                {pendingCount} action{pendingCount !== 1 ? 's' : ''} waiting for your approval
              </p>
            </div>

            <button
              type="button"
              className="shrink-0 mt-0.5 rounded-full p-0.5 text-white/40 hover:text-white/70 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                dismiss();
              }}
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
