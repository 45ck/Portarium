import { useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore } from '@/stores/ui-store';
import type { TriageViewMode } from '@/stores/ui-store';
import { getRelevantModes } from './index';
import type { ApprovalContext } from './lib/approval-context';
import { cn } from '@/lib/utils';
import { Eye } from 'lucide-react';

export interface ModeSwitcherProps {
  context?: ApprovalContext;
}

export function ModeSwitcher({ context }: ModeSwitcherProps) {
  const mode = useUIStore((s) => s.triageViewMode);
  const setMode = useUIStore((s) => s.setTriageViewMode);

  const visibleModes = getRelevantModes(context);

  // Auto-correct if the currently selected mode is hidden
  useEffect(() => {
    if (visibleModes.length === 0) return;
    const isVisible = visibleModes.some((m) => m.id === mode);
    if (!isVisible) {
      setMode(visibleModes[0]!.id);
    }
  }, [visibleModes, mode, setMode]);

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground shrink-0">
        <Eye className="h-3 w-3" />
        View
      </span>
      <TooltipProvider delayDuration={300}>
        <Tabs value={mode} onValueChange={(v) => setMode(v as TriageViewMode)}>
          <TabsList className="h-8 gap-0.5 overflow-x-auto flex-nowrap">
            {visibleModes.map((m) => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              const isRecommended = context ? m.relevance(context) === 'recommended' : false;
              return (
                <Tooltip key={m.id}>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={m.id}
                      data-triage-mode={m.id}
                      aria-label={`View mode ${m.label}`}
                      className={cn('h-7 text-[11px] gap-1 relative', isActive ? 'px-2' : 'px-1.5')}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      {isActive && <span>{m.shortLabel}</span>}
                      {isRecommended && !isActive && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {m.description}
                    {isRecommended && (
                      <span className="block text-[11px] text-primary mt-0.5">
                        Recommended for this approval
                      </span>
                    )}
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
