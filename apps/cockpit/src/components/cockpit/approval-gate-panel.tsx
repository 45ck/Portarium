import { useState } from 'react';
import type { ApprovalSummary } from '@portarium/cockpit-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { format } from 'date-fns';

interface ApprovalGatePanelProps {
  approval: ApprovalSummary;
  onDecide: (decision: 'Approved' | 'Denied' | 'RequestChanges', rationale: string) => void;
  loading?: boolean;
}

export function ApprovalGatePanel({ approval, onDecide, loading }: ApprovalGatePanelProps) {
  const [rationale, setRationale] = useState('');
  const isPending = approval.status === 'Pending';

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
            <Textarea
              className="text-xs min-h-16 resize-none"
              placeholder="Provide your decision rationale..."
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs flex-1 bg-success hover:bg-success/90 text-success-foreground"
                disabled={loading}
                onClick={() => onDecide('Approved', rationale)}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs flex-1"
                disabled={loading}
                onClick={() => onDecide('Denied', rationale)}
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
