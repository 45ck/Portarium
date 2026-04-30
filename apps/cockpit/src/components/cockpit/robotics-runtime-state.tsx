import { Link } from '@tanstack/react-router';
import { AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/cockpit/page-header';
import { Button } from '@/components/ui/button';
import {
  ROBOTICS_DEMO_NOTICE,
  ROBOTICS_LIVE_UNSUPPORTED_DETAIL,
  ROBOTICS_LIVE_UNSUPPORTED_TITLE,
  shouldEnableRoboticsDemo,
} from '@/lib/robotics-runtime';

export function RoboticsRouteGate({
  children,
  surface = 'Robotics',
}: {
  children: React.ReactNode;
  surface?: string;
}) {
  if (!shouldEnableRoboticsDemo()) {
    return <RoboticsUnavailableState surface={surface} />;
  }

  return <>{children}</>;
}

export function RoboticsUnavailableState({ surface = 'Robotics' }: { surface?: string }) {
  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title={ROBOTICS_LIVE_UNSUPPORTED_TITLE}
        description={`${surface} is disabled for live tenant data.`}
        icon={<ShieldAlert className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
      />
      <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Non-live robotics surface</p>
        <p className="mt-1">{ROBOTICS_LIVE_UNSUPPORTED_DETAIL}</p>
        <p className="mt-2">
          Live Cockpit continues to use the supported location-events and map-layers contracts for
          telemetry evidence, but this prototype fleet UI remains hidden from navigation and cannot
          send robotics commands.
        </p>
      </div>
      <Link to="/dashboard">
        <Button variant="outline" size="sm">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}

export function RoboticsDemoNotice() {
  return (
    <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200">
      <div className="flex gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{ROBOTICS_DEMO_NOTICE}</p>
      </div>
    </div>
  );
}

export function RoboticsDataErrorState({
  title = 'Robotics data unavailable',
  detail = 'The robotics demo data source failed to respond. Safety and mission controls remain disabled.',
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-destructive/80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
