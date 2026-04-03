import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { ModeSwitcher } from '../triage-modes/mode-switcher';
import { useTriageCard } from './use-triage-card';
import { TriageProgressDots } from './triage-progress-dots';
import { TriageCardHeader } from './triage-card-header';
import { TriageCardBody } from './triage-card-body';
import { TriageDecisionArea } from './triage-decision-area';
import { TriageKeyboardHints } from './triage-keyboard-hints';
import type { TriageAction, DragValidation } from './types';

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
  });

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

          <div className="px-5 pt-3 pb-0 shrink-0">
            <ModeSwitcher context={card.approvalContext} />
          </div>

          <div className="px-5 py-5 flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
            {policyLinkedMode ? (
              <>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                    Focused review
                  </div>
                  <div className="mt-2 text-base font-semibold text-foreground">
                    Decide this live case now
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-border bg-background/80 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Why it is here
                      </div>
                      <p className="mt-2 text-sm text-foreground">
                        {approval.policyRule?.tier
                          ? `Policy requires ${approval.policyRule.tier} review for this action.`
                          : 'This approval was opened from Policy Studio for focused review.'}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-background/80 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Decision needed
                      </div>
                      <p className="mt-2 text-sm text-foreground">
                        Approve, deny, or request changes before returning to the staged policy
                        draft.
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-background/80 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Return path
                      </div>
                      <p className="mt-2 text-sm text-foreground">
                        Policy Studio keeps the draft state so you can adjust the future default
                        after this decision.
                      </p>
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
                />

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
