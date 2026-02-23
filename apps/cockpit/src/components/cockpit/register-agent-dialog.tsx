import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/stores/ui-store';
import { useMachines } from '@/hooks/queries/use-machines';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AgentCapability, PolicyTier } from '@portarium/cockpit-types';

interface RegisterAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_CAPABILITIES: AgentCapability[] = [
  'machine:invoke',
  'read:external',
  'write:external',
  'classify',
  'generate',
  'analyze',
  'execute-code',
  'notify',
];

const POLICY_TIERS: { value: PolicyTier; label: string }[] = [
  { value: 'Auto', label: 'Auto — fully autonomous' },
  { value: 'Assisted', label: 'Assisted — human in the loop' },
  { value: 'HumanApprove', label: 'Human Approve — approval required' },
  { value: 'ManualOnly', label: 'Manual Only — no automation' },
];

export function RegisterAgentDialog({ open, onOpenChange }: RegisterAgentDialogProps) {
  const { activeWorkspaceId: wsId } = useUIStore();
  const qc = useQueryClient();
  const { data: machinesData } = useMachines(wsId);
  const machines = machinesData?.items ?? [];

  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [modelId, setModelId] = useState('');
  const [capabilities, setCapabilities] = useState<AgentCapability[]>([]);
  const [machineId, setMachineId] = useState('');
  const [policyTier, setPolicyTier] = useState<PolicyTier>('HumanApprove');

  const isOpenClaw = capabilities.includes('machine:invoke');

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
          machineId: isOpenClaw && machineId ? machineId : undefined,
          policyTier: isOpenClaw ? policyTier : undefined,
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
      setMachineId('');
      setPolicyTier('HumanApprove');
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
                <label key={cap} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={capabilities.includes(cap)}
                    onCheckedChange={() => toggleCapability(cap)}
                  />
                  <span>{cap}</span>
                </label>
              ))}
            </div>
          </div>

          {isOpenClaw && (
            <>
              <div className="space-y-2">
                <Label htmlFor="agent-machine">Connected Machine</Label>
                <Select value={machineId} onValueChange={setMachineId}>
                  <SelectTrigger id="agent-machine" className="w-full">
                    <SelectValue placeholder="Select a machine (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map((m) => (
                      <SelectItem key={m.machineId} value={m.machineId}>
                        {m.hostname}
                        <span className="ml-1.5 text-muted-foreground text-[10px]">
                          ({m.status})
                        </span>
                      </SelectItem>
                    ))}
                    {machines.length === 0 && (
                      <SelectItem value="none" disabled>
                        No machines registered
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-policy-tier">Policy Tier</Label>
                <Select value={policyTier} onValueChange={(v) => setPolicyTier(v as PolicyTier)}>
                  <SelectTrigger id="agent-policy-tier" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
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
