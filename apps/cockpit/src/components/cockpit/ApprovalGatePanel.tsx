import { useState } from 'react'
import type { ApprovalSummary, ApprovalDecision } from '@portarium/cockpit-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const statusVariant: Record<
  ApprovalSummary['status'],
  'default' | 'ok' | 'warn' | 'danger' | 'info'
> = {
  Pending: 'warn',
  Approved: 'ok',
  Denied: 'danger',
  RequestChanges: 'info',
}

const statusLabel: Record<ApprovalSummary['status'], string> = {
  Pending: 'Pending',
  Approved: 'Approved',
  Denied: 'Denied',
  RequestChanges: 'Changes Requested',
}

interface ApprovalGatePanelProps {
  approval: ApprovalSummary
  onDecide: (decision: ApprovalDecision, rationale: string) => void
}

export function ApprovalGatePanel({ approval, onDecide }: ApprovalGatePanelProps) {
  const [rationale, setRationale] = useState('')
  const isPending = approval.status === 'Pending'
  const isValid = rationale.length >= 20

  const titleId = `approval-title-${approval.approvalId}`
  const charCountId = `approval-charcount-${approval.approvalId}`

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle id={titleId}>Approval Gate</CardTitle>
          <Badge variant={statusVariant[approval.status]}>
            {statusLabel[approval.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-bold text-[rgb(var(--foreground))]">Prompt</p>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">{approval.prompt}</p>
        </div>

        {approval.dueAtIso && (
          <p className="text-xs text-[rgb(var(--muted))]">
            Due: {new Date(approval.dueAtIso).toLocaleString()}
          </p>
        )}

        {isPending ? (
          <form
            aria-labelledby={titleId}
            onSubmit={(e) => e.preventDefault()}
            className="space-y-3"
          >
            <div>
              <label
                htmlFor={`rationale-${approval.approvalId}`}
                className="mb-1 block text-sm font-bold"
              >
                Rationale
              </label>
              <Textarea
                id={`rationale-${approval.approvalId}`}
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Provide a rationale for your decision (min 20 characters)..."
                aria-describedby={charCountId}
                className="min-h-[100px]"
              />
              <p
                id={charCountId}
                className={cn(
                  'mt-1 text-xs',
                  rationale.length < 20
                    ? 'text-[rgb(var(--status-warn))]'
                    : 'text-[rgb(var(--muted))]',
                )}
              >
                {rationale.length}/20 characters minimum
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={!isValid}
                onClick={() => onDecide('Approved', rationale)}
                className={cn(
                  isValid &&
                    'border-[rgb(var(--status-ok))] bg-[rgb(var(--status-ok))] hover:bg-[rgb(var(--status-ok)/0.9)]',
                )}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                disabled={!isValid}
                onClick={() => onDecide('Denied', rationale)}
              >
                Deny
              </Button>
              <Button
                variant="default"
                disabled={!isValid}
                onClick={() => onDecide('RequestChanges', rationale)}
              >
                Request Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 rounded-[var(--radius-sm)] border-2 border-[rgb(var(--border))] p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Decision:</span>
              <Badge variant={statusVariant[approval.status]}>
                {statusLabel[approval.status]}
              </Badge>
            </div>
            {approval.rationale && (
              <div>
                <span className="text-sm font-bold">Rationale:</span>
                <blockquote className="mt-1 border-l-4 border-[rgb(var(--border))] pl-3 text-sm text-[rgb(var(--muted))]">
                  {approval.rationale}
                </blockquote>
              </div>
            )}
            {approval.decidedByUserId && (
              <p className="text-xs text-[rgb(var(--muted))]">
                Decided by: {approval.decidedByUserId}
              </p>
            )}
            {approval.decidedAtIso && (
              <p className="text-xs text-[rgb(var(--muted))]">
                Decided at: {new Date(approval.decidedAtIso).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
