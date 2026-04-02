import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ArrowRight, CheckCircle, Zap, UserCheck, Hand, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { APPROVALS } from '@/mocks/fixtures/openclaw-demo';
import type { ApprovalSummary } from '@portarium/cockpit-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExecutionTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';

export interface PolicyPreviewFormState {
  triggerAction: string;
  triggerCondition: string;
  tier: ExecutionTier;
}

interface AffectedApproval {
  approval: ApprovalSummary;
  currentTier: string;
  newTier: ExecutionTier;
  impact: 'auto-approve' | 'require-approval' | 'blocked';
  systems: string[];
}

// ---------------------------------------------------------------------------
// Tier metadata
// ---------------------------------------------------------------------------

const TIER_RANK: Record<string, number> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
};

const TIER_ICON: Record<string, React.ElementType> = {
  Auto: Zap,
  Assisted: Users,
  HumanApprove: UserCheck,
  ManualOnly: Hand,
};

const TIER_LABEL: Record<string, string> = {
  Auto: 'Auto',
  Assisted: 'Assisted',
  HumanApprove: 'Human Approve',
  ManualOnly: 'Manual Only',
};

const TIER_COLOR: Record<string, string> = {
  Auto: 'text-green-600 dark:text-green-400',
  Assisted: 'text-yellow-600 dark:text-yellow-400',
  HumanApprove: 'text-orange-600 dark:text-orange-400',
  ManualOnly: 'text-red-600 dark:text-red-400',
};

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------

function triggerOverlaps(formTrigger: string, approvalTrigger: string): boolean {
  if (!formTrigger) return false;
  const formParts = formTrigger
    .split(' AND ')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const approvalParts = approvalTrigger.split(' AND ').map((s) => s.trim().toLowerCase());

  // Match if every part of the form trigger appears in (or is a prefix of) an approval part
  return formParts.every((fp) => approvalParts.some((ap) => ap.includes(fp) || fp.includes(ap)));
}

function extractSystems(approval: ApprovalSummary): string[] {
  const br = approval.policyRule?.blastRadius ?? [];
  // blastRadius is string[] like ["Gmail", "1 message"] -- take only system-like entries
  return br.filter((s) => !s.match(/^\d/) && !s.match(/^all\s/i) && s.length > 2);
}

function classifyImpact(currentRank: number, newRank: number): AffectedApproval['impact'] {
  if (newRank < currentRank) return 'auto-approve';
  if (newRank > currentRank && newRank >= (TIER_RANK.ManualOnly ?? 3)) return 'blocked';
  return 'require-approval';
}

function computeAffected(form: PolicyPreviewFormState): AffectedApproval[] {
  const formTrigger = [form.triggerAction, form.triggerCondition].filter(Boolean).join(' AND ');

  const pending = APPROVALS.filter((a) => a.status === 'Pending');

  const results: AffectedApproval[] = [];

  for (const approval of pending) {
    const pr = approval.policyRule;
    if (!pr) continue;

    if (!triggerOverlaps(formTrigger, pr.trigger)) continue;

    const currentTier = pr.tier;
    const newTier = form.tier;
    if (currentTier === newTier) continue;

    const currentRank = TIER_RANK[currentTier] ?? 2;
    const newRank = TIER_RANK[newTier] ?? 2;

    results.push({
      approval,
      currentTier,
      newTier,
      impact: classifyImpact(currentRank, newRank),
      systems: extractSystems(approval),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Impact badge
// ---------------------------------------------------------------------------

const IMPACT_CONFIG = {
  'auto-approve': {
    label: 'Would auto-approve',
    className:
      'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800',
  },
  'require-approval': {
    label: 'Would require approval',
    className:
      'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  },
  blocked: {
    label: 'Would be blocked',
    className:
      'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-800',
  },
} as const;

function ImpactBadge({ impact }: { impact: AffectedApproval['impact'] }) {
  const cfg = IMPACT_CONFIG[impact];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tier transition arrow
// ---------------------------------------------------------------------------

function TierTransition({ from, to }: { from: string; to: string }) {
  const FromIcon = TIER_ICON[from] ?? UserCheck;
  const ToIcon = TIER_ICON[to] ?? UserCheck;

  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className={cn('flex items-center gap-0.5', TIER_COLOR[from])}>
        <FromIcon className="h-3 w-3" />
        {TIER_LABEL[from] ?? from}
      </span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className={cn('flex items-center gap-0.5 font-semibold', TIER_COLOR[to])}>
        <ToIcon className="h-3 w-3" />
        {TIER_LABEL[to] ?? to}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini approval card
// ---------------------------------------------------------------------------

function MiniApprovalCard({ item }: { item: AffectedApproval }) {
  return (
    <motion.div
      layout
      layoutId={`preview-${item.approval.approvalId}`}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="rounded-lg border border-border bg-background p-3 space-y-2"
    >
      <p className="text-xs text-foreground line-clamp-1 font-medium">{item.approval.prompt}</p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <TierTransition from={item.currentTier} to={item.newTier} />
        <ImpactBadge impact={item.impact} />
      </div>
      {item.systems.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.systems.map((sys) => (
            <Badge key={sys} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
              {sys}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PolicyLivePreview({ form }: { form: PolicyPreviewFormState }) {
  const affected = useMemo(() => computeAffected(form), [form]);

  const countByImpact = useMemo(() => {
    const map = { 'auto-approve': 0, 'require-approval': 0, blocked: 0 };
    for (const a of affected) map[a.impact]++;
    return map;
  }, [affected]);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Live Impact Preview
        </h3>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.span
            key={affected.length}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="text-2xl font-bold text-foreground tabular-nums"
          >
            {affected.length}
          </motion.span>
        </AnimatePresence>
        <span className="text-sm text-muted-foreground">
          {affected.length === 1 ? 'approval affected' : 'approvals affected'}
        </span>
      </div>

      {/* Impact summary chips */}
      {affected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {countByImpact['auto-approve'] > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-950/40 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
              {countByImpact['auto-approve']} auto-approve
            </span>
          )}
          {countByImpact['require-approval'] > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950/40 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-400">
              {countByImpact['require-approval']} need approval
            </span>
          )}
          {countByImpact.blocked > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
              {countByImpact.blocked} blocked
            </span>
          )}
        </div>
      )}

      {/* Cards or empty state */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {affected.length > 0 ? (
            affected.map((item) => <MiniApprovalCard key={item.approval.approvalId} item={item} />)
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 py-6 text-center"
            >
              <CheckCircle className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                No pending approvals affected by these settings
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
