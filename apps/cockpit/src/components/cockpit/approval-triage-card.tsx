import { useState } from 'react'
import { format } from 'date-fns'
import type { ApprovalSummary } from '@portarium/cockpit-types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  ShieldCheck,
  ShieldAlert,
  Zap,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Mock SoD evaluation — in production this would come from the API
// ---------------------------------------------------------------------------
type SodState = 'eligible' | 'blocked-self' | 'blocked-role' | 'n-of-m'

interface SodEvaluation {
  state: SodState
  requestorId: string
  ruleId: string
  rolesRequired: string[]
  nRequired?: number
  nTotal?: number
  nSoFar?: number
}

function getSodEvaluation(approval: ApprovalSummary): SodEvaluation {
  // Demo: hardcode a realistic evaluation per approval
  if (approval.approvalId === 'apr-3002') {
    return {
      state: 'n-of-m',
      requestorId: approval.requestedByUserId,
      ruleId: 'SOD-IAM-002',
      rolesRequired: ['approver', 'admin'],
      nRequired: 2,
      nTotal: 3,
      nSoFar: 1,
    }
  }
  return {
    state: 'eligible',
    requestorId: approval.requestedByUserId,
    ruleId: 'SOD-FINANCE-001',
    rolesRequired: ['approver', 'admin'],
  }
}

// ---------------------------------------------------------------------------
// Mock policy rule — in production this comes from the plan's policy context
// ---------------------------------------------------------------------------
interface PolicyRule {
  ruleId: string
  trigger: string
  tier: string
  blastRadius: string
  irreversibility: 'full' | 'partial' | 'none'
}

