import { createRoute, redirect } from '@tanstack/react-router';
import { FileCheck2 } from 'lucide-react';
import { GSLR_STATIC_ENGINEERING_EVIDENCE_CARD_EXPORTS } from '@/components/cockpit/gslr-static-evidence-card-fixtures';
import { GslrStaticEvidenceCardView } from '@/components/cockpit/gslr-static-evidence-card-view';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';
import { Route as rootRoute } from '../../__root';

function StaticEvidenceCardsRoute() {
  return (
    <div className="min-h-full bg-mission-background">
      <div className="space-y-5 p-4 md:p-6">
        <PageHeader
          title="Static Engineering Evidence Cards"
          description="Fixture-backed GSLR evidence cards for operator review shape only."
          icon={<FileCheck2 className="h-5 w-5" aria-hidden="true" />}
          status={
            <>
              <Badge variant="info">Static fixture</Badge>
              <Badge variant="warning">No live ingestion</Badge>
              <Badge variant="outline">No action controls</Badge>
            </>
          }
        />
        <GslrStaticEvidenceCardView cards={GSLR_STATIC_ENGINEERING_EVIDENCE_CARD_EXPORTS} />
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/engineering/evidence-cards/static',
  beforeLoad: () => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({ to: '/dashboard' as string });
    }
  },
  component: StaticEvidenceCardsRoute,
});
