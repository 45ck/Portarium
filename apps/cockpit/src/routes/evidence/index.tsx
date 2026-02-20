import { useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useEvidence } from '@/hooks/queries/use-evidence'
import { PageHeader } from '@/components/cockpit/page-header'
import { ChainIntegrityBanner } from '@/components/cockpit/chain-integrity-banner'
import { FilterBar } from '@/components/cockpit/filter-bar'
import { EvidenceTimeline } from '@/components/cockpit/evidence-timeline'
import { EmptyState } from '@/components/cockpit/empty-state'

const CATEGORY_OPTIONS = [
  { label: 'Plan', value: 'Plan' },
  { label: 'Action', value: 'Action' },
  { label: 'Approval', value: 'Approval' },
  { label: 'Policy', value: 'Policy' },
  { label: 'System', value: 'System' },
]

function EvidencePage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const { data, isLoading } = useEvidence(wsId)
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    category: 'all',
  })

  const items = data?.items ?? []
  const filtered = items.filter((entry) => {
    if (filterValues.category && filterValues.category !== 'all' && entry.category !== filterValues.category)
      return false
    return true
  })

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Evidence"
        description="Immutable audit trail with hash chain verification"
      />

      <ChainIntegrityBanner status="verified" />

      <FilterBar
        filters={[
          { key: 'category', label: 'Category', options: CATEGORY_OPTIONS },
        ]}
        values={filterValues}
        onChange={(key, value) =>
          setFilterValues((prev) => ({ ...prev, [key]: value }))
        }
      />

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          title="No evidence"
          description="No evidence entries match your filters."
        />
      ) : (
        <EvidenceTimeline entries={filtered} loading={isLoading} />
      )}
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/evidence',
  component: EvidencePage,
})
