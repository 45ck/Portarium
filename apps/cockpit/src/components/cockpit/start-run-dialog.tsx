import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/stores/ui-store';
import { useWorkflows } from '@/hooks/queries/use-workflows';
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
import { controlPlaneClient } from '@/lib/control-plane-client';

interface StartRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartRunDialog({ open, onOpenChange }: StartRunDialogProps) {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data: workflowsData } = useWorkflows(wsId);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [workflowId, setWorkflowId] = useState('');
  const [operatorIntent, setOperatorIntent] = useState('');
  const [rationale, setRationale] = useState('');
  const [parametersJson, setParametersJson] = useState('');

  const createRun = useMutation({
    mutationFn: async () => {
      let parameters: Record<string, unknown> | undefined;
      if (parametersJson.trim()) {
        try {
          parameters = JSON.parse(parametersJson);
        } catch {
          throw new Error('Invalid JSON in parameters field');
        }
      }
      return controlPlaneClient.startRun(wsId, {
        workflowId,
        parameters,
        operatorIntent: operatorIntent.trim(),
        ...(rationale.trim() ? { rationale: rationale.trim() } : {}),
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['runs', wsId] });
      onOpenChange(false);
      setWorkflowId('');
      setOperatorIntent('');
      setRationale('');
      setParametersJson('');
      navigate({ to: '/runs/$runId' as string, params: { runId: data.runId } });
    },
  });

  const workflows = workflowsData?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createRun.mutate()}
            disabled={!workflowId || operatorIntent.trim().length < 8 || createRun.isPending}
          >
            {createRun.isPending ? 'Starting...' : 'Start Run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
