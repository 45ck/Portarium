import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Bot, Cpu, Code2, Sparkles, ArrowRight, Workflow } from 'lucide-react';
import type { TriageModeProps } from './index';
import type { AgentV1 } from '@portarium/cockpit-types';
import { useAgents } from '@/hooks/queries/use-agents';
import { AgentCapabilityBadge } from '@/components/cockpit/agent-capability-badge';
import { opColors } from '@/components/cockpit/lib/effect-colors';

type AgentKind = 'openclaw' | 'code' | 'llm';

function agentKind(agent: AgentV1): AgentKind {
  if (agent.allowedCapabilities.includes('machine:invoke')) return 'openclaw';
  if (agent.allowedCapabilities.includes('execute-code')) return 'code';
  return 'llm';
}

const KIND_ICON: Record<AgentKind, { Icon: typeof Bot; cls: string; label: string }> = {
  llm: { Icon: Sparkles, cls: 'text-violet-500', label: 'LLM' },
  code: { Icon: Code2, cls: 'text-blue-500', label: 'Code' },
  openclaw: { Icon: Cpu, cls: 'text-teal-500', label: 'OpenClaw' },
};

function AgentCard({ agent }: { agent: AgentV1 }) {
  const kind = agentKind(agent);
  const { Icon, cls, label } = KIND_ICON[kind];

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', cls)} />
        <span className="font-medium text-xs flex-1 truncate">{agent.name}</span>
        <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">
          {label}
        </Badge>
      </div>
      {agent.modelId && (
        <div className="text-[11px] text-muted-foreground">
          Model: <span className="font-mono">{agent.modelId}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {agent.allowedCapabilities.map((cap) => (
          <AgentCapabilityBadge key={cap} capability={cap} />
        ))}
      </div>
      {agent.usedByWorkflowIds && agent.usedByWorkflowIds.length > 0 && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Workflow className="h-3 w-3 shrink-0" />
          Linked workflows: {agent.usedByWorkflowIds.length}
        </div>
      )}
    </div>
  );
}

export function AgentOverviewMode({ approval, plannedEffects, run, workflow }: TriageModeProps) {
  const wsId = approval.workspaceId;
  const agentIds = useMemo(() => run?.agentIds ?? [], [run]);

  const { data: agentsData } = useAgents(wsId);

  const agents = useMemo(() => {
    if (!agentsData?.items || agentIds.length === 0) return [];
    return agentsData.items.filter((a) => agentIds.includes(a.agentId));
  }, [agentsData, agentIds]);

  // Find which action we're currently on based on run status
  const currentActionIndex = useMemo(() => {
    if (!workflow || !run) return -1;
    // For WaitingForApproval, the current step is the one that triggered the gate
    if (run.status === 'WaitingForApproval') {
      return workflow.actions.length - 1; // last action as approximation
    }
    return -1;
  }, [workflow, run]);

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-8 text-center">
        <Bot className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs font-medium text-muted-foreground">No agent data available</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          Agent information will appear once the run is linked to AI agents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Agents Involved */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Agents Involved
        </p>
        <div className="space-y-2">
          {agents.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} />
          ))}
        </div>
      </div>

      {/* Workflow Pipeline */}
      {workflow && workflow.actions.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Workflow Pipeline
          </p>
          <div className="text-[11px] text-muted-foreground mb-2">
            {workflow.name} v{workflow.version}
            {workflow.triggerKind && (
              <span className="ml-2">· Trigger: {workflow.triggerKind}</span>
            )}
            {run?.executionTier && (
              <span className="ml-2">
                · Tier:{' '}
                <Badge variant="secondary" className="text-[9px] h-4 px-1">
                  {run.executionTier}
                </Badge>
              </span>
            )}
          </div>
          <div className="space-y-1">
            {workflow.actions.map((action, i) => {
              const isCurrent = i === currentActionIndex;
              return (
                <div
                  key={action.actionId}
                  className={cn(
                    'flex items-center gap-2 rounded px-2 py-1 text-[11px]',
                    isCurrent && 'bg-primary/10 border border-primary/30',
                  )}
                >
                  <span className="text-muted-foreground font-mono w-4 shrink-0">
                    {'\u2460'.codePointAt(0)! + i > 0x2473
                      ? `${i + 1}`
                      : String.fromCodePoint(0x2460 + i)}
                  </span>
                  <span className="font-medium truncate flex-1">{action.operation}</span>
                  <span className="text-muted-foreground text-[11px] shrink-0">
                    {action.portFamily}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-medium text-primary shrink-0">
                      YOU ARE HERE
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Planned Effects */}
      {plannedEffects.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Planned Effects
          </p>
          <div className="space-y-1">
            {plannedEffects.map((e) => (
              <div key={e.effectId} className="flex items-center gap-2 text-[11px]">
                <Badge
                  variant="secondary"
                  className={cn('text-[9px] h-4 px-1 shrink-0', opColors[e.operation])}
                >
                  {e.operation}
                </Badge>
                <span className="truncate">{e.summary}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground text-[11px] shrink-0">
                  {e.target.sorName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
