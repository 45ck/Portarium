import { lazy, Suspense } from 'react';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { resolveCockpitRuntime } from '@/lib/cockpit-runtime';

const DemoPolicyStudioPage = lazy(() =>
  import('@/mocks/components/demo-policy-studio').then((module) => ({
    default: module.DemoPolicyStudioPage,
  })),
);

function DemoLoadingState() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Policy Studio"
        icon={<EntityIcon entityType="policy" size="md" decorative />}
      />
      <div className="h-40 rounded-md border border-border bg-muted/30 animate-pulse" />
    </div>
  );
}

export function PolicyStudioPage() {
  const runtime = resolveCockpitRuntime();

  if (!runtime.allowDemoControls) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Policy Studio"
          description="Demo policy simulation is disabled while Cockpit is connected to live tenant data."
          icon={<EntityIcon entityType="policy" size="md" decorative />}
        />
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Live policy editing must use the control-plane policy APIs. Fixture-backed simulation is
          only available in explicit demo mode.
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<DemoLoadingState />}>
      <DemoPolicyStudioPage />
    </Suspense>
  );
}
