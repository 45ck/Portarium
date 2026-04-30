import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useUIStore } from '@/stores/ui-store';
import { useWorkflows } from '@/hooks/queries/use-workflows';
import { useStartRun } from '@/hooks/queries/use-runs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StartRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartRunDialog({ open, onOpenChange }: StartRunDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <StartRunDialogContent onOpenChange={onOpenChange} /> : null}
    </Dialog>
  );
}

function StartRunDialogContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data: workflowsData } = useWorkflows(wsId);
  const navigate = useNavigate();

  const [workflowId, setWorkflowId] = useState('');
  const [operatorIntent, setOperatorIntent] = useState('');
  const [rationale, setRationale] = useState('');
  const [parametersJson, setParametersJson] = useState('');

  const createRun = useStartRun(wsId);

  async function submitStartRun() {
    let parameters: Record<string, unknown> | undefined;
    if (parametersJson.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(parametersJson) as unknown;
      } catch {
        throw new Error('Invalid JSON in parameters field');
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Parameters must be a JSON object');
      }
      parameters = parsed as Record<string, unknown>;
    }

    const intent = operatorIntent.trim();
    const trimmedRationale = rationale.trim();
    const runParameters = {
      ...(parameters ?? {}),
      operatorIntent: intent,
      ...(trimmedRationale ? { operatorRationale: trimmedRationale } : {}),
    };

    return createRun.mutateAsync({
      workflowId,
      parameters: runParameters,
    });
  }

  function resetForm() {
    setWorkflowId('');
    setOperatorIntent('');
    setRationale('');
    setParametersJson('');
  }

  async function handleStartRun() {
    const data = await submitStartRun();
    resetForm();
    onOpenChange(false);
    navigate({ to: '/runs/$runId' as string, params: { runId: data.runId } });
  }

  const closeDialog = (nextOpen: boolean) => {
    if (!nextOpen && !createRun.isPending) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const workflows = workflowsData?.items ?? [];

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>New Governed Run</DialogTitle>
        <DialogDescription>Launch agent work from operator intent.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="workflow-select">Workflow</Label>
          <Select value={workflowId} onValueChange={setWorkflowId}>
            <SelectTrigger id="workflow-select">
              <SelectValue placeholder="Select a workflow" />
            </SelectTrigger>
            <SelectContent>
              {workflows.map((wf) => (
                <SelectItem key={wf.workflowId} value={wf.workflowId}>
                  {wf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="operator-intent-input">Intent</Label>
          <Textarea
            id="operator-intent-input"
            value={operatorIntent}
            onChange={(e) => setOperatorIntent(e.target.value)}
            placeholder="Reconcile the supplier invoice mismatch and prepare the approval packet"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operator-rationale-input">Operator rationale (optional)</Label>
          <Textarea
            id="operator-rationale-input"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Use the current supplier policy and stop before external writes."
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="params-input">Parameters (JSON, optional)</Label>
          <Textarea
            id="params-input"
            value={parametersJson}
            onChange={(e) => setParametersJson(e.target.value)}
            placeholder='{"key": "value"}'
            className="font-mono text-xs"
            rows={4}
          />
        </div>
      </div>
      {createRun.error && (
        <p className="text-xs text-destructive px-1">
          {createRun.error instanceof Error ? createRun.error.message : 'Failed to start run'}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => closeDialog(false)}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleStartRun()}
          disabled={!workflowId || operatorIntent.trim().length < 8 || createRun.isPending}
        >
          {createRun.isPending ? 'Starting...' : 'Start Run'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
