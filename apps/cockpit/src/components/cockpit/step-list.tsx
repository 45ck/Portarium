import { cn } from '@/lib/utils';
import { Circle, Loader2, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

interface Step {
  stepId: string;
  name: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  startedAtIso?: string;
  endedAtIso?: string;
}

interface StepListProps {
  steps: Step[];
  currentStep?: string;
}

const statusConfig: Record<Step['status'], { icon: React.ElementType; className: string }> = {
  pending: { icon: Circle, className: 'text-muted-foreground' },
  running: { icon: Loader2, className: 'text-info animate-spin' },
  succeeded: { icon: CheckCircle2, className: 'text-success' },
  failed: { icon: XCircle, className: 'text-destructive' },
  skipped: { icon: MinusCircle, className: 'text-muted-foreground' },
};

export function StepList({ steps, currentStep }: StepListProps) {
  return (
    <div className="space-y-0">
      {steps.map((step) => {
        const { icon: Icon, className } = statusConfig[step.status];
        const isCurrent = step.stepId === currentStep;
        return (
          <div
            key={step.stepId}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded text-xs',
              isCurrent && 'bg-accent',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', className)} />
            <span className={cn('flex-1', isCurrent && 'font-medium')}>{step.name}</span>
            <span className="text-[10px] text-muted-foreground capitalize">{step.status}</span>
          </div>
        );
      })}
    </div>
  );
}

export type { Step, StepListProps };
