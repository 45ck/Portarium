import { createRoute, redirect } from '@tanstack/react-router';
import { ClipboardList } from 'lucide-react';
import { GslrStaticEvidenceWorkbench } from '@/components/cockpit/gslr-static-evidence-workbench';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';
import { Route as rootRoute } from '../../__root';

function WorkbenchRoute() {
  return (
    <div className="min-h-full bg-mission-background">
      <div className="space-y-5 p-4 md:p-6">
        <PageHeader
          title="GSLR Evidence Workbench"
          description="Static dry-run review for prompt-language evidence bundles before any production import path exists."
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          status={
            <>
              <Badge variant="info">GSLR-20 dry-run</Badge>
              <Badge variant="warning">No persistence</Badge>
              <Badge variant="outline">No runtime authority</Badge>
            </>
          }
        />
        <GslrStaticEvidenceWorkbench />
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/engineering/evidence-cards/workbench',
  beforeLoad: () => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({ to: '/dashboard' as string });
    }
  },
  component: WorkbenchRoute,
});
