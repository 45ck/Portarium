import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { MapHostDataState } from './types';

export interface MobileMapWorkbenchLayoutProps {
  dataState: MapHostDataState;
  map: ReactNode;
  panel: ReactNode;
  toolbar?: ReactNode;
  className?: string;
}

export function MobileMapWorkbenchLayout({
  dataState,
  map,
  panel,
  toolbar,
  className,
}: MobileMapWorkbenchLayoutProps) {
  return (
    <div
      className={cn('relative h-full min-h-0 overflow-hidden md:hidden', className)}
      data-state={dataState}
    >
      <div className="absolute inset-0 overflow-hidden bg-card">{map}</div>
      {toolbar ? <div className="absolute top-3 right-3 z-10">{toolbar}</div> : null}
      <section className="absolute inset-x-0 bottom-0 z-10 max-h-[48%] overflow-hidden rounded-t-xl border-t border-border bg-card shadow-2xl">
        {panel}
      </section>
    </div>
  );
}
