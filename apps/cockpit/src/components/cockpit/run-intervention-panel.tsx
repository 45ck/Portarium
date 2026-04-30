import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BellRing,
  Handshake,
  LifeBuoy,
  MessageSquareText,
  Pause,
  Play,
  Route,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type {
  RunInterventionKind,
  RunInterventionRequest,
  RunSummary,
  WorkforceMemberSummary,
  WorkforceQueueSummary,
} from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type InterventionOption = {
  value: RunInterventionKind;
  label: string;
  group: 'Steering' | 'Approval' | 'Handoff' | 'Containment' | 'Emergency' | 'Audit';
  surface: NonNullable<RunInterventionRequest['surface']>;
  authoritySource: NonNullable<RunInterventionRequest['authoritySource']>;
  effect: RunInterventionRequest['effect'];
  consequence: string;
  controlStateLabel: string;
  icon: ReactNode;
  evidenceRequired?: boolean;
  requiresAcknowledgement?: boolean;
  requiresTarget?: boolean;
  unavailableWhen?: RunSummary['status'][];
};

const OPTIONS: InterventionOption[] = [
  {
    value: 'pause',
    label: 'Pause',
    group: 'Steering',
    surface: 'steering',
    authoritySource: 'run-charter',
    effect: 'current-run-effect',
    consequence: 'Stops the current Run at the next safe boundary and records why.',
    controlStateLabel: 'Blocked until operator resumes',
    icon: <Pause className="h-4 w-4" />,
    evidenceRequired: true,
    unavailableWhen: ['Succeeded', 'Failed', 'Cancelled'],
  },
  {
    value: 'resume',
    label: 'Resume',
    group: 'Steering',
    surface: 'steering',
    authoritySource: 'run-charter',
    effect: 'current-run-effect',
    consequence: 'Returns a paused or blocked Run to active execution.',
    controlStateLabel: 'Running after submission',
    icon: <Play className="h-4 w-4" />,
    unavailableWhen: ['Running', 'Succeeded', 'Failed', 'Cancelled'],
  },
  {
    value: 'reroute',
    label: 'Reroute',
    group: 'Steering',
    surface: 'steering',
    authoritySource: 'run-charter',
    effect: 'current-run-effect',
    consequence: 'Changes the next owner or queue while preserving the Run history.',
    controlStateLabel: 'Operator-owned handoff path',
    icon: <Route className="h-4 w-4" />,
    requiresTarget: true,
    evidenceRequired: true,
    unavailableWhen: ['Succeeded', 'Failed', 'Cancelled'],
  },
  {
    value: 'handoff',
    label: 'Handoff',
    group: 'Handoff',
    surface: 'steering',
    authoritySource: 'delegated-role',
    effect: 'current-run-effect',
    consequence: 'Transfers active ownership to another person or queue.',
    controlStateLabel: 'Operator-owned by target',
    icon: <Handshake className="h-4 w-4" />,
    requiresTarget: true,
    evidenceRequired: true,
    unavailableWhen: ['Succeeded', 'Failed', 'Cancelled'],
  },
  {
    value: 'escalate',
    label: 'Escalate',
    group: 'Handoff',
    surface: 'steering',
    authoritySource: 'delegated-role',
    effect: 'current-run-effect',
    consequence: 'Requires a higher-authority reviewer before routine execution continues.',
    controlStateLabel: 'Blocked pending escalation',
    icon: <BellRing className="h-4 w-4" />,
    requiresTarget: true,
    evidenceRequired: true,
    unavailableWhen: ['Succeeded', 'Failed', 'Cancelled'],
  },
  {
    value: 'request-more-evidence',
    label: 'Request More Evidence',
    group: 'Approval',
    surface: 'approval',
    authoritySource: 'policy-rule',
    effect: 'approval-gate-effect',
    consequence: 'Blocks the decision path until the missing evidence is supplied.',
    controlStateLabel: 'Waiting for evidence',
    icon: <AlertTriangle className="h-4 w-4" />,
    evidenceRequired: true,
    unavailableWhen: ['Succeeded', 'Failed', 'Cancelled'],
  },
  {
    value: 'freeze',
    label: 'Freeze',
    group: 'Containment',
    surface: 'steering',
    authoritySource: 'policy-rule',
    effect: 'current-run-effect',
    consequence: 'Prevents further effectful work until a review explicitly unfreezes the Run.',
    controlStateLabel: 'Frozen',
    icon: <Shield className="h-4 w-4" />,
    evidenceRequired: true,
    requiresAcknowledgement: true,
    unavailableWhen: ['Succeeded', 'Failed', 'Cancelled'],
  },
  {
    value: 'sandbox',
    label: 'Move to Sandbox',
    group: 'Containment',
    surface: 'steering',
    authoritySource: 'policy-rule',
    effect: 'current-run-effect',
    consequence: 'Allows only contained dry-run or fixture-backed work until risk is cleared.',
    controlStateLabel: 'Degraded containment mode',
    icon: <ShieldCheck className="h-4 w-4" />,
    evidenceRequired: true,
    unavailableWhen: ['Succeeded', 'Failed', 'Cancelled'],
  },
  {
    value: 'emergency-disable',
    label: 'Emergency Disable',
    group: 'Emergency',
    surface: 'emergency',
    authoritySource: 'incident-break-glass',
    effect: 'workspace-safety-effect',
    consequence:
      'Break-glass action: disables the active automation path and requires incident review.',
    controlStateLabel: 'Emergency disabled',
    icon: <ShieldAlert className="h-4 w-4" />,
    evidenceRequired: true,
    requiresAcknowledgement: true,
    unavailableWhen: ['Succeeded', 'Failed', 'Cancelled'],
  },
  {
    value: 'annotate',
    label: 'Annotate',
    group: 'Audit',
    surface: 'monitoring',
    authoritySource: 'audit-annotation',
    effect: 'context-only',
    consequence: 'Adds audit context without steering, approving, or changing Policy.',
    controlStateLabel: 'No state change',
    icon: <MessageSquareText className="h-4 w-4" />,
  },
];

