import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import type { ApprovalSummary, PlanEffect } from '@portarium/cockpit-types'
import { EntityIcon } from '@/components/domain/entity-icon'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  SkipForward,
  Clock,
  User,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// SoD evaluation types + mock
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
  if (approval.approvalId === 'apr-3004') {
    return {
      state: 'blocked-self',
      requestorId: 'user-approver-dana',
      ruleId: 'SOD-FINANCE-003',
      rolesRequired: ['approver'],
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
// Policy rule types + mock
// ---------------------------------------------------------------------------
interface PolicyRule {
  ruleId: string
  trigger: string
  tier: string
  blastRadius: string[]
  irreversibility: 'full' | 'partial' | 'none'
}

function getPolicyRule(approval: ApprovalSummary): PolicyRule {
  if (approval.approvalId === 'apr-3002') {
    return {
      ruleId: 'IAM-APPROVAL-002',
      trigger: 'write:iam AND access_change',
      tier: 'HumanApprove',
      blastRadius: ['Okta', '3 records'],
      irreversibility: 'partial',
    }
  }
  if (approval.approvalId === 'apr-3004') {
    return {
      ruleId: 'FINANCE-APPROVAL-003',
      trigger: 'write:finance AND amount > $10,000',
      tier: 'HumanApprove',
      blastRadius: ['Stripe', 'NetSuite', '12 records'],
      irreversibility: 'full',
    }
  }
  return {
    ruleId: 'FINANCE-APPROVAL-001',
    trigger: 'write:finance AND amount > $1,000',
    tier: 'HumanApprove',
    blastRadius: ['Odoo', '1 record'],
    irreversibility: 'full',
  }
}

// ---------------------------------------------------------------------------
// Request-changes history
// ---------------------------------------------------------------------------
interface HistoryEntry {
  timestamp: string
  type: 'requested' | 'changes_requested' | 'resubmitted'
  actor: string
  message: string
}

function getHistory(approval: ApprovalSummary): HistoryEntry[] {
  if (approval.approvalId === 'apr-3002') {
    return [
      {
        timestamp: '2026-02-17T14:30:00Z',
        type: 'requested',
        actor: 'system',
        message: 'Approval requested',
      },
      {
        timestamp: '2026-02-18T09:35:00Z',
        type: 'changes_requested',
        actor: 'user-approver-dana',
        message: 'Changes requested: "Need audit trail for each permission revocation"',
      },
      {
        timestamp: '2026-02-18T10:12:00Z',
        type: 'resubmitted',
        actor: 'system',
        message: 'Plan revised and resubmitted with per-record audit refs',
      },
    ]
  }
  return []
}

// ---------------------------------------------------------------------------
// Mock planned effects per approval
// ---------------------------------------------------------------------------
function getMockEffects(approval: ApprovalSummary): PlanEffect[] {
  if (approval.approvalId === 'apr-3001') {
    return [
      {
        effectId: 'eff-1',
        operation: 'Create',
        target: { sorName: 'Odoo', portFamily: 'FinanceAccounting', externalId: 'INV-4271C', externalType: 'CreditNote', displayLabel: 'Credit Note INV-4271C' },
        summary: 'Credit note of €1,240 to ACME Repairs',
      },
      {
        effectId: 'eff-2',
        operation: 'Create',
        target: { sorName: 'Odoo', portFamily: 'FinanceAccounting', externalId: 'INV-4272', externalType: 'Invoice', displayLabel: 'Corrected Invoice INV-4272' },
        summary: 'Re-issue corrected invoice',
      },
    ]
  }
  if (approval.approvalId === 'apr-3002') {
    return [
      {
        effectId: 'eff-3',
        operation: 'Delete',
        target: { sorName: 'Okta', portFamily: 'IamDirectory', externalId: 'perm-fin-001', externalType: 'GroupMembership', displayLabel: 'Finance:ReadWrite — alice@acme' },
        summary: 'Revoke excess write permission',
      },
      {
        effectId: 'eff-4',
        operation: 'Delete',
        target: { sorName: 'Okta', portFamily: 'IamDirectory', externalId: 'perm-fin-002', externalType: 'GroupMembership', displayLabel: 'Finance:ReadWrite — bob@acme' },
        summary: 'Revoke excess write permission',
      },
      {
        effectId: 'eff-5',
        operation: 'Delete',
        target: { sorName: 'Okta', portFamily: 'IamDirectory', externalId: 'perm-fin-003', externalType: 'GroupMembership', displayLabel: 'Finance:Admin — carol@acme' },
        summary: 'Revoke excess admin permission',
      },
    ]
  }
  if (approval.approvalId === 'apr-3004') {
    return [
      {
        effectId: 'eff-6',
        operation: 'Create',
        target: { sorName: 'Stripe', portFamily: 'PaymentsBilling', externalId: 'pmt-8821', externalType: 'Transfer', displayLabel: 'Transfer PO-8821' },
        summary: 'Initiate €14,200 supplier payment',
      },
      {
        effectId: 'eff-7',
        operation: 'Update',
        target: { sorName: 'NetSuite', portFamily: 'FinanceAccounting', externalId: 'po-8821', externalType: 'PurchaseOrder', displayLabel: 'PO-8821' },
        summary: 'Mark purchase order as paid',
      },
    ]
  }
  return []
}

// ---------------------------------------------------------------------------
// SorBadge — color-coded circular badge for each system of record
// ---------------------------------------------------------------------------
const SOR_PALETTE: Record<string, { bg: string; text: string }> = {
  Odoo:     { bg: 'bg-indigo-600',  text: 'text-white' },
  Stripe:   { bg: 'bg-violet-600',  text: 'text-white' },
  NetSuite: { bg: 'bg-blue-600',    text: 'text-white' },
  Okta:     { bg: 'bg-sky-500',     text: 'text-white' },
  Mautic:   { bg: 'bg-orange-500',  text: 'text-white' },
  Zammad:   { bg: 'bg-rose-500',    text: 'text-white' },
  Vault:    { bg: 'bg-amber-500',   text: 'text-white' },
}

const SOR_PALETTE_DEFAULT = { bg: 'bg-muted', text: 'text-muted-foreground' }

function SorBadge({ name }: { name: string }) {
  const palette = SOR_PALETTE[name] ?? SOR_PALETTE_DEFAULT
  const abbr = name.slice(0, 2)
  return (
    <span
      title={name}
      className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0',
        palette.bg,
        palette.text,
      )}
    >
      {abbr}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Inline triage effect row (avoids modifying shared effects-list.tsx)
// ---------------------------------------------------------------------------
const opColors: Record<string, string> = {
  Create: 'bg-success text-success-foreground',
  Update: 'bg-info text-info-foreground',
  Delete: 'bg-destructive text-white',
  Upsert: 'bg-warning text-warning-foreground',
}

function TriageEffectRow({ effect }: { effect: PlanEffect }) {
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <Badge variant="secondary" className={cn('text-[10px] shrink-0', opColors[effect.operation])}>
        {effect.operation}
      </Badge>
      <SorBadge name={effect.target.sorName} />
      <span className="font-mono text-muted-foreground text-[11px] shrink-0">
        {effect.target.externalType}
      </span>
      <span className="flex-1 truncate text-foreground">{effect.summary}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SodBanner — always visible
// ---------------------------------------------------------------------------
function SodBanner({ eval: ev }: { eval: SodEvaluation }) {
  if (ev.state === 'eligible') {
    return (
      <div role="status" className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-3">
        <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-green-800">You are eligible to approve</p>
          <p className="text-green-700">
            Requestor:{' '}
            <span className="font-mono">{ev.requestorId}</span> (different from you) · Rule:{' '}
            {ev.ruleId} · Roles required: {ev.rolesRequired.join(' OR ')}
          </p>
        </div>
      </div>
    )
  }
  if (ev.state === 'blocked-self') {
    return (
      <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
        <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-red-800">You cannot approve your own request</p>
          <p className="text-red-700">SoD rule {ev.ruleId} requires a different approver.</p>
        </div>
      </div>
    )
  }
  if (ev.state === 'blocked-role') {
    return (
      <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
        <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-red-800">Missing required role</p>
          <p className="text-red-700">
            Requires: {ev.rolesRequired.join(' OR ')} — rule {ev.ruleId}
          </p>
        </div>
      </div>
    )
  }
  // n-of-m
  return (
    <div role="status" className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 flex items-start gap-3">
      <ShieldCheck className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
      <div className="text-xs space-y-1">
        <p className="font-semibold text-yellow-800">
          {ev.nRequired} of {ev.nTotal} approvers needed —{' '}
          {(ev.nRequired ?? 0) - (ev.nSoFar ?? 0)} more required after you
        </p>
        <p className="text-yellow-700">
          Rule: {ev.ruleId} · {ev.nSoFar} approval{ev.nSoFar !== 1 ? 's' : ''} recorded so far
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PolicyRulePanel — blast radius with SorBadge avatars
// ---------------------------------------------------------------------------
function PolicyRulePanel({ rule }: { rule: PolicyRule }) {
  const irreversibilityLabel = {
    full: 'Fully irreversible',
    partial: 'Partially reversible',
    none: 'Reversible',
  }[rule.irreversibility]
  const irreversibilityCls = {
    full: 'text-red-600 font-medium',
    partial: 'text-yellow-700',
    none: 'text-green-700',
  }[rule.irreversibility]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Policy Rule
        </span>
        <span className="font-mono text-[11px] text-foreground">{rule.ruleId}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {rule.tier}
        </Badge>
      </div>
      <div className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-1.5 text-xs">
        <span className="text-muted-foreground">Trigger</span>
        <span className="font-mono text-[11px]">{rule.trigger}</span>
        <span className="text-muted-foreground">Blast radius</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {rule.blastRadius.map((b) =>
            b.includes('record') ? (
              <Badge key={b} variant="outline" className="text-[10px] h-5 px-1.5">
                {b}
              </Badge>
            ) : (
              <span
                key={b}
                className="inline-flex items-center gap-1 text-[11px] border border-border rounded-full px-2 py-0.5 bg-background"
              >
                <SorBadge name={b} />
                {b}
              </span>
            ),
          )}
        </div>
        <span className="text-muted-foreground">Reversibility</span>
        <span className={irreversibilityCls}>{irreversibilityLabel}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RequestChangesHistory — timeline trail
// ---------------------------------------------------------------------------
function RequestChangesHistory({ history }: { history: HistoryEntry[] }) {
  const dotCls: Record<HistoryEntry['type'], string> = {
    requested: 'bg-muted-foreground/50',
    changes_requested: 'bg-yellow-500',
    resubmitted: 'bg-blue-500',
  }

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Decision History
      </p>
      <ol className="relative border-l border-border ml-3 space-y-3 pl-4">
        {history.map((entry, i) => (
          <li key={i} className="relative">
            <div
              className={cn(
                'absolute -left-[1.375rem] w-2.5 h-2.5 rounded-full border-2 border-background',
                dotCls[entry.type],
              )}
            />
            <div className="text-xs">
              <div className="flex items-center gap-2">
                <time
                  dateTime={entry.timestamp}
                  className="text-muted-foreground text-[11px] shrink-0"
                >
                  {format(new Date(entry.timestamp), 'MMM d, HH:mm')}
                </time>
                <span className="text-muted-foreground font-mono text-[10px]">{entry.actor}</span>
              </div>
              <p className="mt-0.5 text-foreground">{entry.message}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export type TriageAction = 'Approved' | 'Denied' | 'RequestChanges' | 'Skip'

interface ApprovalTriageCardProps {
  approval: ApprovalSummary
  index: number
  total: number
  hasMore: boolean
  onAction: (approvalId: string, action: TriageAction, rationale: string) => void
  loading?: boolean
}

export function ApprovalTriageCard({
  approval,
  index,
  total,
  hasMore,
  onAction,
  loading,
}: ApprovalTriageCardProps) {
  const [rationale, setRationale] = useState('')
  const [requestChangesMode, setRequestChangesMode] = useState(false)
  const [requestChangesMsg, setRequestChangesMsg] = useState('')
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null)

  const sodEval = getSodEvaluation(approval)
  const policyRule = getPolicyRule(approval)
  const history = getHistory(approval)
  const mockEffects = getMockEffects(approval)
  const isBlocked = sodEval.state === 'blocked-self' || sodEval.state === 'blocked-role'
  const isOverdue = Boolean(approval.dueAtIso && new Date(approval.dueAtIso) < new Date())
  const triagePosition = index + 1

  function handleAction(action: TriageAction) {
    if (action === 'RequestChanges') {
      if (!requestChangesMode) {
        setRequestChangesMode(true)
        return
      }
      const dir: 'left' | 'right' = 'left'
      setExitDir(dir)
      setTimeout(() => {
        setExitDir(null)
        onAction(approval.approvalId, action, requestChangesMsg)
      }, 320)
      return
    }
    const dir: 'left' | 'right' = action === 'Approved' ? 'right' : 'left'
    setExitDir(dir)
    setTimeout(() => {
      setExitDir(null)
      onAction(approval.approvalId, action, rationale)
    }, 320)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.key === 'a' || e.key === 'A') && !isBlocked && !loading)
        handleAction('Approved')
      if ((e.key === 'd' || e.key === 'D') && rationale.trim() && !loading)
        handleAction('Denied')
      if ((e.key === 'r' || e.key === 'R') && !requestChangesMode) setRequestChangesMode(true)
      if ((e.key === 's' || e.key === 'S') && !loading) handleAction('Skip')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Progress row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          {triagePosition} of {total} pending
        </span>
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i < index ? 'w-5 bg-green-500' : i === index ? 'w-8 bg-primary' : 'w-5 bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      {/* Stacked card effect — ghost cards behind when queue has more items */}
      <div className="relative">
        {hasMore && (
          <>
            <div
              className="absolute inset-x-6 rounded-xl border border-border bg-card/60"
              style={{ top: '8px', bottom: '-8px', zIndex: 0 }}
            />
            <div
              className="absolute inset-x-3 rounded-xl border border-border bg-card/80"
              style={{ top: '4px', bottom: '-4px', zIndex: 1 }}
            />
          </>
        )}

        {/* Main card */}
        <div
          className={cn(
            'relative rounded-xl border border-border bg-card shadow-md overflow-hidden',
            exitDir === 'right' && 'animate-triage-out-right',
            exitDir === 'left'  && 'animate-triage-out-left',
            !exitDir            && 'animate-triage-in',
          )}
          style={{ zIndex: 2 }}
        >
          {/* Overdue stripe */}
          {isOverdue && (
            <div className="bg-red-500 px-5 py-1.5 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-white" />
              <span className="text-[11px] font-bold text-white uppercase tracking-wide">
                Overdue
              </span>
              <span className="text-[11px] text-red-100 ml-auto">
                Due {format(new Date(approval.dueAtIso!), 'MMM d, HH:mm')}
              </span>
            </div>
          )}

          {/* Header */}
          <div className="bg-muted/20 px-5 pt-5 pb-4 border-b border-border/50">
            <div className="flex items-start gap-4">
              {/* Icon box */}
              <div className="shrink-0 rounded-lg bg-background border border-border p-2.5">
                <EntityIcon entityType="approval" size="md" decorative />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Approval Gate
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {approval.approvalId}
                  </span>
                </div>
                <p className="text-sm font-semibold leading-snug">{approval.prompt}</p>

                {/* Metadata pills */}
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-2.5 py-0.5">
                    <EntityIcon entityType="run" size="xs" decorative />
                    {approval.runId}
                  </span>
                  {approval.workItemId && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-2.5 py-0.5">
                      <EntityIcon entityType="work-item" size="xs" decorative />
                      {approval.workItemId}
                    </span>
                  )}
                  {approval.assigneeUserId && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <User className="h-3 w-3" />
                      {approval.assigneeUserId}
                    </span>
                  )}
                  {approval.dueAtIso && !isOverdue && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Due {format(new Date(approval.dueAtIso), 'MMM d')}
                    </span>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <div className="shrink-0 text-[11px] text-muted-foreground">
                {format(new Date(approval.requestedAtIso), 'MMM d, HH:mm')}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-4">
            {/* SoD evaluation — always visible */}
            <SodBanner eval={sodEval} />

            {/* Policy rule — always visible */}
            <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
              <PolicyRulePanel rule={policyRule} />
            </div>

            {/* History trail — shown when request-changes cycle exists */}
            {history.length > 0 && (
              <div className="rounded-lg bg-muted/20 border border-border/60 px-4 py-3">
                <RequestChangesHistory history={history} />
              </div>
            )}

            {/* Planned effects panel */}
            {mockEffects.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  What will happen if approved
                </p>
                <div className="divide-y divide-border/40">
                  {mockEffects.map((e) => (
                    <TriageEffectRow key={e.effectId} effect={e} />
                  ))}
                </div>
              </div>
            )}

            {/* Decision area */}
            {requestChangesMode ? (
              <div className="space-y-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <label className="text-xs font-semibold text-yellow-900">
                  What needs to change?{' '}
                  <span className="text-red-500" aria-hidden>*</span>
                </label>
                <Textarea
                  autoFocus
                  className="text-xs min-h-[80px] resize-none bg-white"
                  placeholder="Describe what the requestor needs to update before you can approve…"
                  value={requestChangesMsg}
                  onChange={(e) => setRequestChangesMsg(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-9"
                    disabled={!requestChangesMsg.trim() || Boolean(loading)}
                    onClick={() => handleAction('RequestChanges')}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Submit request for changes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setRequestChangesMode(false)
                      setRequestChangesMsg('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  aria-label={`Decision rationale for approval ${approval.approvalId}`}
                  className="text-xs min-h-[80px] resize-none"
                  placeholder="Decision rationale — optional for approve, required for deny…"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Rationale is optional when approving, required when denying.
                </p>

                <div role="group" aria-label="Make approval decision" className="grid grid-cols-4 gap-2">
                  <Button
                    size="sm"
                    className="h-12 flex-col gap-1 bg-green-600 hover:bg-green-700 text-white border-0"
                    disabled={isBlocked || Boolean(loading)}
                    onClick={() => handleAction('Approved')}
                    title="Approve (A)"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-[11px]">Approve</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-12 flex-col gap-1"
                    disabled={!rationale.trim() || Boolean(loading)}
                    onClick={() => handleAction('Denied')}
                    title="Deny (D)"
                  >
                    <XCircle className="h-5 w-5" />
                    <span className="text-[11px]">Deny</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-12 flex-col gap-1"
                    disabled={Boolean(loading)}
                    onClick={() => handleAction('RequestChanges')}
                    title="Request changes (R)"
                  >
                    <RotateCcw className="h-5 w-5" />
                    <span className="text-[11px]">Changes</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-12 flex-col gap-1 text-muted-foreground"
                    disabled={Boolean(loading)}
                    onClick={() => handleAction('Skip')}
                    title="Skip (S)"
                  >
                    <SkipForward className="h-5 w-5" />
                    <span className="text-[11px]">Skip</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span>Keyboard:</span>
        {(
          [
            { key: 'A', label: 'approve' },
            { key: 'D', label: 'deny' },
            { key: 'R', label: 'changes' },
            { key: 'S', label: 'skip' },
          ] as const
        ).map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border">
              {key}
            </kbd>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
