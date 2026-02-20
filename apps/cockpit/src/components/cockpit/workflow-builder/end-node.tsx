import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Square } from 'lucide-react'
import type { WorkflowNodeData } from '@/hooks/use-workflow-builder'

export function EndNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData
  return (
    <div
      className={`rounded-full border-2 bg-card px-4 py-2 flex items-center gap-2 shadow-sm transition-colors ${
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-rose-500'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-rose-500 !w-2.5 !h-2.5" />
      <Square className="h-4 w-4 text-rose-500" />
      <span className="text-xs font-semibold">{nodeData.label}</span>
    </div>
  )
}
