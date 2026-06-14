import type {
  ApprovalPacket,
  ApprovalSummary,
  PlanEffect,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { FileText, KeyRound, Layers3, PackageCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProvenanceJourney } from '../provenance-journey';
import { AgentActionProposalDetail } from './agent-action-proposal-detail';
import { ApprovalCardContractPanel } from './approval-card-contract-panel';
import { PolicyRulePanel } from './policy-rule-panel';
import { TriageEffectRow } from './triage-effect-row';
import { summarizeApprovalPrompt, type ApprovalCardContract } from './approval-card-contract';

export interface TriageDefaultContentProps {
  approval: ApprovalSummary;
  plannedEffects: PlanEffect[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
  cardContract: ApprovalCardContract;
}

function ApprovalPacketTriagePanel({ packet }: { packet: ApprovalPacket }) {
  const primaryArtifact = packet.artifacts.find((artifact) => artifact.role === 'primary');
  const supportingArtifacts = packet.artifacts.filter((artifact) => artifact.role !== 'primary');

  return (
    <section className="rounded-lg border border-border bg-background px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-primary" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Approval packet detail
          </p>
        </div>
        <Badge variant="outline" className="max-w-full truncate font-mono text-[10px]">
          {packet.packetId}
        </Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/10 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Layers3 className="h-4 w-4 text-muted-foreground" />
            Plan scope
          </div>
          <p className="mt-2 text-xs leading-relaxed text-foreground">
            {summarizeApprovalPrompt(packet.planScope.summary, 260)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {packet.planScope.actionIds.map((actionId) => (
              <Badge key={actionId} variant="secondary" className="font-mono text-[10px]">
                {actionId}
              </Badge>
            ))}
            {packet.planScope.plannedEffectIds.map((effectId) => (
              <Badge key={effectId} variant="outline" className="font-mono text-[10px]">
                {effectId}
              </Badge>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/10 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Capabilities
          </div>
          <div className="mt-2 space-y-2">
            {packet.requestedCapabilities.map((capability) => (
              <div key={capability.capabilityId} className="text-xs leading-relaxed">
                <Badge variant={capability.required ? 'secondary' : 'outline'} className="mr-1.5">
                  {capability.required ? 'Required' : 'Optional'}
                </Badge>
                <span className="font-mono">{capability.capabilityId}</span>
                <span className="text-muted-foreground"> - {capability.reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/10 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Review docs
        </div>
        <div className="mt-2 space-y-2">
          {packet.reviewDocs.map((doc, index) => {
            const openByDefault = packet.reviewDocs.length === 1 && doc.markdown.length < 600;
            return (
              <details key={`${doc.title}-${index}`} className="group" open={openByDefault}>
                <summary className="cursor-pointer text-xs font-medium">{doc.title}</summary>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {doc.markdown}
                </p>
              </details>
            );
          })}
        </div>
      </div>

      {(primaryArtifact || supportingArtifacts.length > 0) && (
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {primaryArtifact && (
            <Badge variant="secondary" className="max-w-full truncate">
              {primaryArtifact.title}
            </Badge>
          )}
          {supportingArtifacts.map((artifact) => (
            <Badge key={artifact.artifactId} variant="outline" className="max-w-full truncate">
              {artifact.title}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}

export function TriageDefaultContent({
  approval,
  plannedEffects,
  run,
  workflow,
  cardContract,
}: TriageDefaultContentProps) {
  const policyRule = approval.policyRule;
  return (
    <>
      <ApprovalCardContractPanel contract={cardContract} />
      {approval.approvalPacket && <ApprovalPacketTriagePanel packet={approval.approvalPacket} />}
      <ProvenanceJourney approval={approval} run={run} workflow={workflow} />
      {approval.agentActionProposal && (
        <AgentActionProposalDetail proposal={approval.agentActionProposal} />
      )}
      {policyRule && (
        <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
          <PolicyRulePanel rule={policyRule} />
        </div>
      )}
      {plannedEffects.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            What will happen if approved
          </p>
          <div className="divide-y divide-border/40">
            {plannedEffects.map((e) => (
              <TriageEffectRow key={e.effectId} effect={e} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
