import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import type { TriageViewMode } from '@/stores/ui-store';
import type { ApprovalContext } from '@/components/cockpit/triage-modes/lib/approval-context';
import type { SodEvaluation } from '@portarium/cockpit-types';
import { SodBanner } from '../sod-banner';
import { ApprovalContextPanels } from '../approval-context-panels';
import { ModeErrorBoundary, MODE_COMPONENTS } from './mode-error-boundary';
import { TriageDefaultContent } from './triage-default-content';
import type { ApprovalCardContract } from './approval-card-contract';

export interface TriageCardBodyProps {
  approval: ApprovalSummary;
  plannedEffects: PlanEffect[];
  evidenceEntries: EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
  triageViewMode: TriageViewMode;
  setTriageViewMode: (mode: TriageViewMode) => void;
  sodEval: SodEvaluation;
  flashSodBanner: boolean;
  prefersReducedMotion: boolean | null;
  cardContract: ApprovalCardContract;
}

export function TriageCardBody({
  approval,
  plannedEffects,
  evidenceEntries,
  run,
  workflow,
  triageViewMode,
  setTriageViewMode,
  sodEval,
  flashSodBanner,
  prefersReducedMotion,
  cardContract,
}: TriageCardBodyProps) {
  return (
    <>
      <ModeErrorBoundary modeKey={triageViewMode}>
        <div
          className="flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain rounded-lg pr-1 select-text cursor-auto"
          data-approval-review-scroll
          data-approval-copy-region
        >
          <div className="flex flex-col gap-2 xl:flex-row xl:items-start">
            <motion.div
              className="min-w-0 shrink-0"
              animate={
                flashSodBanner && !prefersReducedMotion
                  ? {
                      scale: [1, 1.02, 1],
                      boxShadow: [
                        '0 0 0 0px rgba(239,68,68,0)',
                        '0 0 0 3px rgba(239,68,68,0.3)',
                        '0 0 0 0px rgba(239,68,68,0)',
                      ],
                    }
                  : {}
              }
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <SodBanner eval={sodEval} variant="compact" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <ApprovalContextPanels
                approval={approval}
                evidenceEntries={evidenceEntries}
                run={run}
                onOpenMode={setTriageViewMode}
                variant="compact"
              />
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={triageViewMode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {triageViewMode === 'default' ? (
                <TriageDefaultContent
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                  cardContract={cardContract}
                />
              ) : (
                (() => {
                  const ModeComponent = MODE_COMPONENTS[triageViewMode];
                  return ModeComponent ? (
                    <ModeComponent
                      approval={approval}
                      plannedEffects={plannedEffects}
                      evidenceEntries={evidenceEntries}
                      run={run}
                      workflow={workflow}
                    />
                  ) : null;
                })()
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </ModeErrorBoundary>
    </>
  );
}
