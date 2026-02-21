import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { SodEvaluation } from '@portarium/cockpit-types';

export const DEFAULT_SOD_EVALUATION: SodEvaluation = {
  state: 'eligible',
  requestorId: 'unknown',
  ruleId: 'N/A',
  rolesRequired: [],
};

export function SodBanner({ eval: ev }: { eval: SodEvaluation }) {
  if (ev.state === 'eligible') {
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
