import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { GitBranchPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { controlPlaneClient } from '@/lib/control-plane-client';
import { useUIStore } from '@/stores/ui-store';
import type { IntentPlanResponse } from '@portarium/cockpit-types';

interface IntentPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IntentPlanSheet({ open, onOpenChange }: IntentPlanSheetProps) {
  const { activeWorkspaceId: wsId } = useUIStore();
  const [triggerText, setTriggerText] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [planResult, setPlanResult] = useState<IntentPlanResponse | null>(null);

  const planIntent = useMutation({
    mutationFn: () =>
      controlPlaneClient.planIntent(wsId, {
        source: 'Human',
        triggerText,
        constraints: ['Do not create worktrees until this plan is approved.'],
      }),
    onSuccess: (result) => {
      setConfirmed(false);
      setPlanResult(result);
    },
  });

  function reset(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTriggerText('');
      setConfirmed(false);
      setPlanResult(null);
      planIntent.reset();
    }
  }

  return (
    <Sheet open={open} onOpenChange={reset}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitBranchPlus className="h-4 w-4" />
            New Bead Plan
          </SheetTitle>
          <SheetDescription>Plan agent work before any worktree is created.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4">
          <div className="space-y-2">
            <Label htmlFor="intent-trigger">Intent</Label>
            <Textarea
              id="intent-trigger"
              value={triggerText}
              onChange={(event) => setTriggerText(event.target.value)}
              placeholder="Build the approval queue summary and add mobile tests"
              rows={5}
            />
            {planIntent.error && (
              <p className="text-xs text-destructive">
                {planIntent.error instanceof Error ? planIntent.error.message : 'Planning failed'}
              </p>
            )}
          </div>

          {planResult && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Plan Artifact</h3>
                <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                  {planResult.artifact.markdown}
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Bead Proposals</h3>
                {planResult.proposals.map((proposal) => (
                  <div key={proposal.proposalId} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{proposal.title}</span>
                      <Badge variant="secondary">{proposal.executionTier}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{proposal.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{proposal.specRef}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => reset(false)}>
            Cancel
          </Button>
          {planResult ? (
            <Button onClick={() => setConfirmed(true)} disabled={confirmed}>
              {confirmed ? 'Plan Approved' : 'Approve Plan'}
            </Button>
          ) : (
            <Button
              onClick={() => planIntent.mutate()}
              disabled={triggerText.trim().length < 8 || planIntent.isPending}
            >
              {planIntent.isPending ? 'Planning...' : 'Generate Plan'}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
