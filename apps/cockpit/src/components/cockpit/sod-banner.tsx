import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SodEvaluation } from '@portarium/cockpit-types';
import { cn } from '@/lib/utils';

export const DEFAULT_SOD_EVALUATION: SodEvaluation = {
  state: 'eligible',
  requestorId: 'unknown',
  ruleId: 'N/A',
  rolesRequired: [],
};

type SodBannerVariant = 'banner' | 'compact';

interface SodBannerProps {
  eval: SodEvaluation;
  variant?: SodBannerVariant;
}

function SodDetail({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span className={cn('min-w-0 truncate font-mono text-[10px]', className)}>{children}</span>
  );
}

export function SodBanner({ eval: ev, variant = 'banner' }: SodBannerProps) {
  if (ev.state === 'eligible') {
    if (variant === 'compact') {
      return (
        <div
          role="status"
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs"
          title={`Requestor: ${ev.requestorId}; rule: ${ev.ruleId}; roles: ${ev.rolesRequired.join(' OR ') || 'N/A'}`}
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
          <span className="shrink-0 font-semibold text-success">Eligible</span>
          <SodDetail className="text-success/80">
            {ev.requestorId} · {ev.ruleId}
          </SodDetail>
        </div>
      );
    }

    return (
      <div
        role="status"
        className="rounded-lg bg-success/10 border border-success/30 px-4 py-3 flex items-start gap-3"
      >
        <ShieldCheck className="h-4 w-4 text-success mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-success">You are eligible to approve</p>
          <p className="text-success/80">
            Requestor: <span className="font-mono">{ev.requestorId}</span> (different from you) ·
            Rule: {ev.ruleId} · Roles required: {ev.rolesRequired.join(' OR ')}
          </p>
        </div>
      </div>
    );
  }
  if (ev.state === 'blocked-self') {
    if (variant === 'compact') {
      return (
        <div
          role="alert"
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs"
          title={`SoD rule ${ev.ruleId} requires a different approver.`}
        >
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
          <span className="shrink-0 font-semibold text-destructive">Blocked</span>
          <SodDetail className="text-destructive/80">Own request · {ev.ruleId}</SodDetail>
        </div>
      );
    }

    return (
      <div
        role="alert"
        className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-start gap-3"
      >
        <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-destructive">You cannot approve your own request</p>
          <p className="text-destructive/80">SoD rule {ev.ruleId} requires a different approver.</p>
        </div>
      </div>
    );
  }
  if (ev.state === 'blocked-role') {
    if (variant === 'compact') {
      return (
        <div
          role="alert"
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs"
          title={`Requires: ${ev.rolesRequired.join(' OR ') || 'N/A'}; rule: ${ev.ruleId}`}
        >
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
          <span className="shrink-0 font-semibold text-destructive">Missing role</span>
          <SodDetail className="text-destructive/80">{ev.rolesRequired.join(' OR ')}</SodDetail>
        </div>
      );
    }

    return (
      <div
        role="alert"
        className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-start gap-3"
      >
        <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-destructive">Missing required role</p>
          <p className="text-destructive/80">
            Requires: {ev.rolesRequired.join(' OR ')} — rule {ev.ruleId}
          </p>
        </div>
      </div>
    );
  }
  // n-of-m
  if (variant === 'compact') {
    return (
      <div
        role="status"
        className="inline-flex max-w-full items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs"
        title={`Rule: ${ev.ruleId}; ${ev.nSoFar} approvals recorded so far`}
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-warning" />
        <span className="shrink-0 font-semibold text-warning-foreground">
          {ev.nRequired} of {ev.nTotal}
        </span>
        <SodDetail className="text-warning-foreground/80">
          {(ev.nRequired ?? 0) - (ev.nSoFar ?? 0)} more · {ev.ruleId}
        </SodDetail>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-3 flex items-start gap-3"
    >
      <ShieldCheck className="h-4 w-4 text-warning mt-0.5 shrink-0" />
      <div className="text-xs space-y-1">
        <p className="font-semibold text-warning-foreground">
          {ev.nRequired} of {ev.nTotal} approvers needed — {(ev.nRequired ?? 0) - (ev.nSoFar ?? 0)}{' '}
          more required after you
        </p>
        <p className="text-warning-foreground/80">
          Rule: {ev.ruleId} · {ev.nSoFar} approval{ev.nSoFar !== 1 ? 's' : ''} recorded so far
        </p>
      </div>
    </div>
  );
}
