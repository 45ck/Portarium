import { useCallback, useRef, useState } from 'react';
import { motion, animate, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { ApprovalTriageCard, type TriageAction, type DragValidation } from './approval-triage-card';
import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';

const COMMIT_PX = 120;
const COMMIT_VELOCITY = 500;
const DRAG_ELASTIC = 0.2;
const STAMP_THRESHOLD = 0.3;

const SPRING_SNAP = { type: 'spring' as const, stiffness: 300, damping: 30 };
const SPRING_EXIT = { type: 'spring' as const, stiffness: 200, damping: 25 };

const EXCLUDED = 'textarea, button, input, [role="tablist"], [role="tab"], select';

interface ApprovalTriageDeckProps {
  approval: ApprovalSummary;
  index: number;
  total: number;
  hasMore: boolean;
  onAction: (approvalId: string, action: TriageAction, rationale: string) => void;
  loading?: boolean;
  plannedEffects?: PlanEffect[];
  evidenceEntries?: EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
  actionHistory?: Record<number, TriageAction>;
  undoAvailable?: boolean;
  onUndo?: () => void;
  compact?: boolean;
}

export function ApprovalTriageDeck({
  approval,
  index,
  total,
  hasMore,
  onAction,
  loading = false,
  plannedEffects,
  evidenceEntries,
  run,
  workflow,
  actionHistory,
  undoAvailable = false,
  onUndo,
  compact = false,
}: ApprovalTriageDeckProps) {
  const prefersReducedMotion = useReducedMotion();

  const validationRef = useRef<DragValidation>({
    canApprove: true,
    canDeny: false,
    approveBlockReason: undefined,
    denyBlockReason: 'Rationale is required to deny',
    currentRationale: '',
  });

  const handleValidationChange = useCallback((v: DragValidation) => {
    validationRef.current = v;
  }, []);

  const [dragRejection, setDragRejection] = useState<'approve' | 'deny' | null>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const rotateY = useTransform(x, [-300, 0, 300], [-5, 0, 5]);

  // Normalized drag progress -1..1
  const dragProgress = useTransform(x, [-COMMIT_PX, 0, COMMIT_PX], [-1, 0, 1]);
  const dragProgressRef = useRef(0);
  dragProgress.on('change', (v) => {
    dragProgressRef.current = v;
  });

  // Ghost card transforms (driven by motion values — no re-renders)
  const ghost1Scale = useTransform(x, [-300, 0, 300], [0.99, 0.97, 0.99]);
  const ghost1Y = useTransform(x, [-300, 0, 300], [1, 4, 1]);
  const ghost2Scale = useTransform(x, [-300, 0, 300], [0.97, 0.94, 0.97]);
  const ghost2Y = useTransform(x, [-300, 0, 300], [4, 8, 4]);

  // Stamp opacity — gated by validation state
  const stampThreshold = compact ? 0.2 : STAMP_THRESHOLD;
  const rawApproveStampOpacity = useTransform(x, [stampThreshold * COMMIT_PX, COMMIT_PX], [0, 1]);
  const approveStampOpacity = useTransform(rawApproveStampOpacity, (v) =>
    validationRef.current.canApprove ? v : 0,
  );
  const blockedStampOpacity = useTransform(rawApproveStampOpacity, (v) =>
    validationRef.current.canApprove ? 0 : v,
  );
  const rawDenyStampOpacity = useTransform(x, [-COMMIT_PX, -stampThreshold * COMMIT_PX], [1, 0]);
  const denyStampOpacity = useTransform(rawDenyStampOpacity, (v) =>
    validationRef.current.canDeny ? v : 0,
  );

  // Directional tint background
  const tintBackground = useTransform(x, (latest) =>
    latest > 0
      ? `linear-gradient(100deg, rgba(34,197,94,${Math.min((Math.abs(latest) / (COMMIT_PX * 2)) * 0.12, 0.12)}) 0%, transparent 60%)`
      : `linear-gradient(260deg, rgba(239,68,68,${Math.min((Math.abs(latest) / (COMMIT_PX * 2)) * 0.12, 0.12)}) 0%, transparent 60%)`,
  );

  const isDraggingRef = useRef(false);

  const rejectDrag = useCallback(
    (reason: 'approve' | 'deny') => {
      isDraggingRef.current = false;

      if (prefersReducedMotion) {
        x.set(0);
      } else {
        animate(x, 0, {
          ...SPRING_SNAP,
          onComplete: () => {
            animate(x, [0, 10, -10, 6, -6, 3, 0], {
              duration: 0.4,
              ease: 'easeInOut',
            });
          },
        });
      }

      if (navigator?.vibrate) navigator.vibrate([30, 20, 30]);

      setDragRejection(reason);
      setTimeout(() => setDragRejection(null), 600);
    },
    [x, prefersReducedMotion],
  );

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      isDraggingRef.current = false;
      const committed =
        Math.abs(info.offset.x) >= COMMIT_PX || Math.abs(info.velocity.x) >= COMMIT_VELOCITY;

      if (!committed) {
        animate(x, 0, SPRING_SNAP);
        return;
      }

      const dir = info.offset.x > 0 ? 1 : -1;
      const action: TriageAction = dir > 0 ? 'Approved' : 'Denied';

      // Validation gate — reject drag if action is blocked
      const validation = validationRef.current;
      if (action === 'Approved' && !validation.canApprove) {
        rejectDrag('approve');
        return;
      }
      if (action === 'Denied' && !validation.canDeny) {
        rejectDrag('deny');
        return;
      }

      // Fly off screen then fire action
      animate(x, dir * window.innerWidth, SPRING_EXIT);
      if (navigator?.vibrate) navigator.vibrate(50);

      // Fire after a beat so the fly-off is visible
      setTimeout(
        () => onAction(approval.approvalId, action, validationRef.current.currentRationale),
        150,
      );
    },
    [x, onAction, approval.approvalId, rejectDrag],
  );

  // Called from the card's button actions (approve/deny/skip/changes)
  const handleCardAction = useCallback(
    (approvalId: string, action: TriageAction, rationale: string) => {
      const dir = action === 'Approved' || action === 'Skip' ? 1 : -1;

      // Animate the card off-screen, then fire action
      animate(x, dir * window.innerWidth, SPRING_EXIT);
      if (navigator?.vibrate) navigator.vibrate(50);
      setTimeout(() => onAction(approvalId, action, rationale), 150);
    },
    [x, onAction],
  );

  const shouldDrag = !prefersReducedMotion && !loading;

  // Root motion.div — AnimatePresence sees this for entrance/exit.
  // Inner motion.div — owns drag transforms (x, rotate, rotateY).
  return (
    <motion.div
      className="relative w-full"
      initial={{ y: 30, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, y: -20, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Ghost card 2 (deepest) */}
      {hasMore && (
        <motion.div
          className="absolute inset-x-6 rounded-xl border border-border bg-card/60"
          style={{
            top: ghost2Y,
            bottom: ghost2Y,
            scale: ghost2Scale,
            zIndex: 0,
          }}
        />
      )}

      {/* Ghost card 1 */}
      {hasMore && (
        <motion.div
          className="absolute inset-x-3 rounded-xl border border-border bg-card/80"
          style={{
            top: ghost1Y,
            bottom: ghost1Y,
            scale: ghost1Scale,
            zIndex: 1,
          }}
        />
      )}

      {/* Draggable card */}
      <motion.div
        className="relative cursor-grab active:cursor-grabbing"
        style={{
          x,
          rotate,
          rotateY,
          perspective: 1200,
          zIndex: 2,
        }}
        drag={shouldDrag ? 'x' : false}
        dragElastic={DRAG_ELASTIC}
        dragConstraints={{ left: 0, right: 0 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onPointerDownCapture={(e: React.PointerEvent) => {
          if ((e.target as HTMLElement).closest(EXCLUDED)) {
            e.stopPropagation();
          }
        }}
      >
        {/* Directional tint overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-10 rounded-xl"
          style={{ background: tintBackground }}
        />

        {/* Approved stamp */}
        <motion.div
          className="absolute top-6 right-4 sm:top-8 sm:right-6 z-10 pointer-events-none select-none"
          style={{ opacity: approveStampOpacity }}
        >
          <span
            className="text-green-600 text-lg sm:text-2xl font-bold uppercase tracking-widest border-[3px] sm:border-4 border-green-600 rounded-sm px-2 py-0.5 sm:px-3 sm:py-1"
            style={{ transform: 'rotate(-12deg)', display: 'inline-block' }}
          >
            Approved
          </span>
        </motion.div>

        {/* Denied stamp */}
        <motion.div
          className="absolute top-6 left-4 sm:top-8 sm:left-6 z-10 pointer-events-none select-none"
          style={{ opacity: denyStampOpacity }}
        >
          <span
            className="text-red-600 text-lg sm:text-2xl font-bold uppercase tracking-widest border-[3px] sm:border-4 border-red-600 rounded-sm px-2 py-0.5 sm:px-3 sm:py-1"
            style={{ transform: 'rotate(12deg)', display: 'inline-block' }}
          >
            Denied
          </span>
        </motion.div>

        {/* Blocked stamp — replaces approve stamp when SoD-blocked */}
        <motion.div
          className="absolute top-6 right-4 sm:top-8 sm:right-6 z-10 pointer-events-none select-none"
          style={{ opacity: blockedStampOpacity }}
        >
          <span
            className="text-red-600 text-lg sm:text-2xl font-bold uppercase tracking-widest border-[3px] sm:border-4 border-red-600 rounded-sm px-2 py-0.5 sm:px-3 sm:py-1"
            style={{ transform: 'rotate(-12deg)', display: 'inline-block' }}
          >
            Blocked
          </span>
        </motion.div>

        <ApprovalTriageCard
          approval={approval}
          index={index}
          total={total}
          hasMore={hasMore}
          onAction={handleCardAction}
          loading={loading}
          plannedEffects={plannedEffects}
          evidenceEntries={evidenceEntries}
          run={run}
          workflow={workflow}
          actionHistory={actionHistory}
          undoAvailable={undoAvailable}
          onUndo={onUndo}
          externalDrag
          dragProgress={dragProgressRef.current}
          isDragging={isDraggingRef.current}
          onValidationChange={handleValidationChange}
          dragRejection={dragRejection}
        />
      </motion.div>
    </motion.div>
  );
}
