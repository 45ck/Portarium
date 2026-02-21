import { useCallback, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion';
import { ApprovalTriageCard, type TriageAction } from './approval-triage-card';
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
const SPRING_SNAP = { type: 'spring' as const, stiffness: 300, damping: 30 };
const STAMP_THRESHOLD = 0.3;

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
  const controls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();

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

  // Stamp opacity
  const stampThreshold = compact ? 0.2 : STAMP_THRESHOLD;
  const approveStampOpacity = useTransform(x, [stampThreshold * COMMIT_PX, COMMIT_PX], [0, 1]);
  const denyStampOpacity = useTransform(x, [-COMMIT_PX, -stampThreshold * COMMIT_PX], [1, 0]);

  const isDraggingRef = useRef(false);
  const actionCalledRef = useRef(false);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      isDraggingRef.current = false;
      const committed =
        Math.abs(info.offset.x) >= COMMIT_PX || Math.abs(info.velocity.x) >= COMMIT_VELOCITY;

      if (!committed) {
        // Spring snap-back
        void controls.start({ x: 0, transition: SPRING_SNAP });
        return;
      }

      const dir = info.offset.x > 0 ? 'right' : 'left';
      const action: TriageAction = dir === 'right' ? 'Approved' : 'Denied';

      // Fly off screen
      const flyX = dir === 'right' ? window.innerWidth * 1.5 : -window.innerWidth * 1.5;
      const flyRotate = dir === 'right' ? 20 : -20;

      actionCalledRef.current = true;

      void controls
        .start({
          x: flyX,
          rotate: flyRotate,
          transition: { type: 'spring', stiffness: 200, damping: 30 },
        })
        .then(() => {
          actionCalledRef.current = false;
        });

      // Fire action immediately — don't wait for exit animation
      onAction(approval.approvalId, action, '');
    },
    [controls, onAction, approval.approvalId],
  );

  // Called from the card's button actions (approve/deny/skip/changes)
  const handleCardAction = useCallback(
    (approvalId: string, action: TriageAction, rationale: string) => {
      if (actionCalledRef.current) return;
      actionCalledRef.current = true;

      const dir = action === 'Approved' ? 'right' : action === 'Skip' ? 'right' : 'left';
      const flyX = dir === 'right' ? window.innerWidth * 1.5 : -window.innerWidth * 1.5;
      const flyRotate = dir === 'right' ? 20 : -20;

      void controls
        .start({
          x: flyX,
          rotate: flyRotate,
          transition: { type: 'spring', stiffness: 200, damping: 30 },
        })
        .then(() => {
          actionCalledRef.current = false;
        });

      onAction(approvalId, action, rationale);
    },
    [controls, onAction],
  );

  const shouldDrag = !prefersReducedMotion && !loading;

  return (
    <div className="relative w-full">
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

      {/* Main draggable card */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={approval.approvalId}
          className="relative cursor-grab active:cursor-grabbing"
          style={{
            x,
            rotate,
            rotateY,
            perspective: 1200,
            zIndex: 2,
          }}
          initial={{ y: 40, scale: 0.93, opacity: 0 }}
          animate={controls}
          exit={{ x: 0, opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
          onAnimationStart={() => {
            // Reset position on new card entrance
            if (!actionCalledRef.current) {
              void controls.start({
                y: 0,
                scale: 1,
                opacity: 1,
                x: 0,
                rotate: 0,
                transition: { type: 'spring', stiffness: 300, damping: 25 },
              });
            }
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
            style={{
              background: useTransform(x, (latest) =>
                latest > 0
                  ? `linear-gradient(100deg, rgba(34,197,94,${Math.min((Math.abs(latest) / (COMMIT_PX * 2)) * 0.12, 0.12)}) 0%, transparent 60%)`
                  : `linear-gradient(260deg, rgba(239,68,68,${Math.min((Math.abs(latest) / (COMMIT_PX * 2)) * 0.12, 0.12)}) 0%, transparent 60%)`,
              ),
            }}
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
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
