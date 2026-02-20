import { useMemo } from 'react'
import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useWorkItems } from '@/hooks/queries/use-work-items'
import { PageHeader } from '@/components/cockpit/page-header'
import { EmptyState } from '@/components/cockpit/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Database } from 'lucide-react'
import type { ExternalObjectRef } from '@portarium/cockpit-types'

function ExploreObjectsPage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const { data, isLoading } = useWorkItems(wsId)

  const groupedBySor = useMemo(() => {
    const refs: ExternalObjectRef[] = []
    for (const wi of data?.items ?? []) {
      if (wi.links?.externalRefs) {
        refs.push(...wi.links.externalRefs)
      }
    }
    const groups: Record<string, ExternalObjectRef[]> = {}
    for (const ref of refs) {
      const key = ref.sorName
      if (!groups[key]) groups[key] = []
      groups[key].push(ref)
    }
    return groups
  }, [data])

  const sorNames = Object.keys(groupedBySor)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Objects"
        description="External object references grouped by System of Record"
      />

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading...</div>
      ) : sorNames.length === 0 ? (
        <EmptyState
          title="No objects"
          description="No external object references found in work items."
          icon={<Database className="h-10 w-10" />}
        />
      ) : (
        <div className="space-y-4">
          {sorNames.map((sorName) => (
            <Card key={sorName} className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{sorName}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Label</TableHead>
                      <TableHead className="text-xs">External ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(groupedBySor[sorName] ?? []).map((ref, i) => (
                      <TableRow key={`${ref.externalId}-${i}`}>
                        <TableCell className="text-xs">{ref.externalType}</TableCell>
                        <TableCell className="text-xs">{ref.displayLabel ?? '-'}</TableCell>
                        <TableCell className="text-xs font-mono">{ref.externalId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore/objects',
  component: ExploreObjectsPage,
})
