import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { MapHostDataState } from './types';

export interface DesktopMapWorkbenchLayoutProps {
  dataState: MapHostDataState;
  map: ReactNode;
  panel: ReactNode;
  toolbar?: ReactNode;
  className?: string;
}

export function DesktopMapWorkbenchLayout({
  dataState,
  map,
  panel,
  toolbar,
  className,
}: DesktopMapWorkbenchLayoutProps) {
  return (
    <div
      className={cn('hidden h-full min-h-0 gap-4 overflow-hidden md:flex', className)}
      data-state={dataState}
    >
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {map}
        {toolbar ? <div className="absolute top-3 right-3 z-10">{toolbar}</div> : null}
      </div>
      <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:w-96">
        {panel}
      </aside>
    </div>
  );
}
