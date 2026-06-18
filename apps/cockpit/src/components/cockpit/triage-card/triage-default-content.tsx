import type {
  ApprovalPacket,
  ApprovalPacketDecisionView,
  ApprovalSummary,
  EvidenceEntry,
  PlanEffect,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { useState } from 'react';
import { FileText, GitBranch, KeyRound, Layers3, PackageCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProvenanceJourney } from '../provenance-journey';
import { VisualEvidenceTimeline } from '../visual-evidence-timeline';
import { AgentActionProposalDetail } from './agent-action-proposal-detail';
import { ApprovalCardContractPanel } from './approval-card-contract-panel';
import { PolicyRulePanel } from './policy-rule-panel';
import { TriageEffectRow } from './triage-effect-row';
import { summarizeApprovalPrompt, type ApprovalCardContract } from './approval-card-contract';

export interface TriageDefaultContentProps {
  approval: ApprovalSummary;
  plannedEffects: PlanEffect[];
  evidenceEntries?: EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
  cardContract: ApprovalCardContract;
}

type ApprovalPacketReviewView = 'brief' | 'flow' | 'debate' | 'risk' | 'evidence';

const APPROVAL_PACKET_REVIEW_VIEWS: ReadonlyArray<{
  id: ApprovalPacketReviewView;
  label: string;
}> = [
  { id: 'brief', label: 'Brief' },
  { id: 'flow', label: 'Flow' },
  { id: 'debate', label: 'Debate' },
  { id: 'risk', label: 'Risk' },
  { id: 'evidence', label: 'Evidence' },
];

function decisionViewToneClass(tone: string | undefined): string {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200';
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200';
    case 'info':
      return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200';
    default:
      return 'border-border bg-background text-foreground';
  }
}

function isFlowDecisionView(view: ApprovalPacketDecisionView): boolean {
  return view.kind === 'flow' || Boolean(view.diagram);
}

