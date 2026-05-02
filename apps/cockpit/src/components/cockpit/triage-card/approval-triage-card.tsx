import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { useMemo } from 'react';
import { ModeSwitcher } from '../triage-modes/mode-switcher';
import { useTriageCard } from './use-triage-card';
import { TriageProgressDots } from './triage-progress-dots';
import { TriageCardHeader } from './triage-card-header';
import { TriageCardBody } from './triage-card-body';
import { TriageDecisionArea } from './triage-decision-area';
import { TriageKeyboardHints } from './triage-keyboard-hints';
import type { TriageAction, DragValidation } from './types';
import { buildApprovalCardContract } from './approval-card-contract';

export interface ApprovalTriageCardProps {
  approval: ApprovalSummary;
  index: number;
  total: number;
  hasMore: boolean;
  onAction: (approvalId: string, action: TriageAction, rationale: string) => void;
  loading?: boolean;
  plannedEffects?: PlanEffect[];
  evidenceEntries?: EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
  actionHistory?: Record<number, TriageAction>;
  undoAvailable?: boolean;
  onUndo?: () => void;
  externalDrag?: boolean;
  dragProgress?: number;
  isDragging?: boolean;
  onValidationChange?: (validation: DragValidation) => void;
  dragRejection?: 'approve' | 'deny' | null;
  policyLinkedMode?: boolean;
}

