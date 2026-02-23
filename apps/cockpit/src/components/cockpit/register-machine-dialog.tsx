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

interface RegisterMachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MACHINE_CAPABILITIES: AgentCapability[] = [
  'machine:invoke',
  'read:external',
  'write:external',
];

export function RegisterMachineDialog({ open, onOpenChange }: RegisterMachineDialogProps) {
  const { activeWorkspaceId: wsId } = useUIStore();
  const qc = useQueryClient();

  const [hostname, setHostname] = useState('');
  const [osImage, setOsImage] = useState('');
  const [capabilities, setCapabilities] = useState<AgentCapability[]>(['machine:invoke']);

  const registerMachine = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/workspaces/${wsId}/machines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname,
          osImage: osImage || undefined,
          allowedCapabilities: capabilities,
        }),
      });
      if (!res.ok) throw new Error('Failed to register machine');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machines', wsId] });
      onOpenChange(false);
      setHostname('');
      setOsImage('');
      setCapabilities(['machine:invoke']);
    },
  });

  function toggleCapability(cap: AgentCapability) {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Register Machine</DialogTitle>
          <DialogDescription>
            Register a new edge machine or gateway in this workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="machine-hostname">Hostname</Label>
            <Input
              id="machine-hostname"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="e.g. edge-node-01.acme.internal"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="machine-os">OS Image (optional)</Label>
            <Input
              id="machine-os"
              value={osImage}
              onChange={(e) => setOsImage(e.target.value)}
              placeholder="e.g. ubuntu-22.04-lts"
            />
          </div>
          <div className="space-y-2">
            <Label>Capabilities</Label>
            <div className="space-y-2">
              {MACHINE_CAPABILITIES.map((cap) => (
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => registerMachine.mutate()}
            disabled={!hostname || registerMachine.isPending}
          >
            {registerMachine.isPending ? 'Registering...' : 'Register'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
