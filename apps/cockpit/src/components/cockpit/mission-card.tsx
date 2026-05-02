import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type MissionStatus = 'nominal' | 'active' | 'waiting' | 'critical' | 'offline';

const STATUS_TONE: Record<
  MissionStatus,
  {
    label: string;
    dot: string;
    text: string;
    ring: string;
  }
> = {
  nominal: {
    label: 'Nominal',
    dot: 'bg-mission-lime',
    text: 'text-mission-lime',
    ring: 'shadow-[0_0_0_4px_oklch(0.76_0.18_142_/_0.12)]',
  },
  active: {
    label: 'Active',
    dot: 'bg-mission-cyan',
    text: 'text-mission-cyan',
    ring: 'shadow-[0_0_0_4px_oklch(0.74_0.14_195_/_0.14)]',
  },
  waiting: {
    label: 'Waiting',
    dot: 'bg-mission-amber',
    text: 'text-mission-amber',
    ring: 'shadow-[0_0_0_4px_oklch(0.79_0.16_72_/_0.14)]',
  },
  critical: {
    label: 'Critical',
    dot: 'bg-mission-red',
    text: 'text-mission-red',
    ring: 'shadow-[0_0_0_4px_oklch(0.65_0.2_28_/_0.14)]',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    ring: 'shadow-none',
  },
};

export function MissionStatusIndicator({
  status,
  label = STATUS_TONE[status].label,
  className,
}: {
  status: MissionStatus;
  label?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const tone = STATUS_TONE[status];
  const shouldPulse = !reduceMotion && status !== 'offline';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em]',
        tone.text,
        className,
      )}
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        {shouldPulse ? (
          <motion.span
            className={cn('absolute inline-flex h-full w-full rounded-full opacity-50', tone.dot)}
            animate={{ scale: [1, 1.75], opacity: [0.48, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        ) : null}
        <span
          className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', tone.dot, tone.ring)}
        />
      </span>
      {label}
    </span>
  );
}

export interface MissionCardProps {
  title: string;
  eyebrow?: string;
  description?: string;
  status: MissionStatus;
  metric?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function MissionCard({
  title,
  eyebrow,
  description,
  status,
  metric,
  actions,
  footer,
  children,
  className,
}: MissionCardProps) {
  return (
    <section
      className={cn(
        'rounded-md border border-mission-line bg-mission-panel p-4 text-mission-panel-foreground shadow-[0_0_24px_var(--mission-glow)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 truncate text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <MissionStatusIndicator status={status} className="shrink-0" />
      </div>
      {metric ? (
        <div className="mt-4 font-display text-3xl font-semibold tabular-nums">{metric}</div>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
      {(footer || actions) && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-mission-line pt-3 text-xs">
          <div className="min-w-0 text-muted-foreground">{footer}</div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
    </section>
  );
}
