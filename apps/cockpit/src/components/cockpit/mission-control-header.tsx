import { Activity, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface MissionControlHeaderProps {
  awaitingCount: number;
  runningCount: number;
  chainVerified: boolean;
  lastChainCheckAt: string;
}

export function MissionControlHeader({
  awaitingCount,
  runningCount,
  chainVerified,
  lastChainCheckAt,
}: MissionControlHeaderProps) {
  return (
    <header className="border-b bg-background px-4 py-4 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight">Engineering Cockpit</h1>
          <p className="text-sm text-muted-foreground">
            Bead work, agent execution, and Approval Gates in one operator surface.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={awaitingCount > 0 ? 'warning' : 'secondary'} className="h-7">
            <ShieldAlert className="h-3.5 w-3.5" />
            {awaitingCount} awaiting
          </Badge>
          <Badge variant="outline" className="h-7">
            <Activity className="h-3.5 w-3.5" />
            {runningCount} running
          </Badge>
          <Badge variant={chainVerified ? 'success' : 'destructive'} className="h-7">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {chainVerified ? 'Chain verified' : 'Chain check needed'}
          </Badge>
          <span className="self-center text-xs text-muted-foreground">{lastChainCheckAt}</span>
        </div>
      </div>
    </header>
  );
}
