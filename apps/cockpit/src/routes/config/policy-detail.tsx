import { lazy, Suspense } from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { Button } from '@/components/ui/button';
import { resolveCockpitRuntime } from '@/lib/cockpit-runtime';

const DemoPolicyDetailPage = lazy(() =>
  import('@/mocks/routes/config/policy-detail-demo').then((module) => ({
    default: module.DemoPolicyDetailPage,
  })),
);

function PolicyDetailPage() {
  const { policyId } = Route.useParams();
  const runtime = resolveCockpitRuntime();

  if (!runtime.allowDemoControls) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Policy Detail"
          description="Demo policy editing fixtures are disabled while Cockpit is connected to live tenant data."
          icon={<ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />}
          breadcrumb={[{ label: 'Policies', to: '/config/policies' }, { label: policyId }]}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/config/policies">Back to Policies</Link>
            </Button>
          }
        />
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Live policy detail must be served by the control-plane policy API. The fixture-backed
          editor is available only in explicit demo mode.
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
      <DemoPolicyDetailPage policyId={policyId} />
    </Suspense>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/policies/$policyId',
  component: PolicyDetailPage,
});
