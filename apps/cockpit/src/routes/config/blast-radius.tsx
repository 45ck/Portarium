import { lazy, Suspense } from 'react';
import { createRoute } from '@tanstack/react-router';
import { ShieldAlert } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { resolveCockpitRuntime } from '@/lib/cockpit-runtime';

const DemoBlastRadiusPage = lazy(() =>
  import('@/mocks/routes/config/blast-radius-demo').then((module) => ({
    default: module.DemoBlastRadiusPage,
  })),
);

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

  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="h-56 animate-pulse rounded-md border border-border bg-muted/30" />
        </div>
      }
    >
      <DemoBlastRadiusPage />
    </Suspense>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/blast-radius',
  component: BlastRadiusPage,
});
