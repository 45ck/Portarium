import { useState } from 'react';
import type { ApprovalSummary } from '@portarium/cockpit-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { SodBanner, DEFAULT_SOD_EVALUATION } from './sod-banner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Bot, Zap, AlertTriangle, Eye } from 'lucide-react';

const TIER_CONFIG = {
  Auto: {
    label: 'Auto',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  Assisted: {
    label: 'Assisted',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  HumanApprove: {
    label: 'Human Approve',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
  ManualOnly: {
    label: 'Manual Only',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
} as const;

const CATEGORY_ICON = {
  ReadOnly: Eye,
  Mutation: Zap,
  Dangerous: AlertTriangle,
  Unknown: Bot,
} as const;

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

        {approval.agentActionProposal && (
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">Agent Action</span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <Badge variant="secondary" className="text-xs font-mono">
                {approval.agentActionProposal.toolName}
              </Badge>
              {(() => {
                const tier =
                  TIER_CONFIG[approval.agentActionProposal.blastRadiusTier] ?? TIER_CONFIG.Auto;
                return (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      tier.className,
                    )}
                  >
                    {tier.label}
                  </span>
                );
              })()}
              {(() => {
                const Icon = CATEGORY_ICON[approval.agentActionProposal.toolCategory] ?? Bot;
                return (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    {approval.agentActionProposal.toolCategory}
                  </span>
                );
              })()}
            </div>
            {approval.agentActionProposal.rationale && (
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                {approval.agentActionProposal.rationale}
              </p>
            )}
            <div className="text-xs text-muted-foreground">
              Agent: <span className="font-mono">{approval.agentActionProposal.agentId}</span>
            </div>
          </div>
        )}

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
