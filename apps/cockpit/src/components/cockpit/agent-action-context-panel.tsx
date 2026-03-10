import type { AgentActionProposalMeta, PolicyRule } from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { Bot, Cpu, Shield, Wrench, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Visual mapping for tool category + blast-radius tier
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  AgentActionProposalMeta['toolCategory'],
  { variant: 'secondary' | 'warning' | 'destructive' | 'outline'; label: string; icon: typeof Bot }
> = {
  ReadOnly: { variant: 'secondary', label: 'Read-only', icon: CheckCircle2 },
  Mutation: { variant: 'warning', label: 'Mutation', icon: AlertTriangle },
  Dangerous: { variant: 'destructive', label: 'Dangerous', icon: AlertTriangle },
  Unknown: { variant: 'outline', label: 'Unknown', icon: FileText },
};

const TIER_CONFIG: Record<
  AgentActionProposalMeta['blastRadiusTier'],
  { variant: 'secondary' | 'outline' | 'warning' | 'destructive'; label: string }
> = {
  Auto: { variant: 'secondary', label: 'Auto-approved' },
  Assisted: { variant: 'outline', label: 'Assisted' },
  HumanApprove: { variant: 'warning', label: 'Human Approve' },
  ManualOnly: { variant: 'destructive', label: 'Manual Only' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AgentActionContextPanelProps {
  proposal: AgentActionProposalMeta;
  /** Optional policy rule for additional context. */
  policyRule?: PolicyRule;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentActionContextPanel({ proposal, policyRule }: AgentActionContextPanelProps) {
  const category = CATEGORY_CONFIG[proposal.toolCategory] ?? CATEGORY_CONFIG['Unknown'];
  const tier = TIER_CONFIG[proposal.blastRadiusTier] ?? TIER_CONFIG['Auto'];

  const isDangerous =
    proposal.toolCategory === 'Dangerous' || proposal.blastRadiusTier === 'ManualOnly';

  return (
    <section
      aria-label="Agent action context"
      className={cn(
        'rounded-lg border bg-card px-4 py-4 space-y-4',
        isDangerous ? 'border-destructive/40' : 'border-border',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Agent Action Context
          </h3>
        </div>
        <Badge variant={category.variant} className="text-[11px] h-5 px-1.5">
          {category.label}
        </Badge>
      </div>

      {/* Agent & Machine */}
      <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5 space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Agent:</span>
          <span className="font-mono text-[11px] font-medium">{proposal.agentId}</span>
        </div>
        {proposal.machineId && (
          <div className="flex items-center gap-2 text-xs">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Machine:</span>
            <span className="font-mono text-[11px] font-medium">{proposal.machineId}</span>
          </div>
        )}
      </div>

      {/* Proposed Tool */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Proposed Tool
        </p>
        <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Wrench className="h-3 w-3 shrink-0" />
            Name
          </span>
          <span className="font-mono text-[11px] font-medium">{proposal.toolName}</span>

          <span className="text-muted-foreground flex items-center gap-1">
            <Shield className="h-3 w-3 shrink-0" />
            Tier
          </span>
          <div>
            <Badge variant={tier.variant} className="text-[11px] h-5 px-1.5">
              {tier.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Rationale */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Agent Rationale
        </p>
        <p className="text-xs leading-relaxed text-foreground bg-muted/30 rounded-md px-3 py-2 border border-border/50">
          {proposal.rationale}
        </p>
      </div>

      {/* Policy evaluation (when available) */}
      {policyRule && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Policy Evaluation
          </p>
          <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1 text-xs">
            <span className="text-muted-foreground">Rule</span>
            <span className="font-mono text-[11px]">{policyRule.ruleId}</span>

            <span className="text-muted-foreground">Trigger</span>
            <span className="text-[11px] truncate" title={policyRule.trigger}>
              {policyRule.trigger}
            </span>

            <span className="text-muted-foreground">Risk</span>
            <span className="text-[11px]">
              {policyRule.irreversibility === 'full'
                ? 'Fully irreversible'
                : policyRule.irreversibility === 'partial'
                  ? 'Partially reversible'
                  : 'Reversible'}
            </span>

            {policyRule.blastRadius.length > 0 && (
              <>
                <span className="text-muted-foreground">Blast</span>
                <div className="flex flex-wrap gap-1">
                  {policyRule.blastRadius.map((br) => (
                    <Badge key={br} variant="outline" className="text-[10px] h-4 px-1">
                      {br}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
