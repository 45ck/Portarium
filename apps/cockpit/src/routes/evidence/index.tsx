import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { ChainIntegrityBanner } from '@/components/cockpit/chain-integrity-banner';
import { FilterBar } from '@/components/cockpit/filter-bar';
import { EvidenceTimeline } from '@/components/cockpit/evidence-timeline';
import { EmptyState } from '@/components/cockpit/empty-state';
import { Button } from '@/components/ui/button';

const CATEGORY_OPTIONS = [
  { label: 'Plan', value: 'Plan' },
  { label: 'Action', value: 'Action' },
  { label: 'Approval', value: 'Approval' },
  { label: 'Policy', value: 'Policy' },
  { label: 'System', value: 'System' },
];

const EVIDENCE_PAGE_SIZE = 20;

function EvidencePage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading } = useEvidence(wsId);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    category: 'all',
  });
  const [visibleCount, setVisibleCount] = useState(EVIDENCE_PAGE_SIZE);

  const items = data?.items ?? [];
  const filtered = items.filter((entry) => {
    if (
      filterValues.category &&
      filterValues.category !== 'all' &&
      entry.category !== filterValues.category
    )
      return false;
    return true;
  });

  const visibleEntries = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Evidence"
        description="Immutable audit trail with hash chain verification"
        icon={<EntityIcon entityType="evidence" size="md" decorative />}
      />

      <ChainIntegrityBanner status="verified" />

      <FilterBar
        filters={[{ key: 'category', label: 'Category', options: CATEGORY_OPTIONS }]}
        values={filterValues}
        onChange={(key, value) => {
          setFilterValues((prev) => ({ ...prev, [key]: value }));
          setVisibleCount(EVIDENCE_PAGE_SIZE);
        }}
      />

      {!isLoading && filtered.length === 0 ? (
        <EmptyState title="No evidence" description="No evidence entries match your filters." />
      ) : (
        <>
          <EvidenceTimeline entries={visibleEntries} loading={isLoading} />
          {!isLoading && hasMore && (
            <div className="flex flex-col items-center gap-1 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((c) => c + EVIDENCE_PAGE_SIZE)}
              >
                Show more
              </Button>
              <span className="text-xs text-muted-foreground">
                Showing {visibleEntries.length} of {filtered.length} entries
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/evidence',
  component: EvidencePage,
});
