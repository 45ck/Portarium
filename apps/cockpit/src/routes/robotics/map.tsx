import { useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useRobotLocations } from '@/hooks/queries/use-robot-locations'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { MapView } from '@/components/cockpit/operations-map/map-view'
import { RobotListPanel } from '@/components/cockpit/operations-map/robot-list-panel'
import { RobotDetailPanel } from '@/components/cockpit/operations-map/robot-detail-panel'
import { AlertTriagePanel } from '@/components/cockpit/operations-map/alert-triage-panel'
import { PlaybackControls } from '@/components/cockpit/operations-map/playback-controls'
import type { LayerVisibility } from '@/components/cockpit/operations-map/layer-toggles'
import { MapPin, Loader2 } from 'lucide-react'

function OperationsMapPage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const { data, isLoading } = useRobotLocations(wsId)

  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null)
  const [layers, setLayers] = useState<LayerVisibility>({
    geofences: true,
    trails: false,
    halos: true,
  })

  const locations = data?.items ?? []
  const geofences = data?.geofences ?? []
  const alerts = data?.alerts ?? []

  const selectedLocation = selectedRobotId
    ? locations.find((l) => l.robotId === selectedRobotId) ?? null
    : null

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading operations map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold" role="heading" aria-level={1}>Operations Map</h1>
        <span className="text-xs text-muted-foreground">
          {locations.length} robots &middot; {alerts.length} alerts
        </span>
      </div>

      {/* Main content */}
      <div className="relative flex-1">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={65} minSize={40}>
            <div className="relative h-full">
              <MapView
                locations={locations}
                geofences={geofences}
                selectedRobotId={selectedRobotId}
                onSelectRobot={setSelectedRobotId}
                layers={layers}
                onLayersChange={setLayers}
              />
              <AlertTriagePanel alerts={alerts} onJumpToRobot={setSelectedRobotId} />
              <PlaybackControls />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
            <div className="flex h-full flex-col">
              <div className="flex-1 overflow-hidden">
                <RobotListPanel
                  locations={locations}
                  selectedRobotId={selectedRobotId}
                  onSelectRobot={setSelectedRobotId}
                />
              </div>
              {selectedLocation && (
                <RobotDetailPanel
                  robot={selectedLocation}
                  onClose={() => setSelectedRobotId(null)}
                />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/map',
  component: OperationsMapPage,
})
