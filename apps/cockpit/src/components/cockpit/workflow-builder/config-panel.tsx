import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { WorkflowNode, WorkflowNodeData } from '@/hooks/use-workflow-builder';

const TIER_OPTIONS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;

interface ConfigPanelProps {
  node: WorkflowNode;
  onUpdate: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
}

export function ConfigPanel({ node, onUpdate, onClose, onDelete }: ConfigPanelProps) {
  const data = node.data;

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Properties</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Type
        </label>
        <Badge variant="secondary" className="text-[10px]">
          {data.nodeType}
        </Badge>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="node-label"
          className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
        >
          Name
        </label>
        <input
          id="node-label"
          type="text"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          value={data.label}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="node-description"
          className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
        >
          Description
        </label>
        <textarea
          id="node-description"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          rows={3}
          value={data.description ?? ''}
          onChange={(e) => onUpdate(node.id, { description: e.target.value })}
        />
      </div>

      {data.nodeType !== 'start' && data.nodeType !== 'end' && (
        <>
          <div className="space-y-1">
            <label
              htmlFor="node-timeout"
              className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
            >
              Timeout (ms)
            </label>
            <input
              id="node-timeout"
              type="number"
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              value={data.timeoutMs ?? 300000}
              onChange={(e) =>
                onUpdate(node.id, { timeoutMs: Number(e.target.value) || undefined })
              }
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="node-retry"
              className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
            >
              Max Retry Attempts
            </label>
            <input
              id="node-retry"
              type="number"
              min={0}
              max={10}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              value={data.retryMaxAttempts ?? 3}
              onChange={(e) => onUpdate(node.id, { retryMaxAttempts: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="node-tier"
              className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
            >
              Execution Tier
            </label>
            <select
              id="node-tier"
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              value={data.executionTier ?? 'Auto'}
              onChange={(e) =>
                onUpdate(node.id, {
                  executionTier: e.target.value as WorkflowNodeData['executionTier'],
                })
              }
            >
              {TIER_OPTIONS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {data.nodeType !== 'start' && data.nodeType !== 'end' && (
        <div className="pt-2 border-t border-border">
          <button
            type="button"
            className="w-full rounded-md border border-destructive/50 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
            onClick={() => onDelete(node.id)}
          >
            Delete Node
          </button>
        </div>
      )}
    </div>
  );
}
