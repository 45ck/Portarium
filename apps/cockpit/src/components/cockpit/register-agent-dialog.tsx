import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { AgentCapability } from '@portarium/cockpit-types';

interface RegisterAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_CAPABILITIES: AgentCapability[] = [
  'read:external',
  'write:external',
  'classify',
  'generate',
  'analyze',
  'execute-code',
  'notify',
];

export function RegisterAgentDialog({ open, onOpenChange }: RegisterAgentDialogProps) {
  const { activeWorkspaceId: wsId } = useUIStore();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [modelId, setModelId] = useState('');
  const [capabilities, setCapabilities] = useState<AgentCapability[]>([]);

  const registerAgent = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/workspaces/${wsId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          endpoint,
          modelId: modelId || undefined,
          allowedCapabilities: capabilities,
        }),
      });
      if (!res.ok) throw new Error('Failed to register agent');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents', wsId] });
      onOpenChange(false);
      setName('');
      setEndpoint('');
      setModelId('');
      setCapabilities([]);
    },
  });

  function toggleCapability(cap: AgentCapability) {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Register Agent</DialogTitle>
          <DialogDescription>Register a new AI agent in this workspace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Invoice Classifier"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-endpoint">Endpoint URL</Label>
            <Input
              id="agent-endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://agent.example.com/v1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-model">Model ID (optional)</Label>
            <Input
              id="agent-model"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. gpt-4o"
            />
          </div>
          <div className="space-y-2">
            <Label>Capabilities</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CAPABILITIES.map((cap) => (
                <label
                  key={cap}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                >
                  <Checkbox
                    checked={capabilities.includes(cap)}
                    onCheckedChange={() => toggleCapability(cap)}
                  />
                  <span>{cap}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => registerAgent.mutate()}
            disabled={!name || !endpoint || registerAgent.isPending}
          >
            {registerAgent.isPending ? 'Registering...' : 'Register'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
