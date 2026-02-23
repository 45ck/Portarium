import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SheetSnap = 'collapsed' | 'half' | 'full';

const SNAP_HEIGHTS: Record<SheetSnap, string> = {
  collapsed: '4rem',
  half: '40%',
  full: '80%',
};

interface MobileBottomSheetProps {
  title: string;
  count?: number;
  children: ReactNode;
  onClose?: () => void;
  defaultSnap?: SheetSnap;
}

export function MobileBottomSheet({
  title,
  count,
  children,
  onClose,
  defaultSnap = 'collapsed',
}: MobileBottomSheetProps) {
  const [snap, setSnap] = useState<SheetSnap>(defaultSnap);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartSnap = useRef<SheetSnap>(snap);

  const cycleSnap = useCallback(() => {
    setSnap((s) => {
      if (s === 'collapsed') return 'half';
      if (s === 'half') return 'full';
      return 'collapsed';
    });
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
      dragStartSnap.current = snap;
    },
    [snap],
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const deltaY = dragStartY.current - e.changedTouches[0].clientY;
    dragStartY.current = null;

    // Swipe up = positive deltaY, swipe down = negative
    const threshold = 40;
    if (deltaY > threshold) {
      // Swipe up — expand
      setSnap((s) => (s === 'collapsed' ? 'half' : s === 'half' ? 'full' : 'full'));
    } else if (deltaY < -threshold) {
      // Swipe down — collapse
      setSnap((s) => (s === 'full' ? 'half' : s === 'half' ? 'collapsed' : 'collapsed'));
    }
  }, []);

  // Allow Escape to collapse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (snap === 'full') setSnap('half');
        else if (snap === 'half') setSnap('collapsed');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [snap]);

  return (
    <div
      ref={sheetRef}
      className={cn(
        'absolute bottom-0 left-0 right-0 z-[1100] rounded-t-xl border-t border-border bg-card shadow-2xl transition-[height] duration-200 ease-out',
      )}
      style={{ height: SNAP_HEIGHTS[snap] }}
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={cycleSnap}
        role="button"
        tabIndex={0}
        aria-label={`${title} panel — tap to ${snap === 'collapsed' ? 'expand' : 'collapse'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            cycleSnap();
          }
        }}
      >
        <div className="flex items-center gap-2">
          {/* Visual drag indicator */}
          <div className="mx-auto h-1 w-8 rounded-full bg-muted-foreground/30" />
          <span className="text-xs font-semibold">
            {title}
            {count !== undefined && <span className="ml-1 text-muted-foreground">({count})</span>}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setSnap(snap === 'collapsed' ? 'half' : 'collapsed');
            }}
          >
            {snap === 'collapsed' ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Content — scrollable when expanded */}
      <div
        className={cn(
          'overflow-y-auto',
          snap === 'collapsed' ? 'h-0 overflow-hidden' : 'h-[calc(100%-2.5rem)]',
        )}
      >
        {children}
      </div>
    </div>
  );
}