export function ApprovalTriageCard({
  approval,
  index,
  total,
  hasMore,
  onAction,
  loading,
  plannedEffects = [],
  evidenceEntries = [],
  run,
  workflow,
  actionHistory = {},
  undoAvailable = false,
  onUndo,
  externalDrag = false,
  dragProgress: externalDragProgress = 0,
  isDragging: externalIsDragging = false,
  onValidationChange,
  dragRejection = null,
  policyLinkedMode = false,
}: ApprovalTriageCardProps) {
  const cardContract = useMemo(
    () =>
      buildApprovalCardContract({
        approval,
        plannedEffects,
        evidenceEntries,
        run,
        workflow,
      }),
    [approval, evidenceEntries, plannedEffects, run, workflow],
  );

  const card = useTriageCard({
    approval,
    onAction,
    loading,
    plannedEffects,
    evidenceEntries,
    run,
    workflow,
    undoAvailable,
    onUndo,
    onValidationChange,
    dragRejection,
    cardContract,
  });

  const proposedAction =
    plannedEffects[0]?.summary ??
    (approval.agentActionProposal
      ? `${approval.agentActionProposal.toolName} via ${approval.agentActionProposal.agentId}`
      : approval.prompt);
  const gateReason = approval.policyRule?.tier
    ? `${approval.policyRule.tier} review is required for this Action.`
    : 'Policy Studio opened this live case for focused review.';
  const blastRadius =
    approval.policyRule?.blastRadius && approval.policyRule.blastRadius.length > 0
      ? approval.policyRule.blastRadius.join(', ')
      : 'No external system blast radius declared';
  const evidenceSummary =
    evidenceEntries.length > 0
      ? `${evidenceEntries.length} evidence item${evidenceEntries.length === 1 ? '' : 's'} linked to this Run`
      : 'No linked evidence items are available yet';
  const recommendation = card.isBlocked
    ? 'Do not approve from this account; hand off or request another approver.'
    : approval.policyRule?.tier === 'ManualOnly'
      ? 'Treat this as manual-only unless a policy owner changes the future default.'
      : 'Review the evidence packet, then approve only if the proposed Action matches policy and intent.';

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <TriageProgressDots
        approvalId={approval.approvalId}
        index={index}
        total={total}
        actionHistory={actionHistory}
      />

      <div className="relative">
        <div
          className="relative rounded-xl border border-border bg-card shadow-md overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[480px]"
          style={{ zIndex: 2 }}
        >
          <TriageCardHeader
            approval={approval}
            evidenceEntries={evidenceEntries}
            run={run}
            workflow={workflow}
            isOverdue={card.isOverdue}
          />

          {!policyLinkedMode ? (
            <div className="px-5 pt-3 pb-0 shrink-0">
              <ModeSwitcher context={card.approvalContext} />
            </div>
          ) : null}

          <div className="px-5 py-5 flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
            {policyLinkedMode ? (
              <>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                    Focused policy-linked review
                  </div>
                  <div className="mt-2 text-base font-semibold text-foreground">
                    Decide this live case now
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The staged Policy draft affects future cases later. This card is only the
                    immediate Approval decision.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-border bg-background/80 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Proposed Action
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">{proposedAction}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background/80 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Why gated
                      </div>
                      <p className="mt-2 text-sm text-foreground">{gateReason}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background/80 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Current recommendation
                      </div>
                      <p className="mt-2 text-sm text-foreground">{recommendation}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-border bg-background/80 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Blast radius
                      </div>
                      <p className="mt-2 text-sm text-foreground">{blastRadius}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background/80 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Evidence sufficiency
                      </div>
                      <p className="mt-2 text-sm text-foreground">{evidenceSummary}</p>
                    </div>
                  </div>
                </div>

                <TriageDecisionArea
                  approvalId={approval.approvalId}
                  rationale={card.rationale}
                  onRationaleChange={card.setRationale}
                  requestChangesMode={card.requestChangesMode}
                  requestChangesMsg={card.requestChangesMsg}
                  onRequestChangesMsgChange={card.setRequestChangesMsg}
                  onCancelRequestChanges={card.cancelRequestChanges}
                  onAction={card.handleAction}
                  loading={loading}
                  isBlocked={card.isBlocked}
                  denyAttempted={card.denyAttempted}
                  onDenyAttempted={() => card.setDenyAttempted(true)}
                  shouldShakeApprove={card.shouldShakeApprove}
                  shouldShakeRationale={card.shouldShakeRationale}
                  onRationaleFocus={() => card.setRationaleHasFocus(true)}
                  onRationaleBlur={() => card.setRationaleHasFocus(false)}
                  reviewFriction={cardContract.friction}
                  approveAttempted={card.approveAttempted}
                  approveConfirmArmed={card.approveConfirmArmed}
                />

                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Evidence and policy context
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use this section to confirm the evidence packet and policy basis before
                    deciding. Deep audit detail remains available below.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background/80 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Deep audit detail
                  </div>
                  <ModeSwitcher context={card.approvalContext} />
                </div>

                <TriageCardBody
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                  triageViewMode={card.triageViewMode}
                  setTriageViewMode={card.setTriageViewMode}
                  sodEval={card.sodEval}
                  flashSodBanner={card.flashSodBanner}
                  prefersReducedMotion={card.prefersReducedMotion}
                  cardContract={cardContract}
                />
              </>
            ) : (
              <>
                <TriageCardBody
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                  triageViewMode={card.triageViewMode}
                  setTriageViewMode={card.setTriageViewMode}
                  sodEval={card.sodEval}
                  flashSodBanner={card.flashSodBanner}
                  prefersReducedMotion={card.prefersReducedMotion}
                  cardContract={cardContract}
                />

                <TriageDecisionArea
                  approvalId={approval.approvalId}
                  rationale={card.rationale}
                  onRationaleChange={card.setRationale}
                  requestChangesMode={card.requestChangesMode}
                  requestChangesMsg={card.requestChangesMsg}
                  onRequestChangesMsgChange={card.setRequestChangesMsg}
                  onCancelRequestChanges={card.cancelRequestChanges}
                  onAction={card.handleAction}
                  loading={loading}
                  isBlocked={card.isBlocked}
                  denyAttempted={card.denyAttempted}
                  onDenyAttempted={() => card.setDenyAttempted(true)}
                  shouldShakeApprove={card.shouldShakeApprove}
                  shouldShakeRationale={card.shouldShakeRationale}
                  onRationaleFocus={() => card.setRationaleHasFocus(true)}
                  onRationaleBlur={() => card.setRationaleHasFocus(false)}
                  reviewFriction={cardContract.friction}
                  approveAttempted={card.approveAttempted}
                  approveConfirmArmed={card.approveConfirmArmed}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <TriageKeyboardHints
        rationaleHasFocus={card.rationaleHasFocus}
        undoAvailable={undoAvailable}
      />
    </div>
  );
}