function DecisionViewCard({
  view,
  showDiagram = false,
}: {
  view: ApprovalPacketDecisionView;
  showDiagram?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{view.label}</Badge>
        {view.kind && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {view.kind}
          </Badge>
        )}
        <span className="text-[11px] font-medium text-muted-foreground">{view.stance}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-foreground">{view.summary}</p>
      <div className="mt-2">
        <BulletList values={view.bullets} />
      </div>
      {view.items && view.items.length > 0 && (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {view.items.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className={`rounded border px-2.5 py-2 ${decisionViewToneClass(item.tone)}`}
            >
              <dt className="text-[10px] font-semibold uppercase text-current opacity-70">
                {item.label}
              </dt>
              <dd className="mt-1 text-xs leading-relaxed">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {showDiagram && view.diagram && (
        <pre
          aria-label={`${view.label} diagram`}
          className="mt-3 max-h-64 overflow-auto rounded border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-muted-foreground"
        >
          {view.diagram}
        </pre>
      )}
    </div>
  );
}

function BulletList({ values }: { values: readonly string[] }) {
  return (
    <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
      {values.map((value, index) => (
        <li key={`${value}-${index}`} className="flex gap-2">
          <span
            aria-hidden="true"
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
          />
          <span>{value}</span>
        </li>
      ))}
    </ul>
  );
}

function BriefField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

function ApprovalPacketTriagePanel({
  packet,
  evidenceEntries,
}: {
  packet: ApprovalPacket;
  evidenceEntries: readonly EvidenceEntry[];
}) {
  const [activeView, setActiveView] = useState<ApprovalPacketReviewView>('brief');
  const primaryArtifact = packet.artifacts.find((artifact) => artifact.role === 'primary');
  const supportingArtifacts = packet.artifacts.filter((artifact) => artifact.role !== 'primary');
  const brief = packet.operatorBrief;
  const decisionViews = packet.decisionViews ?? [];
  const flowDecisionViews = decisionViews.filter(isFlowDecisionView);
  const debateDecisionViews = decisionViews.filter((view) => !isFlowDecisionView(view));
  const riskDecisionViews = decisionViews.filter((view) => view.kind === 'risk');
  const evidenceDecisionViews = decisionViews.filter((view) => view.kind === 'evidence');

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

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/20 p-1">
        {APPROVAL_PACKET_REVIEW_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            aria-pressed={activeView === view.id}
            onClick={() => setActiveView(view.id)}
            className={`min-h-8 rounded px-3 text-xs font-medium transition ${
              activeView === view.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
            } scroll-mb-48 scroll-mt-4`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {activeView === 'brief' && (
        <div className="space-y-3">
          {brief ? (
            <>
              <BriefField label="Action" value={brief.action} />
              <BriefField label="Why gated" value={brief.whyGated} />
              <div className="grid gap-3 md:grid-cols-2">
                <BriefField label="Recommendation" value={brief.recommendation} />
                <BriefField label="Risk" value={brief.risk} />
                <BriefField label="Rollback" value={brief.rollback} />
                <BriefField label="Operator impact" value={brief.userVisibleConsequence} />
              </div>
            </>
          ) : (
            <BriefField
              label="Decision"
              value={summarizeApprovalPrompt(packet.planScope.summary, 320)}
            />
          )}
        </div>
      )}

      {activeView === 'debate' && (
        <div className="space-y-3">
          {(debateDecisionViews.length > 0 ? debateDecisionViews : decisionViews).length > 0 ? (
            (debateDecisionViews.length > 0 ? debateDecisionViews : decisionViews).map((view) => (
              <DecisionViewCard key={view.id} view={view} />
            ))
          ) : (
            <BriefField label="Decision views" value="No additional viewpoints were supplied." />
          )}
        </div>
      )}

      {activeView === 'flow' && (
        <div className="space-y-3">
          {flowDecisionViews.length > 0 ? (
            flowDecisionViews.map((view) => (
              <DecisionViewCard key={view.id} view={view} showDiagram />
            ))
          ) : (
            <div className="rounded-md border border-border bg-muted/10 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Flow
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                No custom approval flow was supplied.
              </p>
            </div>
          )}
        </div>
      )}

      {activeView === 'risk' && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/10 p-3">
              <BriefField
                label="Risk"
                value={brief?.risk ?? summarizeApprovalPrompt(packet.planScope.summary, 260)}
              />
              {brief?.whatApprovingAllows && (
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Approving allows
                  </p>
                  <BulletList values={brief.whatApprovingAllows} />
                </div>
              )}
            </div>
            <div className="rounded-md border border-border bg-muted/10 p-3">
              <BriefField label="Rollback" value={brief?.rollback ?? 'Not supplied'} />
              {brief?.whatApprovingDoesNotAllow && (
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Does not allow
                  </p>
                  <BulletList values={brief.whatApprovingDoesNotAllow} />
                </div>
              )}
            </div>
          </div>
          {riskDecisionViews.map((view) => (
            <DecisionViewCard key={view.id} view={view} />
          ))}
        </div>
      )}

      {activeView === 'evidence' && (
        <div className="space-y-3">
          {evidenceDecisionViews.length > 0 && (
            <div className="space-y-3">
              {evidenceDecisionViews.map((view) => (
                <DecisionViewCard key={view.id} view={view} />
              ))}
            </div>
          )}

          <VisualEvidenceTimeline
            evidenceEntries={evidenceEntries}
            approvalPacket={packet}
            variant="detail"
          />

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
                    <Badge
                      variant={capability.required ? 'secondary' : 'outline'}
                      className="mr-1.5"
                    >
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
        </div>
      )}
    </section>
  );
}

export function TriageDefaultContent({
  approval,
  plannedEffects,
  evidenceEntries = [],
  run,
  workflow,
  cardContract,
}: TriageDefaultContentProps) {
  const policyRule = approval.policyRule;
  return (
    <>
      <ApprovalCardContractPanel contract={cardContract} />
      <VisualEvidenceTimeline
        evidenceEntries={evidenceEntries}
        approvalPacket={approval.approvalPacket}
        variant="compact"
        maxItems={3}
        className="rounded-lg border border-border bg-muted/10 p-3"
      />
      {approval.approvalPacket && (
        <ApprovalPacketTriagePanel
          packet={approval.approvalPacket}
          evidenceEntries={evidenceEntries}
        />
      )}
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
