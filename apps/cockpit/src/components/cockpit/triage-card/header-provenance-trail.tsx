import type { RunSummary, WorkflowSummary } from '@portarium/cockpit-types';
import { EntityIcon } from '@/components/domain/entity-icon';
import { Bot, ChevronRight, Workflow } from 'lucide-react';
import { RunStatusBadge } from '../run-status-badge';

export interface HeaderProvenanceTrailProps {
  run?: RunSummary;
  workflow?: WorkflowSummary;
}

export function HeaderProvenanceTrail({ run, workflow }: HeaderProvenanceTrailProps) {
  if (!workflow && !run) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
      {workflow && (
        <span
          className="inline-flex items-center gap-1 bg-background border border-border rounded-full px-2 py-0.5"
          title={workflow.workflowId}
        >
          <Workflow className="h-3 w-3 shrink-0" />
          <span className="font-medium text-foreground truncate max-w-[120px]">
            {workflow.workflowId}
          </span>
        </span>
      )}
      {workflow && run && <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />}
      {run && (
        <span className="inline-flex items-center gap-1.5 bg-background border border-border rounded-full px-2 py-0.5">
          <EntityIcon entityType="run" size="xs" decorative />
          <span className="font-mono text-[11px]">{run.runId.slice(0, 10)}</span>
          <RunStatusBadge status={run.status} />
        </span>
      )}
      {run?.agentIds && run.agentIds.length > 0 && (
        <>
          <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
          <span
            className="inline-flex items-center gap-1 bg-background border border-border rounded-full px-2 py-0.5"
            title={run.agentIds.join(', ')}
          >
            <Bot className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[80px]">
              {run.agentIds.length === 1
                ? run.agentIds[0]!.slice(0, 14)
                : `${run.agentIds.length} agents`}
            </span>
          </span>
        </>
      )}
    </div>
  );
}
