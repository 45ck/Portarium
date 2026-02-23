import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { TriageAction } from './types';

const ACTION_DOT_COLORS: Record<TriageAction, string> = {
  Approved: 'bg-green-500',
  Denied: 'bg-red-500',
  RequestChanges: 'bg-yellow-500',
  Skip: 'bg-muted-foreground/40',
};

export interface TriageProgressDotsProps {
  approvalId: string;
  index: number;
  total: number;
  actionHistory: Record<number, TriageAction>;
}

export function TriageProgressDots({
  approvalId,
  index,
  total,
  actionHistory,
}: TriageProgressDotsProps) {
  const triagePosition = index + 1;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground font-medium">
        {triagePosition} of {total} pending
      </span>
      <div className="flex gap-1 sm:gap-1.5 overflow-hidden max-w-[60%] sm:max-w-none">
        {Array.from({ length: total }).map((_, i) => {
          const action = actionHistory[i];
          const dotColor =
            i < index && action
              ? (ACTION_DOT_COLORS[action] ?? 'bg-green-500')
              : i < index
                ? 'bg-green-500'
                : i === index
                  ? 'bg-primary'
                  : 'bg-muted';
          const justCompleted = i === index - 1 && action;
          return (
            <motion.div
              key={`${approvalId}-${i}`}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300 shrink-0',
                i === index ? 'w-6 sm:w-8' : 'w-3 sm:w-5',
                dotColor,
                i === index && 'animate-pulse',
              )}
              animate={justCompleted ? { scale: [1, 1.8, 1] } : undefined}
              transition={justCompleted ? { duration: 0.3, ease: 'easeOut' } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
