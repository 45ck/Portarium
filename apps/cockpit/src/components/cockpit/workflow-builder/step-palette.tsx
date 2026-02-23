import { Play, Square, Zap, ShieldCheck, GitBranch, Bell, Brain } from 'lucide-react';
import type { WorkflowNodeType } from '@/hooks/use-workflow-builder';

interface StepDef {
  type: WorkflowNodeType;
  label: string;
  icon: React.ReactNode;
  color: string;
}

interface StepCategory {
  label: string;
  steps: StepDef[];
}

const CATEGORIES: StepCategory[] = [
  {
    label: 'Control Flow',
    steps: [
      {
        type: 'start',
        label: 'Start',
        icon: <Play className="h-3.5 w-3.5" />,
        color: 'text-emerald-500',
      },
      {
        type: 'end',
        label: 'End',
        icon: <Square className="h-3.5 w-3.5" />,
        color: 'text-rose-500',
      },
      {
        type: 'condition',
        label: 'Condition',
        icon: <GitBranch className="h-3.5 w-3.5" />,
        color: 'text-violet-500',
      },
    ],
  },
  {
    label: 'Actions',
    steps: [
      {
        type: 'action',
        label: 'Action',
        icon: <Zap className="h-3.5 w-3.5" />,
        color: 'text-blue-500',
      },
      {
        type: 'approval-gate',
        label: 'Approval Gate',
        icon: <ShieldCheck className="h-3.5 w-3.5" />,
        color: 'text-amber-500',
      },
    ],
  },
  {
    label: 'AI',
    steps: [
      {
        type: 'agent-task',
        label: 'Agent Task',
        icon: <Brain className="h-3.5 w-3.5" />,
        color: 'text-fuchsia-500',
      },
    ],
  },
  {
    label: 'Notifications',
    steps: [
      {
        type: 'notification',
        label: 'Notification',
        icon: <Bell className="h-3.5 w-3.5" />,
        color: 'text-sky-500',
      },
    ],
  },
];

interface StepPaletteProps {
  onAddNode: (type: WorkflowNodeType, label: string) => void;
}

export function StepPalette({ onAddNode }: StepPaletteProps) {
  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      <h3 className="text-sm font-semibold">Steps</h3>
      {CATEGORIES.map((category) => (
        <div key={category.label} className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {category.label}
          </p>
          <div className="space-y-0.5">
            {category.steps.map((step) => (
              <button
                key={step.type}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors cursor-grab active:cursor-grabbing"
                onClick={() => onAddNode(step.type, step.label)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/workflow-node-type', step.type);
                  e.dataTransfer.setData('application/workflow-node-label', step.label);
                  e.dataTransfer.effectAllowed = 'move';
                }}
              >
                <span className={step.color}>{step.icon}</span>
                <span>{step.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
