import type { AgentActionProposalMeta } from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { Bot, Cpu, Shield, Wrench } from 'lucide-react';

// ---------------------------------------------------------------------------
// Category / Tier visual mapping
// ---------------------------------------------------------------------------

const CATEGORY_STYLE: Record<string, { variant: 'secondary' | 'warning' | 'destructive' | 'outline'; label: string }> = {
  ReadOnly: { variant: 'secondary', label: 'Read-only' },
  Mutation: { variant: 'warning', label: 'Mutation' },
  Dangerous: { variant: 'destructive', label: 'Dangerous' },
  Unknown: { variant: 'outline', label: 'Unknown' },
};

const TIER_STYLE: Record<string, { variant: 'secondary' | 'outline' | 'warning' | 'destructive'; label: string }> = {
  Auto: { variant: 'secondary', label: 'Auto' },
  Assisted: { variant: 'outline', label: 'Assisted' },
  HumanApprove: { variant: 'warning', label: 'Human Approve' },
  ManualOnly: { variant: 'destructive', label: 'Manual Only' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AgentActionProposalDetailProps {
  proposal: AgentActionProposalMeta;
}

export function AgentActionProposalDetail({ proposal }: AgentActionProposalDetailProps) {
  const categoryStyle = CATEGORY_STYLE[proposal.toolCategory] ?? CATEGORY_STYLE['Unknown']!;
  const tierStyle = TIER_STYLE[proposal.blastRadiusTier] ?? TIER_STYLE['Auto']!;

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Agent Action Proposal
        </span>
      </div>

      <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2 text-xs">
        {/* Tool name */}
        <span className="text-muted-foreground flex items-center gap-1">
          <Wrench className="h-3 w-3 shrink-0" />
          Tool
        </span>
        <span className="font-mono text-[11px] font-medium">{proposal.toolName}</span>

        {/* Tool category */}
        <span className="text-muted-foreground">Category</span>
        <div>
          <Badge variant={categoryStyle.variant} className="text-[11px] h-5 px-1.5">
            {categoryStyle.label}
          </Badge>
        </div>

        {/* Blast-radius tier */}
        <span className="text-muted-foreground flex items-center gap-1">
          <Shield className="h-3 w-3 shrink-0" />
          Tier
        </span>
        <div>
          <Badge variant={tierStyle.variant} className="text-[11px] h-5 px-1.5">
            {tierStyle.label}
          </Badge>
        </div>

        {/* Rationale */}
        <span className="text-muted-foreground">Rationale</span>
        <p className="text-[11px] leading-relaxed">{proposal.rationale}</p>

        {/* Agent ID */}
        <span className="text-muted-foreground flex items-center gap-1">
          <Bot className="h-3 w-3 shrink-0" />
          Agent
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">{proposal.agentId}</span>

        {/* Machine ID (optional) */}
        {proposal.machineId && (
          <>
            <span className="text-muted-foreground flex items-center gap-1">
              <Cpu className="h-3 w-3 shrink-0" />
              Machine
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{proposal.machineId}</span>
          </>
        )}
      </div>
    </div>
  );
}
