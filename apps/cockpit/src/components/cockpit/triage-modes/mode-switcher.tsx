import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore } from '@/stores/ui-store';
import type { TriageViewMode } from '@/stores/ui-store';
import { TRIAGE_MODES } from './index';
import { cn } from '@/lib/utils';
import { Eye } from 'lucide-react';

export function ModeSwitcher() {
  const mode = useUIStore((s) => s.triageViewMode);
  const setMode = useUIStore((s) => s.setTriageViewMode);

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground shrink-0">
        <Eye className="h-3 w-3" />
        View
      </span>
      <TooltipProvider delayDuration={300}>
        <Tabs value={mode} onValueChange={(v) => setMode(v as TriageViewMode)}>
          <TabsList className="h-8 gap-0.5">
            {TRIAGE_MODES.map((m) => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <Tooltip key={m.id}>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={m.id}
                      className={cn('h-7 text-[11px] gap-1', isActive ? 'px-2' : 'px-1.5')}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      {isActive && <span>{m.shortLabel}</span>}
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {m.description}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TabsList>
        </Tabs>
      </TooltipProvider>
    </div>
  );
}
