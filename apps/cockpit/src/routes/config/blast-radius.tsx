import { createRoute, redirect } from '@tanstack/react-router';
import { ShieldAlert } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { resolveCockpitRuntime } from '@/lib/cockpit-runtime';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';

function BlastRadiusUnavailablePage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Tool Blast Radius"
        description="Fixture-backed tool-classification data is not included in production Cockpit builds."
        icon={<ShieldAlert className="h-6 w-6 text-primary" />}
      />
      <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
        Live tool classification must come from the control-plane config API.
      </div>
    </div>
  );
}

function BlastRadiusPage() {
  const runtime = resolveCockpitRuntime();

  if (!runtime.allowDemoControls) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Tool Blast Radius"
          description="Demo tool-classification fixtures are disabled while Cockpit is connected to live tenant data."
          icon={<ShieldAlert className="h-6 w-6 text-primary" />}
        />
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Live tool classification must come from the control-plane config API. This fixture-backed
          matrix is available only in explicit demo mode.
        </div>
      </div>
    );
  }

  return <BlastRadiusUnavailablePage />;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/blast-radius',
  beforeLoad: () => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({ to: '/config/policies' });
    }
  },
  component: BlastRadiusPage,
});
