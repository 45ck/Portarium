import { useMemo } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { WorkflowNode, WorkflowEdge } from '@/hooks/use-workflow-builder';

interface ValidationCheck {
  label: string;
  passed: boolean;
}

interface ValidationPanelProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

function getValidationChecks(nodes: WorkflowNode[], edges: WorkflowEdge[]): ValidationCheck[] {
  const hasStart = nodes.some((n) => n.type === 'start');
  const hasEnd = nodes.some((n) => n.type === 'end');

  const connectedNodeIds = new Set<string>();
  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  const nonTerminalNodes = nodes.filter((n) => n.type !== 'start' && n.type !== 'end');
  const orphanCount = nonTerminalNodes.filter((n) => !connectedNodeIds.has(n.id)).length;

  const allConnected =
    nodes.length <= 2
      ? edges.length > 0 || nodes.length < 2
      : nonTerminalNodes.every((n) => connectedNodeIds.has(n.id));

  return [
    { label: 'Has start node', passed: hasStart },
    { label: 'Has end node', passed: hasEnd },
    { label: 'All nodes connected', passed: allConnected },
    { label: 'No orphan nodes', passed: orphanCount === 0 },
  ];
}

export function ValidationPanel({ nodes, edges }: ValidationPanelProps) {
  const checks = useMemo(() => getValidationChecks(nodes, edges), [nodes, edges]);
  const allPassed = checks.every((c) => c.passed);

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/30">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">
        Readiness
      </span>
      <div className="flex items-center gap-3 overflow-x-auto">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-1 shrink-0">
            {check.passed ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            ) : (
              <AlertCircle className="h-3 w-3 text-amber-500" />
            )}
            <span className="text-[11px] text-muted-foreground">{check.label}</span>
          </div>
        ))}
      </div>
      <div className="ml-auto shrink-0">
        {allPassed ? (
          <span className="text-[11px] text-emerald-500 font-medium">Ready</span>
        ) : (
          <span className="text-[11px] text-amber-500 font-medium">Incomplete</span>
        )}
      </div>
    </div>
  );
}
