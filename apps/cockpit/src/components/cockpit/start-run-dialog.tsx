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
  const [parametersJson, setParametersJson] = useState('');

  const createRun = useMutation({
    mutationFn: async () => {
      let parameters: Record<string, unknown> | undefined;
      if (parametersJson.trim()) {
        parameters = JSON.parse(parametersJson);
      }
      const res = await fetch(`/v1/workspaces/${wsId}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, parameters }),
      });
      if (!res.ok) throw new Error('Failed to create run');
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['runs', wsId] });
      onOpenChange(false);
      setWorkflowId('');
      setParametersJson('');
      navigate({ to: '/runs/$runId' as string, params: { runId: data.runId } });
    },
  });

  const workflows = workflowsData?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Run</DialogTitle>
          <DialogDescription>Start a new workflow run.</DialogDescription>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createRun.mutate()}
            disabled={!workflowId || createRun.isPending}
          >
            {createRun.isPending ? 'Starting...' : 'Start Run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
