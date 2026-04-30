import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Handshake,
  MessageSquareText,
  Pause,
  Play,
  Route,
  Shield,
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type InterventionOption = {
  value: RunInterventionKind;
  label: string;
  effect: RunInterventionRequest['effect'];
  icon: ReactNode;
  requiresTarget?: boolean;
};

const OPTIONS: InterventionOption[] = [
  {
    value: 'pause',
    label: 'Pause',
    effect: 'current-run-effect',
    icon: <Pause className="h-4 w-4" />,
  },
  {
    value: 'resume',
    label: 'Resume',
    effect: 'current-run-effect',
    icon: <Play className="h-4 w-4" />,
  },
  {
    value: 'reroute',
    label: 'Reroute',
    effect: 'current-run-effect',
    icon: <Route className="h-4 w-4" />,
    requiresTarget: true,
  },
  {
    value: 'handoff',
    label: 'Handoff',
    effect: 'current-run-effect',
    icon: <Handshake className="h-4 w-4" />,
    requiresTarget: true,
  },
  {
    value: 'request-evidence',
    label: 'Request Evidence',
    effect: 'current-run-effect',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  {
    value: 'freeze',
    label: 'Freeze',
    effect: 'current-run-effect',
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: 'annotate',
    label: 'Annotate',
    effect: 'context-only',
    icon: <MessageSquareText className="h-4 w-4" />,
  },
];

function defaultIntervention(run: RunSummary): RunInterventionKind {
  if (run.status === 'Paused') return 'resume';
  if (run.status === 'Succeeded' || run.status === 'Failed' || run.status === 'Cancelled') {
    return 'annotate';
  }
  return 'pause';
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

  const selected = useMemo(
    () => OPTIONS.find((option) => option.value === interventionType) ?? OPTIONS[0]!,
    [interventionType],
  );
  const targetRequired = Boolean(selected.requiresTarget);
  const canSubmit = rationale.trim().length >= 8 && (!targetRequired || Boolean(target));

  async function submit() {
    if (!canSubmit) return;
    await onSubmit({
      interventionType,
      rationale: rationale.trim(),
      effect: selected.effect,
      ...(target ? { target } : {}),
    });
    setRationale('');
    setTarget('');
  }

  return (
    <Card className="shadow-none" data-testid="run-intervention-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-sm">
          <span>Operator Steering</span>
          <Badge variant={selected.effect === 'context-only' ? 'outline' : 'secondary'}>
            {selected.effect === 'context-only' ? 'Context only' : 'Current run'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="run-intervention-action">Action</Label>
          <Select
            value={interventionType}
            onValueChange={(value) => {
              setInterventionType(value as RunInterventionKind);
              setTarget('');
            }}
          >
            <SelectTrigger id="run-intervention-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {targetRequired && (
          <div className="grid gap-2">
            <Label htmlFor="run-intervention-target">Target</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="run-intervention-target">
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

        <Button className="w-full" disabled={!canSubmit || loading} onClick={() => void submit()}>
          {loading ? 'Recording...' : `Record ${selected.label}`}
        </Button>
      </CardContent>
    </Card>
  );
}