const GROUPS = ['Steering', 'Approval', 'Handoff', 'Containment', 'Emergency', 'Audit'] as const;

function defaultIntervention(run: RunSummary): RunInterventionKind {
  if (run.controlState === 'frozen') return 'annotate';
  if (run.status === 'Paused' || run.controlState === 'blocked') return 'resume';
  if (run.status === 'Succeeded' || run.status === 'Failed' || run.status === 'Cancelled') {
    return 'annotate';
  }
  return 'pause';
}

function effectLabel(effect: RunInterventionRequest['effect']): string {
  switch (effect) {
    case 'approval-gate-effect':
      return 'Approval Gate';
    case 'context-only':
      return 'Context only';
    case 'future-policy-effect':
      return 'Policy change';
    case 'workspace-safety-effect':
      return 'Workspace safety';
    case 'current-run-effect':
    default:
      return 'Current Run';
  }
}

function surfaceLabel(surface: NonNullable<RunInterventionRequest['surface']>): string {
  switch (surface) {
    case 'approval':
      return 'Approval';
    case 'emergency':
      return 'Emergency';
    case 'monitoring':
      return 'Monitoring';
    case 'policy-change':
      return 'Policy change';
    case 'steering':
    default:
      return 'Steering';
  }
}

function authorityLabel(
  authoritySource: NonNullable<RunInterventionRequest['authoritySource']>,
): string {
  switch (authoritySource) {
    case 'audit-annotation':
      return 'Audit annotation';
    case 'delegated-role':
      return 'Delegated role';
    case 'incident-break-glass':
      return 'Incident break-glass';
    case 'policy-rule':
      return 'Policy rule';
    case 'run-charter':
    default:
      return 'Run charter';
  }
}

function controlStateLabel(run: RunSummary): string {
  if (run.controlState === 'blocked') return 'Blocked';
  if (run.controlState === 'degraded') return 'Degraded';
  if (run.controlState === 'frozen') return 'Frozen';
  if (run.controlState === 'operator-owned') return 'Operator-owned';
  if (run.controlState === 'waiting' || run.status === 'WaitingForApproval') return 'Waiting';
  return run.status;
}

interface RunInterventionPanelProps {
  run: RunSummary;
  workforceMembers: WorkforceMemberSummary[];
  workforceQueues: WorkforceQueueSummary[];
  loading?: boolean;
  onSubmit: (request: RunInterventionRequest) => Promise<void> | void;
}

