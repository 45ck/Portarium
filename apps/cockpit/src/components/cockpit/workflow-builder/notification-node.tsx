import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bell } from 'lucide-react';
import type { WorkflowNodeData } from '@/hooks/use-workflow-builder';

export function NotificationNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 bg-card shadow-sm transition-colors ${
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-sky-500'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-sky-500 !w-2.5 !h-2.5" />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Bell className="h-3.5 w-3.5 text-sky-500" />
        <span className="text-xs font-semibold truncate">{nodeData.label}</span>
      </div>
      <div className="px-3 py-1.5">
        <span className="text-[11px] text-muted-foreground">Send notification</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-500 !w-2.5 !h-2.5" />
    </div>
  );
}
