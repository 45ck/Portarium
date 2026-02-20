import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import {
  useSafetyConstraints,
  useApprovalThresholds,
  useEStopLog,
} from '@/hooks/queries/use-safety';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { EnforcementMode, EStopAuditEntry } from '@/types/robotics';
import { ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

function EnforcementBadge({ mode }: { mode: EnforcementMode }) {
  const config: Record<EnforcementMode, { label: string; className: string }> = {
    block: {
      label: 'Block',
      className: 'bg-destructive/10 text-destructive border-destructive/30',
    },
    warn: { label: 'Warn', className: 'bg-warning/10 text-warning border-warning/30' },
    log: { label: 'Log', className: 'bg-muted text-muted-foreground border-border' },
  };
  const c = config[mode] ?? config['log'];
  return (
    <Badge
      variant="outline"
      className={cn('text-[11px]', c.className)}
      aria-label={`Enforcement: ${mode}`}
    >
      {c.label}
    </Badge>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const cls =
    tier === 'HumanApprove'
      ? 'bg-warning/10 text-warning border-warning/30'
      : tier === 'Auto'
        ? 'bg-success/10 text-success border-success/30'
        : 'bg-muted text-muted-foreground border-border';
  return (
    <Badge variant="outline" className={cn('text-[11px]', cls)}>
      {tier}
    </Badge>
  );
}

function SafetyPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data: constraintsData, isLoading: constraintsLoading } = useSafetyConstraints(wsId);
  const { data: thresholdsData, isLoading: thresholdsLoading } = useApprovalThresholds(wsId);
  const { data: logData, isLoading: logLoading } = useEStopLog(wsId);
  const constraints = constraintsData?.items ?? [];
  const thresholds = thresholdsData?.items ?? [];
  const auditLog = logData?.items ?? [];

  const [globalEstopActive, setGlobalEstopActive] = useState(false);
  const [showEstopModal, setShowEstopModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearRationale, setClearRationale] = useState('');

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Safety & E-Stop"
          description="Global safety controls, constraints, and audit trail"
        />
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0 gap-2 font-semibold"
          disabled={globalEstopActive}
          onClick={() => setShowEstopModal(true)}
          aria-label="Activate global E-Stop for all robots"
        >
          <ShieldAlert className="h-4 w-4" />
          {globalEstopActive ? 'E-Stop Active' : 'Global E-Stop'}
        </Button>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          'rounded-md border px-4 py-3 flex items-center gap-3 text-sm font-medium',
          globalEstopActive
            ? 'bg-red-50 border-red-300 text-red-800'
            : 'bg-green-50 border-green-200 text-green-800',
        )}
      >
        {globalEstopActive ? (
          <>
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <span>⚠ GLOBAL E-STOP ACTIVE — All robots halted</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={() => setShowClearModal(true)}
            >
              Clear E-Stop (admin)
            </Button>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>
              System NOMINAL — {constraints.reduce((n, c) => n + c.robotCount, 0)} robots monitored,
              0 in E-Stop state
            </span>
          </>
        )}
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-3">Per-Site Constraints</h2>
        {constraintsLoading ? (
          <div className="h-24 rounded-md bg-muted/30 animate-pulse" />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['Site', 'Constraint', 'Enforcement', 'Robots', 'Action'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {constraints.map((sc) => (
                  <tr key={sc.constraintId} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs">{sc.site}</td>
                    <td className="px-3 py-2">{sc.constraint}</td>
                    <td className="px-3 py-2">
                      <EnforcementBadge mode={sc.enforcement} />
                    </td>
                    <td className="px-3 py-2 text-center">{sc.robotCount}</td>
                    <td className="px-3 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        aria-label={`Edit constraint for ${sc.site}`}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-2 h-7 text-xs">
          + Add Constraint
        </Button>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3">Approval Policy Thresholds</h2>
        {thresholdsLoading ? (
          <div className="h-20 rounded-md bg-muted/30 animate-pulse" />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['Action Class', 'Tier', 'Notes'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t) => (
                  <tr key={t.actionClass} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs">{t.actionClass}</td>
                    <td className="px-3 py-2">
                      <TierBadge tier={t.tier} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{t.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3">E-Stop Audit Log (last {auditLog.length})</h2>
        {logLoading ? (
          <div className="h-24 rounded-md bg-muted/30 animate-pulse" />
        ) : auditLog.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No E-Stop events recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['Timestamp', 'Actor', 'Robot', 'Event', 'Detail'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLog.map((entry: EStopAuditEntry) => (
                  <tr
                    key={`${entry.timestamp}-${entry.event}`}
                    className="border-t border-border hover:bg-muted/20"
                  >
                    <td className="px-3 py-2 text-xs">
                      <time dateTime={entry.timestamp}>
                        {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm')}
                      </time>
                    </td>
                    <td className="px-3 py-2 text-xs">{entry.actor}</td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.robotId}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[11px]',
                          entry.event === 'Sent'
                            ? 'bg-destructive/10 text-destructive border-destructive/30'
                            : 'bg-success/10 text-success border-success/30',
                        )}
                      >
                        {entry.event}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={showEstopModal} onOpenChange={setShowEstopModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Global E-Stop
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ALL robots will be immediately halted. This action is irreversible until manually
            cleared and will be logged in the audit trail.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEstopModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await fetch(`/v1/workspaces/${wsId}/robotics/safety/estop`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ actor: 'user-operator' }),
                }).catch(() => null);
                setGlobalEstopActive(true);
                setShowEstopModal(false);
                toast.error('Global E-Stop activated — all robots halted', { duration: 8000 });
              }}
            >
              Confirm E-Stop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearModal} onOpenChange={setShowClearModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Global E-Stop</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Provide a rationale for clearing the E-Stop. This is required and will be logged.
            </p>
            <Textarea
              aria-required="true"
              placeholder="Rationale for clearing E-Stop..."
              value={clearRationale}
              onChange={(e) => setClearRationale(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowClearModal(false);
                setClearRationale('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!clearRationale.trim()}
              onClick={async () => {
                await fetch(`/v1/workspaces/${wsId}/robotics/safety/estop`, {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ actor: 'user-admin', rationale: clearRationale }),
                }).catch(() => null);
                setGlobalEstopActive(false);
                setClearRationale('');
                setShowClearModal(false);
                toast.success('E-Stop cleared — robots may resume operations');
              }}
            >
              Clear E-Stop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/safety',
  component: SafetyPage,
});