function getPolicyRule(approval: ApprovalSummary): PolicyRule {
  if (approval.approvalId === 'apr-3002') {
    return {
      ruleId: 'IAM-APPROVAL-002',
      trigger: 'write:iam AND access_change',
      tier: 'Human-approve',
      blastRadius: '1 system (Okta) | 3 records affected',
      irreversibility: 'partial',
    }
  }
  return {
    ruleId: 'FINANCE-APPROVAL-001',
    trigger: 'write:finance AND amount > $1,000',
    tier: 'Human-approve',
    blastRadius: '1 system (Odoo) | 1 record affected',
    irreversibility: 'full',
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SodBanner({ eval: ev }: { eval: SodEvaluation }) {
  if (ev.state === 'eligible') {
    return (
      <div role="status" className="rounded-md bg-green-50 border border-green-200 px-3 py-2.5 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <div className="text-xs space-y-0.5">
          <p className="font-medium text-green-800">You are eligible to approve</p>
          <p className="text-green-700">
            Requestor: <span className="font-mono">{ev.requestorId}</span> (different from you)
          </p>
          <p className="text-green-700">
            Rule: {ev.ruleId} · Roles required: {ev.rolesRequired.join(' OR ')}
          </p>
        </div>
      </div>
    )
  }
  if (ev.state === 'blocked-self') {
    return (
      <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
        <div className="text-xs space-y-0.5">
          <p className="font-medium text-red-800">You cannot approve your own request</p>
          <p className="text-red-700">Rule: {ev.ruleId} — SoD requires a different approver.</p>
        </div>
      </div>
    )
  }
  if (ev.state === 'blocked-role') {
    return (
      <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
        <div className="text-xs space-y-0.5">
          <p className="font-medium text-red-800">Missing required role</p>
          <p className="text-red-700">
            Requires: {ev.rolesRequired.join(' OR ')} — you do not hold this role.
          </p>
        </div>
      </div>
    )
  }
  // n-of-m
  return (
    <div role="status" className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2.5 flex items-start gap-2">
      <ShieldCheck className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
      <div className="text-xs space-y-0.5">
        <p className="font-medium text-yellow-800">
          {ev.nRequired} of {ev.nTotal} approvers needed — {(ev.nRequired ?? 0) - (ev.nSoFar ?? 0)} more required
        </p>
        <p className="text-yellow-700">
          Rule: {ev.ruleId} · {ev.nSoFar} approval{ev.nSoFar !== 1 ? 's' : ''} recorded so far.
        </p>
      </div>
    </div>
  )
}

function PolicyRulePanel({ rule }: { rule: PolicyRule }) {
  const irreversibilityLabel = { full: 'Fully irreversible', partial: 'Partially reversible', none: 'Reversible' }[rule.irreversibility]
  const irreversibilityCls = { full: 'text-red-700', partial: 'text-yellow-700', none: 'text-green-700' }[rule.irreversibility]

  return (
    <div className="rounded-md bg-muted/40 border border-border px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Policy Rule</span>
      </div>
      <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1 text-xs">
        <span className="text-muted-foreground">Rule ID</span>
        <span className="font-mono">{rule.ruleId}</span>
        <span className="text-muted-foreground">Trigger</span>
        <span>{rule.trigger}</span>
        <span className="text-muted-foreground">Tier</span>
        <span>{rule.tier}</span>
        <span className="text-muted-foreground">Blast radius</span>
        <span>{rule.blastRadius}</span>
        <span className="text-muted-foreground">Reversibility</span>
        <span className={irreversibilityCls}>{irreversibilityLabel}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main card component
// ---------------------------------------------------------------------------

export type TriageAction = 'Approved' | 'Denied' | 'RequestChanges' | 'Skip'

interface ApprovalTriageCardProps {
  approval: ApprovalSummary
  index: number
  total: number
  onAction: (approvalId: string, action: TriageAction, rationale: string) => void
  loading?: boolean
}

export function ApprovalTriageCard({ approval, index, total, onAction, loading }: ApprovalTriageCardProps) {
  const [rationale, setRationale] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [requestChangesMode, setRequestChangesMode] = useState(false)
  const [requestChangesMsg, setRequestChangesMsg] = useState('')

  const sodEval = getSodEvaluation(approval)
  const policyRule = getPolicyRule(approval)
  const isBlocked = sodEval.state === 'blocked-self' || sodEval.state === 'blocked-role'

  function handleAction(action: TriageAction) {
    if (action === 'RequestChanges') {
      if (!requestChangesMode) {
        setRequestChangesMode(true)
        return
      }
      onAction(approval.approvalId, action, requestChangesMsg)
      return
    }
    onAction(approval.approvalId, action, rationale)
  }

  const isOverdue = approval.dueAtIso && new Date(approval.dueAtIso) < new Date()

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{index + 1} of {total} pending</span>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={cn('h-1.5 w-6 rounded-full', i === index ? 'bg-primary' : i < index ? 'bg-green-500' : 'bg-muted')} />
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-snug">
                {approval.prompt.length > 80 ? `${approval.prompt.slice(0, 80)}…` : approval.prompt}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                <span className="font-mono">{approval.runId}</span>
                {approval.workItemId && <span className="font-mono">{approval.workItemId}</span>}
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {approval.assigneeUserId ?? 'Unassigned'}
                </span>
                {approval.dueAtIso && (
                  <span className={cn('flex items-center gap-1', isOverdue && 'text-red-600 font-medium')}>
                    <Clock className="h-3 w-3" />
                    Due {format(new Date(approval.dueAtIso), 'MMM d, HH:mm')}
                    {isOverdue && ' (overdue)'}
                  </span>
                )}
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] shrink-0">
              {format(new Date(approval.requestedAtIso), 'MMM d HH:mm')}
            </Badge>
          </div>
        </div>

        {/* Card body */}
        <div className="px-5 py-4 space-y-3">
          {/* SoD evaluation */}
          <SodBanner eval={sodEval} />

          {/* Policy rule (collapsible) */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowDetail(!showDetail)}
              aria-expanded={showDetail}
            >
              {showDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showDetail ? 'Hide' : 'Show'} policy rule & blast radius
            </button>
            {showDetail && (
              <div className="mt-2">
                <PolicyRulePanel rule={policyRule} />
              </div>
            )}
          </div>

          {/* Request-changes mode */}
          {requestChangesMode ? (
            <div className="space-y-2">
              <label className="text-xs font-medium">What needs to change? (required)</label>
              <Textarea
                autoFocus
                className="text-xs min-h-[72px] resize-none"
                placeholder="Describe what the requestor needs to update..."
                value={requestChangesMsg}
                onChange={(e) => setRequestChangesMsg(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  disabled={!requestChangesMsg.trim() || loading}
                  onClick={() => handleAction('RequestChanges')}
                >
                  Submit request
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setRequestChangesMode(false); setRequestChangesMsg('') }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Rationale textarea (required for approve/deny) */}
              <div>
                <Textarea
                  aria-required="true"
                  aria-label={`Decision rationale for approval ${approval.approvalId}`}
                  className="text-xs min-h-[72px] resize-none"
                  placeholder="Decision rationale (required for approve/deny)…"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                />
              </div>

              {/* Decision buttons */}
              <div role="group" aria-label="Make approval decision" className="grid grid-cols-4 gap-2">
                <Button
                  size="sm"
                  className="h-9 text-xs flex-col gap-0.5 bg-green-600 hover:bg-green-700 text-white"
                  disabled={isBlocked || !rationale.trim() || loading}
                  onClick={() => handleAction('Approved')}
                  title="Approve (A)"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 text-xs flex-col gap-0.5"
                  disabled={!rationale.trim() || loading}
                  onClick={() => handleAction('Denied')}
                  title="Deny (D)"
                >
                  <XCircle className="h-4 w-4" />
                  Deny
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs flex-col gap-0.5"
                  disabled={loading}
                  onClick={() => handleAction('RequestChanges')}
                  title="Request changes (R)"
                >
                  <RotateCcw className="h-4 w-4" />
                  Changes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs flex-col gap-0.5 text-muted-foreground"
                  disabled={loading}
                  onClick={() => handleAction('Skip')}
                  title="Skip (S)"
                >
                  <SkipForward className="h-4 w-4" />
                  Skip
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Keyboard hints */}
      <p className="text-center text-[10px] text-muted-foreground">
        Keyboard: <kbd className="px-1 bg-muted rounded text-[10px]">A</kbd> approve ·{' '}
        <kbd className="px-1 bg-muted rounded text-[10px]">D</kbd> deny ·{' '}
        <kbd className="px-1 bg-muted rounded text-[10px]">R</kbd> request changes ·{' '}
        <kbd className="px-1 bg-muted rounded text-[10px]">S</kbd> skip
      </p>
    </div>
  )
}
