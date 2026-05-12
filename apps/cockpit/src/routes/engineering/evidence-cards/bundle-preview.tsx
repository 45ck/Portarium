import { createRoute, redirect } from '@tanstack/react-router';
import { FileJson2 } from 'lucide-react';
import { GslrManualBundlePreview } from '@/components/cockpit/gslr-manual-bundle-preview';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';
import { Route as rootRoute } from '../../__root';

function BundlePreviewRoute() {
  return (
    <div className="min-h-full bg-mission-background">
      <div className="space-y-5 p-4 md:p-6">
        <PageHeader
          title="GSLR Bundle Preview"
          description="Manual verification preview for static prompt-language evidence bundles."
          icon={<FileJson2 className="h-5 w-5" aria-hidden="true" />}
          status={
            <>
              <Badge variant="info">Manual preview</Badge>
              <Badge variant="warning">No persistence</Badge>
              <Badge variant="outline">No action controls</Badge>
            </>
          }
        />
        <GslrManualBundlePreview />
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/engineering/evidence-cards/bundle-preview',
  beforeLoad: () => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({ to: '/dashboard' as string });
    }
  },
  component: BundlePreviewRoute,
});
