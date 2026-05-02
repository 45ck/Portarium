import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, RotateCcw, SkipForward } from 'lucide-react';
import { RequestChangesForm } from './request-changes-form';
import type { TriageAction } from './types';
import type { ApprovalCardFriction } from './approval-card-contract';

export interface TriageDecisionAreaProps {
  approvalId: string;
  rationale: string;
  onRationaleChange: (value: string) => void;
  requestChangesMode: boolean;
  requestChangesMsg: string;
  onRequestChangesMsgChange: (value: string) => void;
  onCancelRequestChanges: () => void;
  onAction: (action: TriageAction) => void;
  loading?: boolean;
  isBlocked: boolean;
  denyAttempted: boolean;
  onDenyAttempted: () => void;
  shouldShakeApprove: boolean;
  shouldShakeRationale: boolean;
  onRationaleFocus: () => void;
  onRationaleBlur: () => void;
  reviewFriction: ApprovalCardFriction;
  approveAttempted: boolean;
  approveConfirmArmed: boolean;
}

export function TriageDecisionArea({
  approvalId,
  rationale,
  onRationaleChange,
  requestChangesMode,
  requestChangesMsg,
  onRequestChangesMsgChange,
  onCancelRequestChanges,
  onAction,
  loading,
  isBlocked,
  denyAttempted,
  onDenyAttempted,
  shouldShakeApprove,
  shouldShakeRationale,
  onRationaleFocus,
  onRationaleBlur,
  reviewFriction,
  approveAttempted,
  approveConfirmArmed,
}: TriageDecisionAreaProps) {
  if (requestChangesMode) {
    return (
      <RequestChangesForm
        message={requestChangesMsg}
        onMessageChange={onRequestChangesMsgChange}
        onSubmit={onAction}
        onCancel={onCancelRequestChanges}
        loading={loading}
      />
    );
  }

  return (
    <div className="shrink-0 space-y-3">
      <motion.div
        animate={shouldShakeRationale ? { x: [0, 6, -6, 4, -4, 2, 0] } : { x: 0 }}
        transition={shouldShakeRationale ? { duration: 0.35, ease: 'easeInOut' } : { duration: 0 }}
      >
        <Textarea
          aria-label={`Decision rationale for approval ${approvalId}`}
          className={cn(
            'text-xs min-h-[80px] resize-none',
            ((denyAttempted && !rationale.trim()) ||
              (approveAttempted && reviewFriction.requireRationale && !rationale.trim())) &&
              'border-yellow-500 focus-visible:ring-yellow-500',
          )}
          placeholder="Decision rationale — optional for approve, required for deny…"
          value={rationale}
          onChange={(e) => onRationaleChange(e.target.value)}
          onFocus={onRationaleFocus}
          onBlur={onRationaleBlur}
        />
      </motion.div>
      {approveAttempted && reviewFriction.requireRationale && !rationale.trim() ? (
        <p role="alert" className="text-xs text-yellow-600 font-medium">
          A rationale is required when approving high-risk Actions.
        </p>
      ) : approveAttempted && reviewFriction.requireSecondConfirm && !approveConfirmArmed ? (
        <p role="alert" className="text-xs text-yellow-600 font-medium">
          High-risk approval requires a second confirmation.
        </p>
      ) : denyAttempted && !rationale.trim() ? (
        <p role="alert" className="text-xs text-yellow-600 font-medium">
          A rationale is required when denying an approval.
        </p>
      ) : approveConfirmArmed ? (
        <p role="alert" className="text-xs text-yellow-600 font-medium">
          Review complete. Press Confirm to approve this high-risk Action.
        </p>
      ) : rationale.trim() ? (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Rationale provided
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Required when denying <span className="text-red-500">*</span>
        </p>
      )}

      <div
        role="group"
        aria-label="Make approval decision"
        className="grid grid-cols-2 sm:grid-cols-[1.5fr_1fr_1fr_0.75fr] gap-2"
      >
        <motion.div
          animate={shouldShakeApprove ? { x: [0, 8, -8, 6, -6, 3, 0] } : { x: 0 }}
          transition={shouldShakeApprove ? { duration: 0.4, ease: 'easeInOut' } : { duration: 0 }}
        >
          <Button
            size="sm"
            className="h-14 w-full flex-col gap-1 bg-green-600 hover:bg-green-700 text-white border-0"
            disabled={isBlocked || reviewFriction.escalationLock || Boolean(loading)}
            onClick={() => onAction('Approved')}
            title={
              reviewFriction.escalationLock
                ? (reviewFriction.lockReason ?? 'Approve is locked')
                : 'Approve (A)'
            }
            aria-keyshortcuts="a"
          >
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-[11px]">
              {reviewFriction.requireSecondConfirm && approveConfirmArmed ? 'Confirm' : 'Approve'}
            </span>
          </Button>
        </motion.div>
        <Button
          variant="destructive"
          size="sm"
          className="h-12 flex-col gap-1"
          disabled={Boolean(loading)}
          onClick={() => {
            if (!rationale.trim()) {
              onDenyAttempted();
              return;
            }
            onAction('Denied');
          }}
          title="Deny (D)"
          aria-keyshortcuts="d"
        >
          <XCircle className="h-5 w-5" />
          <span className="text-[11px]">Deny</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-12 flex-col gap-1"
          disabled={Boolean(loading)}
          onClick={() => onAction('RequestChanges')}
          title="Request changes (R)"
          aria-keyshortcuts="r"
        >
          <RotateCcw className="h-5 w-5" />
          <span className="text-[11px]">Changes</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 flex-col gap-1 text-muted-foreground"
          disabled={Boolean(loading)}
          onClick={() => onAction('Skip')}
          title="Skip (S)"
          aria-keyshortcuts="s"
        >
          <SkipForward className="h-4 w-4" />
          <span className="text-[11px]">Skip</span>
        </Button>
      </div>
    </div>
  );
}
