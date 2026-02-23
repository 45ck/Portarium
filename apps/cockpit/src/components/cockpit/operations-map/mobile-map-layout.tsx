import type { RobotLocation, Geofence, SpatialAlert } from '@/mocks/fixtures/robot-locations';
import type { LayerVisibility } from './layer-toggles';
import { MapView } from './map-view';
import { RobotListPanel } from './robot-list-panel';
import { RobotDetailPanel } from './robot-detail-panel';
import { AlertTriagePanel } from './alert-triage-panel';
import { MobileBottomSheet } from './mobile-bottom-sheet';
import { MapLegend } from './map-legend';
import { Button } from '@/components/ui/button';
import { Layers, Radio } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Mobile-optimised layout for the Operations Map.
 *
 * Performance budgets:
 * - Default layers: geofences only (trails + halos off to reduce paint)
 * - Bottom sheet replaces ResizablePanelGroup (no dual-panel layout on mobile)
 * - Playback controls hidden on mobile (coming-soon feature, saves overlay space)
 * - Alert triage moved inside bottom sheet to prevent overlay clashing
 */

interface MobileMapLayoutProps {
  locations: RobotLocation[];
  geofences: Geofence[];
  alerts: SpatialAlert[];
  selectedRobotId: string | null;
  onSelectRobot: (robotId: string | null) => void;
  layers: LayerVisibility;
  onLayersChange: (layers: LayerVisibility) => void;
}

export function MobileMapLayout({
  locations,
  geofences,
  alerts,
  selectedRobotId,
  onSelectRobot,
  layers,
  onLayersChange,
}: MobileMapLayoutProps) {
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  const selectedLocation = selectedRobotId
    ? (locations.find((l) => l.robotId === selectedRobotId) ?? null)
    : null;

  return (
    <div className="relative h-full w-full">
      {/* Full-screen map */}
      <MapView
        locations={locations}
        geofences={geofences}
        selectedRobotId={selectedRobotId}
        onSelectRobot={onSelectRobot}
        layers={layers}
        onLayersChange={onLayersChange}
      />

      {/* Compact mobile controls — top-right, replacing desktop layer toggles
          which are rendered inside MapView. We overlay a toggle button. */}
      <div className="absolute top-3 right-3 z-[1100] flex flex-col gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          className="h-9 w-9 p-0 shadow-md"
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          aria-label="Toggle map layers"
          aria-expanded={showLayerPanel}
        >
          <Layers className="h-4 w-4" />
        </Button>
      </div>

      {/* Layer panel dropdown — mobile sized */}
      {showLayerPanel && (
        <div className="absolute top-14 right-3 z-[1100]">
          <div className="rounded-lg border border-border bg-card shadow-lg p-2 space-y-1">
            {(['geofences', 'trails', 'halos'] as const).map((key) => (
              <button
                key={key}
                onClick={() => onLayersChange({ ...layers, [key]: !layers[key] })}
                className={cn(
                  'flex items-center gap-2 w-full rounded px-3 py-2 text-sm transition-colors',
                  layers[key] ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'h-3 w-3 rounded-sm border-2 transition-colors',
                    layers[key] ? 'bg-primary border-primary' : 'border-muted-foreground/40',
                  )}
                />
                {key === 'halos' ? 'Uncertainty zones' : key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live indicator — top-left, compact */}
      <div className="absolute top-3 left-3 z-[1100]">
        <div className="flex items-center gap-1.5 rounded-full bg-card/90 border border-border px-2.5 py-1 shadow-sm backdrop-blur-sm">
          <Radio className="h-3 w-3 text-green-500" />
          <span className="text-[11px] font-medium">Live</span>
          <span className="text-[11px] text-muted-foreground">{locations.length} robots</span>
        </div>
      </div>

      {/* Bottom sheet — robot list or detail */}
      {selectedLocation ? (
        <MobileBottomSheet
          title={selectedLocation.name}
          onClose={() => onSelectRobot(null)}
          defaultSnap="half"
        >
          <RobotDetailPanel robot={selectedLocation} onClose={() => onSelectRobot(null)} />
        </MobileBottomSheet>
      ) : (
        <MobileBottomSheet title="Fleet" count={locations.length} defaultSnap="collapsed">
          {/* Alerts section — moved inside bottom sheet on mobile */}
          {alerts.length > 0 && (
            <div className="border-b border-border px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-1.5">
                Alerts ({alerts.length})
              </p>
              <div className="space-y-1">
                {alerts.slice(0, 3).map((alert) => (
                  <button
                    key={alert.alertId}
                    onClick={() => onSelectRobot(alert.robotId)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent/50 transition-colors"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        alert.severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500',
                      )}
                    />
                    <span className="truncate text-xs">{alert.message}</span>
                  </button>
                ))}
                {alerts.length > 3 && (
                  <p className="text-[11px] text-muted-foreground px-2">
                    +{alerts.length - 3} more alerts
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Robot list — reuse existing component */}
          <RobotListPanel
            locations={locations}
            selectedRobotId={selectedRobotId}
            onSelectRobot={onSelectRobot}
          />
        </MobileBottomSheet>
      )}

      {/* Legend — bottom-right, above bottom sheet */}
      <div className="absolute bottom-[5rem] right-3 z-[1050]">
        <MapLegend />
      </div>
    </div>
  );
}
