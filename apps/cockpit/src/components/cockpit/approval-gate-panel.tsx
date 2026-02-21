import { useState } from 'react';
import type { ApprovalSummary } from '@portarium/cockpit-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { SodBanner, DEFAULT_SOD_EVALUATION } from './sod-banner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ApprovalGatePanelProps {
  approval: ApprovalSummary;
  onDecide: (decision: 'Approved' | 'Denied' | 'RequestChanges', rationale: string) => void;
  loading?: boolean;
}

export function ApprovalGatePanel({ approval, onDecide, loading }: ApprovalGatePanelProps) {
  const [rationale, setRationale] = useState('');
  const [denyAttempted, setDenyAttempted] = useState(false);
  const isPending = approval.status === 'Pending';

  const sodEval = approval.sodEvaluation ?? DEFAULT_SOD_EVALUATION;
  const isBlocked = sodEval.state === 'blocked-self' || sodEval.state === 'blocked-role';

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Approval Gate</CardTitle>
          <ApprovalStatusBadge status={approval.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md bg-muted/40 border border-border p-3 text-xs italic text-muted-foreground">
          {approval.prompt}
        </div>
        <div className="text-xs space-y-1">
          {approval.assigneeUserId && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Assignee</span>
              <span>{approval.assigneeUserId}</span>
            </div>
          )}
          {approval.dueAtIso && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due</span>
              <span>{format(new Date(approval.dueAtIso), 'MMM d, yyyy HH:mm')}</span>
            </div>
          )}
        </div>

        {isPending ? (
          <>
            <SodBanner eval={sodEval} />
            <Textarea
              className={cn(
                'text-xs min-h-16 resize-none',
                denyAttempted &&
                  !rationale.trim() &&
                  'border-yellow-500 focus-visible:ring-yellow-500',
              )}
              placeholder="Decision rationale — optional for approve, required for deny..."
              value={rationale}
              onChange={(e) => {
                setRationale(e.target.value);
                if (e.target.value.trim()) setDenyAttempted(false);
              }}
            />
            {denyAttempted && !rationale.trim() && (
              <p role="alert" className="text-xs text-yellow-600 font-medium">
                A rationale is required when denying an approval.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs flex-1 bg-success hover:bg-success/90 text-success-foreground"
                disabled={isBlocked || loading}
                title={
                  isBlocked
                    ? sodEval.state === 'blocked-self'
                      ? 'You cannot approve your own request'
                      : 'Missing required role'
                    : undefined
                }
                onClick={() => onDecide('Approved', rationale)}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs flex-1"
                disabled={loading}
                onClick={() => {
                  if (!rationale.trim()) {
                    setDenyAttempted(true);
                    return;
                  }
                  onDecide('Denied', rationale);
                }}
              >
                Deny
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={loading}
                onClick={() => onDecide('RequestChanges', rationale)}
              >
                Request Changes
              </Button>
            </div>
          </>
        ) : (
          <>
            {approval.rationale && (
              <div className="text-xs space-y-1">
                <span className="text-muted-foreground">Rationale:</span>
                <p>{approval.rationale}</p>
              </div>
            )}
            {approval.decidedByUserId && (
              <div className="text-xs text-muted-foreground">
                Decided by {approval.decidedByUserId}
                {approval.decidedAtIso &&
                  ` on ${format(new Date(approval.decidedAtIso), 'MMM d, yyyy HH:mm')}`}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
