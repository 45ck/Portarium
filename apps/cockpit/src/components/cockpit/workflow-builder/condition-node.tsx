import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { WorkflowNodeData } from '@/hooks/use-workflow-builder';

export function ConditionNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 bg-card shadow-sm transition-colors ${
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-violet-500'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-2.5 !h-2.5" />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <GitBranch className="h-3.5 w-3.5 text-violet-500" />
        <span className="text-xs font-semibold truncate">{nodeData.label}</span>
      </div>
      <div className="flex justify-between px-3 py-1.5">
        <span className="text-[10px] text-emerald-500">True</span>
        <span className="text-[10px] text-rose-500">False</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!bg-emerald-500 !w-2.5 !h-2.5"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!bg-rose-500 !w-2.5 !h-2.5"
        style={{ left: '70%' }}
      />
    </div>
  );
}