export function RunInterventionPanel({
  run,
  workforceMembers,
  workforceQueues,
  loading = false,
  onSubmit,
}: RunInterventionPanelProps) {
  const [interventionType, setInterventionType] = useState<RunInterventionKind>(() =>
    defaultIntervention(run),
  );
  const [target, setTarget] = useState('');
  const [rationale, setRationale] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const selected = useMemo(
    () => OPTIONS.find((option) => option.value === interventionType) ?? OPTIONS[0]!,
    [interventionType],
  );
  const targetRequired = Boolean(selected.requiresTarget);
  const unavailable = selected.unavailableWhen?.includes(run.status) ?? false;
  const acknowledgementRequired = Boolean(selected.requiresAcknowledgement);
  const canSubmit =
    !unavailable &&
    rationale.trim().length >= 8 &&
    (!targetRequired || Boolean(target)) &&
    (!acknowledgementRequired || acknowledged);

  async function submit() {
    if (!canSubmit) return;
    await onSubmit({
      interventionType,
      rationale: rationale.trim(),
      surface: selected.surface,
      authoritySource: selected.authoritySource,
      effect: selected.effect,
      consequence: selected.consequence,
      evidenceRequired: selected.evidenceRequired ?? false,
      ...(target ? { target } : {}),
    });
    setRationale('');
    setTarget('');
    setAcknowledged(false);
  }

  return (
    <Card className="shadow-none" data-testid="run-intervention-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-sm">
          <span>Run Intervention</span>
          <Badge variant={run.controlState === 'frozen' ? 'destructive' : 'outline'}>
            {controlStateLabel(run)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-md border px-2 py-1.5">
            <p className="text-muted-foreground">Surface</p>
            <p className="font-medium">{surfaceLabel(selected.surface)}</p>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <p className="text-muted-foreground">Effect</p>
            <p className="font-medium">{effectLabel(selected.effect)}</p>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <p className="text-muted-foreground">Authority</p>
            <p className="font-medium">{authorityLabel(selected.authoritySource)}</p>
          </div>
          <div className="rounded-md border px-2 py-1.5">
            <p className="text-muted-foreground">After submit</p>
            <p className="font-medium">{selected.controlStateLabel}</p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="run-intervention-action">Action</Label>
          <Select
            value={interventionType}
            onValueChange={(value) => {
              setInterventionType(value as RunInterventionKind);
              setTarget('');
              setAcknowledged(false);
            }}
          >
            <SelectTrigger id="run-intervention-action" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPS.map((group) => (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {OPTIONS.filter((option) => option.group === group).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border border-dashed px-3 py-2 text-xs">
          <div className="flex items-start gap-2">
            <LifeBuoy className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
            <p>{selected.consequence}</p>
          </div>
        </div>

        {targetRequired && (
          <div className="grid gap-2">
            <Label htmlFor="run-intervention-target">Target</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="run-intervention-target" className="w-full">
                <SelectValue placeholder="Select a person or queue" />
              </SelectTrigger>
              <SelectContent>
                {workforceQueues.map((queue) => (
                  <SelectItem
                    key={`queue:${queue.workforceQueueId}`}
                    value={`queue:${queue.workforceQueueId}`}
                  >
                    Queue: {queue.name}
                  </SelectItem>
                ))}
                {workforceMembers.map((member) => (
                  <SelectItem
                    key={`member:${member.workforceMemberId}`}
                    value={`member:${member.workforceMemberId}`}
                  >
                    Person: {member.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="run-intervention-rationale">Rationale</Label>
          <Textarea
            id="run-intervention-rationale"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            placeholder="Add the operator reason, constraint, taste note, or evidence gap."
            rows={4}
          />
        </div>

        {acknowledgementRequired && (
          <label
            htmlFor="run-intervention-acknowledgement"
            className="flex items-start gap-2 rounded-md border border-destructive/40 p-3 text-xs"
          >
            <Checkbox
              id="run-intervention-acknowledgement"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            <span>
              I understand this is a non-routine intervention that requires evidence-backed review.
            </span>
          </label>
        )}

        {unavailable && (
          <p className="text-xs text-muted-foreground">
            This action is unavailable for a {run.status} Run. Use an audit annotation instead.
          </p>
        )}

        <Button className="w-full" disabled={!canSubmit || loading} onClick={() => void submit()}>
          {loading ? 'Recording...' : `Record ${selected.label}`}
        </Button>
      </CardContent>
    </Card>
  );
}
