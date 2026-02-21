import { useCallback, useRef, useState, useEffect } from 'react';

/**
 * @deprecated Use `ApprovalTriageDeck` with framer-motion instead.
 * This hook will be removed in Phase 4.
 */

const COMMIT_THRESHOLD = 120;
const MAX_ROTATION_DEG = 12;

/** Interactive exclusion selectors — don't start drag inside these */
const EXCLUDED = 'textarea, button, input, [role="tablist"], [role="tab"]';

export interface SwipeGestureResult {
  /** Inline style to apply to the dragged element */
  dragStyle: React.CSSProperties;
  /** Pointer event handlers to spread onto the card element */
  pointerHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  /** Normalized drag progress: -1 (full left) to 1 (full right), 0 = resting */
  progress: number;
  /** Whether a drag is currently in progress */
  isDragging: boolean;
}

interface UseSwipeGestureOpts {
  /** Called when swipe commits to the right (approve) */
  onSwipeRight: () => void;
  /** Called when swipe commits to the left (deny). Return false to snap back. */
  onSwipeLeft: () => boolean;
  /** Disables the gesture entirely */
  disabled?: boolean;
}

export function useSwipeGesture({
  onSwipeRight,
  onSwipeLeft,
  disabled = false,
}: UseSwipeGestureOpts): SwipeGestureResult {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const cardWidth = useRef(1);
  const activePointerId = useRef<number | null>(null);

  // Respect prefers-reduced-motion
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const reset = useCallback(() => {
    setOffsetX(0);
    setIsDragging(false);
    activePointerId.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || prefersReducedMotion.current) return;
      if ((e.target as HTMLElement).closest(EXCLUDED)) return;

      activePointerId.current = e.pointerId;
      startX.current = e.clientX;
      cardWidth.current = (e.currentTarget as HTMLElement).offsetWidth || 1;
      setIsDragging(true);

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      (e.currentTarget as HTMLElement).style.touchAction = 'none';
    },
    [disabled],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== activePointerId.current) return;
    setOffsetX(e.clientX - startX.current);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== activePointerId.current) return;
      (e.currentTarget as HTMLElement).style.touchAction = '';

      const dx = e.clientX - startX.current;
      if (Math.abs(dx) >= COMMIT_THRESHOLD) {
        if (dx > 0) {
          onSwipeRight();
        } else {
          const accepted = onSwipeLeft();
          if (!accepted) {
            reset();
            return;
          }
        }
      }
      reset();
    },
    [onSwipeRight, onSwipeLeft, reset],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== activePointerId.current) return;
      (e.currentTarget as HTMLElement).style.touchAction = '';
      reset();
    },
    [reset],
  );

  // Tinder-style physics: rotation pivots from bottom-center, card lifts during drag
  const dragRatio = cardWidth.current > 0 ? offsetX / cardWidth.current : 0;
  const rotation = dragRatio * MAX_ROTATION_DEG;
  // Keep opacity high — Tinder cards don't fade much, just 5% max during drag
  const opacity = 1 - Math.min(Math.abs(dragRatio) * 0.08, 0.05);
  const progress = cardWidth.current > 0 ? offsetX / COMMIT_THRESHOLD : 0;
  // Card lifts off surface proportional to drag distance
  const liftY = Math.min(Math.abs(offsetX) * 0.04, 6);
  const liftShadow = Math.min(Math.abs(offsetX) * 0.1, 20);

  const dragStyle: React.CSSProperties = isDragging
    ? {
        transform: `translateX(${offsetX}px) translateY(${-liftY}px) rotate(${rotation}deg)`,
        opacity,
        boxShadow: `0 ${8 + liftShadow}px ${20 + liftShadow * 2}px rgba(0,0,0,${0.1 + liftShadow * 0.005})`,
        transition: 'none',
        cursor: 'grabbing',
        userSelect: 'none',
        transformOrigin: 'center 80%',
      }
    : {
        // Spring-back: overshoot easing for satisfying snap
        transition:
          'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease, box-shadow 0.3s ease',
        transformOrigin: 'center 80%',
      };

  return {
    dragStyle,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    progress: Math.max(-1, Math.min(1, progress)),
    isDragging,
  };
}
