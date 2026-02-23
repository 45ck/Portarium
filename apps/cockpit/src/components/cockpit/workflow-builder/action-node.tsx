import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import type { WorkflowNodeData } from '@/hooks/use-workflow-builder';

export function ActionNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 bg-card shadow-sm transition-colors ${
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-blue-500'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-2.5 !h-2.5" />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Zap className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-semibold truncate">{nodeData.label}</span>
      </div>
      {nodeData.operation && (
        <div className="px-3 py-1.5">
          <span className="text-[11px] text-muted-foreground font-mono">{nodeData.operation}</span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-2.5 !h-2.5" />
    </div>
  );
}
